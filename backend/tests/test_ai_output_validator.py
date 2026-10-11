import pytest
from app.ai.orchestrator import AgentOrchestrator
from app.ai.validators import OutputValidator
from app.ai.schemas import (
    FactItem,
    ValidationResult,
)
from app.models.schemas import RiskLevel


def test_validator_passes_on_valid_orchestration():
    """
    Test Stage 4: Output Validator succeeds when the orchestrator produces
    a fully compliant, grounded, single-account result.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    validator = OutputValidator()
    val_res = validator.validate_orchestrated_result(result)

    assert isinstance(val_res, ValidationResult)
    assert val_res.is_valid is True
    assert val_res.schema_valid is True
    assert val_res.evidence_citations_valid is True
    assert val_res.account_ownership_valid is True
    assert val_res.deterministic_supremacy_valid is True
    assert val_res.human_approval_guardrail_valid is True
    assert len(val_res.hallucinated_citations) == 0
    assert len(val_res.ownership_violations) == 0
    assert len(val_res.violations) == 0


def test_validator_catches_hallucinated_evidence_id():
    """
    Test that fabricated or hallucinated evidence IDs (not in context catalog)
    are strictly caught, rejected, and logged in hallucinated_citations.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    # Inject a hallucinated evidence citation into verified facts
    result.investigation.verified_facts.append(
        FactItem(
            claim="Customer stated they plan to migrate to Competitor X next week.",
            evidence_ids=["EVID-HALLUCINATED-9999"],
            type="observed_fact",
            source_category="email"
        )
    )

    validator = OutputValidator()
    val_res = validator.validate_orchestrated_result(result)

    assert val_res.is_valid is False
    assert val_res.evidence_citations_valid is False
    assert "EVID-HALLUCINATED-9999" in val_res.hallucinated_citations
    assert any("Hallucinated evidence citation" in v for v in val_res.violations)


def test_validator_catches_cross_account_leakage():
    """
    Test that evidence or records belonging to a different account
    trigger account ownership violations.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    # Simulate cross-account leakage in action plan
    result.action_plan.account_id = "acc-999-OTHER-TENANT"

    validator = OutputValidator()
    val_res = validator.validate_orchestrated_result(result)

    assert val_res.is_valid is False
    assert val_res.account_ownership_valid is False
    assert len(val_res.ownership_violations) > 0
    assert any("Cross-account leak" in v for v in val_res.violations)


def test_validator_enforces_deterministic_supremacy():
    """
    Test that an LLM cannot alter the authoritative risk score.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    # Attempt to artificially modify the score in the autopsy
    result.investigation.authoritative_risk_score = 12

    validator = OutputValidator()
    val_res = validator.validate_orchestrated_result(result)

    assert val_res.is_valid is False
    assert val_res.deterministic_supremacy_valid is False
    assert any("Deterministic supremacy violation" in v for v in val_res.violations)


def test_validator_enforces_human_in_the_loop_guardrail():
    """
    Test that proposed actions cannot bypass human approval by marking themselves as 'executed' or 'approved'.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    # Bypass approval
    result.action_plan.status = "executing"

    validator = OutputValidator()
    val_res = validator.validate_orchestrated_result(result)

    assert val_res.is_valid is False
    assert val_res.human_approval_guardrail_valid is False
    assert any("Human-in-the-loop violation" in v for v in val_res.violations)


def test_sanitize_citations_utility():
    """
    Test that sanitize_citations safely purges invalid IDs while preserving valid ones.
    """
    orchestrator = AgentOrchestrator()
    result = orchestrator.orchestrate_account("acc-101")

    valid_id = result.context.selected_evidence[0].evidence_id

    # Add both a valid and an invalid citation
    result.investigation.verified_facts.append(
        FactItem(
            claim="Mixed citation test",
            evidence_ids=[valid_id, "EVID-FAKE-BAD-ID"],
            type="observed_fact"
        )
    )

    validator = OutputValidator()
    sanitized = validator.sanitize_citations(result)

    last_fact = sanitized.investigation.verified_facts[-1]
    assert valid_id in last_fact.evidence_ids
    assert "EVID-FAKE-BAD-ID" not in last_fact.evidence_ids
