#!/usr/bin/env python3
"""
Attack Chain Autopsy Engine — Graph Population Script
Loads AIIMS Delhi and CBSE 2026 synthetic scenarios into Neo4j and ChromaDB.

Usage:
    python scripts/populate_graph.py
    python scripts/populate_graph.py --scenario aiims  # Only AIIMS
    python scripts/populate_graph.py --clear           # Clear DB first

Requires:
    - Running Neo4j instance (docker-compose up -d neo4j)
    - .env with NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY
    - data/synthetic/ directory with scenario JSON files
"""

import json
import os
import sys
import argparse
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase, exceptions as neo4j_exc
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich.table import Table
import chromadb
from openai import OpenAI

# ── Load environment ──────────────────────────────────────────
load_dotenv()
console = Console()

NEO4J_URI      = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "autopsy_secure_2024")
CHROMA_PATH    = os.getenv("CHROMA_PATH", "./chroma_db")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATA_DIR       = Path(os.getenv("DATA_DIR", "./data/synthetic"))


# ═══════════════════════════════════════════════════════════════
# Neo4j Schema Initialization
# Creates indexes, constraints, and baseline node types
# ═══════════════════════════════════════════════════════════════

SCHEMA_QUERIES = [
    # Unique constraints
    "CREATE CONSTRAINT IF NOT EXISTS FOR (e:SecurityEvent) REQUIRE e.event_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (h:Host) REQUIRE h.hostname IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account) REQUIRE a.account_name IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Technique) REQUIRE t.technique_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (i:IOC) REQUIRE i.value IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (s:Scenario) REQUIRE s.scenario_id IS UNIQUE",

    # Indexes for performance
    "CREATE INDEX IF NOT EXISTS FOR (e:SecurityEvent) ON (e.timestamp)",
    "CREATE INDEX IF NOT EXISTS FOR (e:SecurityEvent) ON (e.host)",
    "CREATE INDEX IF NOT EXISTS FOR (e:SecurityEvent) ON (e.account)",
    "CREATE INDEX IF NOT EXISTS FOR (e:SecurityEvent) ON (e.anomaly_score)",
    "CREATE INDEX IF NOT EXISTS FOR (a:Alert) ON (a.severity)",
    "CREATE INDEX IF NOT EXISTS FOR (a:Alert) ON (a.created_at)",
]


def init_schema(driver) -> None:
    """Create Neo4j schema constraints and indexes."""
    with driver.session() as session:
        for query in SCHEMA_QUERIES:
            try:
                session.run(query)
            except Exception as e:
                console.print(f"  [yellow]Schema warning:[/yellow] {e}")
    console.print("  [green]✓[/green] Neo4j schema initialized")


# ═══════════════════════════════════════════════════════════════
# Scenario Loading — AIIMS Delhi 2022
# ═══════════════════════════════════════════════════════════════

