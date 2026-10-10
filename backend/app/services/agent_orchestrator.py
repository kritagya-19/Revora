import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.models.schemas import (
    AccountDetail,
    Signal,
    Investigation,
    DraftActionsResponse,
    AskAccountQuestionResponse
)
from app.services.risk_engine import DeterministicRiskEngine
from app.services.llm_service import llm_service
from app.services.account_repository import account_repo
from app.services.investigation_repository import investigation_repo

logger = logging.getLogger("revora.agent")

class SignalAnalysisStage:
    """
    Subagent/Stage 1: Multi-Source Signal Analysis
    Ingests and normalizes raw telemetry across CRM, Email, Calendar, Usage, and Support.
    Identifies anomaly thresholds and touchpoint velocities.
    """
    @classmethod
    def analyze_signals(cls, account: AccountDetail) -> Dict[str, Any]:
        signals: List[Signal] = account.signals
        category_counts: Dict[str, int] = {}
        severities: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for s in signals:
            category_counts[s.source_category] = category_counts.get(s.source_category, 0) + 1
            severities[s.severity] = severities.get(s.severity, 0) + 1

        usage_drop_pct = 0.0
        days_since_touchpoint = 999
        open_critical_tickets = 0

        for s in signals:
            if s.source_category == "product_usage" and "usage_drop" in s.signal_type:
                if s.observed_value and isinstance(s.observed_value, (int, float)):
                    usage_drop_pct = max(usage_drop_pct, float(s.observed_value))
            elif s.source_category in ("email", "calendar") and "silence" in s.signal_type:
                if s.observed_value and isinstance(s.observed_value, (int, float)):
                    days_since_touchpoint = min(days_since_touchpoint, int(s.observed_value))
            elif s.source_category == "support_tickets" and s.severity in ("critical", "high"):
                open_critical_tickets += 1

        if days_since_touchpoint == 999:
            days_since_touchpoint = 30  # Default baseline if unrecorded

        return {
            "total_signals": len(signals),
            "source_distribution": category_counts,
            "severity_breakdown": severities,
            "usage_drop_pct": usage_drop_pct,
            "days_since_touchpoint": days_since_touchpoint,
            "open_critical_tickets": open_critical_tickets,
            "analyzed_at": datetime.utcnow().isoformat()
        }


class RiskAssessmentStage:
    """
    Subagent/Stage 2: Deterministic Risk Assessment
    Strict mathematical scoring rule authority.
    Calculates repeatable risk scores, tier categorization, and primary churn reasons.
    """
    @classmethod
    def evaluate_risk(cls, account: AccountDetail, signal_analysis: Dict[str, Any]) -> Dict[str, Any]:
        return DeterministicRiskEngine.evaluate(
            days_to_renewal=account.urgency_days_to_renewal,
            usage_drop_pct=signal_analysis.get("usage_drop_pct", 0.0),
            days_since_last_touchpoint=signal_analysis.get("days_since_touchpoint", 30),
            open_critical_tickets=signal_analysis.get("open_critical_tickets", 0),
            arr=account.arr
        )


class InvestigationStage:
    """
    Subagent/Stage 3: Evidence Grounded Investigation & Causal Synthesizer
    Separates verified facts, interpretations, and unknowns.
    Enforces strict citation validation: all cited IDs must exist in stored signals.
    """
    @classmethod
    def conduct_investigation(cls, account: AccountDetail) -> Investigation:
        return investigation_repo.create_or_run_investigation(account.id)

    @classmethod
    def ask_grounded_question(cls, account: AccountDetail, question: str) -> AskAccountQuestionResponse:
        return llm_service.answer_account_question(account, question)


class ActionPlanningStage:
    """
    Subagent/Stage 4: Next-Best-Action Planning & Parameter Validation
    Generates structured, human-reviewable drafts:
    1. Personalized outreach email
    2. Follow-up task assignment
    3. CRM field change proposal with cited evidence
    """
    @classmethod
    def plan_actions(cls, account: AccountDetail, investigation: Optional[Investigation] = None) -> DraftActionsResponse:
        if not investigation:
            investigation = investigation_repo.get_latest_for_account(account.id)
        return llm_service.generate_draft_actions(account, investigation)


class AgentLayerOrchestrator:
    """
    Unified Orchestrator implementing the 4-tier Agent Pipeline:
    1. Signal Analysis -> 2. Risk Assessment -> 3. Investigation -> 4. Action Planning
    """
    def __init__(self):
        self.signal_stage = SignalAnalysisStage
        self.risk_stage = RiskAssessmentStage
        self.investigation_stage = InvestigationStage
        self.action_stage = ActionPlanningStage

    def execute_full_cycle(self, account_id: str) -> Dict[str, Any]:
        account = account_repo.get_account_by_id(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")

        # Step 1: Signal Analysis
        signals_output = self.signal_stage.analyze_signals(account)

        # Step 2: Risk Assessment
        risk_output = self.risk_stage.evaluate_risk(account, signals_output)

        # Step 3: Investigation
        investigation = self.investigation_stage.conduct_investigation(account)

        # Step 4: Action Planning
        action_drafts = self.action_stage.plan_actions(account, investigation)

        email_rec = action_drafts.get("email_draft", {}).get("recipient") if isinstance(action_drafts, dict) else action_drafts.email_draft.recipient
        task_tit = action_drafts.get("task_draft", {}).get("title") if isinstance(action_drafts, dict) else action_drafts.task_draft.title
        crm_f = action_drafts.get("crm_update", {}).get("field_name") if isinstance(action_drafts, dict) else action_drafts.crm_update.field_name
        crm_val = action_drafts.get("crm_update", {}).get("proposed_value") if isinstance(action_drafts, dict) else action_drafts.crm_update.proposed_value

        return {
            "account_id": account.id,
            "account_name": account.name,
            "pipeline_stages": {
                "signal_analysis": signals_output,
                "risk_assessment": risk_output,
                "investigation": {
                    "id": investigation.id,
                    "findings_count": len(investigation.findings),
                    "cited_evidence": [f.evidence_ids for f in investigation.findings],
                    "uncertainties": investigation.uncertainties
                },
                "action_planning": {
                    "email_recipient": email_rec,
                    "task_title": task_tit,
                    "crm_field": crm_f,
                    "crm_proposed_value": crm_val
                }
            },
            "orchestrated_at": datetime.utcnow().isoformat()
        }

agent_orchestrator = AgentLayerOrchestrator()
