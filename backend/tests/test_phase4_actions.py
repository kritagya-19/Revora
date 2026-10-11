import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import ActionStatus
from app.services.proposal_repository import proposal_repo
from app.services.action_executor import action_executor

client = TestClient(app)

def test_phase4_draft_actions_generation():
    """
    Phase 4: Verify generation of draft email, follow-up task, and CRM update
    grounded in account evidence and investigation.
    """
    account_id = "acc-101"
    response = client.post(f"/api/accounts/{account_id}/actions/draft")
    assert response.status_code == 200, f"Draft action failed: {response.text}"
    
    data = response.json()
    assert "email_draft" in data
    assert "task_draft" in data
    assert "crm_update" in data
    
    # 1. Draft Email assertions
    email = data["email_draft"]
    assert "recipient" in email and "@" in email["recipient"]
    assert "subject" in email and len(email["subject"]) > 5
    assert "body" in email and len(email["body"]) > 20
    assert "reason" in email
    
    # 2. Follow-up Task assertions
    task = data["task_draft"]
    assert "title" in task and len(task["title"]) > 5
    assert "description" in task
    assert "assigned_to" in task
    assert "due_date" in task
    assert "priority" in task
    
    # 3. CRM Update assertions
    crm = data["crm_update"]
    assert "field_name" in crm
    assert "proposed_value" in crm
    assert "reason" in crm


def test_phase4_save_proposals_for_each_type():
    """
    Phase 4: Verify saving each proposal (email, task, CRM update) to persistent store.
    """
    account_id = "acc-102"
    draft_res = client.post(f"/api/accounts/{account_id}/actions/draft")
    assert draft_res.status_code == 200
    drafts = draft_res.json()
    
    # 1. Save Email proposal
    email_res = client.post("/api/action-proposals", json={
        "account_id": account_id,
        "action_type": "csm_email",
        "title": drafts["email_draft"]["subject"],
        "reason": drafts["email_draft"]["reason"],
        "payload": {
            "recipient": drafts["email_draft"]["recipient"],
            "subject": drafts["email_draft"]["subject"],
            "body": drafts["email_draft"]["body"]
        },
        "evidence_ids": drafts["email_draft"].get("evidence_ids", [])
    })
    assert email_res.status_code == 200
    email_prop = email_res.json()
    assert email_prop["status"] == "proposed"
    assert email_prop["version"] == 1
    assert email_prop["content_hash"] is not None
    
    # 2. Save Task proposal
    task_res = client.post("/api/action-proposals", json={
        "account_id": account_id,
        "action_type": "task_create",
        "title": drafts["task_draft"]["title"],
        "reason": drafts["task_draft"]["description"],
        "payload": {
            "title": drafts["task_draft"]["title"],
            "description": drafts["task_draft"]["description"],
            "assigned_to": drafts["task_draft"]["assigned_to"],
            "due_date": drafts["task_draft"]["due_date"],
            "priority": drafts["task_draft"]["priority"]
        },
        "evidence_ids": drafts["task_draft"].get("evidence_ids", [])
    })
    assert task_res.status_code == 200
    task_prop = task_res.json()
    assert task_prop["status"] == "proposed"
    
    # 3. Save CRM Update proposal
    crm_res = client.post("/api/action-proposals", json={
        "account_id": account_id,
        "action_type": "crm_update",
        "title": f"Update CRM {drafts['crm_update']['field_name']}",
        "reason": drafts["crm_update"]["reason"],
        "payload": {
            "field_name": drafts["crm_update"]["field_name"],
            "current_value": drafts["crm_update"].get("current_value", "Standard"),
            "proposed_value": drafts["crm_update"]["proposed_value"]
        },
        "evidence_ids": drafts["crm_update"].get("evidence_ids", [])
    })
    assert crm_res.status_code == 200
    crm_prop = crm_res.json()
    assert crm_prop["status"] == "proposed"
    
    # Verify all 3 are retrievable for account
    list_res = client.get(f"/api/action-proposals/account/{account_id}")
    assert list_res.status_code == 200
    account_props = list_res.json()
    saved_ids = {p["id"] for p in account_props}
    assert email_prop["id"] in saved_ids
    assert task_prop["id"] in saved_ids
    assert crm_prop["id"] in saved_ids


def test_phase4_unapproved_actions_cannot_execute():
    """
    Phase 4 Done Criteria: Unapproved actions cannot execute.
    Attempts to execute a newly proposed action must be strictly blocked with HTTP 403.
    """
    # Create proposal in PROPOSED state
    create_res = client.post("/api/action-proposals", json={
        "account_id": "acc-103",
        "action_type": "csm_email",
        "title": "Unapproved Outreach Test",
        "reason": "Testing gate security",
        "payload": {
            "recipient": "security@test.com",
            "subject": "Security Gate Verification",
            "body": "This action must not execute without approval."
        }
    })
    assert create_res.status_code == 200
    prop_id = create_res.json()["id"]
    
    # Direct execution attempt must fail
    exec_res = client.post(f"/api/action-proposals/{prop_id}/execute")
    assert exec_res.status_code == 403
    assert "Action execution blocked" in exec_res.json()["detail"]
    assert "not 'approved'" in exec_res.json()["detail"]


