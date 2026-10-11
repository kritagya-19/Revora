import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.risk_engine import DeterministicRiskEngine
from app.services.account_repository import account_repo

client = TestClient(app)


def test_transparent_risk_score_rules():
    """
    Member 2 Task B:
    Verify that transparent risk scores are computed using defined rules,
    and every rule evaluation provides points contributed, max points, threshold, and citations.
    """
    res = DeterministicRiskEngine.evaluate(
        days_to_renewal=45,
        usage_drop_pct=35.0,
        days_since_last_touchpoint=20,
        open_critical_tickets=1,
        arr=100000.0,
        evidence_ids=["sig-usage-1", "sig-crm-1", "sig-support-1"]
    )

    assert 0 <= res["risk_score"] <= 100
    assert "rule_breakdown" in res
    assert len(res["rule_breakdown"]) >= 4

    rule_ids = [r["rule_id"] for r in res["rule_breakdown"]]
    assert "RULE_USAGE_DECLINE" in rule_ids
    assert "RULE_TOUCHPOINT_SILENCE" in rule_ids
    assert "RULE_RENEWAL_WINDOW" in rule_ids
    assert "RULE_CRITICAL_TICKET" in rule_ids

    for rule in res["rule_breakdown"]:
        assert "rule_id" in rule
        assert "name" in rule
        assert rule["max_points"] > 0
        assert 0 <= rule["points_contributed"] <= rule["max_points"]
        assert len(rule["threshold_applied"]) > 0


def test_account_classification_tiers():
    """
    Member 2 Task B:
    Verify explicit classification tiers:
    - Healthy: score < 25
    - Needing Attention: 25 <= score < 50
    - High Risk: score >= 50
    """
    # 1. Healthy Account (< 25)
    healthy_res = DeterministicRiskEngine.evaluate(
        days_to_renewal=120,
        usage_drop_pct=0.0,
        days_since_last_touchpoint=5,
        open_critical_tickets=0,
        arr=50000.0
    )
    assert healthy_res["risk_score"] < 25
    assert healthy_res["classification"] == "healthy"
    assert healthy_res["risk_level"] == "low"

    # 2. Needing Attention Account (25 - 49)
    attention_res = DeterministicRiskEngine.evaluate(
        days_to_renewal=55,     # +20 pts
        usage_drop_pct=16.0,    # +12 pts
        days_since_last_touchpoint=7,
        open_critical_tickets=0,
        arr=50000.0
    )
    assert 25 <= attention_res["risk_score"] < 50
    assert attention_res["classification"] == "needing_attention"
    assert attention_res["risk_level"] == "medium"

    # 3. High Risk Account (>= 50)
    high_res = DeterministicRiskEngine.evaluate(
        days_to_renewal=25,     # +20 pts
        usage_drop_pct=35.0,    # +25 pts
        days_since_last_touchpoint=18,  # +15 pts
        open_critical_tickets=1,        # +20 pts
        arr=50000.0
    )
    assert high_res["risk_score"] >= 50
    assert high_res["classification"] == "high_risk"
    assert high_res["risk_level"] in ("high", "critical")


def test_compound_multi_signal_rules():
    """
    Member 2 Task B:
    Verify that multiple signals are combined synergistically rather than evaluated in isolation:
    - Silent Contraction (Usage Drop + Silence)
    - At-Risk Renewal (Imminent Renewal + Critical Ticket)
    - Renewal Contraction (Imminent Renewal + Usage Drop)
    """
    # Test Compound Silent Contraction
    res_silent = DeterministicRiskEngine.evaluate(
        days_to_renewal=120,
        usage_drop_pct=20.0,            # >= 15%
        days_since_last_touchpoint=18,   # >= 14d
        open_critical_tickets=0,
        arr=50000.0
    )
    assert "COMPOUND_SILENT_CONTRACTION" in res_silent["compound_rules_triggered"]

    # Test Compound At-Risk Renewal
    res_renewal = DeterministicRiskEngine.evaluate(
        days_to_renewal=45,             # <= 60d
        usage_drop_pct=0.0,
        days_since_last_touchpoint=5,
        open_critical_tickets=1,        # > 0
        arr=50000.0
    )
    assert "COMPOUND_AT_RISK_RENEWAL" in res_renewal["compound_rules_triggered"]

    # Test Compound Renewal Contraction
    res_contract = DeterministicRiskEngine.evaluate(
        days_to_renewal=35,             # <= 60d
        usage_drop_pct=30.0,            # >= 25%
        days_since_last_touchpoint=5,
        open_critical_tickets=0,
        arr=50000.0
    )
    assert "COMPOUND_RENEWAL_CONTRACTION" in res_contract["compound_rules_triggered"]


