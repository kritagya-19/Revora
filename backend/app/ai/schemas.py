"""
Data schemas and contracts for the Revora AI Layer.
Defines input representations for Account Context and Normalized Signals,
as well as structured outputs for the Context Builder (EvidenceItem, DataGap, InvestigationContext).
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator

from app.models.schemas import Contact, CustomerMetrics, RiskLevel, SourceCategory


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class NormalizedSignal(BaseModel):
    """
    Standardized signal representation consumed by the AI Layer.
    Ingested across CRM, Email, Calendar, Product Usage, and Support.
    """
    signal_id: str = Field(..., description="Canonical signal ID, e.g. sig_usage_101 or SIG-001")
    account_id: str = Field(..., description="Associated account identifier")
    source_category: str = Field(..., description="crm, email, calendar, usage, support")
    source: Optional[str] = None
    signal_type: str = Field(..., description="Specific signal or event code, e.g. usage_drop, touchpoint_lag")
    event_type: Optional[str] = None
    title: str = Field(default="", description="Human-readable title")
    summary: str = Field(default="", description="Detailed summary or excerpt")
    severity: str = Field(default="medium", description="critical, high, medium, low")
    occurred_at: str = Field(..., description="ISO 8601 timestamp string")
    observed_value: Optional[Any] = None
    baseline_value: Optional[Any] = None
    unit: Optional[str] = None
    source_record_id: Optional[str] = Field(default=None, description="Raw source provenance ID")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Canonicalize signal ID
            s_id = data.get("signal_id") or data.get("id") or data.get("_id")
            if s_id:
                data["signal_id"] = str(s_id)

            # Canonicalize source
            source = data.get("source_category") or data.get("source") or data.get("source_type") or "system"
            data["source_category"] = str(source).lower()
            data["source"] = str(data.get("source") or data["source_category"])

            # Canonicalize type
            s_type = data.get("signal_type") or data.get("event_type") or "unspecified_signal"
            data["signal_type"] = s_type
            data["event_type"] = data.get("event_type") or s_type

            # Canonicalize timestamp
            ts = data.get("occurred_at") or data.get("timestamp") or data.get("event_time") or datetime.utcnow().isoformat()
            data["occurred_at"] = str(ts)

            # Fallbacks for title and summary
            if not data.get("title"):
                data["title"] = s_type.replace("_", " ").title()
            if not data.get("summary"):
                data["summary"] = data.get("description") or data["title"]
            if not data.get("severity"):
                data["severity"] = "medium"

        return data


class AccountContext(BaseModel):
    """
    Authoritative account context provided by the backend and MongoDB.
    """
    account_id: str
    name: str
    domain: Optional[str] = None
    arr: float = Field(..., description="Annual Recurring Revenue in USD")
    renewal_date: str = Field(..., description="ISO 8601 date string YYYY-MM-DD")
    days_to_renewal: int
    csm_owner: str
    industry: Optional[str] = None
    health_score: Optional[int] = None
    tier: str = "Standard"
    status: str = "active"
    contacts: List[Contact] = Field(default_factory=list)
    customer_metrics: Optional[CustomerMetrics] = None


class EvidenceItem(BaseModel):
    """
    Curated evidence record selected and verified by the Context Builder.
    All downstream AI claims and autopsy findings MUST cite valid evidence IDs.
    """
    evidence_id: str = Field(..., description="Canonical reference ID (e.g. EVID-SIG-101 or sig_101)")
    signal_id: str = Field(..., description="Original normalized signal ID")
    account_id: str
    source_category: str
    source_record_id: Optional[str] = None
    title: str
    summary: str
    severity: str
    occurred_at: str
    observed_value: Optional[Any] = None
    baseline_value: Optional[Any] = None
    unit: Optional[str] = None
    relevance_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Ranked relevance 0.0-1.0")
    relevance_reasons: List[str] = Field(default_factory=list)
    raw_reference: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DataGap(BaseModel):
    """
    Identified blind spot or missing signal in the account's telemetry.
    """
    category: str = Field(..., description="e.g. crm, usage, support, contacts")
    description: str = Field(..., description="Clear explanation of the missing data or gap")
    impact: str = Field(..., description="Impact on risk determination or investigation")
    severity: str = Field(default="medium", description="critical, high, medium, low")


class ContextBuilderConfig(BaseModel):
    """
    Configurable options for evidence windowing and ranking.
    """
    lookback_days: int = 90
    max_evidence_count: int = 15
    include_all_critical: bool = True
    min_severity: str = "low"


class InvestigationContext(BaseModel):
    """
    Complete structured output produced by Stage 1 (Context Builder).
    Supplies verified account context and selected evidence records to the downstream agents.
    """
    account: AccountContext
    selected_evidence: List[EvidenceItem] = Field(default_factory=list)
    evidence_catalog: Dict[str, str] = Field(
        default_factory=dict,
        description="Lookup map of evidence_id -> summary string for fast citation and prompt injection"
    )
    all_signals_count: int
    selected_evidence_count: int
    data_gaps: List[DataGap] = Field(default_factory=list)
    key_stakeholders: List[Contact] = Field(default_factory=list)
    primary_contact: Optional[Contact] = None
    time_window_days: int = 90
    built_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class RuleEvaluation(BaseModel):
    """
    Evaluation result for an individual deterministic risk rule.
    """
    rule_id: str = Field(..., description="e.g. RULE_USAGE_DECLINE, RULE_TOUCHPOINT_SILENCE")
    rule_name: str
    triggered: bool
    points_contributed: int = Field(ge=0, le=100)
    max_points: int
    explanation: str
    evidence_ids: List[str] = Field(default_factory=list, description="Evidence IDs directly supporting this rule trigger")


class TrendSummary(BaseModel):
    """
    Deterministic directional trends for product usage, engagement, and support.
    """
    usage_trend: str = Field(default="stable", description="contracting, stable, growing")
    usage_change_pct: float = 0.0
    engagement_trend: str = Field(default="healthy", description="disengaged, lagging, healthy")
    days_since_touchpoint: int = 0
    support_trend: str = Field(default="normal", description="escalated, active, clear")
    critical_tickets_count: int = 0
    overall_momentum: str = Field(default="neutral", description="negative, neutral, positive")


class UrgencyAssessment(BaseModel):
    """
    Separates urgency from risk and ARR according to explicit temporal & operational thresholds.
    """
    urgency_level: str = Field(..., description="immediate, high, moderate, low")
    days_to_renewal: int
    urgency_label: str
    urgency_drivers: List[str] = Field(default_factory=list)


class DeterministicRiskResult(BaseModel):
    """
    Authoritative, reproducible risk output produced by Stage 2 (Deterministic Intelligence).
    LLMs cannot overwrite or calculate these scores.
    """
    account_id: str
    risk_score: int = Field(..., ge=0, le=100, description="Authoritative score between 0 and 100")
    risk_level: RiskLevel
    primary_reason_code: str
    main_warning: str
    contributing_factors: List[str] = Field(default_factory=list)
    urgency: UrgencyAssessment
    trends: TrendSummary
    rule_breakdown: List[RuleEvaluation] = Field(default_factory=list)
    rule_version: str = "v2.0.0"
    evaluated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# =====================================================================
# Stage 3: Agent Orchestrator & The 4 Specialized Agent Schemas
# =====================================================================

class SignalCluster(BaseModel):
    """
    Grouped related events generated by Agent 1 (Signal Analysis).
    """
    category: str
    theme: str
    event_count: int
    evidence_ids: List[str] = Field(default_factory=list)
    summary: str


class SignalAnalysisOutput(BaseModel):
    """
    Agent 1 Output: Structured summary of observations, baseline comparisons,
    event clusters, and missing telemetry gaps.
    """
    account_id: str
    observations: List[str] = Field(default_factory=list)
    usage_baseline_comparison: Dict[str, Any] = Field(default_factory=dict)
    event_clusters: List[SignalCluster] = Field(default_factory=list)
    missing_data_gaps: List[str] = Field(default_factory=list)
    cited_evidence_ids: List[str] = Field(default_factory=list)
    analyzed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def baseline_comparison(self) -> Dict[str, Any]:
        return self.usage_baseline_comparison

    @property
    def missing_data_flags(self) -> List[str]:
        return self.missing_data_gaps


class RiskExplanationOutput(BaseModel):
    """
    Agent 2 Output: Plain-language explanation of how serious the warning is,
    preserving authoritative deterministic values without modification.
    """
    account_id: str
    authoritative_risk_score: int
    authoritative_risk_level: RiskLevel
    authoritative_urgency: str
    narrative_explanation: str
    contributing_rule_explanations: List[str] = Field(default_factory=list)
    urgency_drivers_explanation: List[str] = Field(default_factory=list)
    data_limitations_and_blindspots: List[str] = Field(default_factory=list)
    explained_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class FactItem(BaseModel):
    """
    Verified fact directly anchored to evidence IDs.
    """
    claim: str
    evidence_ids: List[str]
    type: str = "observed_fact"
    source_category: Optional[str] = None


class InterpretationItem(BaseModel):
    """
    Interpretation or causal deduction based on facts.
    """
    hypothesis: str
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    confidence: str = "medium"  # high, medium, low


class InvestigationAutopsy(BaseModel):
    """
    Agent 3 Output: Revenue Risk Autopsy report explaining why the account was flagged.
    Connects multiple signals, separates verified facts from interpretations,
    identifies conflicting evidence, and highlights uncertainties.
    """
    id: str
    account_id: str
    account_name: str
    risk_summary: str
    authoritative_risk_score: int
    authoritative_risk_level: RiskLevel
    primary_reason_code: str
    verified_facts: List[FactItem] = Field(default_factory=list)
    interpretations: List[InterpretationItem] = Field(default_factory=list)
    conflicting_evidence: List[str] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    causal_explanation: str
    cited_evidence_ids: List[str] = Field(default_factory=list)
    rule_version: str = "v2.0.0"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def causal_narrative(self) -> str:
        return self.causal_explanation


class ProposedEmailDraft(BaseModel):
    recipient_email: str
    recipient_name: str
    subject: str
    body: str
    cited_evidence_ids: List[str] = Field(default_factory=list)


class ProposedTaskDraft(BaseModel):
    title: str
    description: str
    assigned_to: str
    due_date: str
    priority: str = "high"
    cited_evidence_ids: List[str] = Field(default_factory=list)


class ActionPlanOutput(BaseModel):
    """
    Agent 4 Output: Editable proposal turning the autopsy into a concrete next step,
    staged in draft form awaiting human approval.
    """
    id: str
    account_id: str
    account_name: str
    action_type: str = "csm_outreach_email"  # csm_outreach_email, technical_escalation, crm_update
    title: str
    reason: str
    target_contact: Optional[str] = None
    email_draft: Optional[ProposedEmailDraft] = None
    task_draft: Optional[ProposedTaskDraft] = None
    status: str = "proposed"  # proposed (awaiting human approval)
    cited_evidence_ids: List[str] = Field(default_factory=list)
    planned_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class OrchestratedInvestigationResult(BaseModel):
    """
    Consolidated output produced by the Agent Orchestrator coordinating all 4 specialized agents.
    """
    account_id: str
    account_name: str
    context: InvestigationContext
    deterministic_risk: DeterministicRiskResult
    signal_analysis: SignalAnalysisOutput
    risk_explanation: RiskExplanationOutput
    investigation: InvestigationAutopsy
    action_plan: ActionPlanOutput
    orchestrated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# =====================================================================
# Stage 4: Output Validator Schema
# =====================================================================

class ValidationResult(BaseModel):
    """
    Structured outcome of Stage 4 Output Validation.
    Enforces output schemas, evidence citation grounding, and account ownership.
    """
    is_valid: bool
    account_id: str
    schema_valid: bool = True
    evidence_citations_valid: bool = True
    account_ownership_valid: bool = True
    deterministic_supremacy_valid: bool = True
    human_approval_guardrail_valid: bool = True
    checked_citations_count: int = 0
    valid_citations: List[str] = Field(default_factory=list)
    hallucinated_citations: List[str] = Field(default_factory=list)
    ownership_violations: List[str] = Field(default_factory=list)
    violations: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    validated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())



