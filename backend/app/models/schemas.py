from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class SourceCategory(str, Enum):
    CRM = "crm"
    EMAIL = "email"
    CALENDAR = "calendar"
    USAGE = "usage"
    SUPPORT = "support"

class ActionStatus(str, Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    RETRY_PENDING = "retry_pending"
    UNCERTAIN = "uncertain"

class ApprovalRecord(BaseModel):
    id: str
    proposal_id: str
    account_id: str
    decision: str  # approved, rejected
    reviewer: str
    decision_reason: Optional[str] = None
    content_hash: str
    version: int
    created_at: str

class RejectProposalRequest(BaseModel):
    reason: str
    reviewer: Optional[str] = "CSM User"


# Contacts
class Contact(BaseModel):
    id: str
    account_id: str
    name: str
    email: str
    role: Optional[str] = None
    is_primary: bool = False
    sentiment: Optional[str] = "neutral"
    last_contact_date: Optional[str] = None

# Signals
class Signal(BaseModel):
    id: str
    account_id: str
    source_category: str
    source_type: Optional[str] = None
    source: Optional[str] = None
    signal_id: Optional[str] = None
    evidence_id: Optional[str] = None
    signal_type: str
    event_type: Optional[str] = None
    title: str = ""
    summary: str = ""
    description: Optional[str] = None
    severity: str = "medium"
    timestamp: str = ""
    occurred_at: Optional[str] = None
    event_time: Optional[str] = None
    observed_value: Optional[Any] = None
    baseline_value: Optional[Any] = None
    unit: Optional[str] = None
    source_record_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_signal_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize ID
            sig_id = data.get("id") or data.get("signal_id") or data.get("_id")
            if sig_id:
                data["id"] = str(sig_id)
                data["signal_id"] = str(sig_id)

            # Normalize evidence_id and source_record_id
            ev_id = data.get("evidence_id") or data.get("source_record_id") or (f"ev-{sig_id}" if sig_id else "ev-sig")
            data["evidence_id"] = str(ev_id)
            data["source_record_id"] = data.get("source_record_id") or str(ev_id)

            # Normalize Source
            source = data.get("source_category") or data.get("source") or data.get("source_type") or "system"
            data["source_category"] = source
            data["source"] = source
            data["source_type"] = data.get("source_type") or source

            # Normalize Timestamp
            ts = data.get("timestamp") or data.get("occurred_at") or data.get("event_time") or datetime.utcnow().isoformat()
            data["timestamp"] = str(ts)
            data["occurred_at"] = str(ts)
            data["event_time"] = str(ts)

            # Normalize Title and Summary
            sig_type = data.get("signal_type") or data.get("event_type") or "unspecified_signal"
            data["signal_type"] = sig_type
            data["event_type"] = data.get("event_type") or sig_type

            if not data.get("title"):
                data["title"] = sig_type.replace("_", " ").title()
            if not data.get("summary"):
                data["summary"] = data.get("description") or data["title"]
            if not data.get("severity"):
                data["severity"] = "medium"

        return data

# Customer Metrics Banner
class CustomerMetrics(BaseModel):
    active_users: int
    baseline_users: int
    usage_trend: str
    usage_drop_pct: float
    recent_engagement: str
    days_since_touchpoint: int
    open_support_tickets: int
    critical_tickets: int
    days_to_renewal: int
    renewal_urgency: str
    health_score: int

# Accounts
class AccountBase(BaseModel):
    id: str
    name: str
    domain: Optional[str] = None
    arr: float = Field(..., description="Annual Recurring Revenue in USD")
    renewal_date: str = Field(..., description="ISO 8601 date string YYYY-MM-DD")
    csm_owner: str
    industry: Optional[str] = None
    health_score: Optional[int] = None
    tier: Optional[str] = "Standard"
    status: Optional[str] = "active"

class AccountRiskSummary(AccountBase):
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100, description="Deterministic risk score 0-100")
    urgency_days_to_renewal: int
    urgency_label: Optional[str] = None
    primary_reason_code: str
    main_warning: Optional[str] = None
    contributing_factors: List[str] = []

