from __future__ import annotations
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
    SLACK = "slack"
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
    is_simulated: bool = False
    mode: str = "live"

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
    crm_status: Optional[str] = None
    forecast_status: Optional[str] = None
    last_crm_update: Optional[str] = None
    last_crm_updated_by: Optional[str] = None

class AccountRiskSummary(AccountBase):
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100, description="Deterministic risk score 0-100")
    classification: Optional[str] = Field(default="healthy", description="Classification: healthy, needing_attention, high_risk")
    urgency_days_to_renewal: int
    urgency_label: Optional[str] = None
    primary_reason_code: str
    main_warning: Optional[str] = None
    contributing_factors: List[str] = []
    investigation_triggered: bool = False
    display_churn_probability: bool = False

class AccountDetail(AccountRiskSummary):
    contacts: List[Contact] = []
    signals: List[Signal] = []
    customer_metrics: Optional[CustomerMetrics] = None
    feedback_records: List[CustomerFeedbackRecord] = Field(default_factory=list)

class AccountRiskDetail(BaseModel):
    account_id: str
    account_name: str
    risk_score: int
    risk_level: RiskLevel
    classification: str = "healthy"  # healthy, needing_attention, high_risk
    urgency_days_to_renewal: int
    urgency_label: str
    primary_reason_code: str
    main_warning: str
    contributing_factors: List[str]
    rule_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    compound_rules_triggered: List[str] = Field(default_factory=list)
    investigation_triggered: bool = False
    investigation_trigger_reason: Optional[str] = None
    investigation_id: Optional[str] = None
    churn_probability: Optional[float] = None
    display_churn_probability: bool = False
    churn_probability_disclaimer: str = (
        "SignalBridge AI strictly avoids presenting speculative churn percentage probabilities without validated statistical modeling. "
        "Prioritization is guided by transparent, reproducible deterministic risk rules."
    )
    statistical_confidence: str = "high"
    rule_version: str = "v2.1.0"
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
    is_simulated: bool = False
    mode: str = "live"

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
    situation_summary: Optional[str] = None
    risk_score: int
    risk_level: RiskLevel
    primary_reason_code: str
    findings: List[InvestigationFinding]
    observed_facts: List[InvestigationFinding] = Field(default_factory=list)
    interpretations: List[Dict[str, Any]] = Field(default_factory=list)
    causal_explanation: str
    uncertainties: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    alternative_explanations: List[str] = Field(default_factory=list)
    recommended_action: RecommendedAction
    rule_version: str = "v2.1.0"
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
    objective: Optional[str] = None  # Task D: Specific operational objectives
    description: str
    assigned_to: str
    due_date: str
    deadline: Optional[str] = None   # Task D: Explicit strategic deadline
    priority: str = "high"  # high, medium, low
    status: str = "proposed"  # proposed, pending, in_progress, completed
    evidence_ids: List[str] = []
    created_at: Optional[str] = None

class ProposedCRMUpdate(BaseModel):
    field_name: str
    current_value: str
    proposed_value: str
    reason: str
    supporting_rationale: Optional[str] = None  # Task D: Comprehensive supporting rationale
    field_updates: List[Dict[str, Any]] = Field(default_factory=list)  # Multi-field proposed updates
    evidence_ids: List[str] = []

class RecommendedNextStepItem(BaseModel):
    """
    Task D: Recommended suitable next step, such as adoption support or customer-success check-in.
    """
    id: str
    step_type: str  # "csm_check_in", "adoption_support", "technical_escalation", "contract_restructuring"
    title: str
    description: str
    rationale: str
    suitability_score: int = Field(default=90, ge=0, le=100)
    urgency: str = "urgent"  # "urgent", "recommended", "optional"
    is_primary: bool = False
    evidence_ids: List[str] = Field(default_factory=list)

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
    recommended_next_steps: List[RecommendedNextStepItem] = Field(default_factory=list)  # Task D: Suitable next steps
    suggested_next_step: Optional[str] = "csm_check_in"
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
    account_name: Optional[str] = None
    risk_score: int
    risk_level: RiskLevel
    rule_version: str = "v2.1.0"
    situation_summary: Optional[str] = ""
    facts: List[Dict[str, Any]] = Field(..., description="Evidence-backed facts with evidence_id")
    observed_facts: List[Dict[str, Any]] = Field(default_factory=list, description="Observed verifiable telemetry facts")
    interpretations: List[Any] = Field(..., description="Derived context or hypothesis")
    missing_information: List[str] = Field(default_factory=list, description="Missing signals or unknowns")
    alternative_explanations: List[str] = Field(default_factory=list, description="Alternative explanations for observed behavior")
    unknowns: List[str] = Field(default_factory=list, description="Missing signals or unknowns")
    suggested_action_type: str
    created_at: Optional[str] = None

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
    improvement_cycle: Optional[Dict[str, Any]] = None
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
# Feature 2: Customer Outcome Timeline Schemas
class TimelineEventType(str, Enum):
    SIGNAL = "signal"
    RECOMMENDATION = "recommendation"
    APPROVAL = "approval"
    ACTION_EXECUTED = "action_executed"
    CUSTOMER_RESPONSE = "customer_response"
    OUTCOME_CAPTURED = "outcome_captured"
    RISK_ASSESSMENT = "risk_assessment"
    MEETING_NOTE = "meeting_note"
    EMAIL_COMMUNICATION = "email_communication"

