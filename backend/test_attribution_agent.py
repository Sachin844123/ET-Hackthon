import asyncio
import os
import sys

from dotenv import load_dotenv

# Try to load .env from current directory
load_dotenv(dotenv_path='.env')

from backend.agents.attribution_agent import TTAttributionAgent
from backend.models.schemas import AnomalyScore, SecurityEvent

# Mock MITRE client to avoid needing internet or database
class MockMitreClient:
    def get_technique(self, technique_id: str) -> dict:
        return {
            "name": f"Mock Technique {technique_id}",
            "tactic": "Mock Tactic",
            "kill_chain_stage": 1
        }

async def run_test():
    print("Initializing TTAttributionAgent with Groq...")
    
    # Force Groq as the provider for testing
    os.environ["LLM_PROVIDER"] = "groq"
    
    # Check for API key
    if not os.getenv("GROQ_API_KEY"):
        print("ERROR: GROQ_API_KEY not found in environment!")
        sys.exit(1)
        
    def progress_cb(stage, status, message, pct):
        print(f"[PROGRESS {pct}%] {message}")

    agent = TTAttributionAgent(
        neo4j_driver=None, 
        mitre_client=MockMitreClient(),
        progress_callback=progress_cb
    )
    
    print("Agent initialized successfully.")
    print(f"Provider selected: {agent._llm_provider}")
    print(f"LLM Client configured: {type(agent._llm_client).__name__}")
    
    # Create mock data that triggers the LLM logic
    print("\nCreating synthetic security events...")
    events = [
        SecurityEvent(
            event_id="evt_001",
            timestamp="2026-07-05T10:00:00Z",
            event_type="network",
            source_ip="185.220.101.47",
            destination_ip="10.0.0.5",
            source_entity="",
            dest_entity="",
            raw_log="",
            user_account="svc_backup$",
            risk_indicators=["periodic_beaconing", "known_bad_ip", "off_hours"],
            parsed_fields={"command_line": "ping 8.8.8.8 -n 1000", "process_name": "cmd.exe"}
        ),
        SecurityEvent(
            event_id="evt_002",
            timestamp="2026-07-05T10:05:00Z",
            event_type="process",
            source_ip="10.0.0.5",
            source_entity="",
            dest_entity="",
            raw_log="",
            user_account="svc_backup$",
            risk_indicators=["7z.exe", "large_file_write", "staging"],
            parsed_fields={"command_line": "7z a archive.zip C:\\SensitiveData", "process_name": "7z.exe"}
        )
    ]
    
    anomalies = [
        AnomalyScore(
            event_id="evt_001", 
            score=0.89, 
            anomaly_type="C2 Beaconing", 
            features_contributing=["periodic_beaconing"],
            entity_id="10.0.0.5",
            severity="high",
            threshold_breached=True
        ),
        AnomalyScore(
            event_id="evt_002", 
            score=0.92, 
            anomaly_type="Data Staging", 
            features_contributing=["large_file_write"],
            entity_id="10.0.0.5",
            severity="critical",
            threshold_breached=True
        )
    ]
    
    print("\nRunning map_anomalies_to_ttps (This will invoke Groq)...")
    try:
        results = await agent.map_anomalies_to_ttps(anomalies, events)
        print("\n=== AGENT EXECUTION SUCCESSFUL ===")
        print(f"Total TTPs Attributed: {len(results)}")
        for r in results:
            print(f" - {r.technique_id} ({r.technique_name}) | Confidence: {r.confidence}")
    except Exception as e:
        print(f"\n=== AGENT EXECUTION FAILED ===")
        print(str(e))

if __name__ == "__main__":
    asyncio.run(run_test())
