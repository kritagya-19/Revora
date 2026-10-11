import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.services.proposal_repository import proposal_repo
from app.services.task_repository import task_repo
from app.services.account_repository import account_repo
from app.services.action_tracker_repository import action_tracker_repo
from app.services.action_executor import action_executor
from app.models.schemas import ActionProposal, ActionStatus

client = TestClient(app)


def test_approval_and_persistence_of_task_proposal():
    """Requirement 1 & 2: Approve task proposal and verify operational task is persisted."""
    account_id = "acc-101"
    
    # 1. Create a task proposal
    create_resp = client.post("/api/proposals", json={
        "account_id": account_id,
        "action_type": "task_create",
        "title": "Conduct Urgent SSO SAML Architecture Review",
        "reason": "SSO failures affecting 35 enterprise users",
        "payload": {
            "title": "Conduct Urgent SSO SAML Architecture Review",
            "objective": "Resolve Identity Provider handshake timeout",
            "assigned_to": "CSM Rachel",
            "due_date": "2026-10-18T18:00:00Z",
            "deadline": "2026-10-18T18:00:00Z",
            "priority": "high",
            "description": "Engage identity solutions engineer to resolve SAML handshake timeouts."
        },
        "evidence_ids": ["EVD-101", "EVD-102"]
    })
    assert create_resp.status_code == 200, create_resp.text
    prop_data = create_resp.json()
    proposal_id = prop_data["id"]
    content_hash = prop_data["content_hash"]

    # 2. Verify approvals endpoint lists it enriched
    pending_resp = client.get("/api/approvals")
    assert pending_resp.status_code == 200
    pending_list = pending_resp.json()
    found = [p for p in pending_list if p["id"] == proposal_id]
    assert len(found) == 1
    assert found[0]["action_type"] == "task_create"
    assert found[0]["customer_name"] is not None

    # 3. Approve proposal via approval endpoint
    approve_resp = client.post(f"/api/approvals/{proposal_id}/approve", json={
        "approver": "CSM Director Marcus",
        "expected_hash": content_hash
    })
    assert approve_resp.status_code == 200, approve_resp.text
    res = approve_resp.json()
    assert res["approval_status"] == "approved"
    assert "execution" in res
    assert res["execution"]["status"] in ("succeeded", "simulated")
    assert "task_id" in res["execution"]
    persisted_task_id = res["execution"]["task_id"]

    # 4. Verify task is actually persisted in task_repo
    all_tasks = task_repo.get_all_tasks()
    persisted_task = next((t for t in all_tasks if getattr(t, "id", None) == persisted_task_id), None)
    assert persisted_task is not None, f"Task {persisted_task_id} not found in task_repo"
    assert persisted_task.account_id == account_id
    assert persisted_task.title == "Conduct Urgent SSO SAML Architecture Review"
    assert persisted_task.assigned_to == "CSM Rachel"
    assert persisted_task.status in ("pending", "open", "in_progress")


def test_approval_and_persistence_of_crm_update_proposal():
    """Requirement 1 & 2: Approve CRM update and verify changes are persisted in account & CRM records."""
    account_id = "acc-102"
    
    # 1. Create a CRM update proposal
    create_resp = client.post("/api/proposals", json={
        "account_id": account_id,
        "action_type": "crm_update",
        "title": "Upgrade Churn Risk Status in CRM",
        "reason": "Executive champion departure and license downsell request",
        "payload": {
            "field_name": "churn_risk_flag",
            "current_value": "Standard",
            "proposed_value": "Critical Churn Risk",
            "supporting_rationale": "Sponsor departed; contract renewal in 35 days",
            "field_updates": [
                {
                    "field": "churn_risk_flag",
                    "current": "Standard",
                    "proposed": "Critical Churn Risk",
                    "rationale": "High risk of contract cancellation"
                },
                {
                    "field": "forecast_category",
                    "current": "Commit",
                    "proposed": "At Risk",
                    "rationale": "Uncertain renewal following stakeholder departure"
                }
            ]
        },
        "evidence_ids": ["EVD-201"]
    })
    assert create_resp.status_code == 200, create_resp.text
    prop_data = create_resp.json()
    proposal_id = prop_data["id"]
    content_hash = prop_data["content_hash"]

    # 2. Approve proposal via approval interface
    approve_resp = client.post(f"/api/approvals/{proposal_id}/approve", json={
        "approver": "CSM VP Sarah",
        "expected_hash": content_hash
    })
    assert approve_resp.status_code == 200, approve_resp.text
    res = approve_resp.json()
    assert res["approval_status"] == "approved"
    assert res["execution"]["crm_synced"] is True

    # 3. Verify CRM changes were persisted to account repository
    account = account_repo.get_account_by_id(account_id)
    assert account is not None
    # Verify account fields updated
    assert account.crm_status == "Critical Churn Risk"

    # 4. Verify CRM audit records persisted
    crm_history = account_repo.get_crm_records(account_id)
    assert len(crm_history) >= 1
    latest_rec = crm_history[-1]
    assert latest_rec["account_id"] == account_id
    assert latest_rec["approved_by"] == "CSM VP Sarah"
    assert latest_rec["proposed_value"] == "Critical Churn Risk"


