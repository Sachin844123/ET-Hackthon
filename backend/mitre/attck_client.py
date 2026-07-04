"""
backend/mitre/attck_client.py
─────────────────────────────
MITRE ATT&CK knowledge-base client.

Wraps the official mitreattack-python library when the full STIX bundle is
available (set env var MITRE_ATTACK_STIX_PATH), and gracefully falls back to
a rich hand-curated stub dictionary so the demo works with zero infrastructure.

Responsibilities:
  • Look up individual techniques by ID
  • Search techniques by free-text behavioral description
  • Return per-actor TTP lists (APT41, SideWinder, Transparent Tribe, Lazarus)
  • Predict next-stage TTPs using hardcoded sequencing rules
"""

from __future__ import annotations

import os
import json
import logging
import re
from typing import Any
from difflib import SequenceMatcher

logger = logging.getLogger("autopsy.mitre")

# ── TTP Sequencing Rules ──────────────────────────────────────────────────────
# Represents the most common attack progressions observed against Indian CNI.
# Used by predict_next_ttps() — deterministic, no LLM call needed here.
TTP_SEQUENCES: dict[str, list[str]] = {
    "T1078":     ["T1021.002", "T1087.002", "T1560.001"],
    "T1021.002": ["T1087.002", "T1560.001", "T1053.005"],
    "T1087.002": ["T1078", "T1021.002", "T1053.005"],
    "T1560.001": ["T1071.001", "T1048.003", "T1490"],
    "T1071.001": ["T1486", "T1490", "T1491"],
    "T1071.004": ["T1486", "T1490"],
    "T1490":     ["T1486", "T1491"],
    "T1486":     ["T1491"],
    "T1566.002": ["T1204.001", "T1059.001", "T1078"],
    "T1530":     ["T1071.001", "T1048.003", "T1486"],
    "T1053.005": ["T1078", "T1021.002"],
    "T1110":     ["T1078", "T1021.002"],
    "T1003":     ["T1078", "T1021.002", "T1110"],
}

# ── Threat Actor → Known TTP Mapping ─────────────────────────────────────────
# Sourced from MITRE ATT&CK groups database, curated for Indian CNI context.
ACTOR_TTPS: dict[str, list[str]] = {
    "APT41": [
        "T1078", "T1021.002", "T1560.001", "T1071.001", "T1490",
        "T1486", "T1053.005", "T1087.002", "T1003", "T1059.001",
    ],
    "APT-C-17":  # SideWinder
    [
        "T1566.002", "T1204.001", "T1059.001", "T1087.002",
        "T1071.001", "T1530",
    ],
    "APT36":  # Transparent Tribe
    [
        "T1566.001", "T1566.002", "T1059.001", "T1078",
        "T1071.001", "T1105",
    ],
    "Lazarus Group": [
        "T1486", "T1490", "T1071.001", "T1078", "T1110",
        "T1021.002", "T1560.001",
    ],
}

