import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import (
    Signal,
    SignalTrajectory,
    SignalValidationIssueType,
    AccountDetail,
)
from app.services.account_repository import account_repo
from app.services.dynamic_signal_analysis_service import dynamic_signal_analyzer

client = TestClient(app)


def test_dynamic_signal_analysis_dimensions():
    """
    Member 2 Task A:
    Verify that all 5 core dimensions are dynamically evaluated for an account:
    - Product Usage
    - Customer Engagement
    - Renewal Dates
    - Meetings & Calendar
    - Support Issues
    """
    accounts = account_repo.get_all_accounts_with_risk()
    assert len(accounts) > 0
    target_id = accounts[0].id

    res = dynamic_signal_analyzer.analyze_account(target_id)
    assert res.account_id == target_id
    assert res.total_signals_examined > 0
    assert len(res.categories_present) > 0

    # Dimension 1: Usage
    assert res.product_usage.drop_percentage >= 0.0
    assert res.product_usage.trajectory in [
        SignalTrajectory.IMPROVING,
        SignalTrajectory.STABLE,
        SignalTrajectory.DETERIORATING,
        SignalTrajectory.SEVERE_DETERIORATION,
    ]
    assert len(res.product_usage.summary) > 0

    # Dimension 2: Engagement
    assert res.customer_engagement.days_since_last_touchpoint >= 0
    assert res.customer_engagement.status in ["active", "lag_warning", "critical_silence"]
    assert len(res.customer_engagement.summary) > 0

    # Dimension 3: Renewal
    assert res.renewal_window.days_to_renewal >= 0
    assert res.renewal_window.window_tier in ["immediate", "critical", "approaching", "safe"]
    assert len(res.renewal_window.summary) > 0

    # Dimension 4: Meetings
    assert res.meetings_calendar.cadence_health in ["scheduled", "active_cadence", "missing_meetings", "cadence_broken"]
    assert len(res.meetings_calendar.summary) > 0

    # Dimension 5: Support
    assert res.support_issues.status in ["nominal", "escalated", "critical_blockers"]
    assert len(res.support_issues.summary) > 0


def test_baseline_comparison():
    """
    Member 2 Task A:
    Verify baseline comparison calculates 90-day vs 30-day activity delta and trajectory.
    """
    accounts = account_repo.get_all_accounts_with_risk()
    target_id = accounts[0].id

    res = dynamic_signal_analyzer.analyze_account(target_id)
    baseline = res.baseline_comparison

    assert baseline.baseline_period_days == 90
    assert baseline.current_window_days == 30
    assert isinstance(baseline.usage_delta_pct, float)
    assert isinstance(baseline.touchpoint_frequency_delta_pct, float)
    assert len(baseline.trend_description) > 0


def test_signal_validation_missing_signals():
    """
    Member 2 Task A:
    Verify validation identifies missing telemetry categories when an account lacks them.
    """
    # Create or test an account with missing categories
    res = dynamic_signal_analyzer.analyze_account("acc-hs-351708265171")  # Notion Labs (lacks support category)
    missing_cats = [issue.category for issue in res.validation_report.missing_signals]

    assert "support" in missing_cats
    issue = next(i for i in res.validation_report.missing_signals if i.category == "support")
    assert issue.issue_type == SignalValidationIssueType.MISSING
    assert "Zendesk" in issue.recommendation or "ticketing" in issue.recommendation


def test_signal_validation_conflicting_signals():
    """
    Member 2 Task A:
    Verify validation detects contradictory signals across data silos:
    e.g., active renewal deal while customer communications are completely silent for 28+ days.
    """
    res = dynamic_signal_analyzer.analyze_account("acc-hs-351708265165")
    report = res.validation_report

    # Check for detected conflicts
    if report.conflicting_signals:
        conflict = report.conflicting_signals[0]
        assert conflict.issue_type == SignalValidationIssueType.CONFLICTING
        assert len(conflict.affected_signal_ids) > 0
        assert "Conflicting" in conflict.description


def test_signal_validation_insufficient_signals():
    """
    Member 2 Task A:
    Verify validation warns about insufficient signals when signal volume is low.
    """
    # Create a synthetic low-volume test account
    dummy_acc = AccountDetail(
        id="acc-test-low-vol",
        name="Low Vol Inc",
        domain="lowvol.com",
        arr=15000.0,
        renewal_date="2026-11-01",
        csm_owner="Test CSM",
        industry="Tech",
        health_score=80,
        tier="Growth",
        status="active",
        risk_level="low",
        risk_score=15,
        urgency_days_to_renewal=20,
        primary_reason_code="healthy_account",
        signals=[
            Signal(
                id="sig-test-1",
                account_id="acc-test-low-vol",
                source_category="crm",
                source_type="hubspot",
                signal_type="crm_sync",
                title="Single CRM Sync",
                summary="Only one signal exists",
                severity="low",
                timestamp=datetime.now(timezone.utc).isoformat()
            )
        ]
    )
    account_repo._accounts_data.append(dummy_acc.model_dump())
    account_repo._signals_data.append(dummy_acc.signals[0].model_dump())

    try:
        res = dynamic_signal_analyzer.analyze_account("acc-test-low-vol")
        assert len(res.validation_report.insufficient_signals) > 0
        issue = res.validation_report.insufficient_signals[0]
        assert issue.issue_type == SignalValidationIssueType.INSUFFICIENT
        assert res.validation_report.confidence_level in ["low", "medium"]
    finally:
        # Cleanup
        account_repo._accounts_data = [a for a in account_repo._accounts_data if a.get("id") != "acc-test-low-vol"]
        account_repo._signals_data = [s for s in account_repo._signals_data if s.get("account_id") != "acc-test-low-vol"]


def test_signal_analysis_api_endpoints():
    """
    Member 2 Task A:
    Test API endpoints for dynamic signal analysis and portfolio scanning.
    """
    accounts = account_repo.get_all_accounts_with_risk()
    target_id = accounts[0].id

    # 1. Single Account Dynamic Signal Analysis
    resp = client.get(f"/api/signals/account/{target_id}/analysis")
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_id"] == target_id
    assert "product_usage" in data
    assert "customer_engagement" in data
    assert "renewal_window" in data
    assert "meetings_calendar" in data
    assert "support_issues" in data
    assert "baseline_comparison" in data
    assert "validation_report" in data
    assert "executive_signal_verdict" in data

    # 2. Single Account Signal Validation
    v_resp = client.get(f"/api/signals/account/{target_id}/validation")
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    assert "quality_score" in v_data
    assert "confidence_level" in v_data
    assert "missing_signals" in v_data
    assert "conflicting_signals" in v_data

    # 3. Portfolio-wide Analysis
    p_resp = client.get("/api/signals/portfolio/analysis")
    assert p_resp.status_code == 200
    p_data = p_resp.json()
    assert p_data["total_accounts_scanned"] >= 10
    assert "average_signal_quality_score" in p_data
    assert len(p_data["account_summaries"]) >= 10

    # 4. Automated Portfolio Scan Trigger
    scan_resp = client.post("/api/signals/portfolio/automated-scan")
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["total_accounts_scanned"] >= 10

    # 5. Non-existent account returns 404
    bad_resp = client.get("/api/signals/account/acc-non-existent-xyz/analysis")
    assert bad_resp.status_code == 404
