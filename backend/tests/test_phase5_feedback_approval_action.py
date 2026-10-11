import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.proposal_repository import proposal_repo
from app.services.action_tracker_repository import action_tracker_repo
from app.services.feedback_repository import feedback_repo

client = TestClient(app)

def test_phase5_feedback_to_approval_and_execution_lifecycle():
    # 1. Submit customer feedback indicating severe blockers
    payload = {
        "survey_code": "rev-fb-test-p5-final",
        "account_id": "acc-101",
        "respondent_email": "rachel.green@acme.com",
        "respondent_name": "Rachel Green",
        "satisfaction_score": 2,
        "usage_trend_self_report": "dropped",
        "primary_blocker": "SSO SAML authentication gateway failing with HTTP 500",
        "unresolved_issues": "35 critical users unable to log in for 3 consecutive days",
        "feature_improvement_request": "Dedicated technical support engineer resolution session",
        "csm_followup_opt_in": True,
    }
    
    resp = client.post("/api/feedback/submit", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    assert "analysis" in data
    
    response_id = data["analysis"]["response_id"]
    email_prop_id = f"prop-fb-email-{response_id}"
    task_prop_id = f"prop-fb-task-{response_id}"
    crm_prop_id = f"prop-fb-crm-{response_id}"

    # 2. Verify proposals were generated for CSM review
    p_email = proposal_repo.get_proposal_by_id(email_prop_id)
    assert p_email is not None, f"Proposal {email_prop_id} not found"
    assert p_email.status.value == "proposed"
    assert p_email.action_type == "csm_outreach_email"

    p_task = proposal_repo.get_proposal_by_id(task_prop_id)
    assert p_task is not None
    assert p_task.status.value == "proposed"
    assert p_task.action_type == "task_assignment"

    # 3. Test Human-in-the-Loop Rejection safety check (unapproved cannot execute)
    exec_resp = client.post(f"/api/approvals/{email_prop_id}/reject", json={
        "reviewer": "CSM Rachel",
        "reason": "Rejecting email in favor of direct call"
    })
    assert exec_resp.status_code == 200
    p_email_rejected = proposal_repo.get_proposal_by_id(email_prop_id)
    assert p_email_rejected.status.value == "rejected"

    # 4. Now test Human Approval Gate on the Task Proposal
    approve_resp = client.post(f"/api/approvals/{task_prop_id}/approve", json={
        "approver": "Senior CSM Lead Marcus",
        "expected_hash": p_task.content_hash
    })
    assert approve_resp.status_code == 200, approve_resp.text
    approve_data = approve_resp.json()
    assert approve_data["approval_status"] == "approved"
    assert approve_data["execution"]["status"] in ("succeeded", "completed", "scheduled", "simulated", "executed")

    # 5. Verify action execution synchronized to Action & Outcome Tracker
    all_tracked = action_tracker_repo.get_all(account_id="acc-101")
    matched_tracked = [it for it in all_tracked if it.proposal_id == task_prop_id]
    assert len(matched_tracked) > 0, f"Action not synced to action tracker for {task_prop_id}"
    tracked_action = matched_tracked[0]
    assert tracked_action.action_type == "task_assignment"

    # 6. Verify audit history records
    all_audit_logs = proposal_repo.get_all_audit_logs(limit=50)
    task_audits = [a for a in all_audit_logs if a.get("proposal_id") == task_prop_id]
    assert len(task_audits) >= 1
    event_types = [a.get("event_type") for a in task_audits]
    assert "proposal_approved" in event_types or any("approved" in et for et in event_types)
