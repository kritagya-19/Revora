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
    assert first_acc.main_warning is not None
    assert first_acc.urgency_label is not None

def test_account_filtering_and_sorting():
    # Filter by risk level
    high_accs = account_repo.get_all_accounts_with_risk(risk_level="critical")
    for a in high_accs:
        assert a.risk_level == "critical"

    # Sort by ARR
    arr_sorted = account_repo.get_all_accounts_with_risk(sort_by="arr")
    for i in range(len(arr_sorted) - 1):
        assert arr_sorted[i].arr >= arr_sorted[i+1].arr

    # Search filter
    search_res = account_repo.get_all_accounts_with_risk(search="Acme")
    assert len(search_res) >= 1
    assert "Acme" in search_res[0].name

def test_dashboard_summary():
    summary = account_repo.get_dashboard_summary()
    assert summary.total_accounts_monitored >= 5
    assert summary.high_risk_accounts_count >= 1
    assert summary.renewals_due_soon_count >= 1
    assert summary.high_risk_arr > 0
    assert summary.total_portfolio_arr >= summary.high_risk_arr

def test_account_risk_detail():
    risk = account_repo.get_account_risk_detail("acc-101")
    assert risk is not None
    assert risk.account_name == "Acme Technologies"
    assert risk.risk_score > 0
    assert len(risk.contributing_factors) > 0

def test_customer_metrics_and_signals():
    detail = account_repo.get_account_by_id("acc-101")
    assert detail is not None
    assert detail.name == "Acme Technologies"
    assert detail.customer_metrics is not None
    assert detail.customer_metrics.active_users > 0
    assert detail.customer_metrics.days_to_renewal > 0
    assert len(detail.signals) >= 3

    # Test single signal lookup
    sig = account_repo.get_signal_by_id("sig-101")
    assert sig is not None
    assert sig.account_id == "acc-101"
    assert sig.source_type == "usage"
    assert sig.observed_value is not None
    assert sig.source_record_id is not None

def test_evidence_records():
    evidence = account_repo.get_evidence_for_account("acc-101")
    assert len(evidence) > 0
    assert evidence[0].raw_reference.startswith("source://")

def test_proposals_retrieval():
    proposals = proposal_repo.get_proposals_for_account("acc-101")
    assert len(proposals) > 0
    assert proposals[0].id == "prop-101"