def load_aiims_scenario(driver) -> dict[str, int]:
    """
    Load the AIIMS Delhi 2022 attack scenario into Neo4j.
    Creates: Scenario, Host, Account, SecurityEvent, Technique, IOC nodes
    and the relationships between them.
    Returns stats dict with node counts.
    """
    stats = {"hosts": 0, "accounts": 0, "events": 0, "techniques": 0, "iocs": 0}
    aiims_dir = DATA_DIR / "aiims_attack"

    with driver.session() as session:
        # ── Create Scenario node ─────────────────────────────
        session.run("""
            MERGE (s:Scenario {scenario_id: 'aiims_delhi_2022'})
            SET s.name = 'AIIMS Delhi Ransomware 2022',
                s.description = 'Nation-state APT41 ransomware targeting AIIMS Delhi hospital systems',
                s.start_date = '2022-11-01',
                s.end_date = '2022-11-22',
                s.dwell_time_days = 22,
                s.detection_window_days = 19,
                s.likely_actor = 'APT41',
                s.industry = 'Healthcare',
                s.country = 'India',
                s.created_at = datetime()
        """)

        # ── Create Host nodes ────────────────────────────────
        hosts = [
            {"hostname": "AIIMS-BACKUP-SRV-01", "role": "Backup Server", "ip": "10.0.8.20", "subnet": "admin", "os": "Windows Server 2019"},
            {"hostname": "AIIMS-PATIENT-MGMT-01", "role": "Patient Management", "ip": "10.0.4.30", "subnet": "clinical", "os": "Windows Server 2016"},
            {"hostname": "AIIMS-DC-01", "role": "Domain Controller", "ip": "10.0.8.10", "subnet": "admin", "os": "Windows Server 2019"},
            {"hostname": "AIIMS-FILE-SRV-02", "role": "File Server", "ip": "10.0.4.50", "subnet": "clinical", "os": "Windows Server 2016"},
            {"hostname": "AIIMS-RESEARCH-SRV-01", "role": "Research Server", "ip": "10.0.12.10", "subnet": "research", "os": "Windows Server 2016"},
        ]
        for host in hosts:
            session.run("""
                MERGE (h:Host {hostname: $hostname})
                SET h.role = $role, h.ip = $ip, h.subnet = $subnet, h.os = $os,
                    h.compromised = false, h.scenario = 'aiims_delhi_2022'
                WITH h
                MATCH (s:Scenario {scenario_id: 'aiims_delhi_2022'})
                MERGE (s)-[:INCLUDES_HOST]->(h)
            """, **host)
        stats["hosts"] = len(hosts)

        # ── Create Account nodes ─────────────────────────────
        accounts = [
            {"account_name": "svc_backup$", "account_type": "service", "privilege_level": "domain_admin", "compromised": True},
            {"account_name": "admin_raj", "account_type": "user", "privilege_level": "domain_admin", "compromised": False},
            {"account_name": "dr_mehta", "account_type": "user", "privilege_level": "user", "compromised": False},
            {"account_name": "SYSTEM", "account_type": "system", "privilege_level": "local_system", "compromised": True},
        ]
        for acct in accounts:
            session.run("""
                MERGE (a:Account {account_name: $account_name})
                SET a.account_type = $account_type, a.privilege_level = $privilege_level,
                    a.compromised = $compromised, a.scenario = 'aiims_delhi_2022'
            """, **acct)
        stats["accounts"] = len(accounts)

        # ── Create MITRE Technique nodes ─────────────────────
        techniques = [
            {"technique_id": "T1078", "name": "Valid Accounts", "tactic": "initial-access", "detection_day": 1, "confidence": 0.73},
            {"technique_id": "T1021.002", "name": "SMB/Windows Admin Shares", "tactic": "lateral-movement", "detection_day": 3, "confidence": 0.91},
            {"technique_id": "T1087.002", "name": "Domain Account Discovery", "tactic": "discovery", "detection_day": 3, "confidence": 0.91},
            {"technique_id": "T1053.005", "name": "Scheduled Task", "tactic": "persistence", "detection_day": 3, "confidence": 0.98},
            {"technique_id": "T1560.001", "name": "Archive Collected Data", "tactic": "collection", "detection_day": 7, "confidence": 0.94},
            {"technique_id": "T1490", "name": "Inhibit System Recovery", "tactic": "impact", "detection_day": 7, "confidence": 0.99},
            {"technique_id": "T1071.001", "name": "Web Protocols C2", "tactic": "command-and-control", "detection_day": 12, "confidence": 0.99},
            {"technique_id": "T1048", "name": "Exfiltration Over Alternative Protocol", "tactic": "exfiltration", "detection_day": 12, "confidence": 0.99},
            {"technique_id": "T1486", "name": "Data Encrypted for Impact", "tactic": "impact", "detection_day": 22, "confidence": 1.0},
            {"technique_id": "T1531", "name": "Account Access Removal", "tactic": "impact", "detection_day": 22, "confidence": 1.0},
        ]
        for tech in techniques:
            session.run("""
                MERGE (t:Technique {technique_id: $technique_id})
                SET t.name = $name, t.tactic = $tactic,
                    t.detection_day = $detection_day, t.confidence = $confidence,
                    t.scenario = 'aiims_delhi_2022'
                WITH t
                MATCH (s:Scenario {scenario_id: 'aiims_delhi_2022'})
                MERGE (s)-[:USES_TECHNIQUE]->(t)
            """, **tech)
        stats["techniques"] = len(techniques)

        # ── Create IOC nodes ─────────────────────────────────
        iocs = [
            {"value": "185.220.101.47", "ioc_type": "ip", "description": "Tor exit node — Cobalt Strike C2"},
            {"value": "update.microsofft.com", "ioc_type": "domain", "description": "Typosquat C2 domain (double-f)"},
            {"value": "a0e9f5d64349fb13191bc781f81f42e1", "ioc_type": "ja3_hash", "description": "Cobalt Strike HTTPS beacon JA3"},
            {"value": "MicrosoftEdgeUpdateTaskMachineUA", "ioc_type": "scheduled_task", "description": "Malicious persistence task"},
            {"value": "3f1a8b2c9d4e7f6a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a", "ioc_type": "file_hash_sha256", "description": "svhost32.exe ransomware binary"},
        ]
        for ioc in iocs:
            session.run("""
                MERGE (i:IOC {value: $value})
                SET i.ioc_type = $ioc_type, i.description = $description,
                    i.scenario = 'aiims_delhi_2022'
                WITH i
                MATCH (s:Scenario {scenario_id: 'aiims_delhi_2022'})
                MERGE (s)-[:ASSOCIATED_IOC]->(i)
            """, **ioc)
        stats["iocs"] = len(iocs)

        # ── Load attack events from JSON files ────────────────
        attack_files = [
            ("day01_initial_access.json", 1),
            ("day03_lateral_movement.json", 3),
            ("day07_collection.json", 7),
            ("day12_c2.json", 12),
            ("day22_impact.json", 22),
        ]

        event_count = 0
        for filename, day in attack_files:
            filepath = aiims_dir / "attack_logs" / filename
            if not filepath.exists():
                console.print(f"  [yellow]⚠ Missing:[/yellow] {filepath}")
                continue

            with open(filepath, encoding="utf-8") as f:
                events = json.load(f)

            for event in events:
                # Generate stable event_id from content hash
                content_hash = hashlib.md5(
                    json.dumps(event, sort_keys=True).encode()
                ).hexdigest()[:12]
                node_id = f"aiims_day{day:02d}_{content_hash}"

                # Extract anomaly score
                anomaly_score = event.get(
                    "baseline_deviation_score",
                    event.get("anomaly_score", 0.5)
                )

                session.run("""
                    MERGE (e:SecurityEvent {event_id: $event_id})
                    SET e.scenario = 'aiims_delhi_2022',
                        e.day = $day,
                        e.timestamp = $timestamp,
                        e.host = $host,
                        e.account = $account,
                        e.event_type = $event_type,
                        e.mitre_technique = $mitre_technique,
                        e.anomaly_score = $anomaly_score,
                        e.ground_truth_note = $ground_truth_note,
                        e.is_malicious = true,
                        e.raw = $raw
                    WITH e
                    MATCH (s:Scenario {scenario_id: 'aiims_delhi_2022'})
                    MERGE (s)-[:CONTAINS_EVENT]->(e)
                """,
                    event_id=node_id,
                    day=day,
                    timestamp=event.get("timestamp", ""),
                    host=event.get("host", "UNKNOWN"),
                    account=event.get("account", "UNKNOWN"),
                    event_type=event.get("event_type", event.get("event_id", "UNKNOWN")),
                    mitre_technique=event.get("mitre_technique", ""),
                    anomaly_score=anomaly_score,
                    ground_truth_note=event.get("ground_truth_note", ""),
                    raw=json.dumps(event)[:4000],  # Neo4j property size limit
                )
                event_count += 1

                # Link event to technique
                if event.get("mitre_technique"):
                    session.run("""
                        MATCH (e:SecurityEvent {event_id: $event_id})
                        MATCH (t:Technique {technique_id: $technique_id})
                        MERGE (e)-[:DEMONSTRATES]->(t)
                    """,
                        event_id=node_id,
                        technique_id=event["mitre_technique"]
                    )

                # Link event to host
                if event.get("host"):
                    session.run("""
                        MATCH (e:SecurityEvent {event_id: $event_id})
                        MATCH (h:Host {hostname: $hostname})
                        MERGE (e)-[:OCCURRED_ON]->(h)
                    """,
                        event_id=node_id,
                        hostname=event["host"]
                    )

        stats["events"] = event_count

        # ── Create attack chain relationships ────────────────
        # T1078 → T1021.002 (initial access enables lateral movement)
        session.run("""
            MATCH (t1:Technique {technique_id: 'T1078', scenario: 'aiims_delhi_2022'})
            MATCH (t2:Technique {technique_id: 'T1021.002', scenario: 'aiims_delhi_2022'})
            MERGE (t1)-[:ENABLES {confidence: 0.85}]->(t2)
        """)
        # T1021.002 → T1053.005 (lateral movement enables persistence)
        session.run("""
            MATCH (t1:Technique {technique_id: 'T1021.002', scenario: 'aiims_delhi_2022'})
            MATCH (t2:Technique {technique_id: 'T1053.005', scenario: 'aiims_delhi_2022'})
            MERGE (t1)-[:ENABLES {confidence: 0.92}]->(t2)
        """)
        # T1053.005 → T1560.001 (persistence enables collection)
        session.run("""
            MATCH (t1:Technique {technique_id: 'T1053.005', scenario: 'aiims_delhi_2022'})
            MATCH (t2:Technique {technique_id: 'T1560.001', scenario: 'aiims_delhi_2022'})
            MERGE (t1)-[:ENABLES {confidence: 0.88}]->(t2)
        """)
        # T1560.001 → T1071.001 (collection precedes C2 exfil)
        session.run("""
            MATCH (t1:Technique {technique_id: 'T1560.001', scenario: 'aiims_delhi_2022'})
            MATCH (t2:Technique {technique_id: 'T1071.001', scenario: 'aiims_delhi_2022'})
            MERGE (t1)-[:PRECEDES {confidence: 0.95}]->(t2)
        """)
        # T1071.001 → T1486 (C2 precedes ransomware deployment)
        session.run("""
            MATCH (t1:Technique {technique_id: 'T1071.001', scenario: 'aiims_delhi_2022'})
            MATCH (t2:Technique {technique_id: 'T1486', scenario: 'aiims_delhi_2022'})
            MERGE (t1)-[:PRECEDES {confidence: 0.99}]->(t2)
        """)

    return stats


