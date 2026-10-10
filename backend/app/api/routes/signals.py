from fastapi import APIRouter, HTTPException
from app.models.schemas import Signal
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("/{signal_id}", response_model=Signal)
def get_signal_detail(signal_id: str):
    """
    Returns full metadata, timestamps, and observed telemetry for a specific source signal.
    Guarantees traceability from alert to original evidence.
    """
    signal = account_repo.get_signal_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail=f"Signal {signal_id} not found")
    return signal
