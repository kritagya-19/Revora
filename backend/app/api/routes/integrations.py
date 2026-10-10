from fastapi import APIRouter, HTTPException, Path, Query
from typing import List, Dict, Any
from app.models.schemas import (
    IntegrationConnector,
    SyncRunRecord,
    TriggerSyncResponse
)
from app.services.integration_repository import integration_repo

router = APIRouter()

@router.get("", response_model=List[IntegrationConnector])
def list_integrations():
    """
    GET /api/integrations
    Returns all configured data connectors across CRM, Email, Calendar, Usage Analytics, and Database,
    including synchronization status, freshness warnings, and simulated vs live data labels.
    """
    return integration_repo.get_all_integrations()

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

@router.get("/sync-runs/recent", response_model=List[SyncRunRecord])
def list_recent_sync_runs(limit: int = Query(20, ge=1, le=100)):
    """
    GET /api/integrations/sync-runs/recent
    Returns audit history of automated and manual synchronization batches.
    """
    return integration_repo.get_recent_sync_runs(limit=limit)
