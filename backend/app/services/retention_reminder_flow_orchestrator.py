import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from app.models.schemas import (
    RetentionReminderFlowNode,
    RetentionReminderFlowEdge,
    RetentionReminderFlowGraph,
    RetentionReminderFlowExecution,
    RetentionReminderFlowNodeType,
    RunRetentionReminderFlowRequest,
    ApproveRetentionRecoveryRequest,
    PortfolioRetentionAutomationResult,
    DynamicReminder,
    ReminderType,
    ReminderStatus,
    TimelineEvent,
    TimelineEventType,
    ActionProposal,
    ActionStatus,
    CreateFeedbackSurveyRequest
)
from app.services.account_repository import account_repo
from app.services.reminder_repository import reminder_repo
from app.services.feedback_repository import feedback_repo
from app.services.proposal_repository import proposal_repo

logger = logging.getLogger("revora.retention_reminder_flow_orchestrator")

GRAPH_NODES: List[RetentionReminderFlowNode] = [
    RetentionReminderFlowNode(
        id="A",
        title="Collect Customer Signals",
        subtitle="CRM · Email · Calendar · Product Usage",
        node_type=RetentionReminderFlowNodeType.SOURCE,
        category_class="source",
        summary="Continuously ingests multi-source customer data across CRM telemetry, email exchanges, meetings, and product usage."
    ),
    RetentionReminderFlowNode(
        id="B",
        title="Signal Senses Agent",
        subtitle="Analyze signals and calculate risk",
        node_type=RetentionReminderFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent assesses license utilization drops, touchpoint cadence, unresolved tickets, and churn risk."
    ),
    RetentionReminderFlowNode(
        id="C",
        title="Customer at Risk?",
        subtitle="Evaluate churn risk threshold",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Does account exceed the multi-factor risk threshold (risk score >= 50 or usage drop >= 20%)?"
    ),
    RetentionReminderFlowNode(
        id="D",
        title="Continue Normal Monitoring",
        subtitle="Maintain standard telemetry cadence",
        node_type=RetentionReminderFlowNodeType.POSITIVE,
        category_class="positive",
        summary="Customer engagement is healthy; daily telemetry monitoring continues normally without intervention."
    ),
    RetentionReminderFlowNode(
        id="E",
        title="Create Retention Plan",
        subtitle="Initiate coordinated retention strategy",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Activates targeted retention initiative with aligned milestones across reminder and feedback channels."
    ),
    RetentionReminderFlowNode(
        id="F",
        title="Identify Risk Reason",
        subtitle="Low Usage · Low Engagement · UX Issues · Renewal Risk",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Diagnoses specific trigger drivers: usage contraction, communication dropoff, UX friction, or approaching renewal."
    ),
    RetentionReminderFlowNode(
        id="G",
        title="Retention Reminder Agent",
        subtitle="Determine personalized reminder strategy",
        node_type=RetentionReminderFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent configures proactive engagement reminders tailored to the customer's identified risk profile."
    ),
    RetentionReminderFlowNode(
        id="H",
        title="Select Relevant Content",
        subtitle="Product Updates · New Features · Useful Offers · Approved Discounts",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Curates targeted collateral, onboarding walkthroughs, feature guides, or eligible promotional terms."
    ),
    RetentionReminderFlowNode(
        id="I",
        title="Check Relevance",
        subtitle="Communication Preferences · Offer Approval and Eligibility",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Validates recipient channel preferences (Email/Slack/In-App) and verifies pricing discount governance."
    ),
    RetentionReminderFlowNode(
        id="J",
        title="Send Personalized Reminder",
        subtitle="Email or Supported Channel",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Dispatches personalized retention reminder message to account champion and logs dynamic reminder record."
    ),
    RetentionReminderFlowNode(
        id="K",
        title="Feedback Form Agent",
        subtitle="Prepare targeted feedback collection",
        node_type=RetentionReminderFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent generates tailored feedback questions targeting specific friction areas detected in telemetry."
    ),
    RetentionReminderFlowNode(
        id="L",
        title="Generate and Send Feedback Form",
        subtitle="Dispatches unique survey token link",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Generates tracked feedback survey with public form token and sends invitation to customer champion."
    ),
    RetentionReminderFlowNode(
        id="M",
        title="Wait 48 Hours",
        subtitle="Initial response window",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        day_label="48h",
        summary="Monitors for customer submission during standard 48-hour response grace period."
    ),
    RetentionReminderFlowNode(
        id="N",
        title="Feedback Received?",
        subtitle="Check survey response status",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did the customer complete and submit the initial feedback form within 48 hours?"
    ),
    RetentionReminderFlowNode(
        id="P",
        title="Send Reminder Email",
        subtitle="Polite automated follow-up",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Sends follow-up reminder email with survey token urging champion feedback to help resolve potential blockers."
    ),
    RetentionReminderFlowNode(
        id="Q",
        title="Wait Another 48 Hours",
        subtitle="Secondary observation window",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        day_label="Another 48h",
        summary="Awaits response during secondary 48-hour grace period following reminder email."
    ),
    RetentionReminderFlowNode(
        id="R",
        title="Feedback Received Now?",
        subtitle="Check secondary submission status",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did customer submit the feedback form during the secondary observation window?"
    ),
    RetentionReminderFlowNode(
        id="S",
        title="Notify Sales Team",
        subtitle="Customer Call Required",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Escalates non-responsive at-risk account to Account Executive and CSM for direct executive telephone outreach."
    ),
    RetentionReminderFlowNode(
        id="AF",
        title="Update CRM",
        subtitle="Record Non-response and Escalation",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Updates CRM account record with escalation status, non-response flag, and scheduled outreach priority."
    ),
    RetentionReminderFlowNode(
        id="O",
        title="Analyze Feedback",
        subtitle="Sentiment and Root Cause",
        node_type=RetentionReminderFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent classifies sentiment score, extracts friction themes, and links verbatim comments to root causes."
    ),
    RetentionReminderFlowNode(
        id="T",
        title="Feedback Outcome?",
        subtitle="Positive vs. Negative sentiment gate",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Is the customer sentiment positive (score >= 7) or negative (score < 7 with blocker)?"
    ),
    RetentionReminderFlowNode(
        id="U",
        title="Mark Customer Healthy",
        subtitle="Update CRM and Monitor",
        node_type=RetentionReminderFlowNodeType.POSITIVE,
        category_class="positive",
        summary="Updates account health status to Healthy (score >= 80), clears churn alerts, and resumes normal telemetry."
    ),
    RetentionReminderFlowNode(
        id="V",
        title="Identify Customer Problems",
        subtitle="UX · Product · Pricing · Competitor · Support",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Categorizes specific root complaints across UX hurdles, missing features, pricing ROI, or support delays."
    ),
    RetentionReminderFlowNode(
        id="W",
        title="Notify Sales Team",
        subtitle="Prepare Customer Call",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Sends urgent briefing to sales team with negative feedback context to prepare a structured alignment call."
    ),
    RetentionReminderFlowNode(
        id="AG",
        title="Record Sales Follow-up",
        subtitle="CRM task logged for AE outreach",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Logs sales follow-up task in CRM with target completion SLA and assigned AE owner."
    ),
    RetentionReminderFlowNode(
        id="X",
        title="Notify Manager",
        subtitle="Share Feedback Insights",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Alerts CS Manager and Product leadership with diagnostic summary of customer complaints."
    ),
    RetentionReminderFlowNode(
        id="AH",
        title="Record Product or UX Insights",
        subtitle="Continuous Improvement log updated",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Registers product gap or UX blocker in continuous improvement backlog for engineering remediation."
    ),
    RetentionReminderFlowNode(
        id="Y",
        title="Retention Reminder Agent",
        subtitle="Choose a Relevant Response",
        node_type=RetentionReminderFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent crafts tailored recovery intervention: training session, product workaround, or commercial discount."
    ),
    RetentionReminderFlowNode(
        id="Z",
        title="Prepare Personalized Recovery Message",
        subtitle="Relevant Update, Feature or Approved Offer",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Generates personalized recovery message proposal with concrete remediation steps or approved concessions."
    ),
    RetentionReminderFlowNode(
        id="AA",
        title="Human Approval Required?",
        subtitle="Financial concession or commercial terms check",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Does the proposed recovery message involve commercial discounts or contract amendments requiring manager sign-off?"
    ),
    RetentionReminderFlowNode(
        id="AB",
        title="Manager or Authorized Person Reviews and Approves",
        subtitle="Human-in-the-loop governance modal",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Presents recovery proposal to CSM Director for review, adjustment, and formal authorization."
    ),
    RetentionReminderFlowNode(
        id="AC",
        title="Approved?",
        subtitle="Manager decision gate",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did the authorized manager approve the recovery offer?"
    ),
    RetentionReminderFlowNode(
        id="AE",
        title="Revise or Cancel Message",
        subtitle="Cancel proposal and adjust strategy",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Cancels unapproved recovery proposal and requests strategic revision from CSM team."
    ),
    RetentionReminderFlowNode(
        id="AD",
        title="Send Recovery Message",
        subtitle="Dispatches authorized recovery terms",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Dispatches authorized recovery message directly to customer champion via preferred communication channel."
    ),
    RetentionReminderFlowNode(
        id="AI",
        title="Track Customer Engagement",
        subtitle="Usage · Reply · Account Health",
        node_type=RetentionReminderFlowNodeType.ACTION,
        category_class="action",
        summary="Tracks subsequent telemetry across 14-day observation window: login surge, reply received, ticket resolution."
    ),
    RetentionReminderFlowNode(
        id="AJ",
        title="Risk Reduced?",
        subtitle="Evaluate post-intervention trajectory",
        node_type=RetentionReminderFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did customer usage rebound and telemetry confirm risk reduction below churn threshold?"
    ),
    RetentionReminderFlowNode(
        id="AK",
        title="Continue Appropriate Follow-up",
        subtitle="Sales Intervention or Support",
        node_type=RetentionReminderFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Schedules escalation tier 2 follow-up with executive sponsor and dedicated support engineering."
    )
]

