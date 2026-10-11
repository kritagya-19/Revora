import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.models.schemas import (
    FeedbackFlowNode,
    FeedbackFlowEdge,
    FeedbackFlowGraph,
    FeedbackFlowExecution,
    FeedbackFlowNodeType,
    RunFeedbackFlowRequest,
    TimelineEvent,
    TimelineEventType,
    ActionProposal,
    ActionStatus
)
from app.services.account_repository import account_repo
from app.services.proposal_repository import proposal_repo
from app.services.feedback_repository import feedback_repo
from app.core.llm_client import llm_client

logger = logging.getLogger("revora.feedback_flow_orchestrator")

GRAPH_NODES = [
    FeedbackFlowNode(
        id="A",
        title="Collect Customer Signals",
        subtitle="CRM · Email · Calendar · Product Usage · Conversations",
        node_type=FeedbackFlowNodeType.SOURCE,
        category_class="source",
        summary="Aggregates multi-source operational signals across CRM, telemetry, email, and meetings."
    ),
    FeedbackFlowNode(
        id="B",
        title="Signal Analysis Agent",
        subtitle="Detect declining usage, low engagement and renewal risk",
        node_type=FeedbackFlowNodeType.AGENT,
        category_class="agent",
        summary="AI agent assesses usage contraction, touchpoint lag, and renewal horizon."
    ),
    FeedbackFlowNode(
        id="C",
        title="Customer at Risk?",
        subtitle="Evaluate churn criteria threshold",
        node_type=FeedbackFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Does account exceed the multi-factor risk threshold?"
    ),
    FeedbackFlowNode(
        id="D",
        title="Continue Normal Monitoring",
        subtitle="Maintain standard telemetry cadence",
        node_type=FeedbackFlowNodeType.ACTION,
        category_class="action",
        summary="Customer engagement is healthy; portfolio tracking continues normally."
    ),
    FeedbackFlowNode(
        id="E",
        title="Feedback Agent",
        subtitle="Generate Personalized Feedback Form",
        node_type=FeedbackFlowNodeType.AGENT,
        category_class="agent",
        summary="AI crafts personalized survey questions addressing account-specific signals."
    ),
    FeedbackFlowNode(
        id="F",
        title="Send Feedback Form",
        subtitle="Day 0",
        node_type=FeedbackFlowNodeType.SOURCE,
        category_class="source",
        day_label="Day 0",
        summary="Dispatches personalized survey invitation with tracked token to customer."
    ),
    FeedbackFlowNode(
        id="G",
        title="Wait 48 Hours",
        subtitle="Initial engagement window",
        node_type=FeedbackFlowNodeType.ACTION,
        category_class="action",
        day_label="48h",
        summary="Observes customer response across standard 48-hour SLA."
    ),
    FeedbackFlowNode(
        id="H",
        title="Feedback Form Submitted?",
        subtitle="Check Day 0 response status",
        node_type=FeedbackFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did the customer fill out and submit the initial survey?"
    ),
    FeedbackFlowNode(
        id="Q",
        title="Send Reminder Email",
        subtitle="Day 2",
        node_type=FeedbackFlowNodeType.SOURCE,
        category_class="source",
        day_label="Day 2",
        summary="Sends automated polite reminder emphasizing support availability."
    ),
    FeedbackFlowNode(
        id="R",
        title="Wait Another 48 Hours",
        subtitle="Extended engagement window",
        node_type=FeedbackFlowNodeType.ACTION,
        category_class="action",
        day_label="48h",
        summary="Awaits response following Day 2 reminder outreach."
    ),
    FeedbackFlowNode(
        id="S",
        title="Feedback Received After Reminder?",
        subtitle="Check Day 4 response status",
        node_type=FeedbackFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Did the customer respond after the reminder email?"
    ),
    FeedbackFlowNode(
        id="T",
        title="Notify Sales Team",
        subtitle="Request Customer Call · Share Risk Context",
        node_type=FeedbackFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Escalation: Unresponsive at-risk customer flagged for urgent Sales outreach call."
    ),
    FeedbackFlowNode(
        id="I",
        title="Analyze Feedback",
        subtitle="Sentiment and Issue Detection",
        node_type=FeedbackFlowNodeType.AGENT,
        category_class="agent",
        summary="AI NLP agent analyzes customer response, sentiment tone, and explicit blockers."
    ),
    FeedbackFlowNode(
        id="J",
        title="Feedback Sentiment?",
        subtitle="Evaluate sentiment classification",
        node_type=FeedbackFlowNodeType.DECISION,
        category_class="decision",
        summary="Decision gate: Was customer feedback positive/healthy or negative/critical?"
    ),
    FeedbackFlowNode(
        id="K",
        title="Positive Feedback",
        subtitle="High satisfaction rating & constructive tone",
        node_type=FeedbackFlowNodeType.POSITIVE,
        category_class="positive",
        summary="Customer reports high value and satisfaction."
    ),
    FeedbackFlowNode(
        id="L",
        title="Mark Customer Healthy",
        subtitle="Update CRM · Continue Monitoring",
        node_type=FeedbackFlowNodeType.POSITIVE,
        category_class="positive",
        summary="Reduces account risk score, updates CRM to healthy status, and logs timeline celebration."
    ),
    FeedbackFlowNode(
        id="M",
        title="Negative Feedback",
        subtitle="Low satisfaction rating & critical blockers",
        node_type=FeedbackFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Customer expresses adoption friction or churn risk."
    ),
    FeedbackFlowNode(
        id="N",
        title="Analyze Customer Issues",
        subtitle="Identify UX, Product or Competitor Concerns",
        node_type=FeedbackFlowNodeType.AGENT,
        category_class="agent",
        summary="AI decomposes customer issues into UX friction, product gaps, and competitor threats."
    ),
    FeedbackFlowNode(
        id="O",
        title="Notify Sales Team",
        subtitle="Request Customer Call",
        node_type=FeedbackFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Alerts Sales & CSM team with customer talking points and call request."
    ),
    FeedbackFlowNode(
        id="P",
        title="Notify Manager",
        subtitle="Share Detailed Feedback Insights",
        node_type=FeedbackFlowNodeType.NEGATIVE,
        category_class="negative",
        summary="Sends executive briefing to leadership detailing revenue at risk and root causes."
    )
]

