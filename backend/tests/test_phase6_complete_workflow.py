import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import (
    ActionStatus,
    SurveyStatus,
    CreateFeedbackSurveyRequest,
    SurveyDeliveryChannel
)
from app.services.account_repository import account_repo
from app.services.feedback_repository import feedback_repo
from app.services.feedback_service import feedback_service
from app.services.proposal_repository import proposal_repo
from app.services.action_tracker_repository import action_tracker_repo
from app.services.action_executor import action_executor

client = TestClient(app)

def test_complete_phase6_feedback_loop_workflow():
    """
    Phase 6 Comprehensive Integration Test:
    1. Risk Detection -> Feedback Trigger Rules firing
    2. Dispatch generation & Duplicate / Cooldown prevention
    3. Customer Form retrieval and submission
    4. AI Feedback Analysis (root cause, uncertainties, proposals)
    5. MongoDB persistence verification (surveys, records, proposals)
    6. Strict security guard: Unapproved & Rejected actions CANNOT execute
    7. Human Approval -> Gated Execution -> Action Tracker & Audit Sync
    """
    target_account_id = "acc-101"
    account = account_repo.get_account_by_id(target_account_id)
    assert account is not None, f"Account {target_account_id} must exist"

    # ==========================================
    # Step 1: Risk Detection & Trigger Evaluation
    # ==========================================
    trigger_check = feedback_service.evaluate_trigger_eligibility(target_account_id, force_ignore_cooldown=True)
    assert trigger_check.account_id == target_account_id
    # Account 101 has high risk (usage drop, open bugs, or renewal window)
    assert len(trigger_check.matched_rules) > 0
    assert len(trigger_check.reasons) > 0

    # ==========================================
    # Step 2: Survey Dispatch & Cooldown Guard
    # ==========================================
    req = CreateFeedbackSurveyRequest(
        account_id=target_account_id,
        template_id="survey-tpl-churn-early-warning",
        recipient_name="David Vance",
        recipient_email="cto@acme.com",
        delivery_channel=SurveyDeliveryChannel.EMAIL,
        custom_intro_message="Please share feedback to help us unblock your team.",
        trigger_context={"rules": [r.rule_id for r in trigger_check.matched_rules]}
    )
    dispatch = feedback_service.dispatch_survey(req)
    assert dispatch.id is not None
    assert dispatch.survey_code is not None
    assert dispatch.status in (SurveyStatus.PENDING, SurveyStatus.SENT)

    # Verify Cooldown / Duplicate Prevention: Immediate second check must detect cooldown/pending
    cooldown_check = feedback_service.evaluate_trigger_eligibility(target_account_id)
    assert cooldown_check.cooldown_active is True or cooldown_check.duplicate_pending_survey is True
    assert cooldown_check.eligible is False, "Duplicate survey dispatch must be blocked during cooldown/pending period"

    # ==========================================
    # Step 3: Customer Form Retrieval & Submission
    # ==========================================
    form_resp = client.get(f"/api/feedback/form/{dispatch.survey_code}")
    assert form_resp.status_code == 200
    form_data = form_resp.json()
    assert form_data["survey_code"] == dispatch.survey_code
    assert form_data["account_id"] == target_account_id
    assert len(form_data["template"]["questions"]) >= 3

    # Customer submits feedback with critical blocker
    submission_payload = {
        "survey_code": dispatch.survey_code,
        "account_id": target_account_id,
        "respondent_email": "cto@acme.com",
        "respondent_name": "David Vance",
        "satisfaction_score": 3,
        "usage_trend_self_report": "dropped",
        "primary_blocker": "Okta SSO SAML assertion timeout during peak login hours",
        "unresolved_issues": "Engineering team unable to access workspace intermittently",
        "feature_improvement_request": "Dedicated engineer to pair on identity provider fix",
        "csm_followup_opt_in": True
    }
    submit_resp = client.post("/api/feedback/submit", json=submission_payload)
    assert submit_resp.status_code == 200, submit_resp.text
    record = submit_resp.json()
    assert record["account_id"] == target_account_id
    assert record["submission"]["satisfaction_score"] == 3
    assert "analysis" in record
    analysis = record["analysis"]
    assert analysis["classified_churn_reason"] is not None
    assert len(analysis["uncertainties"]) >= 1
    assert "interpretation" in analysis["rule_notice"].lower()

    # ==========================================
    # Step 4: MongoDB Persistence Verification
    # ==========================================
    # Survey dispatch updated to completed
    persisted_dispatch = feedback_repo.get_survey_by_code(dispatch.survey_code)
    assert persisted_dispatch is not None
    assert persisted_dispatch.status == SurveyStatus.COMPLETED

    # Feedback record persisted
    persisted_record = feedback_repo.get_feedback_record_by_id(record["id"])
    assert persisted_record is not None
    assert persisted_record.recipient_email == "cto@acme.com"

    # Listed responses for this account
    account_records = feedback_repo.list_feedback_records(account_id=target_account_id)
    assert any(r.id == record["id"] for r in account_records)

    # Proposals generated in repository
    record_id = record["id"]
    email_prop_id = f"prop-fb-email-{record_id}"
    task_prop_id = f"prop-fb-task-{record_id}"
    crm_prop_id = f"prop-fb-crm-{record_id}"

    email_prop = proposal_repo.get_proposal_by_id(email_prop_id)
    assert email_prop is not None
    assert email_prop.status == ActionStatus.PROPOSED
    assert email_prop.content_hash is not None

    task_prop = proposal_repo.get_proposal_by_id(task_prop_id)
    assert task_prop is not None
    assert task_prop.status == ActionStatus.PROPOSED

    crm_prop = proposal_repo.get_proposal_by_id(crm_prop_id)
    assert crm_prop is not None
    assert crm_prop.status == ActionStatus.PROPOSED

    # ==========================================
    # Step 5: Strict Security Guardrail:
    # Unapproved Proposals CANNOT Execute
    # ==========================================
    # A) Attempt to execute proposal while still in PROPOSED status
    async def try_execute_unapproved():
        return await action_executor.execute(email_prop)

    loop = asyncio.new_event_loop()
    with pytest.raises((PermissionError, ValueError), match="Action execution blocked"):
        loop.run_until_complete(try_execute_unapproved())

    # B) Reject CRM proposal and verify execution is blocked
    reject_resp = client.post(f"/api/approvals/{crm_prop_id}/reject", json={
        "reviewer": "CSM Director Marcus",
        "reason": "CRM update postponed until live call with customer"
    })
    assert reject_resp.status_code == 200
    rejected_crm_prop = proposal_repo.get_proposal_by_id(crm_prop_id)
    assert rejected_crm_prop.status == ActionStatus.REJECTED

    async def try_execute_rejected():
        return await action_executor.execute(rejected_crm_prop)

    with pytest.raises((PermissionError, ValueError), match="Action execution blocked"):
        loop.run_until_complete(try_execute_rejected())

    # ==========================================
    # Step 6: Human Approval Gate & Execution
    # ==========================================
    # Approve the Task Proposal
    approve_resp = client.post(f"/api/approvals/{task_prop_id}/approve", json={
        "approver": "CSM Lead Marcus",
        "expected_hash": task_prop.content_hash
    })
    assert approve_resp.status_code == 200
    approve_result = approve_resp.json()
    assert approve_result["approval_status"] == "approved"
    assert approve_result["execution"]["status"] in ("succeeded", "completed", "scheduled", "simulated", "executed")

    # ==========================================
    # Step 7: Outcome Tracker & Audit History Sync
    # ==========================================
    tracked_items = action_tracker_repo.get_all(account_id=target_account_id)
    synced_items = [item for item in tracked_items if item.proposal_id == task_prop_id]
    assert len(synced_items) >= 1
    assert synced_items[0].action_type == "task_assignment"

    # Audit history validation
    audit_logs = proposal_repo.get_all_audit_logs(limit=50)
    task_audit_events = [log for log in audit_logs if log.get("proposal_id") == task_prop_id]
    assert len(task_audit_events) >= 1
    assert any("approved" in log.get("event_type", "") for log in task_audit_events)
