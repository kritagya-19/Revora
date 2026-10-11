from fastapi import APIRouter, HTTPException, Path, Query
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    IntegrationConnector,
    SyncRunRecord,
    TriggerSyncResponse
)
from app.services.integration_repository import integration_repo
from app.services.free_pipeline_service import free_pipelines

from app.services.hubspot_sync_service import hubspot_sync_service
from app.services.hubspot_client import hubspot_client, HubSpotAPIError
from app.services.unified_demo_system import unified_demo_system

router = APIRouter()

@router.post("/hubspot/seed-unified")
def seed_unified_demo_data(execute_live_fetch: bool = Query(True, description="Fetch live CRM records from HubSpot API")):
    """
    POST /api/integrations/hubspot/seed-unified
    Triggers deterministic unified demo seeding:
    - Fetches companies, contacts, and deals from HubSpot API
    - Generates multi-channel simulated records (Email, Calendar, Slack, Telemetry)
    - Associates all records to exact internal account IDs with source, timestamp, and simulated/live status
    - Idempotently persists in MongoDB and recomputes risk scores
    """
    try:
        result = unified_demo_system.seed_all(execute_hubspot_live_fetch=execute_live_fetch)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unified seeding failed: {e}")

from app.services.account_repository import account_repo

@router.get("/hubspot/seed-status")
def get_unified_seed_status():
    """
    GET /api/integrations/hubspot/seed-status
    Returns summary statistics for accounts, contacts, and signals in the database.
    """
    db = account_repo.db
    if db is None:
        try:
            from pymongo import MongoClient
            client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000)
            client.admin.command("ping")
            db = client["revora"]
        except Exception:
            db = None

    if db is not None:
        try:
            total_accounts = db.accounts.count_documents({})
            live_accounts = db.accounts.count_documents({"is_demo": False})
            total_contacts = db.contacts.count_documents({})
            total_signals = db.signals.count_documents({})
            live_signals = db.signals.count_documents({"is_simulated": False})
            sim_signals = db.signals.count_documents({"is_simulated": True})
            return {
                "status": "ready",
                "database": "mongodb",
                "total_accounts": total_accounts,
                "live_accounts": live_accounts,
                "total_contacts": total_contacts,
                "total_signals": total_signals,
                "live_signals": live_signals,
                "simulated_signals": sim_signals,
                "supported_channels": ["crm", "email", "calendar", "slack", "usage", "support"],
                "hubspot_configured": hubspot_client.is_configured
            }
        except Exception as e:
            pass

    return {
        "status": "ready_in_memory",
        "database": "in_memory",
        "total_accounts": len(account_repo._accounts_data),
        "total_contacts": len(account_repo._contacts_data),
        "total_signals": len(account_repo._signals_data),
        "supported_channels": ["crm", "email", "calendar", "slack", "usage", "support"],
        "hubspot_configured": hubspot_client.is_configured
    }


@router.get("/hubspot/status")
def get_hubspot_status():
    """
    GET /api/integrations/hubspot/status
    Returns HubSpot CRM service key configuration, authentication status, and record counts.
    """
    try:
        return hubspot_sync_service.get_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check HubSpot status: {e}")

