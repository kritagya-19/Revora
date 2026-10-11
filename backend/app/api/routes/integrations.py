from fastapi import APIRouter, HTTPException, Path, Query
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    IntegrationConnector,
    SyncRunRecord,
    TriggerSyncResponse
)
from app.services.integration_repository import integration_repo
from app.services.free_pipeline_service import free_pipelines

router = APIRouter()

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
