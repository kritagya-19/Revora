import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.config import settings
from app.models.schemas import (
    AccountRiskSummary,
    AccountDetail,
    AccountRiskDetail,
    CustomerMetrics,
    DashboardSummary,
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

    def _enrich_signal(self, sig_data: Dict[str, Any]) -> Signal:
        meta = sig_data.get("metadata", {})
        source_cat = sig_data.get("source_category", "usage")
        sig_type = sig_data.get("signal_type", "event")
        
        # Calculate observed value
        observed = None
        if "drop_pct" in meta:
            observed = f"-{meta['drop_pct']}% usage contraction"
        elif "growth_pct" in meta:
            observed = f"+{meta['growth_pct']}% usage growth"
        elif "priority" in meta:
            observed = f"Priority: {meta['priority']} (Ticket #{meta.get('ticket_id', 'N/A')})"
        elif "days_since_touchpoint" in meta:
            observed = f"{meta['days_since_touchpoint']} days without CSM contact"
        elif "days_to_renewal" in meta:
            observed = f"Renewal in {meta['days_to_renewal']} days"
        elif "utilization_pct" in meta:
            observed = f"{meta['utilization_pct']}% seat license saturation"
        else:
            observed = sig_data.get("summary", "")[:40]

        record_id = meta.get("source_record_id") or f"REC-{sig_data.get('id', 'SIG').upper()}"

        return Signal(
            id=sig_data["id"],
            account_id=sig_data["account_id"],
            source_category=source_cat,
            source_type=source_cat,
            signal_type=sig_type,
            event_type=sig_type,
            title=sig_data["title"],
            summary=sig_data["summary"],
            description=sig_data["summary"],
            severity=sig_data.get("severity", "medium"),
            timestamp=sig_data["timestamp"],
            event_time=sig_data["timestamp"],
            observed_value=observed,
            source_record_id=record_id,
            metadata=meta
        )

    def get_all_accounts_with_risk(
        self,
        risk_level: Optional[str] = None,
        csm_owner: Optional[str] = None,
        renewal_within_days: Optional[int] = None,
        sort_by: Optional[str] = "risk_score",
        search: Optional[str] = None
    ) -> List[AccountRiskSummary]:
        accounts_to_process = []

        # 1. Attempt MongoDB fetch if client available
        if self.db is not None:
            try:
                query: Dict[str, Any] = {}
                if risk_level and risk_level.lower() != "all":
                    query["risk_level"] = risk_level.lower()
                if csm_owner:
                    query["csm_owner"] = csm_owner

                docs = list(self.db.accounts.find(query, {"_id": 0}))
                if docs and len(docs) > 0:
                    accounts_to_process = docs
            except Exception as e:
                logger.warning(f"MongoDB accounts query failed: {e}. Using seed accounts.")

        if not accounts_to_process:
            accounts_to_process = self._accounts_data

        results = []
        for acc in accounts_to_process:
            signals_summary = acc.get("signals_summary", {})
            acc_signals = self.get_account_signals(acc["id"])
            
            # If signals_summary is not attached directly, derive from signals
            if not signals_summary:
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

            # Derive main warning
            main_warning = None
            if acc_signals:
                high_sev_signals = [s for s in acc_signals if s.severity in ("high", "critical")]
                if high_sev_signals:
                    main_warning = f"{high_sev_signals[0].title}: {high_sev_signals[0].summary}"
                else:
                    main_warning = f"{acc_signals[0].title}: {acc_signals[0].summary}"
            elif eval_res["contributing_factors"]:
                main_warning = eval_res["contributing_factors"][0]
            else:
                main_warning = f"Risk reason: {eval_res['primary_reason_code']}"

            # Derive urgency label
            if days_to_ren <= 30:
                urgency_label = "Immediate (<30d)"
            elif days_to_ren <= 60:
                urgency_label = "Within 60d"
            else:
                urgency_label = "Stable (>60d)"

            calculated_level = RiskLevel(eval_res["risk_level"])

            # Apply in-memory filtering if needed
            if risk_level and risk_level.lower() != "all" and calculated_level.value != risk_level.lower():
                continue
            if csm_owner and acc.get("csm_owner") != csm_owner:
                continue
            if renewal_within_days is not None and days_to_ren > renewal_within_days:
                continue
            if search:
                s_term = search.lower()
                name_match = s_term in acc.get("name", "").lower()
                domain_match = s_term in acc.get("domain", "").lower() if acc.get("domain") else False
                csm_match = s_term in acc.get("csm_owner", "").lower()
                reason_match = s_term in eval_res["primary_reason_code"].lower()
                if not (name_match or domain_match or csm_match or reason_match):
                    continue

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
                risk_level=calculated_level,
                risk_score=eval_res["risk_score"],
                urgency_days_to_renewal=days_to_ren,
                urgency_label=urgency_label,
                primary_reason_code=eval_res["primary_reason_code"],
                main_warning=main_warning,
                contributing_factors=eval_res["contributing_factors"]
            ))

        # Sorting logic
        if sort_by == "name":
            results.sort(key=lambda a: a.name.lower())
        elif sort_by == "arr":
            results.sort(key=lambda a: a.arr, reverse=True)
        elif sort_by == "renewal_date" or sort_by == "urgency":
            results.sort(key=lambda a: a.urgency_days_to_renewal)
        else: # Default: sort by deterministic risk_score descending, then ARR descending
            results.sort(key=lambda a: (a.risk_score, a.arr), reverse=True)

        return results

    def get_dashboard_summary(self) -> DashboardSummary:
        accounts = self.get_all_accounts_with_risk()
        total_accounts = len(accounts)
        high_risk_accounts = [a for a in accounts if a.risk_level in (RiskLevel.CRITICAL, RiskLevel.HIGH)]
        renewals_due_soon = [a for a in accounts if a.urgency_days_to_renewal <= 60]

        high_risk_arr = sum(a.arr for a in high_risk_accounts)
        total_portfolio_arr = sum(a.arr for a in accounts)
        avg_risk_score = round(sum(a.risk_score for a in accounts) / total_accounts, 1) if total_accounts > 0 else 0.0

        return DashboardSummary(
            total_accounts_monitored=total_accounts,
            high_risk_accounts_count=len(high_risk_accounts),
            renewals_due_soon_count=len(renewals_due_soon),
            high_risk_arr=high_risk_arr,
            total_portfolio_arr=total_portfolio_arr,
            average_risk_score=avg_risk_score,
            rule_version="v1.0.0"
        )

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
        usage_drop = 0.0
        crit_tickets = 0
        total_tickets = 0
        days_since_touch = 15
        active_seats = 200
        baseline_seats = 240

        for s in signals:
            meta = s.metadata or {}
            if s.signal_type == "usage_drop":
                usage_drop = max(usage_drop, float(meta.get("drop_pct", 0.0)))
                active_seats = int(meta.get("current_seats", 132))
                baseline_seats = int(meta.get("baseline", 240))
            elif s.signal_type == "support_ticket":
                total_tickets += 1
                if meta.get("priority") == "critical":
                    crit_tickets += 1
            elif s.signal_type == "touchpoint_lag":
                days_since_touch = max(days_since_touch, int(meta.get("days_since_touchpoint", 20)))

        if not signals_summary:
            signals_summary = {
                "days_to_renewal": 45,
                "usage_drop_pct": usage_drop,
                "days_since_last_touchpoint": days_since_touch,
                "open_critical_tickets": crit_tickets
            }

        days_to_ren = signals_summary.get("days_to_renewal", 60)
        eval_res = DeterministicRiskEngine.evaluate(
            days_to_renewal=days_to_ren,
            usage_drop_pct=float(signals_summary.get("usage_drop_pct", usage_drop)),
            days_since_last_touchpoint=int(signals_summary.get("days_since_last_touchpoint", days_since_touch)),
            open_critical_tickets=int(signals_summary.get("open_critical_tickets", crit_tickets)),
            arr=float(raw_account.get("arr", 0.0))
        )

        main_warning = None
        if signals:
            high_sev_signals = [s for s in signals if s.severity in ("high", "critical")]
            if high_sev_signals:
                main_warning = f"{high_sev_signals[0].title}: {high_sev_signals[0].summary}"
            else:
                main_warning = f"{signals[0].title}: {signals[0].summary}"
        elif eval_res["contributing_factors"]:
            main_warning = eval_res["contributing_factors"][0]

        urgency_label = "Immediate (<30d)" if days_to_ren <= 30 else ("Within 60d" if days_to_ren <= 60 else "Stable (>60d)")
        health = raw_account.get("health_score", 65)

        # Customer metrics banner calculation
        usage_trend_str = f"-{usage_drop:.0f}% contraction" if usage_drop > 0 else "+8% steady"
        recent_engagement_str = f"Last contact {days_since_touch}d ago" if days_since_touch > 0 else "Active engagement"
        
        customer_metrics = CustomerMetrics(
            active_users=active_seats,
            baseline_users=baseline_seats,
            usage_trend=usage_trend_str,
            usage_drop_pct=usage_drop,
            recent_engagement=recent_engagement_str,
            days_since_touchpoint=days_since_touch,
            open_support_tickets=max(total_tickets, 1 if crit_tickets > 0 else 0),
            critical_tickets=crit_tickets,
            days_to_renewal=days_to_ren,
            renewal_urgency=urgency_label,
            health_score=health
        )

        return AccountDetail(
            id=raw_account["id"],
            name=raw_account["name"],
            domain=raw_account.get("domain"),
            arr=float(raw_account["arr"]),
            renewal_date=str(raw_account["renewal_date"]),
            csm_owner=raw_account["csm_owner"],
            industry=raw_account.get("industry"),
            health_score=health,
            tier=raw_account.get("tier", "Standard"),
            status=raw_account.get("status", "active"),
            risk_level=RiskLevel(eval_res["risk_level"]),
            risk_score=eval_res["risk_score"],
            urgency_days_to_renewal=days_to_ren,
            urgency_label=urgency_label,
            primary_reason_code=eval_res["primary_reason_code"],
            main_warning=main_warning,
            contributing_factors=eval_res["contributing_factors"],
            contacts=contacts,
            signals=signals,
            customer_metrics=customer_metrics
        )

    def get_account_risk_detail(self, account_id: str) -> Optional[AccountRiskDetail]:
        account = self.get_account_by_id(account_id)
        if not account:
            return None
        return AccountRiskDetail(
            account_id=account.id,
            account_name=account.name,
            risk_score=account.risk_score,
            risk_level=account.risk_level,
            urgency_days_to_renewal=account.urgency_days_to_renewal,
            urgency_label=account.urgency_label or "Moderate",
            primary_reason_code=account.primary_reason_code,
            main_warning=account.main_warning or account.primary_reason_code,
            contributing_factors=account.contributing_factors,
            rule_version="v1.0.0",
            signals_count=len(account.signals),
            arr=account.arr,
            renewal_date=account.renewal_date
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
                    return [self._enrich_signal(s) for s in docs]
            except Exception as e:
                logger.warning(f"MongoDB signals query failed: {e}")

        matches = [s for s in self._signals_data if s["account_id"] == account_id]
        # Sort by timestamp descending
        matches.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
        return [self._enrich_signal(s) for s in matches]

    def get_signal_by_id(self, signal_id: str) -> Optional[Signal]:
        if self.db is not None:
            try:
                doc = self.db.signals.find_one({"id": signal_id}, {"_id": 0})
                if doc:
                    return self._enrich_signal(doc)
            except Exception as e:
                logger.warning(f"MongoDB get_signal_by_id error: {e}")

        for s in self._signals_data:
            if s["id"] == signal_id:
                return self._enrich_signal(s)
        return None

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

    def create_signal(self, signal: Signal) -> Signal:
        doc = signal.model_dump()
        self._signals_data.append(doc)
        if self.db is not None:
            try:
                self.db.signals.update_one({"id": signal.id}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.warning(f"MongoDB create_signal error: {e}")

        from app.services.proposal_repository import proposal_repo
        proposal_repo._record_audit(
            account_id=signal.account_id,
            proposal_id=None,
            event_type="signal_ingested",
            actor=f"adapter:{signal.source_category}",
            details={"signal_id": signal.id, "type": signal.signal_type, "severity": signal.severity}
        )
        return signal

account_repo = AccountRepository()