@router.post("/hubspot/sync")
def sync_hubspot_data():
    """
    POST /api/integrations/hubspot/sync
    Triggers direct HubSpot CRM API ingestion for companies, contacts, deals, owners, and tickets.
    Persists and normalizes into MongoDB with duplicate prevention.
    """
    try:
        return hubspot_sync_service.sync_all()
    except HubSpotAPIError as e:
        status_code = e.status_code if e.status_code in (401, 403, 429) else 502
        raise HTTPException(status_code=status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HubSpot synchronization error: {e}")

@router.get("/hubspot/sync/status")
def get_hubspot_sync_status():
    """
    GET /api/integrations/hubspot/sync/status
    Returns latest HubSpot synchronization job status, metrics, and freshness.
    """
    conn = integration_repo.get_integration_by_id("conn-hubspot-01")
    runs = [r for r in integration_repo.get_recent_sync_runs(limit=10) if r.provider == "HubSpot"]
    latest_run = runs[0] if runs else None

    return {
        "status": latest_run.status if latest_run else ("connected" if conn else "not_synced"),
        "sync_run_id": latest_run.id if latest_run else None,
        "last_sync_time": conn.last_sync_time if conn else (latest_run.completed_at if latest_run else None),
        "data_freshness_status": conn.data_freshness_status if conn else "unknown",
        "records_ingested": latest_run.records_ingested if latest_run else (conn.records_synced if conn else 0),
        "records_updated": latest_run.records_updated if latest_run else 0,
        "duration_ms": latest_run.duration_ms if latest_run else 0,
        "log_message": latest_run.log_message if latest_run else "No synchronization runs recorded yet."
    }

@router.get("", response_model=List[IntegrationConnector])
def list_integrations():
    """
    GET /api/integrations
    Returns all configured data connectors across CRM, Email, Calendar, Usage Analytics, and Database.
    """
    return integration_repo.get_all_integrations()

# =========================================================================
# Static Routes First (Must precede dynamic /{integration_id})
# =========================================================================

@router.get("/pipelines/status")
def get_free_pipelines_status():
    """
    GET /api/integrations/pipelines/status
    Returns the real-time status of zero-cost free pipelines (Discord/Slack webhooks, SMTP, outbox).
    """
    return free_pipelines.get_pipeline_status()

@router.post("/webhook/configure")
def configure_free_webhook(payload: Dict[str, Any]):
    """
    POST /api/integrations/webhook/configure
    Updates the active webhook URL for real-time Discord, Slack, or Webhook.site alerts.
    """
    webhook_url = payload.get("webhook_url", "")
    return free_pipelines.configure_webhook(webhook_url)

@router.post("/webhook/test")
async def test_free_webhook(payload: Optional[Dict[str, Any]] = None):
    """
    POST /api/integrations/webhook/test
    Fires an immediate test event to verify live delivery with status code and latency.
    """
    account_name = (payload or {}).get("account_name", "Acme Technologies")
    account_id = (payload or {}).get("account_id", "acc-101")
    return await free_pipelines.dispatch_webhook_event(
        event_type="test_ping",
        title="Revora Free Pipeline Connection Test",
        description="Live zero-cost integration verified for Hackathon Demo! Customer churn warnings and approved actions are wired to deliver here.",
        account_name=account_name,
        account_id=account_id,
        fields=[
            {"name": "Engine", "value": "Revora SignalBridge", "inline": True},
            {"name": "Cost", "value": "$0.00 (Free Tier)", "inline": True},
            {"name": "Verified At", "value": "Just now", "inline": True}
        ],
        urgency="medium"
    )

@router.get("/outbox")
def list_outbox_events(limit: int = Query(30, ge=1, le=100)):
    """
    GET /api/integrations/outbox
    Inspects all recent live emails and webhook deliveries in the interactive outbox.
    """
    return free_pipelines.get_recent_outbox(limit=limit)

@router.post("/outbox/clear")
def clear_outbox():
    """
    POST /api/integrations/outbox/clear
    Clears outbox records.
    """
    free_pipelines.clear_outbox()
    return {"status": "cleared", "message": "Live outbox cleared successfully"}

@router.get("/sync-runs/recent", response_model=List[SyncRunRecord])
def list_recent_sync_runs(limit: int = Query(20, ge=1, le=100)):
    """
    GET /api/integrations/sync-runs/recent
    Returns audit history of automated and manual synchronization batches.
    """
    return integration_repo.get_recent_sync_runs(limit=limit)

# =========================================================================
# Dynamic Parameter Routes
# =========================================================================

@router.get("/{integration_id}", response_model=IntegrationConnector)
def get_integration_detail(integration_id: str = Path(..., description="Connector ID")):
    """
    GET /api/integrations/{id}
    Returns detailed configuration, endpoints, and credentials status for a specific integration.
    """
    conn = integration_repo.get_integration_by_id(integration_id)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Integration {integration_id} not found")
    return conn

@router.post("/{integration_id}/sync", response_model=TriggerSyncResponse)
def trigger_sync(integration_id: str = Path(..., description="Connector ID")):
    """
    POST /api/integrations/{id}/sync
    Triggers immediate resynchronization and updates data freshness status.
    """
    try:
        return integration_repo.trigger_synchronization(integration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
