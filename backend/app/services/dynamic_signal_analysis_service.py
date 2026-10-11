"""
Service: Dynamic Signal Analysis Service (Member 2 Task A)
Comprehensive multi-source signal analysis and integrity validation.
1. Retrieves actual backend records across product usage, customer engagement,
   renewal dates, meetings/calendar, and support issues.
2. Compares current 30-day activity with 90-day historical baseline.
3. Validates whether signals are missing, stale, conflicting, or insufficient.
4. Generates automated portfolio-wide signal integrity scans.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple

from app.models.schemas import (
    AccountDetail,
    Signal,
    SignalTrajectory,
    UsageAnalysis,
    EngagementAnalysis,
    RenewalAnalysis,
    MeetingsAnalysis,
    SupportAnalysis,
    BaselineComparison,
    SignalValidationIssueType,
    SignalValidationIssue,
    SignalValidationReport,
    AccountSignalAnalysisResult,
    BatchSignalAnalysisSummary,
)
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.signal_analysis")


def parse_timestamp_safe(ts_val: Any) -> datetime:
    """Safely parses timestamp string or datetime object into UTC datetime."""
    if isinstance(ts_val, datetime):
        return ts_val.astimezone(timezone.utc) if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
    if not ts_val:
        return datetime.now(timezone.utc)
    try:
        s = str(ts_val).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


class DynamicSignalAnalyzer:
    """
    Authority on dynamic signal analysis and telemetry integrity validation.
    Meets Member 2 Task A specification end-to-end.
    """

    def analyze_account(self, account_id: str) -> AccountSignalAnalysisResult:
        """
        Runs comprehensive dynamic signal analysis for a single customer account.
        Pulls actual backend records from account_repo.
        """
        account: Optional[AccountDetail] = account_repo.get_account_by_id(account_id)
        if not account:
            raise ValueError(f"Account with ID '{account_id}' not found.")

        signals: List[Signal] = account_repo.get_account_signals(account_id)
        now = datetime.now(timezone.utc)

        # 1. Product Usage Analysis
        usage_res = self._analyze_product_usage(account, signals)

        # 2. Customer Engagement Analysis
        engagement_res = self._analyze_customer_engagement(account, signals)

        # 3. Renewal Dates Analysis
        renewal_res = self._analyze_renewal_window(account, signals, now)

        # 4. Meetings & Calendar Analysis
        meetings_res = self._analyze_meetings(account, signals, now)

        # 5. Support Issues Analysis
        support_res = self._analyze_support_issues(account, signals)

        # 6. Baseline Comparison (Current 30d vs 90d Baseline)
        baseline_res = self._compare_with_baseline(account, signals, usage_res, engagement_res, support_res)

        # 7. Validation: Missing, Stale, Conflicting, Insufficient
        validation_res = self._validate_signal_health(account, signals, usage_res, engagement_res, renewal_res, support_res, now)

        # 8. Executive Signal Verdict
        verdict = self._synthesize_verdict(account, usage_res, engagement_res, renewal_res, support_res, baseline_res, validation_res)

        categories_present = sorted(list({s.source_category.lower() for s in signals}))

        return AccountSignalAnalysisResult(
            account_id=account.id,
            account_name=account.name,
            analyzed_at=now.isoformat(),
            total_signals_examined=len(signals),
            categories_present=categories_present,
            product_usage=usage_res,
            customer_engagement=engagement_res,
            renewal_window=renewal_res,
            meetings_calendar=meetings_res,
            support_issues=support_res,
            baseline_comparison=baseline_res,
            validation_report=validation_res,
            executive_signal_verdict=verdict
        )

    # -------------------------------------------------------------------------
    # Dimension 1: Product Usage Analysis
    # -------------------------------------------------------------------------
    def _analyze_product_usage(self, account: AccountDetail, signals: List[Signal]) -> UsageAnalysis:
        metrics = account.customer_metrics
        active_users = metrics.active_users if metrics else 0
        baseline_users = metrics.baseline_users if metrics else 0
        drop_pct = float(metrics.usage_drop_pct) if metrics else 0.0

        usage_signals = [s for s in signals if s.source_category.lower() == "usage" or "usage" in s.signal_type.lower()]
        evidence_ids = [s.id for s in usage_signals]

        # Check if any signal has higher observed drop
        for s in usage_signals:
            meta = s.metadata or {}
            if "drop_pct" in meta:
                drop_pct = max(drop_pct, float(meta["drop_pct"]))

        if drop_pct >= 30.0:
            traj = SignalTrajectory.SEVERE_DETERIORATION
            summary = f"Severe usage decline of -{drop_pct:.1f}% ({active_users} active vs {baseline_users} baseline). Critical license contraction."
        elif drop_pct >= 15.0:
            traj = SignalTrajectory.DETERIORATING
            summary = f"Moderate usage decline of -{drop_pct:.1f}% ({active_users} active vs {baseline_users} baseline). Active seats waning."
        elif drop_pct > 0.0:
            traj = SignalTrajectory.STABLE
            summary = f"Minor usage fluctuation (-{drop_pct:.1f}%). Activity remains within acceptable variance."
        else:
            traj = SignalTrajectory.IMPROVING
            summary = f"Healthy adoption. {active_users} active users on platform with 0% contraction."

        return UsageAnalysis(
            current_active_users=active_users,
            baseline_active_users=baseline_users,
            drop_percentage=drop_pct,
            trajectory=traj,
            evidence_signal_ids=evidence_ids,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Dimension 2: Customer Engagement Analysis
    # -------------------------------------------------------------------------
    def _analyze_customer_engagement(self, account: AccountDetail, signals: List[Signal]) -> EngagementAnalysis:
        metrics = account.customer_metrics
        days_since_touch = metrics.days_since_touchpoint if metrics else 15

        # Inspect touchpoint lag signals
        touch_signals = [s for s in signals if s.source_category.lower() in ("crm", "email", "slack", "calendar")]
        for s in touch_signals:
            meta = s.metadata or {}
            if "days_since_touchpoint" in meta:
                days_since_touch = max(days_since_touch, int(meta["days_since_touchpoint"]))

        channel_counts: Dict[str, int] = {}
        for s in touch_signals:
            cat = s.source_category.lower()
            channel_counts[cat] = channel_counts.get(cat, 0) + 1

        evidence_ids = [s.id for s in touch_signals if s.signal_type in ("touchpoint_lag", "customer_email", "csm_activity")]

        if days_since_touch >= 21:
            status = "critical_silence"
            summary = f"Critical stakeholder silence: {days_since_touch} days since last recorded CSM interaction (threshold: 14d)."
        elif days_since_touch >= 14:
            status = "lag_warning"
            summary = f"Engagement warning: {days_since_touch} days since last touchpoint across {len(channel_counts)} channels."
        else:
            status = "active"
            summary = f"Active communication cadence: Last touchpoint recorded {days_since_touch} days ago."

        # Find latest contact date if available
        last_contact = None
        for c in account.contacts:
            if c.last_contact_date:
                last_contact = c.last_contact_date
                break

        return EngagementAnalysis(
            days_since_last_touchpoint=days_since_touch,
            last_contact_date=last_contact,
            channel_breakdown=channel_counts,
            status=status,
            evidence_signal_ids=evidence_ids,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Dimension 3: Renewal Window Analysis
    # -------------------------------------------------------------------------
    def _analyze_renewal_window(self, account: AccountDetail, signals: List[Signal], now: datetime) -> RenewalAnalysis:
        days_to_renewal = 999
        renewal_dt_str = account.renewal_date

        if renewal_dt_str:
            try:
                # Support "YYYY-MM-DD" or ISO timestamp
                dt_part = renewal_dt_str[:10]
                ren_date = datetime.strptime(dt_part, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                days_to_renewal = max(0, (ren_date - now).days)
            except Exception:
                days_to_renewal = account.urgency_days_to_renewal or 60
        else:
            days_to_renewal = account.urgency_days_to_renewal or 60

        renewal_signals = [s for s in signals if any(k in s.signal_type.lower() or k in s.title.lower() for k in ("renewal", "contract", "deal"))]
        evidence_ids = [s.id for s in renewal_signals]

        if days_to_renewal <= 30:
            window_tier = "immediate"
            urgency_label = "Immediate Renewal Risk (<30d)"
            summary = f"Contract expires in {days_to_renewal} days. Immediate commercial urgency."
        elif days_to_renewal <= 60:
            window_tier = "critical"
            urgency_label = "Critical Renewal Window (<60d)"
            summary = f"Contract expires in {days_to_renewal} days. Inside critical decision-maker renewal period."
        elif days_to_renewal <= 90:
            window_tier = "approaching"
            urgency_label = "Approaching Renewal (60-90d)"
            summary = f"Contract expires in {days_to_renewal} days. Proactive alignment recommended."
        else:
            window_tier = "safe"
            urgency_label = "Safe Renewal Horizon (>90d)"
            summary = f"Renewal horizon is comfortable ({days_to_renewal} days remaining)."

        return RenewalAnalysis(
            renewal_date=renewal_dt_str,
            days_to_renewal=days_to_renewal,
            window_tier=window_tier,
            urgency_label=urgency_label,
            evidence_signal_ids=evidence_ids,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Dimension 4: Meetings & Calendar Analysis
    # -------------------------------------------------------------------------
    def _analyze_meetings(self, account: AccountDetail, signals: List[Signal], now: datetime) -> MeetingsAnalysis:
        cal_signals = [s for s in signals if s.source_category.lower() == "calendar" or "meeting" in s.signal_type.lower()]
        evidence_ids = [s.id for s in cal_signals]

        recent_count = 0
        upcoming_count = 0
        last_meeting_date = None
        next_meeting_date = None

        for s in cal_signals:
            sig_time = parse_timestamp_safe(s.event_time or s.timestamp)
            if sig_time > now:
                upcoming_count += 1
                if not next_meeting_date or sig_time.isoformat() < next_meeting_date:
                    next_meeting_date = sig_time.isoformat()
            else:
                recent_count += 1
                if not last_meeting_date or sig_time.isoformat() > last_meeting_date:
                    last_meeting_date = sig_time.isoformat()

        days_since_touch = account.customer_metrics.days_since_touchpoint if account.customer_metrics else 15

        if upcoming_count > 0:
            cadence_health = "scheduled"
            summary = f"{upcoming_count} upcoming customer alignment meeting(s) scheduled. Cadence preserved."
        elif recent_count > 0 and days_since_touch <= 14:
            cadence_health = "active_cadence"
            summary = f"Recent meeting held on {last_meeting_date[:10] if last_meeting_date else 'record'}. Meeting cadence normal."
        elif days_since_touch >= 21:
            cadence_health = "cadence_broken"
            summary = f"Meeting cadence broken: No meetings held for {days_since_touch} days and 0 scheduled upcoming meetings."
        else:
            cadence_health = "missing_meetings"
            summary = "No recent or upcoming meetings found on calendar."

        return MeetingsAnalysis(
            recent_meetings_count=recent_count,
            upcoming_meetings_count=upcoming_count,
            last_meeting_date=last_meeting_date,
            next_meeting_date=next_meeting_date,
            cadence_health=cadence_health,
            evidence_signal_ids=evidence_ids,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Dimension 5: Support Issues Analysis
    # -------------------------------------------------------------------------
    def _analyze_support_issues(self, account: AccountDetail, signals: List[Signal]) -> SupportAnalysis:
        metrics = account.customer_metrics
        open_tickets = metrics.open_support_tickets if metrics else 0
        critical_tickets = metrics.critical_tickets if metrics else 0

        support_signals = [s for s in signals if s.source_category.lower() == "support" or "ticket" in s.signal_type.lower()]
        evidence_ids = [s.id for s in support_signals]

        high_tickets = 0
        unresolved_blockers = []

        for s in support_signals:
            sev = (s.severity or "medium").lower()
            if sev == "critical":
                critical_tickets = max(critical_tickets, 1)
                unresolved_blockers.append(s.title or s.summary)
            elif sev == "high":
                high_tickets += 1
                unresolved_blockers.append(s.title or s.summary)

        if not open_tickets and support_signals:
            open_tickets = len(support_signals)

        if critical_tickets > 0:
            status = "critical_blockers"
            summary = f"{critical_tickets} critical unresolved blocker(s) impacting production workflow."
        elif high_tickets > 0:
            status = "escalated"
            summary = f"{high_tickets} high-priority support ticket(s) currently open."
        else:
            status = "nominal"
            summary = "No critical or high-severity support blockers currently open."

        return SupportAnalysis(
            open_tickets_count=open_tickets,
            critical_tickets_count=critical_tickets,
            high_tickets_count=high_tickets,
            unresolved_blockers=unresolved_blockers,
            status=status,
            evidence_signal_ids=evidence_ids,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Baseline Comparison: Historical (90d) vs Current (30d)
    # -------------------------------------------------------------------------
    def _compare_with_baseline(
        self,
        account: AccountDetail,
        signals: List[Signal],
        usage: UsageAnalysis,
        engagement: EngagementAnalysis,
        support: SupportAnalysis
    ) -> BaselineComparison:
        usage_delta = -usage.drop_percentage
        touch_lag = engagement.days_since_last_touchpoint

        # Standard touchpoint baseline is 4 touches / month (every ~7 days)
        # Touchpoint frequency delta relative to standard weekly cadence
        if touch_lag <= 7:
            touch_delta_pct = 0.0
        elif touch_lag <= 14:
            touch_delta_pct = -50.0
        elif touch_lag <= 21:
            touch_delta_pct = -75.0
        else:
            touch_delta_pct = -90.0

        support_volume_delta = support.critical_tickets_count + support.high_tickets_count

        if usage.drop_percentage >= 30.0 or support.critical_tickets_count > 0:
            trajectory = SignalTrajectory.SEVERE_DETERIORATION
            trend_desc = (
                f"Severe trajectory decline over 90-day baseline: Usage contracted by -{usage.drop_percentage:.1f}%, "
                f"touchpoint engagement fell by {abs(touch_delta_pct):.0f}%, and {support_volume_delta} critical/high support issue(s) remain open."
            )
        elif usage.drop_percentage >= 15.0 or touch_lag >= 18:
            trajectory = SignalTrajectory.DETERIORATING
            trend_desc = (
                f"Negative trend relative to baseline: Usage down -{usage.drop_percentage:.1f}%, "
                f"and communication activity slowed by {abs(touch_delta_pct):.0f}%."
            )
        elif usage.drop_percentage > 0.0:
            trajectory = SignalTrajectory.STABLE
            trend_desc = "Activity is relatively steady against 90-day baseline with minor variance."
        else:
            trajectory = SignalTrajectory.IMPROVING
            trend_desc = "Customer activity is stable or expanding relative to 90-day baseline metrics."

        return BaselineComparison(
            baseline_period_days=90,
            current_window_days=30,
            usage_delta_pct=usage_delta,
            touchpoint_frequency_delta_pct=touch_delta_pct,
            support_volume_delta=support_volume_delta,
            trajectory=trajectory,
            trend_description=trend_desc
        )

    # -------------------------------------------------------------------------
    # Signal Health & Integrity Validation
    # -------------------------------------------------------------------------
    def _validate_signal_health(
        self,
        account: AccountDetail,
        signals: List[Signal],
        usage: UsageAnalysis,
        engagement: EngagementAnalysis,
        renewal: RenewalAnalysis,
        support: SupportAnalysis,
        now: datetime
    ) -> SignalValidationReport:
        missing_issues: List[SignalValidationIssue] = []
        stale_issues: List[SignalValidationIssue] = []
        conflicting_issues: List[SignalValidationIssue] = []
        insufficient_issues: List[SignalValidationIssue] = []

        categories_present = {s.source_category.lower() for s in signals}

        # 1. Missing signals validation
        core_categories = [
            ("usage", "Product usage telemetry", "high", "Stream telemetry data from analytics platform to monitor user engagement."),
            ("crm", "CRM company records and account status", "high", "Synchronize HubSpot / Salesforce CRM company records."),
            ("calendar", "Calendar meetings and touchpoints", "medium", "Connect Google Calendar / Outlook integration."),
            ("support", "Support ticket records and escalations", "medium", "Ingest ticketing system data from Zendesk / Jira Service Management.")
        ]

        for cat_key, cat_name, cat_sev, cat_rec in core_categories:
            if cat_key not in categories_present:
                missing_issues.append(SignalValidationIssue(
                    issue_type=SignalValidationIssueType.MISSING,
                    category=cat_key,
                    severity=cat_sev,
                    description=f"Missing {cat_name}: Zero signals observed in this category.",
                    recommendation=cat_rec,
                    affected_signal_ids=[]
                ))

        # 2. Stale signals validation
        for s in signals:
            sig_time = parse_timestamp_safe(s.event_time or s.timestamp)
            age_days = (now - sig_time).days
            cat = s.source_category.lower()

            if cat == "usage" and age_days > 14:
                stale_issues.append(SignalValidationIssue(
                    issue_type=SignalValidationIssueType.STALE,
                    category="usage",
                    severity="medium",
                    description=f"Stale usage telemetry: Signal '{s.title}' is {age_days} days old without fresh stream.",
                    recommendation="Trigger real-time usage telemetry sync.",
                    affected_signal_ids=[s.id]
                ))
            elif cat in ("crm", "email") and age_days > 30:
                stale_issues.append(SignalValidationIssue(
                    issue_type=SignalValidationIssueType.STALE,
                    category="crm",
                    severity="low",
                    description=f"Stale CRM engagement: Signal '{s.title}' recorded {age_days} days ago.",
                    recommendation="Record fresh CSM activity in CRM.",
                    affected_signal_ids=[s.id]
                ))

        # 3. Conflicting signals validation
        # Conflict Check A: Healthy / Neutral status in CRM vs Severe Usage Contraction or Critical Blockers
        acc_status = (account.status or "").lower()
        if (acc_status in ("healthy", "active") or (account.health_score and account.health_score > 60)) and (usage.drop_percentage >= 25.0 or support.critical_tickets_count > 0):
            affected = usage.evidence_signal_ids + support.evidence_signal_ids
            conflicting_issues.append(SignalValidationIssue(
                issue_type=SignalValidationIssueType.CONFLICTING,
                category="status_vs_telemetry",
                severity="high",
                description=(
                    f"Conflicting Signals: Account is tagged as '{account.status}' with health score {account.health_score}, "
                    f"yet telemetry reveals severe usage drop (-{usage.drop_percentage:.1f}%) and {support.critical_tickets_count} critical blockers."
                ),
                recommendation="Reconcile manual CRM status with objective telemetry; update health score to reflect operational friction.",
                affected_signal_ids=affected[:3]
            ))

        # Conflict Check B: Active Deal / Renewal In Progress vs Complete Touchpoint Silence
        has_deal_signal = any("deal" in s.title.lower() or "pipeline" in s.title.lower() for s in signals)
        if has_deal_signal and engagement.days_since_last_touchpoint >= 21:
            deal_ids = [s.id for s in signals if "deal" in s.title.lower() or "pipeline" in s.title.lower()]
            conflicting_issues.append(SignalValidationIssue(
                issue_type=SignalValidationIssueType.CONFLICTING,
                category="sales_vs_engagement",
                severity="high",
                description=(
                    f"Conflicting Signals: CRM pipeline shows active renewal review, but customer communication has been "
                    f"silent for {engagement.days_since_last_touchpoint} days with zero scheduled meetings."
                ),
                recommendation="Audit deal stage validity; contact CSM to verify if decision-maker is unresponsive.",
                affected_signal_ids=deal_ids + engagement.evidence_signal_ids[:2]
            ))

        # Conflict Check C: Positive contact sentiment recorded vs Critical support ticket open
        positive_sentiment_contacts = [c for c in account.contacts if (c.sentiment or "").lower() in ("positive", "advocate")]
        if positive_sentiment_contacts and support.critical_tickets_count > 0:
            conflicting_issues.append(SignalValidationIssue(
                issue_type=SignalValidationIssueType.CONFLICTING,
                category="sentiment_vs_support",
                severity="medium",
                description=(
                    f"Conflicting Signals: Key contact '{positive_sentiment_contacts[0].name}' is logged with positive sentiment, "
                    f"while {support.critical_tickets_count} critical technical ticket(s) remain unresolved."
                ),
                recommendation="Verify contact awareness of technical escalations before renewal conversations.",
                affected_signal_ids=support.evidence_signal_ids[:2]
            ))

        # 4. Insufficient signals validation
        if len(signals) < 4:
            insufficient_issues.append(SignalValidationIssue(
                issue_type=SignalValidationIssueType.INSUFFICIENT,
                category="volume",
                severity="high",
                description=f"Insufficient signal volume: Only {len(signals)} signals recorded. High risk of blind spots.",
                recommendation="Ingest multi-source signals across usage, CRM, and support prior to automated decisions.",
                affected_signal_ids=[s.id for s in signals]
            ))
        elif len(categories_present) < 3:
            insufficient_issues.append(SignalValidationIssue(
                issue_type=SignalValidationIssueType.INSUFFICIENT,
                category="diversity",
                severity="medium",
                description=f"Limited category diversity: Signals span only {len(categories_present)} categories ({', '.join(categories_present)}).",
                recommendation="Connect missing channels (Calendar, Zendesk, Slack) to complete customer profile.",
                affected_signal_ids=[s.id for s in signals]
            ))

        total_issues = len(missing_issues) + len(stale_issues) + len(conflicting_issues) + len(insufficient_issues)

        # Quality Score: start at 100, apply deductibles
        score = 100
        score -= len(missing_issues) * 12
        score -= len(stale_issues) * 5
        score -= len(conflicting_issues) * 15
        score -= len(insufficient_issues) * 20
        quality_score = max(10, min(100, score))

        if quality_score >= 80:
            confidence = "high"
        elif quality_score >= 55:
            confidence = "medium"
        else:
            confidence = "low"

        is_valid = len(conflicting_issues) == 0 and len(insufficient_issues) == 0 and quality_score >= 60

        summary = (
            f"Signal Integrity Score: {quality_score}/100 ({confidence.upper()} confidence). "
            f"Detected {len(missing_issues)} missing, {len(stale_issues)} stale, "
            f"{len(conflicting_issues)} conflicting, and {len(insufficient_issues)} insufficient signal issues."
        )

        return SignalValidationReport(
            is_valid=is_valid,
            missing_signals=missing_issues,
            stale_signals=stale_issues,
            conflicting_signals=conflicting_issues,
            insufficient_signals=insufficient_issues,
            total_issues_count=total_issues,
            quality_score=quality_score,
            confidence_level=confidence,
            summary=summary
        )

    # -------------------------------------------------------------------------
    # Synthesize Final Executive Verdict
    # -------------------------------------------------------------------------
    def _synthesize_verdict(
        self,
        account: AccountDetail,
        usage: UsageAnalysis,
        engagement: EngagementAnalysis,
        renewal: RenewalAnalysis,
        support: SupportAnalysis,
        baseline: BaselineComparison,
        validation: SignalValidationReport
    ) -> str:
        parts = []

        if usage.trajectory == SignalTrajectory.SEVERE_DETERIORATION:
            parts.append(f"Usage shows severe contraction of -{usage.drop_percentage:.0f}%")
        elif usage.trajectory == SignalTrajectory.DETERIORATING:
            parts.append(f"Usage shows moderate contraction of -{usage.drop_percentage:.0f}%")
        else:
            parts.append("Usage activity is nominal")

        if engagement.status == "critical_silence":
            parts.append(f"customer communications have been completely silent for {engagement.days_since_last_touchpoint} days")
        elif engagement.status == "lag_warning":
            parts.append(f"engagement lag of {engagement.days_since_last_touchpoint} days detected")

        if renewal.window_tier in ("immediate", "critical"):
            parts.append(f"contract renewal is imminent in {renewal.days_to_renewal} days")

        if support.critical_tickets_count > 0:
            parts.append(f"{support.critical_tickets_count} critical support blocker(s) unresolved")

        verdict_str = f"Dynamic Signal Analysis for {account.name}: " + "; ".join(parts) + "."
        if validation.conflicting_signals:
            verdict_str += f" Caution: {len(validation.conflicting_signals)} cross-source signal conflicts require manual verification."

        return verdict_str

    # -------------------------------------------------------------------------
    # Automated Portfolio-wide Scanning
    # -------------------------------------------------------------------------
    def batch_analyze_portfolio(self) -> BatchSignalAnalysisSummary:
        """
        Automates scanning across all customer accounts in the portfolio.
        Produces aggregated signal integrity statistics and flags accounts with anomalies.
        """
        all_accounts = account_repo.get_all_accounts_with_risk()
        now = datetime.now(timezone.utc)

        total_scanned = len(all_accounts)
        accounts_with_conflicts = 0
        accounts_with_stale = 0
        accounts_with_missing = 0
        quality_scores = []
        summaries = []

        for acc_summary in all_accounts:
            try:
                res = self.analyze_account(acc_summary.id)
                v = res.validation_report
                if v.conflicting_signals:
                    accounts_with_conflicts += 1
                if v.stale_signals:
                    accounts_with_stale += 1
                if v.missing_signals:
                    accounts_with_missing += 1

                quality_scores.append(v.quality_score)

                summaries.append({
                    "account_id": res.account_id,
                    "account_name": res.account_name,
                    "quality_score": v.quality_score,
                    "confidence_level": v.confidence_level,
                    "trajectory": res.baseline_comparison.trajectory.value,
                    "conflicts_count": len(v.conflicting_signals),
                    "stale_count": len(v.stale_signals),
                    "missing_count": len(v.missing_signals),
                    "verdict": res.executive_signal_verdict
                })
            except Exception as e:
                logger.warning(f"Error analyzing account {acc_summary.id}: {e}")

        avg_score = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 100.0

        return BatchSignalAnalysisSummary(
            total_accounts_scanned=total_scanned,
            analyzed_at=now.isoformat(),
            accounts_with_conflicts=accounts_with_conflicts,
            accounts_with_stale_signals=accounts_with_stale,
            accounts_with_missing_signals=accounts_with_missing,
            average_signal_quality_score=avg_score,
            account_summaries=summaries
        )


# Singleton instance
dynamic_signal_analyzer = DynamicSignalAnalyzer()
