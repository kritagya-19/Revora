import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app
from app.core.config import settings

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mongo_db():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
    db = client[settings.MONGODB_DB_NAME]
    return db


def test_member2_data_supply_contract(client):
    """
    Task D Requirement 1:
    Give Member 2 consistent source data for risk analysis and investigation.
    Validates API contracts for:
    - GET /api/accounts (ranked accounts with multi-attribute signals)
    - GET /api/accounts/{id} (detailed account context, metrics, and contacts)
    - GET /api/accounts/{id}/risk (deterministic risk score breakdown & reason codes)
    - GET /api/accounts/{id}/signals (chronological multi-source signals)
    - GET /api/accounts/{id}/evidence (evidence-grounded fact records)
    - GET /api/accounts/{id}/autopsy (Revenue Risk Autopsy)
    - GET /api/signals (portfolio-wide filtered signals)
    """
    # 1. Accounts list for Member 2
    res_accounts = client.get("/api/accounts")
    assert res_accounts.status_code == 200
    accounts = res_accounts.json()
    assert len(accounts) >= 15, "Member 2 requires at least 15 customer accounts"

    for acc in accounts:
        assert "id" in acc and acc["id"].startswith("acc-")
        assert "name" in acc and len(acc["name"]) > 0
        assert "arr" in acc and acc["arr"] > 0
        assert "renewal_date" in acc
        assert "csm_owner" in acc
        assert "risk_level" in acc and acc["risk_level"] in ("critical", "high", "medium", "low")
        assert "risk_score" in acc and 0 <= acc["risk_score"] <= 100
        assert "urgency_days_to_renewal" in acc
        assert "urgency_label" in acc
        assert "primary_reason_code" in acc
        assert "contributing_factors" in acc

    # 2. Risk detail for selected account (acc-101)
    res_risk = client.get("/api/accounts/acc-101/risk")
    assert res_risk.status_code == 200
    risk = res_risk.json()
    assert risk["account_id"] == "acc-101"
    assert risk["risk_score"] > 0
    assert risk["risk_level"] in ("critical", "high")
    assert len(risk["contributing_factors"]) > 0
    assert risk["signals_count"] >= 5

    # 3. Multi-source signals for Member 2
    res_signals = client.get("/api/accounts/acc-101/signals")
    assert res_signals.status_code == 200
    signals = res_signals.json()
    assert len(signals) >= 5
    
    categories = {s["source_category"] for s in signals}
    assert "crm" in categories, "Member 2 requires CRM source signals"
    assert "email" in categories, "Member 2 requires Email/Gmail source signals"
    assert "calendar" in categories, "Member 2 requires Calendar source signals"
    assert "usage" in categories, "Member 2 requires Product Usage source signals"
    assert "support" in categories, "Member 2 requires Support Tickets source signals"

    # 4. Unified Evidence records for Member 2
    res_ev = client.get("/api/accounts/acc-101/evidence")
    assert res_ev.status_code == 200
    evidence = res_ev.json()
    assert len(evidence) >= 5
    for ev in evidence:
        assert "id" in ev and ev["id"]
        assert "account_id" in ev and ev["account_id"] == "acc-101"
        assert "source_category" in ev
        assert "title" in ev
        assert "timestamp" in ev
        assert "raw_reference" in ev and ev["raw_reference"].startswith("source://")

    # 5. Revenue Risk Autopsy for Member 2
    res_autopsy = client.get("/api/accounts/acc-101/autopsy")
    assert res_autopsy.status_code == 200
    autopsy = res_autopsy.json()
    assert autopsy["account_id"] == "acc-101"
    assert "facts" in autopsy and len(autopsy["facts"]) > 0
    assert "interpretations" in autopsy
    assert "suggested_action_type" in autopsy
    assert "risk_score" in autopsy


