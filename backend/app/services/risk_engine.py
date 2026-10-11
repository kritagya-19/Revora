from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger("revora.risk_engine")


class DeterministicRiskEngine:
    """
    Authority on calculating transparent, deterministic account risk scores,
    classifications (healthy, needing_attention, high_risk), and compound multi-signal rules.
    Strictly deterministic and reproducible. LLMs MUST NEVER calculate or alter these scores.

    Fulfills Member 2 Task B specification:
    1. Transparent point scores calculated using defined rules.
    2. Classifies accounts as healthy (<25), needing attention (25-49), or high risk (>=50).
    3. Combines multiple signals instead of evaluating each in isolation (compound multi-signal rules).
    4. Triggers deeper investigation when configured risk criteria are met.
    5. Does not display a precise churn probability unless supported by validated historical data.
    """
    RULE_VERSION = "v2.1.0"
    TRIGGER_THRESHOLD_SCORE = 50

    @classmethod
    def evaluate(
        cls,
        days_to_renewal: int,
        usage_drop_pct: float,
        days_since_last_touchpoint: int,
        open_critical_tickets: int,
        arr: float,
        evidence_ids: Optional[List[str]] = None,
        account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates risk score deterministically using defined isolated rules
        and synergistic compound multi-signal rules.
        """
        score = 0
        factors = []
        rule_breakdown: List[Dict[str, Any]] = []
        compound_rules_triggered: List[str] = []
        primary_reason = "healthy_account"
        all_eids = evidence_ids or []

        # =====================================================================
        # 1. Base Isolated Rules
        # =====================================================================

        # --- RULE_USAGE_DECLINE: Product Usage Decline (>30% -> +25 pts; 15-30% -> +12 pts) ---
        usage_pts = 0
        if usage_drop_pct >= 30.0:
            usage_pts = 25
            score += 25
            factors.append(f"Severe usage decline of -{usage_drop_pct:.1f}% exceeds the 30% contraction threshold.")
            primary_reason = "severe_usage_drop"
        elif usage_drop_pct >= 15.0:
            usage_pts = 12
            score += 12
            factors.append(f"Moderate usage decline of -{usage_drop_pct:.1f}% detected.")

        rule_breakdown.append({
            "rule_id": "RULE_USAGE_DECLINE",
            "name": "Product Usage Decline",
            "points_contributed": usage_pts,
            "max_points": 25,
            "threshold_applied": f"-{usage_drop_pct:.1f}% contraction",
            "is_compound_rule": False,
            "evidence_description": f"Active user activity down -{usage_drop_pct:.1f}%",
            "evidence_ids": [eid for eid in all_eids if "usage" in eid.lower()]
        })

        # --- RULE_TOUCHPOINT_SILENCE: Communication Silence (14+ Days -> +15 pts) ---
        touch_pts = 0
        if days_since_last_touchpoint >= 14:
            touch_pts = 15
            score += 15
            factors.append(f"Customer disengagement: {days_since_last_touchpoint} days without recorded CSM touchpoint (threshold: 14d).")
            if primary_reason == "healthy_account":
                primary_reason = "stakeholder_disengagement"

        rule_breakdown.append({
            "rule_id": "RULE_TOUCHPOINT_SILENCE",
            "name": "Communication & Touchpoint Silence",
            "points_contributed": touch_pts,
            "max_points": 15,
            "threshold_applied": f"{days_since_last_touchpoint}d silence (>=14d threshold)",
            "is_compound_rule": False,
            "evidence_description": f"No CSM meetings or verified touchpoints logged for {days_since_last_touchpoint} days",
            "evidence_ids": [eid for eid in all_eids if any(k in eid.lower() for k in ("touch", "crm", "email", "cal"))]
        })

        # --- RULE_RENEWAL_WINDOW: Upcoming Renewal Window (<60 Days -> +20 pts) ---
        ren_pts = 0
        if days_to_renewal <= 30:
            ren_pts = 20
            score += 20
            factors.append(f"Immediate renewal window: Contract expires in {days_to_renewal} days (<30d remaining).")
            if primary_reason in ("severe_usage_drop",):
                primary_reason = "usage_declining_near_renewal"
            elif primary_reason == "healthy_account":
                primary_reason = "renewal_imminent_unprepared"
        elif days_to_renewal <= 60:
            ren_pts = 20
            score += 20
            factors.append(f"Critical renewal window: Contract expires in {days_to_renewal} days (<60d threshold).")
            if primary_reason in ("severe_usage_drop",):
                primary_reason = "usage_declining_near_renewal"
            elif primary_reason == "healthy_account":
                primary_reason = "renewal_imminent_unprepared"

        rule_breakdown.append({
            "rule_id": "RULE_RENEWAL_WINDOW",
            "name": "Upcoming Renewal Window",
            "points_contributed": ren_pts,
            "max_points": 20,
            "threshold_applied": f"{days_to_renewal}d to renewal (<=60d threshold)",
            "is_compound_rule": False,
            "evidence_description": f"Contract renewal due in {days_to_renewal} days",
            "evidence_ids": [eid for eid in all_eids if any(k in eid.lower() for k in ("deal", "contract", "renewal"))]
        })

        # --- RULE_CRITICAL_TICKET: Severe Unresolved Support Issue (Critical -> +20 pts) ---
        ticket_pts = 0
        if open_critical_tickets > 0:
            ticket_pts = 20
            score += 20
            factors.append(f"{open_critical_tickets} severe unresolved critical support ticket(s) causing workflow blocking.")
            if primary_reason == "healthy_account":
                primary_reason = "critical_support_escalation"

        rule_breakdown.append({
            "rule_id": "RULE_CRITICAL_TICKET",
            "name": "Unresolved Critical Support Tickets",
            "points_contributed": ticket_pts,
            "max_points": 20,
            "threshold_applied": f"{open_critical_tickets} open critical ticket(s)",
            "is_compound_rule": False,
            "evidence_description": f"{open_critical_tickets} critical blockers open in ticketing system",
            "evidence_ids": [eid for eid in all_eids if "support" in eid.lower() or "ticket" in eid.lower()]
        })

        # =====================================================================
        # 2. Compound Multi-Signal Rules (Task B requirement: combine multiple signals)
        # =====================================================================

        # Compound Rule A: Silent Contraction (Usage Drop + Touchpoint Silence)
        if usage_drop_pct >= 15.0 and days_since_last_touchpoint >= 14:
            compound_pts = 10
            score += compound_pts
            compound_rules_triggered.append("COMPOUND_SILENT_CONTRACTION")
            factors.append(
                f"Multi-Signal Compound Risk: Usage contraction (-{usage_drop_pct:.1f}%) combined with {days_since_last_touchpoint}d silence indicates silent abandonment."
            )
            rule_breakdown.append({
                "rule_id": "COMPOUND_SILENT_CONTRACTION",
                "name": "Silent Contraction (Usage Drop + Touchpoint Silence)",
                "points_contributed": compound_pts,
                "max_points": 10,
                "threshold_applied": f"Drop >= 15% ({usage_drop_pct:.1f}%) AND Silence >= 14d ({days_since_last_touchpoint}d)",
                "is_compound_rule": True,
                "evidence_description": "Cross-channel disengagement: usage falling while customer communication is silent",
                "evidence_ids": [eid for eid in all_eids if any(k in eid.lower() for k in ("usage", "touch", "crm"))]
            })

        # Compound Rule B: At-Risk Renewal (Imminent Renewal + Unresolved Critical Ticket)
        if days_to_renewal <= 60 and open_critical_tickets > 0:
            compound_pts = 15
            score += compound_pts
            compound_rules_triggered.append("COMPOUND_AT_RISK_RENEWAL")
            factors.append(
                f"Multi-Signal Compound Risk: Critical support blockers ({open_critical_tickets}) directly threatening upcoming contract renewal ({days_to_renewal}d remaining)."
            )
            rule_breakdown.append({
                "rule_id": "COMPOUND_AT_RISK_RENEWAL",
                "name": "At-Risk Renewal (Upcoming Renewal + Critical Blocker)",
                "points_contributed": compound_pts,
                "max_points": 15,
                "threshold_applied": f"Renewal <= 60d ({days_to_renewal}d) AND Critical Tickets > 0 ({open_critical_tickets})",
                "is_compound_rule": True,
                "evidence_description": "Production blockers directly impact decision-maker willingness to renew contract",
                "evidence_ids": [eid for eid in all_eids if any(k in eid.lower() for k in ("support", "deal", "renewal"))]
            })

        # Compound Rule C: Renewal Contraction (Imminent Renewal + Severe Usage Drop)
        if days_to_renewal <= 60 and usage_drop_pct >= 25.0:
            compound_pts = 15
            score += compound_pts
            compound_rules_triggered.append("COMPOUND_RENEWAL_CONTRACTION")
            factors.append(
                f"Multi-Signal Compound Risk: Significant usage contraction (-{usage_drop_pct:.1f}%) within the {days_to_renewal}d renewal window points to active churn preparation."
            )
            rule_breakdown.append({
                "rule_id": "COMPOUND_RENEWAL_CONTRACTION",
                "name": "Renewal Contraction (Upcoming Renewal + Usage Drop)",
                "points_contributed": compound_pts,
                "max_points": 15,
                "threshold_applied": f"Renewal <= 60d ({days_to_renewal}d) AND Usage Drop >= 25% (-{usage_drop_pct:.1f}%)",
                "is_compound_rule": True,
                "evidence_description": "Customer contracting license consumption ahead of renewal expiration",
                "evidence_ids": [eid for eid in all_eids if any(k in eid.lower() for k in ("usage", "deal", "renewal"))]
            })

        # =====================================================================
        # 3. Score Clamping & Tier Classification
        # =====================================================================
        score = min(max(score, 0), 100)

        # Explicit Classification required by Task B: healthy, needing_attention, high_risk
        if score >= 50:
            classification = "high_risk"
        elif score >= 25:
            classification = "needing_attention"
        else:
            classification = "healthy"

        # Legacy risk_level (for backwards compatibility with existing UI & tests)
        if score >= 70:
            risk_level = "critical"
        elif score >= 50:
            risk_level = "high"
        elif score >= 25:
            risk_level = "medium"
        else:
            risk_level = "low"

        # =====================================================================
        # 4. Deeper Investigation Triggering (Task B requirement)
        # =====================================================================
        trigger_criteria_met = (
            score >= cls.TRIGGER_THRESHOLD_SCORE
            or len(compound_rules_triggered) > 0
            or (open_critical_tickets > 0 and days_to_renewal <= 60)
        )

        investigation_trigger_reason = None
        if trigger_criteria_met:
            trigger_reasons = []
            if score >= cls.TRIGGER_THRESHOLD_SCORE:
                trigger_reasons.append(f"Risk score ({score} pts) exceeds threshold ({cls.TRIGGER_THRESHOLD_SCORE} pts)")
            if compound_rules_triggered:
                trigger_reasons.append(f"Triggered compound rules: {', '.join(compound_rules_triggered)}")
            if open_critical_tickets > 0 and days_to_renewal <= 60:
                trigger_reasons.append(f"{open_critical_tickets} critical blockers within {days_to_renewal}d renewal window")
            investigation_trigger_reason = " | ".join(trigger_reasons)

        # =====================================================================
        # 5. Output Construction with Explicit Churn Probability Disclaimers
        # =====================================================================
        return {
            "risk_score": score,
            "classification": classification,
            "risk_level": risk_level,
            "primary_reason_code": primary_reason,
            "contributing_factors": factors,
            "rule_breakdown": rule_breakdown,
            "compound_rules_triggered": compound_rules_triggered,
            "investigation_triggered": trigger_criteria_met,
            "investigation_trigger_reason": investigation_trigger_reason,
            "churn_probability": None,  # EXPLICIT: Do not display precise churn probability
            "display_churn_probability": False,
            "churn_probability_disclaimer": (
                "SignalBridge AI strictly avoids presenting speculative churn percentage probabilities without validated statistical modeling. "
                "CSM prioritization is guided by transparent, reproducible deterministic risk rules."
            ),
            "statistical_confidence": "high" if len(all_eids) >= 4 else "medium",
            "rule_version": cls.RULE_VERSION,
            "evaluated_at": datetime.now(timezone.utc).isoformat()
        }

    @classmethod
    def evaluate_account(
        cls,
        account_id: str,
        auto_trigger_investigation: bool = True
    ) -> Dict[str, Any]:
        """
        Gathers ground-truth account telemetry, evaluates transparent risk scoring,
        and automatically stages a deep AI investigation if criteria are met.
        """
        from app.services.account_repository import account_repo

        account = account_repo.get_account_by_id(account_id)
        if not account:
            raise ValueError(f"Account with ID '{account_id}' not found.")

        signals = account_repo.get_account_signals(account_id)
        evidence_ids = [s.id for s in signals]

        metrics = account.customer_metrics
        drop_pct = float(metrics.usage_drop_pct) if metrics else 0.0
        days_touch = metrics.days_since_touchpoint if metrics else 15
        crit_tickets = metrics.critical_tickets if metrics else 0
        days_ren = account.urgency_days_to_renewal or 60

        # Evaluate rules and compound combinations
        eval_res = cls.evaluate(
            days_to_renewal=days_ren,
            usage_drop_pct=drop_pct,
            days_since_last_touchpoint=days_touch,
            open_critical_tickets=crit_tickets,
            arr=float(account.arr),
            evidence_ids=evidence_ids,
            account_id=account.id
        )

        eval_res["account_id"] = account.id
        eval_res["account_name"] = account.name
        eval_res["arr"] = account.arr
        eval_res["renewal_date"] = account.renewal_date
        eval_res["main_warning"] = account.main_warning or eval_res["primary_reason_code"]
        eval_res["signals_count"] = len(signals)

        # Auto-trigger deep investigation when criteria met
        investigation_id = None
        if eval_res["investigation_triggered"] and auto_trigger_investigation:
            try:
                from app.services.investigation_repository import investigation_repo
                existing = investigation_repo.get_latest_for_account(account_id)
                if not existing:
                    logger.info(f"Auto-triggering deep AI investigation for account '{account_id}' (Reason: {eval_res['investigation_trigger_reason']})")
                    inv = investigation_repo.create_or_run_investigation(account_id)
                    investigation_id = inv.id
                else:
                    investigation_id = existing.id
            except Exception as e:
                logger.warning(f"Auto-triggering investigation failed for {account_id}: {e}")

        eval_res["investigation_id"] = investigation_id
        return eval_res


deterministic_risk_engine = DeterministicRiskEngine()