# ── Technique Stub Catalogue ──────────────────────────────────────────────────
# Full descriptions power the similarity search when STIX bundle is absent.
TECHNIQUE_STUBS: dict[str, dict[str, Any]] = {
    "T1078": {
        "id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Initial Access",
        "kill_chain_stage": 1,
        "description": (
            "Adversaries may obtain and abuse credentials of existing accounts as a "
            "means of gaining Initial Access, Persistence, Privilege Escalation, or "
            "Defense Evasion. Compromised credentials may be used to bypass access "
            "controls placed on various resources on systems within the network and "
            "may even be used for persistent access to remote systems. Service accounts "
            "authenticating interactively or from unexpected IP ranges indicate abuse."
        ),
        "data_sources": ["Authentication logs", "Active Directory", "Logon Session"],
        "platforms": ["Windows", "Linux"],
        "detection": "Monitor for logon events with unusual source IPs, off-hours, or service accounts used interactively.",
    },
    "T1021.002": {
        "id": "T1021.002",
        "name": "SMB/Windows Admin Shares",
        "tactic": "Lateral Movement",
        "kill_chain_stage": 4,
        "description": (
            "Adversaries may use Valid Accounts to interact with a remote network share "
            "using Server Message Block (SMB). Attackers often sweep subnets connecting "
            "to admin$ or C$ shares. Lateral movement through SMB is a hallmark of "
            "ransomware pre-deployment. High connection count to port 445 from a single "
            "host in a short time window indicates subnet scanning."
        ),
        "data_sources": ["Network traffic", "Windows Shares", "Authentication logs"],
        "platforms": ["Windows"],
        "detection": "Monitor for SMB connections to multiple hosts from a single source within narrow time windows.",
    },
    "T1560.001": {
        "id": "T1560.001",
        "name": "Archive via Utility",
        "tactic": "Collection",
        "kill_chain_stage": 6,
        "description": (
            "An adversary may compress or encrypt data that is collected prior to "
            "exfiltration using 7-Zip, WinRAR, or tar. Use of 7z.exe with password "
            "protection from a SYSTEM context, writing to temp directories, with high "
            "volume indicates pre-exfiltration staging. Shadow copy deletion often "
            "accompanies this stage to prevent recovery."
        ),
        "data_sources": ["File access", "Command execution", "Process creation"],
        "platforms": ["Windows"],
        "detection": "Monitor for 7z.exe, rar.exe, tar spawned by SYSTEM or from temp directories with high write volumes.",
    },
    "T1071.001": {
        "id": "T1071.001",
        "name": "Web Protocols",
        "tactic": "Command and Control",
        "kill_chain_stage": 7,
        "description": (
            "Adversaries may communicate using application layer protocols associated "
            "with web traffic to avoid detection. Cobalt Strike beacons use HTTPS with "
            "configurable jitter (e.g. 300s ± 45s). Typosquat domains (microsofft.com) "
            "resolved to Tor exit nodes, periodic POST requests with low variance in "
            "intervals, and DGA-pattern subdomains are strong indicators."
        ),
        "data_sources": ["Network flows", "DNS queries", "SSL/TLS inspection"],
        "platforms": ["Windows", "Linux", "macOS"],
        "detection": "Monitor for periodic outbound HTTPS connections to new domains; check domain entropy; compare interval variance.",
    },
    "T1071.004": {
        "id": "T1071.004",
        "name": "DNS",
        "tactic": "Command and Control",
        "kill_chain_stage": 7,
        "description": (
            "Adversaries may communicate using the Domain Name System (DNS) application "
            "layer protocol to avoid detection. DNS tunneling encodes C2 traffic in "
            "query/response pairs. High-volume queries to a single domain or use of "
            "TXT/NULL record types may indicate DNS C2."
        ),
        "data_sources": ["DNS logs", "Network traffic"],
        "platforms": ["Windows", "Linux"],
        "detection": "Baseline DNS query volume per host; alert on abnormal TXT/NULL record requests.",
    },
    "T1486": {
        "id": "T1486",
        "name": "Data Encrypted for Impact",
        "tactic": "Impact",
        "kill_chain_stage": 9,
        "description": (
            "Adversaries may encrypt data on target systems or on large numbers of "
            "systems in a network to interrupt availability. Mass file renames (appending "
            ".locked, .encrypted), BCDedit modifications, ransom note creation, and "
            "destruction of shadow copies indicate ransomware execution."
        ),
        "data_sources": ["File write events", "Process creation", "WMI"],
        "platforms": ["Windows"],
        "detection": "Alert on mass file rename events, BCDedit calls, ransom note creation patterns.",
    },
    "T1490": {
        "id": "T1490",
        "name": "Inhibit System Recovery",
        "tactic": "Impact",
        "kill_chain_stage": 9,
        "description": (
            "Adversaries may delete or remove built-in operating system data and turn off "
            "services designed to aid in the recovery and backup of data. vssadmin delete "
            "shadows, wbadmin delete catalog, and bcdedit /set recoveryenabled no are "
            "common pre-ransomware actions."
        ),
        "data_sources": ["Command execution", "WMI", "Windows Event Log"],
        "platforms": ["Windows"],
        "detection": "Monitor for vssadmin, wbadmin, bcdedit commands executed by non-admin or SYSTEM processes.",
    },
    "T1491": {
        "id": "T1491",
        "name": "Defacement",
        "tactic": "Impact",
        "kill_chain_stage": 9,
        "description": "Adversaries may modify visual content available internally or externally to an enterprise network.",
        "data_sources": ["File monitoring", "Web application firewall logs"],
        "platforms": ["Windows", "Linux"],
        "detection": "Monitor for unexpected changes to web-facing content or system UI elements.",
    },
    "T1053.005": {
        "id": "T1053.005",
        "name": "Scheduled Task",
        "tactic": "Persistence",
        "kill_chain_stage": 3,
        "description": (
            "Adversaries may abuse the Windows Task Scheduler to perform task scheduling "
            "for initial or recurring execution of malicious code. schtasks.exe /create "
            "from unexpected contexts, especially pointing to temp directories, indicates "
            "persistence installation."
        ),
        "data_sources": ["Process creation", "Scheduled job events", "Windows Registry"],
        "platforms": ["Windows"],
        "detection": "Monitor for schtasks /create targeting temp directories or uncommon executables.",
    },
    "T1087.002": {
        "id": "T1087.002",
        "name": "Domain Account",
        "tactic": "Discovery",
        "kill_chain_stage": 5,
        "description": (
            "Adversaries may attempt to get a listing of domain accounts. net user /domain, "
            "whoami /all, and nltest /domain_trusts are commonly executed after initial "
            "access to understand the AD environment and identify privileged accounts."
        ),
        "data_sources": ["Process creation", "Active Directory", "Command execution"],
        "platforms": ["Windows"],
        "detection": "Monitor for net user /domain, whoami, nltest executed by non-IT accounts or in off-hours.",
    },
    "T1566.002": {
        "id": "T1566.002",
        "name": "Spearphishing Link",
        "tactic": "Initial Access",
        "kill_chain_stage": 1,
        "description": (
            "Adversaries may send spearphishing emails with a malicious link to gain access "
            "to victim systems. CBSE scenario: phishing email with lookalike domain "
            "(cbse-results.in) targeting exam administrators."
        ),
        "data_sources": ["Email gateway", "Web proxy", "Network traffic"],
        "platforms": ["Windows", "Linux", "macOS"],
        "detection": "Monitor for email links to lookalike domains; check URL reputation on click.",
    },
    "T1530": {
        "id": "T1530",
        "name": "Data from Cloud Storage",
        "tactic": "Collection",
        "kill_chain_stage": 6,
        "description": "Adversaries may access data objects from improperly secured cloud storage.",
        "data_sources": ["Cloud storage logs", "Network traffic"],
        "platforms": ["SaaS", "IaaS"],
        "detection": "Monitor for unusual bulk download events from cloud storage buckets.",
    },
    "T1110": {
        "id": "T1110",
        "name": "Brute Force",
        "tactic": "Credential Access",
        "kill_chain_stage": 5,
        "description": "Adversaries may use brute force techniques to gain access to accounts.",
        "data_sources": ["Authentication logs", "Active Directory"],
        "platforms": ["Windows", "Linux"],
        "detection": "Monitor for multiple failed authentication attempts followed by a success.",
    },
    "T1003": {
        "id": "T1003",
        "name": "OS Credential Dumping",
        "tactic": "Credential Access",
        "kill_chain_stage": 5,
        "description": "Adversaries may attempt to dump credentials from memory (LSASS) or SAM database.",
        "data_sources": ["Process access events", "Windows Event Log"],
        "platforms": ["Windows"],
        "detection": "Monitor for LSASS memory reads, procdump execution, or SAM database access.",
    },
    "T1059.001": {
        "id": "T1059.001",
        "name": "PowerShell",
        "tactic": "Execution",
        "kill_chain_stage": 2,
        "description": "Adversaries may abuse PowerShell commands and scripts for execution.",
        "data_sources": ["Script execution", "Process creation", "PowerShell logs"],
        "platforms": ["Windows"],
        "detection": "Monitor for encoded commands, AMSI bypass attempts, and unusual module imports.",
    },
    "T1204.001": {
        "id": "T1204.001",
        "name": "Malicious Link",
        "tactic": "Execution",
        "kill_chain_stage": 2,
        "description": "Adversaries may rely upon a user clicking a malicious link in order to gain execution.",
        "data_sources": ["Web proxy", "Email gateway", "Endpoint process logs"],
        "platforms": ["Windows", "macOS", "Linux"],
        "detection": "Monitor for browser child processes spawning unexpected executables.",
    },
    "T1048.003": {
        "id": "T1048.003",
        "name": "Exfiltration Over Unencrypted Protocol",
        "tactic": "Exfiltration",
        "kill_chain_stage": 8,
        "description": "Adversaries may steal data by exfiltrating it over an un-encrypted network protocol.",
        "data_sources": ["Network traffic", "Data loss prevention"],
        "platforms": ["Windows", "Linux"],
        "detection": "Monitor for large outbound transfers over non-standard ports.",
    },
    "T1105": {
        "id": "T1105",
        "name": "Ingress Tool Transfer",
        "tactic": "Command and Control",
        "kill_chain_stage": 7,
        "description": "Adversaries may transfer tools or other files from an external system into a compromised environment.",
        "data_sources": ["Network traffic", "File creation events"],
        "platforms": ["Windows", "Linux"],
        "detection": "Monitor for unexpected file downloads to temp directories from external IPs.",
    },
    "T1566.001": {
        "id": "T1566.001",
        "name": "Spearphishing Attachment",
        "tactic": "Initial Access",
        "kill_chain_stage": 1,
        "description": "Adversaries may send spearphishing emails with a malicious attachment to gain access.",
        "data_sources": ["Email gateway", "Endpoint process logs"],
        "platforms": ["Windows", "macOS"],
        "detection": "Monitor for macro execution from email attachments or PDF exploits.",
    },
}