def test_member3_data_supply_contract(client):
    """
    Task D Requirement 2:
    Give Member 3 usage, engagement, feedback, and outcome data needed for reminders and improvement analysis.
    Validates API contracts for:
    - GET /api/feedback (all customer feedback records and AI analysis)
    - GET /api/feedback/account/{id} (account-specific feedback)
    - GET /api/feedback/templates (survey templates)
    - GET /api/feedback/check-trigger/{id} (dynamic trigger evaluation rules)
    - POST /api/feedback/scan-triggers (portfolio-wide trigger scanning)
    - GET /api/tasks (follow-up tasks and reminders)
    - GET /api/tracker (action & outcome tracker)
    - GET /api/tracker/intelligence (continuous improvement intelligence report)
    - GET /api/tracker/intelligence/account/{id} (account history-aware context)
    """
    # 1. Feedback records for Member 3
    res_fb = client.get("/api/feedback")
    assert res_fb.status_code == 200
    feedback_records = res_fb.json()
    assert len(feedback_records) >= 3, "Member 3 requires feedback records for improvement loop"

    for r in feedback_records:
        assert "id" in r
        assert "account_id" in r and r["account_id"].startswith("acc-")
        assert "submission" in r
        sub = r["submission"]
        assert "satisfaction_score" in sub
        assert "primary_blocker" in sub
        if r.get("analysis"):
            an = r["analysis"]
            assert "classified_churn_reason" in an
            assert "sentiment_label" in an
            assert "sentiment_interpretation" in an
            assert "recommended_retention_action" in an

    # 2. Dynamic feedback trigger check for Member 3
    res_trigger = client.get("/api/feedback/check-trigger/acc-101?force_ignore_cooldown=true")
    assert res_trigger.status_code == 200
    trigger_check = res_trigger.json()
    assert trigger_check["account_id"] == "acc-101"
    assert "eligible" in trigger_check
    assert trigger_check["eligible"] is True, "High risk account acc-101 must be trigger eligible"
    assert len(trigger_check["matched_rules"]) > 0
    assert len(trigger_check["reasons"]) > 0
    assert "recommended_template_id" in trigger_check

    # 3. Tasks & Reminders for Member 3
    res_tasks = client.get("/api/tasks")
    assert res_tasks.status_code == 200
    tasks = res_tasks.json()
    assert len(tasks) >= 5, "Member 3 requires follow-up tasks for reminders"
    for tsk in tasks:
        assert "id" in tsk
        assert "account_id" in tsk
        assert "title" in tsk
        assert "priority" in tsk
        assert "status" in tsk
        assert "assigned_to" in tsk

    # 4. Action & Outcome Tracker for Member 3
    res_tracker = client.get("/api/tracker")
    assert res_tracker.status_code == 200
    actions = res_tracker.json()
    assert len(actions) >= 4, "Member 3 requires tracked actions for post-action improvement cycle"

    # Must contain completed outcomes
    completed_outcomes = [a for a in actions if a.get("outcome") is not None]
    assert len(completed_outcomes) >= 1, "Member 3 requires recorded outcomes to analyze customer response"

    sample_outcome = completed_outcomes[0]["outcome"]
    assert "notes" in sample_outcome
    assert "customer_response" in sample_outcome
    assert "commitments" in sample_outcome
    assert "next_steps" in sample_outcome

    # 5. Outcome Intelligence Report for Member 3 (Feature 4)
    res_intel = client.get("/api/tracker/intelligence")
    assert res_intel.status_code == 200
    intel = res_intel.json()
    assert "total_historical_actions" in intel
    assert "action_type_stats" in intel and len(intel["action_type_stats"]) > 0
    assert "timeliness" in intel
    assert "unresolved_blockers" in intel
    assert "learned_patterns" in intel

    # 6. History-Aware Context for Member 3 (Feature 5)
    res_hist = client.get("/api/tracker/intelligence/account/acc-101")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert hist["account_id"] == "acc-101"
    assert "previous_actions_count" in hist
    assert "previous_actions" in hist
    assert "unresolved_commitments" in hist
    assert "similar_situations_from_other_accounts" in hist


def test_data_consistency_between_members(client):
    """
    Task D Requirement 3:
    Agree on API response formats and verify consistency between Member 2 and Member 3.
    Verifies that customer IDs, owner names, domains, and risk classifications match exactly
    between the intelligence/risk endpoints (Member 2) and the feedback/action endpoints (Member 3).
    """
    # 1. Accounts list
    accounts = client.get("/api/accounts").json()
    accounts_by_id = {a["id"]: a for a in accounts}

    # 2. Feedback records
    feedback_records = client.get("/api/feedback").json()
    for fb in feedback_records:
        aid = fb["account_id"]
        assert aid in accounts_by_id, f"Feedback record refers to unknown account {aid}"
        assert fb["account_name"] == accounts_by_id[aid]["name"], "Account name mismatch in feedback record"

    # 3. Tasks
    tasks = client.get("/api/tasks").json()
    for tsk in tasks:
        aid = tsk["account_id"]
        assert aid in accounts_by_id, f"Task refers to unknown account {aid}"

    # 4. Tracked Actions
    tracked = client.get("/api/tracker").json()
    for act in tracked:
        aid = act["account_id"]
        assert aid in accounts_by_id, f"Tracked action refers to unknown account {aid}"
        assert act["account_name"] == accounts_by_id[aid]["name"], "Account name mismatch in tracked action"
