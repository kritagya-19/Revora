import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import (
    ActionTrackerItem,
    ActionExecutionStatus,
    WorkStatus,
    OutcomeRecord,
    SaveOutcomeRequest
)

logger = logging.getLogger("revora.tracker")

class ActionTrackerRepository:
    """
    Feature 1: Action & Outcome Tracker Repository.
    Tracks every approved action from execution to completion and outcome capture.
    Maintains closed-loop feedback: The system knows what the team actually did,
    instead of just knowing what it recommended.
    """
    def __init__(self):
        self._items: Dict[str, ActionTrackerItem] = {}
        self.db = None
        self._init_mongodb()
        self._init_seed_items()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"ActionTrackerRepository MongoDB fallback to memory: {e}")
                self.db = None

    def _serialize_item(self, item: ActionTrackerItem) -> Dict[str, Any]:
        return item.model_dump()

    def _init_seed_items(self):
        now = datetime.utcnow()
        yesterday = (now - timedelta(days=1)).isoformat()
        two_days_ago = (now - timedelta(days=2)).isoformat()
        today_iso = now.isoformat()

        # Seed 1: Completed Action with Captured Outcome (Acme Technologies)
        item1 = ActionTrackerItem(
            id="act-track-101",
            proposal_id="prop-101",
            account_id="acc-101",
            account_name="Acme Technologies",
            action_type="csm_outreach_email",
            title="Urgent Renewal Outreach Email to VP Engineering",
            description="High-urgency outreach addressing API drop and upcoming contract renewal in 43 days.",
            investigation_id="inv-acc-101",
            evidence_ids=["sig-101", "sig-102", "sig-103"],
            recommendation_payload={
                "recipient": "vp-eng@acme.com",
                "subject": "Acme Technologies Renewal & Service Continuity Check-in",
                "body": "Hi team, noticed usage changes and approaching renewal in 43 days. Let's schedule 20 mins to review tier options and optimize adoption readiness."
            },
            action_status=ActionExecutionStatus.EXECUTED,
            work_status=WorkStatus.COMPLETED,
            assigned_to="Sarah Jenkins (CSM Lead)",
            execution_mode="simulated",
            execution_result={
                "execution_id": "exec-sim-9912",
                "status": "succeeded",
                "provider_code": 200,
                "message": "Outreach email delivered via simulated gateway to vp-eng@acme.com"
            },
            outcome=OutcomeRecord(
                outcome_id="out-101",
                action_tracker_id="act-track-101",
                notes="Delivered outreach. VP replied same day expressing interest in keeping platform but needed clarity on tiered pricing & seat consolidation.",
                customer_response="Positive — VP confirmed commitment to renewal if SSO and seat tiering are finalized before renewal deadline.",
                commitments="Revora CSM will prepare custom ROI breakdown and SSO tier guide by Thursday. Acme will invite VP Eng and IT Lead to final pricing review.",
                next_steps="Follow up with tailored architecture pricing deck by Oct 15; schedule formal renewal sign-off call.",
                supporting_evidence_ids=["sig-101", "sig-102"],
                recorded_by="Sarah Jenkins (CSM Lead)",
                recorded_at=(now - timedelta(hours=6)).isoformat(),
                auto_captured=False,
                capture_source=None
            ),
            auto_capture_available=False,
            created_at=two_days_ago,
            updated_at=yesterday
        )
        self._items[item1.id] = item1

        # Seed 2: Executed Action with Auto-Captured Outcome from Salesforce CRM (HyperScale Labs)
        item2 = ActionTrackerItem(
            id="act-track-102",
            proposal_id="prop-102",
            account_id="acc-104",
            account_name="HyperScale Labs",
            action_type="crm_update",
            title="Update Salesforce CRM Account Status to High Churn Risk",
            description="Flagged executive disengagement, key contact departure, and 70% weekly API drop.",
            investigation_id="inv-acc-104",
            evidence_ids=["EVID-004", "EVID-005"],
            recommendation_payload={
                "target": "Salesforce CRM",
                "field": "Risk Flag",
                "value": "Executive Disengagement & API Drop"
            },
            action_status=ActionExecutionStatus.EXECUTED,
            work_status=WorkStatus.COMPLETED,
            assigned_to="CRM Sync Engine",
            execution_mode="simulated",
            execution_result={
                "execution_id": "exec-crm-8811",
                "status": "succeeded",
                "provider_code": 200,
                "message": "Updated Salesforce Account custom field Risk_Status__c = 'High Churn Risk'"
            },
            outcome=OutcomeRecord(
                outcome_id="out-102",
                action_tracker_id="act-track-102",
                notes="CRM field updated. Automatic connector sync captured matching Salesforce Opportunity Note: Account Executive reached out to interim Director.",
                customer_response="Neutral — Interim Director acknowledged ongoing internal reorganization and agreed to retain test environment.",
                commitments="Customer will not cancel sandbox instance until Q4 roadmap presentation; AE committed to revised multi-year discount.",
                next_steps="Executive Sponsor meeting scheduled on Oct 22 to present new enterprise scalability benchmarks.",
                supporting_evidence_ids=["EVID-004", "EVID-005"],
                recorded_by="Salesforce CRM Connector (conn-crm-01)",
                recorded_at=yesterday,
                auto_captured=True,
                capture_source="Salesforce CRM Connector"
            ),
            auto_capture_available=False,
            created_at=two_days_ago,
            updated_at=yesterday
        )
        self._items[item2.id] = item2

        # Seed 3: In Progress action with Auto-Capture Ready from Google Calendar/Gmail (Apex Systems)
        item3 = ActionTrackerItem(
            id="act-track-103",
            proposal_id=None,
            account_id="acc-102",
            account_name="Apex Systems",
            action_type="task_create",
            title="Technical Adoption & SSO Alignment Review",
            description="Identify why developer team seats remain unallocated despite contract expansion.",
            investigation_id=None,
            evidence_ids=["sig-201", "sig-202"],
            recommendation_payload={
                "task": "Meet with Apex DevOps lead to review SAML SSO integration blockage",
                "assigned_to": "Marcus Vance (Solutions Engineer)",
                "due_date": (now + timedelta(days=2)).strftime("%Y-%m-%d")
            },
            action_status=ActionExecutionStatus.EXECUTING,
            work_status=WorkStatus.IN_PROGRESS,
            assigned_to="Marcus Vance (Solutions Engineer)",
            execution_mode="simulated",
            execution_result={
                "execution_id": "exec-task-3301",
                "status": "succeeded",
                "message": "Dispatched task to internal CSM workflow queue"
            },
            outcome=None,
            auto_capture_available=True,
            auto_capture_preview={
                "source": "Google Calendar Telemetry",
                "detected_event": "Meeting 'Apex Systems Technical Adoption Sync' completed with 4 attendees",
                "detected_notes": "Call concluded at 4:30 PM. Lead DevOps engineer confirmed SAML metadata was misconfigured on Okta side. Reconfiguration succeeded during screen share.",
                "detected_customer_response": "Positive — DevOps team confirmed 35 developers will now log in via Okta tomorrow morning.",
                "detected_commitments": "Apex team will invite remaining 15 frontend engineers; Revora SE will monitor login volume on Thursday.",
                "detected_next_steps": "Check usage dashboard on Friday to confirm active user count rises from 12 to 50+."
            },
            created_at=yesterday,
            updated_at=today_iso
        )
        self._items[item3.id] = item3

        # Seed 4: Approved action awaiting execution / not started (CloudScale Solutions)
        item4 = ActionTrackerItem(
            id="act-track-104",
            proposal_id=None,
            account_id="acc-103",
            account_name="CloudScale Solutions",
            action_type="csm_outreach_email",
            title="Quarterly Executive Alignment & Feature Adoption Sync",
            description="Schedule 30-min strategic sync ahead of 60-day renewal cycle to prevent surprise churn.",
            investigation_id=None,
            evidence_ids=["sig-301"],
            recommendation_payload={
                "recipient": "director-it@cloudscale.io",
                "subject": "CloudScale Solutions & Revora Executive Alignment",
                "body": "Hi Jordan, reaching out ahead of your renewal window to ensure your infrastructure teams are leveraging our recent performance optimizations."
            },
            action_status=ActionExecutionStatus.APPROVED,
            work_status=WorkStatus.NOT_STARTED,
            assigned_to="Elena Rostova (Senior CSM)",
            execution_mode="simulated",
            execution_result=None,
            outcome=None,
            auto_capture_available=False,
            created_at=today_iso,
            updated_at=today_iso
        )
        self._items[item4.id] = item4

        if self.db is not None:
            try:
                for item in [item1, item2, item3, item4]:
                    doc = self._serialize_item(item)
                    self.db.action_tracker.update_one({"id": item.id}, {"$setOnInsert": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"Error seeding MongoDB action tracker items: {e}")

    def get_all(
        self,
        account_id: Optional[str] = None,
        action_status: Optional[str] = None,
        work_status: Optional[str] = None,
        has_outcome: Optional[bool] = None
    ) -> List[ActionTrackerItem]:
        if self.db is not None:
            try:
                query: Dict[str, Any] = {}
                if account_id:
                    query["account_id"] = account_id
                if action_status:
                    query["action_status"] = action_status
                if work_status:
                    query["work_status"] = work_status
                if has_outcome is True:
                    query["outcome"] = {"$ne": None}
                elif has_outcome is False:
                    query["outcome"] = None

                docs = list(self.db.action_tracker.find(query, {"_id": 0}))
                if docs:
                    return [ActionTrackerItem(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB action tracker get_all error: {e}")

        # In-memory filter
        items = list(self._items.values())
        if account_id:
            items = [i for i in items if i.account_id == account_id]
        if action_status:
            items = [i for i in items if i.action_status.value == action_status or i.action_status == action_status]
        if work_status:
            items = [i for i in items if i.work_status.value == work_status or i.work_status == work_status]
        if has_outcome is True:
            items = [i for i in items if i.outcome is not None]
        elif has_outcome is False:
            items = [i for i in items if i.outcome is None]

        # Sort newest first
        items.sort(key=lambda x: x.created_at or "", reverse=True)
        return items

    def get_by_id(self, item_id: str) -> Optional[ActionTrackerItem]:
        if self.db is not None:
            try:
                doc = self.db.action_tracker.find_one({"id": item_id}, {"_id": 0})
                if doc:
                    return ActionTrackerItem(**doc)
            except Exception as e:
                logger.warning(f"MongoDB action tracker get_by_id error: {e}")
        return self._items.get(item_id)

    def create(
        self,
        account_id: str,
        title: str,
        action_type: str,
        account_name: str,
        proposal_id: Optional[str] = None,
        description: Optional[str] = None,
        investigation_id: Optional[str] = None,
        evidence_ids: List[str] = [],
        recommendation_payload: Dict[str, Any] = {},
        action_status: ActionExecutionStatus = ActionExecutionStatus.APPROVED,
        work_status: WorkStatus = WorkStatus.NOT_STARTED,
        assigned_to: str = "CSM Team",
        execution_result: Optional[Dict[str, Any]] = None
    ) -> ActionTrackerItem:
        item_id = f"act-track-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        item = ActionTrackerItem(
            id=item_id,
            proposal_id=proposal_id,
            account_id=account_id,
            account_name=account_name,
            action_type=action_type,
            title=title,
            description=description,
            investigation_id=investigation_id,
            evidence_ids=evidence_ids,
            recommendation_payload=recommendation_payload,
            action_status=action_status,
            work_status=work_status,
            assigned_to=assigned_to,
            execution_mode="simulated",
            execution_result=execution_result,
            outcome=None,
            auto_capture_available=True,
            auto_capture_preview={
                "source": "Integration Telemetry",
                "detected_event": f"Active workflow registered for {title}",
                "detected_notes": f"Initial dispatch recorded. Waiting for external reply or meeting logging.",
                "detected_customer_response": "Pending customer touchpoint",
                "detected_commitments": "CSM owner scheduled follow-up check",
                "detected_next_steps": "Inspect CRM / email activity in next sync cycle."
            },
            created_at=now,
            updated_at=now
        )
        self._items[item.id] = item

        if self.db is not None:
            try:
                doc = self._serialize_item(item)
                self.db.action_tracker.update_one({"id": item.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB create action tracker error: {e}")

        return item

    def update_status(
        self,
        item_id: str,
        action_status: Optional[ActionExecutionStatus] = None,
        work_status: Optional[WorkStatus] = None,
        assigned_to: Optional[str] = None
    ) -> ActionTrackerItem:
        item = self.get_by_id(item_id)
        if not item:
            raise ValueError(f"Action tracker item {item_id} not found")

        now = datetime.utcnow().isoformat()
        if action_status:
            item.action_status = action_status
        if work_status:
            item.work_status = work_status
        if assigned_to:
            item.assigned_to = assigned_to
        item.updated_at = now

        self._items[item.id] = item

        if self.db is not None:
            try:
                doc = self._serialize_item(item)
                self.db.action_tracker.update_one({"id": item.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB update action tracker status error: {e}")

        return item

    def record_outcome(
        self,
        item_id: str,
        notes: str,
        customer_response: str,
        commitments: str,
        next_steps: str,
        recorded_by: str = "CSM Lead",
        supporting_evidence_ids: List[str] = [],
        auto_captured: bool = False,
        capture_source: Optional[str] = None
    ) -> ActionTrackerItem:
        item = self.get_by_id(item_id)
        if not item:
            raise ValueError(f"Action tracker item {item_id} not found")

        now = datetime.utcnow().isoformat()
        outcome = OutcomeRecord(
            outcome_id=f"out-{uuid.uuid4().hex[:8]}",
            action_tracker_id=item.id,
            notes=notes,
            customer_response=customer_response,
            commitments=commitments,
            next_steps=next_steps,
            supporting_evidence_ids=supporting_evidence_ids or item.evidence_ids,
            recorded_by=recorded_by,
            recorded_at=now,
            auto_captured=auto_captured,
            capture_source=capture_source
        )

        item.outcome = outcome
        # If outcome is captured, transition work_status to completed and action_status to executed if not already
        item.work_status = WorkStatus.COMPLETED
        if item.action_status in (ActionExecutionStatus.PENDING, ActionExecutionStatus.APPROVED, ActionExecutionStatus.EXECUTING):
            item.action_status = ActionExecutionStatus.EXECUTED
        item.auto_capture_available = False
        item.updated_at = now

        self._items[item.id] = item

        if self.db is not None:
            try:
                doc = self._serialize_item(item)
                self.db.action_tracker.update_one({"id": item.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB record outcome error: {e}")

        return item

    def auto_capture_from_integrations(self, item_id: str, source: Optional[str] = None) -> ActionTrackerItem:
        item = self.get_by_id(item_id)
        if not item:
            raise ValueError(f"Action tracker item {item_id} not found")

        # Derive auto-capture from item context and connectors
        preview = item.auto_capture_preview or {}
        chosen_source = source or preview.get("source") or "Gmail & CRM Integration Sync"

        notes = preview.get("detected_notes") or f"Automatically captured from {chosen_source}: External communication completed with account {item.account_name}."
        cust_response = preview.get("detected_customer_response") or "Positive — Customer acknowledged and verified action items with the account manager."
        commitments = preview.get("detected_commitments") or "Agreed to follow up during the scheduled weekly status checkpoint."
        next_steps = preview.get("detected_next_steps") or "Monitor account signals for positive adoption rebound over the next 7 days."

        return self.record_outcome(
            item_id=item.id,
            notes=notes,
            customer_response=cust_response,
            commitments=commitments,
            next_steps=next_steps,
            recorded_by=f"Auto-Captured ({chosen_source})",
            supporting_evidence_ids=item.evidence_ids,
            auto_captured=True,
            capture_source=chosen_source
        )

    def sync_from_approved_proposal(
        self,
        proposal_id: str,
        account_id: str,
        account_name: str,
        title: str,
        action_type: str,
        payload: Dict[str, Any],
        evidence_ids: List[str] = [],
        investigation_id: Optional[str] = None,
        status: ActionExecutionStatus = ActionExecutionStatus.APPROVED,
        execution_result: Optional[Dict[str, Any]] = None,
        assigned_to: str = "CSM Team"
    ) -> ActionTrackerItem:
        # Check if already tracked
        existing = [i for i in self._items.values() if i.proposal_id == proposal_id]
        if existing:
            item = existing[0]
            item.action_status = status
            if execution_result:
                item.execution_result = execution_result
                if status == ActionExecutionStatus.EXECUTED:
                    item.work_status = WorkStatus.IN_PROGRESS
            item.updated_at = datetime.utcnow().isoformat()
            self._items[item.id] = item
            return item

        # Create new tracked item
        work_status = WorkStatus.IN_PROGRESS if status == ActionExecutionStatus.EXECUTED else WorkStatus.NOT_STARTED
        return self.create(
            account_id=account_id,
            account_name=account_name,
            title=title,
            action_type=action_type,
            proposal_id=proposal_id,
            description=payload.get("subject") or payload.get("title") or title,
            investigation_id=investigation_id,
            evidence_ids=evidence_ids,
            recommendation_payload=payload,
            action_status=status,
            work_status=work_status,
            assigned_to=assigned_to,
            execution_result=execution_result
        )

action_tracker_repo = ActionTrackerRepository()
