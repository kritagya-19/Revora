"""
Agent 2 — Risk Assessment (Risk Explanation)
Goal: Explains how serious the warning is.

Input: Verified signals (InvestigationContext) and deterministic rule results (DeterministicRiskResult).
Work: Explain which rules contributed to the score, identify urgency drivers, and note which data is missing or stale.
Implementation: The score and urgency are calculated in Python.
                An LLM can explain the results in plain language but CANNOT change the authoritative values.
Output: Risk score, urgency, contributing rules, and limitations (RiskExplanationOutput).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.ai.schemas import (
    DeterministicRiskResult,
    InvestigationContext,
    RiskExplanationOutput,
)
from app.core.config import settings

logger = logging.getLogger("revora.ai.agent2_risk_explanation")


class Agent2RiskExplanation:
    """
    Specialized Module 2: Translates mathematical scoring and rule breakdowns
    into plain-language executive narratives while protecting authoritative numerical scores.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

    def explain(
        self,
        context: InvestigationContext,
        deterministic_risk: DeterministicRiskResult
    ) -> RiskExplanationOutput:
        """
        Generates structured plain-language explanations of risk severity, urgency, and limitations.
        CRITICAL: Never alters the authoritative risk score, level, or urgency.
        """
        account = context.account
        score = deterministic_risk.risk_score
        level = deterministic_risk.risk_level
        urgency_level = deterministic_risk.urgency.urgency_level

        # 1. Rule contribution explanations
        contributing_rules_narrative = []
        for rule in deterministic_risk.rule_breakdown:
            if rule.triggered:
                evidence_citation = f" (Evidence: {', '.join(rule.evidence_ids)})" if rule.evidence_ids else ""
                contributing_rules_narrative.append(
                    f"**+{rule.points_contributed} pts** [{rule.rule_name}]: {rule.explanation}{evidence_citation}"
                )

        if not contributing_rules_narrative:
            contributing_rules_narrative.append("No active risk rules triggered. Account operating within normal baselines.")

        # 2. Urgency drivers explanation
        urgency_drivers = deterministic_risk.urgency.urgency_drivers or [
            f"Renewal in {account.days_to_renewal} days"
        ]

        # 3. Data limitations & stale data
        limitations = []
        for gap in context.data_gaps:
            limitations.append(f"Missing {gap.category.upper()}: {gap.description} (Impact: {gap.impact})")
        if not limitations:
            limitations.append("Full telemetry available across product, CRM, and support channels.")

        # 4. Plain-language synthesis narrative
        narrative = self._generate_narrative(account, deterministic_risk, contributing_rules_narrative, urgency_drivers)

        # 5. Optional LLM plain language enhancement (authoritative numbers remain locked)
        if self.api_key and self.api_key.strip():
            narrative = self._enhance_narrative_with_llm(
                account, deterministic_risk, narrative
            )

        return RiskExplanationOutput(
            account_id=account.account_id,
            authoritative_risk_score=score,
            authoritative_risk_level=level,
            authoritative_urgency=urgency_level,
            narrative_explanation=narrative,
            contributing_rule_explanations=contributing_rules_narrative,
            urgency_drivers_explanation=urgency_drivers,
            data_limitations_and_blindspots=limitations,
            explained_at=datetime.now(timezone.utc).isoformat()
        )

    def _generate_narrative(
        self,
        account,
        deterministic_risk: DeterministicRiskResult,
        rules_narrative: List[str],
        urgency_drivers: List[str]
    ) -> str:
        """
        Constructs deterministic executive explanation preserving exact authoritative values.
        """
        score = deterministic_risk.risk_score
        level_str = deterministic_risk.risk_level.value.upper()
        urgency_str = deterministic_risk.urgency.urgency_level.upper()

        text = (
            f"The account '{account.name}' has been assigned an authoritative Risk Score of {score}/100 "
            f"({level_str} severity) with {urgency_str} urgency. "
            f"The primary warning driver is '{deterministic_risk.main_warning}'. "
            f"Contract renewal is due on {account.renewal_date} ({account.days_to_renewal} days remaining) with ${account.arr:,.0f} ARR at stake. "
            f"Key risk contributors include: {'; '.join(deterministic_risk.contributing_factors[:2])}. "
            f"Urgency is governed by: {', '.join(urgency_drivers)}."
        )
        return text

    def _enhance_narrative_with_llm(
        self,
        account,
        deterministic_risk: DeterministicRiskResult,
        base_narrative: str
    ) -> str:
        """
        Optional: Uses Gemini to craft a polished executive briefing paragraph.
        Prompt explicitly enforces that authoritative numbers cannot be changed.
        """
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            prompt = f"""
You are Agent 2 (Risk Assessment & Explanation) for Revora.
Explain to a Customer Success Manager how serious this warning is.
MANDATORY CONSTRAINTS:
- You CANNOT change the Risk Score ({deterministic_risk.risk_score}/100) or Risk Level ({deterministic_risk.risk_level.value}).
- You CANNOT change the Urgency ({deterministic_risk.urgency.urgency_level}).
- Cite the contributing factors: {deterministic_risk.contributing_factors}.
- Write a concise 2-3 sentence executive briefing explaining the seriousness of the warning.

Base narrative:
{base_narrative}

Return plain text:
"""
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            if response.text and len(response.text.strip()) > 30:
                # Ensure the authoritative score appears in the narrative
                enhanced = response.text.strip()
                if str(deterministic_risk.risk_score) in enhanced:
                    return enhanced
        except Exception as e:
            logger.debug(f"LLM risk explanation enhancement skipped: {e}")

        return base_narrative