def test_phase4_edit_invalidates_prior_approval_and_increments_version():
    """
    Phase 4 Done Criteria: Editing changes persisted state correctly and invalidates prior approval.
    """
    # Create proposal
    create_res = client.post("/api/action-proposals", json={
        "account_id": "acc-104",
        "action_type": "crm_update",
        "title": "CRM Health Tier Downgrade",
        "reason": "Usage decline",
        "payload": {
            "field_name": "Tier",
            "current_value": "Tier 1",
            "proposed_value": "At Risk"
        }
    })
    assert create_res.status_code == 200
    initial_prop = create_res.json()
    prop_id = initial_prop["id"]
    initial_hash = initial_prop["content_hash"]
    
    # Step 1: Approve proposal
    appr_res = client.post(f"/api/approvals/{prop_id}/approve", json={
        "approver": "CSM Manager John",
        "expected_hash": initial_hash,
        "auto_execute": False
    })
    assert appr_res.status_code == 200
    assert appr_res.json()["proposal"]["status"] == "approved"
    
    # Step 2: Edit proposal via PUT
    edit_res = client.put(f"/api/action-proposals/{prop_id}", json={
        "title": "CRM Health Tier Downgrade (Critical Urgency)",
        "payload": {
            "field_name": "Tier",
            "current_value": "Tier 1",
            "proposed_value": "Critical Churn Imminent"
        }
    })
    assert edit_res.status_code == 200
    edited_prop = edit_res.json()
    
    # Assertions on edited state
    assert edited_prop["version"] == 2
    assert edited_prop["content_hash"] != initial_hash
    assert edited_prop["status"] == "proposed"  # Must revert back to proposed!
    assert edited_prop["approved_by"] is None
    
    # Step 3: Stale approval attempt using initial hash must be rejected
    stale_appr_res = client.post(f"/api/approvals/{prop_id}/approve", json={
        "approver": "CSM Manager John",
        "expected_hash": initial_hash,
        "auto_execute": False
    })
    assert stale_appr_res.status_code == 409
    assert "Stale approval error" in stale_appr_res.json()["detail"]


def test_phase4_approve_and_execute_in_demo_environment():
    """
    Phase 4 Done Criteria: Approve changes persisted state correctly;
    execute approved actions in a demo environment and record their outcomes.
    """
    create_res = client.post("/api/action-proposals", json={
        "account_id": "acc-105",
        "action_type": "csm_email",
        "title": "Demo Environment Outreach Execution",
        "reason": "Executive touchpoint",
        "payload": {
            "recipient": "cto@innovatehealth.org",
            "subject": "Platform Optimization Strategy",
            "body": "Hi CTO, we would love to review recent telemetry and resolve tickets."
        }
    })
    assert create_res.status_code == 200
    prop = create_res.json()
    prop_id = prop["id"]
    
    # Approve and auto-execute in demo environment
    appr_res = client.post(f"/api/approvals/{prop_id}/approve", json={
        "approver": "Sarah Jenkins (CSM Lead)",
        "expected_hash": prop["content_hash"],
        "auto_execute": True
    })
    assert appr_res.status_code == 200
    data = appr_res.json()
    
    # Assertions on execution outcome
    assert data["approval_status"] == "approved"
    assert "execution" in data
    execution = data["execution"]
    assert execution["status"] == "succeeded"
    assert execution["mode"] == "simulated"
    assert "execution_id" in execution
    assert execution["simulated_details"]["provider_code"] == 200
    
    # Verify persisted proposal reflects outcome
    fetched = client.get(f"/api/action-proposals/{prop_id}").json()
    assert fetched["status"] in ("approved", "succeeded")
    assert fetched["execution_result"] is not None
    assert fetched["execution_result"]["status"] == "succeeded"


def test_phase4_reject_blocks_execution_and_persists_reason():
    """
    Phase 4 Done Criteria: Reject changes persisted state correctly and blocks execution permanently.
    """
    create_res = client.post("/api/action-proposals", json={
        "account_id": "acc-106",
        "action_type": "crm_update",
        "title": "Unnecessary CRM Override",
        "reason": "Erroneous risk flag",
        "payload": {
            "field_name": "Risk Tier",
            "current_value": "Healthy",
            "proposed_value": "Critical"
        }
    })
    assert create_res.status_code == 200
    prop_id = create_res.json()["id"]
    
    # Reject proposal
    reject_res = client.post(f"/api/approvals/{prop_id}/reject", json={
        "reason": "Account renewal was finalized yesterday offline. Risk flag unwarranted.",
        "reviewer": "Director of Customer Success"
    })
    assert reject_res.status_code == 200
    data = reject_res.json()
    assert data["approval_status"] == "rejected"
    assert "Account renewal was finalized" in data["decision_reason"]
    
    # Verify persisted state is rejected
    prop_state = client.get(f"/api/action-proposals/{prop_id}").json()
    assert prop_state["status"] == "rejected"
    
    # Subsequent execution attempt must be strictly blocked
    exec_res = client.post(f"/api/action-proposals/{prop_id}/execute")
    assert exec_res.status_code == 403
    assert "is in status 'rejected'" in exec_res.json()["detail"]
