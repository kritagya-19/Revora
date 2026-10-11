import pytest
from app.ai.persistence import PersistAndDisplayManager
from app.services.investigation_repository import investigation_repo
from app.services.proposal_repository import proposal_repo
from app.models.schemas import ActionStatus, Investigation, ActionProposal


def test_persist_and_display_full_lifecycle():
    """
    Test Stage 5: Investigation -> Action Proposal -> Human Approval lifecycle.
    """
    manager = PersistAndDisplayManager()
    account_id = "acc-101"

    # Step 1: Run complete 5-stage pipeline
    inv, prop, val = manager.run_full_pipeline_and_persist(account_id)

    # Verify Investigation persisted
    assert isinstance(inv, Investigation)
    assert inv.account_id == account_id
    assert inv.risk_score > 0
    assert len(inv.findings) > 0
    assert inv.causal_explanation != ""
    assert inv.recommended_action is not None

    # Verify stored in repository
    stored_inv = investigation_repo.get_investigation_by_id(inv.id)
    assert stored_inv is not None
    assert stored_inv.id == inv.id

    # Step 2: Verify Action Proposal staged in PROPOSED status
    assert isinstance(prop, ActionProposal)
    assert prop.account_id == account_id
    assert prop.status == ActionStatus.PROPOSED  # Staged awaiting human approval
    assert prop.version == 1
    assert prop.content_hash != ""
    assert prop.investigation_id == inv.id

    # Verify stored in proposals repository
    stored_prop = proposal_repo.get_proposal_by_id(prop.id)
    assert stored_prop is not None
    assert stored_prop.id == prop.id
    assert stored_prop.status == ActionStatus.PROPOSED

    # Step 3: Human Approval Flow
    approved_prop = proposal_repo.approve_proposal(
        proposal_id=prop.id,
        approver="CSM Lead Sarah",
        expected_hash=prop.content_hash
    )
    assert approved_prop.status == ActionStatus.APPROVED
    assert approved_prop.approved_by == "CSM Lead Sarah"
    assert approved_prop.approved_at is not None


def test_human_rejection_flow():
    """
    Test that a human CSM can reject a staged proposal with a reason.
    """
    manager = PersistAndDisplayManager()
    account_id = "acc-102"

    inv, prop, val = manager.run_full_pipeline_and_persist(account_id)
    assert prop.status == ActionStatus.PROPOSED

    rejected_prop = proposal_repo.reject_proposal(
        proposal_id=prop.id,
        reason="Customer requested delay until next quarter board meeting.",
        reviewer="CSM Director"
    )

    assert rejected_prop.status == ActionStatus.REJECTED
    # Check that rejection is also reflected when retrieving from repository
    fetched_prop = proposal_repo.get_proposal_by_id(prop.id)
    assert fetched_prop is not None
    assert fetched_prop.status == ActionStatus.REJECTED


def test_investigation_repo_integration():
    """
    Test that investigation_repo.create_or_run_investigation seamlessly triggers
    the 5-stage AI layer pipeline and stages an action proposal.
    """
    account_id = "acc-103"
    inv = investigation_repo.create_or_run_investigation(account_id)

    assert inv is not None
    assert inv.account_id == account_id
    assert inv.risk_score > 0
    assert len(inv.findings) > 0

    # Verify that an action proposal was also staged for this account
    proposals = proposal_repo.get_proposals_for_account(account_id)
    assert len(proposals) > 0
    latest_prop = proposals[-1]
    assert latest_prop.status in (ActionStatus.PROPOSED, ActionStatus.APPROVED, ActionStatus.REJECTED)
