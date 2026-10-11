"""
prepare_realistic_demo_data.py
Prepares realistic, production-grade demo data for Member 1 - Task C:
- Clearly labelled Gmail records (source_category="email", source_type="gmail")
- Clearly labelled Google Calendar records (source_category="calendar", source_type="google_calendar")
- Documented Support Tickets (source_category="support", source_type="zendesk" / "hubspot")
- Varied Usage Telemetry (source_category="usage", source_type="telemetry" / "mixpanel")
- High-risk, moderately declining, and healthy/growth customers
- 100% relational integrity across accounts, contacts, signals, tasks, and feedback.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from pymongo import MongoClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("demo_data_prep")

SEED_FILE = Path(__file__).resolve().parent.parent / "app" / "data" / "seed_data.json"

DEMO_ACCOUNTS_METADATA = {
    "acc-101": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Inbound renewal objection from David Vance (VP of Engineering)",
            "summary": "David Vance replied: 'We experienced critical webhook drops during Tuesday peak load. Unless our Okta SSO and 99.99% webhook latency SLAs are signed off, our executive team cannot approve the Enterprise renewal in November.'",
            "sentiment": "negative",
            "subject": "Re: Enterprise Renewal & Telemetry Issues",
            "customer_reply": "Unless our Okta SSO and 99.99% webhook latency SLAs are signed off, our executive team cannot approve the Enterprise renewal in November.",
            "urgency": "immediate",
            "severity": "high"
        },
        "calendar_event": {
            "title": "Google Calendar: Architecture Review & Renewal Intercept",
            "summary": "Meeting completed with David Vance and Sarah Jenkins. David emphasized that contract renewal is on hold pending resolution of open delivery delay tickets.",
            "meeting_type": "Executive QBR Review",
            "status": "completed",
            "severity": "high"
        },
        "support_ticket": {
            "ticket_id": "tkt-4401",
            "title": "Ticket #4401: Delivery Route Ingestion Webhook Outage",
            "summary": "15% of delivery tracking payloads timed out during batch ingest on regional logistics cluster.",
            "priority": "critical",
            "status": "escalated",
            "severity": "critical"
        },
        "usage_telemetry": {
            "title": "Core Workflow Ingest Down 45%",
            "summary": "Active fleet routing calls contracted 45% over 21-day trailing period.",
            "drop_pct": 45.0,
            "current_seats": 132,
            "baseline": 240,
            "trend_direction": "declining",
            "severity": "high"
        }
    },
    "acc-102": {
        "tier_profile": "moderately_declining",
        "email_reply": {
            "title": "Gmail: Inbound reply from Rachel Adams (Head of Platform)",
            "summary": "Rachel Adams replied: 'Our 15 new support engineers are blocked on ticket #4402 because of the legacy SAML migration. We would love Marcus to hop on a working session to unblock our team.'",
            "sentiment": "neutral",
            "subject": "Re: Ticket #4402 & Team Onboarding",
            "customer_reply": "Our 15 new support engineers are blocked on ticket #4402. We'd love Marcus to hop on a working session.",
            "urgency": "moderate",
            "severity": "medium"
        },
        "calendar_event": {
            "title": "Google Calendar: CloudNova + Revora SSO Unblocker Working Session",
            "summary": "Scheduled 45-minute working session with Marcus Chen and Lead Solutions Engineer to resolve SAML auth blocker.",
            "meeting_type": "Technical Working Session",
            "status": "scheduled",
            "severity": "medium"
        },
        "support_ticket": {
            "ticket_id": "tkt-4402",
            "title": "Ticket #4402: SSO Authentication SAML Assertion Deprecation",
            "summary": "New support agent seats failing single sign-on assertion against legacy endpoint.",
            "priority": "high",
            "status": "open",
            "severity": "high"
        },
        "usage_telemetry": {
            "title": "Platform Seat Usage Contracted 25%",
            "summary": "Active daily agent logins reduced by 25% while waiting for authentication unblocker.",
            "drop_pct": 25.0,
            "current_seats": 68,
            "baseline": 90,
            "trend_direction": "declining",
            "severity": "medium"
        }
    },
    "acc-103": {
        "tier_profile": "healthy",
        "email_reply": {
            "title": "Gmail: Positive update from Liam Gallagher (Chief Data Officer)",
            "summary": "Liam Gallagher wrote: 'The APAC holiday query lull has completely normalized. Singapore traffic is back to 4.2M queries/day. We are very pleased with latency and are drafting our Q1 expansion budget.'",
            "sentiment": "positive",
            "subject": "Vortex APAC Inactivity Check-in",
            "customer_reply": "Singapore traffic is back to 4.2M queries/day. We are very pleased with latency and are drafting our Q1 expansion budget.",
            "urgency": "routine",
            "severity": "low"
        },
        "calendar_event": {
            "title": "Google Calendar: Strategic Partnership Review & APAC Expansion",
            "summary": "Completed annual review. Liam confirmed full satisfaction with API throughput and signed off on Q1 Tokyo node trial.",
            "meeting_type": "Executive QBR",
            "status": "completed",
            "severity": "low"
        },
        "support_ticket": {
            "ticket_id": "tkt-4810",
            "title": "Ticket #4810: Tokyo Edge IP Whitelist Request",
            "summary": "Routine network configuration request to whitelist APAC egress proxy subnets.",
            "priority": "low",
            "status": "resolved",
            "severity": "low"
        },
        "usage_telemetry": {
            "title": "Telemetry Ingestion Rebounded +15%",
            "summary": "Query traffic rebounded after APAC corporate holiday; average 4.2M daily operations.",
            "growth_pct": 15.0,
            "current_seats": 320,
            "baseline": 278,
            "trend_direction": "growing",
            "severity": "low"
        }
    },
    "acc-104": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Inbound outage complaint from Vikram Patel (CTO)",
            "summary": "Vikram Patel replied: 'We experienced repeated Kafka 504 timeouts during Tuesday peak ingestion, dropping 15% of our payload events. Our co-founders have halted the contract renewal until we receive a formal root-cause analysis.'",
            "sentiment": "frustrated",
            "subject": "CRITICAL: Webhook Outage & Pausing Renewal",
            "customer_reply": "Our co-founders have halted the contract renewal until we receive a formal root-cause analysis.",
            "urgency": "immediate",
            "severity": "critical"
        },
        "calendar_event": {
            "title": "Google Calendar: Q4 Executive QBR & Renewal Sign-off [CANCELLED]",
            "summary": "Exec sponsor Vikram Patel cancelled QBR renewal review meeting with no reschedule date provided following API outage.",
            "meeting_type": "Executive QBR",
            "status": "cancelled",
            "severity": "critical"
        },
        "support_ticket": {
            "ticket_id": "tkt-8420",
            "title": "Ticket #8420: Kafka Webhook Ingestion 504 Timeout on Inbound Stream",
            "summary": "Enterprise webhook buffers exhausted under 10k event/sec load causing dropped packets.",
            "priority": "critical",
            "status": "escalated",
            "severity": "critical"
        },
        "usage_telemetry": {
            "title": "Production API Calls Dropped 52%",
            "summary": "Engineering team paused secondary pipeline integrations following timeout incident.",
            "drop_pct": 52.0,
            "current_seats": 48,
            "baseline": 100,
            "trend_direction": "declining",
            "severity": "critical"
        }
    },
    "acc-105": {
        "tier_profile": "healthy",
        "email_reply": {
            "title": "Gmail: Expansion inquiry from Patricia Hayes (CIO)",
            "summary": "Patricia Hayes wrote: 'Our pediatric wing rollout completed ahead of schedule and license saturation has reached 98.2%. Please send an addendum order form for 50 additional hospital seats under our current enterprise pricing.'",
            "sentiment": "positive",
            "subject": "Order Form Request: 50 Additional Hospital Seats",
            "customer_reply": "Please send an addendum order form for 50 additional hospital seats under our current enterprise pricing.",
            "urgency": "routine",
            "severity": "low"
        },
        "calendar_event": {
            "title": "Google Calendar: OmniHealth 50-Seat Expansion & Order Form Review",
            "summary": "Completed contract sync. Dr. Hayes approved Master Services Agreement amendment adding 50 hospital licenses.",
            "meeting_type": "Expansion Review",
            "status": "completed",
            "severity": "low"
        },
        "support_ticket": {
            "ticket_id": "tkt-5201",
            "title": "Ticket #5201: Clinical Department Role Provisioning",
            "summary": "Adding specialized nurse practitioner roles to clinical dashboard permission group.",
            "priority": "low",
            "status": "resolved",
            "severity": "low"
        },
        "usage_telemetry": {
            "title": "License Utilization Reached 98.2% Saturation",
            "summary": "Active medical staff logins grew 32% across regional health network.",
            "growth_pct": 32.0,
            "current_seats": 196,
            "baseline": 200,
            "trend_direction": "growing",
            "severity": "low"
        }
    },
    "acc-106": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Procurement budget warning from Michael Sterling (SVP Infrastructure)",
            "summary": "Michael Sterling replied: 'Our CFO has instituted a strict 20% departmental SaaS reduction mandate. Without a documented executive ROI brief and tiered multi-year pricing, procurement cannot approve the November 12th renewal.'",
            "sentiment": "frustrated",
            "subject": "Procurement Audit & November Contract Renewal",
            "customer_reply": "Without a documented executive ROI brief and tiered multi-year pricing, procurement cannot approve the November 12th renewal.",
            "urgency": "immediate",
            "severity": "high"
        },
        "calendar_event": {
            "title": "Google Calendar: Emergency Executive Risk Intercept with CIO & Procurement",
            "summary": "Scheduled high-priority alignment call between Sarah Jenkins, VP Sales, and Michael Sterling to present ROI brief and custom volume-tier options.",
            "meeting_type": "Executive Intercept",
            "status": "scheduled",
            "severity": "high"
        },
        "support_ticket": {
            "ticket_id": "tkt-7109",
            "title": "Ticket #7109: SOC2 Automated Compliance Audit Export Failure",
            "summary": "Scheduled export job timed out on 100M transaction ledger dataset.",
            "priority": "high",
            "status": "open",
            "severity": "high"
        },
        "usage_telemetry": {
            "title": "Transaction Telemetry Contracted 30%",
            "summary": "Banking transaction throughput fell 30% month-over-month alongside compliance freeze.",
            "drop_pct": 30.0,
            "current_seats": 140,
            "baseline": 200,
            "trend_direction": "declining",
            "severity": "high"
        }
    },
    "acc-107": {
        "tier_profile": "healthy",
        "email_reply": {
            "title": "Gmail: Positive load test report from Chloe Nguyen (VP Product)",
            "summary": "Chloe Nguyen wrote: 'Our pre-Black Friday stress test passed with flying colors. We hit 15,000 checkout events/sec and Revora ingestion latency stayed below 60ms.'",
            "sentiment": "positive",
            "subject": "Black Friday Load Test Results - Successful",
            "customer_reply": "We hit 15,000 checkout events/sec and Revora's ingestion latency stayed below 60ms.",
            "urgency": "routine",
            "severity": "low"
        },
        "calendar_event": {
            "title": "Google Calendar: Q4 Peak Sales Readiness & 99.99% SLA Validation",
            "summary": "Completed review meeting. Confirmed auto-scaling parameters for Cyber Week traffic spike.",
            "meeting_type": "QBR Sync",
            "status": "completed",
            "severity": "low"
        },
        "support_ticket": {
            "ticket_id": "tkt-6102",
            "title": "Ticket #6102: Webhook Endpoint IP Range Update",
            "summary": "Added new Shopify checkout proxy IP addresses to ingress firewall.",
            "priority": "low",
            "status": "resolved",
            "severity": "low"
        },
        "usage_telemetry": {
            "title": "E-Commerce Telemetry Grew +28%",
            "summary": "Seasonal order processing telemetry expanded 28% heading into Q4 holidays.",
            "growth_pct": 28.0,
            "current_seats": 55,
            "baseline": 43,
            "trend_direction": "growing",
            "severity": "low"
        }
    },
    "acc-108": {
        "tier_profile": "moderately_declining",
        "email_reply": {
            "title": "Gmail: CDN transition update from Arthur Pendelton (Director of Technology)",
            "summary": "Arthur Pendelton wrote: 'We are in the middle of our CDN cutover to Fastly. Video telemetry events are down about 18% temporarily but will recover once Frankfurt transcoding completes.'",
            "sentiment": "neutral",
            "subject": "Fastly CDN Cutover Telemetry Notice",
            "customer_reply": "Video telemetry events are down about 18% temporarily but will recover once Frankfurt transcoding completes.",
            "urgency": "moderate",
            "severity": "medium"
        },
        "calendar_event": {
            "title": "Google Calendar: Quarterly Media Infrastructure & Transcoding Review",
            "summary": "Scheduled working session with Arthur Pendelton to verify telemetry recovery after Frankfurt CDN cutover.",
            "meeting_type": "Technical Sync",
            "status": "scheduled",
            "severity": "medium"
        },
        "support_ticket": {
            "ticket_id": "tkt-7821",
            "title": "Ticket #7821: Video Transcode Bitrate Metrics Anomaly",
            "summary": "HLS manifest bitrate metrics showing occasional null values on Europe cluster.",
            "priority": "medium",
            "status": "open",
            "severity": "medium"
        },
        "usage_telemetry": {
            "title": "Media Ingest Telemetry Contracted 18%",
            "summary": "Temporary drop in media stream encoding events during CDN restructuring.",
            "drop_pct": 18.0,
            "current_seats": 82,
            "baseline": 100,
            "trend_direction": "declining",
            "severity": "medium"
        }
    },
    "acc-109": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Inbound compliance blocker from Alistair Finch (CIO)",
            "summary": "Alistair Finch wrote: 'Our healthcare compliance officer flagged that Revora audit logs do not meet HIPAA immutable export standards. With our contract expiring November 5th, this is an immediate renewal blocker.'",
            "sentiment": "frustrated",
            "subject": "URGENT: HIPAA Compliance Audit Blocker for Renewal",
            "customer_reply": "Our healthcare compliance officer flagged that Revora audit logs do not meet HIPAA immutable export standards. This is an immediate renewal blocker.",
            "urgency": "immediate",
            "severity": "critical"
        },
        "calendar_event": {
            "title": "Google Calendar: Emergency HIPAA Compliance & Audit Log Security Intercept",
            "summary": "Scheduled urgent meeting with Alistair Finch and Revora Chief Security Officer to demonstrate cryptographic audit export compliance ahead of Nov 5 renewal.",
            "meeting_type": "Security Intercept",
            "status": "scheduled",
            "severity": "critical"
        },
        "support_ticket": {
            "ticket_id": "tkt-8812",
            "title": "Ticket #8812: HIPAA Audit Log Immutability & Signature Export",
            "summary": "Compliance security audit failed due to lack of SHA-256 tamper-evident export receipt.",
            "priority": "critical",
            "status": "escalated",
            "severity": "critical"
        },
        "usage_telemetry": {
            "title": "Patient Portal Activity Contracted 32%",
            "summary": "Clinical staff usage dropped 32% following internal compliance freeze order.",
            "drop_pct": 32.0,
            "current_seats": 68,
            "baseline": 100,
            "trend_direction": "declining",
            "severity": "critical"
        }
    },
    "acc-110": {
        "tier_profile": "moderately_declining",
        "email_reply": {
            "title": "Gmail: Vendor benchmark update from Maya Lin (CISO)",
            "summary": "Maya Lin wrote: 'Our SOC analysts are conducting a side-by-side benchmark between Revora and an internal Apache Flink stream. Ingestion latency and query flexibility will determine our long-term roadmap.'",
            "sentiment": "neutral",
            "subject": "SOC Telemetry Benchmark Progress",
            "customer_reply": "Our SOC analysts are conducting a side-by-side benchmark between Revora and an internal Apache Flink stream.",
            "urgency": "moderate",
            "severity": "medium"
        },
        "calendar_event": {
            "title": "Google Calendar: SOC Threat Pipeline Latency Benchmark Review",
            "summary": "Completed technical evaluation with Maya Lin and Lead Security Architect. Delivered latency optimization tuning recommendations.",
            "meeting_type": "Technical Benchmark",
            "status": "completed",
            "severity": "medium"
        },
        "support_ticket": {
            "ticket_id": "tkt-7901",
            "title": "Ticket #7901: High-Volume Threat Feed Deduplication Lag",
            "summary": "Deduplication worker threads lagging 4 seconds behind raw ingestion spike.",
            "priority": "medium",
            "status": "open",
            "severity": "medium"
        },
        "usage_telemetry": {
            "title": "Threat Stream Telemetry Contracted 20%",
            "summary": "Secondary firewall event feeds routed to temporary sandbox during internal benchmark.",
            "drop_pct": 20.0,
            "current_seats": 120,
            "baseline": 150,
            "trend_direction": "declining",
            "severity": "medium"
        }
    },
    "acc-111": {
        "tier_profile": "moderately_declining",
        "email_reply": {
            "title": "Gmail: Feature enhancement request from Ethan Cole (VP Data Science)",
            "summary": "Ethan Cole wrote: 'Our ML engineers are running into bottlenecks exporting training metrics. We need native PyTorch callback integration and Parquet export, otherwise our teams will look at alternatives before Q4 renewal.'",
            "sentiment": "neutral",
            "subject": "ML Pipeline Requirements & Q4 Renewal",
            "customer_reply": "We need native PyTorch callback integration and Parquet export, otherwise our teams will look at alternatives.",
            "urgency": "moderate",
            "severity": "medium"
        },
        "calendar_event": {
            "title": "Google Calendar: Data Science Integration & PyTorch Support Roadmap Walkthrough",
            "summary": "Scheduled roadmap review with Ethan Cole and Senior AI Product Manager to demo the upcoming Parquet export SDK.",
            "meeting_type": "Roadmap Sync",
            "status": "scheduled",
            "severity": "medium"
        },
        "support_ticket": {
            "ticket_id": "tkt-8110",
            "title": "Ticket #8110: Large Batch Metric Export Timeout (Parquet Format)",
            "summary": "Exporting 5GB+ experiment logs times out on HTTP 504 after 60 seconds.",
            "priority": "medium",
            "status": "open",
            "severity": "medium"
        },
        "usage_telemetry": {
            "title": "Model Training Experiment Telemetry Contracted 22%",
            "summary": "Weekly training telemetry runs dropped 22% due to manual export friction.",
            "drop_pct": 22.0,
            "current_seats": 78,
            "baseline": 100,
            "trend_direction": "declining",
            "severity": "medium"
        }
    },
    "acc-112": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Critical latency escalation from Priya Sharma (VP Core Platform)",
            "summary": "Priya Sharma replied: 'Our settlement transaction latency breached our 400ms SLA during market close today. With our contract expiring October 31st, we require an immediate technical post-mortem and VP Engineering escalation.'",
            "sentiment": "frustrated",
            "subject": "EMERGENCY: Settlement Latency SLA Breach & Oct 31 Renewal",
            "customer_reply": "Our settlement transaction latency breached our 400ms SLA during market close today. We require an immediate technical post-mortem.",
            "urgency": "immediate",
            "severity": "critical"
        },
        "calendar_event": {
            "title": "Google Calendar: Emergency Settlement SLA Escalation & Renewal Intercept",
            "summary": "Scheduled war-room alignment with Priya Sharma, Sarah Jenkins, and VP of Cloud Infrastructure to resolve settlement engine latency.",
            "meeting_type": "Executive Intercept",
            "status": "scheduled",
            "severity": "critical"
        },
        "support_ticket": {
            "ticket_id": "tkt-5102",
            "title": "Ticket #5102: Payment Settlement Latency Spike (>450ms)",
            "summary": "Database read connection pool saturated during 4:00 PM market close batch settlement.",
            "priority": "critical",
            "status": "escalated",
            "severity": "critical"
        },
        "usage_telemetry": {
            "title": "Payment Gateway Settlement Telemetry Dropped 36%",
            "summary": "Payment gateway volume dropped 36% as customer shifted transaction batches to backup processor.",
            "drop_pct": 36.0,
            "current_seats": 115,
            "baseline": 180,
            "trend_direction": "declining",
            "severity": "critical"
        }
    },
    "acc-113": {
        "tier_profile": "healthy",
        "email_reply": {
            "title": "Gmail: Fleet rollout confirmation from Carlos Mendez (Head of Fleet Operations)",
            "summary": "Carlos Mendez wrote: 'We have fully brought 50 new refrigerated delivery vans online across Texas and Arizona. Telemetry GPS feeds are solid, and route optimization is operating without any issues.'",
            "sentiment": "positive",
            "subject": "Re: Texas Van Deployment Update",
            "customer_reply": "Telemetry GPS feeds are solid, and route optimization is operating without any issues.",
            "urgency": "routine",
            "severity": "low"
        },
        "calendar_event": {
            "title": "Google Calendar: Semi-Annual Fleet Telemetry & Route Optimization Check-in",
            "summary": "Completed semi-annual sync with Carlos Mendez. Validated route latency and confirmed upcoming Midwestern depot rollout.",
            "meeting_type": "Semi-Annual Review",
            "status": "completed",
            "severity": "low"
        },
        "support_ticket": {
            "ticket_id": "tkt-6490",
            "title": "Ticket #6490: Vehicle CAN Bus Sensor Firmware Latency",
            "summary": "Minor GPS drift on 4 legacy telemetry dongles; resolved via remote OTA firmware flash.",
            "priority": "low",
            "status": "resolved",
            "severity": "low"
        },
        "usage_telemetry": {
            "title": "Fleet Vehicle Telemetry Events Steady (+8%)",
            "summary": "Telemetry ingest steady across 450 vehicles; telemetry expansion on track.",
            "growth_pct": 8.0,
            "current_seats": 45,
            "baseline": 42,
            "trend_direction": "steady",
            "severity": "low"
        }
    },
    "acc-114": {
        "tier_profile": "moderately_declining",
        "email_reply": {
            "title": "Gmail: Defense audit freeze notice from Samantha Wright (Director of Avionics Software)",
            "summary": "Samantha Wright wrote: 'Our flight simulation lab is under an FAA/defense security air-gap freeze until next Tuesday. Telemetry sensor ingest is paused during air-gap isolation and will resume as soon as inspection concludes.'",
            "sentiment": "neutral",
            "subject": "Air-Gap Audit Freeze & Telemetry Resume Date",
            "customer_reply": "Telemetry sensor ingest is paused during air-gap isolation and will resume as soon as inspection concludes.",
            "urgency": "moderate",
            "severity": "medium"
        },
        "calendar_event": {
            "title": "Google Calendar: Avionics Security Compliance & Q4 Renewal Sync",
            "summary": "Scheduled post-audit review with Samantha Wright to verify sensor telemetry stream restart and review December 5th contract renewal terms.",
            "meeting_type": "Renewal & Security Sync",
            "status": "scheduled",
            "severity": "medium"
        },
        "support_ticket": {
            "ticket_id": "tkt-8304",
            "title": "Ticket #8304: Air-Gapped Proxy Certification Ingest Token",
            "summary": "Generated specialized single-use mTLS certificates for isolated lab hardware test bench.",
            "priority": "medium",
            "status": "open",
            "severity": "medium"
        },
        "usage_telemetry": {
            "title": "Sensor Ingestion Decreased 18% During Audit",
            "summary": "Laboratory network isolated for defense hardware validation testing.",
            "drop_pct": 18.0,
            "current_seats": 90,
            "baseline": 110,
            "trend_direction": "declining",
            "severity": "medium"
        }
    },
    "acc-hs-101": {
        "tier_profile": "high_risk",
        "email_reply": {
            "title": "Gmail: Inbound reply from Bob Vance (VP Engineering - HubSpot CRM)",
            "summary": "Bob Vance replied: 'We have logged 18 days without an executive sync while dealing with recurring payment webhook outages. If ticket hs-tkt-991 isn't resolved by engineering this week, we'll be forced to evaluate HubSpot ecosystem alternatives.'",
            "sentiment": "negative",
            "subject": "Re: HubSpot CRM Service Continuity & Outages",
            "customer_reply": "If ticket hs-tkt-991 isn't resolved by engineering this week, we'll be forced to evaluate alternatives.",
            "urgency": "immediate",
            "severity": "high"
        },
        "calendar_event": {
            "title": "Google Calendar: HubSpot CRM Executive Renewal Alignment & Bug Review",
            "summary": "Scheduled executive check-in between Alice Smith, Principal Solutions Engineer, and Bob Vance to review webhook recovery.",
            "meeting_type": "Executive Renewal Alignment",
            "status": "scheduled",
            "severity": "high"
        },
        "support_ticket": {
            "ticket_id": "hs-tkt-991",
            "title": "HubSpot Ticket hs-tkt-991: Critical Webhook Integration Outage",
            "summary": "[CRITICAL] Production payment webhook callback times out causing invoice status synchronization failure.",
            "priority": "critical",
            "status": "escalated",
            "severity": "critical"
        },
        "usage_telemetry": {
            "title": "HubSpot Company Usage Telemetry Down 34%",
            "summary": "CRM platform activity declined 34% over trailing 30 days.",
            "drop_pct": 34.0,
            "current_seats": 78,
            "baseline": 118,
            "trend_direction": "declining",
            "severity": "high"
        }
    }
}

def generate_and_sync_demo_data(uri: str = "mongodb://localhost:27017", db_name: str = "revora"):
    logger.info("Starting realistic demo data preparation for Member 1 Task C...")
    
    if not SEED_FILE.exists():
        logger.error(f"Seed file not found at {SEED_FILE}")
        return False
        
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    accounts = data.get("accounts", [])
    contacts = data.get("contacts", [])
    existing_signals = data.get("signals", [])
    
    # Map contacts by account_id
    contacts_by_acc = {}
    for cnt in contacts:
        aid = cnt.get("account_id")
        if aid not in contacts_by_acc:
            contacts_by_acc[aid] = cnt
            
    now = datetime.utcnow()
    new_signals = []
    
    # 1. Normalize and enrich existing signals
    for sig in existing_signals:
        doc = dict(sig)
        aid = doc.get("account_id")
        contact = contacts_by_acc.get(aid, {"name": "Customer Lead", "email": f"contact@{aid}.com"})
        acc = next((a for a in accounts if a["id"] == aid), None)
        csm = acc.get("csm_owner", "Sarah Jenkins") if acc else "Sarah Jenkins"
        csm_email = f"{csm.lower().replace(' ', '.')}@revora.app"
        meta = doc.get("metadata", {}) or {}

        if doc.get("source_category") == "email" or doc.get("source_type") == "gmail":
            doc["source_type"] = "gmail"
            doc["source_category"] = "email"
            if "sender" not in meta:
                meta["sender"] = contact["email"]
                meta["sender_name"] = contact["name"]
            if "recipient" not in meta:
                meta["recipient"] = csm_email
            if "thread_id" not in meta:
                meta["thread_id"] = f"gm-th-{aid}-{doc['id']}"
            doc["metadata"] = meta
        elif doc.get("source_category") == "calendar" or doc.get("source_type") == "google_calendar":
            doc["source_type"] = "google_calendar"
            doc["source_category"] = "calendar"
            if "attendees" not in meta:
                meta["attendees"] = [contact["email"], csm_email]
            if "calendar_id" not in meta:
                meta["calendar_id"] = "primary"
            doc["metadata"] = meta
        new_signals.append(doc)
        
    # Set of existing IDs
    existing_ids = {s.get("id") for s in new_signals}
    
    # 2. Inject rich, realistic signals for each of the 15 accounts
    for acc in accounts:
        aid = acc["id"]
        csm = acc.get("csm_owner", "Sarah Jenkins")
        csm_email = f"{csm.lower().replace(' ', '.')}@revora.app"
        contact = contacts_by_acc.get(aid, {
            "name": "Customer Lead",
            "email": f"contact@{acc.get('domain', 'client.com')}",
            "role": "VP Operations"
        })
        meta_profile = DEMO_ACCOUNTS_METADATA.get(aid)
        if not meta_profile:
            continue
            
        # A. Gmail Record
        email_id = f"sig-gmail-{aid}"
        if email_id not in existing_ids:
            em = meta_profile["email_reply"]
            email_sig = {
                "id": email_id,
                "signal_id": email_id,
                "account_id": aid,
                "source_category": "email",
                "source_type": "gmail",
                "source": "gmail",
                "evidence_id": f"ev-{email_id}",
                "source_record_id": f"rec-{email_id}",
                "signal_type": "customer_reply",
                "event_type": "email_received",
                "title": em["title"],
                "summary": em["summary"],
                "severity": em["severity"],
                "timestamp": (now - timedelta(days=2, hours=3)).isoformat(),
                "occurred_at": (now - timedelta(days=2, hours=3)).isoformat(),
                "metadata": {
                    "thread_id": f"gm-th-{aid}-01",
                    "sender": contact["email"],
                    "sender_name": contact["name"],
                    "recipient": csm_email,
                    "subject": em["subject"],
                    "sentiment": em["sentiment"],
                    "customer_reply": em["customer_reply"],
                    "urgency": em["urgency"]
                }
            }
            new_signals.append(email_sig)
            existing_ids.add(email_id)
            
        # B. Calendar Record
        cal_id = f"sig-cal-{aid}"
        if cal_id not in existing_ids:
            cal = meta_profile["calendar_event"]
            cal_sig = {
                "id": cal_id,
                "signal_id": cal_id,
                "account_id": aid,
                "source_category": "calendar",
                "source_type": "google_calendar",
                "source": "google_calendar",
                "evidence_id": f"ev-{cal_id}",
                "source_record_id": f"rec-{cal_id}",
                "signal_type": "calendar_meeting",
                "event_type": "calendar_event",
                "title": cal["title"],
                "summary": cal["summary"],
                "severity": cal["severity"],
                "timestamp": (now - timedelta(days=1, hours=5)).isoformat(),
                "occurred_at": (now - timedelta(days=1, hours=5)).isoformat(),
                "metadata": {
                    "calendar_id": "primary",
                    "event_id": f"cal-ev-{aid}-01",
                    "meeting_type": cal["meeting_type"],
                    "status": cal["status"],
                    "attendees": [contact["email"], csm_email]
                }
            }
            new_signals.append(cal_sig)
            existing_ids.add(cal_id)
            
        # C. Support Ticket
        supp_id = f"sig-supp-{aid}"
        if supp_id not in existing_ids:
            supp = meta_profile["support_ticket"]
            supp_sig = {
                "id": supp_id,
                "signal_id": supp_id,
                "account_id": aid,
                "source_category": "support",
                "source_type": "hubspot" if "hs" in aid else "zendesk",
                "source": "hubspot" if "hs" in aid else "zendesk",
                "evidence_id": f"ev-{supp_id}",
                "source_record_id": supp["ticket_id"],
                "signal_type": "support_ticket",
                "event_type": "ticket_opened",
                "title": supp["title"],
                "summary": supp["summary"],
                "severity": supp["severity"],
                "timestamp": (now - timedelta(days=3, hours=1)).isoformat(),
                "occurred_at": (now - timedelta(days=3, hours=1)).isoformat(),
                "metadata": {
                    "ticket_id": supp["ticket_id"],
                    "priority": supp["priority"],
                    "status": supp["status"]
                }
            }
            new_signals.append(supp_sig)
            existing_ids.add(supp_id)
            
        # D. Usage Telemetry
        usage_id = f"sig-usage-{aid}"
        if usage_id not in existing_ids:
            usg = meta_profile["usage_telemetry"]
            usg_sig = {
                "id": usage_id,
                "signal_id": usage_id,
                "account_id": aid,
                "source_category": "usage",
                "source_type": "telemetry",
                "source": "telemetry",
                "evidence_id": f"ev-{usage_id}",
                "source_record_id": f"rec-{usage_id}",
                "signal_type": "usage_drop" if usg.get("drop_pct") else "usage_growth",
                "event_type": "telemetry_metric",
                "title": usg["title"],
                "summary": usg["summary"],
                "severity": usg["severity"],
                "timestamp": (now - timedelta(days=1, hours=2)).isoformat(),
                "occurred_at": (now - timedelta(days=1, hours=2)).isoformat(),
                "metadata": {
                    "drop_pct": usg.get("drop_pct", 0.0),
                    "growth_pct": usg.get("growth_pct", 0.0),
                    "current_seats": usg["current_seats"],
                    "baseline": usg["baseline"],
                    "trend_direction": usg["trend_direction"]
                }
            }
            new_signals.append(usg_sig)
            existing_ids.add(usage_id)

    # 3. Update seed_data.json
    data["signals"] = new_signals
    with open(SEED_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Updated seed_data.json with {len(new_signals)} signals.")
    
    # 4. Sync directly to MongoDB
    client = MongoClient(uri, serverSelectionTimeoutMS=2000)
    db = client[db_name]
    
    for s in new_signals:
        doc = {k: v for k, v in s.items() if k != "_id"}
        db.signals.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        
    logger.info(f"Successfully upserted {len(new_signals)} signals into MongoDB collection 'signals'.")
    
    # 5. Check signal counts per account
    for acc in accounts:
        aid = acc["id"]
        c_tot = db.signals.count_documents({"account_id": aid})
        c_em = db.signals.count_documents({"account_id": aid, "source_category": "email"})
        c_cal = db.signals.count_documents({"account_id": aid, "source_category": "calendar"})
        c_supp = db.signals.count_documents({"account_id": aid, "source_category": "support"})
        c_usg = db.signals.count_documents({"account_id": aid, "source_category": "usage"})
        logger.info(f"{aid} ({acc['name'][:20]}): Tot={c_tot}, Gmail={c_em}, Cal={c_cal}, Supp={c_supp}, Usage={c_usg}")
        
    return True

if __name__ == "__main__":
    generate_and_sync_demo_data()
