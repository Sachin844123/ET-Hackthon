import json
import os
import logging
from pathlib import Path
from datetime import datetime
from neo4j import GraphDatabase

logger = logging.getLogger("autopsy.graph")

# Constraints & Indexes schema definitions
SCHEMA_STATEMENTS = [
    "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (s:SecurityEvent) REQUIRE s.event_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (t:TTPNode) REQUIRE t.technique_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:ThreatActor) REQUIRE a.actor_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Campaign) REQUIRE c.campaign_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Alert) REQUIRE a.alert_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (p:PlaybookExecution) REQUIRE p.execution_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (i:Incident) REQUIRE i.incident_id IS UNIQUE",
    
    # Indexes
    "CREATE INDEX IF NOT EXISTS FOR (s:SecurityEvent) ON (s.timestamp)",
    "CREATE INDEX IF NOT EXISTS FOR (a:Alert) ON (a.timestamp)"
]

def init_db_schema(driver) -> None:
    """Initialize constraints and indexes in Neo4j."""
    with driver.session() as session:
        for stmt in SCHEMA_STATEMENTS:
            try:
                session.run(stmt)
            except Exception as e:
                logger.warning(f"Failed to execute schema statement: {stmt}. Error: {e}")
    logger.info("Neo4j constraints and indexes successfully initialized.")

