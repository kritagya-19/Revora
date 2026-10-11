import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    ImprovementInsightsReport,
    ActionableImprovementInsight,
    ImplementImprovementRequest,
    EvaluateImprovementOutcomeRequest,
)
from app.services.improvement_insights_service import improvement_insights_service

logger = logging.getLogger("revora.improvement_insights.api")

router = APIRouter()

@router.get("", response_model=ImprovementInsightsReport, summary="Get Actionable Improvement Insights Report")
@router.get("/", response_model=ImprovementInsightsReport, include_in_schema=False)
def get_improvement_insights(
    category: Optional[str] = Query(None, description="Filter by category (onboarding_improvement, customer_training, product_change, documentation_process)"),
    status: Optional[str] = Query(None, description="Filter by status (recommended, planned, implemented, monitoring, completed)"),
):
    """
    Member 3 — Task E:
    Returns actionable improvement recommendations synthesized across recurring problems,
    including onboarding guides, customer training clinics, product architectural changes,
    and process documentation, linking affected customers, protected ARR, and subsequent behavior.
    """
    try:
        return improvement_insights_service.get_insights_report(category=category, status=status)
    except Exception as e:
        logger.error(f"Failed to generate improvement insights report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{insight_id}", response_model=ActionableImprovementInsight, summary="Get Single Improvement Insight")
def get_improvement_insight_detail(insight_id: str):
    """
    Fetches the granular details of an improvement insight, including affected customers,
    estimated effort, and subsequent behavioral telemetry.
    """
    insight = improvement_insights_service.get_insight_by_id(insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail=f"Improvement insight '{insight_id}' not found.")
    return insight

@router.post("/{insight_id}/implement", response_model=ActionableImprovementInsight, summary="Implement an Improvement Initiative")
def implement_improvement_initiative(insight_id: str, request: ImplementImprovementRequest):
    """
    Transitions an insight from 'recommended' to 'implemented'.
    Records the manager/CSM lead who approved the initiative and starts telemetry tracking.
    """
    try:
        return improvement_insights_service.implement_improvement(insight_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to implement initiative {insight_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{insight_id}/evaluate", response_model=ActionableImprovementInsight, summary="Evaluate Subsequent Behavioral Outcome")
def evaluate_improvement_outcome(
    insight_id: str,
    request: Optional[EvaluateImprovementOutcomeRequest] = None
):
    """
    Evaluates subsequent customer behavior following an implemented improvement.
    Computes active seat usage delta %, support ticket reduction, and behavioral verdict.
    """
    try:
        return improvement_insights_service.evaluate_subsequent_behavior(insight_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to evaluate outcome for insight {insight_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
