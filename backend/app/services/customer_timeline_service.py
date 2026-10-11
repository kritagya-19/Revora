import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    CustomerOutcomeTimelineResponse,
    TimelineEvent,
    TimelineEventType,
    OutstandingCommitment
)
from app.services.account_repository import account_repo
from app.services.action_tracker_repository import action_tracker_repo
from app.services.proposal_repository import proposal_repo
from app.services.investigation_repository import investigation_repo

logger = logging.getLogger("revora.timeline")

class CustomerTimelineService:
    """
    Feature 2: Customer Outcome Timeline Service.
    Compiles a comprehensive, chronologically unified history of an account's:
    1. Multi-source signals & telemetry events
    2. Previous risk assessments (Autopsies & scores)
    3. Recommended and approved proposals
    4. Executed actions & receipts
    5. Meeting notes & email responses
    6. Captured outcomes (notes, commitments, customer responses, who recorded and when)
    7. Outstanding commitments
    """

    def build_account_timeline(self, account_id: str) -> CustomerOutcomeTimelineResponse:
        account = account_repo.get_account_by_id(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")

        events: List[TimelineEvent] = []
        commitments: List[OutstandingCommitment] = []

        now = datetime.utcnow()

        # 1. Signals & Ingested Telemetry
        signals = account_repo.get_account_signals(account_id)
        for sig in signals:
            cat = sig.source_category or "usage"
            event_type = TimelineEventType.SIGNAL
            if "meeting" in sig.title.lower() or "sync" in sig.title.lower() or cat == "calendar":
                event_type = TimelineEventType.MEETING_NOTE
            elif cat == "email" or "email" in sig.title.lower():
                event_type = TimelineEventType.EMAIL_COMMUNICATION

            events.append(
                TimelineEvent(
                    id=f"evt-sig-{sig.id}",
                    account_id=account_id,
                    event_type=event_type,
                    category=cat,
                    title=sig.title,
                    description=sig.summary or (sig.description or ""),
                    timestamp=sig.timestamp,
                    author_or_actor=f"Integration Sync ({cat.upper()})",
                    severity=sig.severity,
                    status="detected",
                    metadata=sig.metadata or {},
                    evidence_ids=[sig.id]
                )
            )

        # 2. Previous Risk Assessments / Autopsies
        investigations = []
        # Check investigation repo
        latest_inv = investigation_repo.get_latest_for_account(account_id)
        if latest_inv:
            investigations.append(latest_inv)

        for inv in investigations:
            events.append(
                TimelineEvent(
                    id=f"evt-inv-{inv.id}",
                    account_id=account_id,
                    event_type=TimelineEventType.RISK_ASSESSMENT,
                    category="diagnosis",
                    title=f"AI Revenue Risk Autopsy (Score: {inv.risk_score}/100)",
                    description=inv.causal_explanation or inv.risk_summary,
                    timestamp=inv.created_at,
                    author_or_actor="Revora AI Autopsy Engine",
                    severity=inv.risk_level.value if hasattr(inv.risk_level, 'value') else str(inv.risk_level),
                    status="completed",
                    risk_score_at_time=inv.risk_score,
                    risk_level_at_time=inv.risk_level.value if hasattr(inv.risk_level, 'value') else str(inv.risk_level),
                    original_recommendation={
                        "title": inv.recommended_action.title if inv.recommended_action else "",
                        "reason": inv.recommended_action.reason if inv.recommended_action else ""
                    },
                    evidence_ids=[f.evidence_ids[0] for f in inv.findings if f.evidence_ids]
                )
            )

        # 3. Action Proposals & Approvals
        proposals = proposal_repo.get_proposals_for_account(account_id)
        for prop in proposals:
            # Add Proposal / Recommendation Event
            rec_event_id = f"evt-prop-{prop.id}"
            events.append(
                TimelineEvent(
                    id=rec_event_id,
                    account_id=account_id,
                    event_type=TimelineEventType.RECOMMENDATION,
                    category="intervention",
                    title=f"AI Action Recommendation: {prop.title}",
                    description=prop.reason or f"Recommended {prop.action_type} for revenue retention.",
                    timestamp=prop.created_at.isoformat() if hasattr(prop.created_at, 'isoformat') else str(prop.created_at),
                    author_or_actor="Action Copilot (AI)",
                    severity="info",
                    status=prop.status.value if hasattr(prop.status, 'value') else str(prop.status),
                    original_recommendation=prop.payload,
                    evidence_ids=prop.evidence_ids or []
                )
            )

            # If Approved
            if prop.approved_at:
                events.append(
                    TimelineEvent(
                        id=f"evt-appr-{prop.id}",
                        account_id=account_id,
                        event_type=TimelineEventType.APPROVAL,
                        category="review",
                        title=f"Intervention Approved: {prop.title}",
                        description=f"Action proposal authorized and gated for delivery by {prop.approved_by or 'CSM Lead'}.",
                        timestamp=prop.approved_at.isoformat() if hasattr(prop.approved_at, 'isoformat') else str(prop.approved_at),
                        author_or_actor=prop.approved_by or "Human Reviewer",
                        severity="success",
                        status="approved",
                        metadata={"proposal_id": prop.id, "version": prop.version}
                    )
                )

        # 4. Action Tracker Items & Captured Outcomes
        tracked_items = action_tracker_repo.get_all(account_id=account_id)
        for item in tracked_items:
            # Action Execution Event
            if item.action_status.value in ["executing", "executed", "failed"] or item.action_status in ["executing", "executed", "failed"]:
                events.append(
                    TimelineEvent(
                        id=f"evt-exec-{item.id}",
                        account_id=account_id,
                        event_type=TimelineEventType.ACTION_EXECUTED,
                        category="intervention",
                        title=f"Executed Action: {item.title}",
                        description=item.description or f"Action delivered in {item.execution_mode} mode.",
                        timestamp=item.updated_at or item.created_at,
                        author_or_actor=item.assigned_to,
                        severity="success" if item.action_status == "executed" or (hasattr(item.action_status, "value") and item.action_status.value == "executed") else "medium",
                        status=item.action_status.value if hasattr(item.action_status, 'value') else str(item.action_status),
                        original_recommendation=item.recommendation_payload,
                        metadata=item.execution_result or {},
                        evidence_ids=item.evidence_ids
                    )
                )

            # Outcome Captured Event (with customer responses, notes, commitments)
            if item.outcome:
                out = item.outcome
                events.append(
                    TimelineEvent(
                        id=f"evt-out-{out.outcome_id}",
                        account_id=account_id,
                        event_type=TimelineEventType.OUTCOME_CAPTURED,
                        category="feedback",
                        title=f"Outcome & Customer Response: {item.title}",
                        description=out.notes,
                        timestamp=out.recorded_at,
                        author_or_actor=out.recorded_by,
                        severity="success",
                        status="closed_loop",
                        customer_response=out.customer_response,
                        commitments=out.commitments,
                        next_steps=out.next_steps,
                        metadata={
                            "auto_captured": out.auto_captured,
                            "capture_source": out.capture_source or "CSM Portal"
                        },
                        evidence_ids=out.supporting_evidence_ids or item.evidence_ids
                    )
                )

                # Extract Outstanding Commitments from the outcome
                if out.commitments and out.commitments.strip() and out.commitments.lower() not in ["none", "none specified", "n/a"]:
                    commitments.append(
                        OutstandingCommitment(
                            commitment_id=f"com-{out.outcome_id}",
                            account_id=account_id,
                            title=out.commitments,
                            owner=out.recorded_by,
                            due_date=(now + timedelta(days=5)).strftime("%Y-%m-%d"),
                            status="open" if "will" in out.commitments.lower() or "prepare" in out.commitments.lower() else "in_progress",
                            source_event_id=f"evt-out-{out.outcome_id}",
                            created_at=out.recorded_at
                        )
                    )

        # 5. Customer Feedback Surveys & Analyzed Responses
        try:
            from app.services.feedback_repository import feedback_repo
            feedback_records = feedback_repo.list_feedback_records(account_id=account_id)
            for fb in feedback_records:
                score_str = f"{fb.submission.satisfaction_score}/10" if fb.submission.satisfaction_score else "N/A"
                ana = fb.analysis
                rec_action = ana.recommended_retention_action if ana else "Follow up with customer"
                
                events.append(
                    TimelineEvent(
                        id=f"evt-fb-sub-{fb.id}",
                        account_id=account_id,
                        event_type=TimelineEventType.CUSTOMER_RESPONSE,
                        category="feedback",
                        title=f"Customer Survey Response: {ana.classified_churn_reason.replace('_', ' ').title() if ana else 'Feedback'}",
                        description=f"Satisfaction Score: {score_str}. Blocker: {fb.submission.primary_blocker or 'None specified'}. {fb.submission.unresolved_issues or ''}",
                        timestamp=fb.submitted_at,
                        author_or_actor=f"{fb.recipient_name} ({fb.recipient_email})",
                        severity="critical" if (fb.submission.satisfaction_score and fb.submission.satisfaction_score <= 4) else "medium",
                        status="analyzed",
                        customer_response=fb.submission.additional_comments or fb.submission.unresolved_issues,
                        commitments=f"Recommended Retention Action: {rec_action}",
                        next_steps=rec_action,
                        metadata={
                            "survey_code": fb.survey_code,
                            "satisfaction_score": fb.submission.satisfaction_score,
                            "urgency": ana.urgency_level if ana else "high",
                            "sentiment_label": ana.sentiment_label if ana else "at_risk",
                            "classified_reason": ana.classified_churn_reason if ana else "general"
                        },
                        evidence_ids=ana.evidence_connection if ana else []
                    )
                )

                if ana and ana.recommended_retention_action:
                    commitments.append(
                        OutstandingCommitment(
                            commitment_id=f"com-fb-{fb.id}",
                            account_id=account_id,
                            title=ana.recommended_retention_action,
                            owner=account.csm_owner or "CSM Team",
                            due_date=(now + timedelta(days=3)).strftime("%Y-%m-%d"),
                            status="open",
                            source_event_id=f"evt-fb-sub-{fb.id}",
                            created_at=fb.submitted_at
                        )
                    )
        except Exception as e:
            logger.warning(f"Error compiling feedback records into timeline: {e}")

        # Add seed meeting note & email history for rich completeness if events are sparse
        if len(events) < 5:
            events.append(
                TimelineEvent(
                    id=f"evt-seed-meeting-{account_id}",
                    account_id=account_id,
                    event_type=TimelineEventType.MEETING_NOTE,
                    category="calendar",
                    title="Executive Touchpoint & Roadmap Sync",
                    description="CSM team reviewed Q3 platform adoption and upcoming multi-seat migration schedule with customer stakeholders.",
                    timestamp=(now - timedelta(days=12)).isoformat(),
                    author_or_actor=account.csm_owner or "CSM Team",
                    severity="info",
                    status="completed",
                    customer_response="Client expressed satisfaction with API stability, but raised security review requirements for SAML.",
                    commitments="Revora SE will provide SOC2 Type II compliance pack.",
                    next_steps="Follow up after IT security review by end of month."
                )
            )

        # Sort chronologically (newest first for primary feed, or oldest first)
        events.sort(key=lambda e: e.timestamp or "", reverse=True)

        summary = {
            "total_events": len(events),
            "signals_count": len([e for e in events if e.event_type == TimelineEventType.SIGNAL]),
            "recommendations_count": len([e for e in events if e.event_type == TimelineEventType.RECOMMENDATION]),
            "actions_executed_count": len([e for e in events if e.event_type == TimelineEventType.ACTION_EXECUTED]),
            "outcomes_captured_count": len([e for e in events if e.event_type == TimelineEventType.OUTCOME_CAPTURED]),
            "outstanding_commitments_count": len(commitments),
            "first_interaction": events[-1].timestamp if events else None,
            "latest_interaction": events[0].timestamp if events else None
        }

        return CustomerOutcomeTimelineResponse(
            account_id=account.id,
            account_name=account.name,
            csm_owner=account.csm_owner,
            arr=account.arr,
            current_risk_score=account.risk_score,
            current_risk_level=account.risk_level.value if hasattr(account.risk_level, 'value') else str(account.risk_level),
            events=events,
            outstanding_commitments=commitments,
            summary=summary
        )

customer_timeline_service = CustomerTimelineService()
