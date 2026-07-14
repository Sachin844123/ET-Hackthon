# 🧠 PROJECT BRAIN — Attack Chain Autopsy Engine
### ET AI Hackathon 2026 | Problem Statement 7

> **RULE FOR ANY AI AGENT READING THIS:** This file is ground truth. Before touching
> any code, read this fully. After finishing any task, update the relevant section
> below — especially "Current Build State" and "Locked Constants." If something you
> observe in the actual code contradicts this file, the CODE wins for implementation
> details, but STOP and flag the mismatch — don't silently pick one.

**Last updated:** 2026-07-04 (Day 0 — planning complete, no code written yet)
**Updated by:** Planning session (Claude, chat)

---

## 1. What This Project Is

Name: **Attack Chain Autopsy Engine**
Built for: ET AI Hackathon 2026, Problem Statement 7 (AI-Driven Cyber Resilience for
Critical National Infrastructure)
Team size: Solo (Sachin)
Deadline: 20 days from kickoff

**One-line pitch:** Given a cyberattack's logs, reconstruct the full chain of
behavioral signals that reveal it — and prove exactly how many days earlier it
would have been caught, mapped to MITRE ATT&CK, with autonomous response playbooks.

**Primary demo:** AIIMS Delhi ransomware attack, Nov 2022. 22-day dwell time.
System proves detection possible by Day 3.

**Secondary demo:** CBSE 2026 attack scenario (different pattern — phishing →
exfiltration, not ransomware — used to show generality).

**Why this problem was chosen over others:** Sachin has 3+ years of CTF/HTB/red team
background. Lower competitor density than industrial/RAG-chatbot problem statements.
Domain authenticity is the actual competitive moat here — not the code, the fact that
the builder can speak fluently about MITRE sub-techniques, C2 jitter, lateral movement
under judge questioning.

---

## 2. Locked Constants — NEVER CHANGE THESE WITHOUT UPDATING THIS FILE

If any agent changes these values in code, this file MUST be updated in the same
task, or every other agent session will build on stale numbers and the demo breaks.

### Anomaly Scoring Formula (exact)
```
anomaly_score = (time_deviation × 0.3) + (location_deviation × 0.25) +
                (behavior_deviation × 0.25) + (volume_deviation × 0.2)

risk_multiplier = 1.0 + (0.5 × known_ttp_match) + (0.3 × peer_anomaly_correlation)

final_score = min(anomaly_score × risk_multiplier, 1.0)

Thresholds: >0.6 WATCH | >0.75 ALERT | >0.90 CRITICAL
```
⚠️ known_ttp_match constant is 0.5, NOT 0.2. This was caught and fixed once already —
if you see 0.2 anywhere in code, it's a bug, fix it to 0.5.

### AIIMS Demo Timeline (the numbers the whole demo is built around)
| Day | Confidence | MITRE Technique | Event |
|---|---|---|---|
| Day 1 (T-21) | 0.73 | T1078 (Valid Accounts) | svc_backup$ logs in at 02:14 UTC, baseline is 09:00-18:00 |
| Day 3 (T-19) | 0.81 | T1021.002 (SMB/Admin Shares) | AIIMS-PATIENT-MGMT-01 scans subnet on port 445 |
| Day 7 (T-15) | 0.94 | T1560.001 (Archive Collected Data) | 47GB staged via 7z.exe, unusual parent process |
| Day 12 (T-10) | 0.99 | T1071.001 (Web Protocols C2) | DNS beacon to update.microsofft.com, 300s±45s jitter, resolves to Tor exit node 185.220.101.47 |
| Day 22 (T-0) | — | T1486 (Data Encrypted for Impact) | Ransomware deployed. Actual discovery point. |

**The headline stat: 19 days of advance warning that was missed (Day 3 high-confidence
detection vs Day 22 actual discovery).** This exact number appears in the pitch, the
deck, and the UI summary bar. Do not let any agent "improve" the dataset in a way that
changes this number without updating this file and the deck.

