"""
Stage 4: Output Validator for Revora AI Layer.
Enforces:
1. Output schema conformity (Pydantic model integrity, non-empty claims).
2. Evidence citation grounding (rejects hallucinated or fabricated evidence IDs).
3. Account ownership & multi-tenant boundary integrity (prevents cross-account data leakage).
4. Deterministic supremacy (protects authoritative risk scores and reason codes).
5. Human-in-the-loop guardrail (ensures proposals remain in proposed draft status).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from pydantic import ValidationError

from app.ai.schemas import (
    ActionPlanOutput,
    DeterministicRiskResult,
    InvestigationAutopsy,
    InvestigationContext,
    OrchestratedInvestigationResult,
    ValidationResult,
)

logger = logging.getLogger("revora.ai.validators")


class OutputValidator:
    """
    Stage 4: Output Validator.
    Independent validation barrier that checks and certifies all AI layer outputs
    before persistence or CSM presentation.
    """

    @classmethod
    def validate_orchestrated_result(
        cls,
        result: OrchestratedInvestigationResult
    ) -> ValidationResult:
        """
        Validates the complete OrchestratedInvestigationResult across all checks:
        1. Output Schema
        2. Evidence IDs Grounding
        3. Account Ownership
        4. Deterministic Supremacy
        5. Human-in-the-loop Guardrail
        """
        violations: List[str] = []
        warnings: List[str] = []
        target_account_id = result.account_id
        context = result.context

        # 1. Output Schema Validation
        schema_valid = True
        try:
            # Validate self-consistency of Pydantic models
            result.investigation.model_dump()
            result.action_plan.model_dump()
            result.signal_analysis.model_dump()
            result.risk_explanation.model_dump()

            if not result.investigation.risk_summary:
                schema_valid = False
                violations.append("Investigation Autopsy risk_summary is empty.")
            if not result.investigation.causal_explanation:
                schema_valid = False
                violations.append("Investigation Autopsy causal_explanation is empty.")
            if not result.investigation.verified_facts:
                warnings.append("Investigation Autopsy has zero verified facts.")
        except (ValidationError, Exception) as e:
            schema_valid = False
            violations.append(f"Output schema validation error: {e}")

        # 2. Account Ownership & Boundary Check
        ownership_valid = True
        ownership_violations: List[str] = []

        if result.context.account.account_id != target_account_id:
            ownership_valid = False
            err = f"Account mismatch: Context account_id '{result.context.account.account_id}' != '{target_account_id}'"
            ownership_violations.append(err)
            violations.append(err)

        if result.investigation.account_id != target_account_id:
            ownership_valid = False
            err = f"Cross-account leak: Autopsy account_id '{result.investigation.account_id}' != '{target_account_id}'"
            ownership_violations.append(err)
            violations.append(err)

        if result.action_plan.account_id != target_account_id:
            ownership_valid = False
            err = f"Cross-account leak: Action proposal account_id '{result.action_plan.account_id}' != '{target_account_id}'"
            ownership_violations.append(err)
            violations.append(err)

        if result.deterministic_risk.account_id != target_account_id:
            ownership_valid = False
            err = f"Cross-account leak: Deterministic risk account_id '{result.deterministic_risk.account_id}' != '{target_account_id}'"
            ownership_violations.append(err)
            violations.append(err)

        # Verify all evidence items in context strictly belong to target_account_id
        for ev in context.selected_evidence:
            if ev.account_id != target_account_id:
                ownership_valid = False
                err = f"Cross-account evidence contamination: Evidence '{ev.evidence_id}' belongs to account '{ev.account_id}', not '{target_account_id}'"
                ownership_violations.append(err)
                violations.append(err)

        # 3. Evidence ID Grounding (Anti-Hallucination Guardrail)
        valid_citations: List[str] = []
        hallucinated_citations: List[str] = []

        allowed_evidence_ids: Set[str] = set()
        for ev in context.selected_evidence:
            allowed_evidence_ids.add(ev.evidence_id)
            allowed_evidence_ids.add(ev.signal_id)
            # Add with and without EVID- prefix
            if ev.evidence_id.startswith("EVID-"):
                allowed_evidence_ids.add(ev.evidence_id.replace("EVID-", ""))
            else:
                allowed_evidence_ids.add(f"EVID-{ev.evidence_id}")

        # Collect citations from all parts of the result
        all_cited_ids: List[str] = []

        # From investigation autopsy
        for fact in result.investigation.verified_facts:
            all_cited_ids.extend(fact.evidence_ids)
        for interp in result.investigation.interpretations:
            all_cited_ids.extend(interp.supporting_evidence_ids)
        all_cited_ids.extend(result.investigation.cited_evidence_ids)

        # From action plan
        all_cited_ids.extend(result.action_plan.cited_evidence_ids)
        if result.action_plan.email_draft:
            all_cited_ids.extend(result.action_plan.email_draft.cited_evidence_ids)
        if result.action_plan.task_draft:
            all_cited_ids.extend(result.action_plan.task_draft.cited_evidence_ids)

        # Deduplicate while preserving check
        checked_citations = list(dict.fromkeys(all_cited_ids))
        citations_valid = True

        for eid in checked_citations:
            if eid in allowed_evidence_ids:
                valid_citations.append(eid)
            else:
                hallucinated_citations.append(eid)
                citations_valid = False
                violations.append(
                    f"Hallucinated evidence citation: ID '{eid}' does not exist in account '{target_account_id}' context records."
                )

        # 4. Deterministic Supremacy Guardrail
        supremacy_valid = True
        det_score = result.deterministic_risk.risk_score
        det_level = result.deterministic_risk.risk_level
        det_reason = result.deterministic_risk.primary_reason_code

        if result.investigation.authoritative_risk_score != det_score:
            supremacy_valid = False
            violations.append(
                f"Deterministic supremacy violation: Autopsy score ({result.investigation.authoritative_risk_score}) "
                f"differs from authoritative deterministic score ({det_score})."
            )

        if result.investigation.authoritative_risk_level != det_level:
            supremacy_valid = False
            violations.append(
                f"Deterministic supremacy violation: Autopsy risk level ({result.investigation.authoritative_risk_level}) "
                f"differs from authoritative deterministic level ({det_level})."
            )

        if result.risk_explanation.authoritative_risk_score != det_score:
            supremacy_valid = False
            violations.append(
                f"Deterministic supremacy violation: Risk explanation score ({result.risk_explanation.authoritative_risk_score}) "
                f"differs from authoritative deterministic score ({det_score})."
            )

        # 5. Human-in-the-Loop Guardrail
        human_approval_valid = True
        if result.action_plan.status != "proposed":
            human_approval_valid = False
            violations.append(
                f"Human-in-the-loop violation: Proposed action status is '{result.action_plan.status}' "
                f"(MUST be 'proposed' awaiting CSM approval)."
            )

        # Overall validity
        is_valid = (
            schema_valid
            and ownership_valid
            and citations_valid
            and supremacy_valid
            and human_approval_valid
        )

        logger.info(
            f"OutputValidator result for account '{target_account_id}': "
            f"is_valid={is_valid}, {len(valid_citations)} valid citations, "
            f"{len(hallucinated_citations)} hallucinated citations, "
            f"{len(violations)} violations."
        )

        return ValidationResult(
            is_valid=is_valid,
            account_id=target_account_id,
            schema_valid=schema_valid,
            evidence_citations_valid=citations_valid,
            account_ownership_valid=ownership_valid,
            deterministic_supremacy_valid=supremacy_valid,
            human_approval_guardrail_valid=human_approval_valid,
            checked_citations_count=len(checked_citations),
            valid_citations=valid_citations,
            hallucinated_citations=hallucinated_citations,
            ownership_violations=ownership_violations,
            violations=violations,
            warnings=warnings,
            validated_at=datetime.now(timezone.utc).isoformat()
        )

    @classmethod
    def sanitize_citations(
        cls,
        result: OrchestratedInvestigationResult
    ) -> OrchestratedInvestigationResult:
        """
        Sanitization helper: strips any hallucinated citation IDs from facts,
        interpretations, and drafts so downstream persistence or UI display never renders broken links.
        """
        allowed = set()
        for ev in result.context.selected_evidence:
            allowed.add(ev.evidence_id)
            allowed.add(ev.signal_id)
            if ev.evidence_id.startswith("EVID-"):
                allowed.add(ev.evidence_id.replace("EVID-", ""))
            else:
                allowed.add(f"EVID-{ev.evidence_id}")

        # Sanitize verified facts
        for fact in result.investigation.verified_facts:
            fact.evidence_ids = [eid for eid in fact.evidence_ids if eid in allowed]

        # Sanitize interpretations
        for interp in result.investigation.interpretations:
            interp.supporting_evidence_ids = [eid for eid in interp.supporting_evidence_ids if eid in allowed]

        # Sanitize top-level cited IDs
        result.investigation.cited_evidence_ids = [
            eid for eid in result.investigation.cited_evidence_ids if eid in allowed
        ]

        # Sanitize action plan
        result.action_plan.cited_evidence_ids = [
            eid for eid in result.action_plan.cited_evidence_ids if eid in allowed
        ]
        if result.action_plan.email_draft:
            result.action_plan.email_draft.cited_evidence_ids = [
                eid for eid in result.action_plan.email_draft.cited_evidence_ids if eid in allowed
            ]
        if result.action_plan.task_draft:
            result.action_plan.task_draft.cited_evidence_ids = [
                eid for eid in result.action_plan.task_draft.cited_evidence_ids if eid in allowed
            ]

        return result


# Default singleton instance
output_validator = OutputValidator()