def load_cbse_scenario(driver) -> dict[str, int]:
    """Load the CBSE 2026 breach scenario into Neo4j."""
    stats = {"hosts": 0, "accounts": 0, "events": 0, "techniques": 0, "iocs": 0}
    cbse_dir = DATA_DIR / "cbse_attack"

    with driver.session() as session:
        session.run("""
            MERGE (s:Scenario {scenario_id: 'cbse_2026'})
            SET s.name = 'CBSE Board Exam Breach 2026',
                s.description = 'Targeted attack on CBSE exam systems — phishing, paper theft, ransomware on student database',
                s.start_date = '2026-03-02',
                s.end_date = '2026-03-14',
                s.dwell_time_days = 12,
                s.detection_window_days = 12,
                s.likely_actor = 'APT41',
                s.industry = 'Education — Government',
                s.country = 'India',
                s.created_at = datetime()
        """)

        cbse_hosts = [
            {"hostname": "CBSE-MAIL-GW-01", "role": "Mail Gateway", "ip": "10.1.0.5", "subnet": "dmz"},
            {"hostname": "CBSE-EXAM-PORTAL-01", "role": "Exam Portal", "ip": "10.1.5.20", "subnet": "application"},
            {"hostname": "CBSE-STUDENT-DB-01", "role": "Student Database", "ip": "10.1.8.30", "subnet": "database"},
        ]
        for host in cbse_hosts:
            session.run("""
                MERGE (h:Host {hostname: $hostname})
                SET h.role = $role, h.ip = $ip, h.subnet = $subnet,
                    h.scenario = 'cbse_2026'
                WITH h
                MATCH (s:Scenario {scenario_id: 'cbse_2026'})
                MERGE (s)-[:INCLUDES_HOST]->(h)
            """, **host)
        stats["hosts"] = len(cbse_hosts)

        # Load CBSE attack events
        cbse_file = cbse_dir / "attack_logs" / "cbse_2026_breach.json"
        event_count = 0
        if cbse_file.exists():
            with open(cbse_file, encoding="utf-8") as f:
                events = json.load(f)

            for event in events:
                content_hash = hashlib.md5(
                    json.dumps(event, sort_keys=True).encode()
                ).hexdigest()[:12]
                node_id = f"cbse_seq{event.get('sequence', 0):02d}_{content_hash}"

                session.run("""
                    MERGE (e:SecurityEvent {event_id: $event_id})
                    SET e.scenario = 'cbse_2026',
                        e.timestamp = $timestamp,
                        e.host = $host,
                        e.account = $account,
                        e.event_type = $event_type,
                        e.mitre_technique = $mitre_technique,
                        e.anomaly_score = 0.85,
                        e.ground_truth_note = $ground_truth_note,
                        e.is_malicious = true,
                        e.raw = $raw
                    WITH e
                    MATCH (s:Scenario {scenario_id: 'cbse_2026'})
                    MERGE (s)-[:CONTAINS_EVENT]->(e)
                """,
                    event_id=node_id,
                    timestamp=event.get("timestamp", ""),
                    host=event.get("host", "UNKNOWN"),
                    account=event.get("target_account", event.get("account", "UNKNOWN")),
                    event_type=event.get("event_type", event.get("event_id", "UNKNOWN")),
                    mitre_technique=event.get("mitre_technique", ""),
                    ground_truth_note=event.get("ground_truth_note", ""),
                    raw=json.dumps(event)[:4000],
                )
                event_count += 1
        stats["events"] = event_count

    return stats


