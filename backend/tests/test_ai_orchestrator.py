import pytest
from app.ai.orchestrator import AgentOrchestrator
from app.ai.agents.agent1_signal_analysis import Agent1SignalAnalysis
from app.ai.agents.agent2_risk_explanation import Agent2RiskExplanation
from app.ai.agents.agent3_investigation import Agent3Investigation
from app.ai.agents.agent4_action_planning import Agent4ActionPlanning
from app.ai.context_builder import ContextBuilder
from app.ai.deterministic import DeterministicIntelligenceEngine
from app.ai.schemas import (
    OrchestratedInvestigationResult,
    SignalAnalysisOutput,
    RiskExplanationOutput,
    InvestigationAutopsy,
    ActionPlanOutput,
)
from app.models.schemas import RiskLevel


def test_agent1_signal_analysis():
    """
    Test Agent 1 analyzes behavioral shifts, calculates baseline usage delta,
    and clusters related events into themes.
    """
    builder = ContextBuilder()
    context = builder.build_context("acc-101")
    agent1 = Agent1SignalAnalysis()

    analysis = agent1.analyze(context)

    assert isinstance(analysis, SignalAnalysisOutput)
    assert analysis.account_id == "acc-101"
    assert len(analysis.observations) > 0
    assert "current_active_users" in analysis.usage_baseline_comparison
    assert "historical_baseline_users" in analysis.usage_baseline_comparison
    assert len(analysis.event_clusters) > 0
    assert len(analysis.missing_data_gaps) > 0
    assert len(analysis.cited_evidence_ids) > 0


def test_agent2_risk_explanation_preserves_authoritative_values():
    """
    Test Agent 2 translates deterministic scoring to plain language
    while strictly protecting the authoritative score, level, and urgency.
    """
    builder = ContextBuilder()
    context = builder.build_context("acc-101")
    engine = DeterministicIntelligenceEngine()
    risk = engine.evaluate_context(context)

    agent2 = Agent2RiskExplanation()
    explanation = agent2.explain(context, risk)

    assert isinstance(explanation, RiskExplanationOutput)
    assert explanation.account_id == "acc-101"
    # Authoritative values MUST be identical
    assert explanation.authoritative_risk_score == risk.risk_score
    assert explanation.authoritative_risk_level == risk.risk_level
    assert explanation.authoritative_urgency == risk.urgency.urgency_level

    # Narrative and breakdowns
    assert len(explanation.narrative_explanation) > 20
    assert len(explanation.contributing_rule_explanations) > 0
    assert len(explanation.urgency_drivers_explanation) > 0
    assert len(explanation.data_limitations_and_blindspots) > 0


def test_agent3_investigation_autopsy():
    """
    Test Agent 3 synthesizes Revenue Risk Autopsy, separates verified facts
    from interpretations, checks conflicting evidence, and lists uncertainties.
    """
    builder = ContextBuilder()
    context = builder.build_context("acc-101")
    engine = DeterministicIntelligenceEngine()
    risk = engine.evaluate_context(context)
    agent1 = Agent1SignalAnalysis()
    agent2 = Agent2RiskExplanation()
    sig_out = agent1.analyze(context)
    risk_out = agent2.explain(context, risk)

    agent3 = Agent3Investigation()
    autopsy = agent3.investigate(context, risk, sig_out, risk_out)

    assert isinstance(autopsy, InvestigationAutopsy)
    assert autopsy.account_id == "acc-101"
    assert autopsy.authoritative_risk_score == risk.risk_score
    assert autopsy.authoritative_risk_level == risk.risk_level
    assert len(autopsy.verified_facts) > 0
    assert len(autopsy.interpretations) > 0
    assert len(autopsy.uncertainties) > 0
    assert autopsy.causal_explanation != ""

    # Every fact must cite valid evidence IDs
    valid_ids = set(context.evidence_catalog.keys())
    for fact in autopsy.verified_facts:
        assert fact.claim != ""
        assert len(fact.evidence_ids) > 0
        for eid in fact.evidence_ids:
            assert eid in valid_ids or eid.replace("EVID-", "") in valid_ids


def test_agent4_action_planning():
    """
    Test Agent 4 converts investigation findings into an editable proposal
    with target recipient, draft email, follow-up task, and draft status.
    """
    builder = ContextBuilder()
    context = builder.build_context("acc-101")
    engine = DeterministicIntelligenceEngine()
    risk = engine.evaluate_context(context)
    agent1 = Agent1SignalAnalysis()
    agent2 = Agent2RiskExplanation()
    agent3 = Agent3Investigation()
    sig_out = agent1.analyze(context)
    risk_out = agent2.explain(context, risk)
    autopsy = agent3.investigate(context, risk, sig_out, risk_out)

    agent4 = Agent4ActionPlanning()
    plan = agent4.plan_action(context, autopsy)

    assert isinstance(plan, ActionPlanOutput)
    assert plan.account_id == "acc-101"
    assert plan.status == "proposed"  # Staged for human approval
    assert plan.target_contact is not None
    assert plan.email_draft is not None
    assert "@" in plan.email_draft.recipient_email
    assert plan.email_draft.subject != ""
    assert plan.email_draft.body != ""
    assert plan.task_draft is not None
    assert plan.task_draft.title != ""
    assert plan.task_draft.assigned_to != ""


def test_full_agent_orchestrator():
    """
    Test Agent Orchestrator coordinates the complete 4-agent pipeline end-to-end.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    assert isinstance(result, OrchestratedInvestigationResult)
    assert result.account_id == "acc-101"
    assert result.account_name != ""

    # Check that all stages executed and produced expected outputs
    assert result.context.selected_evidence_count > 0
    assert result.deterministic_risk.risk_score > 0
    assert len(result.signal_analysis.event_clusters) > 0
    assert result.risk_explanation.authoritative_risk_score == result.deterministic_risk.risk_score
    assert len(result.investigation.verified_facts) > 0
    assert result.action_plan.status == "proposed"
    assert result.action_plan.email_draft is not None