def test_deeper_investigation_trigger_criteria():
    """
    Member 2 Task B:
    Verify deeper investigation is triggered when configured risk criteria are met:
    - Score >= 50
    - Compound risk rules active
    - Critical support blockers within renewal window
    """
    # High risk account triggers investigation
    triggered_res = DeterministicRiskEngine.evaluate(
        days_to_renewal=40,
        usage_drop_pct=30.0,
        days_since_last_touchpoint=20,
        open_critical_tickets=1,
        arr=100000.0
    )
    assert triggered_res["investigation_triggered"] is True
    assert triggered_res["investigation_trigger_reason"] is not None
    assert "exceeds threshold" in triggered_res["investigation_trigger_reason"]

    # Healthy account does not trigger investigation
    healthy_res = DeterministicRiskEngine.evaluate(
        days_to_renewal=120,
        usage_drop_pct=0.0,
        days_since_last_touchpoint=3,
        open_critical_tickets=0,
        arr=50000.0
    )
    assert healthy_res["investigation_triggered"] is False
    assert healthy_res["investigation_trigger_reason"] is None


def test_churn_probability_omitted_without_validated_data():
    """
    Member 2 Task B:
    Verify that precise churn probability percentages are NOT displayed
    unless supported by validated historical data, providing clear transparency guidance instead.
    """
    res = DeterministicRiskEngine.evaluate(
        days_to_renewal=30,
        usage_drop_pct=40.0,
        days_since_last_touchpoint=25,
        open_critical_tickets=2,
        arr=150000.0
    )

    assert res["churn_probability"] is None
    assert res["display_churn_probability"] is False
    assert "strictly avoids" in res["churn_probability_disclaimer"]
    assert "deterministic" in res["churn_probability_disclaimer"]


def test_risk_scoring_api_endpoints():
    """
    Member 2 Task B:
    Test API endpoints for risk details, classification filtering, and investigation triggers.
    """
    accounts = account_repo.get_all_accounts_with_risk()
    assert len(accounts) > 0
    target_id = accounts[0].id

    # 1. GET /api/accounts/{account_id}/risk
    resp = client.get(f"/api/accounts/{target_id}/risk")
    assert resp.status_code == 200
    data = resp.json()

    assert data["account_id"] == target_id
    assert "risk_score" in data
    assert "classification" in data
    assert data["classification"] in ["healthy", "needing_attention", "high_risk"]
    assert "rule_breakdown" in data
    assert "compound_rules_triggered" in data
    assert "investigation_triggered" in data
    assert data["churn_probability"] is None
    assert data["display_churn_probability"] is False
    assert "churn_probability_disclaimer" in data

    # 2. GET /api/accounts with classification filter
    class_resp = client.get("/api/accounts?classification=high_risk")
    assert class_resp.status_code == 200
    class_data = class_resp.json()
    for acc in class_data:
        assert acc["classification"] == "high_risk"

    # 3. POST /api/accounts/{account_id}/risk/trigger-investigation
    trig_resp = client.post(f"/api/accounts/{target_id}/risk/trigger-investigation")
    assert trig_resp.status_code == 200
    trig_data = trig_resp.json()
    assert trig_data["account_id"] == target_id
    assert trig_data["risk_score"] == data["risk_score"]
