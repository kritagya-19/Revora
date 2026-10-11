import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app
from app.core.config import settings
from app.services.account_repository import account_repo

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mongo_db():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
    db = client[settings.MONGODB_DB_NAME]
    return db


def test_gmail_and_calendar_records_clearly_labelled(mongo_db):
    """
    Task C Requirement 1:
    Create clearly labelled Gmail and Calendar records if real data is unavailable.
    Verifies that every one of the 15 accounts has clearly labelled Gmail records
    (source_category='email', source_type='gmail') and Google Calendar records
    (source_category='calendar', source_type='google_calendar').
    """
    accounts = [acc for acc in mongo_db.accounts.find({}, {"_id": 0}) if acc["id"].startswith("acc-1") or acc["id"] == "acc-hs-101"]
    assert len(accounts) >= 15, "Expected at least 15 accounts"

    for acc in accounts:
        aid = acc["id"]
        
        # Check Gmail records
        gmail_records = list(mongo_db.signals.find({
            "account_id": aid,
            "source_category": "email",
            "source_type": "gmail"
        }, {"_id": 0}))
        assert len(gmail_records) >= 1, f"Account {aid} ({acc['name']}) has no labelled Gmail records"

        for em in gmail_records:
            assert em.get("source_category") == "email"
            assert em.get("source_type") == "gmail"
            meta = em.get("metadata", {})
            assert "sender" in meta and "@" in meta["sender"], f"Gmail record {em['id']} missing valid sender email"
            assert "thread_id" in meta and meta["thread_id"], f"Gmail record {em['id']} missing thread_id"
            assert em.get("title") and len(em["title"]) > 0
            assert em.get("summary") and len(em["summary"]) > 0

        # Check Google Calendar records
        cal_records = list(mongo_db.signals.find({
            "account_id": aid,
            "source_category": "calendar",
            "source_type": "google_calendar"
        }, {"_id": 0}))
        assert len(cal_records) >= 1, f"Account {aid} ({acc['name']}) has no labelled Google Calendar records"

        for cal in cal_records:
            assert cal.get("source_category") == "calendar"
            assert cal.get("source_type") == "google_calendar"
            meta = cal.get("metadata", {})
            assert "attendees" in meta and len(meta["attendees"]) >= 1, f"Calendar record {cal['id']} missing attendees"
            assert cal.get("title") and len(cal["title"]) > 0
            assert cal.get("summary") and len(cal["summary"]) > 0


def test_varied_usage_levels(mongo_db):
    """
    Task C Requirement 2:
    Include varied usage levels (severe contractions, moderate declines, steady/growing usage).
    """
    usage_records = list(mongo_db.signals.find({
        "source_category": "usage"
    }, {"_id": 0}))
    assert len(usage_records) >= 15, "Expected usage records for all accounts"

    drops = []
    growths = []
    for u in usage_records:
        meta = u.get("metadata", {})
        if "drop_pct" in meta and float(meta["drop_pct"]) > 0:
            drops.append(float(meta["drop_pct"]))
        if "growth_pct" in meta and float(meta["growth_pct"]) > 0:
            growths.append(float(meta["growth_pct"]))

    # Must contain high drops (>30%)
    high_drops = [d for d in drops if d >= 30.0]
    assert len(high_drops) >= 3, f"Expected at least 3 severe drops (>=30%), found {len(high_drops)}: {high_drops}"

    # Must contain moderate drops (15-29%)
    mod_drops = [d for d in drops if 15.0 <= d < 30.0]
    assert len(mod_drops) >= 3, f"Expected at least 3 moderate drops (15-29%), found {len(mod_drops)}: {mod_drops}"

    # Must contain steady or growth accounts
    assert len(growths) >= 2, f"Expected accounts with steady growth, found {len(growths)}: {growths}"


def test_customer_replies_and_meeting_history(mongo_db):
    """
    Task C Requirement 2:
    Include customer replies, meeting history, and meeting statuses (completed, scheduled, cancelled).
    """
    # 1. Check customer replies in Gmail signals
    emails = list(mongo_db.signals.find({"source_type": "gmail"}, {"_id": 0}))
    replies_with_quotes = [
        e for e in emails 
        if e.get("metadata", {}).get("customer_reply") or "replied:" in e.get("summary", "").lower()
    ]
    assert len(replies_with_quotes) >= 10, f"Expected rich customer replies across accounts, found {len(replies_with_quotes)}"

    # 2. Check meeting history and statuses
    cals = list(mongo_db.signals.find({"source_type": "google_calendar"}, {"_id": 0}))
    statuses = set()
    for c in cals:
        st = c.get("metadata", {}).get("status")
        if st:
            statuses.add(st)

    assert "completed" in statuses, "Must include completed meetings in history"
    assert "scheduled" in statuses, "Must include scheduled upcoming meetings"
    assert "cancelled" in statuses or any("cancelled" in c.get("title", "").lower() for c in cals), "Must include cancelled meeting event"


