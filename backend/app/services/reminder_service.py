import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from app.models.schemas import (
    DynamicReminder,
    ReminderType,
    ReminderStatus,
    ReminderEvaluationResult,
    CreateReminderRequest
)
from app.services.reminder_repository import reminder_repo
from app.services.account_repository import account_repo
from app.services.task_repository import task_repo
from app.services.feedback_repository import feedback_repo

logger = logging.getLogger("revora.reminder_service")

class ReminderService:
    def evaluate_portfolio_reminders(self) -> ReminderEvaluationResult:
        """
        Scans all monitored accounts against configured dynamic trigger conditions:
        1. Decline in usage (usage contraction >= 20%)
        2. Reduced engagement (touchpoint lag >= 21 days)
        3. Overdue follow-up tasks (pending task past due date)
        4. Unresolved customer feedback (satisfaction score <= 4 or critical blocker)
        5. Upcoming renewal with elevated churn risk (<= 60 days to renewal and risk score >= 60)
        
        Enforces deduplication guards using issue_key so unresolved issues do NOT trigger duplicate alerts.
        """
        accounts = account_repo.get_all_accounts_with_risk()
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_iso = datetime.now(timezone.utc).isoformat()

        new_count = 0
        dup_count = 0

        for acc in accounts:
            account_id = acc.id
            account_name = acc.name
            csm_owner = acc.csm_owner

            # Gather account signals and metrics
            acc_detail = account_repo.get_account_by_id(account_id)
            metrics = acc_detail.customer_metrics if acc_detail else None
            signals = acc_detail.signals if acc_detail else []

            usage_drop_pct = metrics.usage_drop_pct if metrics else 0.0
            days_since_touch = metrics.days_since_touchpoint if metrics else 15
            days_to_ren = acc.urgency_days_to_renewal

            # ---------------------------------------------------------
            # Condition 1: Decline in Usage
            # ---------------------------------------------------------
            if usage_drop_pct >= 20.0:
                issue_key = f"{account_id}:usage_drop"
                existing = reminder_repo.get_active_by_issue_key(issue_key)
                if existing:
                    dup_count += 1
                else:
                    sev = "critical" if usage_drop_pct >= 35.0 else "high"
                    evidence_ids = [s.id for s in signals if s.signal_type == "usage_drop"]
                    r = DynamicReminder(
                        id=f"rem-{uuid.uuid4().hex[:8]}",
                        account_id=account_id,
                        account_name=account_name,
                        reminder_type=ReminderType.USAGE_DROP,
                        title=f"Usage Contraction Alert: -{usage_drop_pct:.0f}% drop in platform seats",
                        description=f"Observed -{usage_drop_pct:.0f}% license contraction compared to baseline for {account_name}. Immediate adoption intervention recommended.",
                        severity=sev,
                        trigger_condition=f"usage_drop_pct >= 20% (observed: -{usage_drop_pct:.0f}%)",
                        issue_key=issue_key,
                        status=ReminderStatus.ACTIVE,
                        due_date=(datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
                        created_at=now_iso,
                        updated_at=now_iso,
                        evidence_ids=evidence_ids or ["sig-usage"],
                        csm_owner=csm_owner
                    )
                    reminder_repo.save_reminder(r)
                    new_count += 1

            # ---------------------------------------------------------
            # Condition 2: Reduced Engagement
            # ---------------------------------------------------------
            if days_since_touch >= 21:
                issue_key = f"{account_id}:reduced_engagement"
                existing = reminder_repo.get_active_by_issue_key(issue_key)
                if existing:
                    dup_count += 1
                else:
                    sev = "high" if days_since_touch >= 30 else "medium"
                    evidence_ids = [s.id for s in signals if s.signal_type == "touchpoint_lag"]
                    r = DynamicReminder(
                        id=f"rem-{uuid.uuid4().hex[:8]}",
                        account_id=account_id,
                        account_name=account_name,
                        reminder_type=ReminderType.REDUCED_ENGAGEMENT,
                        title=f"Touchpoint Inactivity: {days_since_touch} days since last CSM contact",
                        description=f"No logged executive or CSM meetings for {days_since_touch} days for {account_name}. Arrange check-in to preserve relationship health.",
                        severity=sev,
                        trigger_condition=f"days_since_touchpoint >= 21 (observed: {days_since_touch}d)",
                        issue_key=issue_key,
                        status=ReminderStatus.ACTIVE,
                        due_date=(datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d"),
                        created_at=now_iso,
                        updated_at=now_iso,
                        evidence_ids=evidence_ids or ["sig-touch"],
                        csm_owner=csm_owner
                    )
                    reminder_repo.save_reminder(r)
                    new_count += 1

            # ---------------------------------------------------------
            # Condition 3: Overdue Follow-up Tasks
            # ---------------------------------------------------------
            pending_tasks = task_repo.get_all_tasks(account_id=account_id, status="pending")
            for t in pending_tasks:
                if t.due_date and t.due_date < today_str:
                    issue_key = f"{account_id}:overdue_task:{t.id}"
                    existing = reminder_repo.get_active_by_issue_key(issue_key)
                    if existing:
                        dup_count += 1
                    else:
                        r = DynamicReminder(
                            id=f"rem-{uuid.uuid4().hex[:8]}",
                            account_id=account_id,
                            account_name=account_name,
                            reminder_type=ReminderType.OVERDUE_FOLLOWUP,
                            title=f"Overdue Action Follow-up: {t.title}",
                            description=f"Task '{t.title}' was due on {t.due_date} and is pending resolution. Please review task blockers or reschedule.",
                            severity="critical" if t.priority == "high" else "high",
                            trigger_condition=f"task_status == pending and due_date ({t.due_date}) < today ({today_str})",
                            issue_key=issue_key,
                            status=ReminderStatus.ACTIVE,
                            associated_task_id=t.id,
                            due_date=today_str,
                            created_at=now_iso,
                            updated_at=now_iso,
                            evidence_ids=t.evidence_ids or ["task-overdue"],
                            csm_owner=t.assigned_to or csm_owner
                        )
                        reminder_repo.save_reminder(r)
                        new_count += 1

            # ---------------------------------------------------------
            # Condition 4: Unresolved Customer Feedback
            # ---------------------------------------------------------
            fb_records = feedback_repo.list_feedback_records(account_id=account_id)
            for fb in fb_records[:3]:
                score = fb.submission.satisfaction_score
                if score is not None and score <= 4:
                    issue_key = f"{account_id}:unresolved_feedback:{fb.id}"
                    existing = reminder_repo.get_active_by_issue_key(issue_key)
                    if existing:
                        dup_count += 1
                    else:
                        blocker_text = fb.submission.primary_blocker or "Customer reported low satisfaction"
                        r = DynamicReminder(
                            id=f"rem-{uuid.uuid4().hex[:8]}",
                            account_id=account_id,
                            account_name=account_name,
                            reminder_type=ReminderType.UNRESOLVED_FEEDBACK,
                            title=f"Detractor Alert: Score {score}/10 — {blocker_text[:40]}",
                            description=f"{fb.recipient_name} gave platform satisfaction of {score}/10. Reported issue: '{fb.submission.unresolved_issues or blocker_text}'. Retention intervention staged.",
                            severity="critical",
                            trigger_condition=f"satisfaction_score <= 4 (observed: {score}/10)",
                            issue_key=issue_key,
                            status=ReminderStatus.ACTIVE,
                            due_date=(datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                            created_at=now_iso,
                            updated_at=now_iso,
                            evidence_ids=[fb.id],
                            csm_owner=csm_owner
                        )
                        reminder_repo.save_reminder(r)
                        new_count += 1

            # ---------------------------------------------------------
            # Condition 5: Upcoming Renewal with Elevated Churn Risk
            # ---------------------------------------------------------
            if days_to_ren <= 60 and acc.risk_score >= 60:
                issue_key = f"{account_id}:renewal_proximity"
                existing = reminder_repo.get_active_by_issue_key(issue_key)
                if existing:
                    dup_count += 1
                else:
                    r = DynamicReminder(
                        id=f"rem-{uuid.uuid4().hex[:8]}",
                        account_id=account_id,
                        account_name=account_name,
                        reminder_type=ReminderType.RENEWAL_PROXIMITY,
                        title=f"Critical Renewal Deadline: {days_to_ren}d to expiration (${acc.arr:,.0f} ARR)",
                        description=f"{account_name} contract expires on {acc.renewal_date} ({days_to_ren} days remaining) with elevated risk score of {acc.risk_score}/100. Close out open risk autopsy findings.",
                        severity="critical",
                        trigger_condition=f"days_to_renewal <= 60 and risk_score >= 60 (observed: {days_to_ren}d, score {acc.risk_score})",
                        issue_key=issue_key,
                        status=ReminderStatus.ACTIVE,
                        due_date=acc.renewal_date,
                        created_at=now_iso,
                        updated_at=now_iso,
                        evidence_ids=[s.id for s in signals[:2]],
                        csm_owner=csm_owner
                    )
                    reminder_repo.save_reminder(r)
                    new_count += 1

        all_active = reminder_repo.get_all(status="active")
        logger.info(f"Portfolio reminder scan completed: {new_count} new triggered, {dup_count} duplicates prevented, {len(all_active)} total active")

        return ReminderEvaluationResult(
            total_accounts_scanned=len(accounts),
            new_reminders_triggered=new_count,
            duplicates_prevented=dup_count,
            active_reminders_count=len(all_active),
            reminders=reminder_repo.get_all()
        )

    def create_custom_reminder(self, req: CreateReminderRequest) -> DynamicReminder:
        acc = account_repo.get_account_by_id(req.account_id)
        account_name = acc.name if acc else "Customer Account"
        now_iso = datetime.now(timezone.utc).isoformat()
        
        rem_id = f"rem-{uuid.uuid4().hex[:8]}"
        issue_key = f"{req.account_id}:custom:{rem_id}"

        reminder = DynamicReminder(
            id=rem_id,
            account_id=req.account_id,
            account_name=account_name,
            reminder_type=req.reminder_type,
            title=req.title,
            description=req.description,
            severity=req.severity,
            trigger_condition=req.trigger_condition or "Manual creation",
            issue_key=issue_key,
            status=ReminderStatus.ACTIVE,
            associated_task_id=req.associated_task_id,
            due_date=req.due_date or (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
            created_at=now_iso,
            updated_at=now_iso,
            evidence_ids=req.evidence_ids,
            csm_owner=acc.csm_owner if acc else "CSM Lead"
        )
        return reminder_repo.save_reminder(reminder)

    def complete_reminder(self, reminder_id: str) -> Optional[DynamicReminder]:
        return reminder_repo.update_status(reminder_id, ReminderStatus.COMPLETED)

    def dismiss_reminder(self, reminder_id: str, reason: str = "Dismissed by user") -> Optional[DynamicReminder]:
        return reminder_repo.update_status(reminder_id, ReminderStatus.DISMISSED, dismissed_reason=reason)

    def get_reminders(self, status: Optional[str] = None, account_id: Optional[str] = None) -> List[DynamicReminder]:
        return reminder_repo.get_all(status=status, account_id=account_id)

    create_reminder = create_custom_reminder

reminder_service = ReminderService()
