import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.recurring_problem_service import recurring_problem_service
from app.services.feedback_service import feedback_service
from app.models.schemas import (
    RelationshipType,
    RootCauseStatus,
    FeedbackResponseSubmission
)

client = TestClient(app)

def test_recurring_problems_group_feedback_support_and_usage():
    """
    Task D Requirement:
    - Group related feedback, support issues, and usage patterns across customers.
    - Identify repeated complaints or adoption difficulties.
    """
    report = recurring_problem_service.get_recurring_problems_report()
    assert report is not None
    assert report.total_problems_identified > 0
    assert len(report.problems) > 0

    # At least two major technical categories should be identified from existing seeds
    categories = [p.category for p in report.problems]
    assert any("Webhook" in c or "API" in c for c in categories)
    assert any("Authentication" in c or "Access" in c for c in categories)

    # Every identified problem must have non-empty adoption difficulties & repeated complaints
    for prob in report.problems:
        assert len(prob.adoption_difficulties) > 0
        assert len(prob.repeated_complaints) > 0
        assert prob.frequency_score > 0
        assert prob.total_affected_accounts > 0
        assert prob.total_arr_affected > 0


def test_link_findings_to_accounts_and_records():
    """
    Task D Requirement:
    - Link each finding to the accounts and records that support it.
    """
    report = recurring_problem_service.get_recurring_problems_report()
    
    # Locate Webhook problem
    webhook_prob = next((p for p in report.problems if "webhook" in p.cluster_key), None)
    assert webhook_prob is not None, "Webhook ingestion issue cluster must exist"

    # Check affected accounts linkage
    assert len(webhook_prob.affected_accounts) > 0
    for acc in webhook_prob.affected_accounts:
        assert acc.account_id is not None
        assert acc.account_name is not None
        assert acc.arr > 0
        assert acc.evidence_count > 0

    # Check granular evidence links
    assert len(webhook_prob.evidence_links) > 0
    has_feedback = any(e.evidence_type == "feedback" for e in webhook_prob.evidence_links)
    has_ticket_or_usage = any(e.evidence_type in ("support_ticket", "usage_signal") for e in webhook_prob.evidence_links)
    
    assert has_feedback or has_ticket_or_usage
    for ev in webhook_prob.evidence_links:
        assert ev.record_id is not None
        assert ev.account_id is not None
        assert ev.description_or_quote is not None
        assert len(ev.description_or_quote) > 0


def test_distinguish_correlation_from_root_cause():
    """
    Task D Critical Requirement:
    - Distinguish an observed correlation from a confirmed root cause.
    - The system must not claim that a feature caused churn merely because declining usage and complaints occur together.
    """
    report = recurring_problem_service.get_recurring_problems_report()

    for prob in report.problems:
        # Relationship type must be explicitly observed_correlation, not claimed root cause
        assert prob.relationship_type == RelationshipType.OBSERVED_CORRELATION
        assert prob.root_cause_status != RootCauseStatus.CONFIRMED_ROOT_CAUSE

        # Must provide explicit correlation explanation
        assert prob.correlation_explanation is not None
        assert len(prob.correlation_explanation) > 20
        assert "correlation" in prob.correlation_explanation.lower()

        # Must specify empirical investigation needed to test causality
        assert prob.investigation_needed is not None
        assert len(prob.investigation_needed) > 20

        # Must list confounding factors to prevent false attribution
        assert len(prob.confounding_factors) >= 2


def test_dynamic_recalculation_with_new_feedback():
    """
    Task D Automation & Dynamic Behavior:
    - When new feedback arrives from a customer account, recurring problem metrics
      dynamically update with the new evidence.
    """
    # 1. Fetch baseline report
    baseline = recurring_problem_service.get_recurring_problems_report()
    sso_prob_before = next((p for p in baseline.problems if "sso" in p.cluster_key), None)
    assert sso_prob_before is not None
    initial_fb_count = sso_prob_before.feedback_count

    # 2. Submit new survey response from CloudNova Technologies (acc-102) citing SAML Okta friction
    new_sub = FeedbackResponseSubmission(
        survey_code="test-dynamic-sso-01",
        account_id="acc-102",
        respondent_email="marcus.security@cloudnova.io",
        respondent_name="Marcus Vance",
        satisfaction_score=2,
        usage_trend_self_report="Usage dropped significantly due to workflow blockers",
        primary_blocker="Authentication / SSO or permissions issues",
        unresolved_issues="Okta SAML handshake error keeps blocking our 40 new engineers from logging in.",
        feature_improvement_request="Automated Okta certificate verification test button."
    )
    saved_record = feedback_service.submit_and_analyze_feedback(new_sub)
    assert saved_record is not None
    assert saved_record.id is not None

    # 3. Recalculate recurring problems
    updated = recurring_problem_service.get_recurring_problems_report()
    sso_prob_after = next((p for p in updated.problems if "sso" in p.cluster_key), None)
    assert sso_prob_after is not None

    # Feedback count should increase dynamically
    assert sso_prob_after.feedback_count == initial_fb_count + 1

    # Evidence links must contain the newly submitted feedback record
    new_evidence = next((e for e in sso_prob_after.evidence_links if e.record_id == saved_record.id), None)
    assert new_evidence is not None
    assert new_evidence.account_id == "acc-102"
    assert "Okta SAML" in new_evidence.description_or_quote


def test_api_endpoints_recurring_problems():
    """
    Task D API Endpoints Verification:
    - GET /api/recurring-problems
    - POST /api/recurring-problems/refresh
    - GET /api/recurring-problems/{id}
    - GET /api/recurring-problems/account/{account_id}
    """
    # 1. GET Report
    res = client.get("/api/recurring-problems")
    assert res.status_code == 200
    data = res.json()
    assert "problems" in data
    assert "total_problems_identified" in data
    assert data["total_problems_identified"] > 0
    prob_id = data["problems"][0]["id"]

    # 2. GET by ID
    res_detail = client.get(f"/api/recurring-problems/{prob_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == prob_id
    assert "evidence_links" in detail
    assert "correlation_explanation" in detail
    assert detail["relationship_type"] == "observed_correlation"

    # 3. POST Refresh
    res_refresh = client.post("/api/recurring-problems/refresh")
    assert res_refresh.status_code == 200
    refreshed_data = res_refresh.json()
    assert refreshed_data["total_problems_identified"] >= data["total_problems_identified"]

    # 4. GET by Account
    acc_id = data["problems"][0]["affected_accounts"][0]["account_id"]
    res_acc = client.get(f"/api/recurring-problems/account/{acc_id}")
    assert res_acc.status_code == 200
    acc_problems = res_acc.json()
    assert isinstance(acc_problems, list)
    assert len(acc_problems) > 0
