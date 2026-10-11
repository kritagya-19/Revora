import pytest
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app
from app.core.config import settings
from app.models.schemas import (
    RiskLevel,
    SourceCategory,
    Signal,
    Contact,
    AccountRiskSummary,
    AccountDetail,
    AccountRiskDetail,
    ProposedTask,
    CustomerFeedbackRecord,
    FeedbackResponseSubmission,
    ActionTrackerItem,
    OutcomeRecord,
    ActionExecutionStatus,
    WorkStatus
)
from app.services.account_repository import AccountRepository, account_repo
from app.services.task_repository import TaskRepository, task_repo
from app.services.feedback_repository import FeedbackRepository, feedback_repo
from app.services.action_tracker_repository import ActionTrackerRepository, action_tracker_repo

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mongo_db():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
    db = client[settings.MONGODB_DB_NAME]
    return db


def test_models_and_schema_validation():
    """
    Task B Requirement 1: Verify existing database models work.
    Validates model instantiation, constraints, and serialization.
    """
    now_iso = datetime.utcnow().isoformat()
    
    # 1. Signal model validation
    sig = Signal(
        id="sig-test-validate-01",
        account_id="acc-101",
        source_category="crm",
        source_type="hubspot",
        signal_type="touchpoint_lag",
        title="CRM Activity Lag",
        summary="18 days without recorded touchpoint",
        severity="medium",
        timestamp=now_iso,
        metadata={"days": 18}
    )
    assert sig.id == "sig-test-validate-01"
    assert sig.account_id == "acc-101"
    assert sig.source_category == "crm"
    assert sig.source_type == "hubspot"
    assert sig.evidence_id.startswith("ev-")

    # 2. Task model validation
    tsk = ProposedTask(
        id="task-test-validate-01",
        account_id="acc-101",
        title="Check-in Call",
        description="Review tickets",
        assigned_to="Sarah Jenkins",
        due_date="2026-11-20",
        priority="high",
        status="pending",
        evidence_ids=["sig-101"],
        created_at=now_iso
    )
    assert tsk.id == "task-test-validate-01"
    assert tsk.priority == "high"

    # 3. Action Tracker and Outcome model validation
    out = OutcomeRecord(
        outcome_id="out-test-01",
        action_tracker_id="act-test-01",
        notes="Held meeting with client champion",
        customer_response="Agreed to review proposal",
        commitments="Send revised pricing",
        next_steps="Follow up Tuesday",
        recorded_by="CSM Owner",
        recorded_at=now_iso
    )
    assert out.outcome_id == "out-test-01"
    assert out.customer_response == "Agreed to review proposal"

    act = ActionTrackerItem(
        id="act-test-01",
        account_id="acc-101",
        account_name="Acme Technologies",
        action_type="csm_email",
        title="Send follow-up",
        action_status=ActionExecutionStatus.EXECUTED,
        work_status=WorkStatus.COMPLETED,
        assigned_to="Sarah Jenkins",
        outcome=out,
        created_at=now_iso,
        updated_at=now_iso
    )
    assert act.work_status == WorkStatus.COMPLETED
    assert act.outcome.notes == "Held meeting with client champion"


def test_source_records_customer_ids_timestamps_and_source_types(client, mongo_db):
    """
    Task B Requirement 2: Store source records with customer IDs, timestamps, and source types.
    Verifies that all stored signals have explicit customer IDs, valid timestamps, and source types.
    """
    # 1. Verify existing records in MongoDB have required provenance
    signals_in_db = list(mongo_db.signals.find({}, {"_id": 0}))
    assert len(signals_in_db) >= 15, "Expected signals in database"

    for s in signals_in_db:
        assert "account_id" in s and s["account_id"], f"Signal {s.get('id')} missing customer ID (account_id)"
        assert "timestamp" in s or "occurred_at" in s, f"Signal {s.get('id')} missing timestamp"
        assert "source_type" in s or "source_category" in s, f"Signal {s.get('id')} missing source type"
        assert "evidence_id" in s or "source_record_id" in s, f"Signal {s.get('id')} missing evidence identifier"

    # 2. Ingest a new source record via POST /api/signals
    test_sig_id = f"sig-taskb-{uuid.uuid4().hex[:6]}"
    now_iso = datetime.utcnow().isoformat()
    new_signal_payload = {
        "id": test_sig_id,
        "account_id": "acc-101",
        "source_category": "email",
        "source_type": "gmail",
        "signal_type": "executive_sentiment",
        "event_type": "email_received",
        "title": "Email: Executive Sponsor expressing renewal concern",
        "summary": "Customer asked about upcoming contract pricing and SSO stability",
        "severity": "high",
        "timestamp": now_iso,
        "metadata": {"thread_id": "th-99182", "sentiment": "negative", "sender": "d.vance@acmetechnologies.com", "sender_name": "David Vance"}
    }

    res = client.post("/api/signals", json=new_signal_payload)
    assert res.status_code == 201, f"Failed to ingest signal: {res.text}"
    created_sig = res.json()
    assert created_sig["id"] == test_sig_id
    assert created_sig["account_id"] == "acc-101"
    assert created_sig["source_category"] == "email"
    assert created_sig["source_type"] == "gmail"

    # 3. Verify it is persisted in MongoDB
    db_doc = mongo_db.signals.find_one({"id": test_sig_id})
    assert db_doc is not None
    assert db_doc["account_id"] == "acc-101"
    assert db_doc["source_type"] == "gmail"

    # 4. Verify query by API with filters
    query_res = client.get(f"/api/signals?account_id=acc-101&source_type=gmail")
    assert query_res.status_code == 200
    matched = [s for s in query_res.json() if s["id"] == test_sig_id]
    assert len(matched) == 1

    # Cleanup ephemeral test signal
    mongo_db.signals.delete_one({"id": test_sig_id})