class OutstandingCommitment(BaseModel):
    commitment_id: str
    account_id: str
    title: str
    owner: str
    due_date: Optional[str] = None
    status: str = "open"  # open, in_progress, fulfilled
    source_event_id: Optional[str] = None
    created_at: str

class TimelineEvent(BaseModel):
    id: str
    account_id: str
    event_type: TimelineEventType
    category: str  # telemetry, intervention, review, feedback, diagnosis, commitment
    title: str
    description: str
    timestamp: str
    author_or_actor: str
    severity: Optional[str] = None  # critical, high, medium, low, info, success
    status: Optional[str] = None  # proposed, approved, executed, completed, etc.
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Specific fields for Feature 2
    customer_response: Optional[str] = None
    commitments: Optional[str] = None
    next_steps: Optional[str] = None
    risk_score_at_time: Optional[int] = None
    risk_level_at_time: Optional[str] = None
    original_recommendation: Optional[Dict[str, Any]] = None
    evidence_ids: List[str] = []

class CustomerOutcomeTimelineResponse(BaseModel):
    account_id: str
    account_name: str
    csm_owner: str
    arr: float
    current_risk_score: int
    current_risk_level: str
    events: List[TimelineEvent]
    outstanding_commitments: List[OutstandingCommitment]
    summary: Dict[str, Any] = Field(default_factory=dict)

# Feature 3: AI Outcome Analyzer Schemas
class SentimentEvidence(BaseModel):
    interpretation: str  # Interpretation of sentiment/concern (not asserted as ground-truth mental state)
    sentiment_label: str  # e.g., positive, cautiously_optimistic, neutral, frustrated, critical_risk
    supporting_quote_or_evidence: str  # Direct quote or observed signal excerpt
    confidence: float = 0.85
    is_interpretation_notice: str = "Treated as an interpretation, not a verified fact about internal mental state."

class AdoptionBlocker(BaseModel):
    blocker_title: str
    severity: str  # critical, high, medium, low
    feature_or_area: str
    evidence: str
    workaround_exists: bool = False

class RenewalObjection(BaseModel):
    objection_type: str  # pricing, competitor, roi, executive_change, sso_security, contract_terms
    description: str
    direct_evidence: str
    impact_level: str  # critical, moderate, minor

class CustomerCommitmentItem(BaseModel):
    commitment_text: str
    responsible_party: str  # customer, vendor_csm, engineering
    agreed_timeline: Optional[str] = None
    status: str = "open"

class UnresolvedIssue(BaseModel):
    issue_title: str
    description: str
    recommended_follow_up: str
    target_owner: str = "CSM Team"
    urgency: str = "high"  # immediate, within_week, next_review

class OutcomeAnalysisRequest(BaseModel):
    account_id: str
    source_type: str = "meeting_note"  # meeting_note, email_thread, customer_feedback, call_transcript
    title: Optional[str] = None
    raw_text: str
    meeting_date: Optional[str] = None
    participants: Optional[str] = None
    auto_ingest_as_evidence: bool = False

class OutcomeAnalysisResult(BaseModel):
    id: str
    account_id: str
    account_name: str
    source_type: str
    title: str
    raw_text: str
    meeting_date: Optional[str] = None
    participants: Optional[str] = None
    analyzed_at: str
    sentiment_analysis: SentimentEvidence
    adoption_blockers: List[AdoptionBlocker] = []
    renewal_objections: List[RenewalObjection] = []
    commitments_and_next_steps: List[CustomerCommitmentItem] = []
    unresolved_issues: List[UnresolvedIssue] = []
    structured_investigation_brief: str
    generated_signal_id: Optional[str] = None
    rule_notice: str = "Sentiment is treated as an interpretation, not a verified fact about the customer's internal state."


