from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.schemas import (
    Signal,
    AccountSignalAnalysisResult,
    SignalValidationReport,
    BatchSignalAnalysisSummary,
)
from app.services.account_repository import account_repo
from app.services.dynamic_signal_analysis_service import dynamic_signal_analyzer

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

@router.get("/portfolio/analysis", response_model=BatchSignalAnalysisSummary)
def get_portfolio_signal_analysis():
    """
    GET /api/signals/portfolio/analysis
    Automated scan of multi-source signals across the customer portfolio.
    Returns portfolio-wide integrity scores and highlights conflicting/stale/missing accounts.
    """
    try:
        return dynamic_signal_analyzer.batch_analyze_portfolio()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio signal analysis failed: {e}")

@router.post("/portfolio/automated-scan", response_model=BatchSignalAnalysisSummary)
def trigger_automated_portfolio_scan():
    """
    POST /api/signals/portfolio/automated-scan
    Triggers automated scan and returns refreshed portfolio signal analysis.
    """
    try:
        return dynamic_signal_analyzer.batch_analyze_portfolio()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Automated scan failed: {e}")

@router.get("/account/{account_id}/analysis", response_model=AccountSignalAnalysisResult)
def get_account_signal_analysis(account_id: str):
    """
    GET /api/signals/account/{account_id}/analysis
    Deep dynamic multi-source signal analysis:
    - Analyzes product usage, engagement, renewal dates, meetings, and support issues.
    - Compares current 30-day activity with 90-day baseline.
    - Performs validation for missing, stale, conflicting, or insufficient signals.
    """
    try:
        return dynamic_signal_analyzer.analyze_account(account_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal analysis failed: {e}")

@router.get("/account/{account_id}/validation", response_model=SignalValidationReport)
def get_account_signal_validation(account_id: str):
    """
    GET /api/signals/account/{account_id}/validation
    Returns signal integrity validation report (missing, stale, conflicting, insufficient).
    """
    try:
        result = dynamic_signal_analyzer.analyze_account(account_id)
        return result.validation_report
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal validation failed: {e}")

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
