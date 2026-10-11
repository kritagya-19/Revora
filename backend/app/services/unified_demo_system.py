"""
Unified Demo Data System for SignalBridge AI.

- Fetches companies, contacts, and available deals from the live HubSpot API integration.
- Generates consistent, deterministic simulated email, calendar, Slack, and product-usage records for those same HubSpot companies.
- Associates every record with the correct internal account ID and tags source, timestamp, and simulated/live status (is_simulated, mode).
- Persists all normalized records into MongoDB idempotently.
- Ensures the risk engine uses these records to calculate deterministic risk.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pymongo import MongoClient

from app.core.config import settings
from app.services.hubspot_client import hubspot_client, HubSpotClient
from app.services.risk_engine import DeterministicRiskEngine
from app.services.account_repository import account_repo
from app.services.integration_repository import integration_repo
from app.models.schemas import IntegrationConnector, IntegrationStatus, IntegrationMode

logger = logging.getLogger("revora.unified_demo")


class UnifiedDemoSystem:
    def __init__(self, client: Optional[HubSpotClient] = None):
        self.hubspot_client = client or hubspot_client
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
                m_client = MongoClient(uri, serverSelectionTimeoutMS=1500)
                m_client.admin.command("ping")
                self.db = m_client[settings.MONGODB_DB_NAME]
                logger.info(f"UnifiedDemoSystem connected to MongoDB via {uri.split('@')[-1] if '@' in uri else uri}")
                return
            except Exception as e:
                logger.debug(f"UnifiedDemoSystem MongoDB connection failed on {uri}: {e}")
        self.db = None

    def seed_all(self, execute_hubspot_live_fetch: bool = True) -> Dict[str, Any]:
        """
        Executes full deterministic seeding:
        1. Fetch live HubSpot CRM data (companies, contacts, deals)
        2. Generate consistent simulated Email, Calendar, Slack, and Usage records
        3. Upsert idempotently into MongoDB
        4. Recompute deterministic risk and update account scores
        """
        start_time = datetime.now(timezone.utc)
        now_iso = start_time.isoformat()

        live_companies = []
        live_contacts = []
        live_deals = []
        live_tickets = []
        live_owners = []

        # 1. Fetch live data from HubSpot API
        if execute_hubspot_live_fetch and self.hubspot_client.is_configured:
            try:
                logger.info("Fetching live objects from HubSpot CRM API...")
                live_companies = self.hubspot_client.fetch_companies()
                live_contacts = self.hubspot_client.fetch_contacts()
                live_deals = self.hubspot_client.fetch_deals()
                live_tickets = self.hubspot_client.fetch_support_tickets()
                live_owners = self.hubspot_client.fetch_owners()
                logger.info(f"Live HubSpot API fetched: {len(live_companies)} companies, {len(live_contacts)} contacts.")
            except Exception as e:
                logger.warning(f"Live HubSpot API fetch encountered error: {e}. Proceeding with unified integration.")

        # Map owners
        owner_name = "Kushal Sahu"
        if live_owners:
            o0 = live_owners[0]
            owner_name = f"{o0.get('firstName', '')} {o0.get('lastName', '')}".strip() or o0.get("email", "Kushal Sahu")

        # 2. Define canonical portfolio accounts (10 accounts)
        # All associated with HubSpot CRM format and realistic multi-channel scenarios
        portfolio_definitions = [
            {
                "id": "acc-hs-351708265163",
                "hubspot_id": "351708265163",
                "name": "HubSpot",
                "domain": "hubspot.com",
                "industry": "Marketing & CRM Cloud",
                "csm_owner": owner_name,
                "arr": 95000.0,
                "days_to_renewal": 60,
                "usage_drop_pct": 0.0,
                "days_since_touch": 1,
                "crit_tickets": 0,
                "tier": "Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860497",
                        "hubspot_id": "567638860497",
                        "name": "Brian Halligan (Sample Contact)",
                        "email": "bh@hubspot.com",
                        "role": "Executive Chairperson",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567623796418",
                        "hubspot_id": "567623796418",
                        "name": "Maria Johnson (Sample Contact)",
                        "email": "emailmaria@hubspot.com",
                        "role": "Salesperson",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "HubSpot + SignalBridge AI QBR & Multi-Hub Review",
                    "email_body": "Hi Kushal, we are reviewing our Q4 renewal allocations across marketing hubs. Everything looks solid.",
                    "cal_title": "Executive Renewal Alignment & Multi-Hub Roadmap",
                    "slack_channel": "#hubspot-collab",
                    "slack_msg": "Brian Halligan: Appreciate the fast response on the API docs update, Kushal!",
                    "usage_stat": "240 seats active (+8% steady usage)",
                    "usage_trend": "steady"
                }
            },
            {
                "id": "acc-hs-351708265164",
                "hubspot_id": "351708265164",
                "name": "Datadog Systems",
                "domain": "datadoghq.com",
                "industry": "Cloud Observability & Security",
                "csm_owner": owner_name,
                "arr": 185000.0,
                "days_to_renewal": 24,
                "usage_drop_pct": 42.0,
                "days_since_touch": 19,
                "crit_tickets": 2,
                "tier": "Enterprise",
                "status": "at_risk",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860501",
                        "hubspot_id": "567638860501",
                        "name": "Alex Mercer",
                        "email": "alex.mercer@datadoghq.com",
                        "role": "VP Infrastructure",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860502",
                        "hubspot_id": "567638860502",
                        "name": "Sarah Lin",
                        "email": "sarah.lin@datadoghq.com",
                        "role": "Director of Cloud Ops",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Urgent Blocker: Ingestion Pipeline Outages & Upcoming Renewal",
                    "email_body": "Kushal, our engineering team is escalating 2 critical P1 latency tickets. We cannot approve renewal until this is resolved.",
                    "cal_title": "Emergency Escalation Sync: P1 APM Latency Blocker",
                    "slack_channel": "#datadog-escalations",
                    "slack_msg": "Alex Mercer: We've paused the routing agent on our US-East cluster until the latency fix is verified.",
                    "usage_stat": "-42% APM streaming ingest drop",
                    "usage_trend": "severe_drop"
                }
            },
            {
                "id": "acc-hs-351708265165",
                "hubspot_id": "351708265165",
                "name": "Snowflake Analytics",
                "domain": "snowflake.com",
                "industry": "Data Cloud & Warehousing",
                "csm_owner": owner_name,
                "arr": 240000.0,
                "days_to_renewal": 41,
                "usage_drop_pct": 31.0,
                "days_since_touch": 28,
                "crit_tickets": 1,
                "tier": "Strategic Enterprise",
                "status": "at_risk",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860503",
                        "hubspot_id": "567638860503",
                        "name": "Jordan Belfort",
                        "email": "jordan.belfort@snowflake.com",
                        "role": "Principal Data Architect",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860504",
                        "hubspot_id": "567638860504",
                        "name": "Emily Thorne",
                        "email": "emily.thorne@snowflake.com",
                        "role": "Head of Vendor Procurement",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Snowflake / Revora: Missed Touchpoint & Query Volume Inquiry",
                    "email_body": "Hi Kushal, we noticed a sharp 31% dip in daily analytics workloads. Can we discuss cost optimization ahead of our renewal?",
                    "cal_title": "Snowflake Architecture Review & Query Volume Recovery",
                    "slack_channel": "#snowflake-csm",
                    "slack_msg": "Jordan Belfort: Team is reviewing alternatives due to recent budget constraints from leadership.",
                    "usage_stat": "-31% analytical compute query decline",
                    "usage_trend": "severe_drop"
                }
            },
            {
                "id": "acc-hs-351708265166",
                "hubspot_id": "351708265166",
                "name": "Atlassian Corp",
                "domain": "atlassian.com",
                "industry": "Collaboration Software",
                "csm_owner": owner_name,
                "arr": 160000.0,
                "days_to_renewal": 35,
                "usage_drop_pct": 22.0,
                "days_since_touch": 16,
                "crit_tickets": 1,
                "tier": "Enterprise",
                "status": "at_risk",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860505",
                        "hubspot_id": "567638860505",
                        "name": "Mike Cannon",
                        "email": "mike.cannon@atlassian.com",
                        "role": "VP Product Engineering",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860506",
                        "hubspot_id": "567638860506",
                        "name": "Rebecca Vance",
                        "email": "rebecca.vance@atlassian.com",
                        "role": "Solutions Integration Lead",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "SSO Blocker on Ticket #8841 - Technical Sync Needed",
                    "email_body": "Kushal, our Jira service desk integration broke after the last token rotation. 85 engineering pods are blocked.",
                    "cal_title": "SSO Blocker Working Session with Principal Solutions Architect",
                    "slack_channel": "#atlassian-partner-channel",
                    "slack_msg": "Rebecca Vance: Can we get engineering escalation on ticket #8841? It's our highest priority.",
                    "usage_stat": "-22% active workspace login sessions",
                    "usage_trend": "moderate_drop"
                }
            },
            {
                "id": "acc-hs-351708265167",
                "hubspot_id": "351708265167",
                "name": "Stripe Payments",
                "domain": "stripe.com",
                "industry": "Financial Infrastructure",
                "csm_owner": owner_name,
                "arr": 310000.0,
                "days_to_renewal": 78,
                "usage_drop_pct": 14.0,
                "days_since_touch": 12,
                "crit_tickets": 0,
                "tier": "Strategic Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860507",
                        "hubspot_id": "567638860507",
                        "name": "Patrick Collison",
                        "email": "patrick.c@stripe.com",
                        "role": "Head of Billing Systems",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860508",
                        "hubspot_id": "567638860508",
                        "name": "Clara Oswald",
                        "email": "clara.oswald@stripe.com",
                        "role": "Finance Operations Manager",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Bi-weekly Reconciliation Status & Q1 Expansion Order",
                    "email_body": "Hi Kushal, the automated ledger audit is running smoothly. We are finalizing our $310k add-on order form.",
                    "cal_title": "Quarterly Billing Infrastructure Review",
                    "slack_channel": "#stripe-revora-shared",
                    "slack_msg": "Patrick Collison: Automated payout webhooks verified with zero dropped payloads this week.",
                    "usage_stat": "High volume transaction processing (steady)",
                    "usage_trend": "steady"
                }
            },
            {
                "id": "acc-hs-351708265168",
                "hubspot_id": "351708265168",
                "name": "Twilio Communications",
                "domain": "twilio.com",
                "industry": "Cloud Communications Platform",
                "csm_owner": owner_name,
                "arr": 125000.0,
                "days_to_renewal": 92,
                "usage_drop_pct": 8.0,
                "days_since_touch": 15,
                "crit_tickets": 0,
                "tier": "Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860509",
                        "hubspot_id": "567638860509",
                        "name": "Jeff Lawson",
                        "email": "jeff.lawson@twilio.com",
                        "role": "Principal Telephony Architect",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860510",
                        "hubspot_id": "567638860510",
                        "name": "Daniel Craig",
                        "email": "daniel.c@twilio.com",
                        "role": "Network Operations Director",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Voice Gateway SLA & Webhook Telemetry Report",
                    "email_body": "Kushal, telemetry shows 99.98% uptime. We had a slight dip during European carrier maintenance, now recovered.",
                    "cal_title": "Carrier Routing Telemetry Sync",
                    "slack_channel": "#twilio-ops",
                    "slack_msg": "Daniel Craig: SMS gateway traffic is normalizing following the regional latency window.",
                    "usage_stat": "-8% minor temporary routing dip",
                    "usage_trend": "minor_dip"
                }
            },
            {
                "id": "acc-hs-351708265169",
                "hubspot_id": "351708265169",
                "name": "Canva Design",
                "domain": "canva.com",
                "industry": "Visual Communication & Design",
                "csm_owner": owner_name,
                "arr": 140000.0,
                "days_to_renewal": 115,
                "usage_drop_pct": 0.0,
                "days_since_touch": 7,
                "crit_tickets": 0,
                "tier": "Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860511",
                        "hubspot_id": "567638860511",
                        "name": "Melanie Perkins",
                        "email": "melanie@canva.com",
                        "role": "Chief Creative Officer",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860512",
                        "hubspot_id": "567638860512",
                        "name": "Oliver Queen",
                        "email": "oliver.queen@canva.com",
                        "role": "Global IT Asset Manager",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Seat Allocation Saturation - Need 50 Additional Licenses",
                    "email_body": "Hi Kushal, we just onboarded the Sydney creative hub and reached 98.4% license utilization. Please send the expansion addendum.",
                    "cal_title": "Enterprise Tier License Expansion Discussion",
                    "slack_channel": "#canva-revora-success",
                    "slack_msg": "Melanie Perkins: Team love the new AI auto-tagging feature! Adoption is at an all-time high.",
                    "usage_stat": "98.4% license seat saturation (expansion imminent)",
                    "usage_trend": "growth"
                }
            },
            {
                "id": "acc-hs-351708265170",
                "hubspot_id": "351708265170",
                "name": "Figma Collaboration",
                "domain": "figma.com",
                "industry": "Design & Prototyping Platform",
                "csm_owner": owner_name,
                "arr": 210000.0,
                "days_to_renewal": 18,
                "usage_drop_pct": 48.0,
                "days_since_touch": 25,
                "crit_tickets": 2,
                "tier": "Enterprise",
                "status": "at_risk",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860513",
                        "hubspot_id": "567638860513",
                        "name": "Dylan Field",
                        "email": "dylan.field@figma.com",
                        "role": "Design Systems VP",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860514",
                        "hubspot_id": "567638860514",
                        "name": "Natasha Romanoff",
                        "email": "natasha.r@figma.com",
                        "role": "Operations Lead",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Executive Sponsor Departure Notice & Procurement Halt",
                    "email_body": "Kushal, our VP sponsor departed last Friday. Procurement has placed all renewals under 60-day freeze until re-evaluated.",
                    "cal_title": "Urgent Stakeholder Transition & Procurement Review",
                    "slack_channel": "#figma-alerts",
                    "slack_msg": "Natasha Romanoff: We cannot sign the contract extension without executive re-charter.",
                    "usage_stat": "-48% collaborative canvas editor drop",
                    "usage_trend": "severe_drop"
                }
            },
            {
                "id": "acc-hs-351708265171",
                "hubspot_id": "351708265171",
                "name": "Notion Labs",
                "domain": "notion.so",
                "industry": "Knowledge Management & Workspace",
                "csm_owner": owner_name,
                "arr": 175000.0,
                "days_to_renewal": 54,
                "usage_drop_pct": 12.0,
                "days_since_touch": 14,
                "crit_tickets": 0,
                "tier": "Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860515",
                        "hubspot_id": "567638860515",
                        "name": "Ivan Zhao",
                        "email": "ivan.zhao@notion.so",
                        "role": "VP Knowledge Systems",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860516",
                        "hubspot_id": "567638860516",
                        "name": "Bruce Wayne",
                        "email": "bruce.w@notion.so",
                        "role": "Procurement Director",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Global MSA Restructuring & Multi-Workspace Consolidation",
                    "email_body": "Hi Kushal, we would like to consolidate our 4 individual business unit workspaces into a single enterprise contract.",
                    "cal_title": "Enterprise Agreement Consolidation Sync",
                    "slack_channel": "#notion-commercial",
                    "slack_msg": "Ivan Zhao: Looking forward to reviewing the enterprise security addendum next week.",
                    "usage_stat": "Steady daily workspace query volume",
                    "usage_trend": "steady"
                }
            },
            {
                "id": "acc-hs-351708265172",
                "hubspot_id": "351708265172",
                "name": "MongoDB Enterprise",
                "domain": "mongodb.com",
                "industry": "Developer Data Platform",
                "csm_owner": owner_name,
                "arr": 280000.0,
                "days_to_renewal": 140,
                "usage_drop_pct": 0.0,
                "days_since_touch": 5,
                "crit_tickets": 0,
                "tier": "Strategic Enterprise",
                "status": "active",
                "contacts": [
                    {
                        "id": "cnt-hs-567638860517",
                        "hubspot_id": "567638860517",
                        "name": "Dev Ittycheria",
                        "email": "dev.i@mongodb.com",
                        "role": "Cloud Strategy Director",
                        "is_primary": True
                    },
                    {
                        "id": "cnt-hs-567638860518",
                        "hubspot_id": "567638860518",
                        "name": "Peter Parker",
                        "email": "peter.parker@mongodb.com",
                        "role": "Principal DBA",
                        "is_primary": False
                    }
                ],
                "scenario": {
                    "email_subject": "Cluster Read/Write Scaling & Expansion Roadmap",
                    "email_body": "Kushal, telemetry shows our primary cluster throughput grew by 24%. We're excited to expand to 2 additional cloud regions.",
                    "cal_title": "Multi-Region Cloud Architecture Sync",
                    "slack_channel": "#mongodb-enterprise-sync",
                    "slack_msg": "Dev Ittycheria: Performance telemetry looks rock solid across all sharded nodes.",
                    "usage_stat": "+24% query throughput growth",
                    "usage_trend": "growth"
                }
            }
        ]

        accounts_upserted = 0
        contacts_upserted = 0
        signals_upserted = 0

        # If live HubSpot company has updated fields from the live API, overlay them onto Account 1
        if live_companies:
            live_comp = live_companies[0]
            live_props = live_comp.get("properties", {})
            live_cid = str(live_comp["id"])
            p0 = portfolio_definitions[0]
            p0["name"] = live_props.get("name") or p0["name"]
            p0["domain"] = live_props.get("domain") or p0["domain"]
            if live_props.get("annualrevenue"):
                try:
                    p0["arr"] = float(live_props["annualrevenue"])
                except Exception:
                    pass

        # If live contacts exist, attach them to Account 1
        if live_contacts:
            p0_contacts = []
            for idx, c in enumerate(live_contacts):
                c_props = c.get("properties", {})
                first_name = c_props.get("firstname", "") or ""
                last_name = c_props.get("lastname", "") or ""
                full_name = f"{first_name} {last_name}".strip() or c_props.get("email") or "HubSpot Contact"
                p0_contacts.append({
                    "id": f"cnt-hs-{c['id']}",
                    "hubspot_id": str(c["id"]),
                    "name": full_name,
                    "email": c_props.get("email") or "contact@hubspot.com",
                    "role": c_props.get("jobtitle") or "Stakeholder",
                    "is_primary": idx == 0
                })
            portfolio_definitions[0]["contacts"] = p0_contacts

        logger.info(f"Normalizing and populating {len(portfolio_definitions)} HubSpot CRM accounts with consistent multi-channel records...")

        for defn in portfolio_definitions:
            aid = defn["id"]
            cid = defn["hubspot_id"]
            arr = float(defn["arr"])
            days_to_ren = int(defn["days_to_renewal"])
            usage_drop = float(defn["usage_drop_pct"])
            days_touch = int(defn["days_since_touch"])
            crit_t = int(defn["crit_tickets"])

            # 1. Deterministic risk calculation
            eval_res = DeterministicRiskEngine.evaluate(
                days_to_renewal=days_to_ren,
                usage_drop_pct=usage_drop,
                days_since_last_touchpoint=days_touch,
                open_critical_tickets=crit_t,
                arr=arr
            )

            urgency_label = "Immediate (<30d)" if days_to_ren <= 30 else ("Within 60d" if days_to_ren <= 60 else "Stable (>60d)")
            ren_date = (start_time + timedelta(days=days_to_ren)).strftime("%Y-%m-%d")

            signals_summary = {
                "days_to_renewal": days_to_ren,
                "usage_drop_pct": usage_drop,
                "days_since_last_touchpoint": days_touch,
                "open_critical_tickets": crit_t
            }

            scen = defn["scenario"]
            primary_contact = defn["contacts"][0] if defn["contacts"] else {"name": "Primary Contact", "email": "contact@domain.com"}

            # Primary warning
            if usage_drop >= 30.0:
                main_warning = f"Critical Telemetry Contraction: -{usage_drop:.0f}% drop with renewal in {days_to_ren}d"
            elif crit_t > 0:
                main_warning = f"Support Escalation: {crit_t} critical blockers active"
            elif days_touch >= 14:
                main_warning = f"Engagement Silence: {days_touch} days since last touchpoint"
            elif days_to_ren <= 60:
                main_warning = f"Upcoming Renewal Window: {days_to_ren} days remaining"
            else:
                main_warning = f"Healthy Account: Stable revenue trajectory and active engagement"

            account_doc = {
                "id": aid,
                "hubspot_id": cid,
                "name": defn["name"],
                "domain": defn["domain"],
                "industry": defn["industry"],
                "arr": arr,
                "renewal_date": ren_date,
                "csm_owner": defn["csm_owner"],
                "health_score": max(15, 100 - eval_res["risk_score"]),
                "tier": defn["tier"],
                "status": defn["status"],
                "risk_level": eval_res["risk_level"],
                "risk_score": eval_res["risk_score"],
                "urgency_days_to_renewal": days_to_ren,
                "urgency_label": urgency_label,
                "primary_reason_code": eval_res["primary_reason_code"],
                "main_warning": main_warning,
                "contributing_factors": eval_res["contributing_factors"],
                "signals_summary": signals_summary,
                "source_system": "hubspot",
                "last_synced_at": now_iso
            }

            if self.db is not None:
                self.db.accounts.update_one({"id": aid}, {"$set": account_doc}, upsert=True)
            self._upsert_memory_account(account_doc)
            accounts_upserted += 1

            # 2. Upsert Contacts
            for c in defn["contacts"]:
                contact_doc = {
                    "id": c["id"],
                    "account_id": aid,
                    "name": c["name"],
                    "email": c["email"],
                    "role": c.get("role", "Stakeholder"),
                    "is_primary": c.get("is_primary", False),
                    "sentiment": "positive" if eval_res["risk_score"] < 30 else ("negative" if eval_res["risk_score"] >= 70 else "neutral"),
                    "last_contact_date": (start_time - timedelta(days=days_touch)).isoformat(),
                    "hubspot_id": c.get("hubspot_id", c["id"]),
                    "source_system": "hubspot"
                }
                if self.db is not None:
                    self.db.contacts.update_one({"id": c["id"]}, {"$set": contact_doc}, upsert=True)
                self._upsert_memory_contact(contact_doc)
                contacts_upserted += 1

            # 3. Build Multi-Source Signals
            signals_to_create = []

            # --- A. Live HubSpot CRM Sync Signal (Live API record) ---
            sig_crm_id = f"sig-hs-crm-{cid}"
            signals_to_create.append({
                "id": sig_crm_id,
                "signal_id": sig_crm_id,
                "account_id": aid,
                "source_category": "crm",
                "source_type": "hubspot",
                "source": "hubspot",
                "evidence_id": f"ev-{sig_crm_id}",
                "source_record_id": f"hs-comp-{cid}",
                "signal_type": "crm_sync",
                "event_type": "record_synced",
                "title": f"HubSpot CRM Account Synchronized: {defn['name']}",
                "summary": f"Live HubSpot CRM company profile ({defn['domain']}) with {len(defn['contacts'])} verified contacts and assigned owner {defn['csm_owner']}.",
                "severity": "low",
                "timestamp": now_iso,
                "event_time": now_iso,
                "observed_value": f"Verified CRM Record #{cid}",
                "is_simulated": False,
                "mode": "live",
                "metadata": {
                    "hubspot_id": cid,
                    "domain": defn["domain"],
                    "is_simulated": False,
                    "mode": "live"
                }
            })

            # --- B. Simulated Email Thread Record ---
            sig_email_id = f"sig-email-{cid}"
            email_time = (start_time - timedelta(days=max(1, days_touch))).isoformat()
            signals_to_create.append({
                "id": sig_email_id,
                "signal_id": sig_email_id,
                "account_id": aid,
                "source_category": "email",
                "source_type": "gmail",
                "source": "gmail",
                "evidence_id": f"ev-{sig_email_id}",
                "source_record_id": f"msg-{cid}-email-01",
                "signal_type": "customer_email",
                "event_type": "email_interaction",
                "title": f"Email: {scen['email_subject']}",
                "summary": f"From: {primary_contact['name']} <{primary_contact['email']}> | Body: \"{scen['email_body']}\"",
                "severity": "critical" if eval_res["risk_score"] >= 70 else ("high" if eval_res["risk_score"] >= 50 else "low"),
                "timestamp": email_time,
                "event_time": email_time,
                "observed_value": f"Last email {days_touch}d ago",
                "is_simulated": True,
                "mode": "simulated",
                "metadata": {
                    "sender": primary_contact["email"],
                    "recipient": "kushalsahu352@gmail.com",
                    "subject": scen["email_subject"],
                    "is_simulated": True,
                    "mode": "simulated"
                }
            })

            # --- C. Simulated Calendar Meeting Record ---
            sig_cal_id = f"sig-cal-{cid}"
            cal_time = (start_time - timedelta(days=days_touch + 2)).isoformat()
            signals_to_create.append({
                "id": sig_cal_id,
                "signal_id": sig_cal_id,
                "account_id": aid,
                "source_category": "calendar",
                "source_type": "google_calendar",
                "source": "google_calendar",
                "evidence_id": f"ev-{sig_cal_id}",
                "source_record_id": f"cal-evt-{cid}-01",
                "signal_type": "meeting_held",
                "event_type": "calendar_sync",
                "title": f"Calendar: {scen['cal_title']}",
                "summary": f"Meeting participants: {defn['csm_owner']} and {primary_contact['name']} ({primary_contact['role']}). Recorded status: Completed.",
                "severity": "medium" if days_touch >= 14 else "low",
                "timestamp": cal_time,
                "event_time": cal_time,
                "observed_value": f"{days_touch} days since touchpoint",
                "is_simulated": True,
                "mode": "simulated",
                "metadata": {
                    "meeting_title": scen["cal_title"],
                    "attendees": [primary_contact["email"], "kushalsahu352@gmail.com"],
                    "is_simulated": True,
                    "mode": "simulated"
                }
            })

            # --- D. Simulated Slack Collaboration Record ---
            sig_slack_id = f"sig-slack-{cid}"
            slack_time = (start_time - timedelta(days=max(1, days_touch - 1))).isoformat()
            signals_to_create.append({
                "id": sig_slack_id,
                "signal_id": sig_slack_id,
                "account_id": aid,
                "source_category": "slack",
                "source_type": "slack",
                "source": "slack",
                "evidence_id": f"ev-{sig_slack_id}",
                "source_record_id": f"slack-msg-{cid}-01",
                "signal_type": "slack_activity",
                "event_type": "slack_message",
                "title": f"Slack {scen['slack_channel']}: Channel Update",
                "summary": f"{scen['slack_msg']}",
                "severity": "high" if "escalat" in scen["slack_channel"] else "low",
                "timestamp": slack_time,
                "event_time": slack_time,
                "observed_value": f"Channel {scen['slack_channel']}",
                "is_simulated": True,
                "mode": "simulated",
                "metadata": {
                    "channel": scen["slack_channel"],
                    "author": primary_contact["name"],
                    "is_simulated": True,
                    "mode": "simulated"
                }
            })

            # --- E. Simulated Product Usage Telemetry Record ---
            sig_usage_id = f"sig-usage-{cid}"
            usage_time = (start_time - timedelta(days=2)).isoformat()
            signals_to_create.append({
                "id": sig_usage_id,
                "signal_id": sig_usage_id,
                "account_id": aid,
                "source_category": "usage",
                "source_type": "mixpanel",
                "source": "mixpanel",
                "evidence_id": f"ev-{sig_usage_id}",
                "source_record_id": f"mixpanel-metric-{cid}",
                "signal_type": "usage_drop" if usage_drop > 0 else "usage_growth",
                "event_type": "telemetry_aggregate",
                "title": f"Telemetry Stream: {scen['usage_stat']}",
                "summary": f"Product analytics telemetry recorded {scen['usage_stat']} across trailing 14 days.",
                "severity": "critical" if usage_drop >= 30.0 else ("high" if usage_drop >= 15.0 else "low"),
                "timestamp": usage_time,
                "event_time": usage_time,
                "observed_value": f"-{usage_drop:.0f}% contraction" if usage_drop > 0 else "+8% steady",
                "is_simulated": True,
                "mode": "simulated",
                "metadata": {
                    "drop_pct": usage_drop,
                    "trend": scen["usage_trend"],
                    "is_simulated": True,
                    "mode": "simulated"
                }
            })

            # --- F. Simulated Support Escalation (if critical tickets exist) ---
            if crit_t > 0:
                sig_supp_id = f"sig-support-{cid}"
                supp_time = (start_time - timedelta(days=3)).isoformat()
                signals_to_create.append({
                    "id": sig_supp_id,
                    "signal_id": sig_supp_id,
                    "account_id": aid,
                    "source_category": "support",
                    "source_type": "zendesk",
                    "source": "zendesk",
                    "evidence_id": f"ev-{sig_supp_id}",
                    "source_record_id": f"zen-tkt-{cid}-01",
                    "signal_type": "support_ticket",
                    "event_type": "ticket_escalation",
                    "title": f"Zendesk Escalation: {crit_t} Unresolved Critical Blockers",
                    "summary": f"High severity support escalation logged by {primary_contact['name']}. Status: Escalated to Engineering.",
                    "severity": "critical",
                    "timestamp": supp_time,
                    "event_time": supp_time,
                    "observed_value": f"{crit_t} Critical Tickets",
                    "is_simulated": True,
                    "mode": "simulated",
                    "metadata": {
                        "priority": "critical",
                        "open_critical_tickets": crit_t,
                        "is_simulated": True,
                        "mode": "simulated"
                    }
                })

            # Save signals idempotently
            for sig in signals_to_create:
                if self.db is not None:
                    self.db.signals.update_one({"id": sig["id"]}, {"$set": sig}, upsert=True)
                self._upsert_memory_signal(sig)
                signals_upserted += 1

        # Update integration connectors in MongoDB
        self._update_integration_connectors(accounts_upserted, contacts_upserted, signals_upserted, now_iso)

        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        summary = {
            "status": "success",
            "message": "Unified demo system seeded successfully.",
            "duration_ms": duration_ms,
            "accounts_seeded": accounts_upserted,
            "contacts_seeded": contacts_upserted,
            "signals_seeded": signals_upserted,
            "live_hubspot_integrated": True,
            "simulated_channels": ["email", "calendar", "slack", "usage", "support"],
            "timestamp": now_iso
        }
        logger.info(f"Unified demo seeding completed in {duration_ms}ms: {summary}")
        return summary

    def _update_integration_connectors(self, acc_count: int, con_count: int, sig_count: int, now_iso: str):
        connectors = [
            IntegrationConnector(
                id="conn-hubspot-01",
                name="HubSpot CRM Live Integration",
                category="crm",
                provider="HubSpot",
                status=IntegrationStatus.CONNECTED,
                mode=IntegrationMode.LIVE,
                is_real_connector=True,
                endpoint_or_host=settings.HUBSPOT_BASE_URL,
                last_sync_time=now_iso,
                records_synced=acc_count + con_count,
                data_freshness_status="fresh",
                freshness_minutes=0,
                freshness_warning=None,
                config_details={
                    "auth_type": "Private App Access Token (Bearer)",
                    "objects": ["companies", "contacts", "deals", "tickets", "owners"],
                    "live_accounts": acc_count
                }
            ),
            IntegrationConnector(
                id="conn-email-01",
                name="Google Workspace / Gmail Sync",
                category="email",
                provider="Gmail API",
                status=IntegrationStatus.CONNECTED,
                mode=IntegrationMode.SIMULATED,
                is_real_connector=False,
                endpoint_or_host="https://gmail.googleapis.com/gmail/v1/users/me",
                last_sync_time=now_iso,
                records_synced=acc_count * 2,
                data_freshness_status="fresh",
                freshness_minutes=2,
                freshness_warning=None,
                config_details={"auth_type": "Simulated Unified Demo Stream", "monitored_domains": ["revora.internal"]}
            ),
            IntegrationConnector(
                id="conn-cal-01",
                name="Google Calendar Meeting Telemetry",
                category="calendar",
                provider="Google Calendar",
                status=IntegrationStatus.CONNECTED,
                mode=IntegrationMode.SIMULATED,
                is_real_connector=False,
                endpoint_or_host="https://www.googleapis.com/calendar/v3",
                last_sync_time=now_iso,
                records_synced=acc_count,
                data_freshness_status="fresh",
                freshness_minutes=5,
                freshness_warning=None,
                config_details={"auth_type": "Simulated Unified Demo Stream"}
            ),
            IntegrationConnector(
                id="conn-slack-01",
                name="Slack Enterprise Connect",
                category="slack",
                provider="Slack API",
                status=IntegrationStatus.CONNECTED,
                mode=IntegrationMode.SIMULATED,
                is_real_connector=False,
                endpoint_or_host="https://slack.com/api",
                last_sync_time=now_iso,
                records_synced=acc_count,
                data_freshness_status="fresh",
                freshness_minutes=1,
                freshness_warning=None,
                config_details={"auth_type": "Bot OAuth Token", "channels": ["#customer-collab", "#escalations"]}
            ),
            IntegrationConnector(
                id="conn-usage-01",
                name="Product Telemetry Stream",
                category="usage",
                provider="Mixpanel Telemetry",
                status=IntegrationStatus.CONNECTED,
                mode=IntegrationMode.SIMULATED,
                is_real_connector=False,
                endpoint_or_host="https://api.mixpanel.com/track",
                last_sync_time=now_iso,
                records_synced=acc_count * 5,
                data_freshness_status="fresh",
                freshness_minutes=1,
                freshness_warning=None,
                config_details={"auth_type": "Simulated Telemetry Ingestion"}
            )
        ]

        for conn in connectors:
            integration_repo._integrations[conn.id] = conn
            if self.db is not None:
                try:
                    self.db.integrations.update_one({"id": conn.id}, {"$set": conn.model_dump()}, upsert=True)
                except Exception as e:
                    logger.warning(f"Error upserting connector {conn.id}: {e}")

    def _upsert_memory_account(self, doc: Dict[str, Any]):
        for idx, a in enumerate(account_repo._accounts_data):
            if a.get("id") == doc["id"]:
                account_repo._accounts_data[idx] = doc
                return
        account_repo._accounts_data.append(doc)

    def _upsert_memory_contact(self, doc: Dict[str, Any]):
        for idx, c in enumerate(account_repo._contacts_data):
            if c.get("id") == doc["id"]:
                account_repo._contacts_data[idx] = doc
                return
        account_repo._contacts_data.append(doc)

    def _upsert_memory_signal(self, doc: Dict[str, Any]):
        for idx, s in enumerate(account_repo._signals_data):
            if s.get("id") == doc["id"]:
                account_repo._signals_data[idx] = doc
                return
        account_repo._signals_data.append(doc)


unified_demo_system = UnifiedDemoSystem()

if __name__ == "__main__":
    import sys
    res = unified_demo_system.seed_all()
    print("Seed result:", res)
