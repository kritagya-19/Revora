from typing import Dict, Any, List
from datetime import datetime

class DeterministicRiskEngine:
    """
    Authority on calculating account risk scores, risk levels, and urgency.
    Strictly deterministic and reproducible. LLMs MUST NEVER modify or calculate these scores.
    """
    RULE_VERSION = "v1.0.0"

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

        # 1. Renewal proximity
        if days_to_renewal <= 30:
            score += 35
            factors.append(f"Critical renewal window: {days_to_renewal} days remaining")
            primary_reason = "renewal_imminent"
        elif days_to_renewal <= 60:
            score += 20
            factors.append(f"Upcoming renewal in {days_to_renewal} days")
            primary_reason = "renewal_approaching"
        elif days_to_renewal <= 90:
            score += 10
            factors.append(f"Quarterly renewal window: {days_to_renewal} days")

        # 2. Product usage trajectory
        if usage_drop_pct >= 40.0:
            score += 30
            factors.append(f"Severe drop in weekly active licenses: -{usage_drop_pct:.1f}%")
            if score >= 35:
                primary_reason = "usage_declining_near_renewal"
        elif usage_drop_pct >= 20.0:
            score += 15
            factors.append(f"Moderate usage decline: -{usage_drop_pct:.1f}%")

        # 3. Touchpoint recency
        if days_since_last_touchpoint >= 45:
            score += 25
            factors.append(f"Customer disengagement: No CSM touchpoint in {days_since_last_touchpoint} days")
            if primary_reason == "healthy_account":
                primary_reason = "no_recent_touchpoint"
        elif days_since_last_touchpoint >= 25:
            score += 10
            factors.append(f"Touchpoint lag: {days_since_last_touchpoint} days since last interaction")

        # 4. Open critical support issues
        if open_critical_tickets > 0:
            score += min(open_critical_tickets * 10, 20)
            factors.append(f"{open_critical_tickets} unresolved high-priority support ticket(s)")

        # Cap score at 100
        score = min(max(score, 0), 100)

        # Categorize level
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
            "evaluated_at": datetime.utcnow().isoformat()
        }
