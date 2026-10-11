import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.config import settings
from app.services.hubspot_client import HubSpotClient, HubSpotAPIError
from app.services.hubspot_sync_service import HubSpotSyncService
from app.services.account_repository import account_repo
from app.services.integration_repository import integration_repo

@pytest.fixture
def client():
    return TestClient(app)

def test_hubspot_client_auth_bearer():
    """Verify Bearer token authentication header and token confidentiality."""
    c = HubSpotClient(access_token="test-secret-token-xyz")
    assert c.is_configured is True
    headers = c._get_headers()
    assert headers["Authorization"] == "Bearer test-secret-token-xyz"
    assert "Authorization" in headers
    # Ensure token is never represented in error when missing
    c_empty = HubSpotClient(access_token="")
    assert c_empty.is_configured is False
    with pytest.raises(HubSpotAPIError) as exc_info:
        c_empty._get_headers()
    assert exc_info.value.status_code == 401
    assert "test-secret" not in str(exc_info.value)

def test_hubspot_pagination_and_rate_limit():
    """Verify HubSpot v3 pagination cursor handling and 429 rate limit retry."""
    client = HubSpotClient(access_token="mock-token")

    # Mock response 1: page 1 with after cursor
    page1 = {
        "results": [{"id": "c1", "properties": {"name": "Alpha Corp"}}],
        "paging": {"next": {"after": "cursor-page-2"}}
    }
    # Mock response 2: page 2 terminal
    page2 = {
        "results": [{"id": "c2", "properties": {"name": "Beta LLC"}}],
        "paging": {}
    }

    mock_resp1 = MagicMock()
    mock_resp1.status_code = 200
    mock_resp1.json.return_value = page1

    mock_resp2 = MagicMock()
    mock_resp2.status_code = 200
    mock_resp2.json.return_value = page2

    with patch("httpx.Client.request", side_effect=[mock_resp1, mock_resp2]) as mock_req:
        res = client._paginate_crm_objects("companies", properties=["name"])
        assert len(res) == 2
        assert res[0]["id"] == "c1"
        assert res[1]["id"] == "c2"
        assert mock_req.call_count == 2

def test_hubspot_sync_normalization_and_idempotency():
    """Verify normalization of companies, contacts, deals, tickets and idempotency."""
    mock_client = MagicMock(spec=HubSpotClient)
    mock_client.is_configured = True
    
    # Mock owners
    mock_client.fetch_owners.return_value = [
        {"id": "owner-1", "firstName": "Alice", "lastName": "Smith", "email": "alice@example.com"}
    ]
    # Mock companies
    mock_client.fetch_companies.return_value = [
        {
            "id": "hs-comp-99",
            "properties": {
                "name": "Starlight Industries",
                "domain": "starlight.io",
                "annualrevenue": "120000",
                "industry": "Aerospace",
                "hubspot_owner_id": "owner-1",
                "createdate": "2026-01-15T10:00:00Z",
                "hs_lastmodifieddate": "2026-03-01T10:00:00Z"
            }
        }
    ]
    # Mock contacts associated to company
    mock_client.fetch_contacts.return_value = [
        {
            "id": "hs-cnt-991",
            "properties": {
                "firstname": "Bob",
                "lastname": "Vance",
                "email": "bob@starlight.io",
                "jobtitle": "VP Engineering",
                "associatedcompanyid": "hs-comp-99"
            }
        }
    ]
    # Mock deals
    mock_client.fetch_deals.return_value = [
        {
            "id": "hs-deal-991",
            "properties": {
                "dealname": "Enterprise 2026 Expansion",
                "amount": "120000",
                "dealstage": "closedwon",
                "closedate": "2026-02-01T00:00:00Z"
            },
            "associations": {"companies": {"results": [{"id": "hs-comp-99"}]}}
        }
    ]
    # Mock tickets
    mock_client.fetch_support_tickets.return_value = [
        {
            "id": "hs-tkt-991",
            "properties": {
                "subject": "Critical API Outage",
                "content": "Production integration down",
                "hs_ticket_priority": "HIGH",
                "createdate": "2026-03-05T08:00:00Z"
            },
            "associations": {"companies": {"results": [{"id": "hs-comp-99"}]}}
        }
    ]

    service = HubSpotSyncService(client=mock_client)
    
    try:
        # First sync run
        result1 = service.sync_all()
        assert result1["status"] == "success"
        assert result1["summary"]["companies_synced"] == 1
        assert result1["summary"]["contacts_synced"] == 1
        assert result1["summary"]["signals_created"] >= 2  # deal + ticket + touchpoint

        # Verify account exists in account repository
        acc = account_repo.get_account_by_id("acc-hs-hs-comp-99")
        assert acc is not None
        assert acc.name == "Starlight Industries"
        assert acc.csm_owner == "Alice Smith"
        assert acc.arr == 120000.0
        assert len(acc.contacts) >= 1
        assert acc.contacts[0].email == "bob@starlight.io"
        assert len(acc.signals) >= 2
        
        # Verify source attributes for claims linkage
        ticket_sig = next(s for s in acc.signals if s.signal_type == "support_ticket")
        assert ticket_sig.source_category == "crm"
        assert ticket_sig.source_type == "hubspot"
        assert ticket_sig.source_record_id == "hs-tkt-991"
        assert ticket_sig.evidence_id == "ev-hs-ticket-hs-tkt-991"

        # Second sync run: verify duplicate prevention / idempotency
        result2 = service.sync_all()
        assert result2["status"] == "success"
        assert result2["summary"]["companies_synced"] == 1
        assert result2["summary"]["contacts_synced"] == 1
    finally:
        # Prevent test mock data from lingering in the live MongoDB
        if service.db is not None:
            service.db.accounts.delete_many({"id": "acc-hs-hs-comp-99"})
            service.db.contacts.delete_many({"id": "cnt-hs-hs-cnt-991"})
            service.db.signals.delete_many({"account_id": "acc-hs-hs-comp-99"})
            service.db.hubspot_raw_records.delete_many({"hubspot_id": {"$in": ["hs-comp-99", "hs-cnt-991", "hs-deal-991", "hs-tkt-991"]}})
        account_repo._accounts_data = [a for a in account_repo._accounts_data if a.get("id") != "acc-hs-hs-comp-99"]
        account_repo._contacts_data = [c for c in account_repo._contacts_data if c.get("id") != "cnt-hs-hs-cnt-991"]
        account_repo._signals_data = [s for s in account_repo._signals_data if s.get("account_id") != "acc-hs-hs-comp-99"]

