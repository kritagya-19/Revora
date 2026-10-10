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
    signal_type: str
    title: str
    summary: str
    severity: str
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

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
    primary_reason_code: str
    contributing_factors: List[str]

class AccountDetail(AccountRiskSummary):
    contacts: List[Contact] = []
    signals: List[Signal] = []

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

# Autopsy
class RevenueRiskAutopsy(BaseModel):
    account_id: str
    risk_score: int
    risk_level: RiskLevel
    rule_version: str
    facts: List[Dict[str, Any]] = Field(..., description="Evidence-backed facts with evidence_id")
    interpretations: List[str] = Field(..., description="Derived context or hypothesis")
    unknowns: List[str] = Field(..., description="Missing signals or unknowns")
    suggested_action_type: str

# Proposals & Approval
class ActionProposal(BaseModel):
    id: str
    account_id: str
    action_type: str = Field(..., description="e.g., csm_email, crm_update, task_create")
    title: str
    payload: Dict[str, Any] = Field(..., description="Parameters, e.g. recipient, subject, body")
    status: ActionStatus = ActionStatus.PROPOSED
    version: int = 1
    content_hash: str
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    execution_result: Optional[Dict[str, Any]] = None