def load_cert_in_iocs(driver) -> int:
    """Load CERT-In advisory IOCs as IOC nodes linked to both scenarios."""
    advisory_file = DATA_DIR / "cert_in_advisories" / "advisory_2024_ci21.json"
    if not advisory_file.exists():
        return 0

    with open(advisory_file, encoding="utf-8") as f:
        advisory = json.load(f)

    ioc_count = 0
    with driver.session() as session:
        # Create advisory node
        session.run("""
            MERGE (adv:Advisory {advisory_id: $advisory_id})
            SET adv.title = $title, adv.date = $date, adv.severity = $severity,
                adv.issuer = 'CERT-In'
        """,
            advisory_id=advisory["advisory_id"],
            title=advisory["title"],
            date=advisory["date"],
            severity=advisory["severity"]
        )

        for ip_ioc in advisory.get("iocs", {}).get("ip_addresses", []):
            session.run("""
                MERGE (i:IOC {value: $value})
                SET i.ioc_type = 'ip', i.description = $description,
                    i.confidence = $confidence, i.source = 'CERT-In CI-21-2024'
                WITH i
                MATCH (adv:Advisory {advisory_id: 'CERT-In/CI-21-2024'})
                MERGE (adv)-[:CONTAINS_IOC]->(i)
            """,
                value=ip_ioc["ip"],
                description=ip_ioc["description"],
                confidence=ip_ioc["confidence"]
            )
            ioc_count += 1

        for domain_ioc in advisory.get("iocs", {}).get("domains", []):
            session.run("""
                MERGE (i:IOC {value: $value})
                SET i.ioc_type = 'domain', i.description = $description,
                    i.confidence = $confidence, i.source = 'CERT-In CI-21-2024'
                WITH i
                MATCH (adv:Advisory {advisory_id: 'CERT-In/CI-21-2024'})
                MERGE (adv)-[:CONTAINS_IOC]->(i)
            """,
                value=domain_ioc["domain"],
                description=domain_ioc["description"],
                confidence=domain_ioc.get("confidence", "medium")
            )
            ioc_count += 1

        # Link shared IOCs to scenarios
        session.run("""
            MATCH (i:IOC {value: '185.220.101.47'})
            MATCH (s:Scenario {scenario_id: 'aiims_delhi_2022'})
            MERGE (s)-[:ASSOCIATED_IOC]->(i)
        """)
        session.run("""
            MATCH (i:IOC {value: '45.142.212.100'})
            MATCH (s:Scenario {scenario_id: 'cbse_2026'})
            MERGE (s)-[:ASSOCIATED_IOC]->(i)
        """)

    return ioc_count


