import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.post_action_cycle_service import post_action_cycle_service
from app.services.action_tracker_repository import action_tracker_repo
from app.services.reminder_service import reminder_service
from app.models.schemas import (
    PostActionVerdict,
    EvaluatePostActionCycleRequest,
    TriggerSecondaryReviewRequest
)

client = TestClient(app)

def test_track_what_happened_after_approved_action():
    """
    Task C Requirement 1 & 2:
    Tracks what happened after an approved action, retrieving subsequent usage,
    engagement, and feedback signals from the data pipeline.
    """
    cycle = post_action_cycle_service.get_cycle_for_action("act-track-101")
    assert cycle is not None
    assert cycle.action_tracker_id == "act-track-101"
    assert cycle.account_name == "Acme Technologies"
    assert cycle.subsequent_signals_count > 0
    assert len(cycle.subsequent_signals_summary) > 0
    assert cycle.executed_at != ""

def test_compare_state_before_and_after_intervention():
    """
    Task C Requirement 3:
    Compares the customer's state before and after the intervention:
    - baseline usage vs subsequent usage
    - prior tickets vs subsequent tickets
    - prior risk score vs subsequent risk score
    - follow-up survey feedback
    """
    cycle = post_action_cycle_service.get_cycle_for_action("act-track-101")
    assert cycle is not None

    comp = cycle.state_comparison
    assert comp.usage_baseline > 0
    assert comp.subsequent_usage_avg > 0
    assert comp.subsequent_usage_delta_pct == pytest.approx(20.8, abs=0.5)
    assert comp.tickets_count_prior >= 1
    assert comp.subsequent_tickets_count == 0
    assert comp.risk_score_prior > comp.subsequent_risk_score

def test_record_whether_situation_improved_unchanged_or_deteriorated():
    """
    Task C Requirement 4:
    Verifies recording of the three possible outcomes:
    - improved
    - remained_unchanged
    - deteriorated
    """
    # 1. Improved
    cycle_improved = post_action_cycle_service.get_cycle_for_action("act-track-101")
    assert cycle_improved is not None
    assert cycle_improved.verdict == PostActionVerdict.IMPROVED
    assert cycle_improved.is_issue_resolved is True
    assert "rebounded" in cycle_improved.verdict_explanation.lower()

    # 2. Deteriorated
    cycle_deteriorated = post_action_cycle_service.get_cycle_for_action("act-track-102")
    assert cycle_deteriorated is not None
    assert cycle_deteriorated.verdict == PostActionVerdict.DETERIORATED
    assert cycle_deteriorated.is_issue_resolved is False
    assert cycle_deteriorated.state_comparison.subsequent_usage_delta_pct < 0

    # 3. Remained Unchanged
    cycle_unchanged = post_action_cycle_service.get_cycle_for_action("act-track-103")
    assert cycle_unchanged is not None
    assert cycle_unchanged.verdict == PostActionVerdict.REMAINED_UNCHANGED
    assert cycle_unchanged.is_issue_resolved is False

def test_trigger_another_review_when_issue_remains_unresolved():
    """
    Task C Requirement 5:
    When the situation remains unchanged or deteriorates (unresolved issue),
    the system automatically triggers another review and creates a secondary review reminder.
    """
    # Initial reminders count
    initial_reminders = reminder_service.get_reminders()
    initial_count = len(initial_reminders)

    # Evaluate action with deteriorated outcome
    req = EvaluatePostActionCycleRequest(
        override_verdict=PostActionVerdict.DETERIORATED,
        evaluator_notes="Severe webhook failure persisted after outreach. Secondary review required."
    )
    cycle = post_action_cycle_service.evaluate_post_action_cycle("act-track-104", req)

    assert cycle.verdict == PostActionVerdict.DETERIORATED
    assert cycle.is_issue_resolved is False
    assert cycle.review_triggered is True
    assert cycle.triggered_review_id is not None
    assert cycle.triggered_review_type == "secondary_autopsy_review"
    assert "Secondary review required" in cycle.triggered_review_reason

    # Verify that a secondary review reminder was automatically generated
    updated_reminders = reminder_service.get_reminders()
    assert len(updated_reminders) > initial_count

    # Test explicit manual secondary review trigger
    manual_req = TriggerSecondaryReviewRequest(
        reason="Customer sponsor requested immediate executive review",
        reviewer_name="Elena Vance (CSM Director)",
        review_urgency="critical"
    )
    reviewed = post_action_cycle_service.trigger_secondary_review("act-track-104", manual_req)
    assert reviewed.review_triggered is True
    assert reviewed.evaluated_by == "Elena Vance (CSM Director)"
    assert "Customer sponsor requested" in reviewed.triggered_review_reason

def test_api_post_action_improvement_cycle_endpoints():
    """
    Tests end-to-end FastAPI endpoints for Task C:
    - GET /api/tracker/{id}/cycle
    - POST /api/tracker/{id}/evaluate-cycle
    - POST /api/tracker/{id}/trigger-review
    - GET /api/tracker/cycles/all
    """
    # 1. GET /api/tracker/cycles/all
    res_all = client.get("/api/tracker/cycles/all")
    assert res_all.status_code == 200
    cycles = res_all.json()
    assert len(cycles) >= 3

    # 2. GET /api/tracker/{id}/cycle
    res_single = client.get("/api/tracker/act-track-101/cycle")
    assert res_single.status_code == 200
    data = res_single.json()
    assert data["action_tracker_id"] == "act-track-101"
    assert data["verdict"] == "improved"
    assert data["state_comparison"]["usage_baseline"] > 0

    # 3. POST /api/tracker/{id}/evaluate-cycle
    res_eval = client.post(
        "/api/tracker/act-track-101/evaluate-cycle",
        json={"override_verdict": "improved", "evaluator_notes": "Telemetry validated during weekly QBR"}
    )
    assert res_eval.status_code == 200
    eval_data = res_eval.json()
    assert eval_data["verdict"] == "improved"
    assert eval_data["is_issue_resolved"] is True

    # 4. POST /api/tracker/{id}/trigger-review
    res_review = client.post(
        "/api/tracker/act-track-102/trigger-review",
        json={"reason": "Customer disengagement confirmed; escalating to Director of CS", "reviewer_name": "Marcus Vance"}
    )
    assert res_review.status_code == 200
    rev_data = res_review.json()
    assert rev_data["review_triggered"] is True
    assert rev_data["evaluated_by"] == "Marcus Vance"