def test_feedback_storage_and_retrieval(client, mongo_db):
    """
    Task B Requirement 3: Ensure feedback can be stored in the database and queried.
    """
    survey_code = "rev-fb-test-" + uuid.uuid4().hex[:6]
    now_iso = datetime.utcnow().isoformat()

    # Submit feedback submission
    feedback_submission = {
        "survey_code": survey_code,
        "account_id": "acc-101",
        "respondent_email": "vp.eng@acme.com",
        "respondent_name": "Dave Miller",
        "satisfaction_score": 4,
        "usage_trend_self_report": "decreased",
        "primary_blocker": "Authentication / SSO or permissions issues",
        "unresolved_issues": "SSO integration times out frequently for Europe team.",
        "feature_improvement_request": "Okta SSO v2 support and faster sync.",
        "additional_comments": "Need this fixed before Q4 renewal.",
        "submitted_at": now_iso
    }

    # Submit via POST /api/feedback
    res = client.post("/api/feedback", json=feedback_submission)
    assert res.status_code == 201, f"Feedback submission failed: {res.text}"
    record = res.json()
    record_id = record["id"]

    assert record["account_id"] == "acc-101"
    assert record["submission"]["satisfaction_score"] == 4
    assert record["analysis"] is not None
    assert record["analysis"]["classified_churn_reason"] in ["adoption_blocker", "technical_bugs", "poor_onboarding"]

    # Verify directly in MongoDB
    db_doc = mongo_db.feedback_records.find_one({"id": record_id})
    assert db_doc is not None, "Feedback record was not found in MongoDB feedback_records collection"
    assert db_doc["account_id"] == "acc-101"
    assert db_doc["submission"]["satisfaction_score"] == 4

    # Verify retrieval via GET /api/feedback/account/acc-101
    list_res = client.get("/api/feedback/account/acc-101")
    assert list_res.status_code == 200
    account_records = list_res.json()
    assert any(r["id"] == record_id for r in account_records)


def test_risk_results_storage_in_database(client, mongo_db):
    """
    Task B Requirement 3: Ensure risk results are stored in the database.
    Verifies that evaluating account risk persists the assessment document in MongoDB.
    """
    account_id = "acc-101"
    res = client.get(f"/api/accounts/{account_id}/risk")
    assert res.status_code == 200
    risk_data = res.json()

    assert risk_data["account_id"] == account_id
    assert "risk_score" in risk_data
    assert "risk_level" in risk_data
    assert "primary_reason_code" in risk_data
    assert "contributing_factors" in risk_data

    # Verify document exists in MongoDB risk_assessments collection
    db_doc = mongo_db.risk_assessments.find_one({"account_id": account_id})
    assert db_doc is not None, "Risk assessment was not persisted in MongoDB risk_assessments collection"
    assert db_doc["account_id"] == account_id
    assert db_doc["risk_score"] == risk_data["risk_score"]
    assert db_doc["risk_level"] == risk_data["risk_level"]
    assert "evaluated_at" in db_doc


def test_tasks_storage_and_updates(client, mongo_db):
    """
    Task B Requirement 3: Ensure tasks can be stored and updated in the database.
    """
    task_payload = {
        "account_id": "acc-102",
        "title": "Review SSO Migration Roadmap",
        "description": "Coordinate with Elena Rostova on ticket #4402 resolution",
        "assigned_to": "Marcus Chen",
        "due_date": "2026-11-14",
        "priority": "high",
        "evidence_ids": ["sig-104"]
    }

    # 1. Create task
    res = client.post("/api/tasks", json=task_payload)
    assert res.status_code == 201, f"Task creation failed: {res.text}"
    created_task = res.json()
    task_id = created_task["id"]
    assert created_task["account_id"] == "acc-102"
    assert created_task["status"] == "pending"

    # 2. Check persistence in MongoDB
    db_doc = mongo_db.tasks.find_one({"id": task_id})
    assert db_doc is not None, "Task was not found in MongoDB tasks collection"
    assert db_doc["title"] == "Review SSO Migration Roadmap"
    assert db_doc["status"] == "pending"

    # 3. Update task status via PATCH
    update_res = client.patch(f"/api/tasks/{task_id}", json={"status": "completed", "priority": "medium"})
    assert update_res.status_code == 200
    updated_task = update_res.json()
    assert updated_task["status"] == "completed"
    assert updated_task["priority"] == "medium"

    # 4. Verify update persisted in MongoDB
    db_doc_updated = mongo_db.tasks.find_one({"id": task_id})
    assert db_doc_updated["status"] == "completed"
    assert db_doc_updated["priority"] == "medium"


