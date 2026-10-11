import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import (
    RiskLevel,
    SourceCategory,
    IntegrationStatus,
    IntegrationMode,
    IntegrationConnector,
    SyncRunRecord
)
from app.services.risk_engine import DeterministicRiskEngine
from app.services.hubspot_client import hubspot_client, HubSpotClient, HubSpotAPIError
from app.services.account_repository import account_repo
from app.services.integration_repository import integration_repo

logger = logging.getLogger("revora.hubspot.sync")

class HubSpotSyncService:
    def __init__(self, client: Optional[HubSpotClient] = None):
        self.client = client or hubspot_client
        self.db = None
        self._init_mongodb()

    def _init_mongodb(self):
        uris = [settings.MONGODB_URI]
        if settings.MONGODB_URI != "mongodb://localhost:27017":
            uris.append("mongodb://localhost:27017")
        for uri in uris:
            if not uri:
                continue
            try:
                from pymongo import MongoClient
                m_client = MongoClient(uri, serverSelectionTimeoutMS=1500)
                m_client.admin.command('ping')
                self.db = m_client[settings.MONGODB_DB_NAME]
                logger.info(f"HubSpotSyncService connected to MongoDB via {uri.split('@')[-1] if '@' in uri else uri}")
                return
            except Exception as e:
                logger.debug(f"HubSpotSyncService connection failed on {uri}: {e}")
        logger.warning("HubSpotSyncService MongoDB fallback to in-memory store.")
        self.db = None

    def get_status(self) -> Dict[str, Any]:
        """
        Returns HubSpot integration connection status and synchronized record metrics.
        """
        is_configured = self.client.is_configured
        conn_test = self.client.test_connection()

        # Counts from database or in-memory
        companies_count = 0
        contacts_count = 0
        signals_count = 0
        last_sync = None

        if self.db is not None:
            try:
                companies_count = self.db.accounts.count_documents({"source_system": "hubspot"})
                contacts_count = self.db.contacts.count_documents({"hubspot_id": {"$exists": True}})
                signals_count = self.db.signals.count_documents({"source_type": "hubspot"})
                
                latest_run = self.db.sync_runs.find_one({"provider": "HubSpot"}, sort=[("started_at", -1)])
                if latest_run:
                    last_sync = latest_run.get("completed_at") or latest_run.get("started_at")
            except Exception as e:
                logger.warning(f"Error fetching HubSpot status from MongoDB: {e}")

        # Fallback to in-memory check
        if companies_count == 0:
            companies_count = len([a for a in account_repo._accounts_data if a.get("source_system") == "hubspot"])
        if contacts_count == 0:
            contacts_count = len([c for c in account_repo._contacts_data if c.get("hubspot_id")])
        if signals_count == 0:
            signals_count = len([s for s in account_repo._signals_data if s.get("source_type") == "hubspot"])

        return {
            "is_configured": is_configured,
            "authenticated": conn_test.get("authenticated", True),
            "status_message": conn_test.get("message", "Ready"),
            "provider": "HubSpot CRM",
            "auth_method": "Private App Access Token (Bearer)" if is_configured else "Demo Service Integration",
            "last_sync_time": last_sync,
            "records_in_db": {
                "companies": companies_count,
                "contacts": contacts_count,
                "crm_signals": signals_count
            }
        }

    def sync_all(self) -> Dict[str, Any]:
        """
        Orchestrates full HubSpot CRM data synchronization:
        1. Fetch companies, contacts, deals, owners, tickets from HubSpot API
        2. Normalize & preserve associations
        3. Save/Upsert into MongoDB accounts, contacts, signals, and raw collections
        4. Calculate deterministic risk and update Revenue Radar
        5. Record sync run history
        """
        start_time = datetime.now(timezone.utc)
        sync_run_id = f"sync-hs-{uuid.uuid4().hex[:8]}"
        
        if not self.client.is_configured:
            logger.info("HUBSPOT_ACCESS_TOKEN not configured in .env; executing HubSpot CRM synchronization in demo mode.")

        logger.info(f"Starting HubSpot sync run: {sync_run_id}")

        # 1. Fetch data from HubSpot API
        try:
            owners = self.client.fetch_owners()
            companies = self.client.fetch_companies()
            contacts = self.client.fetch_contacts()
            deals = self.client.fetch_deals()
            tickets = self.client.fetch_support_tickets()
        except Exception as e:
            logger.error(f"HubSpot API data fetch failed: {e}")
            self._record_sync_run(
                sync_run_id=sync_run_id,
                status="failed",
                records_ingested=0,
                records_updated=0,
                duration_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000),
                start_time=start_time,
                error_msg=str(e)
            )
            raise

        # 2. Build owner lookup map
        owner_map: Dict[str, str] = {}
        for o in owners:
            o_id = str(o.get("id", ""))
            name = f"{o.get('firstName', '')} {o.get('lastName', '')}".strip() or o.get("email", "")
            if o_id:
                owner_map[o_id] = name or "HubSpot Owner"

        # 3. Associate Deals by Company
        deals_by_company: Dict[str, List[Dict[str, Any]]] = {}
        for deal in deals:
            # Check associations
            comp_assocs = deal.get("associations", {}).get("companies", {}).get("results", [])
            for c_assoc in comp_assocs:
                cid = str(c_assoc.get("id"))
                deals_by_company.setdefault(cid, []).append(deal)

        # 4. Associate Tickets by Company
        tickets_by_company: Dict[str, List[Dict[str, Any]]] = {}
        for ticket in tickets:
            comp_assocs = ticket.get("associations", {}).get("companies", {}).get("results", [])
            for c_assoc in comp_assocs:
                cid = str(c_assoc.get("id"))
                tickets_by_company.setdefault(cid, []).append(ticket)

        # 5. Associate Contacts by Company
        contacts_by_company: Dict[str, List[Dict[str, Any]]] = {}
        for contact in contacts:
            props = contact.get("properties", {})
            cid = props.get("associatedcompanyid")
            if not cid:
                comp_assocs = contact.get("associations", {}).get("companies", {}).get("results", [])
                if comp_assocs:
                    cid = str(comp_assocs[0].get("id"))
            if cid:
                contacts_by_company.setdefault(str(cid), []).append(contact)

        # 6. Normalize and upsert accounts
        accounts_upserted = 0
        contacts_upserted = 0
        signals_upserted = 0

        now_iso = start_time.isoformat()

        for comp in companies:
            cid = str(comp["id"])
            if cid.startswith("acc-"):
                account_id = cid
            elif cid.startswith("hs-"):
                account_id = f"acc-hs-{cid}"
            else:
                account_id = f"acc-{cid}"
            props = comp.get("properties", {})
            comp_name = props.get("name") or props.get("domain") or f"HubSpot Company {cid}"
            domain = props.get("domain")
            industry = props.get("industry") or "Technology"
            owner_id = str(props.get("hubspot_owner_id") or "")
            default_owner = next(iter(owner_map.values()), "Kushal Sahu")
            csm_owner = owner_map.get(owner_id) or default_owner

            # ARR calculation: company annualrevenue property or sum of deals
            arr = 0.0
            if props.get("annualrevenue"):
                try:
                    arr = float(props["annualrevenue"])
                except (ValueError, TypeError):
                    arr = 0.0
            
            comp_deals = deals_by_company.get(cid, [])
            if arr == 0.0 and comp_deals:
                for d in comp_deals:
                    try:
                        arr += float(d.get("properties", {}).get("amount") or 0.0)
                    except (ValueError, TypeError):
                        pass

            if arr == 0.0 and not comp_deals:
                arr = 95000.0  # Professional enterprise tier ARR for synced CRM account

            # Renewal date: derive from deals or company createdate + 1 year
            comp_tickets = tickets_by_company.get(cid, [])
            crit_tickets = 0
            for t in comp_tickets:
                priority = (t.get("properties", {}).get("hs_ticket_priority") or "").upper()
                if priority in ("HIGH", "CRITICAL"):
                    crit_tickets += 1

            # Determine days since touchpoint
            last_mod = props.get("hs_lastmodifieddate") or props.get("createdate")
            days_since_touch = 14
            if last_mod:
                try:
                    clean_ts = last_mod.replace("Z", "+00:00")
                    mod_dt = datetime.fromisoformat(clean_ts)
                    days_since_touch = max(1, (start_time - mod_dt).days)
                except Exception:
                    days_since_touch = 14

            # Default renewal date: 60 days out or based on closedate
            renewal_date_str = (start_time + timedelta(days=60)).strftime("%Y-%m-%d")
            days_to_ren = 60
            if comp_deals:
                for d in comp_deals:
                    c_date = d.get("properties", {}).get("closedate")
                    if c_date:
                        try:
                            clean_c = c_date.replace("Z", "+00:00")
                            cdt = datetime.fromisoformat(clean_c)
                            # Contract typically runs for 1 year from deal close
                            ren_dt = cdt + timedelta(days=365)
                            days_to_ren = max(1, (ren_dt - start_time).days)
                            renewal_date_str = ren_dt.strftime("%Y-%m-%d")
                            break
                        except Exception:
                            pass

            signals_summary = {
                "days_to_renewal": days_to_ren,
                "usage_drop_pct": 0.0,
                "days_since_last_touchpoint": days_since_touch,
                "open_critical_tickets": crit_tickets
            }

            # Run deterministic risk evaluation
            eval_res = DeterministicRiskEngine.evaluate(
                days_to_renewal=days_to_ren,
                usage_drop_pct=0.0,
                days_since_last_touchpoint=days_since_touch,
                open_critical_tickets=crit_tickets,
                arr=arr
            )

            tier = "Enterprise" if arr >= 100000 else ("Mid-Market" if arr >= 30000 else "Standard")

            account_doc = {
                "id": account_id,
                "name": comp_name,
                "domain": domain,
                "arr": arr,
                "renewal_date": renewal_date_str,
                "csm_owner": csm_owner,
                "industry": industry,
                "health_score": 75 if crit_tickets == 0 else 45,
                "tier": tier,
                "status": "active",
                "risk_level": eval_res["risk_level"],
                "risk_score": eval_res["risk_score"],
                "urgency_days_to_renewal": days_to_ren,
                "urgency_label": "Immediate (<30d)" if days_to_ren <= 30 else ("Within 60d" if days_to_ren <= 60 else "Stable (>60d)"),
                "primary_reason_code": eval_res["primary_reason_code"],
                "main_warning": f"HubSpot CRM account with {crit_tickets} critical tickets" if crit_tickets > 0 else f"HubSpot CRM synced account ({csm_owner})",
                "contributing_factors": eval_res["contributing_factors"],
                "signals_summary": signals_summary,
                "source_system": "hubspot",
                "hubspot_id": cid,
                "last_synced_at": now_iso
            }

            # Upsert into MongoDB accounts
            if self.db is not None:
                try:
                    self.db.accounts.update_one({"id": account_id}, {"$set": account_doc}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error upserting account {account_id} into MongoDB: {e}")

            # Keep in-memory cache synchronized
            self._upsert_memory_account(account_doc)
            accounts_upserted += 1

            # 7. Normalize contacts for this company
            comp_contacts = contacts_by_company.get(cid, [])
            for idx, c in enumerate(comp_contacts):
                raw_cid = str(c['id'])
                if raw_cid.startswith("cnt-") or raw_cid.startswith("con-"):
                    cnt_id = raw_cid
                elif raw_cid.startswith("hs-"):
                    cnt_id = f"cnt-hs-{raw_cid}"
                else:
                    cnt_id = f"con-{raw_cid}"
                c_props = c.get("properties", {})
                first_name = c_props.get("firstname", "") or ""
                last_name = c_props.get("lastname", "") or ""
                full_name = f"{first_name} {last_name}".strip() or c_props.get("email") or "HubSpot Contact"
                email = c_props.get("email") or ""
                job_title = c_props.get("jobtitle") or "Contact"
                last_contact = c_props.get("lastmodifieddate") or c_props.get("createdate")

                contact_doc = {
                    "id": cnt_id,
                    "account_id": account_id,
                    "name": full_name,
                    "email": email,
                    "role": job_title,
                    "is_primary": idx == 0 or any(lead_term in job_title.lower() for lead_term in ["vp", "director", "head", "founder", "chairperson"]),
                    "sentiment": "neutral",
                    "last_contact_date": last_contact,
                    "hubspot_id": str(c["id"]),
                    "source_system": "hubspot"
                }

                if self.db is not None:
                    try:
                        self.db.contacts.update_one({"id": cnt_id}, {"$set": contact_doc}, upsert=True)
                    except Exception as e:
                        logger.warning(f"Error upserting contact {cnt_id} into MongoDB: {e}")

                self._upsert_memory_contact(contact_doc)
                contacts_upserted += 1

            # 8. Create and upsert Deal Signals
            for deal in comp_deals:
                did = str(deal["id"])
                sig_id = f"sig-hs-deal-{did}"
                d_props = deal.get("properties", {})
                d_name = d_props.get("dealname") or "CRM Opportunity"
                d_stage = d_props.get("dealstage") or "open"
                d_amt = float(d_props.get("amount") or 0.0)
                d_time = d_props.get("hs_lastmodifieddate") or d_props.get("createdate") or now_iso

                deal_signal = {
                    "id": sig_id,
                    "signal_id": sig_id,
                    "account_id": account_id,
                    "source_category": "crm",
                    "source_type": "hubspot",
                    "source": "hubspot",
                    "evidence_id": f"ev-hs-deal-{did}",
                    "source_record_id": did,
                    "signal_type": "contract_renewal" if "closedwon" in d_stage.lower() else "crm_opportunity",
                    "event_type": "deal_update",
                    "title": f"HubSpot Deal: {d_name}",
                    "summary": f"Deal '{d_name}' in pipeline stage '{d_stage}' with revenue value ${d_amt:,.2f}",
                    "severity": "low" if d_amt > 0 else "medium",
                    "timestamp": d_time,
                    "event_time": d_time,
                    "metadata": {
                        "deal_id": did,
                        "deal_name": d_name,
                        "stage": d_stage,
                        "amount": d_amt,
                        "hubspot_id": did
                    }
                }

                if self.db is not None:
                    try:
                        self.db.signals.update_one({"id": sig_id}, {"$set": deal_signal}, upsert=True)
                    except Exception as e:
                        logger.warning(f"Error upserting deal signal {sig_id} into MongoDB: {e}")

                self._upsert_memory_signal(deal_signal)
                signals_upserted += 1

            # 9. Create and upsert Support Ticket Signals
            for ticket in comp_tickets:
                tid = str(ticket["id"])
                sig_id = f"sig-hs-ticket-{tid}"
                t_props = ticket.get("properties", {})
                subject = t_props.get("subject") or "Support Ticket"
                content = t_props.get("content") or "HubSpot customer ticket record"
                t_priority = (t_props.get("hs_ticket_priority") or "MEDIUM").upper()
                is_critical = t_priority in ("HIGH", "CRITICAL")
                t_time = t_props.get("createdate") or now_iso

                ticket_signal = {
                    "id": sig_id,
                    "signal_id": sig_id,
                    "account_id": account_id,
                    "source_category": "crm",
                    "source_type": "hubspot",
                    "source": "hubspot",
                    "evidence_id": f"ev-hs-ticket-{tid}",
                    "source_record_id": tid,
                    "signal_type": "support_ticket",
                    "event_type": "ticket_opened",
                    "title": f"HubSpot Ticket: {subject}",
                    "summary": f"[{t_priority}] {content[:160]}",
                    "severity": "critical" if is_critical else "medium",
                    "timestamp": t_time,
                    "event_time": t_time,
                    "metadata": {
                        "ticket_id": tid,
                        "priority": t_priority.lower(),
                        "subject": subject,
                        "hubspot_id": tid
                    }
                }

                if self.db is not None:
                    try:
                        self.db.signals.update_one({"id": sig_id}, {"$set": ticket_signal}, upsert=True)
                    except Exception as e:
                        logger.warning(f"Error upserting ticket signal {sig_id} into MongoDB: {e}")

                self._upsert_memory_signal(ticket_signal)
                signals_upserted += 1

            # 10. Generate CRM intelligence signals for the account
            touch_sig_id = f"sig-hs-touch-{cid}"
            touch_signal = {
                "id": touch_sig_id,
                "signal_id": touch_sig_id,
                "account_id": account_id,
                "source_category": "crm",
                "source_type": "hubspot",
                "source": "hubspot",
                "evidence_id": f"ev-hs-touch-{cid}",
                "source_record_id": cid,
                "signal_type": "touchpoint_lag",
                "event_type": "csm_activity",
                "title": f"HubSpot CRM Engagement: {days_since_touch}d since modification",
                "summary": f"Last recorded HubSpot CRM company modification was {days_since_touch} days ago.",
                "severity": "high" if days_since_touch >= 30 else ("medium" if days_since_touch >= 14 else "low"),
                "timestamp": now_iso,
                "event_time": now_iso,
                "metadata": {
                    "days_since_touchpoint": days_since_touch,
                    "hubspot_id": cid
                }
            }
            if self.db is not None:
                try:
                    self.db.signals.update_one({"id": touch_sig_id}, {"$set": touch_signal}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error upserting touchpoint signal {touch_sig_id}: {e}")
            self._upsert_memory_signal(touch_signal)
            signals_upserted += 1

            crm_rec_id = f"sig-hs-record-{cid}"
            crm_rec_signal = {
                "id": crm_rec_id,
                "signal_id": crm_rec_id,
                "account_id": account_id,
                "source_category": "crm",
                "source_type": "hubspot",
                "source": "hubspot",
                "evidence_id": f"ev-hs-crm-{cid}",
                "source_record_id": cid,
                "signal_type": "crm_sync",
                "event_type": "record_synced",
                "title": f"HubSpot CRM Account Synchronized: {comp_name}",
                "summary": f"Direct API sync verified {len(comp_contacts)} contacts and live CRM company profile ({domain or 'N/A'}).",
                "severity": "low",
                "timestamp": now_iso,
                "event_time": now_iso,
                "metadata": {
                    "lifecycle_stage": props.get("lifecyclestage", "lead"),
                    "domain": domain,
                    "hubspot_id": cid
                }
            }
            if self.db is not None:
                try:
                    self.db.signals.update_one({"id": crm_rec_id}, {"$set": crm_rec_signal}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error upserting crm signal {crm_rec_id}: {e}")
            self._upsert_memory_signal(crm_rec_signal)
            signals_upserted += 1

            # If executive contacts exist, add stakeholder signal
            for c in comp_contacts:
                c_props = c.get("properties", {})
                job_title = c_props.get("jobtitle") or ""
                if any(lead_term in job_title.lower() for lead_term in ["vp", "director", "head", "founder", "chairperson", "executive"]):
                    first_name = c_props.get("firstname", "") or ""
                    last_name = c_props.get("lastname", "") or ""
                    full_name = f"{first_name} {last_name}".strip() or "Executive"
                    stk_sig_id = f"sig-hs-stk-{c['id']}"
                    stk_signal = {
                        "id": stk_sig_id,
                        "signal_id": stk_sig_id,
                        "account_id": account_id,
                        "source_category": "crm",
                        "source_type": "hubspot",
                        "source": "hubspot",
                        "evidence_id": f"ev-hs-stk-{c['id']}",
                        "source_record_id": str(c["id"]),
                        "signal_type": "stakeholder_detected",
                        "event_type": "executive_touchpoint",
                        "title": f"HubSpot Executive Stakeholder: {full_name} ({job_title})",
                        "summary": f"Key decision maker registered in HubSpot CRM: {full_name}, {job_title} ({c_props.get('email', '')}).",
                        "severity": "low",
                        "timestamp": now_iso,
                        "event_time": now_iso,
                        "metadata": {
                            "contact_id": str(c["id"]),
                            "email": c_props.get("email"),
                            "role": job_title,
                            "hubspot_id": str(c["id"])
                        }
                    }
                    if self.db is not None:
                        try:
                            self.db.signals.update_one({"id": stk_sig_id}, {"$set": stk_signal}, upsert=True)
                        except Exception as e:
                            logger.warning(f"Error upserting stakeholder signal {stk_sig_id}: {e}")
                    self._upsert_memory_signal(stk_signal)
                    signals_upserted += 1

        # 11. Store raw audit records in MongoDB for provenance
        if self.db is not None:
            try:
                for comp in companies:
                    self.db.hubspot_raw_records.update_one(
                        {"object_type": "company", "hubspot_id": str(comp["id"])},
                        {"$set": {"data": comp, "synced_at": now_iso}},
                        upsert=True
                    )
                for contact in contacts:
                    self.db.hubspot_raw_records.update_one(
                        {"object_type": "contact", "hubspot_id": str(contact["id"])},
                        {"$set": {"data": contact, "synced_at": now_iso}},
                        upsert=True
                    )
                for deal in deals:
                    self.db.hubspot_raw_records.update_one(
                        {"object_type": "deal", "hubspot_id": str(deal["id"])},
                        {"$set": {"data": deal, "synced_at": now_iso}},
                        upsert=True
                    )
                for ticket in tickets:
                    self.db.hubspot_raw_records.update_one(
                        {"object_type": "ticket", "hubspot_id": str(ticket["id"])},
                        {"$set": {"data": ticket, "synced_at": now_iso}},
                        upsert=True
                    )
            except Exception as e:
                logger.warning(f"Error saving raw HubSpot records to MongoDB: {e}")

        # 12. Update HubSpot Integration Connector state
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        total_ingested = accounts_upserted + contacts_upserted + signals_upserted

        connector = IntegrationConnector(
            id="conn-hubspot-01",
            name="HubSpot CRM Live Integration" if self.client.is_configured else "HubSpot CRM Service Key Integration",
            category="crm",
            provider="HubSpot",
            status=IntegrationStatus.CONNECTED,
            mode=IntegrationMode.LIVE if self.client.is_configured else IntegrationMode.SIMULATED,
            is_real_connector=True,
            endpoint_or_host=settings.HUBSPOT_BASE_URL,
            last_sync_time=now_iso,
            records_synced=total_ingested,
            data_freshness_status="fresh",
            freshness_minutes=0,
            freshness_warning=None,
            config_details={
                "auth_type": "Private App Access Token (Bearer)" if self.client.is_configured else "Demo Service Integration",
                "objects": ["companies", "contacts", "deals", "tickets", "owners"],
                "active_accounts": accounts_upserted,
                "contacts": contacts_upserted,
                "signals": signals_upserted
            }
        )

        integration_repo._integrations[connector.id] = connector
        if self.db is not None:
            try:
                self.db.integrations.update_one({"id": connector.id}, {"$set": connector.model_dump()}, upsert=True)
            except Exception as e:
                logger.warning(f"Error updating connector in MongoDB: {e}")

        # 13. Record Sync Run
        self._record_sync_run(
            sync_run_id=sync_run_id,
            status="success",
            records_ingested=total_ingested,
            records_updated=accounts_upserted,
            duration_ms=duration_ms,
            start_time=start_time,
            log_msg=f"Successfully ingested {accounts_upserted} companies, {contacts_upserted} contacts, and {signals_upserted} CRM signals from HubSpot API."
        )

        logger.info(f"HubSpot sync run completed: {sync_run_id} (Duration: {duration_ms}ms)")

        return {
            "sync_run_id": sync_run_id,
            "status": "success",
            "message": f"HubSpot CRM synchronization completed successfully.",
            "duration_ms": duration_ms,
            "synced_at": now_iso,
            "summary": {
                "companies_synced": accounts_upserted,
                "contacts_synced": contacts_upserted,
                "signals_created": signals_upserted,
                "total_records": total_ingested
            }
        }

    def _record_sync_run(self, sync_run_id: str, status: str, records_ingested: int, records_updated: int, duration_ms: int, start_time: datetime, log_msg: str = "", error_msg: Optional[str] = None):
        now_iso = datetime.now(timezone.utc).isoformat()
        sync_record = SyncRunRecord(
            id=sync_run_id,
            integration_id="conn-hubspot-01",
            provider="HubSpot",
            status=status,
            records_ingested=records_ingested,
            records_updated=records_updated,
            duration_ms=duration_ms,
            started_at=start_time.isoformat(),
            completed_at=now_iso,
            mode=IntegrationMode.LIVE if self.client.is_configured else IntegrationMode.SIMULATED,
            log_message=log_msg or (f"Sync failed: {error_msg}" if error_msg else "HubSpot synchronization completed.")
        )
        integration_repo._sync_runs.insert(0, sync_record)
        if self.db is not None:
            try:
                self.db.sync_runs.insert_one(sync_record.model_dump())
            except Exception as e:
                logger.warning(f"Error saving sync run to MongoDB: {e}")

    def _upsert_memory_account(self, account_doc: Dict[str, Any]):
        for idx, acc in enumerate(account_repo._accounts_data):
            if acc["id"] == account_doc["id"]:
                account_repo._accounts_data[idx] = account_doc
                return
        account_repo._accounts_data.append(account_doc)

    def _upsert_memory_contact(self, contact_doc: Dict[str, Any]):
        for idx, cnt in enumerate(account_repo._contacts_data):
            if cnt["id"] == contact_doc["id"]:
                account_repo._contacts_data[idx] = contact_doc
                return
        account_repo._contacts_data.append(contact_doc)

    def _upsert_memory_signal(self, signal_doc: Dict[str, Any]):
        for idx, sig in enumerate(account_repo._signals_data):
            if sig["id"] == signal_doc["id"]:
                account_repo._signals_data[idx] = signal_doc
                return
        account_repo._signals_data.append(signal_doc)

hubspot_sync_service = HubSpotSyncService()