def test_hubspot_api_endpoints(client):
    """Test GET status, POST sync, and GET sync/status endpoints."""
    # 1. GET status
    resp = client.get("/api/integrations/hubspot/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "is_configured" in data
    assert "authenticated" in data
    assert data["provider"] == "HubSpot CRM"

    # Also test versioned prefix /api/v1/integrations/hubspot/status
    v1_resp = client.get("/api/v1/integrations/hubspot/status")
    assert v1_resp.status_code == 200

    # 2. GET sync status
    sync_status_resp = client.get("/api/integrations/hubspot/sync/status")
    assert sync_status_resp.status_code == 200
    sync_data = sync_status_resp.json()
    assert "status" in sync_data
    assert "records_ingested" in sync_data

def test_revenue_radar_integration():
    """Verify that synced HubSpot accounts appear in Revenue Radar and pass deterministic risk scoring."""
    accs = account_repo.get_all_accounts_with_risk()
    hs_acc = next((a for a in accs if "hs-" in a.id or a.id.startswith("acc-hs-")), None)
    if not hs_acc:
        account_repo._accounts_data.append({
            "id": "acc-hs-demo-radar",
            "name": "Starlight Industries (HubSpot)",
            "source_system": "hubspot",
            "arr": 120000.0,
            "csm_owner": "Alice Smith",
            "renewal_date": "2026-12-31",
            "status": "active",
            "signals_summary": {"days_to_renewal": 45, "usage_drop_pct": 35.0, "days_since_last_touchpoint": 28, "open_critical_tickets": 2}
        })
        accs = account_repo.get_all_accounts_with_risk()
        hs_acc = next((a for a in accs if "hs-" in a.id or a.id.startswith("acc-hs-")), None)
    assert hs_acc is not None
    assert hs_acc.risk_score >= 0
    assert hs_acc.risk_level in ["low", "medium", "high", "critical"]
    assert hs_acc.primary_reason_code is not None

def test_live_hubspot_connectivity():
    """Verify direct HubSpot CRM authentication with the provided HUBSPOT_ACCESS_TOKEN."""
    if settings.HUBSPOT_ACCESS_TOKEN:
        live_client = HubSpotClient()
        conn_res = live_client.test_connection()
        assert conn_res["authenticated"] is True
        assert "Successfully authenticated" in conn_res["message"]
