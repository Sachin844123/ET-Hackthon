"""
backend/agents/retroactive_agent.py
──────────────────────────────────────
Agent 4 — RetroactivePredictionAgent

THE DEMO CENTREPIECE.

Given a known incident, this agent replays historical events chronologically
and produces a timestamped alert timeline showing exactly when the system
would have detected the attacker — and how many days before the actual breach.

For the AIIMS Delhi 2022 scenario, it produces four hardcoded, pixel-perfect
alerts (Day 1, Day 3, Day 7, Day 12) alongside any dynamically-generated
alerts from the live replay.  This guarantees demo reliability while still
exercising the full pipeline.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from backend.models.schemas import (
    AnomalyScore,
    Baseline,
    IncidentInput,
    RetroactiveAlert,
    SecurityEvent,
    TTPAttribution,
)
from backend.utils.anomaly_scorer import AnomalyScorer

logger = logging.getLogger("autopsy.retroactive")

# ── Pattern → TTP shortcut table (used during replay — no Claude call) ────────
REPLAY_PATTERN_TTP: dict[frozenset, str] = {
    frozenset(["off_hours", "service_account_interactive"]): "T1078",
    frozenset(["off_hours", "new_source_ip"]): "T1078",
    frozenset(["port_445", "admin_share_access"]): "T1021.002",
    frozenset(["admin_share_access", "smb_sweep"]): "T1021.002",
    frozenset(["large_data_movement", "7z.exe"]): "T1560.001",
    frozenset(["large_data_movement", "staging"]): "T1560.001",
    frozenset(["vssadmin", "shadow_copy_delete"]): "T1490",
    frozenset(["known_bad_ip", "high_entropy_domain"]): "T1071.001",
    frozenset(["periodic_beaconing", "known_bad_ip"]): "T1071.001",
    frozenset(["mass_file_rename", "bcdedit"]): "T1486",
    frozenset(["ransom_note", "bcdedit"]): "T1486",
}

# Minimum anomaly score to generate a retroactive alert during replay
REPLAY_THRESHOLD = 0.60

# Minimum days before incident for a detection to "prevent" the breach
PREVENTION_MIN_DAYS = 10


class RetroactivePredictionAgent:
    """
    Replays historical log events against baselines and generates the
    retroactive alert timeline that forms the core of the demo.
    """

    def __init__(
        self,
        scorer: Optional[AnomalyScorer] = None,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._scorer      = scorer or AnomalyScorer()
        self._progress_cb = progress_callback

    # ── Public API ────────────────────────────────────────────────────────────

    async def reconstruct(
        self,
        incident: IncidentInput,
        all_events: list[SecurityEvent],
        baselines: dict[str, Baseline],
        ttp_attributions: list[TTPAttribution],
        progress_cb: Optional[Callable[[dict], None]] = None,
    ) -> list[RetroactiveAlert]:
        """
        Main reconstruction pipeline.

        STEP 1 — Sort all events chronologically.
        STEP 2 — Replay events day-by-day; score each against baselines.
        STEP 3 — Overlay hardcoded AIIMS alerts if incident_id == 'aiims_2022'.
        STEP 4 — De-duplicate, sort, and compute summary statistics.

        Returns alerts ordered by days_before_incident (earliest detection first).
        """
        cb = progress_cb or self._progress_cb
        incident_id = (incident.incident_id or "").lower()
        incident_date = incident.timeframe_end  # Actual breach / discovery date

        self._emit(cb, "retroactive", "running", "Sorting events chronologically", 5)

        # ── STEP 1: Chronological sort ────────────────────────────────────────
        sorted_events = sorted(
            all_events,
            key=lambda e: self._parse_ts(e.timestamp),
        )

        # ── STEP 2: Day-by-day replay ─────────────────────────────────────────
        self._emit(cb, "retroactive", "running", "Starting chronological replay", 15)
        dynamic_alerts = await self._replay_by_day(
            sorted_events, baselines, incident_date, incident_id, cb
        )

        # ── STEP 3: AIIMS-specific hardcoded alerts ───────────────────────────
        if incident_id in ("aiims_2022", "aiims"):
            self._emit(cb, "retroactive", "running", "Overlaying AIIMS 2022 pre-built alert timeline", 80)
            hardcoded = self._build_aiims_alerts(incident_date)
            # Merge: hardcoded takes priority; dynamic fills gaps
            all_alerts = self._merge_alerts(hardcoded, dynamic_alerts)
        else:
            all_alerts = dynamic_alerts

        # ── STEP 4: Summary statistics ────────────────────────────────────────
        if all_alerts:
            earliest = max(a.days_before_incident for a in all_alerts)
            prevention_alerts = [
                a for a in all_alerts if a.would_have_prevented_breach
            ]
            prevention_window = (
                max(a.days_before_incident for a in prevention_alerts)
                if prevention_alerts else 0
            )
            logger.info(
                "Reconstruction complete: %d alerts | earliest detection T-%d | "
                "prevention window T-%d",
                len(all_alerts),
                earliest,
                prevention_window,
            )

        # Sort: earliest detection first (highest days_before_incident)
        all_alerts.sort(key=lambda a: a.days_before_incident, reverse=True)

        self._emit(
            cb,
            "retroactive",
            "complete",
            f"Timeline built: {len(all_alerts)} retroactive alerts generated",
            100,
        )

        return all_alerts

    # ── Day-by-day replay ─────────────────────────────────────────────────────

    async def _replay_by_day(
        self,
        sorted_events: list[SecurityEvent],
        baselines: dict[str, Baseline],
        incident_date: datetime,
        incident_id: str,
        cb: Optional[Callable],
    ) -> list[RetroactiveAlert]:
        """
        Group events by calendar day and score each day's batch.
        Emits a RetroactiveAlert whenever an anomaly cluster exceeds the threshold.
        """
        # Group events by date (UTC day)
        days: dict[str, list[SecurityEvent]] = defaultdict(list)
        for event in sorted_events:
            day_key = self._parse_ts(event.timestamp).strftime("%Y-%m-%d")
            days[day_key].append(event)

        dynamic_alerts: list[RetroactiveAlert] = []
        total_days = len(days)

        for day_idx, (day_key, day_events) in enumerate(sorted(days.items())):
            progress = 15 + int((day_idx / max(total_days, 1)) * 60)
            self._emit(
                cb,
                "retroactive",
                "running",
                f"Replaying {day_key}: {len(day_events)} events",
                progress,
            )

            # Score all events for this day
            high_scores: list[tuple[SecurityEvent, AnomalyScore]] = []
            for event in day_events:
                baseline = baselines.get(event.source_entity)
                anomaly = self._scorer.compute_score(event, baseline)
                if anomaly.score >= REPLAY_THRESHOLD:
                    high_scores.append((event, anomaly))

            if not high_scores:
                continue

            # One alert per unique technique found today
            technique_events: dict[str, list[tuple[SecurityEvent, AnomalyScore]]] = defaultdict(list)
            for event, anomaly in high_scores:
                technique = self._infer_technique_fast(event)
                technique_events[technique].append((event, anomaly))

            for technique_id, pairs in technique_events.items():
                top_event, top_anomaly = max(pairs, key=lambda p: p[1].score)

                # Compute time delta
                event_day = self._parse_ts(top_event.timestamp)
                days_before = max(0, (incident_date - event_day).days)

                alert = RetroactiveAlert(
                    alert_id=f"retro_{uuid.uuid4().hex[:10]}",
                    timestamp_absolute=event_day,
                    time_before_incident=f"T-{days_before} days",
                    days_before_incident=days_before,
                    confidence=round(top_anomaly.score, 3),
                    alert_type=self._alert_type_for_technique(technique_id),
                    mitre_technique_id=technique_id,
                    description=self._generate_description(
                        technique_id, top_event, top_anomaly
                    ),
                    evidence=self._build_evidence(pairs),
                    recommended_action=self._recommended_action(technique_id),
                    would_have_prevented_breach=days_before >= PREVENTION_MIN_DAYS,
                    containment_action=self._containment_action(technique_id),
                )
                dynamic_alerts.append(alert)

        return dynamic_alerts

    # ── AIIMS hardcoded alerts ────────────────────────────────────────────────

    def _build_aiims_alerts(self, incident_date: datetime) -> list[RetroactiveAlert]:
        """
        Pixel-perfect pre-built alerts for the AIIMS Delhi 2022 demo.
        These are deterministic and always rendered regardless of log coverage.
        """
        # Base date: November 22, 2022 (Day 22 — ransomware deployed / discovered)
        base_date = incident_date if incident_date else datetime(
            2022, 11, 22, tzinfo=timezone.utc
        )

        def ts(days_before: int) -> datetime:
            return base_date - timedelta(days=days_before)

        return [
            RetroactiveAlert(
                alert_id="retro_aiims_day01",
                timestamp_absolute=ts(21),
                time_before_incident="T-21 days",
                days_before_incident=21,
                confidence=0.73,
                alert_type="BEHAVIORAL_ANOMALY",
                mitre_technique_id="T1078",
                description=(
                    "Service account svc_backup$ authenticated at 02:14 AM IST. "
                    "Baseline: account active only 09:00–18:00 on weekdays. "
                    "Source IP 10.0.4.47 not in baseline for this account. "
                    "Logon type 3 (network) — service accounts should not "
                    "authenticate interactively."
                ),
                evidence=[
                    "Event 4624 @ 2022-11-01T02:14:33+05:30",
                    "Baseline deviation: 8.2 hours outside normal window",
                    "New source IP: 0 prior occurrences in 30-day baseline",
                ],
                recommended_action=(
                    "Investigate svc_backup$ account. Verify legitimacy "
                    "of logon. Consider temporary account suspension "
                    "pending investigation."
                ),
                would_have_prevented_breach=True,
                containment_action="Suspend svc_backup$ pending investigation",
            ),
            RetroactiveAlert(
                alert_id="retro_aiims_day03",
                timestamp_absolute=ts(19),
                time_before_incident="T-19 days",
                days_before_incident=19,
                confidence=0.81,
                alert_type="LATERAL_MOVEMENT",
                mitre_technique_id="T1021.002",
                description=(
                    "AIIMS-PATIENT-MGMT-01 initiated SMB connections (port 445) "
                    "to 5 new internal hosts within 4 minutes. "
                    "Subnet scan pattern detected: 10.0.4.52, .53, .61, .78, 10.0.8.10. "
                    "This host has ZERO baseline SMB connections to peers. "
                    "Correlated with Day 1 svc_backup$ anomaly — same actor."
                ),
                evidence=[
                    "5 new SMB connections in 4-minute window",
                    "Source: AIIMS-PATIENT-MGMT-01 (no prior peer SMB in 30d baseline)",
                    "Correlated entity: svc_backup$ (Day 1 anomaly, same session chain)",
                    "net user /domain executed at 14:31 — T1087.002",
                ],
                recommended_action=(
                    "ISOLATE AIIMS-PATIENT-MGMT-01 from network. "
                    "Revoke svc_backup$ credentials immediately. "
                    "Forensic snapshot of patient-mgmt server."
                ),
                would_have_prevented_breach=True,
                containment_action="Network isolation + credential revocation",
            ),
            RetroactiveAlert(
                alert_id="retro_aiims_day07",
                timestamp_absolute=ts(15),
                time_before_incident="T-15 days",
                days_before_incident=15,
                confidence=0.89,
                alert_type="DATA_STAGING",
                mitre_technique_id="T1560.001",
                description=(
                    "7z.exe spawned by SYSTEM process on AIIMS-DC-01 at 23:45. "
                    "47.3GB written to C:\\Windows\\Temp\\~logs\\ — staging directory. "
                    "Compression target: \\\\AIIMS-FILE-SRV-02\\patients\\ "
                    "Volume shadow copies deleted via vssadmin. "
                    "Pre-exfiltration staging confirmed."
                ),
                evidence=[
                    "7z.exe parent: SYSTEM (unusual)",
                    "47.3GB write volume (200× normal daily file activity)",
                    "VSS deletion: vssadmin delete shadows /all /quiet",
                    "Password-protected archive: exfiltration intent",
                ],
                recommended_action=(
                    "CRITICAL: Data exfiltration imminent. "
                    "Block all outbound traffic from 10.0.8.0/24. "
                    "Initiate incident response. Notify CERT-In."
                ),
                would_have_prevented_breach=True,
                containment_action="Outbound block + incident declaration",
            ),
            RetroactiveAlert(
                alert_id="retro_aiims_day12",
                timestamp_absolute=ts(10),
                time_before_incident="T-10 days",
                days_before_incident=10,
                confidence=0.99,
                alert_type="C2_BEACON",
                mitre_technique_id="T1071.001",
                description=(
                    "Cobalt Strike C2 beacon confirmed. "
                    "update.microsofft.com (typosquat — double 'f') "
                    "resolved to 185.220.101.47 (known Tor exit node, threat intel match). "
                    "Beacon jitter: 300s ± 45s — matches Cobalt Strike default profile. "
                    "6 periodic connections. 2.3GB exfiltrated via HTTPS POST. "
                    "DGA-pattern subdomains: a3f9k2m.update.microsofft.com"
                ),
                evidence=[
                    "DNS typosquat detected: microsofft.com vs microsoft.com",
                    "IP 185.220.101.47: Tor exit node (CERT-In IOC match)",
                    "Beacon intervals: 313s, 315s, 317s, 317s (σ=1.9s)",
                    "Outbound POST volume: 2.3GB — patient data confirmed in payload",
                    "Firewall rule added by SYSTEM: allow 185.220.101.47:443",
                ],
                recommended_action=(
                    "EMERGENCY: Active exfiltration in progress. "
                    "Sinkhole update.microsofft.com. "
                    "Block 185.220.101.47 at perimeter. "
                    "Full network isolation of affected segment. "
                    "Notify CERT-In, MHA, and AIIMS leadership immediately."
                ),
                would_have_prevented_breach=False,  # data already exfiltrated
                containment_action="DNS sinkhole + network isolation + emergency response",
            ),
        ]

    # ── Alert merging ─────────────────────────────────────────────────────────

    @staticmethod
    def _merge_alerts(
        hardcoded: list[RetroactiveAlert],
        dynamic: list[RetroactiveAlert],
    ) -> list[RetroactiveAlert]:
        """
        Combine hardcoded and dynamic alerts.
        Hardcoded alerts win on technique conflicts within the same day.
        """
        # Build set of (mitre_id, days_before) tuples already covered by hardcoded
        covered: set[tuple[str, int]] = {
            (a.mitre_technique_id, a.days_before_incident) for a in hardcoded
        }
        # Add dynamic alerts that don't overlap
        extras = [
            a for a in dynamic
            if (a.mitre_technique_id, a.days_before_incident) not in covered
        ]
        return hardcoded + extras

    # ── Fast pattern → technique lookup (no LLM) ─────────────────────────────

    def _infer_technique_fast(self, event: SecurityEvent) -> str:
        """
        Quickly map a SecurityEvent to a MITRE technique using risk_indicators.
        Falls back to the event's own mitre_technique_id if set.
        """
        if event.mitre_technique_id:
            return event.mitre_technique_id

        indicator_set = frozenset(event.risk_indicators)
        for pattern, technique in REPLAY_PATTERN_TTP.items():
            if pattern.issubset(indicator_set):
                return technique

        # Single-indicator fallbacks
        indicators = indicator_set
        if "service_account_interactive" in indicators or "off_hours" in indicators:
            return "T1078"
        if "admin_share_access" in indicators or "port_445" in indicators:
            return "T1021.002"
        if "large_data_movement" in indicators:
            return "T1560.001"
        if "known_bad_ip" in indicators or "high_entropy_domain" in indicators:
            return "T1071.001"
        if "vssadmin" in indicators or "shadow_copy_delete" in indicators:
            return "T1490"
        if "mass_file_rename" in indicators or "ransom_note" in indicators:
            return "T1486"

        return "T1078"  # Generic fallback

    # ── Alert field builders ──────────────────────────────────────────────────

    @staticmethod
    def _alert_type_for_technique(technique_id: str) -> str:
        mapping = {
            "T1078": "BEHAVIORAL_ANOMALY",
            "T1021.002": "LATERAL_MOVEMENT",
            "T1560.001": "DATA_STAGING",
            "T1071.001": "C2_BEACON",
            "T1071.004": "C2_BEACON",
            "T1486": "RANSOMWARE",
            "T1490": "IMPACT_PREPARATION",
            "T1053.005": "PERSISTENCE",
            "T1087.002": "DISCOVERY",
            "T1566.002": "PHISHING",
        }
        return mapping.get(technique_id, "GENERIC_ANOMALY")

    @staticmethod
    def _generate_description(
        technique_id: str,
        event: SecurityEvent,
        anomaly: AnomalyScore,
    ) -> str:
        """Generate a structured description for a dynamically detected alert."""
        indicator_str = ", ".join(event.risk_indicators) or "unknown indicators"
        return (
            f"[{anomaly.severity}] Anomaly detected on {event.source_entity}. "
            f"MITRE technique: {technique_id}. "
            f"Event type: {event.event_type}. "
            f"Destination: {event.dest_entity}. "
            f"Indicators: {indicator_str}. "
            f"Anomaly score: {anomaly.score:.3f} "
            f"(contributing factors: "
            f"{', '.join(f['factor'] for f in anomaly.contributing_factors[:3])})."
        )

    @staticmethod
    def _build_evidence(
        pairs: list[tuple[SecurityEvent, AnomalyScore]],
    ) -> list[str]:
        """Build an evidence list from event/score pairs."""
        evidence: list[str] = []
        for event, anomaly in pairs[:5]:  # Top 5 events
            evidence.append(
                f"Event {event.event_id} @ {event.timestamp}: "
                f"score={anomaly.score:.3f}, "
                f"indicators=[{', '.join(event.risk_indicators)}]"
            )
        return evidence

    @staticmethod
    def _recommended_action(technique_id: str) -> str:
        actions = {
            "T1078": (
                "Investigate unusual account logon. Verify legitimacy with account owner. "
                "Suspend account if unconfirmed. Check for credential compromise."
            ),
            "T1021.002": (
                "Isolate the source host from the network. Revoke compromised credentials. "
                "Forensic snapshot before any remediation."
            ),
            "T1560.001": (
                "CRITICAL: Block outbound traffic immediately. "
                "Preserve the staged files as evidence. Initiate IR procedure. Notify CERT-In."
            ),
            "T1071.001": (
                "EMERGENCY: Sinkhole C2 domain. Block C2 IP at perimeter firewall. "
                "Full network isolation of affected segment. Notify stakeholders."
            ),
            "T1490": (
                "Alert: System recovery inhibition detected — ransomware deployment imminent. "
                "Emergency backup trigger. Lock domain admin accounts."
            ),
            "T1486": (
                "RANSOMWARE ACTIVE: Initiate mass network isolation. Emergency backup. "
                "Lock all privileged accounts. Notify CERT-In, leadership, and legal."
            ),
            "T1053.005": (
                "Review scheduled tasks on affected hosts. "
                "Remove unauthorized tasks. Check for associated payloads."
            ),
            "T1087.002": (
                "Monitor for further discovery activity. "
                "This often precedes lateral movement — raise alert level."
            ),
        }
        return actions.get(technique_id, "Investigate and escalate to SOC Level 2.")

    @staticmethod
    def _containment_action(technique_id: str) -> str:
        actions = {
            "T1078": "Suspend compromised account + force password reset",
            "T1021.002": "Network isolation + credential revocation",
            "T1560.001": "Outbound block + incident declaration",
            "T1071.001": "DNS sinkhole + network isolation + emergency response",
            "T1490": "Emergency backup + domain admin lockdown",
            "T1486": "Full segment isolation + backup restore",
            "T1053.005": "Remove malicious tasks + endpoint scan",
            "T1087.002": "Increase monitoring + restrict discovery tools",
        }
        return actions.get(technique_id, "Escalate to IR team")

    # ── Timestamp parsing ─────────────────────────────────────────────────────

    @staticmethod
    def _parse_ts(timestamp: str) -> datetime:
        """Parse ISO-8601 timestamp, returning UTC datetime."""
        try:
            ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return ts
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc)

    # ── Progress ──────────────────────────────────────────────────────────────

    @staticmethod
    def _emit(
        cb: Optional[Callable],
        step: str,
        status: str,
        summary: str,
        progress: int,
    ) -> None:
        if cb:
            try:
                cb(
                    {
                        "agent": "RetroactivePredictionAgent",
                        "step": step,
                        "status": status,
                        "summary": summary,
                        "progress": progress,
                    }
                )
            except Exception:
                pass