# ==========================================
# Feature: Feedback Form & Survey Loop
# ==========================================

class SurveyDeliveryChannel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    PORTAL = "portal"
    SLACK = "slack"

class SurveyStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    OPENED = "opened"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class SurveyQuestion(BaseModel):
    id: str
    question_type: str = "rating"  # rating_1_10, rating_1_5, multichoice, text
    prompt: str
    category: str = "satisfaction"  # satisfaction, product_usage, blockers, feature_requests
    options: List[str] = Field(default_factory=list)
    required: bool = True

class SurveyFormTemplate(BaseModel):
    id: str
    name: str
    description: str
    target_risk_level: Optional[str] = None  # critical, high, medium, all
    questions: List[SurveyQuestion] = Field(default_factory=list)

class FeedbackTriggerRule(str, Enum):
    USAGE_DROP_SEVERE = "usage_drop_severe"           # >= 30% drop in active usage/seats
    TOUCHPOINT_LAG = "touchpoint_lag"                 # >= 25 days without CSM interaction
    RENEWAL_WINDOW_RISK = "renewal_window_risk"       # <= 60 days to renewal with elevated risk
    CRITICAL_SUPPORT_BUGS = "critical_support_bugs"   # >= 1 unresolved critical support ticket
    RISK_SCORE_THRESHOLD = "risk_score_threshold"     # deterministic risk score >= 50
    MANUAL_PROACTIVE = "manual_proactive"

class TriggerAuditRecord(BaseModel):
    rule_id: str
    rule_name: str
    triggered: bool
    description: str
    observed_value: Any = None
    threshold: Any = None

class FeedbackTriggerCheck(BaseModel):
    account_id: str
    account_name: Optional[str] = None
    eligible: bool
    risk_level: str
    risk_score: int
    matched_rules: List[TriggerAuditRecord] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    cooldown_active: bool = False
    cooldown_days_remaining: int = 0
    duplicate_pending_survey: bool = False
    pending_survey_code: Optional[str] = None
    last_survey_sent_at: Optional[str] = None
    contact_preferences: Dict[str, Any] = Field(default_factory=dict)
    recommended_template_id: Optional[str] = "survey-tpl-churn-early-warning"
    recommended_intro: Optional[str] = None

class FeedbackSurveyDispatch(BaseModel):
    id: str
    survey_code: str  # unique token for the public form URL, e.g. rev-fb-xxxx
    account_id: str
    account_name: str
    contact_id: Optional[str] = None
    recipient_email: str
    recipient_name: str
    delivery_channel: SurveyDeliveryChannel = SurveyDeliveryChannel.EMAIL
    template_id: str
    status: SurveyStatus = SurveyStatus.PENDING
    created_at: str
    sent_at: Optional[str] = None
    completed_at: Optional[str] = None
    trigger_risk_score: Optional[int] = None
    trigger_risk_level: Optional[str] = None
    trigger_factors: List[str] = Field(default_factory=list)
    form_url: str
    custom_intro: Optional[str] = None

class BatchTriggerScanResult(BaseModel):
    scanned_accounts_count: int
    eligible_count: int
    cooldown_prevented_count: int
    duplicate_prevented_count: int
    auto_triggered_surveys: List[FeedbackSurveyDispatch] = Field(default_factory=list)
    scan_timestamp: str

class AutoTriggerRequest(BaseModel):
    account_id: Optional[str] = None
    force_ignore_cooldown: bool = False
    delivery_channel: SurveyDeliveryChannel = SurveyDeliveryChannel.EMAIL
    custom_intro: Optional[str] = None

class FeedbackAnswer(BaseModel):
    question_id: str
    category: str
    prompt: str
    answer_value: Any  # numeric rating, string text, or list of selected choices

class FeedbackResponseSubmission(BaseModel):
    survey_code: str
    account_id: Optional[str] = None
    respondent_email: Optional[str] = None
    respondent_name: Optional[str] = None
    feedback_type: Optional[str] = "customer_survey"
    satisfaction_score: Optional[int] = Field(None, ge=1, le=10, description="Overall satisfaction 1-10")
    usage_trend_self_report: Optional[str] = None  # e.g., "decreased", "steady", "stopped"
    primary_blocker: Optional[str] = None
    unresolved_issues: Optional[str] = None
    feature_improvement_request: Optional[str] = None
    additional_comments: Optional[str] = None
    answers: List[FeedbackAnswer] = Field(default_factory=list)
    submitted_at: Optional[str] = None

