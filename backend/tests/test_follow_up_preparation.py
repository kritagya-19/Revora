"""
Test Suite for Task D: Automate Follow-Up Preparation
------------------------------------------------------
Validates:
1. Personalized email drafts based on the account's actual situation (usage drop, active seats, touchpoint lag, renewal date).
2. Follow-up tasks with calculated deadlines and structured operational objectives.
3. Recommended suitable next steps, such as adoption support and customer-success check-ins.
4. Proposed CRM updates with comprehensive supporting rationale and multi-field alignments.
5. End-to-end API integration via POST /api/accounts/{id}/actions/draft and GET /api/accounts/{id}/actions/history-aware.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.services.account_repository import account_repo
from app.services.llm_service import llm_service
from app.models.schemas import (
    AccountDetail,
    RiskLevel,
    DraftActionsResponse,
    CustomerMetrics,
)

client = TestClient(app)

@pytest.fixture
def high_risk_account() -> AccountDetail:
    acc = account_repo.get_account_by_id("acc-102")
    if not acc:
        accs = account_repo.get_all_accounts_with_risk()
        acc_summary = next((a for a in accs if a.risk_level.value in ("critical", "high")), accs[0])
        acc = account_repo.get_account_by_id(acc_summary.id)
    assert acc is not None, "High risk account must exist in repository"
    return acc

class TestPersonalizedEmailDrafts:
    """1. Generate personalized email drafts based on the account's actual situation."""

    def test_email_draft_reflects_actual_situation(self, high_risk_account: AccountDetail):
        email_draft = llm_service.draft_followup_email(high_risk_account)

        assert email_draft is not None
        assert "recipient" in email_draft
        assert "subject" in email_draft
        assert "body" in email_draft
        assert "reason" in email_draft
        assert "evidence_ids" in email_draft

        body = email_draft["body"]
        subject = email_draft["subject"]

        # Verifies inclusion of actual account details:
        assert high_risk_account.name in subject or high_risk_account.name in body
        assert "2026" in body or high_risk_account.renewal_date in body or "renewal" in body.lower()
        assert high_risk_account.csm_owner in body or "Customer Success" in body or "Revora" in body

        # Verifies telemetry grounding:
        # Should cite active telemetry or primary risk context (usage, tickets, or renewal)
        assert any(term in body.lower() for term in ["usage", "seat", "ticket", "renewal", "support", "contract"])

        # Verifies non-empty evidence citations
        assert len(email_draft["evidence_ids"]) > 0

    def test_email_draft_recipient_matches_primary_contact(self, high_risk_account: AccountDetail):
        email_draft = llm_service.draft_followup_email(high_risk_account)
        primary = next((c for c in high_risk_account.contacts if c.is_primary), high_risk_account.contacts[0] if high_risk_account.contacts else None)
        if primary:
            assert email_draft["recipient"] == primary.email
            first_name = primary.name.split()[0]
            assert primary.name in email_draft["body"] or first_name in email_draft["body"]

class TestFollowUpTasksWithDeadlinesAndObjectives:
    """2. Prepare follow-up tasks with deadlines and objectives."""

    def test_task_has_objectives_and_deadline(self, high_risk_account: AccountDetail):
        task = llm_service.draft_followup_task(high_risk_account)

        assert task is not None
        assert "title" in task
        assert "objective" in task
        assert "deadline" in task
        assert "description" in task
        assert "assigned_to" in task
        assert "due_date" in task
        assert "priority" in task
        assert "evidence_ids" in task

        # Check explicit operational objectives
        assert task["objective"] is not None
        assert len(task["objective"]) > 20
        assert "1." in task["objective"]  # structured multi-part milestones
        assert "2." in task["objective"]

        # Check deadline calculation
        assert task["deadline"] is not None
        # Must be valid ISO date (YYYY-MM-DD)
        datetime.strptime(task["deadline"], "%Y-%m-%d")

        # Check assigned owner and due date
        assert task["assigned_to"] == high_risk_account.csm_owner
        assert task["due_date"] == high_risk_account.renewal_date
        assert task["priority"] in ("high", "critical", "medium")

