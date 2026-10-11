from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.schemas import Signal
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("", response_model=List[Signal])
def list_all_signals(
    account_id: Optional[str] = None,
    source_category: Optional[str] = None,
    source_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100
):
    """
    GET /api/signals
    Retrieves all customer signals with optional filters (account_id, source_category, source_type, severity).
    """
    return account_repo.get_all_signals(
        account_id=account_id,
        source_category=source_category,
        source_type=source_type,
        severity=severity,
        limit=limit
    )

@router.get("/account/{account_id}", response_model=List[Signal])
def list_signals_for_account(account_id: str):
    """
    GET /api/signals/account/{account_id}
    Retrieves chronological signals for a specific account.
    """
    account = account_repo.get_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return account_repo.get_account_signals(account_id)

@router.get("/{signal_id}", response_model=Signal)
def get_signal_detail(signal_id: str):
    """
    GET /api/signals/{signal_id}
    Returns full metadata, timestamps, and observed telemetry for a specific source signal.
    Guarantees traceability from alert to original evidence.
    """
    signal = account_repo.get_signal_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail=f"Signal {signal_id} not found")
    return signal

@router.post("", response_model=Signal, status_code=201)
def ingest_signal(signal: Signal):
    """
    POST /api/signals
    Ingests a new normalized customer signal into the repository and MongoDB.
    Logs immutable audit entry for signal provenance.
    """
    try:
        return account_repo.create_signal(signal)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
