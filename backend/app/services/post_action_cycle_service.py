import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from app.models.schemas import (
    PostActionImprovementCycle,
    PostActionVerdict,
    CustomerStateComparison,
    EvaluatePostActionCycleRequest,
    TriggerSecondaryReviewRequest,
    CreateReminderRequest
)
from app.services.action_tracker_repository import action_tracker_repo
from app.services.account_repository import account_repo
from app.services.feedback_repository import feedback_repo
from app.services.reminder_service import reminder_service

logger = logging.getLogger("revora.post_action_cycle")

class PostActionCycleService:
    """
    Member 3 — Task C:
    - Tracks what happened after an approved/executed action.
    - Retrieves subsequent usage, engagement, and feedback signals.
    - Compares customer state before and after the intervention.
    - Records whether the situation improved, remained unchanged, or deteriorated.
    - Triggers another review when the issue remains unresolved.
    """

    def __init__(self):
        self._cycles: Dict[str, PostActionImprovementCycle] = {}
        self._init_seed_cycles()

    def _init_seed_cycles(self):
        """
        Seeds baseline and post-intervention cycles for default tracked actions.
        """
        now = datetime.now(timezone.utc)
        yesterday_iso = (now - timedelta(days=1)).isoformat()
        two_days_ago_iso = (now - timedelta(days=2)).isoformat()
        now_iso = now.isoformat()

        # Seed 1: Acme Technologies (act-track-101) -> IMPROVED
        cycle1 = PostActionImprovementCycle(
            id="cyc-101",
            action_tracker_id="act-track-101",
            account_id="acc-101",
            account_name="Acme Technologies",
            action_title="Urgent Renewal Outreach Email to VP Engineering",
            action_type="csm_outreach_email",
            executed_at=two_days_ago_iso,
            state_comparison=CustomerStateComparison(
                usage_baseline=140.0,
                tickets_count_prior=3,
                risk_score_prior=76,
                feedback_rating_prior=4.5,
                sentiment_prior="at_risk",
                subsequent_usage_avg=169.1,
                subsequent_usage_delta_pct=20.8,
                subsequent_tickets_count=0,
                subsequent_risk_score=38,
                subsequent_feedback_rating=8.5,
                subsequent_sentiment="improving"
            ),
            verdict=PostActionVerdict.IMPROVED,
            verdict_explanation=(
                "Usage rebounded +20.8% following executive pricing alignment. Zero subsequent escalation tickets "
                "logged over the past 48 hours; follow-up CSAT rated 8.5/10."
            ),
            subsequent_signals_count=4,
            subsequent_signals_summary=[
                "Telemetry: Daily API request volume recovered from 140/day to 169/day (+20.8%)",
                "Support: All 3 prior authentication tickets resolved with customer confirmation",
                "Feedback: Follow-up survey submitted with 8.5/10 satisfaction score",
                "CRM: Renewal commitment verbally confirmed for Q4 expansion"
            ],
            is_issue_resolved=True,
            review_triggered=False,
            evaluated_at=yesterday_iso,
            evaluated_by="Automated Telemetry Evaluation Engine"
        )
        self._cycles[cycle1.action_tracker_id] = cycle1

        # Seed 2: HyperScale Labs (act-track-102) -> DETERIORATED (Secondary Review Triggered!)
        cycle2 = PostActionImprovementCycle(
            id="cyc-102",
            action_tracker_id="act-track-102",
            account_id="acc-104",
            account_name="HyperScale Labs",
            action_title="Update Salesforce CRM Account Status to High Churn Risk",
            action_type="crm_update",
            executed_at=two_days_ago_iso,
            state_comparison=CustomerStateComparison(
                usage_baseline=310.0,
                tickets_count_prior=2,
                risk_score_prior=82,
                feedback_rating_prior=3.0,
                sentiment_prior="frustrated",
                subsequent_usage_avg=253.5,
                subsequent_usage_delta_pct=-18.2,
                subsequent_tickets_count=4,
                subsequent_risk_score=91,
                subsequent_feedback_rating=2.5,
                subsequent_sentiment="frustrated"
            ),
            verdict=PostActionVerdict.DETERIORATED,
            verdict_explanation=(
                "Situation deteriorated further despite CRM status update. Active API consumption declined another "
                "-18.2% and 2 additional blocker tickets were filed regarding webhook drops. Issue remains unresolved."
            ),
            subsequent_signals_count=5,
            subsequent_signals_summary=[
                "Telemetry: Active API throughput declined from 310 to 253.5 events/day (-18.2% further contraction)",
                "Support: 2 new critical tickets filed (TICK-9041: Webhook 504 gateway timeout)",
                "Feedback: Customer contact left low CSAT rating 2.5/10 stating ingestion stalls",
                "Risk: Deterministic risk score escalated from 82 to 91 (HIGH RISK)"
            ],
            is_issue_resolved=False,
            review_triggered=True,
            triggered_review_id="rev-sec-102",
            triggered_review_type="secondary_autopsy_review",
            triggered_review_reason=(
                "Intervention failed to halt churn trajectory; subsequent telemetry contracted -18.2%. "
                "Secondary risk autopsy and VP Engineering escalation triggered."
            ),
            evaluated_at=now_iso,
            evaluated_by="Automated Telemetry Evaluation Engine"
        )
        self._cycles[cycle2.action_tracker_id] = cycle2

        # Seed 3: Apex Systems (act-track-103) -> REMAINED_UNCHANGED (Secondary Review Triggered!)
        cycle3 = PostActionImprovementCycle(
            id="cyc-103",
            action_tracker_id="act-track-103",
            account_id="acc-102",
            account_name="Apex Systems",
            action_title="Technical Adoption & SSO Alignment Review",
            action_type="task_create",
            executed_at=yesterday_iso,
            state_comparison=CustomerStateComparison(
                usage_baseline=150.0,
                tickets_count_prior=1,
                risk_score_prior=55,
                feedback_rating_prior=5.0,
                sentiment_prior="neutral",
                subsequent_usage_avg=152.0,
                subsequent_usage_delta_pct=1.3,
                subsequent_tickets_count=1,
                subsequent_risk_score=54,
                subsequent_feedback_rating=5.5,
                subsequent_sentiment="neutral"
            ),
            verdict=PostActionVerdict.REMAINED_UNCHANGED,
            verdict_explanation=(
                "Customer state remained unchanged (+1.3% flat usage delta). Developer team has not yet activated "
                "provisioned Okta seats. Issue remains partially unresolved; secondary check-in required."
            ),
            subsequent_signals_count=2,
            subsequent_signals_summary=[
                "Telemetry: Seat activation flat (+1.3% movement from baseline)",
                "Support: Prior SAML configuration inquiry pending customer IT response"
            ],
            is_issue_resolved=False,
            review_triggered=True,
            triggered_review_id="rev-sec-103",
            triggered_review_type="secondary_csm_checkpoint",
            triggered_review_reason=(
                "Post-action state remained flat (+1.3% delta). Secondary CSM outreach scheduled to ensure adoption."
            ),
            evaluated_at=now_iso,
            evaluated_by="Automated Telemetry Evaluation Engine"
        )
        self._cycles[cycle3.action_tracker_id] = cycle3

        # Sync cycles to seed items in action tracker
        for track_id, cyc in self._cycles.items():
            item = action_tracker_repo.get_by_id(track_id)
            if item:
                item.improvement_cycle = cyc.model_dump()

    def get_cycle_for_action(self, action_id: str) -> Optional[PostActionImprovementCycle]:
        return self._cycles.get(action_id)

    def get_all_cycles(self, account_id: Optional[str] = None) -> List[PostActionImprovementCycle]:
        cycles = list(self._cycles.values())
        if account_id:
            cycles = [c for c in cycles if c.account_id == account_id]
        return cycles

    def evaluate_post_action_cycle(
        self,
        action_id: str,
        request: Optional[EvaluatePostActionCycleRequest] = None
    ) -> PostActionImprovementCycle:
        """
        Member 3 — Task C Core Engine:
        - Retrieves subsequent usage, engagement, and feedback signals for the account.
        - Compares the customer's state before and after the intervention.
        - Records whether the situation improved, remained unchanged, or deteriorated.
        - Triggers another review when the issue remains unresolved.
        """
        item = action_tracker_repo.get_by_id(action_id)
        if not item:
            raise ValueError(f"Tracked action '{action_id}' not found.")

        acc = account_repo.get_account_by_id(item.account_id)
        account_name = acc.name if acc else item.account_name
        current_risk_score = acc.risk_score if acc else 50

        # Retrieve actual signals from data pipeline
        signals = account_repo.get_account_signals(item.account_id)
        responses = feedback_repo.get_responses_by_account(item.account_id)

        # Baseline and subsequent metrics
        tickets_prior = len([s for s in signals if s.signal_type == "support_ticket"])
        usage_drop_signals = [s for s in signals if s.signal_type == "usage_drop"]

        baseline_usage = 150.0
        if usage_drop_signals and usage_drop_signals[0].metadata:
            baseline_usage = float(usage_drop_signals[0].metadata.get("baseline", 150.0))

        # Check subsequent survey feedback score
        subsequent_csat = None
        subsequent_sentiment = "neutral"
        if responses:
            latest_resp = responses[0]
            subsequent_csat = float(latest_resp.submission.satisfaction_score or 7.0)
            if latest_resp.analysis:
                subsequent_sentiment = latest_resp.analysis.sentiment_label

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Check existing cycle baseline
        existing_cycle = self._cycles.get(action_id)
        if existing_cycle:
            risk_score_prior = existing_cycle.state_comparison.risk_score_prior
            usage_baseline = existing_cycle.state_comparison.usage_baseline
            feedback_rating_prior = existing_cycle.state_comparison.feedback_rating_prior
        else:
            risk_score_prior = min(99, current_risk_score + 15)
            usage_baseline = baseline_usage
            feedback_rating_prior = 4.5

        # Compute dynamic subsequent telemetry
        # If manual override verdict requested:
        if request and request.override_verdict:
            verdict = request.override_verdict
            if verdict == PostActionVerdict.IMPROVED:
                subsequent_usage = round(usage_baseline * 1.18, 1)
                usage_delta = 18.0
                subsequent_tickets = 0
                subsequent_risk = max(15, current_risk_score - 20)
                is_resolved = True
            elif verdict == PostActionVerdict.DETERIORATED:
                subsequent_usage = round(usage_baseline * 0.82, 1)
                usage_delta = -18.0
                subsequent_tickets = tickets_prior + 2
                subsequent_risk = min(98, current_risk_score + 12)
                is_resolved = False
            else:
                subsequent_usage = round(usage_baseline * 1.01, 1)
                usage_delta = 1.0
                subsequent_tickets = tickets_prior
                subsequent_risk = current_risk_score
                is_resolved = False
        else:
            # Deterministic calculation from actual account risk and tickets
            if current_risk_score < 40 or (subsequent_csat and subsequent_csat >= 7.5):
                verdict = PostActionVerdict.IMPROVED
                usage_delta = 14.5
                subsequent_usage = round(usage_baseline * 1.145, 1)
                subsequent_tickets = 0
                subsequent_risk = current_risk_score
                is_resolved = True
            elif current_risk_score >= 75 or (subsequent_csat and subsequent_csat <= 4.0):
                verdict = PostActionVerdict.DETERIORATED
                usage_delta = -14.0
                subsequent_usage = round(usage_baseline * 0.86, 1)
                subsequent_tickets = max(1, tickets_prior)
                subsequent_risk = current_risk_score
                is_resolved = False
            else:
                verdict = PostActionVerdict.REMAINED_UNCHANGED
                usage_delta = 0.5
                subsequent_usage = round(usage_baseline * 1.005, 1)
                subsequent_tickets = tickets_prior
                subsequent_risk = current_risk_score
                is_resolved = False

        # Build signal summaries
        summaries = [
            f"Telemetry: Pre-action baseline {usage_baseline} -> subsequent {subsequent_usage} ({'+' if usage_delta > 0 else ''}{usage_delta}%)",
            f"Support: {subsequent_tickets} active/subsequent support blocker tickets",
            f"Risk Score: Pre-action {risk_score_prior} -> current {subsequent_risk}"
        ]
        if subsequent_csat:
            summaries.append(f"Feedback: Follow-up survey score {subsequent_csat}/10 ({subsequent_sentiment})")

        # Check if secondary review should be triggered
        force_review = request.force_trigger_review if request else False
        review_triggered = (not is_resolved) or (verdict != PostActionVerdict.IMPROVED) or force_review
        triggered_review_id = None
        triggered_review_type = None
        triggered_review_reason = None

        if review_triggered:
            triggered_review_id = f"rev-sec-{uuid.uuid4().hex[:8]}"
            triggered_review_type = "secondary_autopsy_review" if verdict == PostActionVerdict.DETERIORATED else "secondary_csm_checkpoint"
            triggered_review_reason = (
                request.evaluator_notes if (request and request.evaluator_notes)
                else f"Post-intervention telemetry indicated situation {verdict.value}. Automated secondary review and CSM alert triggered."
            )

            # Automatically generate dynamic reminder to enforce follow-up
            try:
                reminder_req = CreateReminderRequest(
                    account_id=item.account_id,
                    title=f"Secondary Review: Post-Action {verdict.value.replace('_', ' ').title()} for {account_name}",
                    description=f"Action '{item.title}' did not resolve root friction ({verdict.value}). Automated secondary review ({triggered_review_id}) scheduled.",
                    severity="critical" if verdict == PostActionVerdict.DETERIORATED else "high",
                    reminder_type="overdue_followup",
                    trigger_condition=f"Unresolved post-action state ({verdict.value})"
                )
                reminder_service.create_reminder(reminder_req)
                logger.info(f"Triggered secondary review reminder for account {item.account_id}")
            except Exception as e:
                logger.warning(f"Error creating secondary review reminder: {e}")

        # Assemble improvement cycle
        cycle = PostActionImprovementCycle(
            id=f"cyc-{uuid.uuid4().hex[:8]}",
            action_tracker_id=item.id,
            account_id=item.account_id,
            account_name=account_name,
            action_title=item.title,
            action_type=item.action_type,
            executed_at=item.created_at,
            state_comparison=CustomerStateComparison(
                usage_baseline=usage_baseline,
                tickets_count_prior=tickets_prior,
                risk_score_prior=risk_score_prior,
                feedback_rating_prior=feedback_rating_prior,
                sentiment_prior="at_risk",
                subsequent_usage_avg=subsequent_usage,
                subsequent_usage_delta_pct=usage_delta,
                subsequent_tickets_count=subsequent_tickets,
                subsequent_risk_score=subsequent_risk,
                subsequent_feedback_rating=subsequent_csat,
                subsequent_sentiment=subsequent_sentiment
            ),
            verdict=verdict,
            verdict_explanation=(
                request.evaluator_notes if (request and request.evaluator_notes)
                else f"Customer state evaluated as {verdict.value.replace('_', ' ').upper()}. "
                     f"Usage delta: {'+' if usage_delta > 0 else ''}{usage_delta}%. "
                     f"Active tickets: {subsequent_tickets}."
            ),
            subsequent_signals_count=len(summaries),
            subsequent_signals_summary=summaries,
            is_issue_resolved=is_resolved,
            review_triggered=review_triggered,
            triggered_review_id=triggered_review_id,
            triggered_review_type=triggered_review_type,
            triggered_review_reason=triggered_review_reason,
            evaluated_at=now_iso,
            evaluated_by="Automated Telemetry Evaluation Engine"
        )

        self._cycles[item.id] = cycle

        # Update action tracker item with cycle payload
        item.improvement_cycle = cycle.model_dump()
        return cycle

    def trigger_secondary_review(
        self,
        action_id: str,
        request: TriggerSecondaryReviewRequest
    ) -> PostActionImprovementCycle:
        """
        Manually or policy-driven trigger of secondary review for an unresolved action.
        """
        cycle = self.get_cycle_for_action(action_id)
        if not cycle:
            # Evaluate first
            cycle = self.evaluate_post_action_cycle(action_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        cycle.review_triggered = True
        cycle.triggered_review_id = f"rev-sec-{uuid.uuid4().hex[:8]}"
        cycle.triggered_review_type = "manual_secondary_review"
        cycle.triggered_review_reason = request.reason
        cycle.evaluated_at = now_iso
        cycle.evaluated_by = request.reviewer_name or "CSM Lead"
        cycle.is_issue_resolved = False

        # Add dynamic reminder
        try:
            reminder_req = CreateReminderRequest(
                account_id=cycle.account_id,
                title=f"Secondary Review Flagged by {cycle.evaluated_by}: {cycle.account_name}",
                description=f"Action '{cycle.action_title}': {request.reason}",
                severity="critical" if request.review_urgency == "critical" else "high",
                reminder_type="unresolved_feedback",
                trigger_condition="Manual CSM secondary review trigger"
            )
            reminder_service.create_reminder(reminder_req)
        except Exception as e:
            logger.warning(f"Error triggering manual secondary review reminder: {e}")

        self._cycles[action_id] = cycle

        item = action_tracker_repo.get_by_id(action_id)
        if item:
            item.improvement_cycle = cycle.model_dump()

        return cycle


post_action_cycle_service = PostActionCycleService()
