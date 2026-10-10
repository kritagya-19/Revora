import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.core.config import settings
from app.models.schemas import Investigation, AccountDetail
from app.services.llm_service import llm_service
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.investigations")

class InvestigationRepository:
    def __init__(self):
        self._investigations: Dict[str, Investigation] = {}
        self.db = None
        self._init_mongodb()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"InvestigationRepository MongoDB fallback to memory: {e}")
                self.db = None

    def get_investigation_by_id(self, investigation_id: str) -> Optional[Investigation]:
        if self.db is not None:
            try:
                doc = self.db.investigations.find_one({"id": investigation_id}, {"_id": 0})
                if doc:
                    return Investigation(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_investigation_by_id error: {e}")
        return self._investigations.get(investigation_id)

    def get_latest_for_account(self, account_id: str) -> Optional[Investigation]:
        if self.db is not None:
            try:
                doc = self.db.investigations.find_one({"account_id": account_id}, {"_id": 0}, sort=[("created_at", -1)])
                if doc:
                    return Investigation(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_latest_for_account error: {e}")
        
        # In-memory lookup
        matches = [inv for inv in self._investigations.values() if inv.account_id == account_id]
        if matches:
            matches.sort(key=lambda x: x.created_at, reverse=True)
            return matches[0]
        return None

    def create_or_run_investigation(self, account_id: str) -> Investigation:
        account = account_repo.get_account_by_id(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")

        # Generate evidence-grounded investigation via LLM / Rule engine
        investigation = llm_service.generate_investigation(account)

        # Cache in memory
        self._investigations[investigation.id] = investigation

        # Persist in MongoDB
        if self.db is not None:
            try:
                doc = investigation.model_dump()
                self.db.investigations.update_one({"id": investigation.id}, {"$set": doc}, upsert=True)
                
                # Also log in risk_assessments collection
                assessment_doc = {
                    "account_id": account.id,
                    "risk_score": account.risk_score,
                    "risk_level": account.risk_level.value,
                    "rule_version": "v1.0.0",
                    "primary_reason_code": account.primary_reason_code,
                    "contributing_factors": account.contributing_factors,
                    "evidence_ids": [s.id for s in account.signals],
                    "evaluated_at": datetime.utcnow().isoformat()
                }
                self.db.risk_assessments.insert_one(assessment_doc)
            except Exception as e:
                logger.warning(f"MongoDB persist investigation error: {e}")

        return investigation

investigation_repo = InvestigationRepository()
