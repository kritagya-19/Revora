import pytest
from app.services.account_repository import account_repo
from app.services.proposal_repository import proposal_repo

def test_account_repository_load():
    accounts = account_repo.get_all_accounts_with_risk()
    assert len(accounts) >= 5
    first_acc = accounts[0]
    assert first_acc.id is not None
    assert first_acc.risk_score >= 0
    assert first_acc.risk_level in ["critical", "high", "medium", "low"]

def test_account_details_and_evidence():
    detail = account_repo.get_account_by_id("acc-101")
    assert detail is not None
    assert detail.name == "Acme Dynamics"
    assert len(detail.contacts) > 0
    assert len(detail.signals) > 0

    evidence = account_repo.get_evidence_for_account("acc-101")
    assert len(evidence) > 0
    assert evidence[0].raw_reference.startswith("source://")

def test_proposals_retrieval():
    proposals = proposal_repo.get_proposals_for_account("acc-101")
    assert len(proposals) > 0
    assert proposals[0].id == "prop-101"