class AccountDetail(AccountRiskSummary):
    contacts: List[Contact] = []
    signals: List[Signal] = []
    customer_metrics: Optional[CustomerMetrics] = None

class AccountRiskDetail(BaseModel):
    account_id: str
    account_name: str
    risk_score: int
    risk_level: RiskLevel
    urgency_days_to_renewal: int
    urgency_label: str
    primary_reason_code: str
    main_warning: str
    contributing_factors: List[str]
    rule_version: str = "v1.0.0"
    signals_count: int
    arr: float
    renewal_date: str

class DashboardSummary(BaseModel):
    total_accounts_monitored: int
    high_risk_accounts_count: int
    renewals_due_soon_count: int
    high_risk_arr: float
    total_portfolio_arr: float
    average_risk_score: float
    rule_version: str = "v1.0.0"

# Evidence
class EvidenceRecord(BaseModel):
    id: str = Field(..., description="Unique evidence ID, e.g. EVID-101")
    account_id: str
    source_category: SourceCategory
    title: str
    summary: str
    timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_reference: Optional[str] = None

# Page 4: Revenue Risk Autopsy & Structured Investigation
class InvestigationFinding(BaseModel):
    claim: str
    evidence_ids: List[str] = []
    type: str = "observed_fact"  # observed_fact, causal_link, risk_trigger
    severity: Optional[str] = "high"

class RecommendedAction(BaseModel):
    type: str = "customer_check_in"
    action_type: Optional[str] = "csm_outreach_email"
    title: str
    reason: str
    target_recipient: Optional[str] = None
    suggested_payload: Dict[str, Any] = Field(default_factory=dict)

class Investigation(BaseModel):
    id: str
    account_id: str
    account_name: str
    risk_summary: str
    risk_score: int
    risk_level: RiskLevel
    primary_reason_code: str
    findings: List[InvestigationFinding]
    causal_explanation: str
    uncertainties: List[str]
    recommended_action: RecommendedAction
    rule_version: str = "v1.0.0"
    created_at: str

class AskAccountQuestionRequest(BaseModel):
    question: str

class AskAccountQuestionResponse(BaseModel):
    account_id: str
    question: str
    answer: str
    cited_evidence_ids: List[str] = []
    confidence: str = "high"
    uncertainties: List[str] = []

# Page 5: Next-Best-Action Copilot & Proposal Gate
class EmailDraftItem(BaseModel):
    recipient: str
    recipient_name: Optional[str] = None
    subject: str
    body: str
    reason: str
    evidence_ids: List[str] = []

class ProposedTask(BaseModel):
    id: Optional[str] = None
    account_id: str
    title: str
    description: str
    assigned_to: str
    due_date: str
    priority: str = "high"  # high, medium, low
    status: str = "proposed"  # proposed, pending, in_progress, completed
    evidence_ids: List[str] = []
    created_at: Optional[str] = None

class ProposedCRMUpdate(BaseModel):
    field_name: str
    current_value: str
    proposed_value: str
    reason: str
    evidence_ids: List[str] = []

class HistoryAwareContext(BaseModel):
    account_id: str
    previous_actions_count: int = 0
    previous_actions: List[Dict[str, Any]] = Field(default_factory=list)
    similar_situations_from_other_accounts: List[Dict[str, Any]] = Field(default_factory=list)
    unresolved_commitments: List[Dict[str, Any]] = Field(default_factory=list)
    days_since_last_followup: Optional[int] = None
    preferable_to_repeating_reason: str = ""
    confidence_score: float = 0.85
    confidence_justification: str = ""
    historical_examples_supporting: int = 0
    supporting_evidence_ids: List[str] = Field(default_factory=list)

class DraftActionsResponse(BaseModel):
    account_id: str
    account_name: str
    investigation_id: Optional[str] = None
    email_draft: EmailDraftItem
    task_draft: ProposedTask
    crm_update: ProposedCRMUpdate
    history_aware_context: Optional[HistoryAwareContext] = None
    created_at: str

