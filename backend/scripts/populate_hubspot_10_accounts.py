"""
Script to populate 10 comprehensive HubSpot CRM accounts into MongoDB.
Ensures source_system: 'hubspot', authentic hubspot_id format,
associated contacts, rich CRM signals, and deterministic risk profiles.
"""
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from app.services.risk_engine import DeterministicRiskEngine

def populate_hubspot_accounts():
    client = MongoClient("mongodb://localhost:27017")
    db = client["revora"]

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    accounts_data = [
        # 1. Existing Live Portal Account
        {
            "id": "acc-hs-351708265163",
            "hubspot_id": "351708265163",
            "name": "HubSpot",
            "domain": "hubspot.com",
            "industry": "Marketing & CRM Cloud",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-touch-351708265163",
                    "title": "HubSpot CRM Engagement: 1d since modification",
                    "summary": "Last recorded HubSpot CRM company modification was 1 day ago.",
                    "severity": "low",
                    "signal_type": "touchpoint_lag",
                    "source_record_id": "351708265163"
                },
                {
                    "id": "sig-hs-record-351708265163",
                    "title": "HubSpot CRM Account Synchronized: HubSpot",
                    "summary": "Direct API sync verified 2 contacts and live CRM company profile (hubspot.com).",
                    "severity": "low",
                    "signal_type": "crm_sync",
                    "source_record_id": "351708265163"
                },
                {
                    "id": "sig-hs-stk-567638860497",
                    "title": "HubSpot Executive Stakeholder: Brian Halligan (Sample Contact) (Executive Chairperson)",
                    "summary": "Key decision maker registered in HubSpot CRM: Brian Halligan, Executive Chairperson (bh@hubspot.com).",
                    "severity": "low",
                    "signal_type": "stakeholder_detected",
                    "source_record_id": "567638860497"
                }
            ]
        },
        # 2. Datadog Systems (Critical Risk)
        {
            "id": "acc-hs-351708265164",
            "hubspot_id": "351708265164",
            "name": "Datadog Systems",
            "domain": "datadoghq.com",
            "industry": "Cloud Observability & Security",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-usage-351708265164",
                    "title": "Telemetry Anomaly: -42% Usage Contraction",
                    "summary": "APM streaming ingest decreased by 42% over the trailing 14-day window.",
                    "severity": "critical",
                    "signal_type": "usage_drop",
                    "source_record_id": "sig-hs-usg-01"
                },
                {
                    "id": "sig-hs-ticket-351708265164",
                    "title": "HubSpot Support Escalation: 2 Unresolved P1 Outage Tickets",
                    "summary": "Customer logged 2 critical tickets reporting latency spikes during peak ingestion.",
                    "severity": "critical",
                    "signal_type": "support_ticket",
                    "source_record_id": "hs-tkt-9101"
                },
                {
                    "id": "sig-hs-touch-351708265164",
                    "title": "HubSpot CRM Touchpoint Lag: 19d without Recorded Touchpoint",
                    "summary": "No recorded interaction between CSM Kushal Sahu and client in 19 days.",
                    "severity": "high",
                    "signal_type": "touchpoint_lag",
                    "source_record_id": "351708265164"
                }
            ]
        },
        # 3. Snowflake Analytics (High Risk)
        {
            "id": "acc-hs-351708265165",
            "hubspot_id": "351708265165",
            "name": "Snowflake Analytics",
            "domain": "snowflake.com",
            "industry": "Data Cloud & Warehousing",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-usage-351708265165",
                    "title": "Query Contraction: -31% Warehouse Queries",
                    "summary": "Daily active analytical compute queries dropped by 31% over past 3 weeks.",
                    "severity": "high",
                    "signal_type": "usage_drop",
                    "source_record_id": "sig-hs-usg-02"
                },
                {
                    "id": "sig-hs-touch-351708265165",
                    "title": "HubSpot CRM Touchpoint Lag: 28d Inactivity Warning",
                    "summary": "Customer disengaged from last two scheduled quarterly business review invitations.",
                    "severity": "high",
                    "signal_type": "touchpoint_lag",
                    "source_record_id": "351708265165"
                },
                {
                    "id": "sig-hs-deal-351708265165",
                    "title": "HubSpot Deal Pipeline: Renewal Review $240,000",
                    "summary": "Deal stage set to 'Decision Maker Bought-In' but contract review delayed.",
                    "severity": "medium",
                    "signal_type": "contract_renewal",
                    "source_record_id": "hs-deal-7721"
                }
            ]
        },
        # 4. Atlassian Corp (High Risk)
        {
            "id": "acc-hs-351708265166",
            "hubspot_id": "351708265166",
            "name": "Atlassian Corp",
            "domain": "atlassian.com",
            "industry": "Collaboration Software",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-ticket-351708265166",
                    "title": "HubSpot Support Ticket: SSO Blocker on Ticket #8841",
                    "summary": "Critical authentication migration issue affecting 85 engineering teams.",
                    "severity": "critical",
                    "signal_type": "support_ticket",
                    "source_record_id": "hs-tkt-8841"
                },
                {
                    "id": "sig-hs-usage-351708265166",
                    "title": "Usage Dip: -22% Active Workspace Sessions",
                    "summary": "Session volume down 22% due to login friction on secondary tenant.",
                    "severity": "medium",
                    "signal_type": "usage_drop",
                    "source_record_id": "sig-hs-usg-03"
                }
            ]
        },
        # 5. Stripe Payments (Medium Risk)
        {
            "id": "acc-hs-351708265167",
            "hubspot_id": "351708265167",
            "name": "Stripe Payments",
            "domain": "stripe.com",
            "industry": "Financial Infrastructure",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-deal-351708265167",
                    "title": "HubSpot Deal: Enterprise Expansion Tier $310,000",
                    "summary": "Global payments reconciliation expansion pending quarterly sign-off.",
                    "severity": "low",
                    "signal_type": "contract_renewal",
                    "source_record_id": "hs-deal-9011"
                },
                {
                    "id": "sig-hs-touch-351708265167",
                    "title": "HubSpot CRM Touchpoint: Bi-weekly Sync Active",
                    "summary": "CSM touchpoint verified 12 days ago with positive billing automation feedback.",
                    "severity": "low",
                    "signal_type": "touchpoint_lag",
                    "source_record_id": "351708265167"
                }
            ]
        },
        # 6. Twilio Communications (Medium Risk)
        {
            "id": "acc-hs-351708265168",
            "hubspot_id": "351708265168",
            "name": "Twilio Communications",
            "domain": "twilio.com",
            "industry": "Cloud Communications Platform",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-touch-351708265168",
                    "title": "HubSpot CRM Telemetry: Webhook Routing Healthy",
                    "summary": "Voice and SMS message routing telemetry operating at 99.98% SLA.",
                    "severity": "low",
                    "signal_type": "crm_record",
                    "source_record_id": "351708265168"
                }
            ]
        },
        # 7. Canva Design (Low Risk)
        {
            "id": "acc-hs-351708265169",
            "hubspot_id": "351708265169",
            "name": "Canva Design",
            "domain": "canva.com",
            "industry": "Visual Communication & Design",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-growth-351708265169",
                    "title": "Expansion Signal: 98% Seat Saturation",
                    "summary": "Enterprise user license saturation reached 98.4%. Upgrade proposal generated.",
                    "severity": "low",
                    "signal_type": "crm_opportunity",
                    "source_record_id": "hs-opp-410"
                }
            ]
        },
        # 8. Figma Collaboration (Critical Risk)
        {
            "id": "acc-hs-351708265170",
            "hubspot_id": "351708265170",
            "name": "Figma Collaboration",
            "domain": "figma.com",
            "industry": "Design & Prototyping Platform",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-usage-351708265170",
                    "title": "Critical Usage Contraction: -48% Canvas Edits",
                    "summary": "Collaborative canvas editor usage contracted sharply over last 30 days.",
                    "severity": "critical",
                    "signal_type": "usage_drop",
                    "source_record_id": "sig-hs-usg-04"
                },
                {
                    "id": "sig-hs-touch-351708265170",
                    "title": "HubSpot Touchpoint Lag: 25d Inactivity (18d to Renewal)",
                    "summary": "Executive sponsor departed organization; renewal unassigned in procurement.",
                    "severity": "critical",
                    "signal_type": "touchpoint_lag",
                    "source_record_id": "351708265170"
                }
            ]
        },
        # 9. Notion Labs (Medium Risk)
        {
            "id": "acc-hs-351708265171",
            "hubspot_id": "351708265171",
            "name": "Notion Labs",
            "domain": "notion.so",
            "industry": "Knowledge Management & Workspace",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-touch-351708265171",
                    "title": "HubSpot Contract Review: Pricing Model Restructuring",
                    "summary": "Customer requested consolidation of multi-workspace licensing under global MSA.",
                    "severity": "medium",
                    "signal_type": "contract_renewal",
                    "source_record_id": "hs-deal-8041"
                }
            ]
        },
        # 10. MongoDB Enterprise (Low Risk)
        {
            "id": "acc-hs-351708265172",
            "hubspot_id": "351708265172",
            "name": "MongoDB Enterprise",
            "domain": "mongodb.com",
            "industry": "Developer Data Platform",
            "csm_owner": "Kushal Sahu",
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
            "signals": [
                {
                    "id": "sig-hs-growth-351708265172",
                    "title": "Telemetry Growth: +24% Read/Write Queries",
                    "summary": "Workload scaling rapidly in primary production cluster. Healthy telemetry.",
                    "severity": "low",
                    "signal_type": "crm_record",
                    "source_record_id": "sig-hs-growth-05"
                }
            ]
        }
    ]

    print(f"Populating {len(accounts_data)} HubSpot CRM accounts into MongoDB...")

    for item in accounts_data:
        aid = item["id"]
        days_to_ren = item["days_to_renewal"]
        usage_drop = float(item["usage_drop_pct"])
        days_touch = int(item["days_since_touch"])
        crit_t = int(item["crit_tickets"])
        arr = float(item["arr"])

        # Calculate deterministic risk
        eval_res = DeterministicRiskEngine.evaluate(
            days_to_renewal=days_to_ren,
            usage_drop_pct=usage_drop,
            days_since_last_touchpoint=days_touch,
            open_critical_tickets=crit_t,
            arr=arr
        )

        urgency_label = "Immediate (<30d)" if days_to_ren <= 30 else ("Within 60d" if days_to_ren <= 60 else "Stable (>60d)")
        ren_date = (now + timedelta(days=days_to_ren)).strftime("%Y-%m-%d")

        signals_summary = {
            "days_to_renewal": days_to_ren,
            "usage_drop_pct": usage_drop,
            "days_since_last_touchpoint": days_touch,
            "open_critical_tickets": crit_t
        }

        # Main warning
        if item["signals"]:
            first_sig = item["signals"][0]
            main_warning = f"{first_sig['title']}: {first_sig['summary']}"
        else:
            main_warning = f"Risk reason: {eval_res['primary_reason_code']}"

        acc_doc = {
            "id": aid,
            "hubspot_id": item["hubspot_id"],
            "name": item["name"],
            "domain": item["domain"],
            "industry": item["industry"],
            "arr": arr,
            "renewal_date": ren_date,
            "csm_owner": item["csm_owner"],
            "health_score": max(20, 100 - eval_res["risk_score"]),
            "tier": item["tier"],
            "status": item["status"],
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

        # Upsert account
        db.accounts.update_one({"id": aid}, {"$set": acc_doc}, upsert=True)

        # Upsert contacts
        for c in item["contacts"]:
            cid = c["id"]
            cnt_doc = {
                "id": cid,
                "account_id": aid,
                "name": c["name"],
                "email": c["email"],
                "role": c["role"],
                "is_primary": c["is_primary"],
                "sentiment": "neutral",
                "last_contact_date": now_iso,
                "hubspot_id": c["hubspot_id"],
                "source_system": "hubspot"
            }
            db.contacts.update_one({"id": cid}, {"$set": cnt_doc}, upsert=True)

        # Upsert signals
        for s in item["signals"]:
            sid = s["id"]
            sig_doc = {
                "id": sid,
                "signal_id": sid,
                "account_id": aid,
                "source_category": "crm",
                "source_type": "hubspot",
                "source": "hubspot",
                "evidence_id": f"ev-{sid}",
                "source_record_id": s["source_record_id"],
                "signal_type": s["signal_type"],
                "event_type": "crm_event",
                "title": s["title"],
                "summary": s["summary"],
                "severity": s["severity"],
                "timestamp": now_iso,
                "event_time": now_iso,
                "metadata": {
                    "account_id": aid,
                    "hubspot_id": item["hubspot_id"],
                    "days_since_touchpoint": days_touch,
                    "drop_pct": usage_drop,
                    "priority": "critical" if s["severity"] == "critical" else "medium"
                }
            }
            db.signals.update_one({"id": sid}, {"$set": sig_doc}, upsert=True)

        # Raw record for audit
        db.hubspot_raw_records.update_one(
            {"object_type": "company", "hubspot_id": item["hubspot_id"]},
            {"$set": {
                "hubspot_id": item["hubspot_id"],
                "object_type": "company",
                "data": {"id": item["hubspot_id"], "properties": {"name": item["name"], "domain": item["domain"]}},
                "synced_at": now_iso
            }},
            upsert=True
        )

    print("Populating completed!")
    print(f"Total HubSpot accounts in DB: {db.accounts.count_documents({'source_system': 'hubspot'})}")
    print(f"Total HubSpot contacts in DB: {db.contacts.count_documents({'source_system': 'hubspot'})}")
    print(f"Total HubSpot signals in DB: {db.signals.count_documents({'source_type': 'hubspot'})}")

if __name__ == "__main__":
    populate_hubspot_accounts()