class FeedbackAnalysisSummary(BaseModel):
    id: str
    response_id: str
    account_id: str
    account_name: str
    classified_churn_reason: str  # adoption_blocker, pricing, poor_onboarding, champion_left, technical_bugs, feature_gap
    urgency_level: str  # critical, high, medium, low
    sentiment_label: str  # frustrated, at_risk, neutral, satisfied
    sentiment_interpretation: str  # explicitly treated as an interpretation, not verified fact
    executive_summary: str = ""   # concise multi-sentence evidence-linked causal summary
    key_blockers: List[str] = Field(default_factory=list)
    customer_concerns: List[str] = Field(default_factory=list)
    improvement_requests: List[str] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)  # explicitly separates what is unknown from facts
    recommended_retention_action: str  # e.g. "Arrange technical unblocker workshop with solutions engineer"
    action_type: str = "csm_intervention"  # csm_intervention, training_session, executive_sponsor_call, bug_escalation
    recommended_action_draft: Dict[str, Any] = Field(default_factory=dict) # prepared draft email/task for action copilot
    evidence_connection: List[str] = Field(default_factory=list)  # connected to telemetry / usage signals
    confidence_score: float = 0.88
    generated_signal_id: Optional[str] = None
    analyzed_at: str
    rule_notice: str = "Sentiment is treated as an interpretation, not a verified fact about internal mental state."

class CustomerFeedbackRecord(BaseModel):
    id: str
    survey_code: str
    account_id: str
    account_name: str
    recipient_email: str
    recipient_name: str
    feedback_type: str = "customer_survey"
    submission: FeedbackResponseSubmission
    analysis: Optional[FeedbackAnalysisSummary] = None
    created_at: str
    submitted_at: str
    timeline_event_id: Optional[str] = None

class CreateFeedbackSurveyRequest(BaseModel):
    account_id: str
    contact_id: Optional[str] = None
    delivery_channel: SurveyDeliveryChannel = SurveyDeliveryChannel.EMAIL
    template_id: Optional[str] = "survey-tpl-churn-early-warning"
    custom_intro: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None


# ==========================================
# 20-Node Feedback Flow Execution Schemas
# ==========================================

class FeedbackFlowNodeType(str, Enum):
    SOURCE = "source"
    AGENT = "agent"
    DECISION = "decision"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    ACTION = "action"

class FeedbackFlowNode(BaseModel):
    id: str  # A, B, C, D, ... T
    title: str
    subtitle: str
    node_type: FeedbackFlowNodeType
    category_class: str
    day_label: Optional[str] = None
    status: str = "pending"  # pending, active, completed, skipped
    summary: Optional[str] = None
    output_payload: Optional[Dict[str, Any]] = None

class FeedbackFlowEdge(BaseModel):
    from_node: str
    to_node: str
    label: Optional[str] = None

class FeedbackFlowGraph(BaseModel):
    nodes: List[FeedbackFlowNode]
    edges: List[FeedbackFlowEdge]

class FeedbackFlowExecution(BaseModel):
    execution_id: str
    account_id: str
    account_name: str
    scenario: str
    path_taken: List[str] = Field(default_factory=list)
    current_node: str
    node_states: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    status: str = "completed"  # running, completed, waiting
    started_at: str
    completed_at: Optional[str] = None
    outcome_summary: str
    sales_notified: bool = False
    manager_notified: bool = False
    crm_updated: bool = False
    healthy_marked: bool = False

class RunFeedbackFlowRequest(BaseModel):
    account_id: str
    scenario: str = "auto"  # auto, healthy, negative_day0, reminder_negative, unresponsive, positive
    custom_satisfaction_score: Optional[int] = None
    custom_blocker: Optional[str] = None
    custom_comments: Optional[str] = None

class PortfolioAutomationResult(BaseModel):
    scanned_accounts: int
    at_risk_detected: int
    day0_surveys_dispatched: int
    day2_reminders_sent: int
    sales_escalations_triggered: int
    healthy_monitored: int
    webhooks_dispatched: int
    emails_recorded: int
    timestamp: str
    automated_actions: List[Dict[str, Any]] = Field(default_factory=list)


