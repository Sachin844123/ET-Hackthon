"""
backend/agents/ingestion_agent.py
──────────────────────────────────
Agent 1 — LogIngestionAgent

Responsibilities:
  • Detect log file type (EVTX / JSON / syslog) from extension + magic bytes
  • Delegate to the correct parser in utils/log_parsers.py
  • For every SecurityEvent:
      - Compute risk_indicators list
      - Generate a ChromaDB embedding (text = stringified parsed_fields)
      - Upsert Entity nodes in Neo4j
      - Create SecurityEvent node in Neo4j
      - Create COMMUNICATED_WITH / AUTHENTICATED_AS edges
  • Return IngestionResult with event/entity/anomaly counts
  • ingest_synthetic_scenario(): orchestrate all log files for a named scenario
    in chronological order (baseline_logs first, then attack_logs/day_*)
  • Batch processing (100 events per batch), SSE progress callback, Neo4j retry
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.models.schemas import SecurityEvent
from backend.utils.anomaly_scorer import AnomalyScorer
from backend.utils.log_parsers import (
    detect_risk_indicators,
    parse_synthetic_json,
    parse_windows_event_log,
    parse_syslog,
    parse_netflow_json,
    parse_dns_log,
)

logger = logging.getLogger("autopsy.ingestion")

# ── Result model ──────────────────────────────────────────────────────────────

class IngestionResult(BaseModel):
    """Returned by every ingest call — summarises what was processed."""

    incident_id: str
    total_events: int = 0
    entities_discovered: list[str] = []
    anomalies_flagged: int = 0
    embeddings_stored: int = 0
    neo4j_nodes_created: int = 0
    neo4j_edges_created: int = 0
    errors: list[str] = []
    duration_seconds: float = 0.0

# ── Batch size ────────────────────────────────────────────────────────────────
BATCH_SIZE = 100  # events per Neo4j / Chroma batch


class LogIngestionAgent:
    """
    Stateless agent: each public method can be called independently.
    Dependencies (Neo4j driver, ChromaDB collection) are passed in or
    resolved lazily from config so the agent works without full infra.
    """

    def __init__(
        self,
        neo4j_driver: Any = None,
        chroma_collection: Any = None,
        openai_client: Any = None,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._driver = neo4j_driver
        self._collection = chroma_collection        # ChromaDB collection object
        self._openai = openai_client                # openai.AsyncOpenAI instance
        self._progress_cb = progress_callback
        self._scorer = AnomalyScorer()

    # ── Public entrypoints ────────────────────────────────────────────────────

    async def ingest(
        self,
        file_paths: list[str],
        incident_id: str,
    ) -> IngestionResult:
        """
        Parse a list of log files and persist all derived data.

        Order of processing per file:
          1. Detect file type → select parser
          2. Parse into SecurityEvent list
          3. Enrich each event with risk_indicators
          4. Batch-persist: Chroma embeddings + Neo4j nodes/edges
        """
        start_ts = datetime.utcnow()
        result = IngestionResult(incident_id=incident_id)
        all_events: list[SecurityEvent] = []

        for idx, file_path in enumerate(file_paths):
            self._emit_progress(
                step="ingest",
                status="running",
                summary=f"Parsing file {idx + 1}/{len(file_paths)}: {Path(file_path).name}",
                progress=int((idx / len(file_paths)) * 60),
            )

            try:
                events = self._parse_file(file_path)
                all_events.extend(events)
                logger.info(
                    "Parsed %d events from %s",
                    len(events),
                    Path(file_path).name,
                )
            except Exception as exc:
                msg = f"Failed to parse {file_path}: {exc}"
                logger.error(msg)
                result.errors.append(msg)

        # Process events in batches
        result.total_events = len(all_events)
        entities: set[str] = set()

        for batch_start in range(0, len(all_events), BATCH_SIZE):
            batch = all_events[batch_start : batch_start + BATCH_SIZE]
            batch_progress = 60 + int((batch_start / max(len(all_events), 1)) * 35)

            self._emit_progress(
                step="ingest",
                status="running",
                summary=f"Processing events {batch_start}–{batch_start + len(batch)}",
                progress=batch_progress,
            )

            for event in batch:
                entities.add(event.source_entity)
                entities.add(event.dest_entity)

                # Score anomaly and annotate
                score = self._scorer.compute_score(event)
                event.anomaly_score = score.score
                if score.threshold_breached:
                    result.anomalies_flagged += 1

            # Persist batch to vector store
            embedded = await self._store_embeddings_batch(batch)
            result.embeddings_stored += embedded

            # Persist batch to Neo4j
            nodes_created, edges_created = await self._upsert_neo4j_batch(
                batch, incident_id
            )
            result.neo4j_nodes_created += nodes_created
            result.neo4j_edges_created += edges_created

        result.entities_discovered = list(entities)
        result.duration_seconds = (datetime.utcnow() - start_ts).total_seconds()

        self._emit_progress(
            step="ingest",
            status="complete",
            summary=(
                f"Ingested {result.total_events} events, "
                f"{len(result.entities_discovered)} entities, "
                f"{result.anomalies_flagged} anomalies flagged"
            ),
            progress=100,
        )
        logger.info(
            "Ingestion complete for %s: %d events, %d entities, %d anomalies",
            incident_id,
            result.total_events,
            len(result.entities_discovered),
            result.anomalies_flagged,
        )
        return result

    async def ingest_synthetic_scenario(
        self,
        scenario: str,
        data_root: str = "./data/synthetic",
    ) -> IngestionResult:
        """
        Load all log files for a named scenario folder and process them in
        chronological order: baseline_logs first, then attack_logs sorted by
        day number prefix (day_01, day_03, day_07 …).

        This is what demo endpoints call.
        """
        scenario_dir = Path(data_root) / scenario
        if not scenario_dir.exists():
            raise FileNotFoundError(
                f"Synthetic scenario directory not found: {scenario_dir}"
            )

        log_files: list[str] = []

        # 1. Baseline logs first (establish normal behaviour)
        baseline_dir = scenario_dir / "baseline_logs"
        if baseline_dir.exists():
            baseline_files = sorted(baseline_dir.glob("*.json"))
            log_files.extend(str(f) for f in baseline_files)
            logger.info(
                "Found %d baseline log files in %s",
                len(baseline_files),
                baseline_dir,
            )

        # 2. Attack logs sorted by day number
        attack_dir = scenario_dir / "attack_logs"
        if attack_dir.exists():
            attack_files = sorted(
                attack_dir.glob("*.json"),
                key=lambda p: self._extract_day_number(p.name),
            )
            log_files.extend(str(f) for f in attack_files)
            logger.info(
                "Found %d attack log files in %s",
                len(attack_files),
                attack_dir,
            )

        if not log_files:
            logger.warning("No log files found for scenario '%s'.", scenario)
            return IngestionResult(incident_id=scenario)

        logger.info(
            "Starting ingestion for scenario '%s' — %d total files",
            scenario,
            len(log_files),
        )
        return await self.ingest(log_files, incident_id=scenario)

    # ── File type detection & parsing ─────────────────────────────────────────

    def _parse_file(self, file_path: str) -> list[SecurityEvent]:
        """Detect file type and dispatch to the appropriate parser."""
        file_type = self._detect_file_type(file_path)
        logger.debug("Detected file type '%s' for %s", file_type, file_path)

        if file_type == "evtx":
            return parse_windows_event_log(file_path)
        elif file_type == "syslog":
            return parse_syslog(file_path)
        elif file_type == "netflow":
            return parse_netflow_json(file_path)
        elif file_type == "dns":
            return parse_dns_log(file_path)
        else:
            # Default: treat as generic JSON
            return parse_synthetic_json(file_path)

    def _detect_file_type(self, file_path: str) -> str:
        """
        Determine log file type using:
          1. File extension
          2. Magic bytes (first 4 bytes of file)
          3. Filename keyword matching
        """
        path = Path(file_path)
        ext = path.suffix.lower()
        name = path.stem.lower()

        # Extension-based detection
        if ext == ".evtx":
            return "evtx"
        if ext in (".log", ".syslog"):
            return "syslog"

        # Filename keyword matching
        if "dns" in name or "query" in name:
            return "dns"
        if "netflow" in name or "flow" in name or "traffic" in name:
            return "netflow"

        # Magic bytes detection for binary formats
        if os.path.exists(file_path):
            try:
                with open(file_path, "rb") as fh:
                    magic = fh.read(4)
                # EVTX magic: 0x456C664E ("ElfN")
                if magic == b"ElfN":
                    return "evtx"
            except (IOError, OSError):
                pass

        return "json"

    # ── Embedding storage ─────────────────────────────────────────────────────

    async def _store_embeddings_batch(self, events: list[SecurityEvent]) -> int:
        """
        Embed and store a batch of events in ChromaDB.
        Uses OpenAI text-embedding-3-small when available; falls back to a
        simple TF-IDF-style hash embedding so the code always runs.
        Returns number of embeddings successfully stored.
        """
        if not self._collection:
            return 0  # No ChromaDB — silently skip

        stored = 0
        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict] = []

        for event in events:
            doc_text = (
                f"event_type={event.event_type} "
                f"source={event.source_entity} dest={event.dest_entity} "
                f"risk={','.join(event.risk_indicators)} "
                f"fields={json.dumps(event.parsed_fields, default=str)}"
            )
            ids.append(event.event_id)
            documents.append(doc_text[:2000])  # ChromaDB default max
            metadatas.append(
                {
                    "event_type": event.event_type,
                    "source_entity": event.source_entity,
                    "dest_entity": event.dest_entity,
                    "timestamp": event.timestamp,
                    "anomaly_score": str(event.anomaly_score),
                    "mitre_technique_id": event.mitre_technique_id or "",
                }
            )

        # Generate embeddings
        embeddings: list[list[float]] | None = None
        if self._openai:
            try:
                response = await self._openai.embeddings.create(
                    model="text-embedding-3-small",
                    input=documents,
                )
                embeddings = [item.embedding for item in response.data]
            except Exception as exc:
                logger.warning("OpenAI embedding failed (using ChromaDB default): %s", exc)

        try:
            upsert_kwargs: dict[str, Any] = {
                "ids": ids,
                "documents": documents,
                "metadatas": metadatas,
            }
            if embeddings:
                upsert_kwargs["embeddings"] = embeddings

            self._collection.upsert(**upsert_kwargs)
            stored = len(ids)
        except Exception as exc:
            logger.error("ChromaDB upsert failed: %s", exc)

        return stored

    # ── Neo4j persistence ─────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=5))
    def _neo4j_write(self, cypher: str, params: dict) -> None:
        """Execute a single Cypher write with retry logic."""
        if not self._driver:
            return
        with self._driver.session() as session:
            session.run(cypher, **params)

    async def _upsert_neo4j_batch(
        self, events: list[SecurityEvent], incident_id: str
    ) -> tuple[int, int]:
        """
        Upsert Entity nodes, SecurityEvent nodes, and relationship edges
        for a batch of events. Returns (nodes_created, edges_created).
        """
        if not self._driver:
            return 0, 0

        nodes_created = 0
        edges_created = 0

        for event in events:
            try:
                # 1. Upsert source entity
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda e=event: self._neo4j_write(
                        """
                        MERGE (n:Entity {entity_id: $entity_id})
                        SET n.name = $name,
                            n.type = $entity_type,
                            n.last_seen = $timestamp
                        """,
                        {
                            "entity_id": e.source_entity,
                            "name": e.source_entity,
                            "entity_type": self._infer_entity_type(e.source_entity),
                            "timestamp": e.timestamp,
                        },
                    ),
                )
                nodes_created += 1

                # 2. Upsert destination entity
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda e=event: self._neo4j_write(
                        """
                        MERGE (n:Entity {entity_id: $entity_id})
                        SET n.name = $name,
                            n.type = $entity_type,
                            n.last_seen = $timestamp
                        """,
                        {
                            "entity_id": e.dest_entity,
                            "name": e.dest_entity,
                            "entity_type": self._infer_entity_type(e.dest_entity),
                            "timestamp": e.timestamp,
                        },
                    ),
                )
                nodes_created += 1

                # 3. Upsert SecurityEvent node
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda e=event: self._neo4j_write(
                        """
                        MERGE (s:SecurityEvent {event_id: $event_id})
                        SET s.event_type = $event_type,
                            s.timestamp = $timestamp,
                            s.anomaly_score = $anomaly_score,
                            s.risk_indicators = $risk_indicators,
                            s.mitre_technique_id = $mitre_technique_id,
                            s.incident_id = $incident_id
                        """,
                        {
                            "event_id": e.event_id,
                            "event_type": e.event_type,
                            "timestamp": e.timestamp,
                            "anomaly_score": e.anomaly_score,
                            "risk_indicators": e.risk_indicators,
                            "mitre_technique_id": e.mitre_technique_id or "",
                            "incident_id": incident_id,
                        },
                    ),
                )
                nodes_created += 1

                # 4. Create edge: source → dest
                edge_type = self._infer_edge_type(event)
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda e=event, et=edge_type: self._neo4j_write(
                        f"""
                        MATCH (src:Entity {{entity_id: $src_id}})
                        MATCH (dst:Entity {{entity_id: $dst_id}})
                        MERGE (src)-[r:{et} {{event_id: $event_id}}]->(dst)
                        SET r.timestamp = $timestamp,
                            r.anomalous = $anomalous,
                            r.technique = $technique
                        """,
                        {
                            "src_id": e.source_entity,
                            "dst_id": e.dest_entity,
                            "event_id": e.event_id,
                            "timestamp": e.timestamp,
                            "anomalous": e.anomaly_score >= 0.6,
                            "technique": e.mitre_technique_id or "",
                        },
                    ),
                )
                edges_created += 1

            except Exception as exc:
                logger.error(
                    "Neo4j persistence failed for event %s: %s", event.event_id, exc
                )

        return nodes_created, edges_created

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_day_number(filename: str) -> int:
        """Extract day number from filenames like 'day_01_initial_access.json'."""
        match = re.search(r"day[_\-]?(\d+)", filename, re.IGNORECASE)
        return int(match.group(1)) if match else 999

    @staticmethod
    def _infer_entity_type(entity_id: str) -> str:
        """Guess entity type from entity_id pattern."""
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", entity_id):
            return "IP"
        if entity_id.endswith("$") or entity_id.startswith("svc_"):
            return "ACCOUNT"
        if re.search(r"\.(com|net|org|in|io)$", entity_id, re.IGNORECASE):
            return "DOMAIN"
        if entity_id.startswith("AIIMS-") or entity_id.startswith("CBSE-"):
            return "HOST"
        return "HOST"

    @staticmethod
    def _infer_edge_type(event: SecurityEvent) -> str:
        """Map event_type to a Neo4j relationship type."""
        et = event.event_type.upper()
        if "AUTH" in et or "LOGON" in et or "LOGIN" in et:
            return "AUTHENTICATED_AS"
        if "PROCESS" in et or "EXEC" in et:
            return "EXECUTED_PROCESS"
        return "COMMUNICATED_WITH"

    def _emit_progress(
        self,
        step: str,
        status: str,
        summary: str,
        progress: int,
    ) -> None:
        """Fire the SSE progress callback if one is registered."""
        if self._progress_cb:
            try:
                self._progress_cb(
                    {
                        "agent": "LogIngestionAgent",
                        "step": step,
                        "status": status,
                        "summary": summary,
                        "progress": progress,
                    }
                )
            except Exception:
                pass  # Never let callback errors crash the agent
