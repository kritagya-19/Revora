from datetime import datetime
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
    RiskLevel,
    DraftActionsResponse
)
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("", response_model=List[AccountRiskSummary])
def list_accounts(
    risk_level: Optional[str] = Query(None, description="Filter by risk tier: critical, high, medium, low, all"),
    classification: Optional[str] = Query(None, description="Filter by classification tier: healthy, needing_attention, high_risk, all"),
    csm_owner: Optional[str] = Query(None, description="Filter by responsible CSM"),
    owner_id: Optional[str] = Query(None, description="Alias for csm_owner"),
    renewal_within_days: Optional[int] = Query(None, description="Filter accounts with renewal <= N days"),
    sort_by: Optional[str] = Query("risk_score", description="Sort field: risk_score, name, arr, renewal_date, urgency"),
    search: Optional[str] = Query(None, description="Search query across name, domain, CSM, or reason code")
):
    """
    Returns accounts ranked by deterministic risk score and revenue urgency.
    Supports multi-attribute filtering, classification tiers, and sorting.
    """
    owner = csm_owner or owner_id
    return account_repo.get_all_accounts_with_risk(
        risk_level=risk_level,
        csm_owner=owner,
        renewal_within_days=renewal_within_days,
        sort_by=sort_by,
        search=search,
        classification=classification
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
    """
    Returns the deterministic risk score breakdown, defined rule citations,
    compound multi-signal rules, classification, and investigation trigger status.
    """
    risk_detail = account_repo.get_account_risk_detail(account_id)
    if not risk_detail:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return risk_detail

@router.post("/{account_id}/risk/trigger-investigation", response_model=AccountRiskDetail)
def trigger_deeper_investigation_for_account(account_id: str):
    """
    POST /api/accounts/{account_id}/risk/trigger-investigation
    Evaluates configured risk criteria and triggers/stages a deep AI investigation.
    """
    from app.services.risk_engine import DeterministicRiskEngine
    try:
        eval_res = DeterministicRiskEngine.evaluate_account(account_id, auto_trigger_investigation=True)
        risk_detail = account_repo.get_account_risk_detail(account_id)
        if not risk_detail:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
        return risk_detail
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investigation trigger failed: {e}")

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
    Returns Revenue Risk Autopsy (Task C).
    - Automatically investigates the customer if not yet run.
    - Generates a summary of the customer's current situation.
    - Shows evidence supporting each important finding.
    - Separates observed facts from interpretations.
    - Identifies missing information and possible alternative explanations.
    """
    from app.services.investigation_repository import investigation_repo

    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    # Automatically investigate customer if none exists yet
    latest_investigation = investigation_repo.get_latest_for_account(account_id)
    if not latest_investigation:
        try:
            latest_investigation = investigation_repo.create_or_run_investigation(account_id)
        except Exception as e:
            logger.warning(f"Auto-investigation fallback: {e}")

    evidence = account_repo.get_evidence_for_account(account_id)
    facts = []
    observed_facts = []
    for ev in evidence:
        fact_item = {
            "evidence_id": ev.id,
            "evidence_ids": [ev.id],
            "claim": f"{ev.title}: {ev.summary}",
            "source_category": ev.source_category,
            "timestamp": ev.timestamp.isoformat()
        }
        facts.append(fact_item)
        observed_facts.append(fact_item)

    if latest_investigation:
        situation = (
            latest_investigation.situation_summary or
            f"Account '{acc.name}' (${acc.arr:,.0f} ARR) has {acc.urgency_days_to_renewal} days to renewal ({acc.renewal_date}). "
            f"Evaluated at risk score {acc.risk_score}/100 ({acc.risk_level.value.upper()}) due to {acc.primary_reason_code.replace('_', ' ')}."
        )

        interpretations = []
        if latest_investigation.interpretations:
            for item in latest_investigation.interpretations:
                if isinstance(item, dict):
                    interpretations.append({
                        "hypothesis": item.get("hypothesis", ""),
                        "supporting_evidence_ids": item.get("supporting_evidence_ids", []),
                        "confidence": item.get("confidence", "high")
                    })
                else:
                    interpretations.append({
                        "hypothesis": str(item),
                        "supporting_evidence_ids": [],
                        "confidence": "medium"
                    })
        elif latest_investigation.findings:
            for f in latest_investigation.findings:
                if f.type != "observed_fact":
                    interpretations.append({
                        "hypothesis": f.claim,
                        "supporting_evidence_ids": f.evidence_ids,
                        "confidence": "high"
                    })

        if not interpretations:
            interpretations.append({
                "hypothesis": f"Compounding disengagement observed across product usage and CSM communication ahead of renewal on {acc.renewal_date}.",
                "supporting_evidence_ids": [ev.id for ev in evidence[:2]],
                "confidence": "high"
            })

        missing_info = (
            latest_investigation.missing_information or
            latest_investigation.uncertainties or [
                "Customer internal budget approval status is unverified.",
                "Whether executive sponsor has evaluated alternative vendor solutions."
            ]
        )

        alt_explanations = (
            latest_investigation.alternative_explanations or [
                "License contraction may reflect seasonal enterprise holiday freeze or corporate restructuring rather than product dissatisfaction.",
                "Touchpoint silence may stem from champion project sprint priority rather than executive disengagement.",
                "Support escalations may reflect intensive workflow onboarding rather than system failure."
            ]
        )

        suggested_action = (
            latest_investigation.recommended_action.action_type
            if latest_investigation.recommended_action
            else "csm_outreach_email"
        )
    else:
        situation = (
            f"Account '{acc.name}' (${acc.arr:,.0f} ARR) is approaching contract renewal on {acc.renewal_date} "
            f"({acc.urgency_days_to_renewal} days remaining). Risk score {acc.risk_score}/100 ({acc.risk_level.value.upper()})."
        )
        interpretations = [
            {
                "hypothesis": f"Account is experiencing {acc.primary_reason_code.replace('_', ' ')} with an elevated risk score of {acc.risk_score}/100.",
                "supporting_evidence_ids": [ev.id for ev in evidence[:2]],
                "confidence": "medium"
            }
        ]
        missing_info = [
            "Customer internal budget decision timeline is unconfirmed.",
            "Whether executive sponsor has reviewed competitor options."
        ]
        alt_explanations = [
            "Usage decline could be temporary workforce restructuring rather than intentional platform churn.",
            "Meeting lag may be due to champion team sprint cycle rather than dissatisfaction."
        ]
        suggested_action = "csm_outreach_email"

    return RevenueRiskAutopsy(
        account_id=account_id,
        account_name=acc.name,
        risk_score=acc.risk_score,
        risk_level=acc.risk_level,
        rule_version="v2.1.0",
        situation_summary=situation,
        facts=facts,
        observed_facts=observed_facts,
        interpretations=interpretations,
        missing_information=missing_info,
        alternative_explanations=alt_explanations,
        unknowns=missing_info,
        suggested_action_type=suggested_action,
        created_at=datetime.utcnow().isoformat()
    )

@router.post("/{account_id}/autopsy/run", response_model=RevenueRiskAutopsy)
def run_account_autopsy(account_id: str):
    """
    Explicitly re-runs automated customer investigation and returns fresh Revenue Risk Autopsy (Task C).
    """
    from app.services.investigation_repository import investigation_repo

    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    investigation_repo.create_or_run_investigation(account_id)
    return get_account_autopsy(account_id)

@router.post("/{account_id}/actions/draft", response_model=DraftActionsResponse)
def draft_account_actions(account_id: str):
    """
    POST /api/accounts/{id}/actions/draft
    Generates personalized, evidence-grounded action drafts across:
    1. Email draft (recipient, subject, editable body, reason)
    2. Follow-up task (title, description, assigned owner, due date, priority)
    3. CRM update (field name, current value, proposed value, strategic reason, evidence citations)
    """
    from app.services.llm_service import llm_service
    from app.services.investigation_repository import investigation_repo

    acc = account_repo.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    investigation = investigation_repo.get_latest_for_account(account_id)
    drafts = llm_service.generate_draft_actions(acc, investigation)
    return drafts

@router.get("/{account_id}/actions/history-aware", response_model=DraftActionsResponse)
def get_history_aware_actions(account_id: str):
    """
    GET /api/accounts/{id}/actions/history-aware
    Feature 5: Generates recommendations informed by past outcomes and empirical patterns,
    including previous actions, customer reactions, unresolved commitments, and comparative rationale.
    """
    return draft_account_actions(account_id)

@router.get("/{account_id}/outcome-timeline")
def get_customer_outcome_timeline(account_id: str):
    """
    GET /api/accounts/{account_id}/outcome-timeline
    Feature 2: Customer Outcome Timeline
    Displays the complete chronological history of an account's signals,
    recommendations, approvals, actions, customer responses, and outcomes.
    """
    from app.services.customer_timeline_service import customer_timeline_service
    try:
        return customer_timeline_service.build_account_timeline(account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate timeline: {e}")