# Member 2 Task A: Dynamic Signal Analysis Schemas
# ==========================================

class SignalTrajectory(str, Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    DETERIORATING = "deteriorating"
    SEVERE_DETERIORATION = "severe_deterioration"

class UsageAnalysis(BaseModel):
    current_active_users: int = 0
    baseline_active_users: int = 0
    drop_percentage: float = 0.0
    trajectory: SignalTrajectory = SignalTrajectory.STABLE
    evidence_signal_ids: List[str] = Field(default_factory=list)
    summary: str = ""

class EngagementAnalysis(BaseModel):
    days_since_last_touchpoint: int = 0
    last_contact_date: Optional[str] = None
    channel_breakdown: Dict[str, int] = Field(default_factory=dict)
    status: str = "active"  # active, lag_warning, critical_silence
    evidence_signal_ids: List[str] = Field(default_factory=list)
    summary: str = ""

class RenewalAnalysis(BaseModel):
    renewal_date: Optional[str] = None
    days_to_renewal: int = 999
    window_tier: str = "healthy"  # immediate (<=30d), critical (<=60d), approaching (<=90d), safe (>90d)
    urgency_label: str = "Low Urgency"
    evidence_signal_ids: List[str] = Field(default_factory=list)
    summary: str = ""

class MeetingsAnalysis(BaseModel):
    recent_meetings_count: int = 0
    upcoming_meetings_count: int = 0
    last_meeting_date: Optional[str] = None
    next_meeting_date: Optional[str] = None
    cadence_health: str = "active_cadence"  # active_cadence, scheduled, missing_meetings, cadence_broken
    evidence_signal_ids: List[str] = Field(default_factory=list)
    summary: str = ""

class SupportAnalysis(BaseModel):
    open_tickets_count: int = 0
    critical_tickets_count: int = 0
    high_tickets_count: int = 0
    unresolved_blockers: List[str] = Field(default_factory=list)
    status: str = "nominal"  # nominal, escalated, critical_blockers
    evidence_signal_ids: List[str] = Field(default_factory=list)
    summary: str = ""

class BaselineComparison(BaseModel):
    baseline_period_days: int = 90
    current_window_days: int = 30
    usage_delta_pct: float = 0.0
    touchpoint_frequency_delta_pct: float = 0.0
    support_volume_delta: int = 0
    trajectory: SignalTrajectory = SignalTrajectory.STABLE
    trend_description: str = ""

class SignalValidationIssueType(str, Enum):
    MISSING = "missing"
    STALE = "stale"
    CONFLICTING = "conflicting"
    INSUFFICIENT = "insufficient"

class SignalValidationIssue(BaseModel):
    issue_type: SignalValidationIssueType
    category: str
    severity: str = "medium"  # low, medium, high, critical
    description: str
    recommendation: str
    affected_signal_ids: List[str] = Field(default_factory=list)

class SignalValidationReport(BaseModel):
    is_valid: bool = True
    missing_signals: List[SignalValidationIssue] = Field(default_factory=list)
    stale_signals: List[SignalValidationIssue] = Field(default_factory=list)
    conflicting_signals: List[SignalValidationIssue] = Field(default_factory=list)
    insufficient_signals: List[SignalValidationIssue] = Field(default_factory=list)
    total_issues_count: int = 0
    quality_score: int = 100  # 0 to 100
    confidence_level: str = "high"  # high, medium, low
    summary: str = ""

class AccountSignalAnalysisResult(BaseModel):
    account_id: str
    account_name: str
    analyzed_at: str
    total_signals_examined: int
    categories_present: List[str] = Field(default_factory=list)
    product_usage: UsageAnalysis
    customer_engagement: EngagementAnalysis
    renewal_window: RenewalAnalysis
    meetings_calendar: MeetingsAnalysis
    support_issues: SupportAnalysis
    baseline_comparison: BaselineComparison
    validation_report: SignalValidationReport
    executive_signal_verdict: str

class BatchSignalAnalysisSummary(BaseModel):
    total_accounts_scanned: int
    analyzed_at: str
    accounts_with_conflicts: int
    accounts_with_stale_signals: int
    accounts_with_missing_signals: int
    average_signal_quality_score: float
    account_summaries: List[Dict[str, Any]] = Field(default_factory=list)


# ==========================================
# Member 2 Task B: Risk Scoring & Classification Schemas
# ==========================================

class AccountClassification(str, Enum):
    HEALTHY = "healthy"
    NEEDING_ATTENTION = "needing_attention"
    HIGH_RISK = "high_risk"

class RiskRuleEvaluation(BaseModel):
    rule_id: str
    name: str
    points_contributed: int
    max_points: int
    threshold_applied: str
    is_compound_rule: bool = False
    evidence_description: str
    evidence_ids: List[str] = Field(default_factory=list)

class DetailedRiskScoreResult(BaseModel):
    account_id: str
    account_name: str
    risk_score: int
    classification: AccountClassification
    risk_level: RiskLevel
    primary_reason_code: str
    main_warning: str
    contributing_factors: List[str] = Field(default_factory=list)
    rule_breakdown: List[RiskRuleEvaluation] = Field(default_factory=list)
    compound_rules_triggered: List[str] = Field(default_factory=list)
    investigation_triggered: bool = False
    investigation_trigger_reason: Optional[str] = None
    investigation_id: Optional[str] = None
    churn_probability: Optional[float] = None
    display_churn_probability: bool = False
    churn_probability_disclaimer: str = (
        "SignalBridge AI avoids speculative churn percentage probabilities without validated statistical modeling. "
        "Prioritization is driven by transparent, reproducible deterministic risk rules."
    )
    statistical_confidence: str = "high"
    rule_version: str = "v2.1.0"
    evaluated_at: str

class TriggerInvestigationRequest(BaseModel):
    account_id: str
    force_rerun: bool = False
    custom_rationale: Optional[str] = None


# ==========================================
# Dynamic Reminders Schemas (Task B)
# ==========================================

class ReminderType(str, Enum):
    USAGE_DROP = "usage_drop"
    REDUCED_ENGAGEMENT = "reduced_engagement"
    OVERDUE_FOLLOWUP = "overdue_followup"
    UNRESOLVED_FEEDBACK = "unresolved_feedback"
    RENEWAL_PROXIMITY = "renewal_proximity"
    CUSTOM = "custom"

class ReminderStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DISMISSED = "dismissed"
    SNOOZED = "snoozed"

class DynamicReminder(BaseModel):
    id: str
    account_id: str
    account_name: str
    reminder_type: ReminderType
    title: str
    description: str
    severity: str = "high"  # critical, high, medium, low
    trigger_condition: str
    issue_key: str  # deduplication fingerprint: {account_id}:{reminder_type}[:{unique_id}]
    status: ReminderStatus = ReminderStatus.ACTIVE
    associated_task_id: Optional[str] = None
    due_date: Optional[str] = None
    created_at: str
    updated_at: str
    dismissed_reason: Optional[str] = None
    evidence_ids: List[str] = Field(default_factory=list)
    csm_owner: Optional[str] = None

class CreateReminderRequest(BaseModel):
    account_id: str
    reminder_type: ReminderType = ReminderType.CUSTOM
    title: str
    description: str
    severity: str = "high"
    trigger_condition: Optional[str] = "Manual CSM creation"
    due_date: Optional[str] = None
    associated_task_id: Optional[str] = None
    evidence_ids: List[str] = Field(default_factory=list)

class UpdateReminderRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ReminderStatus] = None
    severity: Optional[str] = None
    due_date: Optional[str] = None
    dismissed_reason: Optional[str] = None

