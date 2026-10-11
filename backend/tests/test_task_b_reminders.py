import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.task_repository import task_repo
from app.services.reminder_repository import reminder_repo

client = TestClient(app)

def test_dynamic_reminders_triggered_by_conditions():
    """
    Task B Core:
    - Trigger reminders when configured conditions occur (usage drop, reduced engagement, overdue follow-up).
    - Use risk and engagement signals from the existing data pipeline.
    """
    # 1. Trigger portfolio dynamic reminder evaluation
    resp = client.post("/api/reminders/evaluate")
    assert resp.status_code == 200, resp.text
    result = resp.json()

    assert result["total_accounts_scanned"] > 0
    assert result["active_reminders_count"] > 0
    reminders = result["reminders"]

    # Verify types of reminders generated from pipeline signals
    reminder_types = {r["reminder_type"] for r in reminders}
    assert "usage_drop" in reminder_types, "Usage drop condition did not trigger reminders"
    assert "reduced_engagement" in reminder_types, "Reduced engagement condition did not trigger reminders"

    # Verify each reminder is linked to evidence IDs and has valid trigger condition
    for r in reminders[:5]:
        assert r["account_id"] != ""
        assert r["account_name"] != ""
        assert r["trigger_condition"] != ""
        assert r["issue_key"] != ""
        assert isinstance(r["evidence_ids"], list)

def test_duplicate_reminders_prevented():
    """
    Task B Core:
    - Avoid duplicate reminders for the same unresolved issue.
    """
    # Run evaluation again
    resp1 = client.post("/api/reminders/evaluate")
    assert resp1.status_code == 200
    res1 = resp1.json()

    # Second evaluation must recognize existing active issue keys and prevent duplicates
    resp2 = client.post("/api/reminders/evaluate")
    assert resp2.status_code == 200
    res2 = resp2.json()

    assert res2["duplicates_prevented"] > 0, "Deduplication guard failed to report prevented duplicates"

    # Verify no two active reminders share the exact same issue_key
    active_reminders = client.get("/api/reminders?status=active").json()
    active_keys = [r["issue_key"] for r in active_reminders]
    assert len(active_keys) == len(set(active_keys)), "Found duplicate active reminders with identical issue keys!"

def test_reminder_status_sync_when_associated_task_completed():
    """
    Task B Core:
    - Update reminder status when the associated task is completed or dismissed.
    """
    # 1. Create a task that has a linked reminder
    task_resp = client.post("/api/tasks", json={
        "account_id": "acc-102",
        "title": "Resolve Security Certificate Issue",
        "description": "Renew expired SSL certificate for auth gateway",
        "assigned_to": "Security Lead",
        "due_date": "2026-10-01", # overdue
        "priority": "high",
        "evidence_ids": ["sig-104"]
    })
    assert task_resp.status_code == 201
    task = task_resp.json()
    task_id = task["id"]

    # Run reminder evaluation to trigger overdue follow-up reminder
    client.post("/api/reminders/evaluate")

    # Find the reminder associated with this task
    reminders = client.get(f"/api/reminders?account_id=acc-102").json()
    linked = [r for r in reminders if r.get("associated_task_id") == task_id]
    assert len(linked) > 0, f"No reminder linked to overdue task {task_id}"
    rem_id = linked[0]["id"]
    assert linked[0]["status"] == "active"

    # 2. Update task status to "completed" via PATCH /api/tasks/{task_id}
    patch_resp = client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})
    assert patch_resp.status_code == 200

    # 3. Verify linked reminder is automatically updated to "completed"
    rem_check = client.get(f"/api/reminders/{rem_id}").json()
    assert rem_check["status"] == "completed", f"Reminder {rem_id} status was not updated to completed after task finished"
    assert "completed" in (rem_check["dismissed_reason"] or "").lower()

def test_manual_complete_and_dismiss_with_reason():
    """
    Test direct completion and dismissal actions with audit reason.
    """
    # 1. Create a custom reminder
    create_resp = client.post("/api/reminders", json={
        "account_id": "acc-101",
        "reminder_type": "custom",
        "title": "Quarterly Business Review Prep",
        "description": "Prepare adoption metrics deck for QBR with Acme executive team",
        "severity": "medium",
        "due_date": "2026-11-20"
    })
    assert create_resp.status_code == 201
    rem = create_resp.json()
    rem_id = rem["id"]
    assert rem["status"] == "active"

    # 2. Dismiss reminder with reason
    dismiss_resp = client.post(f"/api/reminders/{rem_id}/dismiss", json={
        "reason": "QBR rescheduled to next quarter per customer request"
    })
    assert dismiss_resp.status_code == 200
    dismissed = dismiss_resp.json()
    assert dismissed["status"] == "dismissed"
    assert dismissed["dismissed_reason"] == "QBR rescheduled to next quarter per customer request"

    # 3. Create another reminder and complete it
    c2 = client.post("/api/reminders", json={
        "account_id": "acc-101",
        "reminder_type": "custom",
        "title": "Send Onboarding Welcome Package",
        "description": "Email starter kit",
        "severity": "low"
    }).json()
    c2_id = c2["id"]

    comp_resp = client.post(f"/api/reminders/{c2_id}/complete")
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "completed"
