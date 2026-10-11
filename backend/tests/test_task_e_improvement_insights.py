import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.improvement_insights_service import improvement_insights_service
from app.models.schemas import (
    ImprovementCategory,
    ImprovementStatus,
    BehavioralOutcomeVerdict,
    ImplementImprovementRequest,
    EvaluateImprovementOutcomeRequest,
)

client = TestClient(app)

def test_get_improvement_insights_report_service():
    """
    Verifies that the improvement insights service generates multi-disciplinary recommendations
    covering Onboarding, Customer Training, Product Changes, and Documentation & Process.
    """
    report = improvement_insights_service.get_insights_report()
    assert report.total_insights >= 5
    assert report.total_arr_protected > 0
    assert len(report.insights) >= 5

    categories_found = {i.category for i in report.insights}
    assert ImprovementCategory.ONBOARDING_IMPROVEMENT in categories_found
    assert ImprovementCategory.CUSTOMER_TRAINING in categories_found
    assert ImprovementCategory.PRODUCT_CHANGE in categories_found
    assert ImprovementCategory.DOCUMENTATION_PROCESS in categories_found

    # Check that each insight links affected customers and protected ARR
    for insight in report.insights:
        assert len(insight.affected_customers) > 0
        assert insight.total_arr_protected > 0
        assert insight.recommended_action != ""
        assert insight.rationale != ""
        assert insight.target_audience != ""

def test_insights_filtering_service():
    """
    Tests category and status filtering logic in the insights service.
    """
    # Category filter
    prod_report = improvement_insights_service.get_insights_report(category=ImprovementCategory.PRODUCT_CHANGE.value)
    for insight in prod_report.insights:
        assert insight.category == ImprovementCategory.PRODUCT_CHANGE

    # Status filter
    impl_report = improvement_insights_service.get_insights_report(status=ImprovementStatus.IMPLEMENTED.value)
    for insight in impl_report.insights:
        assert insight.status == ImprovementStatus.IMPLEMENTED

def test_implement_improvement_lifecycle():
    """
    Verifies that a manager can adopt and implement a recommended initiative,
    transitioning its state to IMPLEMENTED and initializing subsequent behavioral telemetry tracking.
    """
    req = ImplementImprovementRequest(
        manager_name="Elena Vance (Director of CS)",
        implementation_notes="Rolled out automated materialized views across top 5 high-data accounts."
    )

    updated = improvement_insights_service.implement_improvement("imp-ins-04", req)
    assert updated.status == ImprovementStatus.IMPLEMENTED
    assert updated.implemented_by == "Elena Vance (Director of CS)"
    assert updated.implemented_at is not None
    assert updated.subsequent_behavior is not None
    assert updated.subsequent_behavior.verdict == BehavioralOutcomeVerdict.PENDING_DATA
    assert "Elena Vance" in updated.subsequent_behavior.behavior_summary

def test_evaluate_subsequent_behavior_tracking():
    """
    Verifies behavioral telemetry evaluation after an intervention is adopted,
    including usage delta computation and verdict determination.
    """
    # Automated telemetry evaluation
    evaluated = improvement_insights_service.evaluate_subsequent_behavior("imp-ins-04")
    assert evaluated.subsequent_behavior is not None
    assert evaluated.subsequent_behavior.usage_delta_pct >= 0.0
    assert evaluated.subsequent_behavior.verdict in [
        BehavioralOutcomeVerdict.IMPROVING,
        BehavioralOutcomeVerdict.STABLE,
        BehavioralOutcomeVerdict.DETERIORATING
    ]
    assert evaluated.subsequent_behavior.last_evaluated_at is not None

    # CSM manual evaluation override
    override_req = EvaluateImprovementOutcomeRequest(
        override_verdict=BehavioralOutcomeVerdict.IMPROVING,
        evaluation_notes="QBR confirmed executive team thrilled with sub-second report loads."
    )
    overridden = improvement_insights_service.evaluate_subsequent_behavior("imp-ins-04", override_req)
    assert overridden.subsequent_behavior.verdict == BehavioralOutcomeVerdict.IMPROVING
    assert "QBR confirmed executive team thrilled" in overridden.subsequent_behavior.behavior_summary

def test_api_improvement_insights_endpoints():
    """
    Tests end-to-end FastAPI HTTP endpoints:
    - GET /api/improvement-insights
    - GET /api/improvement-insights/{id}
    - POST /api/improvement-insights/{id}/implement
    - POST /api/improvement-insights/{id}/evaluate
    """
    # 1. GET /api/improvement-insights
    res = client.get("/api/improvement-insights")
    assert res.status_code == 200
    data = res.json()
    assert "insights" in data
    assert data["total_insights"] >= 5
    assert data["total_arr_protected"] > 0

    # 2. GET /api/improvement-insights/{id}
    res_single = client.get("/api/improvement-insights/imp-ins-01")
    assert res_single.status_code == 200
    single_data = res_single.json()
    assert single_data["id"] == "imp-ins-01"
    assert "HyperScale Labs" in single_data["affected_customers"]

    # 3. POST /api/improvement-insights/{id}/implement
    impl_res = client.post(
        "/api/improvement-insights/imp-ins-01/implement",
        json={"manager_name": "Devin Cole (Head of Infra)", "implementation_notes": "Kafka retry buffer enabled in v2.4"}
    )
    assert impl_res.status_code == 200
    impl_data = impl_res.json()
    assert impl_data["status"] == "implemented"
    assert impl_data["implemented_by"] == "Devin Cole (Head of Infra)"

    # 4. POST /api/improvement-insights/{id}/evaluate
    eval_res = client.post(
        "/api/improvement-insights/imp-ins-01/evaluate",
        json={"override_verdict": "improving", "evaluation_notes": "Zero webhook delivery drops logged in 48 hours."}
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["subsequent_behavior"]["verdict"] == "improving"
    assert "Zero webhook delivery drops" in eval_data["subsequent_behavior"]["behavior_summary"]
