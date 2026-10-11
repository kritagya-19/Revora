import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    RecurringProblem,
    RecurringProblemsReport
)
from app.services.recurring_problem_service import recurring_problem_service

logger = logging.getLogger("revora.api.recurring_problems")

router = APIRouter()

@router.get("", response_model=RecurringProblemsReport)
@router.get("/", response_model=RecurringProblemsReport)
def get_recurring_problems_report(category: Optional[str] = Query(None, description="Filter by problem category")):
    """
    Member 3 — Task D:
    Synthesizes recurring customer problems grouped across feedback, support tickets, and usage signals.
    Links each finding to affected accounts, verbatim customer quotes, and supporting telemetry.
    Explicitly distinguishes observed correlation from confirmed root cause.
    """
    try:
        report = recurring_problem_service.get_recurring_problems_report()
        if category and category.lower() != "all":
            report.problems = [p for p in report.problems if p.category.lower() == category.lower()]
            report.total_problems_identified = len(report.problems)
        return report
    except Exception as e:
        logger.error(f"Error generating recurring problems report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh", response_model=RecurringProblemsReport)
def refresh_recurring_problems():
    """
    Triggers automated re-clustering and evaluation across all active accounts and feedback records.
    """
    try:
        return recurring_problem_service.get_recurring_problems_report()
    except Exception as e:
        logger.error(f"Error refreshing recurring problems: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/account/{account_id}", response_model=List[RecurringProblem])
def get_problems_for_account(account_id: str):
    """
    Retrieves all recurring problem patterns that impact the specified customer account.
    """
    try:
        return recurring_problem_service.get_problems_by_account(account_id)
    except Exception as e:
        logger.error(f"Error fetching problems for account {account_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{problem_id}", response_model=RecurringProblem)
def get_problem_detail(problem_id: str):
    """
    Retrieves detailed breakdown of a single recurring problem cluster,
    including all affected accounts and full evidence links.
    """
    prob = recurring_problem_service.get_problem_by_id(problem_id)
    if not prob:
        raise HTTPException(status_code=404, detail=f"Recurring problem '{problem_id}' not found.")
    return prob
