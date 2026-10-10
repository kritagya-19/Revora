"""
Agent 4 — Action Planning
Goal: Turns the investigation into a useful next step.

Input: Validated findings, uncertainty, and the CSM's objective (from Agent 3 InvestigationAutopsy & InvestigationContext).
Work: Choose an appropriate proposed action, draft an email or task, explain why it is recommended, and identify the intended target.
Implementation: LLM-generated structured proposal, checked by backend validation.
Output: An editable proposal awaiting human approval (ActionPlanOutput).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.ai.schemas import (
    ActionPlanOutput,
    InvestigationAutopsy,
    InvestigationContext,
    ProposedEmailDraft,
    ProposedTaskDraft,
)
from app.core.config import settings

logger = logging.getLogger("revora.ai.agent4_action_planning")


class Agent4ActionPlanning:
    """
    Specialized Module 4: Generates structured, human-in-the-loop action proposals.
    Selects targeted recipients, drafts tailored outreach emails, and proposes follow-up tasks.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

    def plan_action(
        self,
        context: InvestigationContext,
        autopsy: InvestigationAutopsy
    ) -> ActionPlanOutput:
        """
        Synthesizes the next-best-action proposal staged for human review and approval.
        """
        account = context.account
        primary_contact = context.primary_contact
        recipient_email = primary_contact.email if primary_contact else f"exec@{account.domain or 'company.com'}"
        recipient_name = primary_contact.name if primary_contact else "Executive Team"

        # 1. Attempt LLM action proposal if API key is active
        if self.api_key and self.api_key.strip():
            try:
                plan = self._run_llm_planning(context, autopsy, recipient_email, recipient_name)
                if plan:
                    return plan
            except Exception as e:
                logger.warning(f"Agent 4 LLM planning failed: {e}. Falling back to deterministic proposal.")

        # 2. Deterministic action proposal synthesis
        return self._run_deterministic_planning(context, autopsy, recipient_email, recipient_name)

    def _run_llm_planning(
        self,
        context: InvestigationContext,
        autopsy: InvestigationAutopsy,
        recipient_email: str,
        recipient_name: str
    ) -> Optional[ActionPlanOutput]:
        """
        Prompts Gemini to draft personalized action proposal based on autopsy findings.
        """
        from google import genai
        client = genai.Client(api_key=self.api_key)

        prompt = f"""
You are Agent 4 (Action Planning Specialist) for Revora.
Draft an actionable Next-Best-Action proposal for CSM {context.account.csm_owner} to engage {context.account.name}.

INVESTIGATION FINDINGS:
- Account: {context.account.name} (ARR: ${context.account.arr:,.0f})
- Renewal: {context.account.renewal_date} ({context.account.days_to_renewal} days remaining)
- Risk Score: {autopsy.authoritative_risk_score}/100 ({autopsy.authoritative_risk_level.value})
- Primary Reason: {autopsy.primary_reason_code}
- Causal Synthesis: {autopsy.causal_explanation}
- Target Stakeholder: {recipient_name} ({recipient_email})
- Top Evidence Citations: {autopsy.cited_evidence_ids[:3]}

INSTRUCTIONS:
1. Propose a targeted customer outreach action ('csm_outreach_email').
2. Draft a clear, personalized email addressed to {recipient_name}.
3. Create a follow-up task for the CSM with a clear due date and high priority.
4. The proposal MUST remain in 'proposed' status awaiting CSM human review.

RETURN JSON:
{{
  "action_type": "csm_outreach_email",
  "title": "Action title, e.g. Executive Renewal Alignment Check-In",
  "reason": "Why this specific action is recommended",
  "email_draft": {{
    "recipient_email": "{recipient_email}",
    "recipient_name": "{recipient_name}",
    "subject": "Email subject",
    "body": "Professional email body addressing license utilization and SLA items",
    "cited_evidence_ids": {json.dumps(autopsy.cited_evidence_ids[:2])}
  }},
  "task_draft": {{
    "title": "Task title for CSM",
    "description": "Task action items",
    "assigned_to": "{context.account.csm_owner}",
    "due_date": "{context.account.renewal_date}",
    "priority": "high",
    "cited_evidence_ids": {json.dumps(autopsy.cited_evidence_ids[:2])}
  }}
}}
"""
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        if not response.text:
            return None

        parsed = json.loads(response.text)
        email_data = parsed.get("email_draft", {})
        task_data = parsed.get("task_draft", {})

        email_draft = ProposedEmailDraft(
            recipient_email=email_data.get("recipient_email", recipient_email),
            recipient_name=email_data.get("recipient_name", recipient_name),
            subject=email_data.get("subject", f"{context.account.name} Renewal & Partnership Check-In"),
            body=email_data.get("body", "Draft outreach body."),
            cited_evidence_ids=email_data.get("cited_evidence_ids", autopsy.cited_evidence_ids[:2])
        )

        task_draft = ProposedTaskDraft(
            title=task_data.get("title", f"Schedule executive check-in with {recipient_name}"),
            description=task_data.get("description", "Follow up on usage contraction and support escalations."),
            assigned_to=task_data.get("assigned_to", context.account.csm_owner),
            due_date=task_data.get("due_date", context.account.renewal_date),
            priority=task_data.get("priority", "high"),
            cited_evidence_ids=task_data.get("cited_evidence_ids", autopsy.cited_evidence_ids[:2])
        )

        return ActionPlanOutput(
            id=f"plan-{context.account.account_id}",
            account_id=context.account.account_id,
            account_name=context.account.name,
            action_type=parsed.get("action_type", "csm_outreach_email"),
            title=parsed.get("title", f"Executive Renewal & Utilization Alignment for {context.account.name}"),
            reason=parsed.get("reason", f"Intervene proactively on {autopsy.primary_reason_code} ahead of {context.account.renewal_date}."),
            target_contact=recipient_name,
            email_draft=email_draft,
            task_draft=task_draft,
            status="proposed",  # Awaiting human approval
            cited_evidence_ids=autopsy.cited_evidence_ids[:4],
            planned_at=datetime.now(timezone.utc).isoformat()
        )

    def _run_deterministic_planning(
        self,
        context: InvestigationContext,
        autopsy: InvestigationAutopsy,
        recipient_email: str,
        recipient_name: str
    ) -> ActionPlanOutput:
        """
        Pure Python fallback to construct a complete, professional action proposal.
        """
        account = context.account
        top_eids = autopsy.cited_evidence_ids[:3]

        email_body = (
            f"Hi {recipient_name},\n\n"
            f"I hope you are having a productive week. As we approach your upcoming renewal on {account.renewal_date}, "
            f"I wanted to reach out directly to ensure your team is getting maximum value from the platform.\n\n"
            f"We noticed recent seat utilization changes and want to ensure any open technical items are fully addressed. "
            f"Could we schedule a brief 20-minute alignment call with our solutions team this Thursday or Friday?\n\n"
            f"Best regards,\n"
            f"{account.csm_owner}\n"
            f"Customer Success, Revora"
        )

        email_draft = ProposedEmailDraft(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=f"{account.name} Partnership & Renewal Alignment",
            body=email_body,
            cited_evidence_ids=top_eids
        )

        task_draft = ProposedTaskDraft(
            title=f"Conduct Renewal Diagnostic Call with {recipient_name}",
            description=(
                f"Review {autopsy.primary_reason_code.replace('_', ' ')} with customer sponsor. "
                f"Confirm Q4 budget status and present license optimization alternatives."
            ),
            assigned_to=account.csm_owner,
            due_date=account.renewal_date,
            priority="high",
            cited_evidence_ids=top_eids
        )

        return ActionPlanOutput(
            id=f"plan-{account.account_id}",
            account_id=account.account_id,
            account_name=account.name,
            action_type="csm_outreach_email",
            title=f"Executive Renewal Alignment for {account.name}",
            reason=(
                f"Address compounding risk factors ({autopsy.primary_reason_code.replace('_', ' ')}) "
                f"ahead of {account.renewal_date} under ${account.arr:,.0f} ARR."
            ),
            target_contact=recipient_name,
            email_draft=email_draft,
            task_draft=task_draft,
            status="proposed",  # Awaiting human approval
            cited_evidence_ids=top_eids,
            planned_at=datetime.now(timezone.utc).isoformat()
        )
