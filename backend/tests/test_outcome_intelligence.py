import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.outcome_intelligence import outcome_intelligence

client = TestClient(app)

def test_feature4_outcome_intelligence_report():
    """Tests Feature 4 — Outcome Intelligence analytics and empirical pattern extraction."""
    report = outcome_intelligence.get_outcome_intelligence_report()

    # 1. High-level aggregates
    assert report.total_historical_actions >= 4
    assert 0 <= report.overall_response_rate_pct <= 100
    assert 0 <= report.on_time_completion_pct <= 100
    assert report.unresolved_blockers_count >= 1

    # 2. Action Type Response Rates
    assert len(report.action_type_stats) >= 3
    action_types = {s.action_type for s in report.action_type_stats}
    assert "csm_outreach_email" in action_types
    for stat in report.action_type_stats:
        assert stat.total_dispatched >= stat.responses_received
        assert stat.benchmark_verdict in ("High Impact", "Moderate", "Passive")

    # 3. Timeliness Metrics
    assert report.timeliness.total_completed >= 1
    assert report.timeliness.on_time_rate_pct >= 50.0

    # 4. Unresolved Blockers
    assert len(report.unresolved_blockers) >= 2
    unresolved = [b for b in report.unresolved_blockers if b.unresolved]
    assert len(unresolved) >= 1
    for b in report.unresolved_blockers:
        assert b.severity in ("critical", "high", "medium")
        assert len(b.affected_account_names) >= 1
        assert len(b.recommended_remedy) > 0

    # 5. Subsequent Signal Associations
    assert len(report.action_signal_associations) >= 2
    for assoc in report.action_signal_associations:
        assert assoc.success_rate_pct >= 0.0
        assert len(assoc.observed_impact_summary) > 0

    # 6. Empirical Learned Patterns with Historical Examples
    assert len(report.learned_patterns) >= 2
    for pat in report.learned_patterns:
        assert pat.historical_examples_count >= 1
        assert pat.success_confidence_pct >= 50.0
        assert len(pat.recommended_strategy) > 0
        assert len(pat.ineffective_strategy) > 0

def test_feature5_history_aware_context():
    """Tests Feature 5 — History-Aware Recommendation Engine retrieval and anti-repetition rationale."""
    ctx = outcome_intelligence.get_account_history_context("acc-101")

    assert ctx.account_id == "acc-101"
    assert ctx.previous_actions_count >= 1
    assert len(ctx.previous_actions) >= 1

    # Customer response and commitments
    assert len(ctx.unresolved_commitments) >= 1
    assert "SSO" in ctx.unresolved_commitments[0]["commitment"] or "pricing" in ctx.unresolved_commitments[0]["commitment"].lower()

    # Similar account situations
    assert len(ctx.similar_situations_from_other_accounts) >= 1
    for sim in ctx.similar_situations_from_other_accounts:
        assert "account_name" in sim
        assert "customer_response" in sim
        assert "situation" in sim

    # Anti-repetition rationale
    assert len(ctx.preferable_to_repeating_reason) > 20
    assert "preferable" in ctx.preferable_to_repeating_reason.lower()

    # Confidence and evidence citations
    assert 0.7 <= ctx.confidence_score <= 1.0
    assert ctx.historical_examples_supporting >= 1

def test_outcome_intelligence_api_endpoints():
    """Tests GET /api/tracker/intelligence and /api/accounts/{id}/actions/history-aware endpoints."""
    # 1. Global Outcome Intelligence API
    res = client.get("/api/tracker/intelligence")
    assert res.status_code == 200
    data = res.json()
    assert "total_historical_actions" in data
    assert "action_type_stats" in data
    assert "learned_patterns" in data
    assert "unresolved_blockers" in data

    # 2. Account History Intelligence API
    res_acc = client.get("/api/tracker/intelligence/account/acc-101")
    assert res_acc.status_code == 200
    acc_data = res_acc.json()
    assert acc_data["account_id"] == "acc-101"
    assert "preferable_to_repeating_reason" in acc_data
    assert len(acc_data["similar_situations_from_other_accounts"]) >= 1

    # 3. Draft Actions with History-Aware Context
    res_draft = client.get("/api/accounts/acc-101/actions/history-aware")
    assert res_draft.status_code == 200
    draft_data = res_draft.json()
    assert "email_draft" in draft_data
    assert "history_aware_context" in draft_data
    assert draft_data["history_aware_context"] is not None
    assert "preferable_to_repeating_reason" in draft_data["history_aware_context"]
