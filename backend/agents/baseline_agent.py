"""
backend/agents/baseline_agent.py
──────────────────────────────────
Agent 2 — BehavioralBaselineAgent

Responsibilities:
  • Build per-entity baselines from a set of SecurityEvents
  • Score individual events against those baselines using AnomalyScorer
  • Scan entire event lists, apply correlation boost within 60-min windows
  • Persist baselines and high-score alerts to SQLite
  • Persist critical alerts (score ≥ 0.9) to Neo4j Alert nodes
  • Expose get_entity_baseline() for downstream agent consumption
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Callable, Optional

import aiosqlite
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.models.schemas import AnomalyScore, Baseline, SecurityEvent
from backend.utils.anomaly_scorer import AnomalyScorer

logger = logging.getLogger("autopsy.baseline")

# ── SQLite schema ─────────────────────────────────────────────────────────────

CREATE_BASELINES_TABLE = """
CREATE TABLE IF NOT EXISTS baselines (
    entity_id           TEXT PRIMARY KEY,
    entity_type         TEXT NOT NULL,
    auth_hours          TEXT NOT NULL,       -- JSON array
    typical_source_ips  TEXT NOT NULL,       -- JSON array
    typical_destinations TEXT NOT NULL,      -- JSON array
    typical_ports       TEXT NOT NULL,       -- JSON array
    avg_daily_connections REAL NOT NULL DEFAULT 0.0,
    avg_bytes_per_session REAL NOT NULL DEFAULT 0.0,
    computed_at         TEXT NOT NULL
);
"""

CREATE_ALERTS_TABLE = """
CREATE TABLE IF NOT EXISTS alerts (
    alert_id            TEXT PRIMARY KEY,
    event_id            TEXT NOT NULL,
    entity_id           TEXT NOT NULL,
    score               REAL NOT NULL,
    severity            TEXT NOT NULL,
    contributing_factors TEXT NOT NULL,      -- JSON
    created_at          TEXT NOT NULL
);
"""

# Where to store the SQLite file (overridable via env)
import os
SQLITE_PATH = os.getenv("SQLITE_PATH", "./data/cache/autopsy.db")

# Minimum occurrences for an IP/port/destination to be considered "typical"
MIN_IP_OCCURRENCES   = 3
MIN_PORT_OCCURRENCES = 5
MIN_DEST_OCCURRENCES = 3

# Correlation boost applied to events that cluster within a 60-min window
CORRELATION_BOOST = 0.15


class BehavioralBaselineAgent:
    """
    Stateless agent — pass in events, receive baselines and anomaly scores.
    All SQLite I/O uses aiosqlite (async).  Neo4j I/O is fire-and-forget via
    run_in_executor so it never blocks the async event loop.
    """

    def __init__(
        self,
        neo4j_driver: Any = None,
        sqlite_path: str = SQLITE_PATH,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._driver      = neo4j_driver
        self._db_path     = sqlite_path
        self._progress_cb = progress_callback
        self._scorer      = AnomalyScorer()
        self._db_ready    = False          # set True after first _ensure_db()

    # ── Database bootstrap ────────────────────────────────────────────────────

    async def _ensure_db(self) -> None:
        """Create SQLite tables if they don't exist yet."""
        if self._db_ready:
            return
        os.makedirs(os.path.dirname(self._db_path), exist_ok=True)
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(CREATE_BASELINES_TABLE)
            await db.execute(CREATE_ALERTS_TABLE)
            await db.commit()
        self._db_ready = True
        logger.debug("SQLite schema ready at %s", self._db_path)

    # ── Public API ────────────────────────────────────────────────────────────

    async def build_baselines(
        self,
        events: list[SecurityEvent],
        baseline_period_days: int = 30,
    ) -> dict[str, Baseline]:
        """
        Compute per-entity behavioural baselines from a list of events.

        Algorithm per entity:
          - auth_hours: Counter of event hours → top 8 most common hours
          - typical_source_ips: IPs seen ≥ MIN_IP_OCCURRENCES times
          - typical_destinations: dest entities seen ≥ MIN_DEST_OCCURRENCES times
          - typical_ports: ports seen ≥ MIN_PORT_OCCURRENCES times
          - avg_daily_connections: total connections / baseline_period_days
          - avg_bytes_per_session: mean of bytes across all sessions

        Returns dict[entity_id → Baseline] and persists to SQLite.
        """
        await self._ensure_db()

        # Group events by source entity
        entity_events: dict[str, list[SecurityEvent]] = {}
        for event in events:
            entity_events.setdefault(event.source_entity, []).append(event)

        baselines: dict[str, Baseline] = {}

        self._emit_progress("baseline", "running", f"Building baselines for {len(entity_events)} entities", 10)

        for entity_id, ent_events in entity_events.items():
            baseline = self._compute_baseline(
                entity_id, ent_events, baseline_period_days
            )
            baselines[entity_id] = baseline
            await self._save_baseline(baseline)

        self._emit_progress("baseline", "complete", f"Baselines computed for {len(baselines)} entities", 100)
        logger.info("Built %d entity baselines from %d events", len(baselines), len(events))
        return baselines

    async def score_event(
        self,
        event: SecurityEvent,
        baselines: dict[str, Baseline],
    ) -> AnomalyScore:
        """
        Score a single SecurityEvent against its entity's baseline.

        If score ≥ 0.6  → store in SQLite alerts table.
        If score ≥ 0.9  → also add Alert node to Neo4j.
        """
        await self._ensure_db()

        baseline = baselines.get(event.source_entity) or self._scorer.get_baseline(
            event.source_entity
        )
        anomaly = self._scorer.compute_score(event, baseline)

        if anomaly.threshold_breached:
            await self._save_alert(anomaly)

        if anomaly.score >= 0.9 and self._driver:
            asyncio.get_event_loop().run_in_executor(
                None, self._write_alert_neo4j, anomaly, event
            )

        return anomaly

    async def scan_events(
        self,
        events: list[SecurityEvent],
        baselines: dict[str, Baseline],
    ) -> list[AnomalyScore]:
        """
        Score all events in the list.

        Post-processing:
          - Group events within 60-minute windows
          - Apply CORRELATION_BOOST to any event whose window contains ≥ 2
            distinct anomalous entities
          - Return scores sorted descending by final score
          - Emit SSE progress every 50 events
        """
        await self._ensure_db()

        scored: list[AnomalyScore] = []

        for idx, event in enumerate(events):
            if idx % 50 == 0:
                self._emit_progress(
                    "scan",
                    "running",
                    f"Scoring event {idx}/{len(events)}",
                    int((idx / max(len(events), 1)) * 90),
                )

            anomaly = await self.score_event(event, baselines)
            scored.append(anomaly)

        # Apply correlation boost within 60-min windows
        correlated_scores = self._apply_correlation_boost(scored, events)

        # Re-persist boosted alerts
        for score in correlated_scores:
            if score.threshold_breached:
                await self._save_alert(score)

        correlated_scores.sort(key=lambda s: s.score, reverse=True)
        self._emit_progress(
            "scan", "complete",
            f"Scored {len(correlated_scores)} events; "
            f"{sum(1 for s in correlated_scores if s.threshold_breached)} anomalies detected",
            100,
        )
        return correlated_scores

    async def get_entity_baseline(self, entity_id: str) -> Baseline | None:
        """
        Load an entity's baseline from SQLite.
        Returns None if the entity has no stored baseline.
        """
        await self._ensure_db()
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT * FROM baselines WHERE entity_id = ?", (entity_id,)
            ) as cursor:
                row = await cursor.fetchone()

        if not row:
            return None

        return Baseline(
            entity_id=row[0],
            entity_type=row[1],
            auth_hours=json.loads(row[2]),
            typical_source_ips=json.loads(row[3]),
            typical_destinations=json.loads(row[4]),
            typical_ports=json.loads(row[5]),
            avg_daily_connections=row[6],
            avg_bytes_per_session=row[7],
            computed_at=datetime.fromisoformat(row[8]),
        )

    # ── Core computation ──────────────────────────────────────────────────────

    def _compute_baseline(
        self,
        entity_id: str,
        events: list[SecurityEvent],
        baseline_period_days: int,
    ) -> Baseline:
        """Derive Baseline fields from a list of this entity's events."""
        hour_counter: Counter[int] = Counter()
        ip_counter:   Counter[str] = Counter()
        dest_counter: Counter[str] = Counter()
        port_counter: Counter[int] = Counter()
        bytes_list:   list[float]  = []
        connection_count = 0

        for event in events:
            # Extract hour
            hour = self._parse_hour(event.timestamp)
            hour_counter[hour] += 1

            # Source IPs
            src_ip = event.parsed_fields.get("source_ip", "")
            if src_ip:
                ip_counter[src_ip] += 1

            # Destination entities
            if event.dest_entity and event.dest_entity != "UNKNOWN":
                dest_counter[event.dest_entity] += 1

            # Ports
            for port_key in ("dst_port", "port", "dest_port"):
                port = event.parsed_fields.get(port_key)
                if port:
                    try:
                        port_counter[int(port)] += 1
                    except (TypeError, ValueError):
                        pass

            # Bytes
            b_sent = event.parsed_fields.get("bytes_sent", 0) or 0
            b_recv = event.parsed_fields.get("bytes_recv", 0) or 0
            total_b = float(b_sent) + float(b_recv)
            if total_b > 0:
                bytes_list.append(total_b)

            connection_count += 1

        # Compute derived fields
        top_hours = [h for h, _ in hour_counter.most_common(8)]
        typical_ips   = [ip   for ip,   cnt in ip_counter.items()   if cnt >= MIN_IP_OCCURRENCES]
        typical_dests = [dest for dest, cnt in dest_counter.items() if cnt >= MIN_DEST_OCCURRENCES]
        typical_ports = [port for port, cnt in port_counter.items() if cnt >= MIN_PORT_OCCURRENCES]
        avg_daily = connection_count / max(baseline_period_days, 1)
        avg_bytes = mean(bytes_list) if bytes_list else 0.0

        return Baseline(
            entity_id=entity_id,
            entity_type=self._infer_entity_type(entity_id, events),
            auth_hours=top_hours,
            typical_source_ips=typical_ips,
            typical_destinations=typical_dests,
            typical_ports=typical_ports,
            avg_daily_connections=avg_daily,
            avg_bytes_per_session=avg_bytes,
            computed_at=datetime.now(timezone.utc),
        )

    def _apply_correlation_boost(
        self,
        scores: list[AnomalyScore],
        events: list[SecurityEvent],
    ) -> list[AnomalyScore]:
        """
        Build a lookup of event_id → hour, then group events occurring within
        60 minutes of each other.  If a window contains ≥ 2 distinct anomalous
        entities, boost every score in that window by CORRELATION_BOOST (capped
        at 1.0).
        """
        # Build a map from event_id → timestamp hour
        event_time: dict[str, datetime] = {}
        for event in events:
            try:
                ts = datetime.fromisoformat(
                    event.timestamp.replace("Z", "+00:00")
                )
                event_time[event.event_id] = ts
            except Exception:
                pass

        # Map event_id → AnomalyScore
        score_map: dict[str, AnomalyScore] = {s.event_id: s for s in scores}

        # Group into 60-minute sliding windows
        sorted_scores = sorted(
            scores,
            key=lambda s: event_time.get(s.event_id, datetime.min),
        )

        boosted = list(scores)  # copy

        window: list[AnomalyScore] = []
        window_start: Optional[datetime] = None

        for score in sorted_scores:
            ts = event_time.get(score.event_id)
            if ts is None:
                continue

            if window_start is None:
                window_start = ts
                window = [score]
                continue

            delta_mins = (ts - window_start).total_seconds() / 60.0
            if delta_mins <= 60:
                window.append(score)
            else:
                # Evaluate and boost the completed window
                self._boost_window(window, score_map)
                window = [score]
                window_start = ts

        if window:
            self._boost_window(window, score_map)

        return list(score_map.values())

    @staticmethod
    def _boost_window(
        window: list[AnomalyScore],
        score_map: dict[str, AnomalyScore],
    ) -> None:
        """Boost scores in a correlated window if ≥ 2 distinct anomalous entities."""
        anomalous_entities = {
            s.entity_id for s in window if s.threshold_breached
        }
        if len(anomalous_entities) >= 2:
            for s in window:
                existing = score_map.get(s.event_id)
                if existing:
                    new_score = min(1.0, existing.score + CORRELATION_BOOST)
                    # Update fields (re-derive severity)
                    severity = (
                        "CRITICAL" if new_score >= 0.9
                        else "HIGH" if new_score >= 0.75
                        else "MEDIUM" if new_score >= 0.6
                        else "LOW"
                    )
                    score_map[s.event_id] = AnomalyScore(
                        event_id=existing.event_id,
                        entity_id=existing.entity_id,
                        score=round(new_score, 4),
                        contributing_factors=existing.contributing_factors
                        + [{"factor": "CorrelationBoost", "value": CORRELATION_BOOST}],
                        severity=severity,
                        threshold_breached=new_score >= 0.6,
                    )

    # ── SQLite persistence ────────────────────────────────────────────────────

    async def _save_baseline(self, baseline: Baseline) -> None:
        """Upsert a single Baseline record into SQLite."""
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO baselines
                (entity_id, entity_type, auth_hours, typical_source_ips,
                 typical_destinations, typical_ports, avg_daily_connections,
                 avg_bytes_per_session, computed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    baseline.entity_id,
                    baseline.entity_type,
                    json.dumps(baseline.auth_hours),
                    json.dumps(baseline.typical_source_ips),
                    json.dumps(baseline.typical_destinations),
                    json.dumps(baseline.typical_ports),
                    baseline.avg_daily_connections,
                    baseline.avg_bytes_per_session,
                    baseline.computed_at.isoformat(),
                ),
            )
            await db.commit()

    async def _save_alert(self, anomaly: AnomalyScore) -> None:
        """Persist an anomaly-threshold-breaching score to the alerts table."""
        alert_id = f"alrt_{uuid.uuid4().hex[:12]}"
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT OR IGNORE INTO alerts
                (alert_id, event_id, entity_id, score, severity,
                 contributing_factors, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    alert_id,
                    anomaly.event_id,
                    anomaly.entity_id,
                    anomaly.score,
                    anomaly.severity,
                    json.dumps(anomaly.contributing_factors),
                    datetime.utcnow().isoformat(),
                ),
            )
            await db.commit()

    # ── Neo4j persistence ─────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4))
    def _write_alert_neo4j(self, anomaly: AnomalyScore, event: SecurityEvent) -> None:
        """
        Write a critical-severity Alert node to Neo4j.
        Called via run_in_executor so it doesn't block the async loop.
        """
        if not self._driver:
            return
        alert_id = f"alert_{event.event_id}_{uuid.uuid4().hex[:6]}"
        with self._driver.session() as session:
            session.run(
                """
                MERGE (a:Alert {alert_id: $alert_id})
                SET a.event_id       = $event_id,
                    a.entity_id      = $entity_id,
                    a.score          = $score,
                    a.severity       = $severity,
                    a.timestamp      = $timestamp,
                    a.technique      = $technique,
                    a.risk_indicators = $risk_indicators
                WITH a
                MATCH (e:Entity {entity_id: $entity_id})
                MERGE (a)-[:TRIGGERED_BY]->(e)
                """,
                alert_id=alert_id,
                event_id=event.event_id,
                entity_id=anomaly.entity_id,
                score=anomaly.score,
                severity=anomaly.severity,
                timestamp=event.timestamp,
                technique=event.mitre_technique_id or "",
                risk_indicators=event.risk_indicators,
            )
        logger.info(
            "Neo4j Alert node created for %s (score=%.3f)", event.event_id, anomaly.score
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_hour(timestamp: str) -> int:
        """Extract the hour (0–23) from an ISO-8601 timestamp string."""
        try:
            if "T" in timestamp:
                return int(timestamp.split("T")[1].split(":")[0])
        except (IndexError, ValueError):
            pass
        return 12  # Safe default: noon

    @staticmethod
    def _infer_entity_type(entity_id: str, events: list[SecurityEvent]) -> str:
        """Use event types to infer whether an entity is HOST, ACCOUNT, IP, etc."""
        import re
        if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", entity_id):
            return "IP"
        if entity_id.endswith("$") or entity_id.startswith("svc_"):
            return "ACCOUNT"
        if re.search(r"\.(com|net|org|in|io)$", entity_id, re.IGNORECASE):
            return "DOMAIN"
        return "HOST"

    def _emit_progress(self, step: str, status: str, summary: str, progress: int) -> None:
        """Fire the SSE progress callback if one is registered."""
        if self._progress_cb:
            try:
                self._progress_cb(
                    {
                        "agent": "BehavioralBaselineAgent",
                        "step": step,
                        "status": status,
                        "summary": summary,
                        "progress": progress,
                    }
                )
            except Exception:
                pass
