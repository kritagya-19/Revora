from fastapi import APIRouter, HTTPException, Path
from typing import Dict, Any
from app.models.schemas import (
    Investigation,
    AskAccountQuestionRequest,
    AskAccountQuestionResponse
)
from app.services.investigation_repository import investigation_repo
from app.services.account_repository import account_repo
from app.services.llm_service import llm_service

router = APIRouter()

@router.post("/accounts/{account_id}/investigate", response_model=Investigation)
def run_account_investigation(account_id: str = Path(..., description="Account ID to investigate")):
    """
    Executes the evidence-first AI investigation pipeline:
    1. Gathers account telemetry, signals, contacts, and risk score.
    2. Passes ground-truth evidence to LLM / Synthesis engine.
    3. Validates citations and returns structured findings, blindspots, and recommended next action.
    """
    try:
        return investigation_repo.create_or_run_investigation(account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investigation failed: {e}")

@router.get("/investigations/{investigation_id}", response_model=Investigation)
def get_investigation_by_id(investigation_id: str = Path(..., description="Investigation ID")):
    """Returns a saved investigation by ID."""
    inv = investigation_repo.get_investigation_by_id(investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation {investigation_id} not found")
    return inv

@router.get("/accounts/{account_id}/investigation", response_model=Investigation)
def get_latest_investigation_for_account(account_id: str = Path(..., description="Account ID")):
    """Returns the most recent investigation for an account or generates a new one if none exists."""
    inv = investigation_repo.get_latest_for_account(account_id)
    if not inv:
        try:
            return investigation_repo.create_or_run_investigation(account_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    return inv

@router.post("/accounts/{account_id}/ask", response_model=AskAccountQuestionResponse)
def ask_account_question(
    account_id: str,
    req: AskAccountQuestionRequest
):
    """
    Provides evidence-grounded answers to follow-up questions regarding the specified customer.
    Cites specific evidence IDs and highlights unverified assumptions.
    """
    account = account_repo.get_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return llm_service.answer_account_question(account, req.question)