def populate_chromadb() -> int:
    """
    Populate ChromaDB with embeddings of security events for semantic search.
    Uses OpenAI text-embedding-3-small.
    Returns number of documents embedded.
    """
    if not OPENAI_API_KEY:
        console.print("  [yellow]⚠ OPENAI_API_KEY not set — skipping ChromaDB population[/yellow]")
        return 0

    client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = client.get_or_create_collection(
        name="security_events",
        metadata={"description": "AIIMS and CBSE attack event embeddings for semantic search"}
    )

    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    docs, ids, metadatas = [], [], []

    # Collect events from all attack log files
    attack_dirs = [
        DATA_DIR / "aiims_attack" / "attack_logs",
        DATA_DIR / "cbse_attack" / "attack_logs",
    ]
    for attack_dir in attack_dirs:
        if not attack_dir.exists():
            continue
        for json_file in sorted(attack_dir.glob("*.json")):
            with open(json_file, encoding="utf-8") as f:
                events = json.load(f)
            for event in events:
                # Create rich text representation for embedding
                text = (
                    f"Event: {event.get('event_id', '')} | "
                    f"Host: {event.get('host', '')} | "
                    f"Account: {event.get('account', '')} | "
                    f"Technique: {event.get('mitre_technique', '')} {event.get('mitre_technique_name', '')} | "
                    f"Anomaly signals: {' | '.join(event.get('anomaly_signals', []))} | "
                    f"Note: {event.get('ground_truth_note', '')[:300]}"
                )
                doc_id = hashlib.md5(text.encode()).hexdigest()
                docs.append(text)
                ids.append(doc_id)
                metadatas.append({
                    "scenario": "aiims_delhi_2022" if "aiims" in str(json_file) else "cbse_2026",
                    "technique": event.get("mitre_technique", ""),
                    "host": event.get("host", ""),
                    "timestamp": event.get("timestamp", ""),
                    "anomaly_score": str(event.get("baseline_deviation_score", 0.5)),
                })

    if not docs:
        return 0

    # Batch embed (API limit: 2048 per request)
    batch_size = 100
    for i in range(0, len(docs), batch_size):
        batch_docs = docs[i:i + batch_size]
        batch_ids  = ids[i:i + batch_size]
        batch_meta = metadatas[i:i + batch_size]

        response = openai_client.embeddings.create(
            input=batch_docs,
            model="text-embedding-3-small"
        )
        embeddings = [item.embedding for item in response.data]

        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            embeddings=embeddings,
            metadatas=batch_meta
        )

    return len(docs)