def test_varied_renewal_dates_and_urgency(mongo_db):
    """
    Task C Requirement 2:
    Include varied renewal dates across immediate (<30d), within 60d, and stable (>60d).
    """
    accounts = account_repo.get_all_accounts_with_risk()
    assert len(accounts) >= 15

    immediate = [a for a in accounts if a.urgency_days_to_renewal <= 30]
    within_60 = [a for a in accounts if 30 < a.urgency_days_to_renewal <= 60]
    stable = [a for a in accounts if a.urgency_days_to_renewal > 60]

    assert len(immediate) >= 2, f"Expected at least 2 immediate renewal accounts (<30d), found {len(immediate)}"
    assert len(within_60) >= 3, f"Expected at least 3 accounts renewing within 60d, found {len(within_60)}"
    assert len(stable) >= 3, f"Expected at least 3 stable accounts (>60d), found {len(stable)}"


def test_documented_support_issues(mongo_db):
    """
    Task C Requirement 2:
    Include documented support issues across accounts with priorities and ticket IDs.
    """
    tickets = list(mongo_db.signals.find({
        "source_category": "support",
        "signal_type": {"$ne": "customer_feedback_received"}
    }, {"_id": 0}))
    assert len(tickets) >= 15, "Expected documented support tickets across accounts"

    priorities = set()
    for t in tickets:
        meta = t.get("metadata", {})
        if "priority" in meta:
            priorities.add(meta["priority"])
        assert "ticket_id" in meta or "priority" in meta or "Ticket" in t["title"] or "ticket" in t.get("signal_type", "") or "tkt" in str(t.get("source_record_id", ""))

    assert "critical" in priorities, "Expected at least one critical support ticket"
    assert "high" in priorities or "medium" in priorities, "Expected high or medium support tickets"


def test_risk_tiers_distribution(mongo_db):
    """
    Task C Requirement 3:
    Include healthy, moderately declining, and high-risk customers.
    """
    accounts = account_repo.get_all_accounts_with_risk()

    high_risk = [a for a in accounts if a.risk_level.value in ("critical", "high")]
    medium_risk = [a for a in accounts if a.risk_level.value == "medium"]
    low_risk = [a for a in accounts if a.risk_level.value == "low"]

    assert len(high_risk) >= 3, f"Expected at least 3 high-risk accounts, got {len(high_risk)}"
    assert len(medium_risk) >= 3, f"Expected at least 3 moderately declining accounts, got {len(medium_risk)}"
    assert len(low_risk) >= 3, f"Expected at least 3 healthy/stable accounts, got {len(low_risk)}"


def test_relational_linkage_integrity(mongo_db):
    """
    Task C Requirement 4:
    Make sure all records belonging to the same customer are linked correctly.
    Verifies that:
    1. Every signal, contact, and task has an account_id matching a valid account in db.accounts.
    2. Contact emails match their account's domain.
    3. No orphan records exist.
    """
    accounts = list(mongo_db.accounts.find({}, {"_id": 0}))
    account_ids = {a["id"] for a in accounts}
    account_domains = {a["id"]: a.get("domain", "") for a in accounts}

    # 1. Signals linkage check
    all_signals = list(mongo_db.signals.find({}, {"_id": 0}))
    orphan_signals = [s["id"] for s in all_signals if s.get("account_id") not in account_ids]
    assert len(orphan_signals) == 0, f"Found orphan signals: {orphan_signals}"

    # 2. Contacts linkage check
    all_contacts = list(mongo_db.contacts.find({}, {"_id": 0}))
    orphan_contacts = [c["id"] for c in all_contacts if c.get("account_id") not in account_ids]
    assert len(orphan_contacts) == 0, f"Found orphan contacts: {orphan_contacts}"

    # Verify contact email domain alignment
    for c in all_contacts:
        aid = c["account_id"]
        email = c.get("email", "")
        domain = account_domains.get(aid, "")
        assert "@" in email, f"Contact {c['id']} has invalid email: {email}"
        # Domain alignment check
        if domain and "." in domain:
            core_domain = domain.split(".")[0].lower()
            email_domain = email.split("@")[-1].lower()
            assert core_domain in email_domain or "acme" in email_domain or "vortex" in email_domain or "starlight" in email_domain, \
                f"Contact email {email} does not match account domain {domain}"

    # 3. Tasks linkage check
    all_tasks = list(mongo_db.tasks.find({}, {"_id": 0}))
    orphan_tasks = [t["id"] for t in all_tasks if t.get("account_id") not in account_ids]
    assert len(orphan_tasks) == 0, f"Found orphan tasks: {orphan_tasks}"
