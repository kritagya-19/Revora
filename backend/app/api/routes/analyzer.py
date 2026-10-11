from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional
from app.models.schemas import (
    OutcomeAnalysisRequest,
    OutcomeAnalysisResult
)
from app.services.outcome_analyzer_service import outcome_analyzer_service

router = APIRouter()

@router.post("/analyze", response_model=OutcomeAnalysisResult)
def analyze_unstructured_outcome(req: OutcomeAnalysisRequest):
    """
    POST /api/outcome-analyzer/analyze
    Feature 3: AI Outcome Analyzer
    Uses an LLM to turn free-text meeting notes, emails, and user feedback
    into structured, searchable account information:
    - Customer sentiment / concerns with supporting evidence (treated as an interpretation).
    - Product-adoption blockers.
    - Objections and renewal-related concerns.
    - Customer commitments and agreed next steps.
    - Unresolved issues and recommended follow-up.
    """
    try:
        return outcome_analyzer_service.analyze_outcome(req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outcome analysis failed: {e}")

@router.get("/account/{account_id}", response_model=List[OutcomeAnalysisResult])
def get_analyses_for_account(account_id: str = Path(..., description="Account ID")):
    """
    GET /api/outcome-analyzer/account/{account_id}
    Retrieves previous structured analyses for the specified account.
    """
    return outcome_analyzer_service.get_analyses_for_account(account_id)

@router.get("/{analysis_id}", response_model=OutcomeAnalysisResult)
def get_analysis_by_id(analysis_id: str = Path(..., description="Analysis ID")):
    """
    GET /api/outcome-analyzer/{analysis_id}
    Retrieves a specific analyzed report.
    """
    result = outcome_analyzer_service.get_analysis_by_id(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    return result