GRAPH_EDGES = [
    FeedbackFlowEdge(from_node="A", to_node="B"),
    FeedbackFlowEdge(from_node="B", to_node="C"),
    FeedbackFlowEdge(from_node="C", to_node="D", label="No"),
    FeedbackFlowEdge(from_node="C", to_node="E", label="Yes"),
    FeedbackFlowEdge(from_node="E", to_node="F"),
    FeedbackFlowEdge(from_node="F", to_node="G"),
    FeedbackFlowEdge(from_node="G", to_node="H"),
    FeedbackFlowEdge(from_node="H", to_node="I", label="Yes"),
    FeedbackFlowEdge(from_node="H", to_node="Q", label="No"),
    FeedbackFlowEdge(from_node="Q", to_node="R"),
    FeedbackFlowEdge(from_node="R", to_node="S"),
    FeedbackFlowEdge(from_node="S", to_node="I", label="Yes"),
    FeedbackFlowEdge(from_node="S", to_node="T", label="No"),
    FeedbackFlowEdge(from_node="I", to_node="J"),
    FeedbackFlowEdge(from_node="J", to_node="K", label="Positive"),
    FeedbackFlowEdge(from_node="K", to_node="L"),
    FeedbackFlowEdge(from_node="J", to_node="M", label="Negative"),
    FeedbackFlowEdge(from_node="M", to_node="N"),
    FeedbackFlowEdge(from_node="N", to_node="O"),
    FeedbackFlowEdge(from_node="N", to_node="P")
]


