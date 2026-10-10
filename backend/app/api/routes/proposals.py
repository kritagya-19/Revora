from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
from app.models.schemas import (
    ActionProposal,
    CreateActionProposalRequest,
    PatchActionProposalRequest,
    ActionStatus
)
from app.services.proposal_repository import proposal_repo
from app.services.action_executor import action_executor
from app.core.config import settings

router = APIRouter()

@router.get("/account/{account_id}", response_model=List[ActionProposal])
def list_proposals_for_account(account_id: str):
    """Returns all action proposals prepared for a specific account."""
    return proposal_repo.get_proposals_for_account(account_id)

@router.post("", response_model=ActionProposal)
def create_action_proposal(req: CreateActionProposalRequest):
    """
    POST /api/action-proposals
    Accepts an action proposal and stores it with related account, investigation, and evidence references.
    """
    try:
        return proposal_repo.create_proposal(
            account_id=req.account_id,
            action_type=req.action_type,
            title=req.title,
            payload=req.payload,
            evidence_ids=req.evidence_ids,
            reason=req.reason,
            investigation_id=req.investigation_id,
            status=ActionStatus.PROPOSED
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{proposal_id}", response_model=ActionProposal)
def get_proposal_detail(proposal_id: str):
    """
    GET /api/action-proposals/{id}
    Retrieves proposal by ID.
    """
    prop = proposal_repo.get_proposal_by_id(proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return prop

@router.patch("/{proposal_id}", response_model=ActionProposal)
def patch_action_proposal(
    proposal_id: str,
    req: PatchActionProposalRequest
):
    """
    PATCH /api/action-proposals/{id}
    Saves edits to proposal while remaining in a reviewable state.
    Increments version number and recomputes cryptographic hash.
    """
    try:
        return proposal_repo.patch_proposal(
            proposal_id=proposal_id,
            title=req.title,
            reason=req.reason,
            payload=req.payload,
            status=req.status
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{proposal_id}", response_model=ActionProposal)
def update_proposal(
    proposal_id: str,
    title: str = Body(...),
    payload: Dict[str, Any] = Body(...)
):
    """
    Edits a proposal via PUT.
    Increments version number and automatically invalidates any prior approval.
    """
    try:
        return proposal_repo.update_proposal(proposal_id, new_title=title, new_payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{proposal_id}/approve", response_model=ActionProposal)
def approve_proposal(
    proposal_id: str,
    approver: str = Body("CSM Team"),
    expected_hash: str = Body(..., embed=True)
):
    """
    Approves a proposal, cryptographically bound to the reviewed content hash.
    Rejects stale versions.
    """
    try:
        return proposal_repo.approve_proposal(proposal_id, approver=approver, expected_hash=expected_hash)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.post("/{proposal_id}/execute")
async def execute_proposal(proposal_id: str):
    """
    Dispatches the approved action through the execution gate.
    Strictly blocked if not approved or if version is stale.
    """
    prop = proposal_repo.get_proposal_by_id(proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    try:
        result = await action_executor.execute(prop, execution_mode=settings.EXECUTION_MODE)
        return {
            "proposal_id": proposal_id,
            "status": prop.status,
            "execution": result
        }
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))

@router.get("/audit/{account_id}")
def get_account_audit_logs(account_id: str):
    """Returns immutable audit logs of proposals, edits, approvals, and execution outcomes."""
    return proposal_repo.get_audit_logs_for_account(account_id)