class DismissReminderRequest(BaseModel):
    reason: Optional[str] = "Addressed on call / no action required"

class ReminderEvaluationResult(BaseModel):
    total_accounts_scanned: int
    new_reminders_triggered: int
    duplicates_prevented: int
    active_reminders_count: int
    reminders: List[DynamicReminder] = Field(default_factory=list)

class RelationshipType(str, Enum):
    OBSERVED_CORRELATION = "observed_correlation"
    CONFIRMED_ROOT_CAUSE = "confirmed_root_cause"

class RootCauseStatus(str, Enum):
    UNCONFIRMED_HYPOTHESIS = "unconfirmed_hypothesis"
    PARTIALLY_VALIDATED = "partially_validated"
    CONFIRMED_ROOT_CAUSE = "confirmed_root_cause"

class EvidenceLink(BaseModel):
    evidence_type: str  # feedback, support_ticket, usage_signal, crm_touchpoint
    record_id: str
    account_id: str
    account_name: str
    title: str
    description_or_quote: str
    severity: str = "medium"
    timestamp: str
    metric_value: Optional[str] = None

class AffectedAccountSummary(BaseModel):
    account_id: str
    account_name: str
    arr: float
    csm_owner: str
    health_score: int
    risk_level: str
    evidence_count: int
    primary_complaint: str