def _text_similarity(a: str, b: str) -> float:
    """Compute normalized text similarity between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


class MITREAttackClient:
    """
    Client for the MITRE ATT&CK knowledge base.

    Tries to load the full STIX bundle from MITRE_ATTACK_STIX_PATH.
    Falls back cleanly to TECHNIQUE_STUBS for demo operation.
    """

    def __init__(self, stix_path: str | None = None) -> None:
        self._stix_path = stix_path or os.getenv(
            "MITRE_ATTACK_STIX_PATH", "./data/mitre/enterprise-attack.json"
        )
        self._stix_client: Any = None
        self._technique_cache: dict[str, dict[str, Any]] = {}
        self._loaded_from_stix = False
        self._load()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Attempt to load full STIX bundle; fall back to stubs on failure."""
        if os.path.exists(self._stix_path):
            try:
                from mitreattack.stix20 import MitreAttackData  # type: ignore

                self._stix_client = MitreAttackData(self._stix_path)
                self._loaded_from_stix = True
                logger.info(
                    "MITRE ATT&CK STIX bundle loaded from %s", self._stix_path
                )
                return
            except ImportError:
                logger.warning(
                    "mitreattack-python not installed; falling back to technique stubs."
                )
            except Exception as exc:
                logger.warning(
                    "Could not load STIX bundle (%s): %s. Using stubs.", self._stix_path, exc
                )

        # Fallback: use hand-curated stubs
        self._technique_cache = dict(TECHNIQUE_STUBS)
        logger.info(
            "MITRE ATT&CK running in STUB mode — %d techniques available.",
            len(self._technique_cache),
        )

    def _fetch_stix_technique(self, technique_id: str) -> dict[str, Any] | None:
        """Query STIX client for a technique and normalise to our schema."""
        if not self._stix_client:
            return None
        try:
            technique = self._stix_client.get_object_by_attack_id(
                technique_id, "attack-pattern"
            )
            if not technique:
                return None

            obj = technique[0] if isinstance(technique, list) else technique
            tactics = []
            for kcp in obj.get("kill_chain_phases", []):
                if kcp.get("kill_chain_name") == "mitre-attack":
                    tactics.append(kcp.get("phase_name", ""))

            tactic_name = tactics[0].replace("-", " ").title() if tactics else "Unknown"
            return {
                "id": technique_id,
                "name": obj.get("name", ""),
                "tactic": tactic_name,
                "kill_chain_stage": self._tactic_to_stage(tactic_name),
                "description": obj.get("description", ""),
                "data_sources": obj.get("x_mitre_data_sources", []),
                "platforms": obj.get("x_mitre_platforms", []),
                "detection": obj.get("x_mitre_detection", ""),
            }
        except Exception as exc:
            logger.debug("STIX lookup failed for %s: %s", technique_id, exc)
            return None

    # ── Public API ────────────────────────────────────────────────────────────

    def get_technique(self, technique_id: str) -> dict[str, Any]:
        """
        Return full technique dict for a given ID (e.g. 'T1078').
        Uses cache → STIX client → stubs, in that order.
        """
        if technique_id in self._technique_cache:
            return self._technique_cache[technique_id]

        if self._loaded_from_stix:
            result = self._fetch_stix_technique(technique_id)
            if result:
                self._technique_cache[technique_id] = result
                return result

        # Fall through to stubs
        stub = TECHNIQUE_STUBS.get(technique_id)
        if stub:
            return stub

        # Unknown technique — return minimal record so callers never crash
        return {
            "id": technique_id,
            "name": "Unknown Technique",
            "tactic": "Unknown",
            "kill_chain_stage": 0,
            "description": f"Technique {technique_id} not found in local database.",
            "data_sources": [],
            "platforms": [],
            "detection": "",
        }

    def search_techniques_by_behavior(
        self, behavior_description: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """
        Return techniques most semantically similar to a behavioral description.
        Uses text similarity against technique descriptions (no external call).
        """
        scores: list[tuple[float, dict[str, Any]]] = []
        corpus = (
            TECHNIQUE_STUBS
            if not self._loaded_from_stix
            else self._technique_cache
        )

        for tech in corpus.values():
            combined_text = f"{tech.get('name', '')} {tech.get('description', '')} {tech.get('tactic', '')}"
            sim = _text_similarity(behavior_description, combined_text)
            scores.append((sim, tech))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [t for _, t in scores[:top_k]]

    def get_actor_ttps(self, actor_name: str) -> list[str]:
        """
        Return list of technique IDs associated with a threat actor.
        Normalises actor name for fuzzy matching.
        """
        normalised = actor_name.strip().upper()
        for key, ttps in ACTOR_TTPS.items():
            if key.upper() in normalised or normalised in key.upper():
                logger.debug("Actor match: '%s' → '%s' (%d TTPs)", actor_name, key, len(ttps))
                return ttps

        # If STIX client is available, try querying it
        if self._stix_client:
            try:
                groups = self._stix_client.get_groups()
                for group in groups:
                    if actor_name.lower() in (group.get("name", "")).lower():
                        techniques = self._stix_client.get_techniques_used_by_group(group)
                        ids = []
                        for t in techniques:
                            for ref in t.get("external_references", []):
                                if ref.get("source_name") == "mitre-attack":
                                    ids.append(ref.get("external_id", ""))
                        return [i for i in ids if i]
            except Exception as exc:
                logger.debug("STIX group lookup failed: %s", exc)

        logger.warning("No TTPs found for actor: %s", actor_name)
        return []

    def get_techniques_by_tactic(self, tactic: str) -> list[dict[str, Any]]:
        """Return all techniques associated with a given tactic name."""
        tactic_lower = tactic.lower().replace("-", " ")
        corpus = TECHNIQUE_STUBS if not self._loaded_from_stix else self._technique_cache
        return [
            t for t in corpus.values()
            if tactic_lower in t.get("tactic", "").lower().replace("-", " ")
        ]

    def predict_next_ttps(self, observed_ttps: list[str]) -> list[str]:
        """
        Predict likely next techniques based on observed TTP sequence.
        Returns deduplicated list ordered by frequency of prediction.
        """
        predictions: dict[str, int] = {}
        for ttp in observed_ttps:
            for next_ttp in TTP_SEQUENCES.get(ttp, []):
                # Only predict TTPs not already observed
                if next_ttp not in observed_ttps:
                    predictions[next_ttp] = predictions.get(next_ttp, 0) + 1

        # Sort by vote count (most predicted first)
        ranked = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        return [ttp for ttp, _ in ranked]

    # ── Utility ───────────────────────────────────────────────────────────────

    @staticmethod
    def _tactic_to_stage(tactic_name: str) -> int:
        """Map tactic name to a kill-chain stage integer (1–9)."""
        mapping = {
            "initial access": 1,
            "execution": 2,
            "persistence": 3,
            "privilege escalation": 3,
            "defense evasion": 3,
            "credential access": 5,
            "discovery": 5,
            "lateral movement": 4,
            "collection": 6,
            "command and control": 7,
            "exfiltration": 8,
            "impact": 9,
        }
        return mapping.get(tactic_name.lower(), 0)