@pytest.mark.asyncio
async def test_unapproved_consequential_actions_cannot_execute():
    """Requirement 3: Ensure unapproved consequential actions cannot execute under any circumstance."""
    account_id = "acc-103"
    
    # 1. Create a proposal in 'proposed' state
    create_resp = client.post("/api/proposals", json={
        "account_id": account_id,
        "action_type": "csm_email",
        "title": "Proposed Executive Outreach",
        "payload": {
            "recipient": "cto@target.com",
            "subject": "Platform Health Alignment",
            "body": "Reaching out regarding recent API latency."
        }
    })
    assert create_resp.status_code == 200
    prop_data = create_resp.json()
    proposal_id = prop_data["id"]

    # Retrieve proposal object
    prop = proposal_repo.get_proposal_by_id(proposal_id)
    assert prop.status == ActionStatus.PROPOSED
    assert prop.approved_by is None

    # 2. Direct execution via action_executor should strictly raise PermissionError
    with pytest.raises(PermissionError) as exc_info:
        await action_executor.execute(prop)
    assert "cannot be executed without human approval" in str(exc_info.value)

    # 3. HTTP direct execution endpoint should reject with 403 Forbidden
    direct_exec_resp = client.post(f"/api/proposals/{proposal_id}/execute")
    assert direct_exec_resp.status_code == 403
    assert "cannot be executed without human approval" in direct_exec_resp.json()["detail"]


@pytest.mark.asyncio
async def test_rejected_proposals_cannot_execute_or_be_approved():
    """Requirement 3: Ensure rejected proposals cannot execute and cannot be approved."""
    account_id = "acc-104"
    
    # 1. Create and reject proposal
    create_resp = client.post("/api/proposals", json={
        "account_id": account_id,
        "action_type": "task_create",
        "title": "Unapproved Aggressive Outreach Task",
        "payload": {"title": "Call CEO directly"}
    })
    assert create_resp.status_code == 200
    proposal_id = create_resp.json()["id"]

    reject_resp = client.post(f"/api/approvals/{proposal_id}/reject", json={
        "reviewer": "CSM Lead",
        "reason": "Too aggressive; prefer standard check-in"
    })
    assert reject_resp.status_code == 200

    rejected_prop = proposal_repo.get_proposal_by_id(proposal_id)
    assert rejected_prop.status == ActionStatus.REJECTED

    # 2. Execution must fail with PermissionError
    with pytest.raises(PermissionError) as exc_info:
        await action_executor.execute(rejected_prop)
    assert "status 'rejected'" in str(exc_info.value).lower()

    # 3. Attempting to approve rejected proposal must fail with 409 Conflict
    approve_resp = client.post(f"/api/approvals/{proposal_id}/approve", json={
        "approver": "CSM John",
        "expected_hash": rejected_prop.content_hash
    })
    assert approve_resp.status_code == 409


@pytest.mark.asyncio
async def test_truthful_failure_recording_and_audit():
    """Requirement 4: Record execution results and failures truthfully in proposal and audit trail."""
    account_id = "acc-105"
    
    # 1. Create a proposal with simulated failure condition
    create_resp = client.post("/api/proposals", json={
        "account_id": account_id,
        "action_type": "email",
        "title": "Email with Sim Error Simulation",
        "payload": {
            "recipient": "fail-sim@test.com",
            "subject": "Testing Failure Capture",
            "body": "This simulates upstream failure.",
            "simulate_failure": True,
            "failure_reason": "SMTP Gateway Timeout: upstream mail server 504"
        }
    })
    assert create_resp.status_code == 200
    proposal_id = create_resp.json()["id"]
    content_hash = create_resp.json()["content_hash"]

    # 2. Approve proposal so it is approved
    prop = proposal_repo.approve_proposal(proposal_id, approver="Test Runner", expected_hash=content_hash)
    assert prop.status == ActionStatus.APPROVED

    # 3. Now execute and verify truthful failure recording
    result = await action_executor.execute(prop)
    
    # Verify executor returned failure result truthfully
    assert result["status"] == "failed"
    assert "SMTP Gateway Timeout" in result["error"]

    # Verify proposal state transitioned to FAILED
    reloaded = proposal_repo.get_proposal_by_id(proposal_id)
    assert reloaded.status == ActionStatus.FAILED
    assert reloaded.execution_result["status"] == "failed"
    assert "SMTP Gateway Timeout" in reloaded.execution_result["error"]

    # Verify truthful failure event logged in immutable audit history
    audit_logs = proposal_repo.get_audit_logs_for_account(account_id)
    fail_logs = [log for log in audit_logs if log.get("event_type") == "execution_failed"]
    assert len(fail_logs) >= 1
    assert "SMTP Gateway Timeout" in fail_logs[0]["details"]["error"]
