import pytest
from app.ai.context_builder import ContextBuilder
from app.ai.deterministic import DeterministicIntelligenceEngine
from app.ai.schemas import (
    AccountContext,
    EvidenceItem,
    InvestigationContext,
    DeterministicRiskResult,
    CustomerMetrics,
)
from app.models.schemas import RiskLevel


def test_deterministic_intelligence_evaluation():
    """
    Test Stage 2: Deterministic Intelligence correctly evaluates an InvestigationContext
    produced by Stage 1 (Context Builder).
    """
    builder = ContextBuilder()
    engine = DeterministicIntelligenceEngine()
    account_id = "acc-101"

    context = builder.build_context(account_id)
    result = engine.evaluate_context(context)

    # 1. Authoritative score & level
    assert isinstance(result, DeterministicRiskResult)
    assert 0 <= result.risk_score <= 100
    assert result.risk_level in (RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW)
    assert result.primary_reason_code != ""
    assert result.main_warning != ""
    assert len(result.contributing_factors) > 0

    # 2. Urgency assessment (isolated from ARR)
    assert result.urgency is not None
    assert result.urgency.urgency_level in ("immediate", "high", "moderate", "low")
    assert result.urgency.days_to_renewal == context.account.days_to_renewal
    assert len(result.urgency.urgency_drivers) > 0

    # 3. Trajectory trends
    assert result.trends is not None
    assert result.trends.usage_trend in ("contracting", "stable", "growing")
    assert result.trends.engagement_trend in ("disengaged", "lagging", "healthy")
    assert result.trends.support_trend in ("escalated", "active", "clear")
    assert result.trends.overall_momentum in ("negative", "neutral", "positive")

    # 4. Granular rule breakdown
    assert len(result.rule_breakdown) > 0
    catalog_ids = set(context.evidence_catalog.keys())
    for rule in result.rule_breakdown:
        assert rule.rule_id.startswith("RULE_")
        assert rule.max_points > 0
        assert 0 <= rule.points_contributed <= rule.max_points
        # Cited evidence IDs must exist in the context
        for eid in rule.evidence_ids:
            assert eid in catalog_ids or eid.replace("EVID-", "") in catalog_ids


def test_deterministic_reproducibility():
    """
    Test that identical inputs and rule version yield 100% identical outputs.
    """
    builder = ContextBuilder()
    engine = DeterministicIntelligenceEngine()
    account_id = "acc-101"

    ctx1 = builder.build_context(account_id)
    ctx2 = builder.build_context(account_id)

    res1 = engine.evaluate_context(ctx1)
    res2 = engine.evaluate_context(ctx2)

    assert res1.risk_score == res2.risk_score
    assert res1.risk_level == res2.risk_level
    assert res1.primary_reason_code == res2.primary_reason_code
    assert res1.urgency.urgency_level == res2.urgency.urgency_level
    assert res1.trends.usage_trend == res2.trends.usage_trend
    assert len(res1.rule_breakdown) == len(res2.rule_breakdown)
    for r1, r2 in zip(res1.rule_breakdown, res2.rule_breakdown):
        assert r1.rule_id == r2.rule_id
        assert r1.triggered == r2.triggered
        assert r1.points_contributed == r2.points_contributed


def test_score_capping_and_bounds():
    """
    Test that risk score is strictly capped at 100 even with all severe risk rules triggered.
    """
    engine = DeterministicIntelligenceEngine()
    
    # Construct an extreme-risk synthetic account
    account = AccountContext(
        account_id="acc-extreme-risk",
        name="Extreme Risk Corp",
        arr=150000.0,
        renewal_date="2026-10-20",
        days_to_renewal=9,
        csm_owner="Alex",
        customer_metrics=CustomerMetrics(
            active_users=50,
            baseline_users=200,
            usage_trend="-75% contraction",
            usage_drop_pct=75.0,
            recent_engagement="60d silence",
            days_since_touchpoint=60,
            open_support_tickets=4,
            critical_tickets=3,
            days_to_renewal=9,
            renewal_urgency="Immediate (<10d)",
            health_score=15
        )
    )

    evidence = [
        EvidenceItem(
            evidence_id="EVID-SIG-01",
            signal_id="sig_usage_drop_extreme",
            account_id="acc-extreme-risk",
            source_category="usage",
            title="Catastrophic Usage Contraction",
            summary="Active users plummeted by 75%",
            severity="critical",
            occurred_at="2026-10-09T00:00:00Z",
            observed_value="-75%",
            raw_reference="source://usage/rec1",
            metadata={"drop_pct": 75.0}
        ),
        EvidenceItem(
            evidence_id="EVID-SIG-02",
            signal_id="sig_cancel_request",
            account_id="acc-extreme-risk",
            source_category="crm",
            title="Cancellation Request Filed",
            summary="Customer explicitly requested non-renewal and cancellation.",
            severity="critical",
            occurred_at="2026-10-08T00:00:00Z",
            raw_reference="source://crm/rec2",
            metadata={}
        ),
        EvidenceItem(
            evidence_id="EVID-SIG-03",
            signal_id="sig_p1_outage",
            account_id="acc-extreme-risk",
            source_category="support",
            title="Unresolved Critical Outage",
            summary="P1 blocker unresolved for 10 days.",
            severity="critical",
            occurred_at="2026-10-07T00:00:00Z",
            raw_reference="source://support/rec3",
            metadata={}
        ),
    ]

    result = engine.evaluate(account, evidence)

    # Must be capped at 100
    assert result.risk_score == 100
    assert result.risk_level == RiskLevel.CRITICAL
    assert result.urgency.urgency_level == "immediate"
    assert result.trends.overall_momentum == "negative"


def test_healthy_account_evaluation():
    """
    Test evaluation of a completely healthy account with zero risk triggers.
    """
    engine = DeterministicIntelligenceEngine()
    
    account = AccountContext(
        account_id="acc-healthy",
        name="Healthy Co",
        arr=80000.0,
        renewal_date="2027-08-01",
        days_to_renewal=300,
        csm_owner="Sam",
        customer_metrics=CustomerMetrics(
            active_users=100,
            baseline_users=90,
            usage_trend="+11% growth",
            usage_drop_pct=0.0,
            recent_engagement="Active contact 3d ago",
            days_since_touchpoint=3,
            open_support_tickets=0,
            critical_tickets=0,
            days_to_renewal=300,
            renewal_urgency="Stable (>90d)",
            health_score=95
        )
    )

    result = engine.evaluate(account, [])

    assert result.risk_score == 0
    assert result.risk_level == RiskLevel.LOW
    assert result.primary_reason_code == "healthy_account"
    assert result.urgency.urgency_level == "low"
    assert result.trends.overall_momentum in ("positive", "neutral")
