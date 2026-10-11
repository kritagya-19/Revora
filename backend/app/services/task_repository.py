import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import ProposedTask, CreateTaskRequest, UpdateTaskRequest

logger = logging.getLogger("revora.tasks")

class TaskRepository:
    def __init__(self):
        self._tasks: Dict[str, ProposedTask] = {}
        self.db = None
        self._init_mongodb()
        self._init_seed_tasks()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"TaskRepository MongoDB fallback to memory: {e}")
                self.db = None

    def _init_seed_tasks(self):
        now = datetime.utcnow().isoformat()
        tasks_data = [
            {
                "id": "task-acc-101",
                "account_id": "acc-101",
                "title": "Executive Sponsor Alignment Call",
                "description": "Schedule direct check-in with Dave Miller to address delivery tickets.",
                "assigned_to": "Sarah Jenkins",
                "due_date": "2026-11-08",
                "priority": "high",
                "status": "pending",
                "evidence_ids": ["sig-101", "sig-102"],
                "created_at": now
            },
            {
                "id": "task-acc-102",
                "account_id": "acc-102",
                "title": "Resolve SSO Deployment Blockers with Engineering",
                "description": "Coordinate with CloudNova lead architect to clear ticket #4402.",
                "assigned_to": "Marcus Chen",
                "due_date": "2026-11-09",
                "priority": "high",
                "status": "pending",
                "evidence_ids": ["sig-104"],
                "created_at": now
            },
            {
                "id": "task-acc-103",
                "account_id": "acc-103",
                "title": "Verify APAC Inactivity Rebound",
                "description": "Monitor Singapore branch query logs to verify post-holiday traffic normalizes.",
                "assigned_to": "Sarah Jenkins",
                "due_date": "2026-11-12",
                "priority": "low",
                "status": "pending",
                "evidence_ids": ["sig-113"],
                "created_at": now
            },
            {
                "id": "task-acc-104",
                "account_id": "acc-104",
                "title": "Escalate API Outage Root Cause to VP Engineering",
                "description": "Provide HyperScale Robotics team with post-mortem incident report.",
                "assigned_to": "Alex Rivera",
                "due_date": "2026-11-05",
                "priority": "high",
                "status": "pending",
                "evidence_ids": ["sig-109", "sig-110"],
                "created_at": now
            },
            {
                "id": "task-acc-105",
                "account_id": "acc-105",
                "title": "Deliver Q1 License Expansion Contract",
                "description": "Send updated Master Services Agreement with 50 added hospital seats.",
                "assigned_to": "Marcus Chen",
                "due_date": "2026-11-10",
                "priority": "medium",
                "status": "pending",
                "evidence_ids": ["sig-111", "sig-112"],
                "created_at": now
            },
            {
                "id": "task-acc-106",
                "account_id": "acc-106",
                "title": "Schedule Executive Risk Intercept with CIO",
                "description": "Coordinate joint review of financial latency and renewal terms.",
                "assigned_to": "Sarah Jenkins",
                "due_date": "2026-11-07",
                "priority": "high",
                "status": "pending",
                "evidence_ids": ["sig-107"],
                "created_at": now
            },
            {
                "id": "task-acc-107",
                "account_id": "acc-107",
                "title": "Confirm Peak Season Black Friday SLA",
                "description": "Validate 99.99% uptime parameters ahead of Q4 e-commerce sales rush.",
                "assigned_to": "Alex Rivera",
                "due_date": "2026-11-15",
                "priority": "medium",
                "status": "pending",
                "evidence_ids": ["sig-114"],
                "created_at": now
            },
            {
                "id": "task-acc-108",
                "account_id": "acc-108",
                "title": "Quarterly Media Infrastructure Sync",
                "description": "Meet with Head of Content Delivery to review publishing bandwidth.",
                "assigned_to": "Marcus Chen",
                "due_date": "2026-11-11",
                "priority": "low",
                "status": "pending",
                "evidence_ids": ["sig-115"],
                "created_at": now
            }
        ]

        for td in tasks_data:
            tsk = ProposedTask(**td)
            self._tasks[tsk.id] = tsk
            if self.db is not None:
                try:
                    self.db.tasks.update_one({"id": tsk.id}, {"$setOnInsert": tsk.model_dump()}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error seeding MongoDB task {tsk.id}: {e}")

    def get_all_tasks(self, account_id: Optional[str] = None, status: Optional[str] = None) -> List[ProposedTask]:
        if self.db is not None:
            try:
                query = {}
                if account_id:
                    query["account_id"] = account_id
                if status:
                    query["status"] = status
                docs = list(self.db.tasks.find(query, {"_id": 0}))
                if docs:
                    return [ProposedTask(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_all_tasks error: {e}")
        
        tasks = list(self._tasks.values())
        if account_id:
            tasks = [t for t in tasks if t.account_id == account_id]
        if status:
            tasks = [t for t in tasks if t.status == status]
        return tasks

    def get_task_by_id(self, task_id: str) -> Optional[ProposedTask]:
        if self.db is not None:
            try:
                doc = self.db.tasks.find_one({"id": task_id}, {"_id": 0})
                if doc:
                    return ProposedTask(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_task_by_id error: {e}")
        return self._tasks.get(task_id)

    def create_task(self, req: CreateTaskRequest) -> ProposedTask:
        task_id = f"task-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        task = ProposedTask(
            id=task_id,
            account_id=req.account_id,
            title=req.title,
            description=req.description or "",
            assigned_to=req.assigned_to or "CSM Owner",
            due_date=req.due_date or "",
            priority=req.priority or "high",
            status="pending",
            evidence_ids=req.evidence_ids,
            created_at=now
        )
        self._tasks[task.id] = task

        if self.db is not None:
            try:
                doc = task.model_dump()
                self.db.tasks.update_one({"id": task.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB create_task error: {e}")

        # Record audit log
        from app.services.proposal_repository import proposal_repo
        proposal_repo._record_audit(
            account_id=task.account_id,
            proposal_id=None,
            event_type="task_created",
            actor=task.assigned_to,
            details={"task_id": task.id, "title": task.title, "priority": task.priority}
        )
        return task

    def update_task(self, task_id: str, req: UpdateTaskRequest) -> ProposedTask:
        task = self.get_task_by_id(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if req.title is not None:
            task.title = req.title
        if req.description is not None:
            task.description = req.description
        if req.assigned_to is not None:
            task.assigned_to = req.assigned_to
        if req.due_date is not None:
            task.due_date = req.due_date
        if req.priority is not None:
            task.priority = req.priority
        if req.status is not None:
            task.status = req.status

        self._tasks[task.id] = task

        if self.db is not None:
            try:
                doc = task.model_dump()
                self.db.tasks.update_one({"id": task.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB update_task error: {e}")

        from app.services.proposal_repository import proposal_repo
        proposal_repo._record_audit(
            account_id=task.account_id,
            proposal_id=None,
            event_type="task_updated",
            actor=task.assigned_to,
            details={"task_id": task.id, "new_status": task.status}
        )

        # Synchronize linked reminder status (Task B requirement)
        if req.status is not None:
            try:
                from app.services.reminder_repository import reminder_repo
                reminder_repo.update_by_associated_task(task_id, req.status)
            except Exception as rem_err:
                logger.warning(f"Error syncing reminder status for task {task_id}: {rem_err}")

        return task

task_repo = TaskRepository()
