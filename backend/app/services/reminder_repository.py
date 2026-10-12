import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.core.config import settings
from app.models.schemas import (
    DynamicReminder,
    ReminderType,
    ReminderStatus
)

logger = logging.getLogger("revora.reminders")

class ReminderRepository:
    def __init__(self):
        self._reminders: Dict[str, DynamicReminder] = {}
        self.db = None
        self._init_mongodb()
        self._init_seed_reminders()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"ReminderRepository MongoDB fallback to memory: {e}")
                self.db = None

    def _init_seed_reminders(self):
        now = datetime.now(timezone.utc).isoformat()
        
        r1 = DynamicReminder(
            id="rem-101",
            account_id="acc-101",
            account_name="Acme Technologies",
            reminder_type=ReminderType.USAGE_DROP,
            title="License Contraction Alert: -38% drop in active seats",
            description="Usage contracted from 240 baseline seats to 148 active seats. Okta SAML certificate failure reported.",
            severity="critical",
            trigger_condition="usage_drop_pct >= 25% (observed: -38%)",
            issue_key="acc-101:usage_drop",
            status=ReminderStatus.ACTIVE,
            associated_task_id="task-acc-101",
            due_date="2026-11-08",
            created_at=now,
            updated_at=now,
            evidence_ids=["sig-101", "sig-102"],
            csm_owner="Sarah Jenkins"
        )

        r2 = DynamicReminder(
            id="rem-102",
            account_id="acc-102",
            account_name="CloudNova Systems",
            reminder_type=ReminderType.OVERDUE_FOLLOWUP,
            title="Overdue Action Follow-up: Resolve SSO Deployment Blockers",
            description="Follow-up task task-acc-102 is overdue. Engineering resolution session required to clear SAML handshake blocker.",
            severity="high",
            trigger_condition="task_status == pending and due_date overdue",
            issue_key="acc-102:overdue_task:task-acc-102",
            status=ReminderStatus.ACTIVE,
            associated_task_id="task-acc-102",
            due_date="2026-11-09",
            created_at=now,
            updated_at=now,
            evidence_ids=["sig-104"],
            csm_owner="Marcus Chen"
        )

        r3 = DynamicReminder(
            id="rem-104",
            account_id="acc-104",
            account_name="HyperScale Labs",
            reminder_type=ReminderType.REDUCED_ENGAGEMENT,
            title="Touchpoint Inactivity: 50 days since last customer check-in",
            description="Elena Rostova (VP of Infrastructure) has not had a recorded CSM meeting for 50 days while Kafka webhook timeout reports persist.",
            severity="high",
            trigger_condition="days_since_last_touchpoint >= 21 (observed: 50d)",
            issue_key="acc-104:reduced_engagement",
            status=ReminderStatus.ACTIVE,
            due_date="2026-11-12",
            created_at=now,
            updated_at=now,
            evidence_ids=["sig-hs-touch-101"],
            csm_owner="Elena Rostova"
        )

        for r in [r1, r2, r3]:
            self._reminders[r.id] = r
            if self.db is not None:
                try:
                    doc = r.model_dump()
                    self.db.reminders.update_one({"id": r.id}, {"$setOnInsert": doc}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error seeding MongoDB reminder {r.id}: {e}")

    def get_all(
        self,
        account_id: Optional[str] = None,
        status: Optional[str] = None,
        reminder_type: Optional[str] = None,
        severity: Optional[str] = None
    ) -> List[DynamicReminder]:
        raw_list = []
        if self.db is not None:
            try:
                query = {}
                if account_id:
                    query["account_id"] = account_id
                if status:
                    query["status"] = status
                if reminder_type:
                    query["reminder_type"] = reminder_type
                if severity:
                    query["severity"] = severity
                docs = list(self.db.reminders.find(query, {"_id": 0}))
                if docs:
                    raw_list = [DynamicReminder(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_all reminders error: {e}")

        if not raw_list:
            reminders = list(self._reminders.values())
            if account_id:
                reminders = [r for r in reminders if r.account_id == account_id]
            if status:
                reminders = [r for r in reminders if r.status.value == status or r.status == status]
            if reminder_type:
                reminders = [r for r in reminders if r.reminder_type.value == reminder_type or r.reminder_type == reminder_type]
            if severity:
                reminders = [r for r in reminders if r.severity == severity]
            raw_list = reminders

        # Enforce issue_key uniqueness for active reminders
        seen_keys = set()
        deduped = []
        for r in sorted(raw_list, key=lambda r: r.updated_at, reverse=True):
            if (status == "active" or r.status == ReminderStatus.ACTIVE or r.status.value == "active") and r.issue_key:
                if r.issue_key in seen_keys:
                    continue
                seen_keys.add(r.issue_key)
            deduped.append(r)
        return deduped

    def get_by_id(self, reminder_id: str) -> Optional[DynamicReminder]:
        if self.db is not None:
            try:
                doc = self.db.reminders.find_one({"id": reminder_id}, {"_id": 0})
                if doc:
                    return DynamicReminder(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_reminder_by_id error: {e}")
        return self._reminders.get(reminder_id)

    def get_active_by_issue_key(self, issue_key: str) -> Optional[DynamicReminder]:
        """Finds any currently active reminder with the given issue key to prevent duplicates."""
        if self.db is not None:
            try:
                doc = self.db.reminders.find_one({"issue_key": issue_key, "status": "active"}, {"_id": 0})
                if doc:
                    return DynamicReminder(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_active_by_issue_key error: {e}")

        for r in self._reminders.values():
            if r.issue_key == issue_key and r.status == ReminderStatus.ACTIVE:
                return r
        return None

    def save_reminder(self, reminder: DynamicReminder) -> DynamicReminder:
        self._reminders[reminder.id] = reminder
        if self.db is not None:
            try:
                doc = reminder.model_dump()
                self.db.reminders.update_one({"id": reminder.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB save_reminder error: {e}")
        return reminder

    def update_status(
        self,
        reminder_id: str,
        status: ReminderStatus,
        dismissed_reason: Optional[str] = None
    ) -> Optional[DynamicReminder]:
        reminder = self.get_by_id(reminder_id)
        if not reminder:
            return None

        now = datetime.now(timezone.utc).isoformat()
        reminder.status = status
        reminder.updated_at = now
        if dismissed_reason is not None:
            reminder.dismissed_reason = dismissed_reason

        return self.save_reminder(reminder)

    def update_by_associated_task(self, task_id: str, new_status: str) -> List[DynamicReminder]:
        """
        Automatically updates reminder status when the associated task is completed or dismissed.
        """
        target_status = None
        if new_status in ("completed", "succeeded", "executed"):
            target_status = ReminderStatus.COMPLETED
        elif new_status in ("dismissed", "rejected"):
            target_status = ReminderStatus.DISMISSED

        if not target_status:
            return []

        updated = []
        # Search all active reminders linked to this task
        for r in list(self._reminders.values()):
            if r.associated_task_id == task_id and r.status == ReminderStatus.ACTIVE:
                r.status = target_status
                r.updated_at = datetime.now(timezone.utc).isoformat()
                if target_status == ReminderStatus.COMPLETED:
                    r.dismissed_reason = f"Associated task {task_id} completed"
                elif target_status == ReminderStatus.DISMISSED:
                    r.dismissed_reason = f"Associated task {task_id} dismissed/rejected"
                self.save_reminder(r)
                updated.append(r)

        if self.db is not None:
            try:
                reason = f"Associated task {task_id} {new_status}"
                self.db.reminders.update_many(
                    {"associated_task_id": task_id, "status": "active"},
                    {"$set": {
                        "status": target_status.value,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "dismissed_reason": reason
                    }}
                )
            except Exception as e:
                logger.warning(f"MongoDB update_by_associated_task error: {e}")

        logger.info(f"Updated {len(updated)} reminders linked to task {task_id} to status {target_status.value}")
        return updated

reminder_repo = ReminderRepository()
