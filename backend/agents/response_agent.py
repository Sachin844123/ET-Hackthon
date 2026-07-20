"""
backend/agents/response_agent.py
──────────────────────────────────
Agent 5 — AutonomousResponseAgent

Responsibilities:
  • Match incoming alerts to SOAR playbooks via technique + confidence gates
  • Execute LOW blast-radius playbooks automatically (no approval needed)
  • Queue MEDIUM/HIGH blast-radius playbooks for human approval
  • Simulate each action (log + Neo4j update) with a full audit trail entry
  • Support playbook approval flow and rollback
  • Export a legally-sound audit package with integrity hash
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import aiosqlite
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.models.schemas import (
    PlaybookAction,
    PlaybookExecution,
    RetroactiveAlert,
)

logger = logging.getLogger("autopsy.response")

# ── SQLite schema ─────────────────────────────────────────────────────────────

CREATE_PENDING_PLAYBOOKS_TABLE = """
CREATE TABLE IF NOT EXISTS pending_playbooks (
    execution_id    TEXT PRIMARY KEY,
    playbook_name   TEXT NOT NULL,
    alert_id        TEXT NOT NULL,
    blast_radius    TEXT NOT NULL,
    payload_json    TEXT NOT NULL,    -- full PlaybookExecution JSON
    created_at      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
);
"""

CREATE_AUDIT_TRAIL_TABLE = """
CREATE TABLE IF NOT EXISTS audit_trail (
    trail_id        TEXT PRIMARY KEY,
    execution_id    TEXT NOT NULL,
    playbook_name   TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    target_entity   TEXT NOT NULL,
    triggered_by    TEXT NOT NULL,
    confidence      REAL NOT NULL,
    blast_radius    TEXT NOT NULL,
    executed_by     TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    status          TEXT NOT NULL
);
"""

SQLITE_PATH = os.getenv("SQLITE_PATH", "./data/cache/autopsy.db")

# ── Playbook Registry ─────────────────────────────────────────────────────────

PLAYBOOK_REGISTRY: dict[str, dict[str, Any]] = {
    "ISOLATE_HOST": {
        "trigger_conditions": {
            "min_confidence": 0.85,
            "techniques": ["T1021.002", "T1071.001", "T1486"],
        },
        "blast_radius": "MEDIUM",
        "requires_approval": True,
        "actions": [
            {
                "type": "FIREWALL_BLOCK",
                "target": "{source_entity}",
                "params": {"direction": "both", "log": True},
                "reversible": True,
            },
            {
                "type": "AD_ACCOUNT_DISABLE",
                "target": "{compromised_account}",
                "params": {"reason": "Automated isolation - suspected compromise"},
                "reversible": True,
            },
            {
                "type": "VM_SNAPSHOT",
                "target": "{affected_host}",
                "params": {"label": "forensic_capture_{timestamp}"},
                "reversible": False,
            },
            {
                "type": "SOC_NOTIFY",
                "target": "SOC_PAGERDUTY",
                "params": {"priority": "P1", "channel": "pagerduty"},
                "reversible": False,
            },
        ],
        "rollback": [
            {"type": "FIREWALL_UNBLOCK", "target": "{source_entity}"},
            {"type": "AD_ACCOUNT_ENABLE", "target": "{compromised_account}"},
        ],
    },
    "CREDENTIAL_REVOCATION": {
        "trigger_conditions": {
            "min_confidence": 0.80,
            "techniques": ["T1078", "T1110", "T1003"],
        },
        "blast_radius": "LOW",
        "requires_approval": False,
        "actions": [
            {
                "type": "REVOKE_TOKEN",
                "target": "{compromised_account}",
                "params": {},
                "reversible": True,
            },
            {
                "type": "FORCE_MFA_REENROLL",
                "target": "{compromised_account}",
                "params": {},
                "reversible": False,
            },
            {
                "type": "AUDIT_RECENT_ACCESS",
                "target": "{compromised_account}",
                "params": {"hours": 72},
                "reversible": False,
            },
        ],
        "rollback": [
            {"type": "RESTORE_TOKEN", "target": "{compromised_account}"}
        ],
    },
    "C2_CONTAINMENT": {
        "trigger_conditions": {
            "min_confidence": 0.90,
            "techniques": ["T1071.001", "T1071.004"],
        },
        "blast_radius": "HIGH",
        "requires_approval": True,
        "actions": [
            {
                "type": "DNS_SINKHOLE",
                "target": "{c2_domain}",
                "params": {},
                "reversible": True,
            },
            {
                "type": "BLOCK_IP",
                "target": "{c2_ip}",
                "params": {"perimeter": True},
                "reversible": True,
            },
            {
                "type": "TRAFFIC_CAPTURE",
                "target": "{affected_segment}",
                "params": {"segment": "{affected_segment}", "duration_minutes": 30},
                "reversible": False,
            },
            {
                "type": "GENERATE_IOC_REPORT",
                "target": "THREAT_INTEL",
                "params": {},
                "reversible": False,
            },
            {
                "type": "CERT_IN_NOTIFY",
                "target": "CERT_IN",
                "params": {},
                "reversible": False,
            },
        ],
        "rollback": [
            {"type": "DNS_UNSINKHOLE", "target": "{c2_domain}"},
            {"type": "UNBLOCK_IP", "target": "{c2_ip}"},
        ],
    },
    "ANTI_RANSOMWARE": {
        "trigger_conditions": {
            "min_confidence": 0.95,
            "techniques": ["T1486", "T1490", "T1491"],
        },
        "blast_radius": "HIGH",
        "requires_approval": True,
        "actions": [
            {
                "type": "NETWORK_SEGMENT_ISOLATE",
                "target": "{affected_segment}",
                "params": {},
                "reversible": True,
            },
            {
                "type": "BACKUP_TRIGGER",
                "target": "BACKUP_SYSTEM",
                "params": {"emergency": True},
                "reversible": False,
            },
            {
                "type": "MASS_ACCOUNT_LOCK",
                "target": "DOMAIN_ADMINS",
                "params": {"scope": "domain_admins"},
                "reversible": True,
            },
            {
                "type": "EXECUTIVE_NOTIFY",
                "target": "CISO_CXOS",
                "params": {},
                "reversible": False,
            },
            {
                "type": "CERT_IN_NOTIFY",
                "target": "CERT_IN",
                "params": {},
                "reversible": False,
            },
        ],
        "rollback": [
            {"type": "NETWORK_SEGMENT_RECONNECT", "target": "{affected_segment}"},
            {"type": "MASS_ACCOUNT_UNLOCK", "target": "DOMAIN_ADMINS"},
        ],
    },
}


class AutonomousResponseAgent:
    """
    SOAR-style response agent. Evaluates alerts, selects playbooks, simulates
    execution, and maintains a full cryptographically-bound audit trail.
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
        self._db_ready    = False

    # ── Database bootstrap ────────────────────────────────────────────────────

    async def _ensure_db(self) -> None:
        if self._db_ready:
            return
        os.makedirs(os.path.dirname(self._db_path), exist_ok=True)
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(CREATE_PENDING_PLAYBOOKS_TABLE)
            await db.execute(CREATE_AUDIT_TRAIL_TABLE)
            await db.commit()
        self._db_ready = True

    # ── Public API ────────────────────────────────────────────────────────────

    async def evaluate_and_respond(
        self,
        alert: RetroactiveAlert,
        incident_id: str = "",
    ) -> Optional[PlaybookExecution]:
        """
        Match an alert to a playbook and either execute it (LOW blast radius)
        or queue it for approval (MEDIUM/HIGH blast radius).

        incident_id is used to derive the correct entity names when filling in
        playbook template variables (e.g. AIIMS vs CBSE host names).

        Returns PlaybookExecution if a matching playbook is found, else None.
        """
        await self._ensure_db()

        playbook_name, playbook = self._match_playbook(alert)
        if not playbook:
            logger.debug(
                "No playbook matched for alert %s (technique=%s, confidence=%.3f)",
                alert.alert_id,
                alert.mitre_technique_id,
                alert.confidence,
            )
            return None

        execution = PlaybookExecution(
            execution_id=f"exec_{uuid.uuid4().hex[:12]}",
            playbook_name=playbook_name,
            triggered_by_alert_id=alert.alert_id,
            blast_radius=playbook["blast_radius"],
            requires_approval=playbook["requires_approval"],
            actions=[],
            status="PENDING_APPROVAL",
            audit_trail=[],
        )

        blast_radius = playbook["blast_radius"]
        requires_approval = playbook["requires_approval"]

        if not requires_approval or blast_radius == "LOW":
            # Execute immediately
            await self._execute_playbook(execution, alert, playbook, incident_id=incident_id)
        else:
            # Queue for human approval — still populate the actions list so
            # the UI and tests can see what would be executed
            context = self._build_context(alert, incident_id=incident_id)
            pending_actions = []
            for action_def in playbook["actions"]:
                target = self._substitute(action_def.get("target", ""), context)
                action_type = action_def["type"]
                params = {
                    k: self._substitute(str(v), context)
                    for k, v in action_def.get("params", {}).items()
                }
                reversible = action_def.get("reversible", True)
                audit_entry = (
                    f"[PENDING] ACTION:{action_type} "
                    f"TARGET:{target} "
                    f"TRIGGERED_BY:{alert.alert_id} "
                    f"STATUS:PENDING_APPROVAL"
                )
                action = PlaybookAction(
                    action_type=action_type,
                    target_entity=target,
                    parameters=params,
                    status="PENDING",
                    timestamp=datetime.now(timezone.utc),
                    reversible=reversible,
                    audit_log_entry=audit_entry,
                )
                pending_actions.append(action)
            execution.actions = pending_actions
            execution.status = "PENDING_APPROVAL"
            await self._store_pending(execution)
            logger.info(
                "Playbook '%s' queued for approval (blast_radius=%s, execution_id=%s, actions=%d)",
                playbook_name,
                blast_radius,
                execution.execution_id,
                len(pending_actions),
            )

        self._emit_progress(
            "response",
            "running" if execution.status == "PENDING_APPROVAL" else "complete",
            f"Playbook '{playbook_name}' → {execution.status}",
            80,
        )

        return execution

    async def execute_playbook(
        self,
        execution: PlaybookExecution,
        alert: RetroactiveAlert,
        incident_id: str = "",
    ) -> PlaybookExecution:
        """
        Directly execute a playbook (used for LOW blast-radius or after approval).
        """
        await self._ensure_db()
        playbook = PLAYBOOK_REGISTRY.get(execution.playbook_name)
        if not playbook:
            raise ValueError(f"Unknown playbook: {execution.playbook_name}")
        await self._execute_playbook(execution, alert, playbook, incident_id=incident_id)
        return execution

    async def approve_playbook(self, execution_id: str) -> PlaybookExecution:
        """
        Load a pending playbook execution from SQLite, execute it, and return
        the updated PlaybookExecution.
        """
        await self._ensure_db()

        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT payload_json, playbook_name FROM pending_playbooks WHERE execution_id = ?",
                (execution_id,),
            ) as cursor:
                row = await cursor.fetchone()

        if not row:
            raise ValueError(f"Pending playbook not found: {execution_id}")

        execution = PlaybookExecution(**json.loads(row[0]))
        playbook = PLAYBOOK_REGISTRY.get(execution.playbook_name)
        if not playbook:
            raise ValueError(f"Playbook definition missing for: {execution.playbook_name}")

        # Reconstruct a minimal RetroactiveAlert for context variable substitution
        mock_alert = RetroactiveAlert(
            alert_id=execution.triggered_by_alert_id,
            timestamp_absolute=datetime.now(timezone.utc),
            time_before_incident="T-0 days",
            days_before_incident=0,
            confidence=0.95,
            alert_type="APPROVED",
            mitre_technique_id=playbook["trigger_conditions"]["techniques"][0],
            description="Manually approved playbook execution.",
            recommended_action="",
            would_have_prevented_breach=False,
        )

        await self._execute_playbook(execution, mock_alert, playbook)

        # Update SQLite status
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE pending_playbooks SET status = 'EXECUTED' WHERE execution_id = ?",
                (execution_id,),
            )
            await db.commit()

        logger.info("Approved playbook %s executed successfully.", execution_id)
        return execution

    async def export_audit_trail(self, autopsy_id: str) -> dict[str, Any]:
        """
        Export the full audit trail for a given autopsy as a legally-sound
        evidence package with cryptographic integrity hash.
        """
        await self._ensure_db()

        trail_entries: list[dict] = []
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT * FROM audit_trail ORDER BY timestamp ASC"
            ) as cursor:
                rows = await cursor.fetchall()

        columns = [
            "trail_id", "execution_id", "playbook_name", "action_type",
            "target_entity", "triggered_by", "confidence", "blast_radius",
            "executed_by", "timestamp", "status",
        ]
        for row in rows:
            trail_entries.append(dict(zip(columns, row)))

        # Compute SHA-256 integrity hash over the sorted trail JSON
        trail_json = json.dumps(trail_entries, sort_keys=True)
        integrity_hash = hashlib.sha256(trail_json.encode("utf-8")).hexdigest()

        return {
            "autopsy_id": autopsy_id,
            "exported_at": datetime.now(timezone.utc).isoformat() + "Z",
            "system_version": "attack-chain-autopsy-v1.0.0",
            "chain_of_custody": (
                f"Autopsy {autopsy_id} — generated by Attack Chain Autopsy Engine. "
                "All actions are system-generated or human-approved. "
                "Integrity hash covers the full audit trail."
            ),
            "integrity_hash": f"sha256:{integrity_hash}",
            "entry_count": len(trail_entries),
            "trail": trail_entries,
        }

    # ── Core execution ────────────────────────────────────────────────────────

    async def _execute_playbook(
        self,
        execution: PlaybookExecution,
        alert: RetroactiveAlert,
        playbook: dict[str, Any],
        incident_id: str = "",
    ) -> None:
        """
        Simulate execution of every action in the playbook.

        For each action:
          1. Substitute template variables with alert entity data
          2. Simulate the action (log + Neo4j update)
          3. Append PlaybookAction to execution.actions
          4. Write to audit_trail table in SQLite
        """
        timestamp_str = datetime.now(timezone.utc).isoformat() + "Z"
        context = self._build_context(alert, incident_id=incident_id)

        for action_def in playbook["actions"]:
            target = self._substitute(action_def.get("target", ""), context)
            action_type = action_def["type"]
            params = {
                k: self._substitute(str(v), context)
                for k, v in action_def.get("params", {}).items()
            }
            reversible = action_def.get("reversible", True)

            audit_entry = (
                f"[{timestamp_str}] ACTION:{action_type} "
                f"TARGET:{target} "
                f"TRIGGERED_BY:{alert.alert_id} "
                f"CONFIDENCE:{alert.confidence:.4f} "
                f"EXECUTED_BY:SYSTEM_AUTO "
                f"BLAST_RADIUS:{execution.blast_radius}"
            )

            pb_action = PlaybookAction(
                action_type=action_type,
                target_entity=target,
                parameters=params,
                status="SUCCESS",
                timestamp=datetime.now(timezone.utc),
                reversible=reversible,
                audit_log_entry=audit_entry,
            )
            execution.actions.append(pb_action)

            # Log it
            logger.info(
                "SIMULATED: %s | target=%s | execution=%s",
                action_type,
                target,
                execution.execution_id,
            )

            # Update Neo4j entity compromise flag if it's a containment action
            if action_type in ("FIREWALL_BLOCK", "AD_ACCOUNT_DISABLE", "NETWORK_SEGMENT_ISOLATE"):
                self._neo4j_mark_contained(target, execution.execution_id)

            # Persist audit entry to SQLite
            await self._write_audit_entry(
                execution_id=execution.execution_id,
                playbook_name=execution.playbook_name,
                action_type=action_type,
                target_entity=target,
                triggered_by=alert.alert_id,
                confidence=alert.confidence,
                blast_radius=execution.blast_radius,
            )

        execution.status = "EXECUTED"
        execution.audit_trail.append(
            {
                "timestamp": timestamp_str,
                "event": "PLAYBOOK_EXECUTED",
                "execution_id": execution.execution_id,
                "actions_count": len(execution.actions),
                "triggered_by": alert.alert_id,
                "system_version": "attack-chain-autopsy-v1.0.0",
            }
        )

        # Write PlaybookExecution node to Neo4j
        await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: self._neo4j_write_execution(execution, alert),
        )

    # ── Playbook matching ─────────────────────────────────────────────────────

    @staticmethod
    def _match_playbook(
        alert: RetroactiveAlert,
    ) -> tuple[str, dict[str, Any] | None]:
        """
        Iterate PLAYBOOK_REGISTRY in priority order and return the first
        playbook whose technique list contains the alert technique AND
        whose min_confidence threshold is met.

        Priority: ANTI_RANSOMWARE > C2_CONTAINMENT > ISOLATE_HOST > CREDENTIAL_REVOCATION
        """
        priority_order = [
            "ANTI_RANSOMWARE",
            "C2_CONTAINMENT",
            "ISOLATE_HOST",
            "CREDENTIAL_REVOCATION",
        ]
        for name in priority_order:
            playbook = PLAYBOOK_REGISTRY.get(name)
            if not playbook:
                continue
            conditions = playbook["trigger_conditions"]
            if (
                alert.mitre_technique_id in conditions["techniques"]
                and alert.confidence >= conditions["min_confidence"]
            ):
                return name, playbook

        return "", None

    # ── Template substitution ─────────────────────────────────────────────────

    @staticmethod
    def _build_context(
        alert: RetroactiveAlert,
        incident_id: str = "aiims_2022",
    ) -> dict[str, str]:
        """
        Derive playbook template substitution variables from the alert and
        the incident being analysed.

        Priority for each field:
          1. alert.containment_action / alert description if it mentions specific entities
          2. Incident-appropriate defaults keyed by incident_id
          3. Generic fallbacks

        If you add a new incident, extend the INCIDENT_DEFAULTS dict below.
        """
        INCIDENT_DEFAULTS: dict[str, dict[str, str]] = {
            "aiims_2022": {
                "source_entity":      "AIIMS-PATIENT-MGMT-01",
                "affected_host":      "AIIMS-PATIENT-MGMT-01",
                "compromised_account": "svc_backup$",
                "affected_segment":   "10.0.8.0/24",
                "c2_domain":          "update.microsofft.com",
                "c2_ip":              "185.220.101.47",
            },
            "cbse_2026": {
                "source_entity":      "CBSE-WEB-SRV-01",
                "affected_host":      "CBSE-DB-PRIMARY-01",
                "compromised_account": "svc_cbse_admin$",
                "affected_segment":   "10.1.0.0/24",
                "c2_domain":          "cbse-results.in",
                "c2_ip":              "45.142.212.100",
            },
        }

        # Normalise the incident_id key so 'aiims' and 'aiims_2022' both match
        id_lower = (incident_id or "").lower()
        defaults: dict[str, str]
        if "aiims" in id_lower:
            defaults = INCIDENT_DEFAULTS["aiims_2022"]
        elif "cbse" in id_lower:
            defaults = INCIDENT_DEFAULTS["cbse_2026"]
        else:
            # Generic fallback for unknown incidents
            defaults = {
                "source_entity":       "UNKNOWN-HOST-01",
                "affected_host":       "UNKNOWN-HOST-01",
                "compromised_account": "unknown_account$",
                "affected_segment":    "10.0.0.0/24",
                "c2_domain":           "unknown-c2.example.com",
                "c2_ip":               "0.0.0.0",
            }

        return {
            **defaults,
            "timestamp": datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
            "alert_id":  alert.alert_id,
            "technique": alert.mitre_technique_id,
        }

    @staticmethod
    def _substitute(template: str, context: dict[str, str]) -> str:
        """Replace {key} placeholders in template with context values."""
        for key, value in context.items():
            template = template.replace(f"{{{key}}}", value)
        return template

    # ── SQLite persistence ────────────────────────────────────────────────────

    async def _store_pending(self, execution: PlaybookExecution) -> None:
        """Persist a PENDING_APPROVAL playbook execution to SQLite."""
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO pending_playbooks
                (execution_id, playbook_name, alert_id, blast_radius,
                 payload_json, created_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    execution.execution_id,
                    execution.playbook_name,
                    execution.triggered_by_alert_id,
                    execution.blast_radius,
                    execution.model_dump_json(),
                    datetime.now(timezone.utc).isoformat(),
                    execution.status,
                ),
            )
            await db.commit()

    async def _write_audit_entry(
        self,
        execution_id: str,
        playbook_name: str,
        action_type: str,
        target_entity: str,
        triggered_by: str,
        confidence: float,
        blast_radius: str,
    ) -> None:
        """Append an action record to the SQLite audit_trail table."""
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT INTO audit_trail
                (trail_id, execution_id, playbook_name, action_type,
                 target_entity, triggered_by, confidence, blast_radius,
                 executed_by, timestamp, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    execution_id,
                    playbook_name,
                    action_type,
                    target_entity,
                    triggered_by,
                    confidence,
                    blast_radius,
                    "SYSTEM_AUTO",
                    datetime.now(timezone.utc).isoformat() + "Z",
                    "SUCCESS",
                ),
            )
            await db.commit()

    # ── Neo4j operations ──────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4))
    def _neo4j_mark_contained(self, entity_id: str, execution_id: str) -> None:
        """Mark an entity as contained in Neo4j (non-blocking, best-effort)."""
        if not self._driver:
            return
        try:
            with self._driver.session() as session:
                session.run(
                    """
                    MATCH (e:Entity {entity_id: $entity_id})
                    SET e.is_compromised = false,
                        e.contained_at = $ts,
                        e.contained_by = $execution_id
                    """,
                    entity_id=entity_id,
                    ts=datetime.now(timezone.utc).isoformat(),
                    execution_id=execution_id,
                )
        except Exception as exc:
            logger.warning("Neo4j containment update failed for %s: %s", entity_id, exc)

    def _neo4j_write_execution(
        self,
        execution: PlaybookExecution,
        alert: RetroactiveAlert,
    ) -> None:
        """Create a PlaybookExecution node in Neo4j and link it to the alert."""
        if not self._driver:
            return
        try:
            with self._driver.session() as session:
                session.run(
                    """
                    MERGE (p:PlaybookExecution {execution_id: $execution_id})
                    SET p.playbook_name = $playbook_name,
                        p.blast_radius = $blast_radius,
                        p.status = $status,
                        p.actions_count = $actions_count,
                        p.triggered_by = $triggered_by,
                        p.executed_at = $executed_at
                    """,
                    execution_id=execution.execution_id,
                    playbook_name=execution.playbook_name,
                    blast_radius=execution.blast_radius,
                    status=execution.status,
                    actions_count=len(execution.actions),
                    triggered_by=alert.alert_id,
                    executed_at=datetime.now(timezone.utc).isoformat(),
                )
        except Exception as exc:
            logger.warning("Neo4j write_execution failed: %s", exc)

    # ── Progress ──────────────────────────────────────────────────────────────

    def _emit_progress(self, step: str, status: str, summary: str, progress: int) -> None:
        if self._progress_cb:
            try:
                self._progress_cb(
                    {
                        "agent": "AutonomousResponseAgent",
                        "step": step,
                        "status": status,
                        "summary": summary,
                        "progress": progress,
                    }
                )
            except Exception:
                pass