class RecurringProblem(BaseModel):
    id: str
    cluster_key: str
    title: str
    category: str
    summary: str
    severity: str = "high"  # critical, high, medium, low
    frequency_score: int
    total_affected_accounts: int
    total_arr_affected: float
    feedback_count: int
    support_ticket_count: int
    usage_drop_signal_count: int
    first_observed_at: str
    last_observed_at: str
    repeated_complaints: List[str] = Field(default_factory=list)
    adoption_difficulties: List[str] = Field(default_factory=list)
    affected_accounts: List[AffectedAccountSummary] = Field(default_factory=list)
    evidence_links: List[EvidenceLink] = Field(default_factory=list)
    # Distinguish correlation from root cause
    relationship_type: RelationshipType = RelationshipType.OBSERVED_CORRELATION
    correlation_explanation: str
    root_cause_status: RootCauseStatus = RootCauseStatus.UNCONFIRMED_HYPOTHESIS
    investigation_needed: str
    confounding_factors: List[str] = Field(default_factory=list)

class RecurringProblemsReport(BaseModel):
    total_problems_identified: int
    critical_problems_count: int
    total_accounts_impacted: int
    total_arr_at_risk: float
    problems: List[RecurringProblem] = Field(default_factory=list)
    generated_at: str

# ==========================================
# Task E: Actionable Improvement Insights Schemas
# ==========================================

class ImprovementCategory(str, Enum):
    ONBOARDING_IMPROVEMENT = "onboarding_improvement"
    CUSTOMER_TRAINING = "customer_training"
    PRODUCT_CHANGE = "product_change"
    DOCUMENTATION_PROCESS = "documentation_process"

class ImprovementStatus(str, Enum):
    RECOMMENDED = "recommended"
    PLANNED = "planned"
    IMPLEMENTED = "implemented"
    MONITORING = "monitoring"
    COMPLETED = "completed"

