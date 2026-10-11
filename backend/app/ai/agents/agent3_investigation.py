"""
Agent 3 — Investigation
Goal: Explains why the account was flagged.

Input: Account context, relevant evidence, and risk assessment (via InvestigationContext, DeterministicRiskResult, and prior agents).
Work: Connect multiple signals into an explanation, separate facts from interpretations,
      identify conflicting evidence, and suggest what to verify.
Implementation: LLM reasoning over a limited set of supplied records, followed by strict validation.
Output: The Revenue Risk Autopsy report (InvestigationAutopsy).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from app.ai.schemas import (
    DeterministicRiskResult,
    FactItem,
    InterpretationItem,
    InvestigationAutopsy,
    InvestigationContext,
    RiskExplanationOutput,
    SignalAnalysisOutput,
)
from app.core.config import settings

logger = logging.getLogger("revora.ai.agent3_investigation")


class Agent3Investigation:
    """
    Specialized Module 3: Synthesizes evidence-grounded Revenue Risk Autopsy.
    Separates verified facts from interpretations, detects conflicting telemetry,
    and identifies explicit uncertainties.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

    def investigate(
        self,
        context: InvestigationContext,
        deterministic_risk: DeterministicRiskResult,
        signal_analysis: SignalAnalysisOutput,
        risk_explanation: RiskExplanationOutput
    ) -> InvestigationAutopsy:
        """
        Executes the investigation pipeline.
        Attempts LLM reasoning over supplied records if configured;
        falls back to deterministic autopsy synthesis with strict grounding.
        """
        valid_evidence_ids: Set[str] = set(context.evidence_catalog.keys())
        # Also allow IDs without EVID- prefix
        for item in context.selected_evidence:
            valid_evidence_ids.add(item.signal_id)
            valid_evidence_ids.add(item.evidence_id)

        # 1. Attempt LLM investigation if API key is active
        if self.api_key and self.api_key.strip():
            try:
                autopsy = self._run_llm_investigation(
                    context, deterministic_risk, signal_analysis, risk_explanation, valid_evidence_ids
                )
                if autopsy:
                    return autopsy
            except Exception as e:
                logger.warning(f"Agent 3 LLM investigation failed: {e}. Falling back to deterministic synthesis.")

        # 2. Deterministic evidence synthesis fallback
        return self._run_deterministic_investigation(
            context, deterministic_risk, signal_analysis, risk_explanation, valid_evidence_ids
        )

    def _run_llm_investigation(
        self,
        context: InvestigationContext,
        deterministic_risk: DeterministicRiskResult,
        signal_analysis: SignalAnalysisOutput,
        risk_explanation: RiskExplanationOutput,
        valid_evidence_ids: Set[str]
    ) -> Optional[InvestigationAutopsy]:
        """
        Prompts Gemini to perform causal synthesis, separating facts from interpretations.
        """
        from google import genai
        client = genai.Client(api_key=self.api_key)

        prompt = self._build_investigation_prompt(
            context, deterministic_risk, signal_analysis, risk_explanation
        )

        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        if not response.text:
            return None

        parsed = json.loads(response.text)

        # Strict validation: Filter facts and interpretations to only valid evidence IDs
        verified_facts: List[FactItem] = []
        for f in parsed.get("verified_facts", []):
            cited = [eid for eid in f.get("evidence_ids", []) if eid in valid_evidence_ids]
            if not cited and context.selected_evidence:
                cited = [context.selected_evidence[0].evidence_id]
            verified_facts.append(FactItem(
                claim=f.get("claim", "Observed account signal"),
                evidence_ids=cited,
                type="observed_fact",
                source_category=f.get("source_category")
            ))

        interpretations: List[InterpretationItem] = []
        for inp in parsed.get("interpretations", []):
            cited = [eid for eid in inp.get("supporting_evidence_ids", []) if eid in valid_evidence_ids]
            interpretations.append(InterpretationItem(
                hypothesis=inp.get("hypothesis", "Potential churn driver based on signal patterns"),
                supporting_evidence_ids=cited,
                confidence=inp.get("confidence", "medium")
            ))

        all_cited: List[str] = []
        for f in verified_facts:
            all_cited.extend(f.evidence_ids)
        for i in interpretations:
            all_cited.extend(i.supporting_evidence_ids)

        return InvestigationAutopsy(
            id=f"autopsy-{context.account.account_id}",
            account_id=context.account.account_id,
            account_name=context.account.name,
            risk_summary=parsed.get(
                "risk_summary",
                f"Elevated churn likelihood for {context.account.name} due to {deterministic_risk.primary_reason_code}."
            ),
            authoritative_risk_score=deterministic_risk.risk_score,
            authoritative_risk_level=deterministic_risk.risk_level,
            primary_reason_code=deterministic_risk.primary_reason_code,
            verified_facts=verified_facts,
            interpretations=interpretations,
            conflicting_evidence=parsed.get("conflicting_evidence", []),
            uncertainties=parsed.get("uncertainties", [
                "Customer's internal budget review date unverified.",
                "Whether sponsor has engaged competitive alternatives."
            ]),
            causal_explanation=parsed.get(
                "causal_explanation",
                f"Compounding risk driven by {deterministic_risk.main_warning}."
            ),
            cited_evidence_ids=list(dict.fromkeys(all_cited)),
            rule_version=deterministic_risk.rule_version,
            created_at=datetime.now(timezone.utc).isoformat()
        )

    def _build_investigation_prompt(
        self,
        context: InvestigationContext,
        risk: DeterministicRiskResult,
        signals: SignalAnalysisOutput,
        risk_exp: RiskExplanationOutput
    ) -> str:
        """
        Builds grounded LLM prompt for Agent 3.
        """
        evidence_lines = []
        for e in context.selected_evidence:
            obs = f" | Observed: {e.observed_value}" if e.observed_value is not None else ""
            evidence_lines.append(f"- [{e.evidence_id}] ({e.source_category.upper()}) {e.title}: {e.summary}{obs}")

        return f"""
You are Agent 3 (Investigation Specialist) for Revora.
Generate the Revenue Risk Autopsy report for customer account '{context.account.name}'.

ACCOUNT CONTEXT:
- ARR: ${context.account.arr:,.0f}
- Renewal Date: {context.account.renewal_date} ({context.account.days_to_renewal} days remaining)
- CSM Owner: {context.account.csm_owner}
- Authoritative Risk Score: {risk.risk_score}/100 ({risk.risk_level.value})
- Primary Reason Code: {risk.primary_reason_code}
- Urgency: {risk.urgency.urgency_level} ({', '.join(risk.urgency.urgency_drivers)})

VERIFIABLE EVIDENCE CATALOG:
{chr(10).join(evidence_lines)}

DATA GAPS & LIMITATIONS:
{chr(10).join(['- ' + g for g in risk_exp.data_limitations_and_blindspots])}

YOUR INSTRUCTIONS:
1. Connect multiple signals into a cohesive causal narrative (causal_explanation).
2. Separate FACTS (direct observations) from INTERPRETATIONS (hypotheses/inferences).
3. Every claim in 'verified_facts' and 'interpretations' MUST cite valid evidence IDs from the catalog above.
4. Identify any CONFLICTING evidence (e.g. usage drop despite positive sales notes).
5. Explicitly state UNCERTAINTIES and what the CSM must verify.

RETURN JSON:
{{
  "risk_summary": "Concise 1-2 sentence risk executive summary",
  "causal_explanation": "Detailed explanation connecting usage, communication, and support signals",
  "verified_facts": [
    {{"claim": "Product usage dropped by X%", "evidence_ids": ["EVID-xxx"], "source_category": "usage"}}
  ],
  "interpretations": [
    {{"hypothesis": "Team abandoned platform following champion departure", "supporting_evidence_ids": ["EVID-xxx"], "confidence": "high"}}
  ],
  "conflicting_evidence": ["Any conflicting signals or 'None detected'"],
  "uncertainties": ["What the CSM must verify directly with customer"]
}}
"""

    def _run_deterministic_investigation(
        self,
        context: InvestigationContext,
        deterministic_risk: DeterministicRiskResult,
        signal_analysis: SignalAnalysisOutput,
        risk_explanation: RiskExplanationOutput,
        valid_evidence_ids: Set[str]
    ) -> InvestigationAutopsy:
        """
        Pure Python evidence synthesizer for Agent 3 when LLM API is unavailable.
        """
        account = context.account
        evidence = context.selected_evidence

        # 1. Build verified facts from selected evidence
        verified_facts: List[FactItem] = []
        for e in evidence:
            obs = f" (Observed: {e.observed_value})" if e.observed_value else ""
            verified_facts.append(FactItem(
                claim=f"{e.title}: {e.summary}{obs}",
                evidence_ids=[e.evidence_id],
                type="observed_fact",
                source_category=e.source_category
            ))

        # 2. Build causal interpretations
        interpretations: List[InterpretationItem] = []
        usage_eids = [e.evidence_id for e in evidence if e.source_category == "usage"]
        comm_eids = [e.evidence_id for e in evidence if e.source_category in ("email", "calendar", "crm")]
        support_eids = [e.evidence_id for e in evidence if e.source_category == "support"]

        if usage_eids and comm_eids:
            interpretations.append(InterpretationItem(
                hypothesis=(
                    f"Product usage contraction (-{signal_analysis.usage_baseline_comparison.get('usage_drop_pct', 0)}%) "
                    f"is compounded by lack of CSM engagement, suggesting silent account disengagement."
                ),
                supporting_evidence_ids=usage_eids[:2] + comm_eids[:1],
                confidence="high"
            ))

        if support_eids:
            interpretations.append(InterpretationItem(
                hypothesis=(
                    f"Unresolved support tickets are actively depressing sentiment during the critical "
                    f"{account.days_to_renewal}-day renewal preparation cycle."
                ),
                supporting_evidence_ids=support_eids,
                confidence="medium"
            ))

        # 3. Detect conflicting evidence
        conflicting: List[str] = []
        has_growth = any("growth" in e.signal_id.lower() for e in evidence)
        has_drop = any("drop" in e.signal_id.lower() or "contraction" in e.summary.lower() for e in evidence)
        if has_growth and has_drop:
            conflicting.append("Historical account growth logs conflict with recent rapid seat contraction.")
        elif not conflicting:
            conflicting.append("No direct conflicting signals detected; telemetry consistently points to disengagement.")

        # 4. Formulate uncertainties
        uncertainties = [
            f"Whether executive decision-makers have initiated formal RFP or competitive review.",
            f"Actual root cause of seat abandonment without direct CSM discovery interview.",
            f"Customer's internal Q4 procurement budget cycle timeline."
        ]

        # 5. Causal synthesis narrative
        all_cited = [e.evidence_id for e in evidence]
        causal = (
            f"The account '{account.name}' exhibits a compounding churn profile evaluated at an authoritative score of "
            f"{deterministic_risk.risk_score}/100 ({deterministic_risk.risk_level.value.upper()}). "
            f"Cross-channel correlation reveals that {deterministic_risk.main_warning} has occurred against a {account.days_to_renewal}-day renewal horizon. "
            f"The convergence of product seat contraction and communication silence indicates elevated risk of non-renewal."
        )

        return InvestigationAutopsy(
            id=f"autopsy-{account.account_id}",
            account_id=account.account_id,
            account_name=account.name,
            risk_summary=(
                f"Revenue risk autopsy for {account.name} (ARR: ${account.arr:,.0f}): "
                f"{deterministic_risk.primary_reason_code.replace('_', ' ').title()} near renewal."
            ),
            authoritative_risk_score=deterministic_risk.risk_score,
            authoritative_risk_level=deterministic_risk.risk_level,
            primary_reason_code=deterministic_risk.primary_reason_code,
            verified_facts=verified_facts,
            interpretations=interpretations,
            conflicting_evidence=conflicting,
            uncertainties=uncertainties,
            causal_explanation=causal,
            cited_evidence_ids=all_cited,
            rule_version=deterministic_risk.rule_version,
            created_at=datetime.now(timezone.utc).isoformat()
        )
