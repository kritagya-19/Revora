from fastapi import APIRouter, HTTPException, Body, Query
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    ActionProposal,
    ActionStatus,
    RejectProposalRequest
)
from app.services.proposal_repository import proposal_repo
from app.services.account_repository import account_repo
from app.services.action_executor import action_executor
from app.core.config import settings

router = APIRouter()

@router.get("", response_model=List[Dict[str, Any]])
def list_pending_approvals(
    status: Optional[str] = Query(None, description="Filter proposals by status, e.g. proposed, approved, rejected")
):
    """
    GET /api/approvals
    Returns proposals awaiting human approval or with recent decisions,
    enriched with customer name, account owner, and risk context.
    """
    proposals = proposal_repo.get_all_proposals(status=status)
    accounts_map = {a.id: a for a in account_repo.get_all_accounts_with_risk()}

    enriched = []
    for prop in proposals:
        acc = accounts_map.get(prop.account_id)
        enriched.append({
            "id": prop.id,
            "account_id": prop.account_id,
            "customer_name": acc.name if acc else "Unknown Customer",
            "account_owner": acc.csm_owner if acc else "CSM Team",
            "risk_score": acc.risk_score if acc else 50,
            "risk_level": acc.risk_level.value if acc else "medium",
            "urgency_days_to_renewal": acc.urgency_days_to_renewal if acc else 90,
            "action_type": prop.action_type,
            "title": prop.title,
            "reason": prop.reason,
            "payload": prop.payload,
            "evidence_ids": prop.evidence_ids,
            "status": prop.status.value,
            "version": prop.version,
            "content_hash": prop.content_hash,
            "created_at": prop.created_at.isoformat() if hasattr(prop.created_at, "isoformat") else str(prop.created_at),
            "updated_at": prop.updated_at.isoformat() if prop.updated_at and hasattr(prop.updated_at, "isoformat") else None,
            "approved_by": prop.approved_by,
            "approved_at": prop.approved_at.isoformat() if prop.approved_at and hasattr(prop.approved_at, "isoformat") else None,
            "execution_result": prop.execution_result
        })
    return enriched

@router.post("/{proposal_id}/approve")
async def approve_and_execute_proposal(
    proposal_id: str,
    approver: str = Body("CSM Team"),
    expected_hash: Optional[str] = Body(None),
    auto_execute: bool = Body(True)
):
    """
    POST /api/approvals/{id}/approve
    1. Verifies user permissions and current proposal status.
    2. Validates version-bound cryptographic content hash.
    3. Records approval decision in approvals and action_proposals tables.
    4. Automatically dispatches approved action via ActionExecutor to prevent unapproved execution.
    """
    prop = proposal_repo.get_proposal_by_id(proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if prop.status == ActionStatus.APPROVED and prop.execution_result:
        raise HTTPException(status_code=409, detail="Proposal has already been approved and executed.")

    try:
        approved_prop = proposal_repo.approve_proposal(
            proposal_id=proposal_id,
            approver=approver,
            expected_hash=expected_hash
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # If auto_execute is True, execute through the secure ActionExecutor gate
    execution_result = None
    if auto_execute:
        try:
            execution_result = await action_executor.execute(
                approved_prop,
                execution_mode=settings.EXECUTION_MODE
            )
        except Exception as e:
            execution_result = {"error": str(e), "status": "failed"}

    refetched = proposal_repo.get_proposal_by_id(proposal_id)

    # Automatically register / sync with Action & Outcome Tracker (Feature 1)
    try:
        from app.services.action_tracker_repository import action_tracker_repo
        from app.models.schemas import ActionExecutionStatus
        acc = account_repo.get_account_by_id(approved_prop.account_id)
        acc_name = acc.name if acc else "Unknown Account"
        if execution_result and execution_result.get("status") == "succeeded":
            action_status = ActionExecutionStatus.EXECUTED
        elif execution_result and execution_result.get("status") == "failed":
            action_status = ActionExecutionStatus.FAILED
        else:
            action_status = ActionExecutionStatus.APPROVED
        action_tracker_repo.sync_from_approved_proposal(
            proposal_id=approved_prop.id,
            account_id=approved_prop.account_id,
            account_name=acc_name,
            title=approved_prop.title,
            action_type=approved_prop.action_type,
            payload=approved_prop.payload,
            evidence_ids=approved_prop.evidence_ids,
            investigation_id=approved_prop.investigation_id,
            status=action_status,
            execution_result=execution_result,
            assigned_to=approver
        )
    except Exception as sync_err:
        import logging
        logging.getLogger("revora.approvals").warning(f"Tracker auto-sync notice: {sync_err}")

    return {
        "proposal": refetched,
        "approval_status": "approved",
        "reviewer": approver,
        "execution": execution_result
    }

@router.post("/{proposal_id}/reject")
def reject_proposal(
    proposal_id: str,
    req: RejectProposalRequest
):
    """
    POST /api/approvals/{id}/reject
    Records explicit rejection decision with justification, preventing any subsequent execution.
    """
    try:
        rejected_prop = proposal_repo.reject_proposal(
            proposal_id=proposal_id,
            reason=req.reason,
            reviewer=req.reviewer or "CSM User"
        )
        return {
            "proposal": rejected_prop,
            "approval_status": "rejected",
            "decision_reason": req.reason,
            "reviewer": req.reviewer or "CSM User"
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.get("/audit-logs")
def get_system_audit_logs(limit: int = Query(100, ge=1, le=500)):
    """
    GET /api/audit-logs
    Returns immutable audit records of all proposals, approvals, rejections, and execution outcomes.
    """
    return proposal_repo.get_all_audit_logs(limit=limit)
