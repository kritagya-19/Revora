from pydantic import BaseModel, Field
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
    EXECUTING = "executing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    UNCERTAIN = "uncertain"

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
    signal_type: str
    event_type: Optional[str] = None
    title: str
    summary: str
    description: Optional[str] = None
    severity: str
    timestamp: str
    event_time: Optional[str] = None
    observed_value: Optional[str] = None
    source_record_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

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

class DraftActionsResponse(BaseModel):
    account_id: str
    account_name: str
    investigation_id: Optional[str] = None
    email_draft: EmailDraftItem
    task_draft: ProposedTask
    crm_update: ProposedCRMUpdate
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
