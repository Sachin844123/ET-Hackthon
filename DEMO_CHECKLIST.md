# Attack Chain Autopsy Engine — Demo Checklist

## T-60 minutes:
- [ ] All services running: backend (8000), frontend (5173), Neo4j (7474)
- [ ] Health check: `GET /health` returns all green
- [ ] AIIMS scenario loaded: `GET /api/graph/entities` returns >= 8 entities
- [ ] Full test suite passing: `pytest tests/ -v` → all green
- [ ] Demo endpoint warm: `GET /api/demo/aiims` runs in <10 seconds (cached)
- [ ] Backup: demo video recorded and ready to play if live breaks

## T-15 minutes:
- [ ] Browser on http://localhost:5173/demo
- [ ] AIIMS scenario pre-selected in dropdown
- [ ] Right panel on KILL CHAIN tab
- [ ] Presentation deck open on second screen (slide 5 ready — LIVE DEMO slide)
- [ ] Demo script printed and face-up

## During demo:
- [ ] Click **RUN AUTOPSY** — don't explain while loading, let the progress bar speak
- [ ] Point to **Day 1 T-21d alert FIRST** — this is your hook ("Day 1, 02:14 AM")
- [ ] Say technique ID out loud: "T1078 — Valid Accounts" (shows domain knowledge)
- [ ] Time slider on Attack Graph to Day 3 — most visual moment
- [ ] Playbook tab — point to CREDENTIAL_REVOCATION auto-executed in 0.3 seconds
- [ ] End with the 19-day prevention window — close on that number

## If demo breaks:
- [ ] Switch to pre-recorded video immediately — no apology, no explanation
- [ ] "Let me show you the full run we captured earlier"
- [ ] Continue with slide deck naturally

## Judge questions — have these answers ready:
- [ ] **"How is this different from Splunk?"**
   → *"SIEMs match signatures. We baseline behavior. APTs evade signatures by design."*
- [ ] **"How do you handle false positives?"**
   → *"Compound scoring — single anomaly scores 0.3. Three correlated = 0.9+. Blast radius gates prevent auto-action on low confidence."*
- [ ] **"Is this applicable to Indian CNI?"**
   → *"Yes — CERT-In advisories loaded, SideWinder and APT41 TTPs pre-mapped, CBSE 2026 scenario is a second demo ready to run."*
- [ ] **"End-of-life infrastructure?"**
   → *"Log forwarding only — no agent on protected system. Works on Windows XP."*
