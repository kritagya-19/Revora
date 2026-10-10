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
        # Proposal for Acme Dynamics (acc-101)
        p1_payload = {
            "recipient": "vp-eng@acme.com",
            "subject": "Acme Dynamics Renewal & Service Continuity Check-in",
            "body": "Hi team, noticed data sync concerns and approaching renewal on Nov 5. Let's schedule 20 mins to review tier options and optimize active seats.",
            "evidence_ids": ["EVID-001", "EVID-002", "EVID-003"]
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

    def approve_proposal(self, proposal_id: str, approver: str, expected_hash: str) -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        if prop.content_hash != expected_hash:
            raise ValueError("Stale approval error: Proposal content has changed since it was reviewed.")

        prop.status = ActionStatus.APPROVED
        prop.approved_by = approver
        prop.approved_at = datetime.utcnow()

        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                doc["approved_at"] = doc["approved_at"].isoformat() if doc.get("approved_at") else None
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB approve_proposal error: {e}")

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_approved",
            actor=approver,
            details={"version": prop.version, "hash": prop.content_hash}
        )
        return prop

    def reject_proposal(self, proposal_id: str, reason: str) -> ActionProposal:
        prop = self.get_proposal_by_id(proposal_id)
        if not prop:
            raise ValueError(f"Proposal {proposal_id} not found")

        prop.status = ActionStatus.PROPOSED  # Remains in review or rejected
        self._proposals[prop.id] = prop

        if self.db is not None:
            try:
                doc = prop.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                self.db.action_proposals.update_one({"id": prop.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB reject_proposal error: {e}")

        self._record_audit(
            account_id=prop.account_id,
            proposal_id=prop.id,
            event_type="proposal_rejected",
            actor="csm_user",
            details={"reason": reason}
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