# ═══════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Populate Attack Chain Autopsy Engine graph and vector store"
    )
    parser.add_argument(
        "--scenario", choices=["aiims", "cbse", "all"], default="all",
        help="Which scenario to load (default: all)"
    )
    parser.add_argument(
        "--clear", action="store_true",
        help="Clear all existing data before loading"
    )
    parser.add_argument(
        "--skip-chroma", action="store_true",
        help="Skip ChromaDB vector store population"
    )
    args = parser.parse_args()

    console.print(Panel(
        "[bold cyan]Attack Chain Autopsy Engine[/bold cyan]\n"
        "[dim]Graph & Vector Store Population Script[/dim]",
        border_style="cyan"
    ))

    # ── Connect to Neo4j ─────────────────────────────────────
    console.print(f"\n[cyan]→ Connecting to Neo4j:[/cyan] {NEO4J_URI}")
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            max_connection_lifetime=300,
        )
        driver.verify_connectivity()
        console.print("  [green]✓[/green] Neo4j connected")
    except neo4j_exc.ServiceUnavailable as e:
        console.print(f"  [red]✗ Neo4j unavailable:[/red] {e}")
        console.print("  [yellow]Hint:[/yellow] Run: docker-compose up -d neo4j")
        sys.exit(1)

    # ── Clear if requested ────────────────────────────────────
    if args.clear:
        console.print("\n[yellow]→ Clearing all existing graph data...[/yellow]")
        with driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        console.print("  [green]✓[/green] Graph cleared")

    # ── Initialize schema ─────────────────────────────────────
    console.print("\n[cyan]→ Initializing Neo4j schema...[/cyan]")
    init_schema(driver)

    # ── Load scenarios ────────────────────────────────────────
    summary_table = Table(title="Load Summary", border_style="cyan", show_header=True)
    summary_table.add_column("Scenario", style="bold")
    summary_table.add_column("Hosts", justify="right")
    summary_table.add_column("Accounts", justify="right")
    summary_table.add_column("Events", justify="right")
    summary_table.add_column("Techniques", justify="right")
    summary_table.add_column("IOCs", justify="right")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        console=console
    ) as progress:
        if args.scenario in ("aiims", "all"):
            task = progress.add_task("[cyan]Loading AIIMS Delhi 2022 scenario...", total=None)
            stats = load_aiims_scenario(driver)
            progress.update(task, completed=True)
            summary_table.add_row(
                "AIIMS Delhi 2022",
                str(stats["hosts"]), str(stats["accounts"]),
                str(stats["events"]), str(stats["techniques"]),
                str(stats["iocs"])
            )

        if args.scenario in ("cbse", "all"):
            task = progress.add_task("[cyan]Loading CBSE 2026 scenario...", total=None)
            stats = load_cbse_scenario(driver)
            progress.update(task, completed=True)
            summary_table.add_row(
                "CBSE 2026",
                str(stats["hosts"]), str(stats["accounts"]),
                str(stats["events"]), str(stats["techniques"]),
                str(stats["iocs"])
            )

        # Load CERT-In IOCs
        task = progress.add_task("[cyan]Loading CERT-In advisory IOCs...", total=None)
        ioc_count = load_cert_in_iocs(driver)
        progress.update(task, completed=True)
        summary_table.add_row("CERT-In Advisory CI-21-2024", "-", "-", "-", "-", str(ioc_count))

        # ChromaDB population
        if not args.skip_chroma:
            task = progress.add_task("[cyan]Embedding events in ChromaDB...", total=None)
            embedded = populate_chromadb()
            progress.update(task, completed=True)
            if embedded:
                summary_table.add_row("ChromaDB Embeddings", "-", "-", str(embedded), "-", "-")

    driver.close()

    console.print("\n")
    console.print(summary_table)
    console.print("\n[bold green]✅ Graph population complete![/bold green]")
    console.print(f"   Neo4j Browser: [cyan]http://localhost:7474[/cyan]")
    console.print(f"   Demo endpoint: [cyan]http://localhost:8000/api/v1/scenarios[/cyan]")
    console.print(f"   Frontend demo: [cyan]http://localhost:3000/demo[/cyan]\n")


if __name__ == "__main__":
    main()
