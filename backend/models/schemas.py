from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Optional, Dict, List

class SecurityEvent(BaseModel):
    event_id: str
    timestamp: str
    event_type: str
    source_entity: str
    dest_entity: str
    raw_log: str
    parsed_fields: Dict[str, Any] = Field(default_factory=dict)
    anomaly_score: float = 0.0
    risk_indicators: List[str] = Field(default_factory=list)
    mitre_technique_id: Optional[str] = None

class Baseline(BaseModel):
    entity_id: str
    entity_type: str
    auth_hours: List[int] = Field(default_factory=list)  # typical hours 0-23
    typical_source_ips: List[str] = Field(default_factory=list)
    typical_destinations: List[str] = Field(default_factory=list)
    typical_ports: List[int] = Field(default_factory=list)
    avg_daily_connections: float = 0.0
    avg_bytes_per_session: float = 0.0
    computed_at: datetime = Field(default_factory=datetime.utcnow)

class AnomalyScore(BaseModel):
    event_id: str
    entity_id: str
    score: float  # 0.0 - 1.0
    contributing_factors: List[Dict[str, Any]] = Field(default_factory=list)
    severity: str  # CRITICAL/HIGH/MEDIUM/LOW/INFO
    threshold_breached: bool

class TTPAttribution(BaseModel):
    technique_id: str
    technique_name: str
    tactic: str
    kill_chain_stage: int  # 1-9
    confidence: float
    matching_behaviors: List[str] = Field(default_factory=list)
    evidence_events: List[str] = Field(default_factory=list)  # event_ids

class ThreatActorAttribution(BaseModel):
    actor_name: str
    actor_id: str
    confidence: float
    ttp_overlap_count: int
    campaign_match: Optional[str] = None
    predicted_next_ttps: List[str] = Field(default_factory=list)
    recommended_defensive_actions: List[str] = Field(default_factory=list)

class RetroactiveAlert(BaseModel):
    alert_id: str
    timestamp_absolute: datetime
    time_before_incident: str  # "T-19 days", "T-10 days"
    days_before_incident: int
    confidence: float
    alert_type: str
    mitre_technique_id: str
    description: str
    evidence: List[str] = Field(default_factory=list)
    recommended_action: str
    would_have_prevented_breach: bool
    containment_action: Optional[str] = None

class PlaybookAction(BaseModel):
    action_type: str  # ISOLATE_HOST|REVOKE_CRED|BLOCK_IP|SNAPSHOT_VM
    target_entity: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    status: str
    timestamp: datetime
    reversible: bool
    audit_log_entry: str

class PlaybookExecution(BaseModel):
    execution_id: str
    playbook_name: str
    triggered_by_alert_id: str
    blast_radius: str  # LOW|MEDIUM|HIGH
    requires_approval: bool
    actions: List[PlaybookAction] = Field(default_factory=list)
    status: str  # EXECUTED|PENDING_APPROVAL|ROLLED_BACK|FAILED
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)

class AutopsyResult(BaseModel):
    autopsy_id: str
    incident_id: str
    incident_name: str
    run_timestamp: datetime
    mode: str  # RETROACTIVE|LIVE
    dwell_time_days: Optional[int] = None
    earliest_detectable_signal: Optional[str] = None
    prevention_window_days: Optional[int] = None
    retroactive_alerts: List[RetroactiveAlert] = Field(default_factory=list)
    ttp_attributions: List[TTPAttribution] = Field(default_factory=list)
    actor_attribution: Optional[ThreatActorAttribution] = None
    playbook_executions: List[PlaybookExecution] = Field(default_factory=list)
    kill_chain_coverage: Dict[str, bool] = Field(default_factory=dict)  # stage_name: bool
    graph_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    graph_edges: List[Dict[str, Any]] = Field(default_factory=list)
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)

class IncidentInput(BaseModel):
    incident_id: Optional[str] = None
    name: str
    description: str
    affected_hosts: List[str] = Field(default_factory=list)
    timeframe_start: datetime
    timeframe_end: datetime
    mode: str = "RETROACTIVE"  # RETROACTIVE|LIVE