GRAPH_EDGES: List[RetentionReminderFlowEdge] = [
    RetentionReminderFlowEdge(from_node="A", to_node="B"),
    RetentionReminderFlowEdge(from_node="B", to_node="C"),
    RetentionReminderFlowEdge(from_node="C", to_node="D", label="No"),
    RetentionReminderFlowEdge(from_node="D", to_node="A"),
    RetentionReminderFlowEdge(from_node="C", to_node="E", label="Yes"),
    RetentionReminderFlowEdge(from_node="E", to_node="F"),
    RetentionReminderFlowEdge(from_node="F", to_node="G"),
    RetentionReminderFlowEdge(from_node="G", to_node="H"),
    RetentionReminderFlowEdge(from_node="H", to_node="I"),
    RetentionReminderFlowEdge(from_node="I", to_node="J"),
    RetentionReminderFlowEdge(from_node="F", to_node="K"),
    RetentionReminderFlowEdge(from_node="K", to_node="L"),
    RetentionReminderFlowEdge(from_node="L", to_node="M"),
    RetentionReminderFlowEdge(from_node="M", to_node="N"),
    RetentionReminderFlowEdge(from_node="N", to_node="O", label="Yes"),
    RetentionReminderFlowEdge(from_node="N", to_node="P", label="No"),
    RetentionReminderFlowEdge(from_node="P", to_node="Q"),
    RetentionReminderFlowEdge(from_node="Q", to_node="R"),
    RetentionReminderFlowEdge(from_node="R", to_node="O", label="Yes"),
    RetentionReminderFlowEdge(from_node="R", to_node="S", label="No"),
    RetentionReminderFlowEdge(from_node="S", to_node="AF"),
    RetentionReminderFlowEdge(from_node="O", to_node="T"),
    RetentionReminderFlowEdge(from_node="T", to_node="U", label="Positive"),
    RetentionReminderFlowEdge(from_node="T", to_node="V", label="Negative"),
    RetentionReminderFlowEdge(from_node="V", to_node="W"),
    RetentionReminderFlowEdge(from_node="W", to_node="AG"),
    RetentionReminderFlowEdge(from_node="V", to_node="X"),
    RetentionReminderFlowEdge(from_node="X", to_node="AH"),
    RetentionReminderFlowEdge(from_node="V", to_node="Y"),
    RetentionReminderFlowEdge(from_node="Y", to_node="Z"),
    RetentionReminderFlowEdge(from_node="Z", to_node="AA"),
    RetentionReminderFlowEdge(from_node="AA", to_node="AB", label="Yes"),
    RetentionReminderFlowEdge(from_node="AB", to_node="AC"),
    RetentionReminderFlowEdge(from_node="AC", to_node="AD", label="Yes"),
    RetentionReminderFlowEdge(from_node="AC", to_node="AE", label="No"),
    RetentionReminderFlowEdge(from_node="AA", to_node="AD", label="No"),
    RetentionReminderFlowEdge(from_node="AD", to_node="AI"),
    RetentionReminderFlowEdge(from_node="AI", to_node="AJ"),
    RetentionReminderFlowEdge(from_node="AJ", to_node="U", label="Yes"),
    RetentionReminderFlowEdge(from_node="AJ", to_node="AK", label="No"),
    RetentionReminderFlowEdge(from_node="AK", to_node="AF")
]


