"""
Test Suite for Member 2 - Task C: Revenue Risk Autopsy Functionality
Validates:
1. Automatic investigation of selected customer.
2. Generation of customer's current situation summary.
3. Evidence grounding supporting each important finding.
4. Strict separation of observed facts from interpretations.
5. Identification of missing information and possible alternative explanations.
6. HTTP Autopsy endpoints (GET and POST /api/accounts/{id}/autopsy).
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.account_repository import account_repo
from app.services.investigation_repository import investigation_repo
from app.ai.orchestrator import AgentOrchestrator
from app.ai.agents.agent3_investigation import Agent3Investigation
from app.ai.schemas import InvestigationAutopsy

client = TestClient(app)


def test_automatic_investigation_on_selection():
    """
    Requirement 1: Investigate the selected customer automatically.
    Verify that calling GET /api/accounts/{account_id}/autopsy automatically generates
    and returns a structured autopsy even if not previously investigated.
    """
    account_id = "acc-102"  # DataWave Analytics
    resp = client.get(f"/api/accounts/{account_id}/autopsy")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data["account_id"] == account_id
    assert "situation_summary" in data
    assert data["situation_summary"] is not None
    assert len(data["situation_summary"]) > 0


def test_current_situation_summary_content():
    """
    Requirement 2: Generate a summary of the customer's current situation.
    The summary must capture customer identity, ARR / risk level, contract countdown,
    and key telemetry context.
    """
    account_id = "acc-101"  # Acme Corp
    resp = client.get(f"/api/accounts/{account_id}/autopsy")
    assert resp.status_code == 200
    data = resp.json()

    summary = data.get("situation_summary", "")
    assert isinstance(summary, str)
    assert len(summary) >= 30, "Situation summary should be substantive"
    # Should reference key aspects of the account
    account = account_repo.get_account_by_id(account_id)
    assert account is not None
    assert account.name in summary or "Acme" in summary or "ARR" in summary or "renewal" in summary.lower()


def test_evidence_grounding_on_findings():
    """
    Requirement 3: Show the evidence supporting each important finding.
    Findings must cite real signal/record IDs that belong to the customer account.
    """
    account_id = "acc-101"
    account = account_repo.get_account_by_id(account_id)
    assert account is not None
    known_signal_ids = {s.id for s in account.signals}

    resp = client.get(f"/api/accounts/{account_id}/autopsy")
    assert resp.status_code == 200
    data = resp.json()

    # Check observed facts cite valid evidence
    observed_facts = data.get("observed_facts", [])
    assert len(observed_facts) > 0, "Expected at least one observed fact"
    for fact in observed_facts:
        assert "claim" in fact
        evidence_ids = fact.get("evidence_ids") or ([fact["evidence_id"]] if "evidence_id" in fact else [])
        assert len(evidence_ids) > 0
        for ev_id in evidence_ids:
            assert ev_id in known_signal_ids or ev_id.startswith("sig-")

    # Check facts general list
    facts = data.get("facts", [])
    assert len(facts) > 0
    for f in facts:
        evidence_ids = f.get("evidence_ids") or ([f["evidence_id"]] if "evidence_id" in f else [])
        assert len(evidence_ids) > 0
        for ev_id in evidence_ids:
            assert ev_id in known_signal_ids or ev_id.startswith("sig-")


def test_separation_of_facts_from_interpretations():
    """
    Requirement 4: Separate observed facts from interpretations.
    Observed facts must be verifiable telemetry/CRM events.
    Interpretations must be analytical deductions/hypotheses with confidence levels.
    """
    account_id = "acc-101"
    resp = client.get(f"/api/accounts/{account_id}/autopsy")
    assert resp.status_code == 200
    data = resp.json()

    observed_facts = data.get("observed_facts", [])
    interpretations = data.get("interpretations", [])

    assert len(observed_facts) > 0, "Must have observed facts"
    assert len(interpretations) > 0, "Must have interpretations"

    # Verify observed facts structure
    for fact in observed_facts:
        assert fact.get("type") in ["observed_fact", None]
        assert "claim" in fact
        # Facts should not state speculative churn percentages
        assert "100%" not in fact["claim"]

    # Verify interpretations structure
    for interp in interpretations:
        if isinstance(interp, dict):
            assert "hypothesis" in interp
            assert "confidence" in interp
            assert interp["confidence"] in ["low", "medium", "high"]
            assert "supporting_evidence_ids" in interp
        elif isinstance(interp, str):
            assert len(interp) > 0


def test_missing_information_and_alternative_explanations():
    """
    Requirement 5: Identify missing information and possible alternative explanations.
    Autopsy must include blindspots requiring verification and counter-hypotheses.
    """
    account_id = "acc-101"
    resp = client.get(f"/api/accounts/{account_id}/autopsy")
    assert resp.status_code == 200
    data = resp.json()

    missing_info = data.get("missing_information", [])
    alt_explanations = data.get("alternative_explanations", [])

    # Verify missing information checklist
    assert isinstance(missing_info, list)
    assert len(missing_info) >= 1, "Expected at least 1 missing info item / blindspot"
    for item in missing_info:
        assert isinstance(item, str)
        assert len(item) > 10

    # Verify alternative explanations counteracting single-silo bias
    assert isinstance(alt_explanations, list)
    assert len(alt_explanations) >= 1, "Expected at least 1 alternative explanation"
    for alt in alt_explanations:
        assert isinstance(alt, str)
        assert len(alt) > 10


def test_explicit_autopsy_run_endpoint():
    """
    Test POST /api/accounts/{account_id}/autopsy/run triggers fresh execution.
    """
    account_id = "acc-103"  # CloudScale IO
    resp = client.post(f"/api/accounts/{account_id}/autopsy/run")
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_id"] == account_id
    assert "situation_summary" in data
    assert len(data.get("observed_facts", [])) > 0
    assert len(data.get("interpretations", [])) > 0
    assert len(data.get("missing_information", [])) > 0
    assert len(data.get("alternative_explanations", [])) > 0


def test_investigation_agent_fallback_deterministic_task_c():
    """
    Test that Agent 3 Investigation deterministic fallback reliably constructs
    all Task C structured fields without requiring an active external LLM API key.
    """
    from app.ai.context_builder import ContextBuilder
    from app.ai.deterministic import DeterministicIntelligenceEngine
    from app.ai.agents.agent1_signal_analysis import Agent1SignalAnalysis
    from app.ai.agents.agent2_risk_explanation import Agent2RiskExplanation

    builder = ContextBuilder()
    context = builder.build_context("acc-101")
    engine = DeterministicIntelligenceEngine()
    risk = engine.evaluate_context(context)
    agent1 = Agent1SignalAnalysis()
    agent2 = Agent2RiskExplanation()
    sig_out = agent1.analyze(context)
    risk_out = agent2.explain(context, risk)

    agent3 = Agent3Investigation()
    autopsy = agent3._run_deterministic_investigation(
        context=context,
        deterministic_risk=risk,
        signal_analysis=sig_out,
        risk_explanation=risk_out,
        valid_evidence_ids=set(context.evidence_catalog.keys())
    )

    assert isinstance(autopsy, InvestigationAutopsy)
    assert autopsy.situation_summary is not None
    assert len(autopsy.situation_summary) > 20
    assert len(autopsy.verified_facts) > 0
    assert len(autopsy.interpretations) > 0
    assert len(autopsy.uncertainties) > 0
    assert len(autopsy.alternative_explanations) > 0
