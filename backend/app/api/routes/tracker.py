from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional, Dict, Any
from app.models.schemas import (
    ActionTrackerItem,
    CreateActionTrackerRequest,
    UpdateActionTrackerStatusRequest,
    SaveOutcomeRequest,
    AutoCaptureOutcomeRequest,
    ActionExecutionStatus,
    WorkStatus,
    OutcomeIntelligenceReport,
    HistoryAwareContext
)
from app.services.action_tracker_repository import action_tracker_repo
from app.services.account_repository import account_repo
from app.services.proposal_repository import proposal_repo

router = APIRouter()

@router.get("", response_model=List[ActionTrackerItem])
def list_tracked_actions(
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    action_status: Optional[str] = Query(None, description="Filter by action status: pending, approved, executing, executed, failed"),
    work_status: Optional[str] = Query(None, description="Filter by work status: not started, in progress, completed"),
    has_outcome: Optional[bool] = Query(None, description="Filter whether outcome has been captured")
):
    """
    GET /api/tracker
    Tracks every approved action from execution to completion and outcome capture.
    Provides closed-loop observability of what the team actually did.
    """
    return action_tracker_repo.get_all(
        account_id=account_id,
        action_status=action_status,
        work_status=work_status,
        has_outcome=has_outcome
    )

# Feature 4: Outcome Intelligence Endpoint
@router.get("/intelligence", response_model=OutcomeIntelligenceReport)
@router.get("/outcome-intelligence", response_model=OutcomeIntelligenceReport)
def get_outcome_intelligence():
    """
    GET /api/tracker/intelligence
    Feature 4: Analyzes historical actions and observed outcomes to identify empirical patterns,
    response rates, on-time completion, and unresolved customer blockers.
    """
    from app.services.outcome_intelligence import outcome_intelligence
    return outcome_intelligence.get_outcome_intelligence_report()

# Feature 5: History-Aware Context Endpoint
@router.get("/intelligence/account/{account_id}", response_model=HistoryAwareContext)
@router.get("/outcome-intelligence/account/{account_id}", response_model=HistoryAwareContext)
def get_account_history_intelligence(account_id: str):
    """
    GET /api/tracker/intelligence/account/{account_id}
    Feature 5: Retrieves past actions, customer reactions, unresolved commitments,
    and anti-repetition comparative rationale for an account.
    """
    from app.services.outcome_intelligence import outcome_intelligence
    return outcome_intelligence.get_account_history_context(account_id)

@router.get("/{item_id}", response_model=ActionTrackerItem)
def get_tracked_action(item_id: str):
    """
    GET /api/tracker/{item_id}
    Retrieves full details of a tracked action including original recommendation,
    execution receipts, and captured outcome form.
    """
    item = action_tracker_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Tracked action {item_id} not found")
    return item

@router.post("", response_model=ActionTrackerItem)
def create_tracked_action(req: CreateActionTrackerRequest):
    """
    POST /api/tracker
    Explicitly register an action to be tracked from recommendation to outcome.
    """
    acc = account_repo.get_account_by_id(req.account_id)
    account_name = acc.name if acc else "Customer Account"

    item = action_tracker_repo.create(
        account_id=req.account_id,
        account_name=account_name,
        title=req.title,
        action_type=req.action_type,
        proposal_id=req.proposal_id,
        description=req.description,
        investigation_id=req.investigation_id,
        evidence_ids=req.evidence_ids,
        recommendation_payload=req.recommendation_payload,
        action_status=req.action_status or ActionExecutionStatus.APPROVED,
        work_status=req.work_status or WorkStatus.NOT_STARTED,
        assigned_to=req.assigned_to or "CSM Team"
    )
    return item

@router.patch("/{item_id}/status", response_model=ActionTrackerItem)
def update_tracked_action_status(
    item_id: str,
    req: UpdateActionTrackerStatusRequest
):
    """
    PATCH /api/tracker/{item_id}/status
    Updates action status (pending, approved, executing, executed, failed)
    and work status (not started, in progress, completed).
    """
    try:
        updated = action_tracker_repo.update_status(
            item_id=item_id,
            action_status=req.action_status,
            work_status=req.work_status,
            assigned_to=req.assigned_to
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{item_id}/outcome", response_model=ActionTrackerItem)
def save_outcome(
    item_id: str,
    req: SaveOutcomeRequest
):
    """
    POST /api/tracker/{item_id}/outcome
    Captures completed outcome form: notes, customer response, commitments, and next steps.
    Marks action as executed and work status as completed.
    """
    try:
        updated = action_tracker_repo.record_outcome(
            item_id=item_id,
            notes=req.notes,
            customer_response=req.customer_response,
            commitments=req.commitments,
            next_steps=req.next_steps,
            recorded_by=req.recorded_by or "CSM Lead",
            supporting_evidence_ids=req.supporting_evidence_ids,
            auto_captured=req.auto_captured,
            capture_source=req.capture_source
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{item_id}/auto-capture", response_model=ActionTrackerItem)
def auto_capture_from_integrations(
    item_id: str,
    req: AutoCaptureOutcomeRequest = Body(default_factory=AutoCaptureOutcomeRequest)
):
    """
    POST /api/tracker/{item_id}/auto-capture
    Automatically ingests customer responses, commitments, and telemetry
    from connected integrations (Gmail, Salesforce CRM, Google Calendar) where available.
    """
    try:
        updated = action_tracker_repo.auto_capture_from_integrations(
            item_id=item_id,
            source=req.source
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/sync-approved", response_model=List[ActionTrackerItem])
def sync_all_approved_proposals():
    """
    POST /api/tracker/sync-approved
    Scans all approved / executed proposals from the Approval Center
    and ensures they have active entries in the Action & Outcome Tracker.
    """
    proposals = proposal_repo.get_all_proposals()
    accounts_map = {a.id: a for a in account_repo.get_all_accounts_with_risk()}
    synced = []

    for prop in proposals:
        if prop.status.value in ["approved", "succeeded", "executing"]:
            acc = accounts_map.get(prop.account_id)
            acc_name = acc.name if acc else "Customer Account"

            status_map = {
                "approved": ActionExecutionStatus.APPROVED,
                "executing": ActionExecutionStatus.EXECUTING,
                "succeeded": ActionExecutionStatus.EXECUTED,
                "failed": ActionExecutionStatus.FAILED
            }
            action_status = status_map.get(prop.status.value, ActionExecutionStatus.APPROVED)

            item = action_tracker_repo.sync_from_approved_proposal(
                proposal_id=prop.id,
                account_id=prop.account_id,
                account_name=acc_name,
                title=prop.title,
                action_type=prop.action_type,
                payload=prop.payload,
                evidence_ids=prop.evidence_ids,
                investigation_id=prop.investigation_id,
                status=action_status,
                execution_result=prop.execution_result,
                assigned_to=prop.approved_by or "CSM Team"
            )
            synced.append(item)

    return synced