class TestRecommendedSuitableNextSteps:
    """3. Recommend suitable next steps, such as adoption support or a customer-success check-in."""

    def test_recommends_adoption_support_and_csm_checkin(self, high_risk_account: AccountDetail):
        steps = llm_service.generate_recommended_next_steps(high_risk_account)

        assert isinstance(steps, list)
        assert len(steps) >= 2

        step_types = [s["step_type"] for s in steps]
        titles = [s["title"].lower() for s in steps]

        # Must include both customer-success check-in and product adoption support
        assert "csm_check_in" in step_types
        assert "adoption_support" in step_types

        # Must have human-readable title matching the requirements
        assert any("check-in" in t for t in titles)
        assert any("adoption" in t for t in titles)

        # Validate step item schema
        for step in steps:
            assert "id" in step
            assert "title" in step
            assert "description" in step
            assert "rationale" in step
            assert "suitability_score" in step
            assert 0 <= step["suitability_score"] <= 100
            assert "urgency" in step
            assert "is_primary" in step
            assert "evidence_ids" in step

        # Must have exactly one primary recommendation
        primary_steps = [s for s in steps if s["is_primary"]]
        assert len(primary_steps) == 1
        assert primary_steps[0]["suitability_score"] >= 90

class TestProposedCRMUpdatesWithRationale:
    """4. Prepare proposed CRM updates with the supporting rationale."""

    def test_crm_update_contains_supporting_rationale(self, high_risk_account: AccountDetail):
        crm_update = llm_service.draft_crm_update(high_risk_account)

        assert crm_update is not None
        assert "field_name" in crm_update
        assert "current_value" in crm_update
        assert "proposed_value" in crm_update
        assert "reason" in crm_update
        assert "supporting_rationale" in crm_update
        assert "field_updates" in crm_update
        assert "evidence_ids" in crm_update

        # Supporting rationale must be rich, non-empty and cite risk score
        rationale = crm_update["supporting_rationale"]
        assert rationale is not None
        assert len(rationale) > 30
        assert str(high_risk_account.risk_score) in rationale

        # Multi-field proposed updates
        field_updates = crm_update["field_updates"]
        assert isinstance(field_updates, list)
        assert len(field_updates) >= 2
        for fu in field_updates:
            assert "field" in fu
            assert "current" in fu
            assert "proposed" in fu
            assert "rationale" in fu

class TestDraftActionsAPIEndpoints:
    """5. End-to-end integration via API endpoints."""

    def test_post_actions_draft_endpoint(self, high_risk_account: AccountDetail):
        resp = client.post(f"/api/accounts/{high_risk_account.id}/actions/draft")
        assert resp.status_code == 200

        data = resp.json()
        validated = DraftActionsResponse(**data)
        assert validated.account_id == high_risk_account.id

        # 1. Email Draft
        assert validated.email_draft.recipient is not None
        assert len(validated.email_draft.body) > 50

        # 2. Task Draft with objective and deadline
        assert validated.task_draft.objective is not None
        assert validated.task_draft.deadline is not None

        # 3. Recommended Next Steps
        assert len(validated.recommended_next_steps) >= 2
        next_step_types = [s.step_type for s in validated.recommended_next_steps]
        assert "csm_check_in" in next_step_types
        assert "adoption_support" in next_step_types

        # 4. CRM Update with supporting rationale
        assert validated.crm_update.supporting_rationale is not None
        assert len(validated.crm_update.field_updates) >= 2

    def test_get_history_aware_actions_endpoint(self, high_risk_account: AccountDetail):
        resp = client.get(f"/api/accounts/{high_risk_account.id}/actions/history-aware")
        assert resp.status_code == 200

        data = resp.json()
        assert data["account_id"] == high_risk_account.id
        assert data["task_draft"]["objective"] is not None
        assert data["task_draft"]["deadline"] is not None
        assert len(data["recommended_next_steps"]) >= 2
        assert data["crm_update"]["supporting_rationale"] is not None
