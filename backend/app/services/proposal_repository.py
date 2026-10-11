import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import ActionProposal, ActionStatus

logger = logging.getLogger("revora.proposals")

class ProposalRepository:
    def __init__(self):
        # In-memory cache & fallback store initialized with seed proposals for demo accounts
        self._proposals: Dict[str, ActionProposal] = {}
        self._audit_logs: List[Dict[str, Any]] = []
        self.db = None
        self._init_mongodb()
        self._init_seed_proposals()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"ProposalRepository MongoDB fallback to memory: {e}")
                self.db = None

    @staticmethod
    def calculate_hash(action_type: str, title: str, payload: Dict[str, Any]) -> str:
        serialized = json.dumps({"action_type": action_type, "title": title, "payload": payload}, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

    def _init_seed_proposals(self):
        # Proposal for Acme Technologies (acc-101)
        p1_payload = {
            "recipient": "vp-eng@acme.com",
            "subject": "Acme Technologies Renewal & Service Continuity Check-in",
            "body": "Hi team, noticed usage changes and approaching renewal in 43 days. Let's schedule 20 mins to review tier options and optimize adoption readiness.",
            "evidence_ids": ["sig-101", "sig-102", "sig-103"]
        }
        p1_hash = self.calculate_hash("csm_outreach_email", "Urgent Renewal Outreach Email", p1_payload)
        p1 = ActionProposal(
            id="prop-101",
            account_id="acc-101",
            action_type="csm_outreach_email",
            title="Urgent Renewal Outreach Email",
            payload=p1_payload,
            status=ActionStatus.PROPOSED,
            version=1,
            content_hash=p1_hash,
            created_at=datetime.utcnow()
        )
        self._proposals["prop-101"] = p1

        # Proposal for HyperScale Labs (acc-104)
        p2_payload = {
            "target": "Salesforce CRM",
            "field": "Risk Flag",
            "value": "Executive Disengagement & API Drop",
            "evidence_ids": ["EVID-004", "EVID-005"]
        }
        p2_hash = self.calculate_hash("crm_update", "Update CRM Account Status to High Churn Risk", p2_payload)
        p2 = ActionProposal(
            id="prop-102",
            account_id="acc-104",
            action_type="crm_update",
            title="Update CRM Account Status to High Churn Risk",
            payload=p2_payload,
            status=ActionStatus.PROPOSED,
            version=1,
            content_hash=p2_hash,
            created_at=datetime.utcnow()
        )
        self._proposals["prop-102"] = p2

        if self.db is not None:
            try:
                for p in [p1, p2]:
                    doc = p.model_dump()
                    doc["created_at"] = doc["created_at"].isoformat()
                    self.db.action_proposals.update_one({"id": p.id}, {"$setOnInsert": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"Error seeding MongoDB proposals: {e}")

    def get_proposals_for_account(self, account_id: str) -> List[ActionProposal]:
        if self.db is not None:
            try:
                docs = list(self.db.action_proposals.find({"account_id": account_id}, {"_id": 0}))
                if docs:
                    return [ActionProposal(**doc) for doc in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_proposals_for_account error: {e}")
        return [p for p in self._proposals.values() if p.account_id == account_id]

    def get_proposal_by_id(self, proposal_id: str) -> Optional[ActionProposal]:
        if self.db is not None:
            try:
                doc = self.db.action_proposals.find_one({"id": proposal_id}, {"_id": 0})
                if doc:
                    return ActionProposal(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_proposal_by_id error: {e}")
        return self._proposals.get(proposal_id)

    def update_proposal(self, proposal_id: str, new_title: str, new_payload: Dict[str, Any]) -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        # Increment version and compute new content hash
        prop.version += 1
        prop.title = new_title
        prop.payload = new_payload
        prop.content_hash = self.calculate_hash(prop.action_type, new_title, new_payload)
        
        # Invalidate any prior approval
        prop.status = ActionStatus.PROPOSED
        prop.approved_by = None
        prop.approved_at = None

        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB update_proposal error: {e}")

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_updated",
            actor="csm_user",
            details={"new_version": prop.version, "content_hash": prop.content_hash}
        )
        return prop

    def approve_proposal(self, proposal_id: str, approver: str, expected_hash: Optional[str] = None) -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        # Verify proposal status
        if prop.status == ActionStatus.APPROVED:
            raise ValueError(f"Proposal {proposal_id} is already approved.")
        if prop.status in (ActionStatus.EXECUTING, ActionStatus.SUCCEEDED):
            raise ValueError(f"Proposal {proposal_id} has already executed.")

        if expected_hash and prop.content_hash != expected_hash:
            raise ValueError("Stale approval error: Proposal content has changed since it was reviewed.")

        now = datetime.utcnow()
        prop.status = ActionStatus.APPROVED
        prop.approved_by = approver
        prop.approved_at = now

        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                doc["approved_at"] = doc["approved_at"].isoformat() if doc.get("approved_at") else None
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)

                # Persist approval decision to approvals table/collection
                approval_doc = {
                    "id": f"appr-{prop.id}",
                    "proposal_id": prop.id,
                    "account_id": prop.account_id,
                    "reviewer": approver,
                    "decision": "approved",
                    "content_hash": prop.content_hash,
                    "version": prop.version,
                    "timestamp": now.isoformat()
                }
                self.db.approvals.insert_one(approval_doc)
            except Exception as e:
                logger.warning(f"MongoDB approve_proposal error: {e}")

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_approved",
            actor=approver,
            details={"version": prop.version, "hash": prop.content_hash, "decision": "approved"}
        )
        return prop

    def reject_proposal(self, proposal_id: str, reason: str, reviewer: str = "CSM User") -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        if prop.status in (ActionStatus.EXECUTING, ActionStatus.SUCCEEDED):
            raise ValueError(f"Cannot reject proposal {proposal_id}; action has already been executed.")

        now = datetime.utcnow()
        prop.status = ActionStatus.REJECTED
        prop.updated_at = now
        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                if doc.get("updated_at"):
                    doc["updated_at"] = doc["updated_at"].isoformat()
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)

                # Persist rejection decision to approvals table/collection
                approval_doc = {
                    "id": f"rej-{prop.id}",
                    "proposal_id": prop.id,
                    "account_id": prop.account_id,
                    "reviewer": reviewer,
                    "decision": "rejected",
                    "decision_reason": reason,
                    "content_hash": prop.content_hash,
                    "version": prop.version,
                    "timestamp": now.isoformat()
                }
                self.db.approvals.insert_one(approval_doc)
            except Exception as e:
                logger.warning(f"MongoDB reject_proposal error: {e}")

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_rejected",
            actor=reviewer,
            details={"reason": reason, "decision": "rejected"}
        )
        return prop

    def record_execution_outcome(self, proposal_id: str, status: ActionStatus, result: Dict[str, Any]):
        prop = self.get_proposal_by_id(proposal_id)
        if prop:
            prop.status = status
            prop.execution_result = result
            self._proposals[prop.id] = prop

            if self.db is not None:
                try:
                    doc = prop.model_dump()
                    doc["created_at"] = doc["created_at"].isoformat()
                    if doc.get("approved_at"):
                        doc["approved_at"] = doc["approved_at"].isoformat()
                    self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)
                except Exception as e:
                    logger.warning(f"MongoDB record_execution_outcome error: {e}")

            self._record_audit(
                account_id=prop.account_id,
                proposal_id=prop.id,
                event_type=f"action_{status.value}",
                actor="action_executor",
                details=result
            )

    def create_proposal(
        self,
        account_id: str,
        action_type: str,
        title: str,
        payload: Dict[str, Any],
        evidence_ids: List[str] = [],
        reason: Optional[str] = None,
        investigation_id: Optional[str] = None,
        status: ActionStatus = ActionStatus.PROPOSED
    ) -> ActionProposal:
        import uuid
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        content_hash = self.calculate_hash(action_type, title, payload)
        proposal = ActionProposal(
            id=prop_id,
            account_id=account_id,
            action_type=action_type,
            title=title,
            reason=reason,
            investigation_id=investigation_id,
            evidence_ids=evidence_ids,
            payload=payload,
            status=status,
            version=1,
            content_hash=content_hash,
            created_at=datetime.utcnow()
        )
        self._proposals[prop_id] = proposal

        # Persist to action_proposals table / collection
        if self.db is not None:
            try:
                doc = proposal.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                self.db.action_proposals.insert_one(doc)
            except Exception as e:
                logger.warning(f"MongoDB insert action_proposal error: {e}")

        # If it's a task_create proposal, also register to tasks table
        if action_type == "task_create":
            self.create_task_from_proposal(proposal)

        self._record_audit(
            account_id=account_id,
            proposal_id=prop_id,
            event_type="proposal_created",
            actor="action_copilot",
            details={"action_type": action_type, "title": title, "content_hash": content_hash}
        )
        return proposal

    def patch_proposal(
        self,
        proposal_id: str,
        title: Optional[str] = None,
        reason: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        status: Optional[ActionStatus] = None
    ) -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        needs_hash_recalc = False
        if title is not None and title != prop.title:
            prop.title = title
            needs_hash_recalc = True
        if reason is not None:
            prop.reason = reason
        if payload is not None and payload != prop.payload:
            prop.payload = payload
            needs_hash_recalc = True

        if needs_hash_recalc:
            prop.version += 1
            prop.content_hash = self.calculate_hash(prop.action_type, prop.title, prop.payload)
            # Reset approval if content changes
            prop.status = ActionStatus.PROPOSED
            prop.approved_by = None
            prop.approved_at = None

        if status is not None:
            prop.status = status

        prop.updated_at = datetime.utcnow()
        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                if doc.get("updated_at"):
                    doc["updated_at"] = doc["updated_at"].isoformat()
                if doc.get("approved_at"):
                    doc["approved_at"] = doc["approved_at"].isoformat()
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB patch_proposal error: {e}")

        # If it's a task_create, sync with tasks collection
        if prop.action_type == "task_create":
            self.create_task_from_proposal(prop)

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_patched",
            actor="csm_user",
            details={"version": prop.version, "status": prop.status.value, "content_hash": prop.content_hash}
        )
        return prop

    def create_task_from_proposal(self, prop: ActionProposal) -> Dict[str, Any]:
        task_doc = {
            "id": f"task-{prop.id}",
            "proposal_id": prop.id,
            "account_id": prop.account_id,
            "title": prop.payload.get("title", prop.title),
            "description": prop.payload.get("description", prop.reason or ""),
            "assigned_to": prop.payload.get("assigned_to", "CSM Owner"),
            "due_date": prop.payload.get("due_date", ""),
            "priority": prop.payload.get("priority", "high"),
            "status": prop.status.value,
            "evidence_ids": prop.evidence_ids,
            "created_at": prop.created_at.isoformat() if hasattr(prop.created_at, "isoformat") else str(prop.created_at)
        }
        if self.db is not None:
            try:
                self.db.tasks.update_one({"proposal_id": prop.id}, {"$set": task_doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB tasks table upsert error: {e}")
        return task_doc

    def get_tasks_for_account(self, account_id: str) -> List[Dict[str, Any]]:
        if self.db is not None:
            try:
                docs = list(self.db.tasks.find({"account_id": account_id}, {"_id": 0}))
                if docs:
                    return docs
            except Exception as e:
                logger.warning(f"MongoDB get_tasks error: {e}")
        # In-memory fallback
        return [
            {
                "id": f"task-{p.id}",
                "proposal_id": p.id,
                "account_id": p.account_id,
                "title": p.payload.get("title", p.title),
                "description": p.payload.get("description", p.reason or ""),
                "assigned_to": p.payload.get("assigned_to", "CSM Owner"),
                "due_date": p.payload.get("due_date", ""),
                "priority": p.payload.get("priority", "high"),
                "status": p.status.value,
                "evidence_ids": p.evidence_ids,
                "created_at": p.created_at.isoformat()
            }
            for p in self._proposals.values()
            if p.account_id == account_id and p.action_type == "task_create"
        ]

    def _record_audit(self, account_id: str, proposal_id: Optional[str], event_type: str, actor: str, details: Dict[str, Any]):
        audit_entry = {
            "account_id": account_id,
            "proposal_id": proposal_id,
            "event_type": event_type,
            "actor": actor,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._audit_logs.append(audit_entry)

        if self.db is not None:
            try:
                self.db.audit_events.insert_one(audit_entry)
            except Exception as e:
                logger.warning(f"MongoDB audit insert error: {e}")

    def get_all_proposals(self, status: Optional[str] = None) -> List[ActionProposal]:
        if self.db is not None:
            try:
                query = {}
                if status:
                    query["status"] = status
                docs = list(self.db.action_proposals.find(query, {"_id": 0}))
                if docs:
                    return [ActionProposal(**doc) for doc in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_all_proposals error: {e}")
        proposals = list(self._proposals.values())
        if status:
            proposals = [p for p in proposals if p.status.value == status]
        return proposals

    def get_all_approvals(self) -> List[Dict[str, Any]]:
        if self.db is not None:
            try:
                docs = list(self.db.approvals.find({}, {"_id": 0}).sort("timestamp", -1))
                if docs:
                    return docs
            except Exception as e:
                logger.warning(f"MongoDB get_all_approvals error: {e}")
        return [
            {
                "id": f"appr-{p.id}",
                "proposal_id": p.id,
                "account_id": p.account_id,
                "reviewer": p.approved_by or "CSM User",
                "decision": p.status.value,
                "content_hash": p.content_hash,
                "version": p.version,
                "timestamp": p.approved_at.isoformat() if p.approved_at else str(p.created_at)
            }
            for p in self._proposals.values()
            if p.status in (ActionStatus.APPROVED, ActionStatus.REJECTED)
        ]

    def get_all_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        if self.db is not None:
            try:
                docs = list(self.db.audit_events.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
                if docs:
                    return docs
            except Exception as e:
                logger.warning(f"MongoDB get_all_audit_logs error: {e}")
        logs = list(reversed(self._audit_logs))
        return logs[:limit]

    def get_audit_logs_for_account(self, account_id: str) -> List[Dict[str, Any]]:
        if self.db is not None:
            try:
                docs = list(self.db.audit_events.find({"account_id": account_id}, {"_id": 0}))
                if docs:
                    return docs
            except Exception as e:
                logger.warning(f"MongoDB get_audit_logs error: {e}")
        return [log for log in self._audit_logs if log["account_id"] == account_id]

proposal_repo = ProposalRepository()