def test_action_outcomes_storage_and_retrieval(client, mongo_db):
    """
    Task B Requirement 3: Ensure action outcomes can be stored in the database.
    """
    # 1. Create action tracker item
    create_payload = {
        "account_id": "acc-103",
        "title": "Vortex APAC Telemetry Sync",
        "action_type": "csm_email",
        "description": "Discuss holiday query dip and confirm recovery",
        "evidence_ids": ["sig-113"],
        "assigned_to": "Sarah Jenkins"
    }
    create_res = client.post("/api/tracker", json=create_payload)
    assert create_res.status_code == 200, f"Create tracked action failed: {create_res.text}"
    item = create_res.json()
    item_id = item["id"]

    # 2. Verify registered in MongoDB
    db_item = mongo_db.action_tracker.find_one({"id": item_id})
    assert db_item is not None, "Tracked action not found in MongoDB action_tracker collection"

    # 3. Record outcome form
    outcome_payload = {
        "notes": "Spoke with Head of Data at Vortex Analytics. Query volume rebounded 100% post-holiday.",
        "customer_response": "Customer confirmed traffic is back to normal baseline and renewal is on track.",
        "commitments": "Revora will deliver automated monthly uptime summary.",
        "next_steps": "Check in during standard Q1 review cycle.",
        "recorded_by": "Sarah Jenkins",
        "supporting_evidence_ids": ["sig-113"]
    }
    outcome_res = client.post(f"/api/tracker/{item_id}/outcome", json=outcome_payload)
    assert outcome_res.status_code == 200, f"Record outcome failed: {outcome_res.text}"
    updated_item = outcome_res.json()

    assert updated_item["work_status"] == "completed"
    assert updated_item["action_status"] == "executed"
    assert updated_item["outcome"] is not None
    assert updated_item["outcome"]["customer_response"] == outcome_payload["customer_response"]

    # 4. Verify outcome persisted in MongoDB
    db_updated = mongo_db.action_tracker.find_one({"id": item_id})
    assert db_updated is not None
    assert db_updated["work_status"] == "completed"
    assert db_updated["outcome"]["notes"] == outcome_payload["notes"]
    assert db_updated["outcome"]["commitments"] == outcome_payload["commitments"]

    # 5. Query via GET /api/tracker?has_outcome=true
    filter_res = client.get("/api/tracker?has_outcome=true")
    assert filter_res.status_code == 200
    tracked_list = filter_res.json()
    assert any(i["id"] == item_id for i in tracked_list)


def test_records_persist_after_app_reopen_simulation(client, mongo_db):
    """
    Task B Requirement 4: Check that records persist after refreshing or reopening the application.
    Simulates a complete server/client restart by creating brand new repository instances.
    """
    # 1. Create a unique task and unique feedback record
    unique_marker = uuid.uuid4().hex[:6]
    test_task_title = f"Persistence Verification Task {unique_marker}"
    task_res = client.post("/api/tasks", json={
        "account_id": "acc-105",
        "title": test_task_title,
        "priority": "high",
        "assigned_to": "Marcus Chen"
    })
    assert task_res.status_code == 201
    created_task_id = task_res.json()["id"]

    # 2. Simulate complete restart by instantiating fresh Repository classes
    fresh_task_repo = TaskRepository()
    fresh_account_repo = AccountRepository()
    fresh_feedback_repo = FeedbackRepository()
    fresh_tracker_repo = ActionTrackerRepository()

    # 3. Verify task exists in the fresh repository reading from MongoDB
    reopened_task = fresh_task_repo.get_task_by_id(created_task_id)
    assert reopened_task is not None, "Task was lost after simulated application reopen!"
    assert reopened_task.title == test_task_title
    assert reopened_task.account_id == "acc-105"

    # 4. Verify accounts persist and load with their risk scores
    reopened_accounts = fresh_account_repo.get_all_accounts_with_risk()
    assert len(reopened_accounts) >= 15, f"Expected 15+ accounts after restart, got {len(reopened_accounts)}"
    acme = next((a for a in reopened_accounts if a.id == "acc-101"), None)
    assert acme is not None
    assert acme.name == "Acme Technologies"
    assert acme.risk_score > 0

    # 5. Verify feedback records persist in fresh repository
    reopened_feedback = fresh_feedback_repo.list_feedback_records(account_id="acc-101")
    assert len(reopened_feedback) > 0, "Feedback records lost after simulated application reopen!"

    # 6. Verify action tracker items persist in fresh repository
    reopened_actions = fresh_tracker_repo.get_all(account_id="acc-101")
    assert len(reopened_actions) > 0, "Action tracker items lost after simulated application reopen!"