class CreateActionProposalRequest(BaseModel):
    account_id: str
    action_type: str = Field(..., description="csm_email, crm_update, task_create")
    title: str
    reason: Optional[str] = None
    payload: Dict[str, Any]
    evidence_ids: List[str] = []
    investigation_id: Optional[str] = None

class PatchActionProposalRequest(BaseModel):
    title: Optional[str] = None
    reason: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    status: Optional[ActionStatus] = None

# Proposals & Approval
class ActionProposal(BaseModel):
    id: str
    account_id: str
    action_type: str = Field(..., description="e.g., csm_email, crm_update, task_create")
    title: str
    reason: Optional[str] = None
    investigation_id: Optional[str] = None
    evidence_ids: List[str] = []
    payload: Dict[str, Any] = Field(..., description="Parameters, e.g. recipient, subject, body, or task/crm data")
    status: ActionStatus = ActionStatus.PROPOSED
    version: int = 1
    content_hash: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    execution_result: Optional[Dict[str, Any]] = None

# Autopsy model
class RevenueRiskAutopsy(BaseModel):
    account_id: str
    risk_score: int
    risk_level: RiskLevel
    rule_version: str
    facts: List[Dict[str, Any]] = Field(..., description="Evidence-backed facts with evidence_id")
    interpretations: List[str] = Field(..., description="Derived context or hypothesis")
    unknowns: List[str] = Field(..., description="Missing signals or unknowns")
    suggested_action_type: str

# Page 7: Settings and Integrations
class IntegrationStatus(str, Enum):
    CONNECTED = "connected"
    SYNCING = "syncing"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"

class IntegrationMode(str, Enum):
    LIVE = "live"
    SIMULATED = "simulated"

class IntegrationConnector(BaseModel):
    id: str
    name: str
    category: str  # crm, email, calendar, usage, support, database
    provider: str  # Salesforce, HubSpot, Gmail, Google Calendar, Mixpanel, Zendesk, MongoDB
    status: IntegrationStatus
    mode: IntegrationMode
    is_real_connector: bool = False
    endpoint_or_host: Optional[str] = None
    last_sync_time: str
    records_synced: int
    data_freshness_status: str  # fresh, stale_warning, delayed
    freshness_minutes: int
    freshness_warning: Optional[str] = None
    config_details: Dict[str, Any] = Field(default_factory=dict)

class SyncRunRecord(BaseModel):
    id: str
    integration_id: str
    provider: str
    status: str  # success, in_progress, failed
    records_ingested: int
    records_updated: int
    duration_ms: int
    started_at: str
    completed_at: Optional[str] = None
    mode: IntegrationMode = IntegrationMode.SIMULATED
    log_message: str

class TriggerSyncResponse(BaseModel):
    integration_id: str
    status: str
    sync_run_id: str
    message: str
    last_sync_time: str
    freshness_minutes: int

# Audit Log Schema
class AuditLog(BaseModel):
    account_id: str
    proposal_id: Optional[str] = None
    event_type: str
    actor: str
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str

# Task Management Schemas
class CreateTaskRequest(BaseModel):
    account_id: str
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = "CSM Owner"
    due_date: Optional[str] = None
    priority: Optional[str] = "high"
    evidence_ids: List[str] = []

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

# Feature 1: Action & Outcome Tracker Schemas
class ActionExecutionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EXECUTING = "executing"
    EXECUTED = "executed"
    FAILED = "failed"

class WorkStatus(str, Enum):
    NOT_STARTED = "not started"
    IN_PROGRESS = "in progress"
    COMPLETED = "completed"

class OutcomeRecord(BaseModel):
    outcome_id: str
    action_tracker_id: str
    notes: str
    customer_response: str  # notes or sentiment on customer reaction
    commitments: str  # agreed commitments made by customer or CSM
    next_steps: str  # follow-up items
    supporting_evidence_ids: List[str] = []
    recorded_by: str = "CSM Lead"
    recorded_at: str
    auto_captured: bool = False
    capture_source: Optional[str] = None  # e.g., "Gmail Integration", "Salesforce CRM Sync", "Google Calendar"

