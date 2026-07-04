<div align="center">
  
# ⚔️ Attack Chain Autopsy Engine

**AI-Powered Cyber Resilience Platform for Critical National Infrastructure**

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-Graph_DB-018bff.svg?logo=neo4j&logoColor=white)](https://neo4j.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agents-orange.svg)](https://python.langchain.com/docs/langgraph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *"We don't detect attacks. We reconstruct the chain of failures that made them invisible — and prove when we would have caught them."*

<p align="center">
  <b>Built for ET AI Hackathon 2026 — Problem Statement 7</b>
</p>

</div>

---

## 📖 Table of Contents
- [The Core Differentiator](#-the-core-differentiator)
- [Architecture & Agents](#-architecture--agents)
- [Quick Start](#-quick-start)
- [Demo Scenario: AIIMS Delhi](#-demo-scenario--aiims-delhi-ransomware-2022)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Design Philosophy](#-design-philosophy)
- [Regulatory Context](#-regulatory-context)

---

## 🧬 The Core Differentiator: Retroactive Reconstruction

Most security tools ask: *"Did something bad happen right now?"*  
We ask: *"Given what we now know about this breach — when would a behavioral AI have caught it, and what would it have done?"*

**AIIMS Delhi 2022 Benchmark:** 
- **Reality:** Attackers dwell for 22 days undetected. 
- **Our Engine:** Flags Day 1, enables containment Day 3 — **saving 19 days** before ransomware deployment.

This is how you prove detection capability before buying a system. This is how you justify security investment to a hospital board. This is how you learn from breaches you survived — and from ones you didn't.

---

## 🏗️ Architecture & Agents

### System Topology
```text
┌──────────────────────────────────────────────────────────────────┐
│              5-Agent LangGraph Pipeline (StateGraph)             │
├──────────────┬────────────────┬──────────────┬───────────────────┤
│ LogIngestion │  Behavioral    │  TTP         │  Retroactive      │
│   Agent      │  Baseline      │  Attribution │  Prediction       │
│              │  Agent         │  Agent       │  Agent            │
├──────────────┴────────────────┴──────────────┴───────────────────┤
│                  Autonomous Response Agent (SOAR)                │
│       [ANTI_RANSOMWARE | C2_CONTAINMENT | ISOLATE_HOST |         │
│                     CREDENTIAL_REVOCATION]                       │
└──────────────────────────────────────────────────────────────────┘
         │                         │                  │
      FastAPI                   Neo4j             ChromaDB
   (SSE Streaming)          (Attack Graph)     (Vector Store)
         │                         │
      React 18               MITRE ATT&CK
  react-force-graph-3d        STIX Data
      Custom D3.js              LangGraph
```

### The 5 AI Agents

| Agent | File | Primary Role | Technical Detail |
|-------|------|--------------|------------------|
| **LogIngestionAgent** | `ingestion_agent.py` | Parse & Vectorize | Parses EVTX/Syslog; embeds via `text-embedding-3-small`; upserts Neo4j nodes/edges. |
| **BehavioralBaselineAgent** | `baseline_agent.py` | Profile & Score | Builds 30-day baselines; scores time/location/volume anomalies; applies 60-min correlation boost. |
| **TTAttributionAgent** | `attribution_agent.py` | Map & Attribute | Pattern-matches MITRE ATT&CK; uses Claude Sonnet 4.6 for actor attribution (e.g., APT41). |
| **RetroactivePredictionAgent** | `retroactive_agent.py` | Time Replay | Chronological log replay; calculates dynamic alerts; determines exact prevention window. |
| **AutonomousResponseAgent** | `response_agent.py` | SOAR & Audit | Executes blast-radius gated playbooks; writes cryptographically hashed SQLite audit trails. |

---

## 🚀 Quick Start

The quickest way to get the engine running is using our provided setup script.

### Prerequisites
- Docker + Docker Compose
- Python 3.11+ & Node.js 18+

### Setup Commands
```bash
# 1. Clone the repository
git clone <repo> && cd attack-chain-autopsy

# 2. Run the automated 1-click setup script
# (Prompts for API keys, downloads MITRE data, starts Neo4j, installs dependencies, and boots servers)
bash scripts/setup_demo.sh
```

**Access Points:**
- **Demo Dashboard:** [http://localhost:5173/demo](http://localhost:5173/demo)
- **API Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser:** [http://localhost:7474](http://localhost:7474)

> 🛡️ **Zero-Infra Graceful Degradation:** No internet? No API keys? The backend degrades gracefully. MITRE ATT&CK runs from stubs, ChromaDB is bypassed, and Claude Sonnet falls back to cached responses. The demo **will always run**.

---

## 🎬 Demo Scenario — AIIMS Delhi Ransomware 2022

The engine comes pre-loaded with the AIIMS Delhi incident as the centrepiece demo. Running the autopsy (`POST /api/demo/aiims/live`) triggers the live 5-agent pipeline via SSE:

| Timeline | Detection Signal | MITRE TTP | Confidence | Action Triggered |
|----------|------------------|-----------|------------|------------------|
| **Day 1** (T-21) | `svc_backup$` logs in at 02:14 AM from unknown IP `10.0.4.47` | T1078 | **73%** | Alert: Investigate account |
| **Day 3** (T-19) | SMB sweep from `AIIMS-PATIENT-MGMT-01` — 5 hosts in 4 min | T1021.002 | **81%** | **HIGH**: Isolate host + revoke creds |
| **Day 7** (T-15) | 47.3GB staged to `C:\Windows\Temp\~logs` via 7z.exe | T1560.001 | **89%** | **CRITICAL**: Block outbound + declare IR |
| **Day 12** (T-10)| Cobalt Strike beacon to `185.220.101.47` (Tor exit) | T1071.001 | **99%** | **EMERGENCY**: Sinkhole C2, CERT-In notify |
| **Day 22** (T-0) | Ransomware deployed — 284K patient records encrypted | T1486 | — | *Actual historical discovery date* |

> 🏆 **Bottom line: Detection Day 1, high-confidence Day 3, containment possible by Day 12. Actual discovery: Day 22. We save 19 days.**

---

## 📂 Project Structure

```text
attack-chain-autopsy/
├── backend/
│   ├── main.py                     # FastAPI app + SSE endpoints + orchestrator wiring
│   ├── config.py                   # Pydantic settings from .env
│   ├── models/schemas.py           # Core Pydantic data models
│   ├── graph/schema.py             # Neo4j Cypher schema + Mock data
│   ├── agents/                     # ★ THE 5 LANGGRAPH AGENTS
│   │   ├── ingestion_agent.py      
│   │   ├── baseline_agent.py       
│   │   ├── attribution_agent.py    
│   │   ├── retroactive_agent.py    
│   │   ├── response_agent.py       
│   │   └── orchestrator.py         # StateGraph orchestrator
│   ├── mitre/attck_client.py       # STIX processor
│   └── utils/anomaly_scorer.py     # Multi-factor scoring logic
├── data/synthetic/                 # AIIMS & CBSE scenario data
├── frontend/                       # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/                  # Landing + Demo pages
│       └── components/             # Timeline, 3D graph, playbook UI
├── scripts/
│   ├── setup_demo.sh               # One-shot environment bootstrap
│   └── populate_graph.py           # Neo4j data loader
└── tests/test_aiims_demo.py        # End-to-end integration suite
```

---

## 🔌 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/autopsy/run` | Run full 5-agent pipeline — **SSE stream** |
| `POST` | `/api/demo/aiims/live` | Re-run live AIIMS pipeline — **SSE stream** |
| `GET`  | `/api/demo/aiims` | Serve pre-computed AIIMS result (instant load) |
| `GET`  | `/api/graph/attack/{id}`| Fetch attack chain graph for React 3D rendering |
| `POST` | `/api/playbook/approve/{id}`| Human-in-the-loop SOAR approval gate |
| `GET`  | `/api/audit/export/{id}`| Export cryptographically hashed audit trail |

---

## 🛡️ Design Philosophy

1. **Retroactive First**: Proving detection capability on known historical breaches is infinitely more valuable than theoretical detection on unknown zero-days.
2. **Blast Radius Gates**: No autonomous action with a HIGH blast radius (e.g., VLAN isolation) executes without human approval.
3. **Evidentiary Alerting**: No black-box AI scores. Every alert natively links to specific log events, MITRE techniques, and baseline deviation metrics.
4. **CNI-Grade Reliability**: Tenacity retry logic, structlog structured logging, and graceful degradation. Built for hospitals, not just hackathons.

---

## 🏛️ Regulatory Context

- **Mandatory Reporting**: Aligned with IT Act Section 70B (April 2022 Directions) requiring incident reporting to CERT-In within 6 hours.
- **CII Protection**: Adheres to NCIIPC Critical Information Infrastructure protection guidelines.
- **Forensic Integrity**: The Playbook Executor's audit trail export is designed to meet strict forensic chain-of-custody requirements for legal admissibility.

---

<div align="center">
  <p><i>Developed for the ET AI Hackathon 2026. Code released under the MIT License.</i></p>
</div>
