from app.services.account_repository import account_repo
from app.services.investigation_repository import investigation_repo
from app.services.llm_service import llm_service

def test_investigate_account_service():
    account_id = "acc-101"
    inv = investigation_repo.create_or_run_investigation(account_id)
    assert inv is not None
    assert inv.account_id == account_id
    assert inv.risk_summary != ""
    assert len(inv.findings) > 0
    assert len(inv.uncertainties) > 0
    assert inv.recommended_action is not None
    assert inv.recommended_action.type != ""
    assert inv.recommended_action.reason != ""

    # Verify findings contain citations and valid evidence IDs
    acc = account_repo.get_account_by_id(account_id)
    valid_ids = {s.id for s in acc.signals}
    for finding in inv.findings:
        assert finding.claim != ""
        assert isinstance(finding.evidence_ids, list)
        for eid in finding.evidence_ids:
            assert eid in valid_ids

def test_get_investigation_by_id():
    account_id = "acc-101"
    inv_created = investigation_repo.create_or_run_investigation(account_id)
    inv_fetched = investigation_repo.get_investigation_by_id(inv_created.id)
    assert inv_fetched is not None
    assert inv_fetched.id == inv_created.id
    assert inv_fetched.account_id == account_id

def test_ask_account_question():
    account_id = "acc-101"
    account = account_repo.get_account_by_id(account_id)
    assert account is not None
    
    resp = llm_service.answer_account_question(
        account=account,
        question="Why did active users drop and what should the CSM do?"
    )
    assert resp.account_id == account_id
    assert resp.answer != ""
    assert isinstance(resp.cited_evidence_ids, list)
    assert isinstance(resp.uncertainties, list)
    assert len(resp.cited_evidence_ids) > 0

