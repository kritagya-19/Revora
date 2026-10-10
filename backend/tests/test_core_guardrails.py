
from app.services.risk_engine import DeterministicRiskEngine
from app.services.proposal_repository import proposal_repo
from app.services.action_executor import action_executor
from app.models.schemas import ActionStatus

def test_deterministic_risk_reproducibility():
    """Verify that identical inputs produce identical risk results."""
    res1 = DeterministicRiskEngine.evaluate(
        days_to_renewal=25,
        usage_drop_pct=45.0,
        days_since_last_touchpoint=35,
        open_critical_tickets=2,
        arr=120000.0
    )
    res2 = DeterministicRiskEngine.evaluate(
        days_to_renewal=25,
        usage_drop_pct=45.0,
        days_since_last_touchpoint=35,
        open_critical_tickets=2,
        arr=120000.0
    )
    assert res1["risk_score"] == res2["risk_score"]
    assert res1["risk_level"] == "critical"
    assert res1["primary_reason_code"] == "usage_declining_near_renewal"

def test_approval_state_gate_blocks_unapproved():
    """Verify backend execution gate blocks unapproved proposals."""
    import asyncio
    prop = proposal_repo.get_proposal_by_id("prop-101")
    assert prop is not None
    assert prop.status == ActionStatus.PROPOSED
    
    blocked = False
    try:
        asyncio.run(action_executor.execute(prop, execution_mode="simulated"))
    except PermissionError as e:
        blocked = True
        assert "is in status 'proposed'" in str(e)
    assert blocked, "Execution gate failed to block unapproved action"

def test_proposal_edit_invalidates_prior_approval():
    """Verify editing a proposal increments version and invalidates existing approval."""
    prop = proposal_repo.get_proposal_by_id("prop-102")
    original_version = prop.version
    
    # Approve first
    approved = proposal_repo.approve_proposal(prop.id, "CSM User", prop.content_hash)
    assert approved.status == ActionStatus.APPROVED

    # Edit proposal
    new_payload = {**prop.payload, "value": "Updated risk level"}
    updated = proposal_repo.update_proposal(prop.id, prop.title, new_payload)

    assert updated.version == original_version + 1
    assert updated.status == ActionStatus.PROPOSED
    assert updated.approved_by is None
