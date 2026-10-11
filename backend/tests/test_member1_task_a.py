import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.services.hubspot_client import hubspot_client
from app.services.hubspot_sync_service import hubspot_sync_service
from app.services.integration_repository import integration_repo
from app.services.account_repository import account_repo

@pytest.fixture
def client():
    return TestClient(app)

def test_hubspot_demo_records_count_and_fields():
    """
    Task A Requirement:
    Confirm HubSpot is returning approximately 10–15 usable demo company/customer records.
    Check company IDs, account owners, renewal dates, and other required fields.
    """
    companies = hubspot_client.fetch_companies()
    assert 10 <= len(companies) <= 15, f"Expected 10-15 companies, got {len(companies)}"
    
    valid_owners = {"Sarah Jenkins", "Marcus Chen", "Alex Rivera", "Kushal Sahu", "Alice Smith"}
    
    for comp in companies:
        props = comp.get("properties", {})
        cid = comp.get("id")
        name = props.get("name")
        domain = props.get("domain")
        annualrevenue = props.get("annualrevenue")
        owner_id = props.get("hubspot_owner_id")
        createdate = props.get("createdate")

        assert cid is not None and len(str(cid)) > 0, "Company ID must be present"
        assert name is not None and len(name) > 0, f"Company {cid} must have a name"
        assert domain is not None and "." in domain, f"Company {name} must have a valid domain"
        assert annualrevenue is not None and float(annualrevenue) > 0, f"Company {name} must have ARR > 0"
        assert owner_id is not None, f"Company {name} must have an owner ID"
        assert createdate is not None, f"Company {name} must have a createdate"

def test_hubspot_sync_pipeline_and_db_persistence():
    """
    Task A Requirement:
    Verify that synchronization ingests 10-15 companies, associates contacts & signals,
    and updates database records reliably.
    """
    sync_result = hubspot_sync_service.sync_all()
    assert sync_result["status"] == "success"
    summary = sync_result["summary"]
    
    # 10-15 companies synced
    assert 10 <= summary["companies_synced"] <= 15
    assert summary["contacts_synced"] >= 10
    assert summary["signals_created"] >= 20

    # Verify retrieval from Account Repository
    accounts = account_repo.get_all_accounts_with_risk()
    assert len(accounts) >= 10

    # Verify required fields across all accounts
    for acc in accounts:
        assert acc.id.startswith("acc-"), f"Account ID {acc.id} must start with 'acc-'"
        assert acc.name, "Account name required"
        assert acc.arr > 0, f"Account {acc.name} must have positive ARR"
        assert acc.csm_owner, f"Account {acc.name} must have an assigned CSM"
        assert acc.renewal_date, f"Account {acc.name} must have renewal date"
        
        # Verify renewal date format YYYY-MM-DD
        dt = datetime.strptime(acc.renewal_date, "%Y-%m-%d")
        assert dt is not None
        
        # Verify urgency and risk fields calculated dynamically
        assert acc.risk_score >= 0 and acc.risk_score <= 100
        assert acc.risk_level in ["low", "medium", "high", "critical"]
        assert acc.urgency_days_to_renewal >= 0
        assert acc.urgency_label in ["Immediate (<30d)", "Within 60d", "Stable (>60d)"]
        assert acc.primary_reason_code is not None

def test_gmail_and_calendar_integrations_available():
    """
    Task A Requirement:
    Check the current Gmail, Calendar, and other integrations where available.
    Fix broken connections or missing fields rather than rebuilding.
    """
    # 1. Verify connectors exist in repository
    gmail_conn = integration_repo.get_integration_by_id("conn-email-01")
    cal_conn = integration_repo.get_integration_by_id("conn-cal-01")
    crm_conn = integration_repo.get_integration_by_id("conn-hubspot-01")
    db_conn = integration_repo.get_integration_by_id("conn-db-01")

    assert gmail_conn is not None
    assert gmail_conn.category == "email"
    assert gmail_conn.provider == "Gmail API"
    assert gmail_conn.status.value == "connected"

    assert cal_conn is not None
    assert cal_conn.category == "calendar"
    assert cal_conn.status.value == "connected"

    assert crm_conn is not None
    assert crm_conn.category == "crm"
    assert crm_conn.status.value == "connected"

    assert db_conn is not None
    assert db_conn.category == "database"
    assert db_conn.status.value == "connected"

    # 2. Trigger sync on Gmail and verify update
    gmail_res = integration_repo.trigger_synchronization("conn-email-01")
    assert gmail_res.status == "success"
    assert gmail_res.freshness_minutes == 0

    # 3. Trigger sync on Calendar and verify update
    cal_res = integration_repo.trigger_synchronization("conn-cal-01")
    assert cal_res.status == "success"
    assert cal_res.freshness_minutes == 0

def test_integration_api_routes(client):
    """
    Verify all Integration API endpoints work without error.
    """
    # GET /api/integrations
    resp = client.get("/api/integrations")
    assert resp.status_code == 200
    connectors = resp.json()
    assert len(connectors) >= 5
    conn_ids = [c["id"] for c in connectors]
    assert "conn-hubspot-01" in conn_ids
    assert "conn-email-01" in conn_ids
    assert "conn-cal-01" in conn_ids

    # GET /api/integrations/hubspot/status
    status_resp = client.get("/api/integrations/hubspot/status")
    assert status_resp.status_code == 200
    st_data = status_resp.json()
    assert st_data["authenticated"] is True
    assert st_data["records_in_db"]["companies"] >= 10

    # POST /api/integrations/hubspot/sync
    sync_resp = client.post("/api/integrations/hubspot/sync")
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert sync_data["status"] == "success"
    assert 10 <= sync_data["summary"]["companies_synced"] <= 15

    # GET /api/integrations/hubspot/sync/status
    sync_st_resp = client.get("/api/integrations/hubspot/sync/status")
    assert sync_st_resp.status_code == 200
    assert sync_st_resp.json()["records_ingested"] >= 10

    # POST /api/integrations/{id}/sync for Gmail and Calendar
    email_sync_resp = client.post("/api/integrations/conn-email-01/sync")
    assert email_sync_resp.status_code == 200
    assert email_sync_resp.json()["status"] == "success"

    cal_sync_resp = client.post("/api/integrations/conn-cal-01/sync")
    assert cal_sync_resp.status_code == 200
    assert cal_sync_resp.json()["status"] == "success"

    # GET /api/integrations/sync-runs/recent
    runs_resp = client.get("/api/integrations/sync-runs/recent?limit=10")
    assert runs_resp.status_code == 200
    runs = runs_resp.json()
    assert len(runs) >= 3
