from typing import Dict, Any, List
from datetime import datetime, timezone

class DeterministicRiskEngine:
    """
    Authority on calculating account risk scores, risk levels, and urgency.
    Strictly deterministic and reproducible. LLMs MUST NEVER modify or calculate these scores.

    Unified with AI Layer deterministic.py v2.0.0 thresholds to ensure
    Revenue Radar and Autopsy produce identical risk scores.
    """
    RULE_VERSION = "v2.0.0"

    @classmethod
    def evaluate(
        cls,
        days_to_renewal: int,
        usage_drop_pct: float,
        days_since_last_touchpoint: int,
        open_critical_tickets: int,
        arr: float
    ) -> Dict[str, Any]:
        score = 0
        factors = []
        primary_reason = "healthy_account"

        # --- RULE_USAGE_DECLINE: Product Usage Decline (>30% -> +25 pts; 15-30% -> +12 pts) ---
        if usage_drop_pct >= 30.0:
            score += 25
            factors.append(f"Severe usage decline of -{usage_drop_pct:.1f}% exceeds the 30% contraction threshold.")
            primary_reason = "severe_usage_drop"
        elif usage_drop_pct >= 15.0:
            score += 12
            factors.append(f"Moderate usage decline of -{usage_drop_pct:.1f}% detected.")

        # --- RULE_TOUCHPOINT_SILENCE: Communication Silence (14+ Days -> +15 pts) ---
        if days_since_last_touchpoint >= 14:
            score += 15
            factors.append(f"Customer disengagement: {days_since_last_touchpoint} days without recorded CSM touchpoint (threshold: 14d).")
            if primary_reason == "healthy_account":
                primary_reason = "stakeholder_disengagement"

        # --- RULE_RENEWAL_WINDOW: Upcoming Renewal Window (<60 Days -> +20 pts) ---
        if days_to_renewal <= 30:
            score += 20
            factors.append(f"Immediate renewal window: Contract expires in {days_to_renewal} days (<30d remaining).")
            if primary_reason in ("severe_usage_drop",):
                primary_reason = "usage_declining_near_renewal"
            elif primary_reason == "healthy_account":
                primary_reason = "renewal_imminent_unprepared"
        elif days_to_renewal <= 60:
            score += 20
            factors.append(f"Critical renewal window: Contract expires in {days_to_renewal} days (<60d threshold).")
            if primary_reason in ("severe_usage_drop",):
                primary_reason = "usage_declining_near_renewal"
            elif primary_reason == "healthy_account":
                primary_reason = "renewal_imminent_unprepared"

        # --- RULE_CRITICAL_TICKET: Severe Unresolved Support Issue (Critical -> +20 pts) ---
        if open_critical_tickets > 0:
            score += 20
            factors.append(f"{open_critical_tickets} severe unresolved critical support ticket(s) causing workflow blocking.")
            if primary_reason == "healthy_account":
                primary_reason = "critical_support_escalation"

        # Cap score at 100
        score = min(max(score, 0), 100)

        # Categorize level (identical to v2.0.0 thresholds)
        if score >= 70:
            risk_level = "critical"
        elif score >= 50:
            risk_level = "high"
        elif score >= 25:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "risk_score": score,
            "risk_level": risk_level,
            "primary_reason_code": primary_reason,
            "contributing_factors": factors,
            "rule_version": cls.RULE_VERSION,
            "evaluated_at": datetime.now(timezone.utc).isoformat()
        }
