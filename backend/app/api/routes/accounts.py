from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    AccountRiskSummary,
    AccountDetail,
    AccountRiskDetail,
    Contact,
    Signal,
    EvidenceRecord,
    RevenueRiskAutopsy,
    RiskLevel
)
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("", response_model=List[AccountRiskSummary])
def list_accounts(
    risk_level: Optional[str] = Query(None, description="Filter by risk tier: critical, high, medium, low, all"),
    csm_owner: Optional[str] = Query(None, description="Filter by responsible CSM"),
    owner_id: Optional[str] = Query(None, description="Alias for csm_owner"),
    renewal_within_days: Optional[int] = Query(None, description="Filter accounts with renewal <= N days"),
    sort_by: Optional[str] = Query("risk_score", description="Sort field: risk_score, name, arr, renewal_date, urgency"),
    search: Optional[str] = Query(None, description="Search query across name, domain, CSM, or reason code")
):
    """
    Returns accounts ranked by deterministic risk score and revenue urgency.
    Supports multi-attribute filtering and sorting.
    """
    owner = csm_owner or owner_id
    return account_repo.get_all_accounts_with_risk(
        risk_level=risk_level,
        csm_owner=owner,
        renewal_within_days=renewal_within_days,
        sort_by=sort_by,
        search=search
    )

@router.get("/{account_id}", response_model=AccountDetail)
def get_account_detail(account_id: str):
    """Returns detailed account context including contacts, multi-source signals, and deterministic risk score."""
    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return acc

@router.get("/{account_id}/risk", response_model=AccountRiskDetail)
def get_account_risk(account_id: str):
    """Returns the deterministic risk score breakdown, reason codes, urgency, and warning signals."""
    risk_detail = account_repo.get_account_risk_detail(account_id)
    if not risk_detail:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return risk_detail

@router.get("/{account_id}/contacts", response_model=List[Contact])
def get_account_contacts(account_id: str):
    """Returns key stakeholders and contacts for the specified account."""
    return account_repo.get_account_contacts(account_id)

@router.get("/{account_id}/signals", response_model=List[Signal])
def get_account_signals(account_id: str):
    """Returns all multi-source signals (CRM, Email, Calendar, Usage, Support) for the account."""
    return account_repo.get_account_signals(account_id)

@router.get("/{account_id}/evidence", response_model=List[EvidenceRecord])
def get_account_evidence(account_id: str):
    """Returns chronologically ordered unified evidence for an account."""
    return account_repo.get_evidence_for_account(account_id)

@router.get("/{account_id}/autopsy", response_model=RevenueRiskAutopsy)
def get_account_autopsy(account_id: str):
    """
    Returns Revenue Risk Autopsy (Deterministic fallback + evidence grounding).
    Separates facts, interpretations, and unknowns.
    """
    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    evidence = account_repo.get_evidence_for_account(account_id)
    facts = []
    for ev in evidence:
        facts.append({
            "evidence_id": ev.id,
            "claim": ev.title,
            "source_category": ev.source_category,
            "timestamp": ev.timestamp.isoformat()
        })

    interpretations = [
        f"Account is experiencing {acc.primary_reason_code} ahead of renewal window.",
        "Customer champion disengagement may indicate budget re-evaluation."
    ]

    unknowns = [
        "Customer's internal Q4 budget decision timeline is unconfirmed.",
        "Whether executive sponsor has tested alternative vendor solutions."
    ]

    return RevenueRiskAutopsy(
        account_id=account_id,
        risk_score=acc.risk_score,
        risk_level=acc.risk_level,
        rule_version="v1.0.0",
        facts=facts,
        interpretations=interpretations,
        unknowns=unknowns,
        suggested_action_type="csm_outreach_email"
    )
