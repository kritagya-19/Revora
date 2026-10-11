import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.core.config import settings
from app.models.schemas import (
    AccountDetail,
    Investigation,
    InvestigationFinding,
    RecommendedAction,
    AskAccountQuestionResponse
)

from app.core.llm_client import llm_client

logger = logging.getLogger("revora.llm")

class LLMService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

    def generate_investigation(self, account: AccountDetail) -> Investigation:
        """
        Executes the AI Investigation pipeline:
        1. Assembles verified stored evidence and deterministic risk score.
        2. Prompts OpenRouter LLM (or Gemini / deterministic grounding engine) for structured findings, causal explanation, blindspots, and recommended action.
        3. Validates that all cited evidence IDs exist in stored signals.
        """
        valid_signal_ids = {s.id for s in account.signals}

        # 1. Attempt OpenRouter LLM first
        if llm_client.is_available():
            try:
                prompt = self._build_investigation_prompt(account)
                parsed = llm_client.generate_json(
                    prompt,
                    system_prompt="You are Revora's Chief Revenue Intelligence AI. Synthesize an evidence-grounded Revenue Risk Autopsy. Return strictly valid JSON."
                )
                if parsed:
                    return self._build_and_validate_investigation(account, parsed, valid_signal_ids)
            except Exception as e:
                logger.warning(f"OpenRouter investigation call failed: {e}. Trying Gemini or fallback.")

        # 2. If Gemini API key is configured, attempt call
        if self.api_key and self.api_key.strip():
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                
                prompt = self._build_investigation_prompt(account)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json"
                    }
                )
                if response.text:
                    parsed = json.loads(response.text)
                    return self._build_and_validate_investigation(account, parsed, valid_signal_ids)
            except Exception as e:
                logger.warning(f"Gemini API investigation call failed: {e}. Using deterministic evidence synthesis.")

        # 3. Deterministic evidence-grounded investigation fallback
        return self._generate_deterministic_investigation(account, valid_signal_ids)

    def answer_account_question(self, account: AccountDetail, question: str) -> AskAccountQuestionResponse:
        """
        Answers follow-up CSM questions grounded strictly in the stored account signals and contacts.
        """
        valid_signal_ids = {s.id for s in account.signals}

        # 1. Attempt OpenRouter LLM first
        if llm_client.is_available():
            try:
                prompt = self._build_qa_prompt(account, question)
                parsed = llm_client.generate_json(
                    prompt,
                    system_prompt="You are Revora's Account Assistant. Answer grounded strictly in verified account records. Output strictly valid JSON."
                )
                if parsed:
                    cited_ids = [eid for eid in parsed.get("cited_evidence_ids", []) if eid in valid_signal_ids]
                    return AskAccountQuestionResponse(
                        account_id=account.id,
                        question=question,
                        answer=parsed.get("answer", "No direct evidence found in account records."),
                        cited_evidence_ids=cited_ids,
                        confidence=parsed.get("confidence", "high"),
                        uncertainties=parsed.get("uncertainties", [])
                    )
            except Exception as e:
                logger.warning(f"OpenRouter Q&A call error: {e}. Trying Gemini or fallback.")

        # 2. Attempt Gemini if configured
        if self.api_key and self.api_key.strip():
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                prompt = self._build_qa_prompt(account, question)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                if response.text:
                    parsed = json.loads(response.text)
                    cited_ids = [eid for eid in parsed.get("cited_evidence_ids", []) if eid in valid_signal_ids]
                    return AskAccountQuestionResponse(
                        account_id=account.id,
                        question=question,
                        answer=parsed.get("answer", "No direct evidence found in account records."),
                        cited_evidence_ids=cited_ids,
                        confidence=parsed.get("confidence", "high"),
                        uncertainties=parsed.get("uncertainties", [])
                    )
            except Exception as e:
                logger.warning(f"Gemini Q&A call error: {e}. Using rule-grounded answer.")

        # 3. Deterministic rule-grounded answer fallback
        return self._deterministic_qa(account, question)

    def _build_investigation_prompt(self, account: AccountDetail) -> str:
        signals_context = [
            {
                "id": s.id,
                "category": s.source_category,
                "type": s.signal_type,
                "title": s.title,
                "summary": s.summary,
                "severity": s.severity,
                "timestamp": s.timestamp,
                "observed": s.observed_value
            }
            for s in account.signals
        ]

        contacts_context = [
            {"name": c.name, "role": c.role, "sentiment": c.sentiment, "email": c.email, "is_primary": c.is_primary}
            for c in account.contacts
        ]

        return f"""
You are SignalBridge AI, an expert RevOps intelligence system. Analyze the customer account below.
Ground every finding in the provided signals. Do NOT invent signal IDs or facts not listed.

Account Data:
- Company: {account.name} (ID: {account.id})
- ARR: ${account.arr:,.0f}
- Renewal Date: {account.renewal_date} ({account.urgency_days_to_renewal} days remaining)
- Deterministic Risk Score: {account.risk_score}/100 ({account.risk_level.value.upper()})
- Primary Reason Code: {account.primary_reason_code}
- Signals: {json.dumps(signals_context)}
- Stakeholders: {json.dumps(contacts_context)}

Return JSON with this exact schema:
{{
  "risk_summary": "Short 1-sentence risk thesis",
  "findings": [
    {{
      "claim": "Observed claim statement",
      "evidence_ids": ["sig-xxx"],
      "type": "observed_fact",
      "severity": "high"
    }}
  ],
  "causal_explanation": "2-3 paragraphs explaining how these multi-source signals interconnect to create churn risk.",
  "uncertainties": [
    "List of blindspots or unverified customer facts"
  ],
  "recommended_action": {{
    "type": "customer_check_in",
    "action_type": "csm_outreach_email",
    "title": "Action title",
    "reason": "Why this action mitigates the verified risk",
    "target_recipient": "email@example.com",
    "suggested_payload": {{
      "subject": "Email subject",
      "body": "Draft outreach message"
    }}
  }}
}}
"""

    def _build_qa_prompt(self, account: AccountDetail, question: str) -> str:
        signals_context = [
            {"id": s.id, "title": s.title, "summary": s.summary, "observed": s.observed_value, "date": s.timestamp}
            for s in account.signals
        ]
        return f"""
Answer the user's question about customer account '{account.name}' strictly grounded in the records below.
If the answer is unknown from the data, explicitly state it as an uncertainty.

Question: {question}
Account ARR: ${account.arr:,.0f}
Renewal: {account.renewal_date} ({account.urgency_days_to_renewal} days left)
Contacts: {[c.name + ' (' + (c.role or '') + ', ' + (c.sentiment or '') + ')' for c in account.contacts]}
Signals: {json.dumps(signals_context)}

Return JSON:
{{
  "answer": "Direct evidence-grounded answer",
  "cited_evidence_ids": ["sig-xxx"],
  "confidence": "high",
  "uncertainties": ["Any missing info"]
}}
"""

    def _build_and_validate_investigation(self, account: AccountDetail, parsed: Dict[str, Any], valid_signal_ids: set) -> Investigation:
        findings = []
        for f in parsed.get("findings", []):
            cited = [eid for eid in f.get("evidence_ids", []) if eid in valid_signal_ids]
            if not cited and account.signals:
                cited = [account.signals[0].id]
            findings.append(InvestigationFinding(
                claim=f.get("claim", "Observed account signal"),
                evidence_ids=cited,
                type=f.get("type", "observed_fact"),
                severity=f.get("severity", "high")
            ))

        rec_data = parsed.get("recommended_action", {})
        primary_contact = next((c for c in account.contacts if c.is_primary), account.contacts[0] if account.contacts else None)
        rec_action = RecommendedAction(
            type=rec_data.get("type", "customer_check_in"),
            action_type=rec_data.get("action_type", "csm_outreach_email"),
            title=rec_data.get("title", f"Urgent Renewal Outreach to {account.name}"),
            reason=rec_data.get("reason", f"Address {account.primary_reason_code.replace('_', ' ')} ahead of {account.renewal_date} renewal."),
            target_recipient=rec_data.get("target_recipient") or (primary_contact.email if primary_contact else "sponsor@domain.com"),
            suggested_payload=rec_data.get("suggested_payload", {
                "recipient": primary_contact.email if primary_contact else "sponsor@domain.com",
                "subject": f"{account.name} Partnership & Renewal Alignment",
                "body": f"Hi {primary_contact.name if primary_contact else 'Team'}, reaching out to review your platform utilization and resolve open SLA escalations ahead of upcoming contract renewal on {account.renewal_date}."
            })
        )

        return Investigation(
            id=f"inv-{account.id}",
            account_id=account.id,
            account_name=account.name,
            risk_summary=parsed.get("risk_summary", f"Critical churn likelihood detected for {account.name} due to multi-source risk signals."),
            risk_score=account.risk_score,
            risk_level=account.risk_level,
            primary_reason_code=account.primary_reason_code,
            findings=findings,
            causal_explanation=parsed.get("causal_explanation", "Multi-signal synthesis reveals usage drop compounded by touchpoint lag and support ticket escalation."),
            uncertainties=parsed.get("uncertainties", [
                "Customer's internal Q4 budget allocation timeline remains unverified.",
                "Whether executive sponsor has reviewed competitor alternatives."
            ]),
            recommended_action=rec_action,
            rule_version="v1.0.0",
            created_at=datetime.utcnow().isoformat()
        )

    def _generate_deterministic_investigation(self, account: AccountDetail, valid_signal_ids: set) -> Investigation:
        findings = []
        for s in account.signals:
            findings.append(InvestigationFinding(
                claim=f"{s.title}: {s.summary}",
                evidence_ids=[s.id],
                type="observed_fact",
                severity=s.severity
            ))

        primary_contact = next((c for c in account.contacts if c.is_primary), account.contacts[0] if account.contacts else None)
        recipient = primary_contact.email if primary_contact else f"exec@{account.domain or 'company.com'}"
        recipient_name = primary_contact.name if primary_contact else "Executive Team"

        causal_text = (
            f"The account '{account.name}' shows a compounding risk trajectory evaluated at score {account.risk_score}/100. "
            f"Cross-source telemetry identifies {account.primary_reason_code.replace('_', ' ')} with contract renewal scheduled for {account.renewal_date} ({account.urgency_days_to_renewal} days remaining). "
            f"Observing multiple concurrent warning signals across {len(account.signals)} sources indicates that platform disengagement is already underway."
        )

        rec_action = RecommendedAction(
            type="customer_check_in",
            action_type="csm_outreach_email",
            title=f"Targeted Executive Check-In for {account.name}",
            reason=f"Intervene proactively on {account.primary_reason_code.replace('_', ' ')} before the {account.urgency_days_to_renewal}-day renewal horizon expires.",
            target_recipient=recipient,
            suggested_payload={
                "recipient": recipient,
                "subject": f"{account.name} Renewal & Service Continuity Check-In",
                "body": (
                    f"Hi {recipient_name},\n\n"
                    f"I noticed recent data telemetry changes and open items as we approach your upcoming renewal on {account.renewal_date}. "
                    f"I would like to schedule 20 minutes this week with our engineering lead to review your current tier configuration, ensure all critical SLA items are resolved, and optimize active user licenses.\n\n"
                    f"Best regards,\n{account.csm_owner}\nRevora Customer Success"
                ),
                "evidence_ids": [s.id for s in account.signals[:3]]
            }
        )

        return Investigation(
            id=f"inv-{account.id}",
            account_id=account.id,
            account_name=account.name,
            risk_summary=f"Elevated churn likelihood driven by {account.primary_reason_code.replace('_', ' ')}.",
            risk_score=account.risk_score,
            risk_level=account.risk_level,
            primary_reason_code=account.primary_reason_code,
            findings=findings,
            causal_explanation=causal_text,
            uncertainties=[
                "Customer's internal Q4 budget downsizing approval status is unverified.",
                "Whether executive sponsor has evaluated alternative vendor solutions.",
                "Exact timeline of vendor migration discussions within customer leadership."
            ],
            recommended_action=rec_action,
            rule_version="v1.0.0",
            created_at=datetime.utcnow().isoformat()
        )

    def _deterministic_qa(self, account: AccountDetail, question: str) -> AskAccountQuestionResponse:
        q = question.lower()
        
        # Usage questions
        if "usage" in q or "drop" in q or "seat" in q or "active" in q:
            usage_signals = [s for s in account.signals if s.source_category == "usage"]
            if usage_signals:
                top = usage_signals[0]
                return AskAccountQuestionResponse(
                    account_id=account.id,
                    question=question,
                    answer=f"Product analytics records show: {top.summary} (Observed: {top.observed_value or 'contraction'}).",
                    cited_evidence_ids=[top.id],
                    confidence="high",
                    uncertainties=["The exact department-level driver behind seat drop is not specified in telemetry."]
                )

        # Contact / Stakeholder questions
        if "contact" in q or "champion" in q or "who" in q or "owner" in q or "email" in q:
            primary = next((c for c in account.contacts if c.is_primary), account.contacts[0] if account.contacts else None)
            if primary:
                return AskAccountQuestionResponse(
                    account_id=account.id,
                    question=question,
                    answer=f"Primary contact is {primary.name} ({primary.role or 'Executive'}), email: {primary.email}. Recorded sentiment: {primary.sentiment}.",
                    cited_evidence_ids=[s.id for s in account.signals if s.source_category in ("email", "crm")][:2],
                    confidence="high",
                    uncertainties=["Secondary executive sponsors have not logged meetings in the last 30 days."]
                )

        # Renewal questions
        if "renewal" in q or "when" in q or "date" in q or "days" in q or "arr" in q:
            return AskAccountQuestionResponse(
                account_id=account.id,
                question=question,
                answer=f"Contract renewal is due on {account.renewal_date} ({account.urgency_days_to_renewal} days remaining). Current ARR is ${account.arr:,.0f}.",
                cited_evidence_ids=[s.id for s in account.signals if "renewal" in s.title.lower() or s.source_category == "crm"][:1],
                confidence="high",
                uncertainties=["Whether procurement has issued formal RFP or renewal quote approval."]
            )

        # Support / Ticket questions
        if "ticket" in q or "support" in q or "sla" in q or "issue" in q or "bug" in q:
            support_sigs = [s for s in account.signals if s.source_category == "support"]
            if support_sigs:
                top = support_sigs[0]
                return AskAccountQuestionResponse(
                    account_id=account.id,
                    question=question,
                    answer=f"Support records record {len(support_sigs)} ticket(s). Top alert: {top.title} - {top.summary}.",
                    cited_evidence_ids=[top.id],
                    confidence="high",
                    uncertainties=["Whether customer engineering has validated the latest patch deployment."]
                )

        # Default fallback
        top_sig = account.signals[0] if account.signals else None
        return AskAccountQuestionResponse(
            account_id=account.id,
            question=question,
            answer=f"Based on unified records for {account.name}: Account is at {account.risk_level.value.upper()} risk (Score: {account.risk_score}/100) due to {account.primary_reason_code.replace('_', ' ')}. Main alert: {top_sig.summary if top_sig else 'Active monitoring'}.",
            cited_evidence_ids=[top_sig.id] if top_sig else [],
            confidence="high",
            uncertainties=["Additional context can be obtained through direct customer check-in."]
        )

    def draft_followup_email(self, account: AccountDetail, investigation: Optional[Investigation] = None) -> Dict[str, Any]:
        """
        Drafts a personalized, context-grounded executive email using verified account signals,
        stakeholder relationships, and the recommended intervention action.
        """
        primary_contact = next((c for c in account.contacts if c.is_primary), account.contacts[0] if account.contacts else None)
        recipient = primary_contact.email if primary_contact else f"sponsor@{account.domain or 'company.com'}"
        recipient_name = primary_contact.name if primary_contact else "Leadership Team"
        top_signals = account.signals[:3]
        evidence_ids = [s.id for s in top_signals]

        # Use investigation action context if available
        action_reason = (
            investigation.recommended_action.reason
            if investigation and investigation.recommended_action
            else f"Proactively mitigate {account.primary_reason_code.replace('_', ' ')} ahead of {account.renewal_date} contract renewal."
        )

        # Incorporate Feature 5 History-Aware Context
        try:
            from app.services.outcome_intelligence import outcome_intelligence
            history_ctx = outcome_intelligence.get_account_history_context(account.id)
        except Exception:
            history_ctx = None

        # Attempt OpenRouter LLM dynamic drafting with history-aware context
        if llm_client.is_available():
            try:
                history_prompt_snippet = ""
                if history_ctx and history_ctx.unresolved_commitments:
                    history_prompt_snippet = (
                        f"\nACCOUNT HISTORY & RECORDED COMMITMENTS:\n"
                        f"- Open Commitment: {history_ctx.unresolved_commitments[0].get('commitment')}\n"
                        f"- Anti-Repetition Rule: {history_ctx.preferable_to_repeating_reason}\n"
                        f"- Days since last contact: {history_ctx.days_since_last_followup}\n"
                    )

                email_prompt = (
                    f"Account: {account.name} (ARR: ${account.arr:,.0f}, Renewal: {account.renewal_date}).\n"
                    f"Recipient: {recipient_name} ({recipient}).\n"
                    f"CSM Owner: {account.csm_owner}.\n"
                    f"Key Signals: {json.dumps([s.summary for s in top_signals])}.\n"
                    f"Action Reason: {action_reason}.\n"
                    f"{history_prompt_snippet}"
                    "Draft an executive outreach email that directly addresses recorded commitments, avoids repetitive re-discovery, and mitigates churn.\n"
                    "Return JSON with keys: 'subject', 'body', 'reason'."
                )
                res = llm_client.generate_json(
                    email_prompt,
                    system_prompt="You are Revora's Customer Success Copilot. Return strictly valid JSON."
                )
                if res and res.get("subject") and res.get("body"):
                    return {
                        "recipient": recipient,
                        "recipient_name": recipient_name,
                        "subject": res["subject"],
                        "body": res["body"],
                        "reason": res.get("reason", action_reason),
                        "evidence_ids": evidence_ids
                    }
            except Exception as e:
                logger.warning(f"OpenRouter email drafting failed: {e}. Using template.")

        # History-aware deterministic template
        if history_ctx and history_ctx.unresolved_commitments:
            commit = history_ctx.unresolved_commitments[0].get('commitment', '')
            subject = f"{account.name} — Update on {commit[:40]}... & Next Steps"
            body = (
                f"Hi {recipient_name},\n\n"
                f"I hope your week is off to a great start. Following our recent checkpoint regarding your team's upcoming renewal on {account.renewal_date}, "
                f"I am writing back specifically to deliver on what we discussed:\n\n"
                f"• Recorded Commitment: {commit}\n"
                f"• Technical & Service Continuity: Ensuring all active engineering seats are unblocked and license tiering is aligned with your budget.\n\n"
                f"I have assembled the requested breakdown and would like to review it together for 15 minutes this Thursday afternoon or Friday morning. "
                f"Please let me know if Thursday 2:30 PM works for your calendar.\n\n"
                f"Best regards,\n"
                f"{account.csm_owner}\n"
                f"Revora Customer Success"
            )
        else:
            subject = f"{account.name} — Platform Continuity & Executive Alignment ({account.renewal_date})"
            body = (
                f"Hi {recipient_name},\n\n"
                f"I hope you're having a productive week. As your Customer Success Partner at Revora, "
                f"I have been tracking your team's utilization trends and upcoming renewal scheduled for {account.renewal_date}.\n\n"
                f"Recently, our operational telemetry detected a few items we want to ensure are addressed swiftly:\n"
                f"• Verified usage shifts: {top_signals[0].summary if top_signals else 'Telemetry variance observed'}\n"
                f"• Service continuity: Addressing open SLA escalations and optimizing seat allocations across departments.\n\n"
                f"I would like to schedule a brief 20-minute alignment session this Thursday or Friday with our Solutions Architect to review these metrics, provide direct resolution on open tickets, and tailor your license tier to maximize ROI.\n\n"
                f"Please let me know if Thursday 2:00 PM or Friday 11:00 AM works for your calendar.\n\n"
                f"Best regards,\n"
                f"{account.csm_owner}\n"
                f"Revora Customer Success"
            )

        return {
            "recipient": recipient,
            "recipient_name": recipient_name,
            "subject": subject,
            "body": body,
            "reason": action_reason,
            "evidence_ids": evidence_ids
        }

    def draft_followup_task(self, account: AccountDetail, investigation: Optional[Investigation] = None) -> Dict[str, Any]:
        """
        Prepares a structured follow-up operational task assigned to the account owner.
        """
        top_signals = account.signals[:2]
        evidence_ids = [s.id for s in top_signals]

        task_title = f"Conduct Executive Health Review & Ticket Resolution for {account.name}"
        task_desc = (
            f"Schedule 20-min alignment with {account.name} stakeholders regarding {account.primary_reason_code.replace('_', ' ')}. "
            f"Coordinate with Support engineering to clear blocking tickets prior to renewal window ({account.urgency_days_to_renewal} days remaining)."
        )

        return {
            "title": task_title,
            "description": task_desc,
            "assigned_to": account.csm_owner,
            "due_date": account.renewal_date,
            "priority": "high" if account.risk_level.value in ("critical", "high") else "medium",
            "evidence_ids": evidence_ids
        }

    def draft_crm_update(self, account: AccountDetail, investigation: Optional[Investigation] = None) -> Dict[str, Any]:
        """
        Prepares structured CRM updates with current value, proposed value, strategic reason,
        and backing evidence citations.
        """
        top_signals = account.signals[:2]
        evidence_ids = [s.id for s in top_signals]

        current_val = "Healthy / Low Risk" if account.health_score and account.health_score > 70 else "Medium Risk"
        proposed_val = f"High Churn Risk — {account.primary_reason_code.replace('_', ' ').title()}"
        reason = (
            f"Automated risk detection identified compounding indicators: "
            f"Deterministic score {account.risk_score}/100, renewal in {account.urgency_days_to_renewal} days, "
            f"and {len(account.signals)} verified risk signals."
        )

        return {
            "field_name": "Account Risk Tier & Forecast Category",
            "current_value": current_val,
            "proposed_value": proposed_val,
            "reason": reason,
            "evidence_ids": evidence_ids
        }

    def generate_draft_actions(self, account: AccountDetail, investigation: Optional[Investigation] = None) -> Dict[str, Any]:
        """
        Synthesizes the complete Next-Best-Action copilot draft set across Email, Task, and CRM fields,
        enriched with Feature 5 History-Aware Context.
        """
        # Feature 5: Retrieve relevant past outcomes, similar situations, and anti-repetition rationale
        history_ctx = None
        try:
            from app.services.outcome_intelligence import outcome_intelligence
            history_ctx = outcome_intelligence.get_account_history_context(account.id)
        except Exception as e:
            logger.warning(f"Could not retrieve history context for {account.id}: {e}")

        email_draft = self.draft_followup_email(account, investigation)
        task_draft = self.draft_followup_task(account, investigation)
        crm_draft = self.draft_crm_update(account, investigation)

        return {
            "account_id": account.id,
            "account_name": account.name,
            "investigation_id": investigation.id if investigation else f"inv-{account.id}",
            "email_draft": email_draft,
            "task_draft": {
                "account_id": account.id,
                **task_draft
            },
            "crm_update": crm_draft,
            "history_aware_context": history_ctx.model_dump() if history_ctx else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

llm_service = LLMService()

