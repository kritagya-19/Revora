from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.models.schemas import (
    AccountRiskSummary,
    AccountDetail,
    Contact,
    Signal,
    EvidenceRecord,
    RevenueRiskAutopsy,
    RiskLevel
)
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("", response_model=List[AccountRiskSummary])
def list_accounts():
    """Returns accounts ranked by deterministic risk score and revenue urgency."""
    return account_repo.get_all_accounts_with_risk()

@router.get("/{account_id}", response_model=AccountDetail)
def get_account_detail(account_id: str):
    """Returns detailed account context including contacts and multi-source signals."""
    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return acc

@router.get("/{account_id}/contacts", response_model=List[Contact])
def get_account_contacts(account_id: str):
    """Returns key stakeholders and contacts for the specified account."""
    return account_repo.get_account_contacts(account_id)

@router.get("/{account_id}/signals", response_model=List[Signal])
def get_account_signals(account_id: str):
    """Returns all multi-source signals for the account."""
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
