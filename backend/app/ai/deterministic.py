"""
Stage 2: Deterministic Intelligence for Revora AI Layer.
Computes authoritative Risk Score, Urgency, Trends, and Rule Breakdown.
Strictly deterministic and reproducible. LLMs CANNOT modify or overwrite authoritative values.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.ai.schemas import (
    AccountContext,
    DeterministicRiskResult,
    EvidenceItem,
    InvestigationContext,
    RuleEvaluation,
    TrendSummary,
    UrgencyAssessment,
)
from app.models.schemas import RiskLevel

logger = logging.getLogger("revora.ai.deterministic")


class DeterministicIntelligenceEngine:
    """
    Stage 2: Deterministic Intelligence.
    Calculates authoritative:
    1. Risk Score (0-100) & Contributing Rules
    2. Urgency & Urgency Drivers (isolated from ARR)
    3. Trajectory Trends (Usage, Engagement, Support, Momentum)
    4. Granular Rule Breakdown citing verified Evidence IDs
    """
    RULE_VERSION = "v2.0.0"

    # Standard Rule Definitions & Point Allocations
    # Weights aligned with SignalBridge Team Roadmap & PRD
    RULES = {
        "RULE_USAGE_DECLINE": {
            "name": "Product Usage Decline",
            "max_points": 25,
            "threshold_pct": 30.0,
        },
        "RULE_TOUCHPOINT_SILENCE": {
            "name": "Communication & Touchpoint Silence (14+ Days)",
            "max_points": 15,
            "threshold_days": 14,
        },
        "RULE_RENEWAL_WINDOW": {
            "name": "Upcoming Renewal Window (<60 Days)",
            "max_points": 20,
            "threshold_days": 60,
        },
        "RULE_CRITICAL_TICKET": {
            "name": "Severe Unresolved Support Issue",
            "max_points": 20,
        },
        "RULE_CHAMPION_LOST": {
            "name": "Key Champion Departure or Reassignment",
            "max_points": 10,
        },
        "RULE_CANCELLATION_INTENT": {
            "name": "Explicit Downgrade / Cancellation Intent",
            "max_points": 25,
        },
    }

    @classmethod
    def evaluate_context(cls, context: InvestigationContext) -> DeterministicRiskResult:
        """
        Main entry point for evaluating an InvestigationContext produced by Stage 1.
        """
        return cls.evaluate(
            account=context.account,
            evidence_items=context.selected_evidence
        )

    @classmethod
    def evaluate(
        cls,
        account: AccountContext,
        evidence_items: List[EvidenceItem]
    ) -> DeterministicRiskResult:
        """
        Evaluates risk, urgency, trends, and rules for given account and verified evidence items.
        """
        # 1. Rule evaluations citing evidence IDs
        rule_evaluations, raw_score = cls._evaluate_rules(account, evidence_items)

        # Cap authoritative risk score between 0 and 100
        authoritative_score = min(max(raw_score, 0), 100)

        # 2. Risk level categorization
        risk_level = cls._determine_risk_level(authoritative_score)

        # 3. Urgency evaluation (separate from risk & ARR)
        urgency = cls._evaluate_urgency(account, evidence_items)

        # 4. Trend calculation
        trends = cls._evaluate_trends(account, evidence_items)

        # 5. Primary reason code and warning
        primary_reason, main_warning, contributing_factors = cls._synthesize_risk_drivers(
            account, rule_evaluations, trends, urgency
        )

        return DeterministicRiskResult(
            account_id=account.account_id,
            risk_score=authoritative_score,
            risk_level=risk_level,
            primary_reason_code=primary_reason,
            main_warning=main_warning,
            contributing_factors=contributing_factors,
            urgency=urgency,
            trends=trends,
            rule_breakdown=rule_evaluations,
            rule_version=cls.RULE_VERSION,
            evaluated_at=datetime.now(timezone.utc).isoformat()
        )

    @classmethod
    def _evaluate_rules(
        cls,
        account: AccountContext,
        evidence: List[EvidenceItem]
    ) -> Tuple[List[RuleEvaluation], int]:
        """
        Evaluates each deterministic rule, attaches supporting evidence citations,
        and aggregates the score without double-counting.
        """
        evaluations: List[RuleEvaluation] = []
        total_points = 0

        # Pre-index evidence by category and keywords
        usage_items = [e for e in evidence if e.source_category == "usage"]
        crm_email_items = [e for e in evidence if e.source_category in ("email", "calendar", "crm")]
        support_items = [e for e in evidence if e.source_category == "support"]
        cancellation_items = [
            e for e in evidence
            if any(k in e.signal_id.lower() or k in e.title.lower() or k in e.summary.lower()
                   for k in ("cancellation", "cancel", "downgrade", "churn"))
        ]
        champion_lost_items = [
            e for e in evidence
            if any(k in e.signal_id.lower() or k in e.title.lower() or k in e.summary.lower()
                   for k in ("champion", "departure", "left company", "reassigned", "contact_change"))
        ]

        # --- Rule 1: Product Usage Decline (>30% -> +25 pts; 15-30% -> +12 pts) ---
        usage_drop_pct = 0.0
        if account.customer_metrics:
            usage_drop_pct = max(usage_drop_pct, float(account.customer_metrics.usage_drop_pct))

        cited_usage_ids = []
        for e in usage_items:
            meta = e.metadata or {}
            drop = meta.get("drop_pct")
            if drop is not None:
                usage_drop_pct = max(usage_drop_pct, float(drop))
                cited_usage_ids.append(e.evidence_id)
            elif "drop" in e.signal_id or "decline" in e.signal_id or "contraction" in e.summary.lower():
                cited_usage_ids.append(e.evidence_id)

        rule1_points = 0
        rule1_exp = "Product usage is healthy or within normal seasonal baselines."
        if usage_drop_pct >= 30.0:
            rule1_points = 25
            rule1_exp = f"Severe usage decline of -{usage_drop_pct:.1f}% exceeds the 30% contraction threshold."
        elif usage_drop_pct >= 15.0:
            rule1_points = 12
            rule1_exp = f"Moderate usage decline of -{usage_drop_pct:.1f}% detected."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_USAGE_DECLINE",
            rule_name=cls.RULES["RULE_USAGE_DECLINE"]["name"],
            triggered=rule1_points > 0,
            points_contributed=rule1_points,
            max_points=cls.RULES["RULE_USAGE_DECLINE"]["max_points"],
            explanation=rule1_exp,
            evidence_ids=cited_usage_ids
        ))
        total_points += rule1_points

        # --- Rule 2: Communication & Touchpoint Silence (14+ Days -> +15 pts; 30+ Days -> +20 pts) ---
        days_silence = 0
        if account.customer_metrics:
            days_silence = max(days_silence, account.customer_metrics.days_since_touchpoint)

        cited_silence_ids = []
        for e in crm_email_items:
            meta = e.metadata or {}
            lag = meta.get("days_since_touchpoint")
            if lag is not None:
                days_silence = max(days_silence, int(lag))
                cited_silence_ids.append(e.evidence_id)
            elif "silence" in e.signal_id or "lag" in e.signal_id or "unresponsive" in e.summary.lower():
                cited_silence_ids.append(e.evidence_id)

        rule2_points = 0
        rule2_exp = f"Last customer interaction was recorded {days_silence} days ago."
        if days_silence >= 30:
            rule2_points = 15
            rule2_exp = f"Prolonged customer silence: {days_silence} days without CSM communication (severe lag >30d)."
        elif days_silence >= 14:
            rule2_points = 15
            rule2_exp = f"Customer disengagement: {days_silence} days without recorded CSM touchpoint (threshold: 14d)."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_TOUCHPOINT_SILENCE",
            rule_name=cls.RULES["RULE_TOUCHPOINT_SILENCE"]["name"],
            triggered=rule2_points > 0,
            points_contributed=rule2_points,
            max_points=cls.RULES["RULE_TOUCHPOINT_SILENCE"]["max_points"],
            explanation=rule2_exp,
            evidence_ids=cited_silence_ids
        ))
        total_points += rule2_points

        # --- Rule 3: Upcoming Renewal Window (<60 Days -> +20 pts) ---
        days_to_ren = account.days_to_renewal
        rule3_points = 0
        rule3_exp = f"Renewal date is in {days_to_ren} days (outside critical 60-day window)."
        cited_ren_ids = [e.evidence_id for e in evidence if "renewal" in e.signal_id.lower() or "contract" in e.signal_id.lower()]

        if days_to_ren <= 30:
            rule3_points = 20
            rule3_exp = f"Immediate renewal window: Contract expires in {days_to_ren} days (<30d remaining)."
        elif days_to_ren <= 60:
            rule3_points = 20
            rule3_exp = f"Critical renewal window: Contract expires in {days_to_ren} days (<60d threshold)."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_RENEWAL_WINDOW",
            rule_name=cls.RULES["RULE_RENEWAL_WINDOW"]["name"],
            triggered=rule3_points > 0,
            points_contributed=rule3_points,
            max_points=cls.RULES["RULE_RENEWAL_WINDOW"]["max_points"],
            explanation=rule3_exp,
            evidence_ids=cited_ren_ids
        ))
        total_points += rule3_points

        # --- Rule 4: Severe Unresolved Support Issue (Critical ticket -> +20 pts; High ticket -> +10 pts) ---
        crit_tickets = [e for e in support_items if e.severity == "critical"]
        high_tickets = [e for e in support_items if e.severity == "high"]

        rule4_points = 0
        rule4_exp = "No open critical or high severity support escalations."
        cited_support_ids = [e.evidence_id for e in support_items if e.severity in ("critical", "high")]

        if crit_tickets:
            rule4_points = 20
            rule4_exp = f"{len(crit_tickets)} severe unresolved critical support ticket(s) causing workflow blocking."
        elif high_tickets:
            rule4_points = 10
            rule4_exp = f"{len(high_tickets)} unresolved high-severity support ticket(s) logged."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_CRITICAL_TICKET",
            rule_name=cls.RULES["RULE_CRITICAL_TICKET"]["name"],
            triggered=rule4_points > 0,
            points_contributed=rule4_points,
            max_points=cls.RULES["RULE_CRITICAL_TICKET"]["max_points"],
            explanation=rule4_exp,
            evidence_ids=cited_support_ids
        ))
        total_points += rule4_points

        # --- Rule 5: Confirmed Loss of Key Champion (+10 pts) ---
        rule5_points = 0
        rule5_exp = "No champion loss or executive turnover detected."
        cited_champ_ids = [e.evidence_id for e in champion_lost_items]

        if champion_lost_items:
            rule5_points = 10
            rule5_exp = f"Confirmed loss of key internal sponsor/champion ({champion_lost_items[0].title})."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_CHAMPION_LOST",
            rule_name=cls.RULES["RULE_CHAMPION_LOST"]["name"],
            triggered=rule5_points > 0,
            points_contributed=rule5_points,
            max_points=cls.RULES["RULE_CHAMPION_LOST"]["max_points"],
            explanation=rule5_exp,
            evidence_ids=cited_champ_ids
        ))
        total_points += rule5_points

        # --- Rule 6: Explicit Downgrade / Cancellation Intent (+25 pts) ---
        rule6_points = 0
        rule6_exp = "No explicit cancellation or downgrade request on record."
        cited_cancel_ids = [e.evidence_id for e in cancellation_items]

        if cancellation_items:
            rule6_points = 25
            rule6_exp = f"Explicit cancellation or license contraction request recorded: {cancellation_items[0].title}."

        evaluations.append(RuleEvaluation(
            rule_id="RULE_CANCELLATION_INTENT",
            rule_name=cls.RULES["RULE_CANCELLATION_INTENT"]["name"],
            triggered=rule6_points > 0,
            points_contributed=rule6_points,
            max_points=cls.RULES["RULE_CANCELLATION_INTENT"]["max_points"],
            explanation=rule6_exp,
            evidence_ids=cited_cancel_ids
        ))
        total_points += rule6_points

        return evaluations, total_points

    @classmethod
    def _determine_risk_level(cls, score: int) -> RiskLevel:
        """
        Maps numerical score to deterministic RiskLevel.
        """
        if score >= 70:
            return RiskLevel.CRITICAL
        elif score >= 50:
            return RiskLevel.HIGH
        elif score >= 25:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    @classmethod
    def _evaluate_urgency(
        cls,
        account: AccountContext,
        evidence: List[EvidenceItem]
    ) -> UrgencyAssessment:
        """
        Calculates urgency independently of ARR and risk score.
        Driven strictly by temporal expiry, severe blockers, or active cancellation requests.
        """
        days_to_ren = account.days_to_renewal
        urgency_drivers: List[str] = []

        # Check for urgent signals
        has_cancellation = any(
            "cancel" in e.signal_id.lower() or "downgrade" in e.signal_id.lower()
            for e in evidence
        )
        has_critical_ticket = any(
            e.source_category == "support" and e.severity == "critical"
            for e in evidence
        )
        days_silence = account.customer_metrics.days_since_touchpoint if account.customer_metrics else 0

        # Assess urgency level
        if days_to_ren <= 30:
            level = "immediate"
            label = f"Immediate (<{days_to_ren}d to renewal)"
            urgency_drivers.append(f"Contract expires in {days_to_ren} days")
        elif has_cancellation:
            level = "immediate"
            label = "Immediate (cancellation intent expressed)"
            urgency_drivers.append("Active customer downgrade or cancellation signal")
        elif has_critical_ticket and days_to_ren <= 60:
            level = "immediate"
            label = "Immediate (critical blocker near renewal)"
            urgency_drivers.append("Critical support blocker with renewal within 60 days")
        elif days_to_ren <= 60:
            level = "high"
            label = f"High ({days_to_ren}d to renewal)"
            urgency_drivers.append(f"Upcoming renewal in {days_to_ren} days (<60d window)")
        elif days_silence >= 25:
            level = "high"
            label = f"High ({days_silence}d silence)"
            urgency_drivers.append(f"Customer has not engaged with CSM for {days_silence} days")
        elif days_to_ren <= 90:
            level = "moderate"
            label = f"Moderate ({days_to_ren}d to renewal)"
            urgency_drivers.append(f"Quarterly renewal in {days_to_ren} days")
        else:
            level = "low"
            label = "Low (stable renewal runway)"
            urgency_drivers.append(f"Renewal runway exceeds 90 days ({days_to_ren} days remaining)")

        return UrgencyAssessment(
            urgency_level=level,
            days_to_renewal=days_to_ren,
            urgency_label=label,
            urgency_drivers=urgency_drivers
        )

    @classmethod
    def _evaluate_trends(
        cls,
        account: AccountContext,
        evidence: List[EvidenceItem]
    ) -> TrendSummary:
        """
        Determines directional trends for product usage, engagement, and support.
        """
        # Usage trend
        drop_pct = 0.0
        if account.customer_metrics:
            drop_pct = account.customer_metrics.usage_drop_pct
        for e in evidence:
            if e.source_category == "usage" and e.metadata.get("drop_pct"):
                drop_pct = max(drop_pct, float(e.metadata["drop_pct"]))

        if drop_pct >= 20.0:
            usage_trend = "contracting"
        elif drop_pct <= 0.0 and any("growth" in e.signal_id.lower() for e in evidence):
            usage_trend = "growing"
        else:
            usage_trend = "stable"

        # Engagement trend
        days_silence = account.customer_metrics.days_since_touchpoint if account.customer_metrics else 0
        if days_silence >= 25:
            engagement_trend = "disengaged"
        elif days_silence >= 14:
            engagement_trend = "lagging"
        else:
            engagement_trend = "healthy"

        # Support trend
        crit_tickets_count = sum(1 for e in evidence if e.source_category == "support" and e.severity in ("critical", "high"))
        if crit_tickets_count >= 2:
            support_trend = "escalated"
        elif crit_tickets_count == 1:
            support_trend = "active"
        else:
            support_trend = "clear"

        # Overall momentum
        negative_signals = (usage_trend == "contracting") + (engagement_trend == "disengaged") + (support_trend == "escalated")
        if negative_signals >= 2:
            momentum = "negative"
        elif negative_signals == 1:
            momentum = "neutral"
        else:
            momentum = "positive"

        return TrendSummary(
            usage_trend=usage_trend,
            usage_change_pct=-round(drop_pct, 1) if drop_pct > 0 else 0.0,
            engagement_trend=engagement_trend,
            days_since_touchpoint=days_silence,
            support_trend=support_trend,
            critical_tickets_count=crit_tickets_count,
            overall_momentum=momentum
        )

    @classmethod
    def _synthesize_risk_drivers(
        cls,
        account: AccountContext,
        rules: List[RuleEvaluation],
        trends: TrendSummary,
        urgency: UrgencyAssessment
    ) -> Tuple[str, str, List[str]]:
        """
        Derives primary reason code, main warning, and contributing factors from triggered rules.
        """
        triggered = [r for r in rules if r.triggered]
        # Sort by points contributed descending
        triggered.sort(key=lambda r: r.points_contributed, reverse=True)

        contributing_factors = [r.explanation for r in triggered]

        if not triggered:
            return "healthy_account", "Account metrics are stable with no active risk triggers.", ["Healthy customer engagement and steady usage."]

        top_rule = triggered[0]

        # Map to primary reason codes
        reason_map = {
            "RULE_CANCELLATION_INTENT": "cancellation_requested",
            "RULE_USAGE_DECLINE": "usage_declining_near_renewal" if account.days_to_renewal <= 60 else "severe_usage_drop",
            "RULE_TOUCHPOINT_SILENCE": "stakeholder_disengagement",
            "RULE_RENEWAL_WINDOW": "renewal_imminent_unprepared",
            "RULE_CRITICAL_TICKET": "critical_support_escalation",
            "RULE_CHAMPION_LOST": "executive_sponsor_turnover",
        }
        primary_reason = reason_map.get(top_rule.rule_id, "multi_factor_risk")

        main_warning = f"{top_rule.rule_name}: {top_rule.explanation}"

        return primary_reason, main_warning, contributing_factors


# Default singleton instance
deterministic_engine = DeterministicIntelligenceEngine()