### Threat Actor Reference (used in TTAttributionAgent prompt)
- SideWinder: T1566, T1078 — targets government/military
- Transparent Tribe: T1204, T1055 — targets defense/education
- Lazarus Group: T1078, T1021.002, T1560.001, T1071.001 — ransomware, healthcare/finance
- APT40: T1190, T1021 — targets maritime/research

AIIMS scenario is designed to attribute to **Lazarus Group** pattern (matches their
known TTP combination). This should come out of the attribution agent naturally if
the synthetic data is built correctly — don't force it, but if it comes out completely
different, flag it, don't just accept it.

---

## 3. Decisions Already Made (don't re-litigate these)

| Decision | Choice | Why |
|---|---|---|
| Demo endpoint behavior | **Hybrid**: `/api/demo/aiims` serves pre-cached result instantly. `/api/demo/aiims/live` re-runs the real pipeline for a bonus "watch it think" moment. | Zero risk by default, optional flex during Q&A. User explicitly chose this over pure-cached or pure-live. |
| Graph population | Idempotent via `MERGE`, guarded by existing-node check | Prevents duplicate nodes if setup script runs twice during dev |
| Health check | Must verify MITRE technique count > 500, not just Neo4j connectivity | A connected-but-empty graph looks healthy but demo will fail |
| Agent timeout | 30s per agent step in `/api/autopsy/run`, degrade gracefully | Live demo must never hang in front of judges |
| Claude fallback (live endpoint only) | Cache Agent 3's exact attribution response for AIIMS; use as fallback if API rate-limited | Cached demo endpoint doesn't need this; live endpoint does |
| Tech stack | FastAPI + Neo4j + ChromaDB + LangGraph + Claude Sonnet + React/Vite/Tailwind | Fixed, don't swap components mid-build unless something is truly broken |
| Anomaly formula constants | 0.5 (ttp_match), 0.3 (peer_correlation), weights 0.3/0.25/0.25/0.2 | Locked — see Section 2 |

---

## 4. Current Build State

**Status as of last update: BACKEND COMPLETE + FRONTEND UI COMPLETE (2026-07-11)**
**Updated by:** Antigravity agent session

Completed so far:
- [x] Problem statement selected (PS7 — Cyber Resilience)
- [x] Concept designed (Attack Chain Autopsy — retroactive reconstruction)
- [x] Full plan.md written
- [x] Full mega-prompt written
- [x] Section 2 (backend foundation) — COMPLETE
- [x] Section 3 (5 LangGraph agents) — COMPLETE
- [x] FastAPI backend with SSE streaming, Neo4j, ChromaDB — COMPLETE
- [x] Anomaly scorer verified: known_ttp_match=0.5 ✓ (cross-checked against Section 2)
- [x] Section 4 (React frontend — all 5 tabs + Landing) — COMPLETE
  - [x] Landing.jsx — 2-col hero, boot sequence, workspace card with KillChainNode, ThreatFeedItem
  - [x] Demo.jsx — sidebar icon rail, SystemControllerPanel, cached load on mount, all 5 tabs
  - [x] AttackChainTimeline.jsx — attribution bar, green prevention banner, 9 stages, stat strip
  - [x] AttackPathDiagram.jsx (NEW) — SVG structured flow diagram, 3 paths, day slider, MITRE names
  - [x] RetroactiveTimeline.jsx — ransomware banner, horizontal scale, reconstruction summary, alert rows
  - [x] PlaybookExecutor.jsx — category filter, empty state, playbook cards, bottom audit bar
  - [x] ThreatIntelPanel.jsx — attribution ring, TTP forecast (MITRE names resolved), CERT-IN directives, feed
  - [x] useMitreLookup.js hook — module-level cache, /api/mitre/technique/{id}, offline stubs
  - [x] KillChainNode.jsx, ThreatFeedItem.jsx, SystemControllerPanel.jsx — shared components
  - [x] constants/killChain.js, constants/threatFeed.js — single source of truth
  - [x] ThreatGraph3D.jsx archived → _ThreatGraph3D.jsx.bak (superseded by AttackPathDiagram)
- [ ] Section 5 (deck + demo script) — IN PROGRESS
- [ ] Section 6 (tests + setup script) — NOT STARTED

---

## 5. File Map (update as files get created)

