"""
Stage 5: Persist and Display for Revora AI Layer.
Flow: Investigation -> Action Proposal -> Human Approval

Responsibilities:
1. Persists validated Investigation Autopsies and Risk Assessments to MongoDB and repositories.
2. Stages Action Proposals in draft status (ActionStatus.PROPOSED) awaiting human CSM review.
3. Enforces cryptographic content hashing and audit trail logging.
4. Integrates with the approval gateway (/api/approvals) for human signoff and dispatch.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from app.ai.orchestrator import AgentOrchestrator, agent_orchestrator
from app.ai.schemas import (
    ActionPlanOutput,
    InvestigationAutopsy,
    OrchestratedInvestigationResult,
    ValidationResult,
)
from app.ai.validators import OutputValidator, output_validator
from app.models.schemas import (
    ActionProposal,
    ActionStatus,
    Investigation,
    InvestigationFinding,
    RecommendedAction,
)
from app.services.account_repository import account_repo
from app.services.investigation_repository import investigation_repo
from app.services.proposal_repository import proposal_repo

logger = logging.getLogger("revora.ai.persistence")


class PersistAndDisplayManager:
    """
    Stage 5: Persist and Display Manager.
    Bridges the AI reasoning pipeline into MongoDB persistence,
    staged action proposals, and the human-in-the-loop approval workflow.
    """

    def __init__(
        self,
        orchestrator: Optional[AgentOrchestrator] = None,
        validator: Optional[OutputValidator] = None,
    ):
        self.orchestrator = orchestrator or agent_orchestrator
        self.validator = validator or output_validator

    def persist_and_stage(
        self,
        orchestrated_result: OrchestratedInvestigationResult,
        validate: bool = True
    ) -> Tuple[Investigation, ActionProposal, ValidationResult]:
        """
        Takes an OrchestratedInvestigationResult, validates it (Stage 4),
        and persists the artifacts:
        1. Saves Investigation Autopsy to investigations collection.
        2. Saves Risk Assessment breakdown to risk_assessments collection.
        3. Stages ActionProposal in action_proposals with status PROPOSED (Stage 5).
        4. Logs audit trail for human review.
        """
        # Step 1: Validate Stage 4 guardrails
        val_result = self.validator.validate_orchestrated_result(orchestrated_result)
        if validate and not val_result.is_valid:
            logger.warning(
                f"Output validation failed with {len(val_result.violations)} violations. "
                "Sanitizing citations before staging."
            )
            orchestrated_result = self.validator.sanitize_citations(orchestrated_result)

        # Step 2: Map and persist Investigation
        inv_record = self._persist_investigation(orchestrated_result)

        # Step 3: Map and stage Action Proposal
        proposal_record = self._stage_action_proposal(orchestrated_result, inv_record.id)

        # Step 4: Persist risk assessment audit log
        self._persist_risk_assessment(orchestrated_result)

        logger.info(
            f"Successfully persisted and staged AI artifacts for account '{orchestrated_result.account_id}': "
            f"Investigation ID='{inv_record.id}', Proposal ID='{proposal_record.id}' "
            f"(Status={proposal_record.status.value})."
        )

        return inv_record, proposal_record, val_result

    def run_full_pipeline_and_persist(
        self,
        account_id: str
    ) -> Tuple[Investigation, ActionProposal, ValidationResult]:
        """
        Executes the entire end-to-end 5-stage AI pipeline for an account:
        Input -> Context Builder -> Deterministic Risk -> Orchestrator (Agents 1-4) -> Output Validator -> Persist & Display
        """
        # Run orchestrator
        orchestrated_result = self.orchestrator.orchestrate_account(account_id)

        # Persist and stage
        return self.persist_and_stage(orchestrated_result, validate=True)

    def _persist_investigation(
        self,
        result: OrchestratedInvestigationResult
    ) -> Investigation:
        """
        Maps InvestigationAutopsy to persistent Investigation schema and stores it in MongoDB.
        """
        autopsy: InvestigationAutopsy = result.investigation
        action_plan: ActionPlanOutput = result.action_plan

        # Map facts and interpretations into InvestigationFindings
        findings = []
        for fact in autopsy.verified_facts:
            mapped_eids = [eid.replace("EVID-", "") if eid.startswith("EVID-") else eid for eid in fact.evidence_ids]
            findings.append(InvestigationFinding(
                claim=fact.claim,
                evidence_ids=mapped_eids,
                type="observed_fact",
                severity="high"
            ))

        for interp in autopsy.interpretations:
            mapped_eids = [eid.replace("EVID-", "") if eid.startswith("EVID-") else eid for eid in interp.supporting_evidence_ids]
            findings.append(InvestigationFinding(
                claim=f"[Interpretation] {interp.hypothesis}",
                evidence_ids=mapped_eids,
                type="causal_link",
                severity="medium"
            ))

        # Build payload for recommended action
        email_payload = {}
        if action_plan.email_draft:
            email_payload = {
                "recipient": action_plan.email_draft.recipient_email,
                "recipient_name": action_plan.email_draft.recipient_name,
                "subject": action_plan.email_draft.subject,
                "body": action_plan.email_draft.body,
                "evidence_ids": action_plan.email_draft.cited_evidence_ids
            }

        rec_action = RecommendedAction(
            type=action_plan.action_type,
            action_type=action_plan.action_type,
            title=action_plan.title,
            reason=action_plan.reason,
            target_recipient=action_plan.target_contact,
            suggested_payload=email_payload
        )

        inv_id = f"inv-{result.account_id}"
        inv = Investigation(
            id=inv_id,
            account_id=result.account_id,
            account_name=result.account_name,
            risk_summary=autopsy.risk_summary,
            risk_score=autopsy.authoritative_risk_score,
            risk_level=autopsy.authoritative_risk_level,
            primary_reason_code=autopsy.primary_reason_code,
            findings=findings,
            causal_explanation=autopsy.causal_explanation,
            uncertainties=autopsy.uncertainties,
            recommended_action=rec_action,
            rule_version=autopsy.rule_version,
            created_at=datetime.now(timezone.utc).isoformat()
        )

        # Store in investigation_repo cache and MongoDB
        investigation_repo._investigations[inv.id] = inv
        if investigation_repo.db is not None:
            try:
                doc = inv.model_dump()
                investigation_repo.db.investigations.update_one(
                    {"id": inv.id},
                    {"$set": doc},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"MongoDB save investigation error: {e}")

        return inv

    def _stage_action_proposal(
        self,
        result: OrchestratedInvestigationResult,
        investigation_id: str
    ) -> ActionProposal:
        """
        Creates an ActionProposal staged in PROPOSED status for CSM review.
        """
        action_plan: ActionPlanOutput = result.action_plan
        account_id = result.account_id

        # Format proposal payload
        payload: Dict[str, Any] = {}
        if action_plan.email_draft:
            payload = {
                "recipient": action_plan.email_draft.recipient_email,
                "recipient_name": action_plan.email_draft.recipient_name,
                "subject": action_plan.email_draft.subject,
                "body": action_plan.email_draft.body,
                "evidence_ids": action_plan.email_draft.cited_evidence_ids
            }
        elif action_plan.task_draft:
            payload = {
                "title": action_plan.task_draft.title,
                "description": action_plan.task_draft.description,
                "assigned_to": action_plan.task_draft.assigned_to,
                "due_date": action_plan.task_draft.due_date,
                "priority": action_plan.task_draft.priority,
                "evidence_ids": action_plan.task_draft.cited_evidence_ids
            }

        # Create proposal through proposal_repo
        proposal = proposal_repo.create_proposal(
            account_id=account_id,
            action_type=action_plan.action_type,
            title=action_plan.title,
            payload=payload,
            evidence_ids=action_plan.cited_evidence_ids,
            reason=action_plan.reason,
            investigation_id=investigation_id,
            status=ActionStatus.PROPOSED  # Staged for human approval
        )

        return proposal

    def _persist_risk_assessment(
        self,
        result: OrchestratedInvestigationResult
    ):
        """
        Persists the deterministic risk assessment audit record to MongoDB.
        """
        if investigation_repo.db is not None:
            try:
                assessment_doc = {
                    "account_id": result.account_id,
                    "risk_score": result.deterministic_risk.risk_score,
                    "risk_level": result.deterministic_risk.risk_level.value,
                    "primary_reason_code": result.deterministic_risk.primary_reason_code,
                    "contributing_factors": result.deterministic_risk.contributing_factors,
                    "urgency_level": result.deterministic_risk.urgency.urgency_level,
                    "urgency_drivers": result.deterministic_risk.urgency.urgency_drivers,
                    "rule_breakdown": [r.model_dump() for r in result.deterministic_risk.rule_breakdown],
                    "rule_version": result.deterministic_risk.rule_version,
                    "evaluated_at": datetime.now(timezone.utc).isoformat()
                }
                investigation_repo.db.risk_assessments.insert_one(assessment_doc)
            except Exception as e:
                logger.warning(f"MongoDB save risk_assessment error: {e}")


# Default singleton instance
persist_manager = PersistAndDisplayManager()
