import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.config import settings
from app.models.schemas import (
    AccountRiskSummary,
    AccountDetail,
    Contact,
    Signal,
    EvidenceRecord,
    RiskLevel,
    SourceCategory
)
from app.services.risk_engine import DeterministicRiskEngine

logger = logging.getLogger("revora.repository")
SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "seed_data.json"

class AccountRepository:
    def __init__(self):
        self.mongo_client = None
        self.db = None
        self._accounts_data: List[Dict[str, Any]] = []
        self._contacts_data: List[Dict[str, Any]] = []
        self._signals_data: List[Dict[str, Any]] = []
        self._init_mongodb()
        self._load_seed_data()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                self.mongo_client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500)
                # Quick ping to verify connection
                self.mongo_client.admin.command('ping')
                self.db = self.mongo_client[settings.MONGODB_DB_NAME]
                logger.info(f"MongoDB connected successfully to database: {settings.MONGODB_DB_NAME}")
            except Exception as e:
                logger.warning(f"Could not connect to MongoDB: {e}. Falling back to local store.")
                self.mongo_client = None
                self.db = None

    def _load_seed_data(self):
        if not SEED_FILE.exists():
            return
        try:
            with open(SEED_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._accounts_data = data.get("accounts", [])
                self._contacts_data = data.get("contacts", [])
                self._signals_data = data.get("signals", [])
        except Exception as e:
            logger.error(f"Error loading seed file: {e}")

    def get_all_accounts_with_risk(self) -> List[AccountRiskSummary]:
        accounts_to_process = []

        # 1. Attempt MongoDB fetch if client available
        if self.db is not None:
            try:
                docs = list(self.db.accounts.find({}, {"_id": 0}))
                if docs and len(docs) > 0:
                    accounts_to_process = docs
            except Exception as e:
                logger.warning(f"MongoDB accounts query failed: {e}. Using seed accounts.")

        if not accounts_to_process:
            accounts_to_process = self._accounts_data

        results = []
        for acc in accounts_to_process:
            signals_summary = acc.get("signals_summary", {})
            
            # If signals_summary is not attached directly, derive from signals
            if not signals_summary:
                acc_signals = self.get_account_signals(acc["id"])
                usage_drop = 0.0
                crit_tickets = 0
                days_since_touch = 20
                for s in acc_signals:
                    meta = s.metadata or {}
                    if s.signal_type == "usage_drop":
                        usage_drop = max(usage_drop, float(meta.get("drop_pct", 0.0)))
                    elif s.signal_type == "support_ticket" and meta.get("priority") == "critical":
                        crit_tickets += 1
                    elif s.signal_type == "touchpoint_lag":
                        days_since_touch = max(days_since_touch, int(meta.get("days_since_touchpoint", 20)))
                signals_summary = {
                    "days_to_renewal": 45,
                    "usage_drop_pct": usage_drop,
                    "days_since_last_touchpoint": days_since_touch,
                    "open_critical_tickets": crit_tickets
                }

            days_to_ren = signals_summary.get("days_to_renewal", 60)
            eval_res = DeterministicRiskEngine.evaluate(
                days_to_renewal=days_to_ren,
                usage_drop_pct=float(signals_summary.get("usage_drop_pct", 0.0)),
                days_since_last_touchpoint=int(signals_summary.get("days_since_last_touchpoint", 15)),
                open_critical_tickets=int(signals_summary.get("open_critical_tickets", 0)),
                arr=float(acc.get("arr", 0.0))
            )

            results.append(AccountRiskSummary(
                id=acc["id"],
                name=acc["name"],
                domain=acc.get("domain"),
                arr=float(acc["arr"]),
                renewal_date=str(acc["renewal_date"]),
                csm_owner=acc["csm_owner"],
                industry=acc.get("industry"),
                health_score=acc.get("health_score"),
                tier=acc.get("tier", "Standard"),
                status=acc.get("status", "active"),
                risk_level=RiskLevel(eval_res["risk_level"]),
                risk_score=eval_res["risk_score"],
                urgency_days_to_renewal=days_to_ren,
                primary_reason_code=eval_res["primary_reason_code"],
                contributing_factors=eval_res["contributing_factors"]
            ))

        # Sort by deterministic risk_score descending, then ARR descending
        results.sort(key=lambda a: (a.risk_score, a.arr), reverse=True)
        return results

    def get_account_by_id(self, account_id: str) -> Optional[AccountDetail]:
        raw_account = None
        if self.db is not None:
            try:
                doc = self.db.accounts.find_one({"id": account_id}, {"_id": 0})
                if doc:
                    raw_account = doc
            except Exception as e:
                logger.warning(f"MongoDB get_account error: {e}")

        if not raw_account:
            for acc in self._accounts_data:
                if acc["id"] == account_id:
                    raw_account = acc
                    break

        if not raw_account:
            return None

        # Fetch associated contacts and signals
        contacts = self.get_account_contacts(account_id)
        signals = self.get_account_signals(account_id)

        signals_summary = raw_account.get("signals_summary", {})
        days_to_ren = signals_summary.get("days_to_renewal", 60)
        eval_res = DeterministicRiskEngine.evaluate(
            days_to_renewal=days_to_ren,
            usage_drop_pct=float(signals_summary.get("usage_drop_pct", 0.0)),
            days_since_last_touchpoint=int(signals_summary.get("days_since_last_touchpoint", 15)),
            open_critical_tickets=int(signals_summary.get("open_critical_tickets", 0)),
            arr=float(raw_account.get("arr", 0.0))
        )

        return AccountDetail(
            id=raw_account["id"],
            name=raw_account["name"],
            domain=raw_account.get("domain"),
            arr=float(raw_account["arr"]),
            renewal_date=str(raw_account["renewal_date"]),
            csm_owner=raw_account["csm_owner"],
            industry=raw_account.get("industry"),
            health_score=raw_account.get("health_score"),
            tier=raw_account.get("tier", "Standard"),
            status=raw_account.get("status", "active"),
            risk_level=RiskLevel(eval_res["risk_level"]),
            risk_score=eval_res["risk_score"],
            urgency_days_to_renewal=days_to_ren,
            primary_reason_code=eval_res["primary_reason_code"],
            contributing_factors=eval_res["contributing_factors"],
            contacts=contacts,
            signals=signals
        )

    def get_account_contacts(self, account_id: str) -> List[Contact]:
        if self.db is not None:
            try:
                docs = list(self.db.contacts.find({"account_id": account_id}, {"_id": 0}))
                if docs and len(docs) > 0:
                    return [Contact(**c) for c in docs]
            except Exception as e:
                logger.warning(f"MongoDB contacts query failed: {e}")

        matches = [c for c in self._contacts_data if c["account_id"] == account_id]
        return [Contact(**c) for c in matches]

    def get_account_signals(self, account_id: str) -> List[Signal]:
        if self.db is not None:
            try:
                docs = list(self.db.signals.find({"account_id": account_id}, {"_id": 0}).sort("timestamp", -1))
                if docs and len(docs) > 0:
                    return [Signal(**s) for s in docs]
            except Exception as e:
                logger.warning(f"MongoDB signals query failed: {e}")

        matches = [s for s in self._signals_data if s["account_id"] == account_id]
        return [Signal(**s) for s in matches]

    def get_evidence_for_account(self, account_id: str) -> List[EvidenceRecord]:
        signals = self.get_account_signals(account_id)
        records = []
        for s in signals:
            try:
                cat = SourceCategory(s.source_category.lower())
            except ValueError:
                cat = SourceCategory.USAGE

            dt = datetime.fromisoformat(s.timestamp.replace("Z", "+00:00"))
            records.append(EvidenceRecord(
                id=s.id,
                account_id=s.account_id,
                source_category=cat,
                title=s.title,
                summary=s.summary,
                timestamp=dt,
                metadata=s.metadata,
                raw_reference=f"source://{s.source_category}/{s.id}"
            ))
        return records

account_repo = AccountRepository()
