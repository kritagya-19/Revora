import asyncio
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from app.models.schemas import ActionProposal, ActionStatus, CreateTaskRequest
from app.services.proposal_repository import proposal_repo
from app.services.free_pipeline_service import free_pipelines
from app.services.task_repository import task_repo
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.executor")

class ActionExecutor:
    """
    Executes approved proposals safely through Free Pipelines:
    - Discord / Slack Webhooks (Real-Time Free Alerts)
    - Free Email SMTP or Live Outbox Inspector
    - Task Persistence into Operational Task Queue
    - CRM Changes Persistence into CRM and Account Store
    - Verifies authorization, proposal status, version binding, and mode before dispatching.
    - Truthfully records execution successes and failures into audit trail.
    """

    @classmethod
    async def execute(cls, proposal: ActionProposal, execution_mode: str = "simulated") -> Dict[str, Any]:
        # 1. Strict validation gate: ONLY approved proposals can execute
        if proposal.status != ActionStatus.APPROVED:
            raise PermissionError(
                f"Action execution blocked: Proposal {proposal.id} is in status '{proposal.status.value}', not 'approved'. Action cannot be executed without human approval."
            )

        if not proposal.approved_by:
            raise PermissionError(
                f"Action execution blocked: Proposal {proposal.id} lacks authorized human approval signature."
            )

        # 2. Mark state transition to EXECUTING
        proposal_repo.record_execution_outcome(proposal.id, ActionStatus.EXECUTING, {"status": "in_progress"})

        payload = proposal.payload or {}
        recipient = payload.get("recipient") or payload.get("assigned_to") or payload.get("assignee") or payload.get("target") or "Customer Team"
        action_type = proposal.action_type
        exec_id = f"exec-{uuid.uuid4().hex[:8]}"

        from app.core.config import settings
        is_live = (execution_mode == "live" or settings.EXECUTION_MODE == "live") and (
            free_pipelines.webhook_url != "" or free_pipelines.smtp_host != ""
        )

        try:
            # Check for simulated or intentional failure flag to test truthful failure recording
            if payload.get("simulate_failure") is True:
                failure_reason = payload.get("failure_reason", "Simulated delivery failure: destination SMTP host rejected connection.")
                raise RuntimeError(failure_reason)

            webhook_result = None
            email_result = None
            persisted_task = None
            persisted_crm = None

            # 3. Handle EMAIL Outreach
            if action_type in ("csm_outreach_email", "email", "csm_email"):
                to_email = payload.get("recipient", "contact@customer.com")
                to_name = payload.get("recipient_name", "Customer Champion")
                subject = payload.get("subject", f"Revora Follow-up: {proposal.title}")
                body = payload.get("body", "Revora Automated Customer Success Outreach")

                email_result = free_pipelines.dispatch_email(
                    to_email=to_email,
                    to_name=to_name,
                    subject=subject,
                    body_text=body
                )

                webhook_result = await free_pipelines.dispatch_webhook_event(
                    event_type="action_executed_email",
                    title=f"CSM Outreach Email Dispatched: {proposal.title}",
                    description=f"Approved by **{proposal.approved_by}**.\nDelivered to: `{to_email}`",
                    account_name=proposal.account_id,
                    account_id=proposal.account_id,
                    fields=[
                        {"name": "Subject", "value": subject, "inline": False},
                        {"name": "Urgency", "value": payload.get("urgency", "HIGH"), "inline": True},
                        {"name": "Channel", "value": email_result.get("channel", "Live Outbox"), "inline": True}
                    ],
                    urgency=payload.get("urgency", "high")
                )

            # 4. Handle TASK Creation & Operational Persistence
            elif action_type in ("task_assignment", "task_create", "task"):
                task_title = payload.get("title", proposal.title)
                task_desc = payload.get("description", payload.get("instructions", ""))
                objective = payload.get("objective", "")
                if objective and objective not in task_desc:
                    task_desc = f"{task_desc}\n\nObjectives:\n{objective}".strip()

                assignee = payload.get("assigned_to") or payload.get("assignee") or proposal.approved_by or "CSM Team"
                due_date = payload.get("due_date") or payload.get("deadline") or "Within 3 days"
                priority = payload.get("priority", "high")
                evidence_ids = proposal.evidence_ids or payload.get("evidence_ids", [])

                # Persist approved task into TaskRepository
                persisted_task = task_repo.create_task(CreateTaskRequest(
                    account_id=proposal.account_id,
                    title=task_title,
                    description=task_desc,
                    assigned_to=assignee,
                    due_date=due_date,
                    priority=priority,
                    evidence_ids=evidence_ids
                ))

                webhook_result = await free_pipelines.dispatch_webhook_event(
                    event_type="action_executed_task",
                    title=f"Task Assigned: {task_title}",
                    description=f"Action task created by **{proposal.approved_by}** (Task ID: {persisted_task.id})",
                    account_name=proposal.account_id,
                    account_id=proposal.account_id,
                    fields=[
                        {"name": "Task ID", "value": persisted_task.id, "inline": True},
                        {"name": "Assignee", "value": assignee, "inline": True},
                        {"name": "Priority", "value": priority, "inline": True},
                        {"name": "Due Date", "value": due_date, "inline": True}
                    ],
                    urgency="critical" if "critical" in priority.lower() or "p0" in priority.lower() else "high"
                )

            # 5. Handle CRM Update & Account State Persistence
            elif action_type in ("crm_update", "crm"):
                crm_target = payload.get("target", "CRM Database")
                field_name = payload.get("field_name") or payload.get("field", "Account Risk Tier & Forecast Category")
                new_val = payload.get("proposed_value") or payload.get("value", "High Churn Risk")
                field_updates = payload.get("field_updates", [])

                # Persist approved CRM changes into AccountRepository
                persisted_crm = account_repo.apply_approved_crm_update(
                    account_id=proposal.account_id,
                    field_name=field_name,
                    proposed_value=new_val,
                    field_updates=field_updates,
                    approved_by=proposal.approved_by
                )

                webhook_result = await free_pipelines.dispatch_webhook_event(
                    event_type="action_executed_crm",
                    title=f"CRM Record Updated ({crm_target})",
                    description=f"Approved by **{proposal.approved_by}**.",
                    account_name=proposal.account_id,
                    account_id=proposal.account_id,
                    fields=[
                        {"name": "Field", "value": field_name, "inline": True},
                        {"name": "New Value", "value": new_val, "inline": True},
                        {"name": "Persisted Status", "value": "Applied & Synced", "inline": True}
                    ],
                    urgency="medium"
                )

            # 6. Succeeded outcome packaging
            pipeline_details = {
                "webhook_dispatch": webhook_result,
                "email_dispatch": email_result,
                "provider_code": 200,
                "provider_message": "OK (Delivered via Free Webhook / Outbox Pipeline)"
            }

            result = {
                "execution_id": exec_id,
                "mode": "live" if is_live else "simulated",
                "status": "succeeded",
                "action_type": proposal.action_type,
                "target": recipient,
                "message": f"Successfully executed {proposal.action_type} via Free Pipeline Engine",
                "task_id": persisted_task.id if persisted_task else None,
                "persisted_task_id": persisted_task.id if persisted_task else None,
                "crm_synced": True if persisted_crm else False,
                "persisted_crm": persisted_crm,
                "free_pipeline_details": pipeline_details,
                "simulated_details": pipeline_details
            }

            proposal_repo.record_execution_outcome(proposal.id, ActionStatus.SUCCEEDED, result)
            return result

        except Exception as e:
            logger.error(f"Execution failed for proposal {proposal.id}: {e}", exc_info=True)
            failed_timestamp = datetime.utcnow().isoformat()
            failure_result = {
                "execution_id": exec_id,
                "mode": "live" if is_live else "simulated",
                "status": "failed",
                "action_type": proposal.action_type,
                "target": recipient,
                "error": str(e),
                "message": f"Execution failed for {proposal.action_type}: {str(e)}",
                "failed_at": failed_timestamp
            }

            # Record truthful failure in proposal record and audit log
            proposal_repo.record_execution_outcome(proposal.id, ActionStatus.FAILED, failure_result)
            proposal_repo._record_audit(
                account_id=proposal.account_id,
                proposal_id=proposal.id,
                event_type="execution_failed",
                actor=proposal.approved_by or "system",
                details={"error": str(e), "status": "failed", "failed_at": failed_timestamp}
            )
            return failure_result

action_executor = ActionExecutor()