```
attack-chain-autopsy/
├── brain.md                          ← THIS FILE. Always read first.
├── backend/
│   ├── config.py                     [NOT CREATED] Settings via pydantic-settings
│   ├── main.py                       [NOT CREATED] FastAPI app, all routes
│   ├── graph/
│   │   └── schema.py                 [NOT CREATED] Neo4j constraints + populate fns
│   ├── models/
│   │   └── schemas.py                [NOT CREATED] Pydantic models
│   ├── utils/
│   │   ├── log_parsers.py            [NOT CREATED] Windows/syslog/netflow/dns parsers
│   │   └── anomaly_scorer.py         [NOT CREATED] AnomalyScorer class, locked formula
│   └── agents/
│       ├── log_ingestion_agent.py    [NOT CREATED]
│       ├── behavioral_baseline_agent.py  [NOT CREATED]
│       ├── ttp_attribution_agent.py  [NOT CREATED]
│       ├── retroactive_prediction_agent.py  [NOT CREATED]
│       ├── autonomous_response_agent.py  [NOT CREATED]
│       └── orchestrator.py           [NOT CREATED]
├── frontend/
│   └── src/
│       ├── components/               [NOT CREATED] 7 components, see megaprompt Section 4
│       └── pages/Demo.jsx            [NOT CREATED]
├── data/
│   ├── synthetic/aiims_attack/       [NOT CREATED] baseline + attack logs + ground_truth.json
│   ├── synthetic/cbse_attack/        [NOT CREATED]
│   ├── cache/aiims_result.json       [NOT CREATED] pre-computed cache for cached demo endpoint
│   └── mitre_attack/                 [NOT CREATED] downloaded STIX bundle
├── tests/
│   └── test_aiims_demo.py            [NOT CREATED]
├── scripts/
│   ├── setup_demo.sh                 [NOT CREATED]
│   └── download_mitre_attack.py      [NOT CREATED]
├── requirements.txt                  [NOT CREATED]
├── package.json                      [NOT CREATED]
├── docker-compose.yml                [NOT CREATED]
└── .env.example                      [NOT CREATED]
```

---

## 6. Known Fragile Areas / Do Not Touch Without Care

- **AIIMS timeline numbers (Section 2 of this doc)** — the entire pitch, deck, and demo
  hinges on Day 3 = 81% and Day 12 = 99%. If synthetic data changes, these must be
  re-validated, and the deck/pitch script must be checked for consistency.
- **`known_ttp_match` constant is 0.5** — was wrongly written as 0.2 in an earlier
  draft. Any agent regenerating `anomaly_scorer.py` from scratch should double check
  against Section 2 of this file, not from memory of "similar" formulas.
- **`/api/demo/aiims` vs `/api/demo/aiims/live`** — these are two different endpoints
  with two different jobs. Don't merge them or make one redirect to the other.
- **Neo4j population must be idempotent** — any new populate function must check for
  existing data first (see Section 3 decisions table).

---

## 7. Open Questions / Not Yet Decided

- Exact CBSE 2026 scenario details are less fleshed out than AIIMS — if an agent needs
  to build the CBSE synthetic dataset and specifics aren't in the megaprompt, treat
  AIIMS as the priority and CBSE as "good enough to demonstrate generality," not
  pixel-perfect.
- Whether to deploy anywhere beyond localhost for the hackathon demo — currently
  assumed to be a local Docker + localhost demo only, no cloud deployment planned.

---

## 8. How to Use This File Across AI Tools

1. **Starting a new session in any tool** (Claude Code, ChatGPT, Cursor, etc.) —
   paste this file first, or point the agent to read it before doing anything.
2. **After the agent does meaningful work** — ask it to update Section 4 (Build State)
   and Section 5 (File Map) before ending the session. Don't let this drift.
3. **If two agents disagree** (e.g., one used 0.2, another used 0.5 for ttp_match) —
   this file is the tiebreaker. Section 2 numbers are correct.
4. **Weekly (or after each major section)** — re-read this whole file yourself and
   confirm it still matches reality. AI agents will forget to update it perfectly.

---

*brain.md v1.0 — Day 0, planning complete, zero code written.*