class BehavioralOutcomeVerdict(str, Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    DETERIORATING = "deteriorating"
    PENDING_DATA = "pending_data"

class SubsequentBehaviorTracker(BaseModel):
    baseline_usage_avg: float
    post_intervention_usage_avg: float
    usage_delta_pct: float
    subsequent_tickets_count: int
    subsequent_feedback_rating: Optional[float] = None
    verdict: BehavioralOutcomeVerdict = BehavioralOutcomeVerdict.PENDING_DATA
    behavior_summary: str
    last_evaluated_at: str

class ActionableImprovementInsight(BaseModel):
    id: str
    problem_id: str
    problem_title: str
    title: str
    category: ImprovementCategory
    target_audience: str = "Managers & Customer Success Managers"
    recommended_action: str
    rationale: str
    estimated_effort: str = "Medium (1-2 weeks)"  # Low, Medium, High
    expected_retention_lift: str
    owner_role: str
    affected_customers: List[str] = Field(default_factory=list)
    total_arr_protected: float
    status: ImprovementStatus = ImprovementStatus.RECOMMENDED
    implemented_at: Optional[str] = None
    implemented_by: Optional[str] = None
    subsequent_behavior: Optional[SubsequentBehaviorTracker] = None
    created_at: str

class ImplementImprovementRequest(BaseModel):
    manager_name: str = "CS Manager"
    notes: Optional[str] = "Approved for execution across affected accounts"
    target_completion_date: Optional[str] = None

class EvaluateImprovementOutcomeRequest(BaseModel):
    override_verdict: Optional[BehavioralOutcomeVerdict] = None
    evaluation_notes: Optional[str] = None

class ImprovementInsightsReport(BaseModel):
    total_insights: int
    active_recommendations: int
    implemented_initiatives: int
    total_arr_protected: float
    insights: List[ActionableImprovementInsight] = Field(default_factory=list)
    generated_at: str

# Task C: Post-Action Improvement Cycle Schemas
class PostActionVerdict(str, Enum):
    IMPROVED = "improved"
    REMAINED_UNCHANGED = "remained_unchanged"
    DETERIORATED = "deteriorated"

class CustomerStateComparison(BaseModel):
    # Pre-intervention baseline
    usage_baseline: float
    tickets_count_prior: int
    risk_score_prior: int
    feedback_rating_prior: Optional[float] = None
    sentiment_prior: Optional[str] = "at_risk"

    # Post-intervention state
    subsequent_usage_avg: float
    subsequent_usage_delta_pct: float
    subsequent_tickets_count: int
    subsequent_risk_score: int
    subsequent_feedback_rating: Optional[float] = None
    subsequent_sentiment: Optional[str] = "improving"

class PostActionImprovementCycle(BaseModel):
    id: str
    action_tracker_id: str
    account_id: str
    account_name: str
    action_title: str
    action_type: str
    executed_at: str
    state_comparison: CustomerStateComparison
    verdict: PostActionVerdict
    verdict_explanation: str
    subsequent_signals_count: int
    subsequent_signals_summary: List[str] = Field(default_factory=list)
    is_issue_resolved: bool
    review_triggered: bool = False
    triggered_review_id: Optional[str] = None
    triggered_review_type: Optional[str] = None
    triggered_review_reason: Optional[str] = None
    evaluated_at: str
    evaluated_by: str = "Automated Telemetry Evaluation Engine"

class EvaluatePostActionCycleRequest(BaseModel):
    override_verdict: Optional[PostActionVerdict] = None
    evaluator_notes: Optional[str] = None
    force_trigger_review: Optional[bool] = False

class TriggerSecondaryReviewRequest(BaseModel):
    reason: str
    reviewer_name: Optional[str] = "CSM Director"
    review_urgency: Optional[str] = "high"

AccountDetail.model_rebuild()
ActionTrackerItem.model_rebuild()


# ==========================================
# 37-Node Retention & Reminders Flow Schemas (remainder.md)
# ==========================================

class RetentionReminderFlowNodeType(str, Enum):
    SOURCE = "source"
    AGENT = "agent"
    DECISION = "decision"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    ACTION = "action"

class RetentionReminderFlowNode(BaseModel):
    id: str  # A, B, C, D, E, F, G, H, I, J, K, L, M, N, P, Q, R, S, AF, O, T, U, V, W, AG, X, AH, Y, Z, AA, AB, AC, AE, AD, AI, AJ, AK
    title: str
    subtitle: str
    node_type: RetentionReminderFlowNodeType
    category_class: str
    day_label: Optional[str] = None
    status: str = "pending"  # pending, active, completed, skipped
    summary: Optional[str] = None
    output_payload: Optional[Dict[str, Any]] = None

class RetentionReminderFlowEdge(BaseModel):
    from_node: str
    to_node: str
    label: Optional[str] = None

class RetentionReminderFlowGraph(BaseModel):
    nodes: List[RetentionReminderFlowNode]
    edges: List[RetentionReminderFlowEdge]

class RetentionReminderFlowExecution(BaseModel):
    execution_id: str
    account_id: str
    account_name: str
    scenario: str
    path_taken: List[str] = Field(default_factory=list)
    current_node: str
    node_states: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    status: str = "completed"  # running, waiting_approval, completed
    started_at: str
    completed_at: Optional[str] = None
    outcome_summary: str
    feedback_survey_id: Optional[str] = None
    feedback_survey_code: Optional[str] = None
    recovery_proposal_id: Optional[str] = None
    direct_reminder_sent: bool = False
    feedback_received: bool = False
    sales_notified: bool = False
    manager_notified: bool = False
    recovery_message_sent: bool = False
    crm_updated: bool = False
    healthy_marked: bool = False

class RunRetentionReminderFlowRequest(BaseModel):
    account_id: str
    scenario: str = "auto"
    custom_satisfaction_score: Optional[int] = None
    custom_blocker: Optional[str] = None
    custom_comments: Optional[str] = None
    recovery_offer_type: Optional[str] = None
    human_approval_decision: Optional[str] = "approved"
    post_action_risk_reduced: Optional[bool] = True
    include_direct_reminder: Optional[bool] = True
    connect_live_feedback: Optional[bool] = True

class ApproveRetentionRecoveryRequest(BaseModel):
    execution_id: str
    decision: str = "approved"  # "approved" or "rejected"
    reviewer: str = "CSM Director"
    notes: Optional[str] = None

class PortfolioRetentionAutomationResult(BaseModel):
    scanned_accounts: int
    at_risk_detected: int
    retention_plans_created: int
    direct_reminders_dispatched: int
    feedback_forms_dispatched: int
    sales_escalations: int
    recovery_messages_approved: int
    healthy_maintained: int
    timestamp: str
    accounts_detail: List[Dict[str, Any]] = Field(default_factory=list)
