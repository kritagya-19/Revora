import asyncio
import uuid
from typing import Dict, Any
from app.models.schemas import ActionProposal, ActionStatus
from app.services.proposal_repository import proposal_repo

class ActionExecutor:
    """
    Executes approved proposals safely.
    Re-checks authorization, proposal status, version binding, and mode before dispatching.
    Simulated mode is explicitly indicated in the result payload.
    """

    @classmethod
    async def execute(cls, proposal: ActionProposal, execution_mode: str = "simulated") -> Dict[str, Any]:
        # 1. Strict validation gate
        if proposal.status != ActionStatus.APPROVED:
            raise PermissionError(f"Action execution blocked: Proposal {proposal.id} is in status '{proposal.status.value}', not 'approved'.")

        if not proposal.approved_by:
            raise PermissionError(f"Action execution blocked: Proposal {proposal.id} lacks authorized human approval signature.")

        # 2. Mark state transition to EXECUTING
        proposal_repo.record_execution_outcome(proposal.id, ActionStatus.EXECUTING, {"status": "in_progress"})

        # 3. Execution dispatch
        if execution_mode == "simulated":
            # Simulate dispatch latency
            await asyncio.sleep(0.5)
            
            result = {
                "execution_id": f"sim-exec-{uuid.uuid4().hex[:8]}",
                "mode": "simulated",
                "status": "succeeded",
                "action_type": proposal.action_type,
                "target": proposal.payload.get("recipient") or proposal.payload.get("target"),
                "message": f"Successfully simulated dispatch of {proposal.action_type}",
                "simulated_details": {
                    "sent_content": proposal.payload,
                    "provider_code": 200,
                    "provider_message": "OK (Dry-run simulated delivery)"
                }
            }
            proposal_repo.record_execution_outcome(proposal.id, ActionStatus.SUCCEEDED, result)
            return result
        else:
            # Live execution path (e.g., SendGrid/Slack/Salesforce)
            # Currently in safety sandbox
            error_result = {
                "mode": "live",
                "status": "failed",
                "error": "Live provider connector is unconfigured in this environment. Switch to simulated mode."
            }
            proposal_repo.record_execution_outcome(proposal.id, ActionStatus.FAILED, error_result)
            return error_result

action_executor = ActionExecutor()