def populate_aiims_demo(driver):
    """Populate AIIMS Delhi 2022 scenario idempotently."""
    with driver.session() as session:
        existing = session.run(
            "MATCH (i:Incident {incident_id: 'aiims_2022'}) RETURN count(i) as c"
        ).single()["c"]
        if existing > 0:
            logger.info("AIIMS demo already populated, skipping")
            return

        logger.info("Populating AIIMS 2022 scenario...")

        # 1. Create Incident
        session.run("""
            MERGE (i:Incident {incident_id: 'aiims_2022'})
            SET i.name = 'AIIMS Delhi Ransomware 2022',
                i.start_date = '2022-11-01',
                i.discovery_date = '2022-11-22',
                i.containment_date = '2022-11-12',
                i.dwell_time_days = 22,
                i.prevention_window_days = 19,
                i.severity = 'CRITICAL',
                i.status = 'CONTAINED',
                i.affected_entities = ['AIIMS-BACKUP-SRV-01', 'AIIMS-PATIENT-MGMT-01', 'AIIMS-DC-01', 'AIIMS-FILE-SRV-02']
        """)

        # 2. Create Entities (Hosts)
        hosts = [
            {"entity_id": "AIIMS-BACKUP-SRV-01", "name": "AIIMS Backup Server", "type": "HOST", "subnet": "10.0.8.0/24", "os": "Windows Server 2019", "criticality": "HIGH"},
            {"entity_id": "AIIMS-PATIENT-MGMT-01", "name": "Patient Management System", "type": "HOST", "subnet": "10.0.4.0/24", "os": "Windows Server 2016", "criticality": "HIGH"},
            {"entity_id": "AIIMS-DC-01", "name": "Active Directory Domain Controller", "type": "HOST", "subnet": "10.0.8.0/24", "os": "Windows Server 2019", "criticality": "HIGH"},
            {"entity_id": "AIIMS-FILE-SRV-02", "name": "Clinical File Server", "type": "HOST", "subnet": "10.0.4.0/24", "os": "Windows Server 2016", "criticality": "HIGH"},
        ]
        for host in hosts:
            session.run("""
                MERGE (e:Entity {entity_id: $entity_id})
                SET e.name = $name,
                    e.type = $type,
                    e.subnet = $subnet,
                    e.os = $os,
                    e.criticality = $criticality,
                    e.is_compromised = true,
                    e.compromise_confidence = 0.95
                WITH e
                MATCH (i:Incident {incident_id: 'aiims_2022'})
                MERGE (i)-[:INVOLVES]->(e)
            """, **host)

        # 3. Create Accounts, IPs, domains
        entities = [
            {"entity_id": "svc_backup$", "name": "svc_backup$", "type": "ACCOUNT", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "admin_raj", "name": "admin_raj", "type": "ACCOUNT", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "10.0.4.47", "name": "10.0.4.47", "type": "IP", "subnet": "10.0.4.0/24", "os": "N/A", "criticality": "MEDIUM"},
            {"entity_id": "update.microsofft.com", "name": "update.microsofft.com", "type": "DOMAIN", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "185.220.101.47", "name": "185.220.101.47", "type": "IP", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"}
        ]
        for ent in entities:
            session.run("""
                MERGE (e:Entity {entity_id: $entity_id})
                SET e.name = $name,
                    e.type = $type,
                    e.subnet = $subnet,
                    e.os = $os,
                    e.criticality = $criticality,
                    e.is_compromised = true,
                    e.compromise_confidence = 0.90
            """, **ent)

        # 4. Create TTPNodes
        ttps = [
            {"technique_id": "T1078", "technique_name": "Valid Accounts", "tactic": "Initial Access", "kill_chain_stage": 1, "description": "Using valid service account credentials for initial access."},
            {"technique_id": "T1021.002", "technique_name": "SMB/Windows Admin Shares", "tactic": "Lateral Movement", "kill_chain_stage": 4, "description": "SMB sweeping and authentication using harvested credentials."},
            {"technique_id": "T1560.001", "technique_name": "Archive via Utility", "tactic": "Collection", "kill_chain_stage": 6, "description": "Staging and compressing patient data using 7z.exe utility."},
            {"technique_id": "T1490", "technique_name": "Inhibit System Recovery", "tactic": "Impact", "kill_chain_stage": 9, "description": "Deleting Volume Shadow Copies and stopping backup services."},
            {"technique_id": "T1071.001", "technique_name": "Web Protocols", "tactic": "Command and Control", "kill_chain_stage": 7, "description": "Cobalt Strike beaconing via typosquat domains over HTTPS."}
        ]
        for ttp in ttps:
            session.run("""
                MERGE (t:TTPNode {technique_id: $technique_id})
                SET t.technique_name = $technique_name,
                    t.tactic = $tactic,
                    t.kill_chain_stage = $kill_chain_stage,
                    t.description = $description
                WITH t
                MATCH (i:Incident {incident_id: 'aiims_2022'})
                MERGE (i)-[:USED_TTPS]->(t)
            """, **ttp)

        # 5. Create ThreatActor and Campaign
        session.run("""
            MERGE (a:ThreatActor {actor_id: 'apt41'})
            SET a.name = 'APT41',
                a.aliases = ['BARIUM', 'Winnti Group'],
                a.nation_state = 'State-Sponsored',
                a.target_sectors = ['Healthcare', 'Government', 'Education'],
                a.active_since = '2012',
                a.known_ttps = ['T1078', 'T1021.002', 'T1560.001', 'T1490', 'T1071.001']
        """)
        session.run("""
            MERGE (c:Campaign {campaign_id: 'camp_aiims'})
            SET c.name = 'Operation Dark Ward',
                c.actor_id = 'apt41',
                c.start_date = '2022-11-01',
                c.end_date = '2022-11-22',
                c.target_countries = ['India'],
                c.target_sectors = ['Healthcare'],
                c.ttps_used = ['T1078', 'T1021.002', 'T1560.001', 'T1490', 'T1071.001']
        """)

        # Link TTPs to Actor/Campaign
        for ttp in ttps:
            session.run("""
                MATCH (t:TTPNode {technique_id: $technique_id})
                MATCH (a:ThreatActor {actor_id: 'apt41'})
                MATCH (c:Campaign {campaign_id: 'camp_aiims'})
                MERGE (t)-[:USED_BY]->(a)
                MERGE (t)-[:PART_OF]->(c)
            """, technique_id=ttp["technique_id"])
        
        session.run("""
            MATCH (c:Campaign {campaign_id: 'camp_aiims'})
            MATCH (a:ThreatActor {actor_id: 'apt41'})
            MERGE (c)-[:ATTRIBUTED_TO]->(a)
        """)

        # 6. Relationships between entities
        # AIIMS-DC-01 runs process with svc_backup$
        session.run("""
            MATCH (dc:Entity {entity_id: 'AIIMS-DC-01'})
            MATCH (acct:Entity {entity_id: 'svc_backup$'})
            MERGE (dc)-[r:AUTHENTICATED_AS {timestamp: '2022-11-01T02:14:33+05:30'}]->(acct)
            SET r.logon_type = 3, r.success = true, r.anomalous = true
        """)
        # 10.0.4.47 connects to DC
        session.run("""
            MATCH (src:Entity {entity_id: '10.0.4.47'})
            MATCH (dc:Entity {entity_id: 'AIIMS-DC-01'})
            MERGE (src)-[r:COMMUNICATED_WITH {timestamp: '2022-11-01T02:14:33+05:30'}]->(dc)
            SET r.protocol = 'TCP', r.port = 445, r.anomalous = true
        """)
        # DC connects to C2 IP
        session.run("""
            MATCH (dc:Entity {entity_id: 'AIIMS-DC-01'})
            MATCH (c2:Entity {entity_id: '185.220.101.47'})
            MERGE (dc)-[r:COMMUNICATED_WITH {timestamp: '2022-11-12T08:01:17+05:30'}]->(c2)
            SET r.protocol = 'HTTPS', r.port = 443, r.anomalous = true
        """)

        logger.info("AIIMS 2022 scenario population complete.")

def populate_cbse_demo(driver):
    """Populate CBSE 2026 Board Exam Breach scenario idempotently."""
    with driver.session() as session:
        existing = session.run(
            "MATCH (i:Incident {incident_id: 'cbse_2026'}) RETURN count(i) as c"
        ).single()["c"]
        if existing > 0:
            logger.info("CBSE demo already populated, skipping")
            return

        logger.info("Populating CBSE 2026 scenario...")

        # 1. Create Incident
        session.run("""
            MERGE (i:Incident {incident_id: 'cbse_2026'})
            SET i.name = 'CBSE Board Exam Breach 2026',
                i.start_date = '2026-03-02',
                i.discovery_date = '2026-03-14',
                i.containment_date = '2026-03-14',
                i.dwell_time_days = 12,
                i.prevention_window_days = 12,
                i.severity = 'CRITICAL',
                i.status = 'CONTAINED',
                i.affected_entities = ['CBSE-MAIL-GW-01', 'CBSE-EXAM-PORTAL-01', 'CBSE-STUDENT-DB-01']
        """)

        # 2. Entities
        hosts = [
            {"entity_id": "CBSE-MAIL-GW-01", "name": "CBSE Mail Gateway", "type": "HOST", "subnet": "DMZ", "os": "Linux RHEL", "criticality": "MEDIUM"},
            {"entity_id": "CBSE-EXAM-PORTAL-01", "name": "CBSE Admin Exam Portal", "type": "HOST", "subnet": "10.1.5.0/24", "os": "Windows Server 2016", "criticality": "HIGH"},
            {"entity_id": "CBSE-STUDENT-DB-01", "name": "Student Registration Database Server", "type": "HOST", "subnet": "10.1.8.0/24", "os": "Windows Server 2019", "criticality": "HIGH"}
        ]
        for host in hosts:
            session.run("""
                MERGE (e:Entity {entity_id: $entity_id})
                SET e.name = $name,
                    e.type = $type,
                    e.subnet = $subnet,
                    e.os = $os,
                    e.criticality = $criticality,
                    e.is_compromised = true,
                    e.compromise_confidence = 0.90
                WITH e
                MATCH (i:Incident {incident_id: 'cbse_2026'})
                MERGE (i)-[:INVOLVES]->(e)
            """, **host)

        # 3. Attacker IPs & Domains
        entities = [
            {"entity_id": "45.142.212.100", "name": "Phishing Proxy IP (FranTech)", "type": "IP", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "cbse-results.in", "name": "cbse-results.in", "type": "DOMAIN", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "cdn.microsott-update.com", "name": "cdn.microsott-update.com", "type": "DOMAIN", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"},
            {"entity_id": "exam_admin_pankaj", "name": "exam_admin_pankaj", "type": "ACCOUNT", "subnet": "N/A", "os": "N/A", "criticality": "HIGH"}
        ]
        for ent in entities:
            session.run("""
                MERGE (e:Entity {entity_id: $entity_id})
                SET e.name = $name,
                    e.type = $type,
                    e.subnet = $subnet,
                    e.os = $os,
                    e.criticality = $criticality,
                    e.is_compromised = true,
                    e.compromise_confidence = 0.85
            """, **ent)

        # 4. TTPs
        ttps = [
            {"technique_id": "T1566.002", "technique_name": "Spearphishing Link", "tactic": "Initial Access", "kill_chain_stage": 1, "description": "Phishing email with lookalike domain link targeting exam admin."},
            {"technique_id": "T1530", "technique_name": "Data from Cloud Storage", "tactic": "Collection", "kill_chain_stage": 6, "description": "Bulk exfiltration of Class 12 board exam papers."},
            {"technique_id": "T1486", "technique_name": "Data Encrypted for Impact", "tactic": "Impact", "kill_chain_stage": 9, "description": "Ransomware encryption on student registration database."}
        ]
        for ttp in ttps:
            session.run("""
                MERGE (t:TTPNode {technique_id: $technique_id})
                SET t.technique_name = $technique_name,
                    t.tactic = $tactic,
                    t.kill_chain_stage = $kill_chain_stage,
                    t.description = $description
                WITH t
                MATCH (i:Incident {incident_id: 'cbse_2026'})
                MERGE (i)-[:USED_TTPS]->(t)
            """, **ttp)

        logger.info("CBSE 2026 scenario population complete.")

def get_attack_graph(driver, incident_id: str) -> dict:
    """Query Neo4j and format nodes/edges for ThreatGraph3D visualization."""
    nodes = []
    edges = []
    node_ids = set()

    query = """
    MATCH (i:Incident {incident_id: $incident_id})
    OPTIONAL MATCH (i)-[:INVOLVES]->(e:Entity)
    OPTIONAL MATCH (e)-[r:AUTHENTICATED_AS|COMMUNICATED_WITH|EXECUTED_PROCESS]->(target:Entity)
    RETURN e, r, target, i
    """
    with driver.session() as session:
        result = session.run(query, incident_id=incident_id)
        for record in result:
            inc_node = record["i"]
            e_node = record["e"]
            r_rel = record["r"]
            target_node = record["target"]

            # Add Incident node
            if inc_node and inc_node.element_id not in node_ids:
                nodes.append({
                    "id": inc_node["incident_id"],
                    "name": inc_node["name"],
                    "type": "INCIDENT",
                    "criticality": "CRITICAL",
                    "val": 15
                })
                node_ids.add(inc_node.element_id)

            # Add Entity nodes
            if e_node and e_node["entity_id"] not in node_ids:
                nodes.append({
                    "id": e_node["entity_id"],
                    "name": e_node["name"] or e_node["entity_id"],
                    "type": e_node["type"],
                    "subnet": e_node.get("subnet", "N/A"),
                    "os": e_node.get("os", "N/A"),
                    "criticality": e_node.get("criticality", "MEDIUM"),
                    "is_compromised": e_node.get("is_compromised", False),
                    "val": 8
                })
                node_ids.add(e_node["entity_id"])

                # Connect Incident to Entity
                edges.append({
                    "source": inc_node["incident_id"],
                    "target": e_node["entity_id"],
                    "type": "INVOLVES"
                })

            if target_node and target_node["entity_id"] not in node_ids:
                nodes.append({
                    "id": target_node["entity_id"],
                    "name": target_node["name"] or target_node["entity_id"],
                    "type": target_node["type"],
                    "subnet": target_node.get("subnet", "N/A"),
                    "os": target_node.get("os", "N/A"),
                    "criticality": target_node.get("criticality", "MEDIUM"),
                    "is_compromised": target_node.get("is_compromised", False),
                    "val": 8
                })
                node_ids.add(target_node["entity_id"])

            # Add Relationship/Edge
            if r_rel and e_node and target_node:
                edges.append({
                    "source": e_node["entity_id"],
                    "target": target_node["entity_id"],
                    "type": r_rel.type,
                    "details": {
                        "timestamp": r_rel.get("timestamp"),
                        "logon_type": r_rel.get("logon_type"),
                        "protocol": r_rel.get("protocol"),
                        "port": r_rel.get("port"),
                        "anomalous": r_rel.get("anomalous", False)
                    }
                })

    # If no data returned, fallback to a clean mock graph to ensure immediate rendering
    if not nodes:
        nodes = [
            {"id": "AIIMS-DC-01", "name": "Domain Controller", "type": "HOST", "val": 10, "is_compromised": True},
            {"id": "svc_backup$", "name": "Backup Account", "type": "ACCOUNT", "val": 8, "is_compromised": True},
            {"id": "185.220.101.47", "name": "Tor exit (185.220.101.47)", "type": "IP", "val": 8, "is_compromised": True}
        ]
        edges = [
            {"source": "AIIMS-DC-01", "target": "svc_backup$", "type": "AUTHENTICATED_AS"},
            {"source": "AIIMS-DC-01", "target": "185.220.101.47", "type": "COMMUNICATED_WITH"}
        ]

    return {"nodes": nodes, "links": edges}
