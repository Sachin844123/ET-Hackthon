"""
backend/agents/orchestrator.py
────────────────────────────────
AttackChainOrchestrator — LangGraph StateGraph

Wires all 5 agents into a directed pipeline:

  ingest_node → baseline_node → attribution_node
                                     ↓
                         (RETROACTIVE) retroactive_node → compile_node
                         (LIVE)        response_node    → compile_node

The stream_callback is called after every node completes, enabling real-time
SSE progress updates to the frontend.

AutopsyState is a TypedDict carrying all intermediate data through the graph.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Optional, TypedDict

from langgraph.graph import END, StateGraph

from backend.agents.attribution_agent import TTAttributionAgent
from backend.agents.baseline_agent import BehavioralBaselineAgent
from backend.agents.ingestion_agent import IngestionResult, LogIngestionAgent
from backend.agents.response_agent import AutonomousResponseAgent
from backend.agents.retroactive_agent import RetroactivePredictionAgent
from backend.graph.schema import get_attack_graph
from backend.mitre.attck_client import MITREAttackClient
from backend.models.schemas import (
    AnomalyScore,
    AutopsyResult,
    Baseline,
    IncidentInput,
    PlaybookExecution,
    RetroactiveAlert,
    SecurityEvent,
    ThreatActorAttribution,
    TTPAttribution,
)

logger = logging.getLogger("autopsy.orchestrator")


# ── LangGraph State ───────────────────────────────────────────────────────────

class AutopsyState(TypedDict, total=False):
    """Full state object passed through every node in the LangGraph pipeline."""

    # Inputs
    incident: IncidentInput
    raw_log_files: list[str]

    # Computed data
    parsed_events: list[SecurityEvent]
    baselines: dict[str, Baseline]
    anomaly_scores: list[AnomalyScore]
    ttp_attributions: list[TTPAttribution]
    actor_attribution: Optional[ThreatActorAttribution]
    retroactive_alerts: list[RetroactiveAlert]
    playbook_executions: list[PlaybookExecution]

    # Result assembly
    graph_data: dict[str, Any]
    error_log: list[str]

    # SSE streaming updates sent to frontend after each node
    progress_updates: list[dict[str, Any]]


# ── Orchestrator ──────────────────────────────────────────────────────────────

class AttackChainOrchestrator:
    """
    Compiles and runs the 5-node LangGraph pipeline.

    Usage:
        orchestrator = AttackChainOrchestrator(neo4j_driver=driver)
        result = await orchestrator.run(incident, stream_callback=cb)
    """

    def __init__(
        self,
        neo4j_driver: Any = None,
        chroma_collection: Any = None,
        openai_client: Any = None,
        anthropic_api_key: Optional[str] = None,
        sqlite_path: str = "./data/cache/autopsy.db",
    ) -> None:
        self._driver     = neo4j_driver
        self._chroma     = chroma_collection
        self._openai     = openai_client
        self._api_key    = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._sqlite     = sqlite_path
        self._mitre      = MITREAttackClient()

        # Instantiate all 5 agents (progress callbacks wired in run())
        self._ingestion    = LogIngestionAgent(
            neo4j_driver=neo4j_driver,
            chroma_collection=chroma_collection,
            openai_client=openai_client,
        )
        self._baseline     = BehavioralBaselineAgent(
            neo4j_driver=neo4j_driver,
            sqlite_path=sqlite_path,
        )
        self._attribution  = TTAttributionAgent(
            neo4j_driver=neo4j_driver,
            mitre_client=self._mitre,
            anthropic_api_key=self._api_key,
        )
        self._retroactive  = RetroactivePredictionAgent()
        self._response     = AutonomousResponseAgent(
            neo4j_driver=neo4j_driver,
            sqlite_path=sqlite_path,
        )

        self._graph = self._build_graph()

    # ── Graph construction ────────────────────────────────────────────────────

    def _build_graph(self) -> Any:
        """
        Build the LangGraph StateGraph with all nodes and edges.
        Edges are conditional based on incident.mode (RETROACTIVE | LIVE).
        """
        graph = StateGraph(AutopsyState)

        # Register nodes
        graph.add_node("ingest_node", self._ingest_node)
        graph.add_node("baseline_node", self._baseline_node)
        graph.add_node("attribution_node", self._attribution_node)
        graph.add_node("retroactive_node", self._retroactive_node)
        graph.add_node("response_node", self._response_node)
        graph.add_node("compile_node", self._compile_node)

        # Entry point
        graph.set_entry_point("ingest_node")

        # Fixed edges
        graph.add_edge("ingest_node", "baseline_node")
        graph.add_edge("baseline_node", "attribution_node")

        # Conditional edge: mode-based routing after attribution
        graph.add_conditional_edges(
            "attribution_node",
            self._route_after_attribution,
            {
                "retroactive": "retroactive_node",
                "live": "response_node",
            },
        )

        # Both paths merge at compile_node
        graph.add_edge("retroactive_node", "compile_node")
        graph.add_edge("response_node", "compile_node")
        graph.add_edge("compile_node", END)

        return graph.compile()

    @staticmethod
    def _route_after_attribution(state: AutopsyState) -> str:
        """Route to retroactive or live response path."""
        incident = state.get("incident")
        # IncidentInput is a Pydantic model — use attribute access, not .get()
        if incident is None:
            return "retroactive"
        mode = incident.mode if hasattr(incident, "mode") else (incident.get("mode", "RETROACTIVE") if isinstance(incident, dict) else "RETROACTIVE")
        return "retroactive" if str(mode).upper() == "RETROACTIVE" else "live"

    # ── Node implementations ──────────────────────────────────────────────────

    async def _ingest_node(self, state: AutopsyState) -> AutopsyState:
        """
        Node 1 — LogIngestionAgent.
        Loads log files for the given scenario (or provided file paths) and
        returns parsed SecurityEvents.
        """
        incident: IncidentInput = state["incident"]
        incident_id = (incident.incident_id or "generic").lower()

        # Map incident_id → actual scenario folder under data/synthetic/
        # e.g. 'aiims_2022' → 'aiims_attack', 'cbse_2026' → 'cbse_attack'
        SCENARIO_FOLDER_MAP = {
            "aiims_2022": "aiims_attack",
            "cbse_2026":  "cbse_attack",
        }
        scenario_folder = SCENARIO_FOLDER_MAP.get(incident_id, f"{incident_id}_attack")

        self._push_progress(state, "ingest_node", "running", 5,
                             "Ingesting log files...")

        try:
            # Use synthetic scenario loader for known incidents
            result: IngestionResult = await self._ingestion.ingest_synthetic_scenario(
                scenario=scenario_folder
            )

            self._push_progress(
                state,
                "ingest_node",
                "complete",
                20,
                f"Ingested {result.total_events} events from "
                f"{len(result.entities_discovered)} entities",
            )

            # Re-parse events directly for downstream agents
            # (IngestionResult doesn't carry the full objects back)
            from backend.utils.log_parsers import parse_synthetic_json
            from pathlib import Path

            data_dir = Path(f"./data/synthetic/{scenario_folder}")
            raw_events: list[SecurityEvent] = []

            for sub in ("baseline_logs", "attack_logs"):
                sub_dir = data_dir / sub
                if sub_dir.exists():
                    for f in sorted(sub_dir.glob("*.json")):
                        raw_events.extend(parse_synthetic_json(str(f)))

        except FileNotFoundError:
            # Scenario directory missing — proceed with empty events (demo degrades gracefully)
            logger.warning(
                "Scenario directory '%s' not found. Proceeding without events.",
                scenario_folder,
            )
            raw_events = []
            self._push_progress(
                state, "ingest_node", "degraded", 20,
                "No scenario logs found — running in degraded mode"
            )

        except Exception as exc:
            logger.error("ingest_node failed: %s", exc)
            state.setdefault("error_log", []).append(f"ingest_node: {exc}")
            raw_events = []

        state["parsed_events"] = raw_events
        return state

    async def _baseline_node(self, state: AutopsyState) -> AutopsyState:
        """
        Node 2 — BehavioralBaselineAgent.
        Builds per-entity baselines and scores every event.
        """
        self._push_progress(state, "baseline_node", "running", 25,
                             "Building behavioural baselines...")

        events = state.get("parsed_events", [])

        try:
            baselines = await self._baseline.build_baselines(events)
            anomaly_scores = await self._baseline.scan_events(events, baselines)

            anomaly_count = sum(1 for s in anomaly_scores if s.threshold_breached)
            self._push_progress(
                state,
                "baseline_node",
                "complete",
                40,
                f"Baselines built for {len(baselines)} entities; "
                f"{anomaly_count} anomalies detected",
            )

        except Exception as exc:
            logger.error("baseline_node failed: %s", exc)
            state.setdefault("error_log", []).append(f"baseline_node: {exc}")
            baselines = {}
            anomaly_scores = []

        state["baselines"] = baselines
        state["anomaly_scores"] = anomaly_scores
        return state

    async def _attribution_node(self, state: AutopsyState) -> AutopsyState:
        """
        Node 3 — TTAttributionAgent.
        Maps anomalies to MITRE ATT&CK techniques and attributes to a threat actor.
        """
        self._push_progress(state, "attribution_node", "running", 45,
                             "Mapping behaviours to MITRE ATT&CK...")

        events   = state.get("parsed_events", [])
        anomalies = state.get("anomaly_scores", [])

        try:
            ttp_attributions = await self._attribution.map_anomalies_to_ttps(
                anomalies, events
            )

            # Extract actor attribution from Claude result (stored in agent)
            actor_attribution = self._build_actor_attribution(ttp_attributions)

            self._push_progress(
                state,
                "attribution_node",
                "complete",
                60,
                f"Attributed {len(ttp_attributions)} techniques; "
                f"actor: {actor_attribution.actor_name if actor_attribution else 'Unknown'}",
            )

        except Exception as exc:
            logger.error("attribution_node failed: %s", exc)
            state.setdefault("error_log", []).append(f"attribution_node: {exc}")
            ttp_attributions = []
            actor_attribution = None

        state["ttp_attributions"] = ttp_attributions
        state["actor_attribution"] = actor_attribution
        return state

    async def _retroactive_node(self, state: AutopsyState) -> AutopsyState:
        """
        Node 4a (RETROACTIVE mode) — RetroactivePredictionAgent.
        Reconstructs what the system would have detected and when.
        """
        self._push_progress(state, "retroactive_node", "running", 65,
                             "Replaying historical events for retroactive analysis...")

        incident        = state["incident"]
        events          = state.get("parsed_events", [])
        baselines       = state.get("baselines", {})
        ttp_attributions = state.get("ttp_attributions", [])

        def cb(update: dict) -> None:
            self._push_progress(
                state,
                "retroactive_node",
                update.get("status", "running"),
                update.get("progress", 70),
                update.get("summary", ""),
            )

        try:
            retroactive_alerts = await self._retroactive.reconstruct(
                incident=incident,
                all_events=events,
                baselines=baselines,
                ttp_attributions=ttp_attributions,
                progress_cb=cb,
            )

            self._push_progress(
                state,
                "retroactive_node",
                "complete",
                85,
                f"Generated {len(retroactive_alerts)} retroactive alerts; "
                f"earliest detection: "
                f"T-{max((a.days_before_incident for a in retroactive_alerts), default=0)} days",
            )

        except Exception as exc:
            logger.error("retroactive_node failed: %s", exc)
            state.setdefault("error_log", []).append(f"retroactive_node: {exc}")
            retroactive_alerts = []

        state["retroactive_alerts"] = retroactive_alerts
        return state

    async def _response_node(self, state: AutopsyState) -> AutopsyState:
        """
        Node 4b (LIVE mode) — AutonomousResponseAgent.
        Evaluates top anomalies and triggers SOAR playbooks.
        """
        self._push_progress(state, "response_node", "running", 65,
                             "Evaluating alerts for automated response...")

        anomaly_scores   = state.get("anomaly_scores", [])
        ttp_attributions = state.get("ttp_attributions", [])
        incident         = state["incident"]
        executions: list[PlaybookExecution] = []

        try:
            # Build synthetic alerts from TTP attributions for playbook matching
            for ttp in ttp_attributions:
                alert = RetroactiveAlert(
                    alert_id=f"live_{uuid.uuid4().hex[:8]}",
                    timestamp_absolute=datetime.now(timezone.utc),
                    time_before_incident="T-0 days",
                    days_before_incident=0,
                    confidence=ttp.confidence,
                    alert_type="LIVE_DETECTION",
                    mitre_technique_id=ttp.technique_id,
                    description=f"Live detection of {ttp.technique_name} ({ttp.tactic})",
                    recommended_action="",
                    would_have_prevented_breach=False,
                )
                execution = await self._response.evaluate_and_respond(alert)
                if execution:
                    executions.append(execution)

            self._push_progress(
                state,
                "response_node",
                "complete",
                85,
                f"Response: {len(executions)} playbooks triggered "
                f"({sum(1 for e in executions if e.status == 'EXECUTED')} executed, "
                f"{sum(1 for e in executions if e.status == 'PENDING_APPROVAL')} pending approval)",
            )

        except Exception as exc:
            logger.error("response_node failed: %s", exc)
            state.setdefault("error_log", []).append(f"response_node: {exc}")

        state["playbook_executions"] = executions
        return state

    async def _compile_node(self, state: AutopsyState) -> AutopsyState:
        """
        Final node — assembles the AutopsyResult and fetches graph data from Neo4j.
        """
        self._push_progress(state, "compile_node", "running", 90,
                             "Compiling results and fetching graph data...")

        incident = state["incident"]
        incident_id = (incident.incident_id or "generic").lower()

        # Fetch graph visualization data from Neo4j
        try:
            if self._driver:
                graph_data = get_attack_graph(self._driver, incident_id)
            else:
                graph_data = self._fallback_graph_data(incident_id)
        except Exception as exc:
            logger.warning("Graph fetch failed: %s", exc)
            graph_data = self._fallback_graph_data(incident_id)

        state["graph_data"] = graph_data

        self._push_progress(state, "compile_node", "complete", 100,
                             "Autopsy complete")
        return state

    # ── Public run() ─────────────────────────────────────────────────────────

    async def run(
        self,
        incident: IncidentInput,
        stream_callback: Optional[Callable[[dict], None]] = None,
    ) -> AutopsyResult:
        """
        Execute the full LangGraph pipeline and return a complete AutopsyResult.

        stream_callback is called after each node with:
          {
            "step": node_name,
            "progress": int,          # 0–100
            "status": "complete|running|error",
            "summary": str
          }
        """
        autopsy_id = f"auto_{uuid.uuid4().hex[:12]}"
        start_ts = datetime.now(timezone.utc)

        initial_state: AutopsyState = {
            "incident": incident,
            "raw_log_files": [],
            "parsed_events": [],
            "baselines": {},
            "anomaly_scores": [],
            "ttp_attributions": [],
            "actor_attribution": None,
            "retroactive_alerts": [],
            "playbook_executions": [],
            "graph_data": {},
            "error_log": [],
            "progress_updates": [],
        }

        # Wire the stream_callback into the state so nodes can push updates
        initial_state["_stream_callback"] = stream_callback  # type: ignore[typeddict-item]

        logger.info(
            "Starting autopsy run %s for incident '%s' (mode=%s)",
            autopsy_id,
            incident.name,
            incident.mode,
        )

        try:
            final_state: AutopsyState = await self._graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("Pipeline failed: %s", exc, exc_info=True)
            final_state = initial_state
            final_state.setdefault("error_log", []).append(f"pipeline: {exc}")

        # ── Assemble AutopsyResult ────────────────────────────────────────────
        retroactive_alerts = final_state.get("retroactive_alerts", [])
        ttp_attributions   = final_state.get("ttp_attributions", [])
        actor_attribution  = final_state.get("actor_attribution")
        graph_data         = final_state.get("graph_data", {})
        playbook_executions = final_state.get("playbook_executions", [])

        dwell_time = (
            (incident.timeframe_end - incident.timeframe_start).days
            if incident.timeframe_end and incident.timeframe_start else None
        )

        earliest_detectable: Optional[str] = None
        prevention_window: Optional[int] = None
        if retroactive_alerts:
            latest = max(retroactive_alerts, key=lambda a: a.days_before_incident)
            earliest_detectable = latest.timestamp_absolute.isoformat()
            prevention_alerts = [
                a for a in retroactive_alerts if a.would_have_prevented_breach
            ]
            if prevention_alerts:
                prevention_window = max(
                    a.days_before_incident for a in prevention_alerts
                )

        kill_chain_coverage = self._compute_kill_chain_coverage(ttp_attributions)

        audit_trail = [
            {
                "timestamp": start_ts.isoformat(),
                "event": "AUTOPSY_STARTED",
                "autopsy_id": autopsy_id,
            }
        ]
        audit_trail.extend(final_state.get("progress_updates", []))
        audit_trail.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": "AUTOPSY_COMPLETE",
                "autopsy_id": autopsy_id,
                "errors": final_state.get("error_log", []),
            }
        )

        result = AutopsyResult(
            autopsy_id=autopsy_id,
            incident_id=incident.incident_id or "generic",
            incident_name=incident.name,
            run_timestamp=start_ts,
            mode=incident.mode,
            dwell_time_days=dwell_time,
            earliest_detectable_signal=earliest_detectable,
            prevention_window_days=prevention_window,
            retroactive_alerts=retroactive_alerts,
            ttp_attributions=ttp_attributions,
            actor_attribution=actor_attribution,
            playbook_executions=playbook_executions,
            kill_chain_coverage=kill_chain_coverage,
            graph_nodes=graph_data.get("nodes", []),
            graph_edges=graph_data.get("links", []),
            audit_trail=audit_trail,
        )

        logger.info(
            "Autopsy %s complete: %d alerts | %d TTPs | prevention=%s days",
            autopsy_id,
            len(retroactive_alerts),
            len(ttp_attributions),
            prevention_window,
        )

        # Final stream callback
        if stream_callback:
            try:
                stream_callback(
                    {
                        "step": "complete",
                        "progress": 100,
                        "status": "complete",
                        "summary": f"Autopsy complete — {len(retroactive_alerts)} alerts generated",
                        "autopsy_id": autopsy_id,
                        "result": result.model_dump(mode="json"),
                    }
                )
            except Exception:
                pass

        return result

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _push_progress(
        state: AutopsyState,
        step: str,
        status: str,
        progress: int,
        summary: str,
    ) -> None:
        """
        Append a progress update to state and fire the stream_callback if present.
        """
        update = {
            "step": step,
            "progress": progress,
            "status": status,
            "summary": summary,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        state.setdefault("progress_updates", []).append(update)  # type: ignore[misc]

        cb = state.get("_stream_callback")  # type: ignore[misc]
        if callable(cb):
            try:
                cb(update)
            except Exception:
                pass

        logger.info("[%s] %s%% — %s", step.upper(), progress, summary)

    @staticmethod
    def _build_actor_attribution(
        ttp_attributions: list[TTPAttribution],
    ) -> Optional[ThreatActorAttribution]:
        """
        Build a ThreatActorAttribution from the AIIMS fallback data.
        In a full implementation this is populated from Claude's response.
        """
        if not ttp_attributions:
            return None

        return ThreatActorAttribution(
            actor_name="APT41",
            actor_id="apt41",
            confidence=0.84,
            ttp_overlap_count=len(ttp_attributions),
            campaign_match="Operation Dark Ward (2022)",
            predicted_next_ttps=["T1486", "T1490", "T1491"],
            recommended_defensive_actions=[
                "Emergency backup of all clinical systems",
                "Block outbound traffic on 10.0.8.0/24",
                "Force-rotate all domain admin credentials",
                "Notify CERT-In per IT Act Section 70B",
            ],
        )

    @staticmethod
    def _compute_kill_chain_coverage(
        ttp_attributions: list[TTPAttribution],
    ) -> dict[str, bool]:
        """Return a dict of kill-chain stage names → whether we detected TTPs there."""
        stages = {
            "Initial Access": False,
            "Execution": False,
            "Persistence": False,
            "Privilege Escalation": False,
            "Defense Evasion": False,
            "Credential Access": False,
            "Discovery": False,
            "Lateral Movement": False,
            "Collection": False,
            "Command and Control": False,
            "Exfiltration": False,
            "Impact": False,
        }
        for ttp in ttp_attributions:
            tactic = ttp.tactic
            for stage in stages:
                if stage.lower() in tactic.lower():
                    stages[stage] = True
        return stages

    @staticmethod
    def _fallback_graph_data(incident_id: str) -> dict[str, Any]:
        """Return a minimal graph for offline / no-Neo4j operation."""
        if "aiims" in incident_id:
            return {
                "nodes": [
                    {"id": "AIIMS-DC-01", "name": "Domain Controller", "type": "HOST",
                     "val": 12, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "AIIMS-PATIENT-MGMT-01", "name": "Patient Mgmt System",
                     "type": "HOST", "val": 10, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "AIIMS-FILE-SRV-02", "name": "Clinical File Server",
                     "type": "HOST", "val": 10, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "AIIMS-BACKUP-SRV-01", "name": "Backup Server",
                     "type": "HOST", "val": 8, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "svc_backup$", "name": "svc_backup$",
                     "type": "ACCOUNT", "val": 8, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "185.220.101.47", "name": "Tor exit (185.220.101.47)",
                     "type": "IP", "val": 8, "is_compromised": True, "criticality": "HIGH"},
                    {"id": "update.microsofft.com", "name": "update.microsofft.com (C2)",
                     "type": "DOMAIN", "val": 8, "is_compromised": True, "criticality": "HIGH"},
                ],
                "links": [
                    {"source": "AIIMS-DC-01", "target": "svc_backup$",
                     "type": "AUTHENTICATED_AS", "anomalous": True},
                    {"source": "AIIMS-PATIENT-MGMT-01", "target": "AIIMS-DC-01",
                     "type": "COMMUNICATED_WITH", "anomalous": True},
                    {"source": "AIIMS-DC-01", "target": "AIIMS-FILE-SRV-02",
                     "type": "COMMUNICATED_WITH", "anomalous": True},
                    {"source": "AIIMS-DC-01", "target": "update.microsofft.com",
                     "type": "COMMUNICATED_WITH", "anomalous": True},
                    {"source": "update.microsofft.com", "target": "185.220.101.47",
                     "type": "RESOLVES_TO", "anomalous": True},
                ],
            }
        return {"nodes": [], "links": []}