class ActionTrackerItem(BaseModel):
    id: str
    proposal_id: Optional[str] = None
    account_id: str
    account_name: str
    action_type: str
    title: str
    description: Optional[str] = None
    investigation_id: Optional[str] = None
    evidence_ids: List[str] = []
    recommendation_payload: Dict[str, Any] = Field(default_factory=dict)
    action_status: ActionExecutionStatus = ActionExecutionStatus.APPROVED
    work_status: WorkStatus = WorkStatus.NOT_STARTED
    assigned_to: str = "CSM Team"
    execution_mode: str = "simulated"
    execution_result: Optional[Dict[str, Any]] = None
    outcome: Optional[OutcomeRecord] = None
    auto_capture_available: bool = False
    auto_capture_preview: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: Optional[str] = None

class CreateActionTrackerRequest(BaseModel):
    account_id: str
    title: str
    action_type: str
    proposal_id: Optional[str] = None
    description: Optional[str] = None
    investigation_id: Optional[str] = None
    evidence_ids: List[str] = []
    recommendation_payload: Dict[str, Any] = Field(default_factory=dict)
    action_status: Optional[ActionExecutionStatus] = ActionExecutionStatus.APPROVED
    work_status: Optional[WorkStatus] = WorkStatus.NOT_STARTED
    assigned_to: Optional[str] = "CSM Team"

class UpdateActionTrackerStatusRequest(BaseModel):
    action_status: Optional[ActionExecutionStatus] = None
    work_status: Optional[WorkStatus] = None
    assigned_to: Optional[str] = None

class SaveOutcomeRequest(BaseModel):
    notes: str
    customer_response: str
    commitments: str
    next_steps: str
    recorded_by: Optional[str] = "CSM Lead"
    supporting_evidence_ids: List[str] = []
    auto_captured: bool = False
    capture_source: Optional[str] = None

class AutoCaptureOutcomeRequest(BaseModel):
    source: Optional[str] = None

# Feature 4: Outcome Intelligence Schemas
class ActionTypeResponseStat(BaseModel):
    action_type: str
    action_type_label: str
    total_dispatched: int
    responses_received: int
    response_rate_pct: float
    avg_response_hours: float
    benchmark_verdict: str  # High Impact, Moderate, Passive

class TimelinessMetric(BaseModel):
    total_completed: int
    completed_on_time: int
    on_time_rate_pct: float
    overdue_count: int
    avg_completion_days: float

class CustomerBlocker(BaseModel):
    blocker_id: str
    category: str
    description: str
    affected_accounts_count: int
    affected_account_names: List[str]
    unresolved: bool
    first_observed: str
    last_touchpoint: str
    severity: str  # critical, high, medium
    recommended_remedy: str

class ActionSignalAssociation(BaseModel):
    action_type: str
    action_type_label: str
    positive_subsequent_signals_count: int
    neutral_or_no_change_count: int
    negative_subsequent_signals_count: int
    success_rate_pct: float
    observed_impact_summary: str

class LearnedPattern(BaseModel):
    pattern_id: str
    title: str
    condition: str
    recommended_strategy: str
    ineffective_strategy: str
    historical_examples_count: int
    success_confidence_pct: float
    cited_account_ids: List[str]
    empirical_evidence_summary: str

class OutcomeIntelligenceReport(BaseModel):
    total_historical_actions: int
    overall_response_rate_pct: float
    on_time_completion_pct: float
    unresolved_blockers_count: int
    positive_outcome_pct: float
    action_type_stats: List[ActionTypeResponseStat]
    timeliness: TimelinessMetric
    unresolved_blockers: List[CustomerBlocker]
    action_signal_associations: List[ActionSignalAssociation]
    learned_patterns: List[LearnedPattern]
    generated_at: str