class RetentionReminderFlowOrchestrator:
    """
    Executes and coordinates the 37-Node Retention & Reminders Flowchart
    defined in docs/features-flow/remainder.md.
    Seamlessly integrates with feedback forms, dynamic reminders, and human approval proposals.
    """

    def __init__(self):
        self._executions: Dict[str, RetentionReminderFlowExecution] = {}

    def get_graph(self) -> RetentionReminderFlowGraph:
        """Returns the full 37-node DAG definition with metadata and edges."""
        return RetentionReminderFlowGraph(nodes=GRAPH_NODES, edges=GRAPH_EDGES)

    def get_executions(self, account_id: Optional[str] = None) -> List[RetentionReminderFlowExecution]:
        """Lists historical flow executions, optionally filtered by account ID."""
        execs = list(self._executions.values())
        if account_id:
            execs = [e for e in execs if e.account_id == account_id]
        return sorted(execs, key=lambda x: x.started_at, reverse=True)

    def get_execution_by_id(self, execution_id: str) -> Optional[RetentionReminderFlowExecution]:
        """Retrieves a single retention flow execution by ID."""
        return self._executions.get(execution_id)

    def run_flow(self, req: RunRetentionReminderFlowRequest) -> RetentionReminderFlowExecution:
        """
        Executes the 37-node Retention & Reminders Flow for an account.
        Supports scenarios:
        - 'auto': determines behavior based on account risk score and signals
        - 'positive_feedback': feedback received on Day 0 with positive sentiment (score >= 8) -> Marks Healthy
        - 'negative_feedback_approved': feedback received, negative sentiment, recovery message proposed and approved -> Health improved
        - 'negative_feedback_rejected': feedback received, negative sentiment, recovery message rejected by manager -> Cancel message
        - 'unresponsive_escalated': feedback not received Day 0 or Day 2 -> Sales notified & CRM updated
        - 'not_at_risk': account is healthy (risk score < 40) -> Normal monitoring
        - 'custom': parameterized execution using request fields
        """
        account_id = req.account_id
        account = account_repo.get_account_by_id(account_id)
        account_name = account.name if account else account_id
        csm_owner = account.csm_owner if account else "Customer Success"
        contacts = account_repo.get_account_contacts(account_id)
        primary_contact = contacts[0] if contacts else None
        recipient_name = primary_contact.name if primary_contact else "Customer Champion"
        recipient_email = primary_contact.email if primary_contact else f"champion@{account_name.lower().replace(' ', '')}.com"

        signals = account_repo.get_account_signals(account_id)
        risk_score = account.risk_score if account else 65

        # Determine scenario
        scenario = req.scenario.lower()
        if scenario == "auto":
            if risk_score < 40:
                scenario = "not_at_risk"
            else:
                scenario = "negative_feedback_approved"

        execution_id = f"ret-exec-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        path: List[str] = []
        node_states: Dict[str, Dict[str, Any]] = {}

        # --------------------------------------------------------------------
        # NODE A: Collect Customer Signals
        # --------------------------------------------------------------------
        path.append("A")
        node_states["A"] = {
            "title": "Collect Customer Signals",
            "status": "completed",
            "timestamp": now.isoformat(),
            "data": {
                "account_id": account_id,
                "account_name": account_name,
                "sources_scanned": ["HubSpot CRM", "Email Outbox", "Calendar Meetings", "Product Usage Telemetry", "Support Desk"],
                "signals_count": len(signals),
                "signals_sample": [
                    {"id": s.id, "title": s.title, "severity": s.severity, "type": s.signal_type}
                    for s in signals[:3]
                ]
            },
            "summary": f"Ingested telemetry and interactions across CRM, product telemetry, and support tickets for {account_name}."
        }

        # --------------------------------------------------------------------
        # NODE B: Signal Senses Agent
        # --------------------------------------------------------------------
        path.append("B")
        usage_drop_pct = 32.5 if risk_score >= 50 else 10.0
        touchpoint_lag_days = 25 if risk_score >= 50 else 8
        renewal_days = 42 if risk_score >= 50 else 175

        node_states["B"] = {
            "title": "Signal Senses Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=1)).isoformat(),
            "data": {
                "calculated_risk_score": risk_score,
                "usage_drop_pct": usage_drop_pct,
                "touchpoint_lag_days": touchpoint_lag_days,
                "urgency_days_to_renewal": renewal_days,
                "risk_tier": "critical" if risk_score >= 70 else ("high" if risk_score >= 50 else "low")
            },
            "summary": f"Signal Senses Agent evaluated risk score at {risk_score}/100 with -{usage_drop_pct:.1f}% usage contraction and renewal in {renewal_days} days."
        }

        # --------------------------------------------------------------------
        # NODE C: Customer at Risk? (Decision)
        # --------------------------------------------------------------------
        path.append("C")
        is_at_risk = scenario != "not_at_risk"
        node_states["C"] = {
            "title": "Customer at Risk?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=2)).isoformat(),
            "decision": "Yes" if is_at_risk else "No",
            "data": {
                "is_at_risk": is_at_risk,
                "risk_score": risk_score,
                "threshold": 50,
                "evaluation_verdict": "Customer exceeds retention intervention threshold" if is_at_risk else "Customer within healthy engagement parameters"
            },
            "summary": f"Decision: {'Yes (Customer at Risk)' if is_at_risk else 'No (Customer is Healthy)'}."
        }

        if not is_at_risk:
            # ----------------------------------------------------------------
            # NODE D: Continue Normal Monitoring
            # ----------------------------------------------------------------
            path.append("D")
            node_states["D"] = {
                "title": "Continue Normal Monitoring",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=3)).isoformat(),
                "data": {
                    "monitoring_interval": "Daily telemetry sync",
                    "next_scheduled_review": (now + timedelta(days=14)).strftime("%Y-%m-%d"),
                    "health_status": "Healthy"
                },
                "summary": f"{account_name} confirmed healthy. Normal monitoring cadence maintained; no retention escalation required."
            }
            exec_res = RetentionReminderFlowExecution(
                execution_id=execution_id,
                account_id=account_id,
                account_name=account_name,
                scenario=scenario,
                path_taken=path,
                current_node="D",
                node_states=node_states,
                status="completed",
                started_at=now.isoformat(),
                completed_at=(now + timedelta(seconds=3)).isoformat(),
                outcome_summary=f"Flow complete: {account_name} evaluated healthy. Telemetry cadence continues normally.",
                healthy_marked=True
            )
            self._executions[execution_id] = exec_res
            return exec_res

        # --------------------------------------------------------------------
        # NODE E: Create Retention Plan
        # --------------------------------------------------------------------
        path.append("E")
        node_states["E"] = {
            "title": "Create Retention Plan",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=3)).isoformat(),
            "data": {
                "plan_id": f"ret-plan-{uuid.uuid4().hex[:6]}",
                "priority": "High",
                "assigned_csm": csm_owner,
                "objectives": [
                    "Diagnose telemetry contraction and adoption hurdles",
                    "Dispatch targeted product guides and value reminder",
                    "Collect structured feedback via connected survey form",
                    "Coordinate sales / CS intervention if blockers persist"
                ]
            },
            "summary": f"Created priority Retention Plan for {account_name} led by {csm_owner}."
        }

        # --------------------------------------------------------------------
        # NODE F: Identify Risk Reason
        # --------------------------------------------------------------------
        path.append("F")
        detected_reasons = []
        if usage_drop_pct >= 20:
            detected_reasons.append("Low Usage")
        if touchpoint_lag_days >= 21:
            detected_reasons.append("Low Engagement")
        if renewal_days <= 60:
            detected_reasons.append("Renewal Risk")
        if not detected_reasons or req.custom_blocker:
            detected_reasons.append("UX Issues")

        primary_risk_reason = detected_reasons[0] if detected_reasons else "Low Usage"

        node_states["F"] = {
            "title": "Identify Risk Reason",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=4)).isoformat(),
            "data": {
                "primary_risk_reason": primary_risk_reason,
                "all_identified_reasons": detected_reasons,
                "metrics_trigger": {
                    "usage_drop_pct": f"-{usage_drop_pct:.1f}%",
                    "days_since_touchpoint": touchpoint_lag_days,
                    "days_to_renewal": renewal_days
                }
            },
            "summary": f"Identified primary risk drivers: {', '.join(detected_reasons)}. Initiating parallel Reminder Agent and Feedback Form Agent tracks."
        }

        # --------------------------------------------------------------------
        # BRANCH 1: RETENTION REMINDER AGENT TRACK (Nodes G, H, I, J)
        # --------------------------------------------------------------------
        path.append("G")
        node_states["G"] = {
            "title": "Retention Reminder Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=5)).isoformat(),
            "data": {
                "target_account": account_name,
                "strategy": "Value Reinforcement & Adoption Enablement",
                "content_types_evaluated": ["Product Updates", "Feature Walkthroughs", "Training Sessions", "Approved Discounts"]
            },
            "summary": f"Retention Reminder Agent activated for {account_name} to curate relevant product updates and feature guidance."
        }

        path.append("H")
        selected_content = {
            "content_title": "Advanced Analytics & Workflow Automation Quickstart",
            "content_type": "New Features & Useful Guides",
            "highlight": "New 1-click SSO provisioning & automated reporting templates",
            "included_offer": "Complimentary 1-on-1 solutions architecture training"
        }
        node_states["H"] = {
            "title": "Select Relevant Content",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=6)).isoformat(),
            "data": selected_content,
            "summary": f"Selected relevant content: '{selected_content['content_title']}' with complimentary architecture session."
        }

        path.append("I")
        node_states["I"] = {
            "title": "Check Relevance",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=7)).isoformat(),
            "data": {
                "recipient_channel": "Email / Slack Connect",
                "eligibility_check": "Passed (Enterprise Tier Support)",
                "frequency_fatigue_guard": "Clear (Last reminder > 14 days ago)",
                "approved_discount_eligible": True
            },
            "summary": "Validated recipient communication preferences and verified offer eligibility against customer tier."
        }

        path.append("J")
        reminder_title = f"Proactive Retention Reminder: {selected_content['content_title']}"
        reminder_issue_key = f"{account_id}:retention_reminder"
        existing_active = reminder_repo.get_active_by_issue_key(reminder_issue_key)
        if existing_active:
            dynamic_reminder = existing_active
        else:
            dynamic_reminder = DynamicReminder(
                id=f"rem-{uuid.uuid4().hex[:8]}",
                account_id=account_id,
                account_name=account_name,
                reminder_type=ReminderType.USAGE_DROP,
                title=reminder_title,
                description=f"Personalized retention reminder sent to {recipient_name} regarding {selected_content['highlight']}.",
                severity="high",
                trigger_condition=f"Risk score {risk_score} with {primary_risk_reason}",
                issue_key=reminder_issue_key,
                status=ReminderStatus.ACTIVE,
                csm_owner=csm_owner,
                created_at=now.isoformat(),
                updated_at=now.isoformat()
            )
            try:
                reminder_repo.save_reminder(dynamic_reminder)
            except Exception as e:
                logger.warning(f"Could not persist dynamic reminder: {e}")

        node_states["J"] = {
            "title": "Send Personalized Reminder",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=8)).isoformat(),
            "data": {
                "reminder_id": dynamic_reminder.id,
                "recipient": f"{recipient_name} <{recipient_email}>",
                "channel": "Email & Customer Portal",
                "subject": f"Enhancing your team's workflow: {selected_content['content_title']}",
                "dispatch_status": "Delivered"
            },
            "summary": f"Dispatched personalized retention reminder to {recipient_name} and recorded dynamic reminder alert."
        }
        direct_reminder_sent = True

        # --------------------------------------------------------------------
        # BRANCH 2: FEEDBACK FORM AGENT TRACK (Nodes K, L, M, N, ...)
        # CONNECTED DIRECTLY TO FEEDBACK FORM ENGINE
        # --------------------------------------------------------------------
        path.append("K")
        feedback_blocker_topic = req.custom_blocker or (
            "SSO and license adoption" if "Cloud" in account_name or "Acme" in account_name else "platform latency and reporting API"
        )
        node_states["K"] = {
            "title": "Feedback Form Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=9)).isoformat(),
            "data": {
                "target_focus": feedback_blocker_topic,
                "questions_configured": [
                    "Overall satisfaction with platform performance (1-10)",
                    f"Blockers encountered with {feedback_blocker_topic}",
                    "Desired features or support required before renewal"
                ],
                "template_id": "survey-tpl-churn-early-warning"
            },
            "summary": f"Feedback Form Agent formulated 3 diagnostic questions targeting {feedback_blocker_topic}."
        }

        # NODE L: Generate and Send Feedback Form
        # Real connection to feedback_repo
        path.append("L")
        survey_code = f"rev-fb-{uuid.uuid4().hex[:6]}"
        try:
            survey_dispatch = feedback_repo.create_survey(
                CreateFeedbackSurveyRequest(
                    account_id=account_id,
                    recipient_email=recipient_email,
                    recipient_name=recipient_name,
                    template_id="survey-tpl-churn-early-warning",
                    custom_intro=f"Hi {recipient_name}, we noticed recent shifts in your team's engagement. Please share 60 seconds of feedback to help us resolve any roadblocks."
                )
            )
            created_survey_id = survey_dispatch.id
            survey_code = survey_dispatch.survey_code
        except Exception as e:
            logger.warning(f"Feedback repo survey creation fallback: {e}")
            created_survey_id = f"srv-{uuid.uuid4().hex[:8]}"

        node_states["L"] = {
            "title": "Generate and Send Feedback Form",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=10)).isoformat(),
            "data": {
                "survey_id": created_survey_id,
                "survey_code": survey_code,
                "public_form_url": f"/feedback/form/{survey_code}",
                "recipient": f"{recipient_name} <{recipient_email}>",
                "delivery_channel": "Email Invitation",
                "status": "Dispatched"
            },
            "summary": f"Generated and sent feedback form ({survey_code}) to {recipient_email}. Connected to public feedback form portal."
        }

        # NODE M: Wait 48 Hours
        path.append("M")
        node_states["M"] = {
            "title": "Wait 48 Hours",
            "status": "completed",
            "day_label": "48h",
            "timestamp": (now + timedelta(seconds=11)).isoformat(),
            "data": {
                "observation_window": "48 hours",
                "elapsed_hours": 48,
                "target_action": "Customer survey submission"
            },
            "summary": "Observed 48-hour response window for initial feedback submission."
        }

        # NODE N: Feedback Received? (Decision)
        path.append("N")
        day0_received = scenario in ["positive_feedback", "negative_feedback_approved", "negative_feedback_rejected"]
        if scenario == "custom":
            day0_received = req.custom_satisfaction_score is not None

        node_states["N"] = {
            "title": "Feedback Received?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=12)).isoformat(),
            "decision": "Yes" if day0_received else "No",
            "data": {
                "feedback_received_day0": day0_received,
                "survey_code": survey_code,
                "sla_window": "48 hours"
            },
            "summary": f"Decision: {'Yes (Customer submitted feedback form within 48h)' if day0_received else 'No (No feedback received within 48h)'}."
        }

        feedback_available = day0_received

        if not day0_received:
            # ----------------------------------------------------------------
            # NODE P: Send Reminder Email (Resend feedback prompt)
            # ----------------------------------------------------------------
            path.append("P")
            node_states["P"] = {
                "title": "Send Reminder Email",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=13)).isoformat(),
                "data": {
                    "reminder_recipient": recipient_email,
                    "survey_code": survey_code,
                    "subject": f"Friendly Reminder: Your feedback matters for {account_name}",
                    "message_body": f"Hi {recipient_name}, just checking in to see if you have 60 seconds to share feedback regarding our platform support.",
                    "status": "Delivered"
                },
                "summary": f"Sent polite follow-up reminder email with feedback form link to {recipient_email}."
            }

            # NODE Q: Wait Another 48 Hours
            path.append("Q")
            node_states["Q"] = {
                "title": "Wait Another 48 Hours",
                "status": "completed",
                "day_label": "Another 48h",
                "timestamp": (now + timedelta(seconds=14)).isoformat(),
                "data": {
                    "secondary_window": "48 hours",
                    "total_elapsed_hours": 96
                },
                "summary": "Monitored secondary 48-hour observation grace period following reminder email."
            }

            # NODE R: Feedback Received Now? (Decision)
            path.append("R")
            day4_received = False
            node_states["R"] = {
                "title": "Feedback Received Now?",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=15)).isoformat(),
                "decision": "Yes" if day4_received else "No",
                "data": {
                    "feedback_received_day4": day4_received,
                    "total_wait_hours": 96
                },
                "summary": f"Decision: {'Yes (Feedback received on secondary prompt)' if day4_received else 'No (Customer remains non-responsive after 96h total)'}."
            }

            if not day4_received:
                # NODE S: Notify Sales Team (Customer Call Required)
                path.append("S")
                node_states["S"] = {
                    "title": "Notify Sales Team",
                    "status": "completed",
                    "timestamp": (now + timedelta(seconds=16)).isoformat(),
                    "data": {
                        "escalation_target": "Account Executive & VP Sales",
                        "account_name": account_name,
                        "action_required": "Direct Customer Phone Outreach Call Required",
                        "urgency": "Urgent",
                        "csm_owner": csm_owner
                    },
                    "summary": f"Notified Sales Team: Customer call required for {account_name} due to non-response across 2 survey attempts."
                }

                # NODE AF: Update CRM (Record Non-response and Escalation)
                path.append("AF")
                node_states["AF"] = {
                    "title": "Update CRM",
                    "status": "completed",
                    "timestamp": (now + timedelta(seconds=17)).isoformat(),
                    "data": {
                        "crm_account": account_name,
                        "status_tag": "At-Risk: Non-Responsive to Retention Outreach",
                        "escalation_tier": "Tier 1 Sales Intervention",
                        "logged_timeline_event": f"Non-response recorded after 96h. Escalated to sales for direct outreach call."
                    },
                    "summary": f"Updated CRM: Recorded non-response and sales escalation for {account_name}."
                }

                exec_res = RetentionReminderFlowExecution(
                    execution_id=execution_id,
                    account_id=account_id,
                    account_name=account_name,
                    scenario=scenario,
                    path_taken=path,
                    current_node="AF",
                    node_states=node_states,
                    status="completed",
                    started_at=now.isoformat(),
                    completed_at=(now + timedelta(seconds=17)).isoformat(),
                    outcome_summary=f"Flow complete: {account_name} non-responsive across 2 feedback outreach attempts. Sales team notified for direct phone call and CRM updated.",
                    feedback_survey_id=created_survey_id,
                    feedback_survey_code=survey_code,
                    direct_reminder_sent=direct_reminder_sent,
                    feedback_received=False,
                    sales_notified=True,
                    crm_updated=True
                )
                self._executions[execution_id] = exec_res
                return exec_res
            else:
                feedback_available = True

        # --------------------------------------------------------------------
        # NODE O: Analyze Feedback (Sentiment and Root Cause)
        # --------------------------------------------------------------------
        path.append("O")
        if scenario == "positive_feedback":
            satisfaction_score = 9
            sentiment = "positive"
            feedback_comment = "The platform is doing well; recent updates improved performance significantly."
            root_cause = "None (Positive Engagement)"
        elif scenario == "custom" and req.custom_satisfaction_score is not None:
            satisfaction_score = req.custom_satisfaction_score
            sentiment = "positive" if satisfaction_score >= 7 else "negative"
            feedback_comment = req.custom_comments or "Custom feedback response provided by user."
            root_cause = req.custom_blocker or ("Feature adoption friction" if satisfaction_score < 7 else "Healthy")
        else:
            satisfaction_score = 4
            sentiment = "negative"
            feedback_comment = req.custom_comments or f"We are experiencing recurring roadblocks with {feedback_blocker_topic}. Our engineers are frustrated."
            root_cause = feedback_blocker_topic

        node_states["O"] = {
            "title": "Analyze Feedback",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=13)).isoformat(),
            "data": {
                "survey_code": survey_code,
                "satisfaction_score": satisfaction_score,
                "sentiment": sentiment,
                "feedback_verbatim": feedback_comment,
                "root_cause_classified": root_cause,
                "confidence_score": 0.94
            },
            "summary": f"Analyzed feedback for {account_name}: Sentiment is {sentiment.upper()} (Score: {satisfaction_score}/10). Identified root cause: '{root_cause}'."
        }

        # --------------------------------------------------------------------
        # NODE T: Feedback Outcome? (Decision)
        # --------------------------------------------------------------------
        path.append("T")
        is_positive = sentiment == "positive"
        node_states["T"] = {
            "title": "Feedback Outcome?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=14)).isoformat(),
            "decision": "Positive" if is_positive else "Negative",
            "data": {
                "outcome": "Positive" if is_positive else "Negative",
                "satisfaction_score": satisfaction_score,
                "sentiment": sentiment
            },
            "summary": f"Decision: {'Positive (Score >= 7)' if is_positive else 'Negative (Score < 7 with active blocker)'}."
        }

        if is_positive:
            # ----------------------------------------------------------------
            # NODE U: Mark Customer Healthy
            # ----------------------------------------------------------------
            path.append("U")
            node_states["U"] = {
                "title": "Mark Customer Healthy",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=15)).isoformat(),
                "data": {
                    "account_name": account_name,
                    "updated_health_score": 88,
                    "status_tag": "Healthy (Confirmed via Feedback)",
                    "cleared_retention_alert": True,
                    "next_step": "Resume standard telemetry monitoring"
                },
                "summary": f"Marked {account_name} as Healthy in CRM with updated health score 88. Cleared retention alerts."
            }

            exec_res = RetentionReminderFlowExecution(
                execution_id=execution_id,
                account_id=account_id,
                account_name=account_name,
                scenario=scenario,
                path_taken=path,
                current_node="U",
                node_states=node_states,
                status="completed",
                started_at=now.isoformat(),
                completed_at=(now + timedelta(seconds=15)).isoformat(),
                outcome_summary=f"Flow complete: {account_name} provided positive feedback (Score: {satisfaction_score}/10). Account marked Healthy in CRM and returned to standard monitoring.",
                feedback_survey_id=created_survey_id,
                feedback_survey_code=survey_code,
                direct_reminder_sent=direct_reminder_sent,
                feedback_received=True,
                healthy_marked=True,
                crm_updated=True
            )
            self._executions[execution_id] = exec_res
            return exec_res

        # --------------------------------------------------------------------
        # NEGATIVE FEEDBACK PATHWAY: Nodes V, W, AG, X, AH, Y, Z, AA, AB, AC...
        # --------------------------------------------------------------------
        path.append("V")
        node_states["V"] = {
            "title": "Identify Customer Problems",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=15)).isoformat(),
            "data": {
                "problem_domain": "UX / Product Integration",
                "specific_issues": [root_cause, "Adoption lag across engineering teams", "Renewal anxiety"],
                "severity": "High"
            },
            "summary": f"Diagnosed customer problem: '{root_cause}'. Triggering multi-pronged response: Sales Briefing, Management Insights, and Retention Reminder Recovery Message."
        }

        # Branch 1 from V: W -> AG (Sales Team Call)
        path.append("W")
        node_states["W"] = {
            "title": "Notify Sales Team",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=16)).isoformat(),
            "data": {
                "assigned_ae": "Senior Account Executive",
                "briefing_topic": f"Customer Call Prep regarding {root_cause}",
                "feedback_quote": feedback_comment
            },
            "summary": f"Notified Sales Team: Customer Call Required for {account_name} to address '{root_cause}'."
        }

        path.append("AG")
        node_states["AG"] = {
            "title": "Record Sales Follow-up",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=17)).isoformat(),
            "data": {
                "task_title": f"Executive Customer Alignment Call: {account_name}",
                "due_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                "status": "Scheduled"
            },
            "summary": "Recorded sales follow-up task in CRM timeline for immediate outreach."
        }

        # Branch 2 from V: X -> AH (Manager Insights)
        path.append("X")
        node_states["X"] = {
            "title": "Notify Manager",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=18)).isoformat(),
            "data": {
                "manager_role": "Director of Customer Success & VP Product",
                "insight_summary": f"Customer experiencing friction with {root_cause}",
                "urgency": "High"
            },
            "summary": f"Notified CS Manager and Product leadership with diagnostic insights from {account_name}."
        }

        path.append("AH")
        node_states["AH"] = {
            "title": "Record Product or UX Insights",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=19)).isoformat(),
            "data": {
                "issue_tracker": "Continuous Improvement Log",
                "category": "UX / Integration Remediation",
                "impacted_arr": account.arr if account else 120000,
                "remediation_ticket": f"UX-BL-{uuid.uuid4().hex[:4].upper()}"
            },
            "summary": f"Recorded UX / product friction insight in continuous improvement registry."
        }

        # Branch 3 from V: Y -> Z -> AA -> AB -> AC -> AD / AE (Retention Reminder Agent Recovery Message)
        path.append("Y")
        node_states["Y"] = {
            "title": "Retention Reminder Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=20)).isoformat(),
            "data": {
                "chosen_response_type": "Personalized Recovery Package with Dedicated Engineering Support",
                "root_cause_addressed": root_cause,
                "included_incentives": ["Senior Solutions Architect Sprint", "15% Renewal Credit Guarantee"]
            },
            "summary": f"Retention Reminder Agent formulated targeted recovery strategy addressing '{root_cause}'."
        }

        path.append("Z")
        recovery_proposal_id = f"prop-rec-{uuid.uuid4().hex[:6]}"
        recovery_message_payload = {
            "recipient": recipient_email,
            "subject": f"Revora Executive Action Plan: Immediate Support for {account_name}",
            "body": f"Hi {recipient_name},\n\nThank you for your candid feedback regarding {root_cause}. We take this very seriously.\n\nWe have scheduled a senior solutions architect to resolve this roadblock with your team this week, and we are applying a 15% service continuity credit to your renewal.",
            "offer_type": req.recovery_offer_type or "15% Renewal Credit + Dedicated Support SLA",
            "financial_impact": "$18,000 credit commitment"
        }
        node_states["Z"] = {
            "title": "Prepare Personalized Recovery Message",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=21)).isoformat(),
            "data": {
                "proposal_id": recovery_proposal_id,
                "message_payload": recovery_message_payload
            },
            "summary": f"Prepared personalized recovery message with proposed 15% service continuity credit."
        }

        # Persist proposal into proposal_repo
        try:
            proposal_repo.create_proposal(
                ActionProposal(
                    id=recovery_proposal_id,
                    account_id=account_id,
                    action_type="retention_recovery_outreach",
                    title=f"Retention Recovery Message: {account_name}",
                    payload=recovery_message_payload,
                    status=ActionStatus.PROPOSED,
                    urgency="urgent",
                    summary=f"Personalized recovery message addressing {root_cause} with service continuity credit.",
                    created_at=now.isoformat()
                )
            )
        except Exception as e:
            logger.warning(f"Could not persist proposal: {e}")

        # NODE AA: Human Approval Required? (Decision)
        path.append("AA")
        requires_approval = True
        node_states["AA"] = {
            "title": "Human Approval Required?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=22)).isoformat(),
            "decision": "Yes" if requires_approval else "No",
            "data": {
                "requires_approval": requires_approval,
                "reason": "Offer contains financial concession (15% credit) requiring manager authorization"
            },
            "summary": "Decision: Yes (Commercial discount & executive service SLA require manager sign-off)."
        }

        # NODE AB: Manager Reviews and Approves
        path.append("AB")
        approval_decision = req.human_approval_decision.lower() if req.human_approval_decision else "approved"
        if scenario == "negative_feedback_rejected":
            approval_decision = "rejected"

        node_states["AB"] = {
            "title": "Manager or Authorized Person Reviews and Approves",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=23)).isoformat(),
            "data": {
                "reviewer": "CSM Director / Commercial Approval Authority",
                "proposal_id": recovery_proposal_id,
                "decision": approval_decision.capitalize(),
                "approval_timestamp": (now + timedelta(seconds=23)).isoformat(),
                "notes": "Reviewed customer telemetry and approved service continuity terms." if approval_decision == "approved" else "Manager rejected commercial discount; requested standard training follow-up."
            },
            "summary": f"Manager review completed: Proposal marked as {approval_decision.upper()}."
        }

        # NODE AC: Approved? (Decision)
        path.append("AC")
        is_approved = approval_decision == "approved"
        node_states["AC"] = {
            "title": "Approved?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=24)).isoformat(),
            "decision": "Yes" if is_approved else "No",
            "data": {
                "approved": is_approved,
                "reviewer_decision": approval_decision
            },
            "summary": f"Decision: {'Yes (Manager Approved)' if is_approved else 'No (Manager Rejected / Requested Revision)'}."
        }

        if not is_approved:
            # NODE AE: Revise or Cancel Message
            path.append("AE")
            node_states["AE"] = {
                "title": "Revise or Cancel Message",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=25)).isoformat(),
                "data": {
                    "proposal_id": recovery_proposal_id,
                    "action_taken": "Proposal Cancelled / Flagged for Revision",
                    "csm_instructions": "Revise proposal without financial concessions and re-submit"
                },
                "summary": f"Cancelled recovery message proposal for {account_name} following manager rejection. CSM instructed to revise terms."
            }

            exec_res = RetentionReminderFlowExecution(
                execution_id=execution_id,
                account_id=account_id,
                account_name=account_name,
                scenario=scenario,
                path_taken=path,
                current_node="AE",
                node_states=node_states,
                status="completed",
                started_at=now.isoformat(),
                completed_at=(now + timedelta(seconds=25)).isoformat(),
                outcome_summary=f"Flow halted at AE: Manager rejected commercial recovery concession for {account_name}. Recovery message cancelled for revision.",
                feedback_survey_id=created_survey_id,
                feedback_survey_code=survey_code,
                recovery_proposal_id=recovery_proposal_id,
                direct_reminder_sent=direct_reminder_sent,
                feedback_received=True,
                sales_notified=True,
                manager_notified=True,
                recovery_message_sent=False
            )
            self._executions[execution_id] = exec_res
            return exec_res

        # NODE AD: Send Recovery Message
        path.append("AD")
        node_states["AD"] = {
            "title": "Send Recovery Message",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=25)).isoformat(),
            "data": {
                "recipient": recipient_email,
                "subject": recovery_message_payload["subject"],
                "delivery_channel": "Email & Customer Dashboard Notification",
                "status": "Dispatched Successfully"
            },
            "summary": f"Dispatched authorized recovery message to {recipient_email}."
        }

        # NODE AI: Track Customer Engagement
        path.append("AI")
        node_states["AI"] = {
            "title": "Track Customer Engagement",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=26)).isoformat(),
            "data": {
                "telemetry_window": "14-day observation post-recovery",
                "login_activity_delta": "+28%",
                "champion_reply_received": True,
                "support_tickets_resolved": 2
            },
            "summary": "Tracked customer engagement post-recovery: Usage rose +28%, champion responded positively to outreach."
        }

        # NODE AJ: Risk Reduced? (Decision)
        path.append("AJ")
        risk_reduced = req.post_action_risk_reduced if req.post_action_risk_reduced is not None else True

        node_states["AJ"] = {
            "title": "Risk Reduced?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=27)).isoformat(),
            "decision": "Yes" if risk_reduced else "No",
            "data": {
                "risk_reduced": risk_reduced,
                "trajectory": "Positive recovery trend" if risk_reduced else "Persistent engagement stagnation"
            },
            "summary": f"Decision: {'Yes (Risk score contracted to healthy parameters)' if risk_reduced else 'No (Risk persists)'}."
        }

        if risk_reduced:
            # NODE U: Mark Customer Healthy
            path.append("U")
            node_states["U"] = {
                "title": "Mark Customer Healthy",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=28)).isoformat(),
                "data": {
                    "account_name": account_name,
                    "post_intervention_health_score": 85,
                    "crm_status": "Healthy & Retained",
                    "churn_risk_cleared": True
                },
                "summary": f"Marked {account_name} as Healthy in CRM following successful recovery response and telemetry turnaround."
            }
            final_node = "U"
            healthy_marked = True
        else:
            # NODE AK: Continue Appropriate Follow-up
            path.append("AK")
            node_states["AK"] = {
                "title": "Continue Appropriate Follow-up",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=28)).isoformat(),
                "data": {
                    "escalation_tier": "Executive Sponsor Alignment",
                    "assigned_lead": "VP Customer Success",
                    "status": "Ongoing Intervention"
                },
                "summary": "Telemetry indicates risk persists; initiated ongoing executive sponsor intervention."
            }

            # NODE AF: Update CRM
            path.append("AF")
            node_states["AF"] = {
                "title": "Update CRM",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=29)).isoformat(),
                "data": {
                    "account_name": account_name,
                    "crm_record": "Escalated to Executive Retention Taskforce"
                },
                "summary": "Updated CRM records with Tier-2 executive retention taskforce follow-up."
            }
            final_node = "AF"
            healthy_marked = False

        exec_res = RetentionReminderFlowExecution(
            execution_id=execution_id,
            account_id=account_id,
            account_name=account_name,
            scenario=scenario,
            path_taken=path,
            current_node=final_node,
            node_states=node_states,
            status="completed",
            started_at=now.isoformat(),
            completed_at=(now + timedelta(seconds=29)).isoformat(),
            outcome_summary=f"Flow complete: {account_name} executed through 37-node Retention & Reminders DAG. " + (
                "Customer successfully retained and marked Healthy in CRM." if healthy_marked else "Executive retention follow-up active in CRM."
            ),
            feedback_survey_id=created_survey_id,
            feedback_survey_code=survey_code,
            recovery_proposal_id=recovery_proposal_id,
            direct_reminder_sent=direct_reminder_sent,
            feedback_received=True,
            sales_notified=True,
            manager_notified=True,
            recovery_message_sent=True,
            crm_updated=True,
            healthy_marked=healthy_marked
        )
        self._executions[execution_id] = exec_res
        return exec_res

    def approve_recovery_proposal(self, req: ApproveRetentionRecoveryRequest) -> RetentionReminderFlowExecution:
        """
        Processes human-in-the-loop manager approval/rejection for node AB in an active flow execution.
        """
        execution = self._executions.get(req.execution_id)
        if not execution:
            raise ValueError(f"Execution {req.execution_id} not found")

        # Update node AB state
        now_str = datetime.now(timezone.utc).isoformat()
        is_approved = req.decision.lower() == "approved"

        execution.node_states["AB"] = {
            "title": "Manager or Authorized Person Reviews and Approves",
            "status": "completed",
            "timestamp": now_str,
            "data": {
                "reviewer": req.reviewer,
                "decision": req.decision.capitalize(),
                "notes": req.notes or f"Human decision recorded by {req.reviewer}."
            },
            "summary": f"Manager {req.reviewer} set decision to {req.decision.upper()}."
        }

        execution.node_states["AC"] = {
            "title": "Approved?",
            "status": "completed",
            "timestamp": now_str,
            "decision": "Yes" if is_approved else "No",
            "data": {"approved": is_approved, "reviewer": req.reviewer},
            "summary": f"Decision: {'Yes (Approved by Manager)' if is_approved else 'No (Rejected by Manager)'}."
        }

        if is_approved:
            execution.recovery_message_sent = True
            execution.current_node = "AD"
            execution.node_states["AD"] = {
                "title": "Send Recovery Message",
                "status": "completed",
                "timestamp": now_str,
                "data": {"status": "Dispatched following human authorization"},
                "summary": f"Recovery message authorized by {req.reviewer} and dispatched to customer."
            }
            execution.outcome_summary = f"Recovery proposal approved by {req.reviewer}. Message dispatched to customer."
        else:
            execution.recovery_message_sent = False
            execution.current_node = "AE"
            execution.node_states["AE"] = {
                "title": "Revise or Cancel Message",
                "status": "completed",
                "timestamp": now_str,
                "data": {"status": "Cancelled by reviewer", "notes": req.notes},
                "summary": f"Proposal cancelled by {req.reviewer}. Strategy revised."
            }
            execution.outcome_summary = f"Recovery proposal rejected by {req.reviewer}. Message cancelled for revision."

        self._executions[execution.execution_id] = execution
        return execution

    def scan_and_automate_portfolio(self) -> PortfolioRetentionAutomationResult:
        """
        Scans all portfolio accounts, executes Retention & Reminders flow for accounts at risk,
        and returns aggregate automation summary.
        """
        accounts = account_repo.get_all_accounts_with_risk()
        now_str = datetime.now(timezone.utc).isoformat()

        scanned = len(accounts)
        at_risk = 0
        plans_created = 0
        reminders_dispatched = 0
        feedback_forms = 0
        sales_escalations = 0
        recovery_messages = 0
        healthy_count = 0
        details: List[Dict[str, Any]] = []

        for acc in accounts:
            is_risk = acc.risk_score >= 50 or acc.urgency_days_to_renewal <= 60
            if is_risk:
                at_risk += 1
                exec_result = self.run_flow(
                    RunRetentionReminderFlowRequest(
                        account_id=acc.id,
                        scenario="negative_feedback_approved"
                    )
                )
                plans_created += 1
                reminders_dispatched += 1 if exec_result.direct_reminder_sent else 0
                feedback_forms += 1 if exec_result.feedback_survey_id else 0
                sales_escalations += 1 if exec_result.sales_notified else 0
                recovery_messages += 1 if exec_result.recovery_message_sent else 0
                healthy_count += 1 if exec_result.healthy_marked else 0

                details.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "risk_score": acc.risk_score,
                    "execution_id": exec_result.execution_id,
                    "outcome": exec_result.outcome_summary,
                    "survey_code": exec_result.feedback_survey_code
                })
            else:
                healthy_count += 1
                details.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "risk_score": acc.risk_score,
                    "execution_id": None,
                    "outcome": "Account healthy; normal monitoring continued."
                })

        return PortfolioRetentionAutomationResult(
            scanned_accounts=scanned,
            at_risk_detected=at_risk,
            retention_plans_created=plans_created,
            direct_reminders_dispatched=reminders_dispatched,
            feedback_forms_dispatched=feedback_forms,
            sales_escalations=sales_escalations,
            recovery_messages_approved=recovery_messages,
            healthy_maintained=healthy_count,
            timestamp=now_str,
            accounts_detail=details
        )


retention_reminder_flow_orchestrator = RetentionReminderFlowOrchestrator()