class FeedbackFlowOrchestrator:
    """
    Executes and simulates the 20-node Feedback Form Flowchart
    defined in docs/features-flow/feedback.md.
    """

    def __init__(self):
        self._executions: Dict[str, FeedbackFlowExecution] = {}

    def get_graph(self) -> FeedbackFlowGraph:
        """Returns the complete static 20-node DAG definition with metadata and edges."""
        return FeedbackFlowGraph(nodes=GRAPH_NODES, edges=GRAPH_EDGES)

    def run_flow(self, req: RunFeedbackFlowRequest) -> FeedbackFlowExecution:
        """
        Executes the 20-node Feedback Form flow for a customer account.
        Supports scenarios: 'auto', 'healthy', 'negative_day0', 'reminder_negative', 'unresponsive', 'positive'.
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

        # Determine scenario if 'auto'
        scenario = req.scenario.lower()
        if scenario == "auto":
            if risk_score < 40:
                scenario = "healthy"
            elif any("sso" in s.title.lower() or "usage" in s.title.lower() for s in signals):
                scenario = "negative_day0"
            else:
                scenario = "negative_day0"

        execution_id = f"flow-exec-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        path: List[str] = []
        node_states: Dict[str, Dict[str, Any]] = {}

        # ----------------------------------------------------
        # NODE A: Collect Customer Signals
        # ----------------------------------------------------
        path.append("A")
        node_states["A"] = {
            "title": "Collect Customer Signals",
            "status": "completed",
            "timestamp": now.isoformat(),
            "data": {
                "account_id": account_id,
                "account_name": account_name,
                "sources_scanned": ["HubSpot CRM", "Gmail / Outlook", "Google Calendar", "Product Telemetry", "Support Desk"],
                "signals_found_count": len(signals),
                "signals_sample": [
                    {"id": s.id, "title": s.title, "severity": s.severity, "type": s.signal_type}
                    for s in signals[:3]
                ]
            },
            "summary": f"Ingested {len(signals)} raw interaction signals across CRM, usage telemetry, and support tickets for {account_name}."
        }

        # ----------------------------------------------------
        # NODE B: Signal Analysis Agent
        # ----------------------------------------------------
        path.append("B")
        usage_drop = 35.0 if risk_score >= 50 else 12.0
        touchpoint_days = 28 if risk_score >= 50 else 10
        renewal_days = 45 if risk_score >= 50 else 180

        node_states["B"] = {
            "title": "Signal Analysis Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=1)).isoformat(),
            "data": {
                "calculated_risk_score": risk_score,
                "usage_drop_pct": usage_drop,
                "touchpoint_lag_days": touchpoint_days,
                "days_to_renewal": renewal_days,
                "critical_tickets_count": sum(1 for s in signals if s.severity == "critical")
            },
            "summary": f"Detected -{usage_drop:.1f}% license usage contraction, {touchpoint_days} days without CSM contact, and renewal approaching in {renewal_days} days."
        }

        # ----------------------------------------------------
        # NODE C: Customer at Risk? (Decision)
        # ----------------------------------------------------
        path.append("C")
        is_at_risk = scenario != "healthy"
        node_states["C"] = {
            "title": "Customer at Risk?",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=2)).isoformat(),
            "decision": "Yes" if is_at_risk else "No",
            "data": {
                "is_at_risk": is_at_risk,
                "risk_score": risk_score,
                "trigger_threshold": 50,
                "condition_met": "Risk score >= 50 or usage decline >= 30%" if is_at_risk else "Engagement healthy"
            },
            "summary": f"Decision: {'Yes (Customer meets churn risk threshold)' if is_at_risk else 'No (Customer is healthy)'}."
        }

        if not is_at_risk:
            # ----------------------------------------------------
            # NODE D: Continue Normal Monitoring
            # ----------------------------------------------------
            path.append("D")
            node_states["D"] = {
                "title": "Continue Normal Monitoring",
                "status": "completed",
                "timestamp": (now + timedelta(seconds=3)).isoformat(),
                "data": {
                    "monitoring_cadence": "Daily telemetry sync",
                    "next_scheduled_review": (now + timedelta(days=14)).strftime("%Y-%m-%d"),
                    "status": "healthy"
                },
                "summary": f"Account {account_name} remains healthy. Regular daily monitoring continued."
            }
            exec_res = FeedbackFlowExecution(
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
                outcome_summary=f"Flow complete: {account_name} evaluated as healthy. Continued normal monitoring without survey interruption.",
                healthy_marked=True
            )
            self._executions[execution_id] = exec_res
            return exec_res

        # ----------------------------------------------------
        # NODE E: Feedback Agent (Generate Personalized Form)
        # ----------------------------------------------------
        path.append("E")
        custom_blocker_topic = req.custom_blocker or ("SSO authentication and license provisioning" if "Cloud" in account_name or "Acme" in account_name else "platform latency and API limits")
        intro_text = f"Hi {recipient_name}, our telemetry noticed recent shifts in your team's platform engagement. We want to ensure your engineering team has immediate support around {custom_blocker_topic}."

        node_states["E"] = {
            "title": "Feedback Agent",
            "status": "completed",
            "timestamp": (now + timedelta(seconds=3)).isoformat(),
            "data": {
                "targeted_recipient": f"{recipient_name} ({recipient_email})",
                "personalized_intro": intro_text,
                "generated_questions": [
                    {"id": "q1", "type": "rating_1_10", "prompt": "How satisfied is your team with platform value over the last 30 days?"},
                    {"id": "q2", "type": "multichoice", "prompt": f"Has your team encountered roadblocks with {custom_blocker_topic}?"},
                    {"id": "q3", "type": "text", "prompt": "What is the single most important fix or support your team needs before contract renewal?"}
                ],
                "template_id": "survey-tpl-churn-early-warning"
            },
            "summary": f"Feedback Agent personalized 3-question survey for {recipient_name} targeting {custom_blocker_topic}."
        }

        # ----------------------------------------------------
        # NODE F: Send Feedback Form (Day 0)
        # ----------------------------------------------------
        survey_code = f"rev-fb-{uuid.uuid4().hex[:6]}"
        path.append("F")
        node_states["F"] = {
            "title": "Send Feedback Form",
            "status": "completed",
            "day_label": "Day 0",
            "timestamp": now.isoformat(),
            "data": {
                "channel": "Email / In-App Link",
                "recipient": recipient_email,
                "survey_code": survey_code,
                "form_url": f"/feedback/form/{survey_code}",
                "status": "sent"
            },
            "summary": f"Dispatched personalized survey link ({survey_code}) to {recipient_email} on Day 0."
        }

        # ----------------------------------------------------
        # NODE G: Wait 48 Hours
        # ----------------------------------------------------
        path.append("G")
        node_states["G"] = {
            "title": "Wait 48 Hours",
            "status": "completed",
            "day_label": "48h",
            "timestamp": (now + timedelta(days=2)).isoformat(),
            "data": {
                "wait_duration_hours": 48,
                "elapsed_time": "Day 0 to Day 2",
                "sla_status": "Observation period elapsed"
            },
            "summary": "Waited 48 hours for initial customer survey response."
        }

        # ----------------------------------------------------
        # NODE H: Feedback Form Submitted? (Decision)
        # ----------------------------------------------------
        path.append("H")
        submitted_day0 = scenario in ("positive", "negative_day0")
        node_states["H"] = {
            "title": "Feedback Form Submitted?",
            "status": "completed",
            "timestamp": (now + timedelta(days=2, seconds=1)).isoformat(),
            "decision": "Yes" if submitted_day0 else "No",
            "data": {
                "submitted_within_48h": submitted_day0,
                "survey_status": "submitted" if submitted_day0 else "pending_timeout"
            },
            "summary": f"Decision: {'Yes (Customer submitted survey on Day 1)' if submitted_day0 else 'No (Survey unsubmitted after 48h)'}."
        }

        submitted_after_reminder = False
        if not submitted_day0:
            # ----------------------------------------------------
            # NODE Q: Send Reminder Email (Day 2)
            # ----------------------------------------------------
            path.append("Q")
            node_states["Q"] = {
                "title": "Send Reminder Email",
                "status": "completed",
                "day_label": "Day 2",
                "timestamp": (now + timedelta(days=2, hours=1)).isoformat(),
                "data": {
                    "subject": f"Revora Follow-up: Quick check-in regarding your team's experience",
                    "recipient": recipient_email,
                    "reminder_body": f"Hi {recipient_name}, we wanted to follow up on our previous note. We value your partnership and want to ensure any friction is resolved promptly."
                },
                "summary": f"Dispatched polite Day 2 reminder email to {recipient_email}."
            }

            # ----------------------------------------------------
            # NODE R: Wait Another 48 Hours
            # ----------------------------------------------------
            path.append("R")
            node_states["R"] = {
                "title": "Wait Another 48 Hours",
                "status": "completed",
                "day_label": "48h",
                "timestamp": (now + timedelta(days=4)).isoformat(),
                "data": {
                    "wait_duration_hours": 48,
                    "elapsed_time": "Day 2 to Day 4 (Total 96h elapsed)"
                },
                "summary": "Waited an additional 48 hours following reminder dispatch."
            }

            # ----------------------------------------------------
            # NODE S: Feedback Received After Reminder? (Decision)
            # ----------------------------------------------------
            path.append("S")
            submitted_after_reminder = scenario == "reminder_negative"
            node_states["S"] = {
                "title": "Feedback Received After Reminder?",
                "status": "completed",
                "timestamp": (now + timedelta(days=4, seconds=1)).isoformat(),
                "decision": "Yes" if submitted_after_reminder else "No",
                "data": {
                    "received_after_reminder": submitted_after_reminder
                },
                "summary": f"Decision: {'Yes (Customer submitted feedback after reminder)' if submitted_after_reminder else 'No (Customer remains unresponsive)'}."
            }

            if not submitted_after_reminder:
                # ----------------------------------------------------
                # NODE T: Notify Sales Team (Request Customer Call)
                # ----------------------------------------------------
                path.append("T")
                node_states["T"] = {
                    "title": "Notify Sales Team",
                    "subtitle": "Request Customer Call · Share Risk Context",
                    "status": "completed",
                    "timestamp": (now + timedelta(days=4, minutes=5)).isoformat(),
                    "data": {
                        "escalation_type": "unresponsive_at_risk_account",
                        "assigned_csm": csm_owner,
                        "priority": "P0 - Immediate Phone Call Required",
                        "risk_context": {
                            "usage_drop_pct": usage_drop,
                            "days_since_touchpoint": touchpoint_days + 4,
                            "days_to_renewal": renewal_days - 4,
                            "unresponsive_attempts": 2
                        },
                        "action_instructions": f"Schedule immediate executive sponsor call with {recipient_name}. Account has ignored 2 survey touches while suffering {usage_drop:.0f}% usage drop."
                    },
                    "summary": f"Urgent escalation: Alerted Sales/CSM ({csm_owner}) to call {recipient_name} immediately with synthesized risk context."
                }
                # Create a proposal in proposal repo
                self._record_sales_call_proposal(account_id, account_name, recipient_name, recipient_email, csm_owner, is_unresponsive=True)

                exec_res = FeedbackFlowExecution(
                    execution_id=execution_id,
                    account_id=account_id,
                    account_name=account_name,
                    scenario=scenario,
                    path_taken=path,
                    current_node="T",
                    node_states=node_states,
                    status="completed",
                    started_at=now.isoformat(),
                    completed_at=(now + timedelta(days=4, minutes=5)).isoformat(),
                    outcome_summary=f"Flow escalated to Node T: Customer remained unresponsive across 96 hours. Sales team notified with phone call request & full telemetry risk context.",
                    sales_notified=True
                )
                self._executions[execution_id] = exec_res
                return exec_res

        # ----------------------------------------------------
        # NODE I: Analyze Feedback (Sentiment and Issue Detection)
        # ----------------------------------------------------
        path.append("I")
        is_positive = scenario == "positive"
        score = req.custom_satisfaction_score if req.custom_satisfaction_score is not None else (9 if is_positive else 3)
        stated_blocker = req.custom_blocker or (
            "No major blockers; seamless collaboration." if is_positive else
            "SSO authentication certificate expiry and missing API rate limit expansion"
        )
        comments = req.custom_comments or (
            "We are very happy with recent support and look forward to renewing." if is_positive else
            "Our engineering lead is frustrated by constant token timeouts. We are evaluating competitor platforms if this is not resolved this month."
        )

        node_states["I"] = {
            "title": "Analyze Feedback",
            "status": "completed",
            "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=10)).isoformat(),
            "data": {
                "satisfaction_score": score,
                "detected_sentiment": "positive" if is_positive else "negative_frustrated",
                "stated_blocker": stated_blocker,
                "customer_comments": comments,
                "urgency": "low" if is_positive else "critical"
            },
            "summary": f"AI Analyzer parsed customer submission: Satisfaction {score}/10, Tone: {'Satisfied / Growth' if is_positive else 'Frustrated / Churn Warning'}."
        }

        # ----------------------------------------------------
        # NODE J: Feedback Sentiment? (Decision)
        # ----------------------------------------------------
        path.append("J")
        node_states["J"] = {
            "title": "Feedback Sentiment?",
            "status": "completed",
            "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=12)).isoformat(),
            "decision": "Positive" if is_positive else "Negative",
            "data": {
                "sentiment_decision": "Positive" if is_positive else "Negative",
                "score_threshold": "Score >= 7 is Positive; Score <= 6 is Negative",
                "actual_score": score
            },
            "summary": f"Decision: {'Positive (Score >= 7)' if is_positive else 'Negative (Score <= 6, active friction cited)'}."
        }

        sales_notified = False
        manager_notified = False
        crm_updated = False
        healthy_marked = False

        if is_positive:
            # ----------------------------------------------------
            # NODE K: Positive Feedback
            # ----------------------------------------------------
            path.append("K")
            node_states["K"] = {
                "title": "Positive Feedback",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=13)).isoformat(),
                "data": {
                    "health_status": "Champion validated",
                    "nps_equivalent": "Promoter",
                    "expansion_opportunity": "Identified"
                },
                "summary": f"Positive feedback recorded for {account_name}. Customer champion reaffirmed confidence."
            }

            # ----------------------------------------------------
            # NODE L: Mark Customer Healthy (Update CRM, Continue Monitoring)
            # ----------------------------------------------------
            path.append("L")
            node_states["L"] = {
                "title": "Mark Customer Healthy",
                "subtitle": "Update CRM · Continue Monitoring",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=15)).isoformat(),
                "data": {
                    "previous_risk_score": risk_score,
                    "updated_risk_score": 15,
                    "crm_field_updated": "Account Health Status -> Healthy (Low Churn Risk)",
                    "timeline_event": "Pulse check completed: Customer rated platform 9/10"
                },
                "summary": f"Account marked Healthy (risk score reduced to 15). CRM updated and normal monitoring resumed."
            }
            crm_updated = True
            healthy_marked = True

            # Register in timeline
            self._record_timeline_event(account_id, "Customer Feedback: Healthy Rating (9/10)", "Customer completed survey with positive sentiment. Risk score lowered.")

        else:
            # ----------------------------------------------------
            # NODE M: Negative Feedback
            # ----------------------------------------------------
            path.append("M")
            node_states["M"] = {
                "title": "Negative Feedback",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=13)).isoformat(),
                "data": {
                    "churn_risk_flag": "Active",
                    "urgency": "High",
                    "customer_quote": comments[:120] + "..."
                },
                "summary": f"Negative feedback confirmed: '{stated_blocker}'. Escalating to multi-factor issue decomposition."
            }

            # ----------------------------------------------------
            # NODE N: Analyze Customer Issues (UX, Product, Competitor)
            # ----------------------------------------------------
            path.append("N")
            node_states["N"] = {
                "title": "Analyze Customer Issues",
                "subtitle": "Identify UX, Product or Competitor Concerns",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=15)).isoformat(),
                "data": {
                    "ux_friction": [
                        "Authentication token expiration causes repeated login dropouts",
                        "Role-based permission settings in settings console lack bulk assignment"
                    ],
                    "product_concerns": [
                        "API query throughput cap restricts peak telemetry processing",
                        "Absence of real-time multi-region replication"
                    ],
                    "competitor_concerns": [
                        "Customer engineering leadership actively comparing with alternative providers",
                        "Renewal budget scrutiny highlighted by CFO"
                    ]
                },
                "summary": "AI Agent categorized root problems into UX friction (SSO dropouts), Product gaps (API query caps), and Competitor threats (CFO vendor audit)."
            }

            # ----------------------------------------------------
            # NODE O: Notify Sales Team (Request Customer Call)
            # ----------------------------------------------------
            path.append("O")
            node_states["O"] = {
                "title": "Notify Sales Team",
                "subtitle": "Request Customer Call",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=16)).isoformat(),
                "data": {
                    "target_rep": csm_owner,
                    "action": "Urgent Customer Call Request",
                    "talking_points": [
                        "Acknowledge SSO authentication friction directly",
                        "Offer temporary API limit extension from Solutions Engineering",
                        "Reaffirm pricing commitments ahead of contract renewal"
                    ],
                    "proposed_call_time": (now + timedelta(days=1)).strftime("%Y-%m-%d 10:00 AM")
                },
                "summary": f"Sales team notification dispatched: Requested immediate phone check-in with {recipient_name} with tailored talking points."
            }
            sales_notified = True

            # ----------------------------------------------------
            # NODE P: Notify Manager (Share Detailed Feedback Insights)
            # ----------------------------------------------------
            path.append("P")
            node_states["P"] = {
                "title": "Notify Manager",
                "subtitle": "Share Detailed Feedback Insights",
                "status": "completed",
                "timestamp": (now + timedelta(days=2 if submitted_day0 else 4, minutes=17)).isoformat(),
                "data": {
                    "recipient": "VP of Customer Success & Revenue Leadership",
                    "account_arr": f"${account.arr:,.0f}" if account else "$150,000",
                    "executive_briefing": f"ALERT: High-value account {account_name} reported critical dissatisfaction regarding '{stated_blocker}'. Competitor evaluation is underway with renewal in {renewal_days} days.",
                    "recommended_management_action": "Coordinate joint VP Engineering + CSM unblocker review"
                },
                "summary": f"Manager alert dispatched: Executive briefing shared with leadership highlighting revenue at risk and competitor threat."
            }
            manager_notified = True

            # Create proposals for Human-in-the-loop review
            self._record_sales_call_proposal(account_id, account_name, recipient_name, recipient_email, csm_owner, is_unresponsive=False, blocker=stated_blocker)
            self._record_manager_briefing_proposal(account_id, account_name, csm_owner, stated_blocker)
            self._record_timeline_event(account_id, "Customer Feedback: Critical Blocker Reported", f"Customer reported '{stated_blocker}'. Sales and Leadership notified.")

        completed_at = (now + timedelta(days=2 if submitted_day0 else 4, minutes=20)).isoformat()
        outcome_msg = (
            f"Flow complete via Positive branch: {account_name} marked healthy, CRM updated, continued normal monitoring."
            if is_positive else
            f"Flow complete via Negative branch: Customer issues analyzed (UX, Product, Competitor). Sales team and Manager alerted with actionable intervention proposals."
        )

        exec_res = FeedbackFlowExecution(
            execution_id=execution_id,
            account_id=account_id,
            account_name=account_name,
            scenario=scenario,
            path_taken=path,
            current_node=path[-1],
            node_states=node_states,
            status="completed",
            started_at=now.isoformat(),
            completed_at=completed_at,
            outcome_summary=outcome_msg,
            sales_notified=sales_notified,
            manager_notified=manager_notified,
            crm_updated=crm_updated,
            healthy_marked=healthy_marked
        )
        self._executions[execution_id] = exec_res
        logger.info(f"Executed Feedback Form Flow {execution_id} for {account_name} (path: {' -> '.join(path)})")
        return exec_res

    def get_execution(self, execution_id: str) -> Optional[FeedbackFlowExecution]:
        return self._executions.get(execution_id)

    def list_executions(self, account_id: Optional[str] = None) -> List[FeedbackFlowExecution]:
        all_e = list(self._executions.values())
        if account_id:
            all_e = [e for e in all_e if e.account_id == account_id]
        return sorted(all_e, key=lambda x: x.started_at, reverse=True)

    def _record_sales_call_proposal(self, account_id: str, account_name: str, contact_name: str, contact_email: str, csm: str, is_unresponsive: bool = False, blocker: str = ""):
        try:
            prop_id = f"prop-flow-sales-{uuid.uuid4().hex[:6]}"
            title = f"Sales Urgent Call: {contact_name} ({account_name})" if not is_unresponsive else f"Sales Check-in: Unresponsive Account {account_name}"
            payload = {
                "action_type": "sales_call_request",
                "recipient_name": contact_name,
                "recipient_email": contact_email,
                "assigned_csm": csm,
                "urgency": "critical",
                "reason": "Unresponsive following Day 2 survey reminder" if is_unresponsive else f"Customer reported critical feedback: {blocker}",
                "talking_points": [
                    "Acknowledge recent friction and apologize for technical blockers",
                    "Offer direct Solutions Engineer pair-programming session",
                    "Confirm renewal discount or custom SLA terms"
                ]
            }
            content_hash = proposal_repo.calculate_hash("sales_call_request", title, payload)
            prop = ActionProposal(
                id=prop_id,
                account_id=account_id,
                action_type="sales_call_request",
                title=title,
                payload=payload,
                status=ActionStatus.PROPOSED,
                version=1,
                content_hash=content_hash,
                created_at=datetime.utcnow()
            )
            proposal_repo._proposals[prop_id] = prop
        except Exception as e:
            logger.debug(f"Could not record sales call proposal: {e}")

    def _record_manager_briefing_proposal(self, account_id: str, account_name: str, csm: str, blocker: str):
        try:
            prop_id = f"prop-flow-mgr-{uuid.uuid4().hex[:6]}"
            title = f"Manager Briefing: Churn Risk Escalation for {account_name}"
            payload = {
                "action_type": "executive_briefing",
                "target_audience": "VP of Customer Success & CRO",
                "urgency": "high",
                "account_name": account_name,
                "blocker_summary": blocker,
                "recommended_intervention": "Executive sponsor alignment call and expedited engineering hotfix"
            }
            content_hash = proposal_repo.calculate_hash("executive_briefing", title, payload)
            prop = ActionProposal(
                id=prop_id,
                account_id=account_id,
                action_type="executive_briefing",
                title=title,
                payload=payload,
                status=ActionStatus.PROPOSED,
                version=1,
                content_hash=content_hash,
                created_at=datetime.utcnow()
            )
            proposal_repo._proposals[prop_id] = prop
        except Exception as e:
            logger.debug(f"Could not record manager briefing proposal: {e}")

    def _record_timeline_event(self, account_id: str, title: str, description: str):
        try:
            from app.services.outcome_timeline_service import outcome_timeline_service
            event_id = f"evt-flow-{uuid.uuid4().hex[:6]}"
            evt = TimelineEvent(
                id=event_id,
                account_id=account_id,
                event_type=TimelineEventType.CUSTOMER_RESPONSE,
                category="feedback",
                title=title,
                description=description,
                timestamp=datetime.utcnow().isoformat(),
                author_or_actor="Revora Feedback Agent Flow",
                severity="info"
            )
            outcome_timeline_service.add_custom_event(account_id, evt)
        except Exception as e:
            logger.debug(f"Could not record timeline event: {e}")

feedback_flow_orchestrator = FeedbackFlowOrchestrator()
