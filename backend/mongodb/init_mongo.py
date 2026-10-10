"""
MongoDB Initialization & Seed Script for Revora / SignalBridge AI
Initializes all 11 MongoDB collections, sets up production-grade indexes,
and seeds repeatable, idempotent demo data across accounts, signals,
proposals, tasks, and integrations.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from pymongo import MongoClient, ASCENDING, DESCENDING

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("revora.mongodb")

SEED_FILE = Path(__file__).resolve().parent.parent / "app" / "data" / "seed_data.json"

def init_mongodb(uri: str = "mongodb://localhost:27017", db_name: str = "revora"):
    logger.info(f"Connecting to MongoDB at {uri}, database: {db_name}...")
    client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    
    # Check connection
    try:
        client.admin.command('ping')
        logger.info("Successfully connected to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return False

    db = client[db_name]

    # 1. Create collections and indexes across all 11 roadmap collections
    logger.info("Setting up collections and indexes...")
    db.accounts.create_index([("id", ASCENDING)], unique=True)
    db.accounts.create_index([("renewal_date", ASCENDING)])
    db.accounts.create_index([("status", ASCENDING)])

    db.contacts.create_index([("id", ASCENDING)], unique=True)
    db.contacts.create_index([("account_id", ASCENDING)])

    db.signals.create_index([("id", ASCENDING)], unique=True)
    db.signals.create_index([("account_id", ASCENDING), ("timestamp", DESCENDING)])
    db.signals.create_index([("source_record_id", ASCENDING)])

    db.risk_assessments.create_index([("account_id", ASCENDING), ("evaluated_at", DESCENDING)])

    db.investigations.create_index([("id", ASCENDING)], unique=True)
    db.investigations.create_index([("account_id", ASCENDING), ("created_at", DESCENDING)])

    db.action_proposals.create_index([("id", ASCENDING)], unique=True)
    db.action_proposals.create_index([("account_id", ASCENDING)])
    db.action_proposals.create_index([("status", ASCENDING)])

    db.approvals.create_index([("id", ASCENDING)], unique=True)
    db.approvals.create_index([("proposal_id", ASCENDING)])
    db.approvals.create_index([("account_id", ASCENDING)])

    db.tasks.create_index([("id", ASCENDING)], unique=True)
    db.tasks.create_index([("account_id", ASCENDING)])
    db.tasks.create_index([("status", ASCENDING)])

    db.audit_logs.create_index([("account_id", ASCENDING), ("timestamp", DESCENDING)])
    db.audit_events.create_index([("account_id", ASCENDING), ("timestamp", DESCENDING)])

    db.integrations.create_index([("id", ASCENDING)], unique=True)
    db.integrations.create_index([("category", ASCENDING)])

    db.sync_runs.create_index([("id", ASCENDING)], unique=True)
    db.sync_runs.create_index([("integration_id", ASCENDING), ("started_at", DESCENDING)])

    # 2. Seed data if available
    if SEED_FILE.exists():
        logger.info(f"Loading seed data from {SEED_FILE}...")
        with open(SEED_FILE, "r", encoding="utf-8") as f:
            seed_data = json.load(f)

        accounts = seed_data.get("accounts", [])
        for acc in accounts:
            doc = {k: v for k, v in acc.items() if k != "_id"}
            db.accounts.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        logger.info(f"Upserted {len(accounts)} accounts.")

        contacts = seed_data.get("contacts", [])
        for con in contacts:
            doc = {k: v for k, v in con.items() if k != "_id"}
            db.contacts.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        logger.info(f"Upserted {len(contacts)} contacts.")

        signals = seed_data.get("signals", [])
        for sig in signals:
            doc = {k: v for k, v in sig.items() if k != "_id"}
            # Ensure normalized fields are set
            doc["signal_id"] = doc.get("signal_id") or doc["id"]
            doc["source"] = doc.get("source") or doc.get("source_category")
            doc["occurred_at"] = doc.get("occurred_at") or doc.get("timestamp")
            db.signals.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        logger.info(f"Upserted {len(signals)} signals.")

    # 3. Seed default Integration Connectors
    now = datetime.utcnow()
    connectors = [
        {
            "id": "conn-crm-01",
            "name": "Salesforce CRM Connector",
            "category": "crm",
            "provider": "Salesforce",
            "status": "connected",
            "mode": "simulated",
            "is_real_connector": False,
            "endpoint_or_host": "https://na124.salesforce.com/services/data/v58.0",
            "last_sync_time": (now - timedelta(minutes=14)).isoformat(),
            "records_synced": 1420,
            "data_freshness_status": "fresh",
            "freshness_minutes": 14,
            "freshness_warning": None,
            "config_details": {"auth_type": "OAuth2.0", "instance": "Enterprise Tier"}
        },
        {
            "id": "conn-email-01",
            "name": "Google Workspace / Gmail Sync",
            "category": "email",
            "provider": "Gmail API",
            "status": "connected",
            "mode": "simulated",
            "is_real_connector": False,
            "endpoint_or_host": "https://gmail.googleapis.com/gmail/v1/users/me",
            "last_sync_time": (now - timedelta(minutes=28)).isoformat(),
            "records_synced": 8940,
            "data_freshness_status": "fresh",
            "freshness_minutes": 28,
            "freshness_warning": None,
            "config_details": {"auth_type": "Google Service Account", "delegated_user": "csm@revora.app"}
        },
        {
            "id": "conn-cal-01",
            "name": "Google Calendar Meeting Tracker",
            "category": "calendar",
            "provider": "Google Calendar",
            "status": "connected",
            "mode": "simulated",
            "is_real_connector": False,
            "endpoint_or_host": "https://www.googleapis.com/calendar/v3/calendars/primary",
            "last_sync_time": (now - timedelta(minutes=45)).isoformat(),
            "records_synced": 312,
            "data_freshness_status": "fresh",
            "freshness_minutes": 45,
            "freshness_warning": None,
            "config_details": {"calendar_id": "primary", "meeting_keywords": ["renewal", "executive", "qbr"]}
        },
        {
            "id": "conn-usage-01",
            "name": "Mixpanel Product Telemetry Stream",
            "category": "usage",
            "provider": "Mixpanel",
            "status": "connected",
            "mode": "simulated",
            "is_real_connector": False,
            "endpoint_or_host": "https://data.mixpanel.com/api/2.0/export",
            "last_sync_time": (now - timedelta(minutes=5)).isoformat(),
            "records_synced": 45200,
            "data_freshness_status": "fresh",
            "freshness_minutes": 5,
            "freshness_warning": None,
            "config_details": {"project_id": "revora-core-prod", "sync_window": "hourly"}
        },
        {
            "id": "conn-support-01",
            "name": "Zendesk Support Escalations",
            "category": "support",
            "provider": "Zendesk",
            "status": "connected",
            "mode": "simulated",
            "is_real_connector": False,
            "endpoint_or_host": "https://revora.zendesk.com/api/v2",
            "last_sync_time": (now - timedelta(minutes=80)).isoformat(),
            "records_synced": 480,
            "data_freshness_status": "stale_warning",
            "freshness_minutes": 80,
            "freshness_warning": "Sync exceeds recommended 60-min window",
            "config_details": {"subdomain": "revora", "priority_filter": ["urgent", "high"]}
        },
        {
            "id": "conn-db-01",
            "name": "MongoDB Canonical Data Store",
            "category": "database",
            "provider": "MongoDB",
            "status": "connected",
            "mode": "live",
            "is_real_connector": True,
            "endpoint_or_host": uri,
            "last_sync_time": now.isoformat(),
            "records_synced": len(accounts) + len(signals),
            "data_freshness_status": "fresh",
            "freshness_minutes": 0,
            "freshness_warning": None,
            "config_details": {"database": db_name, "indexes": 11}
        }
    ]
    for conn in connectors:
        db.integrations.update_one({"id": conn["id"]}, {"$set": conn}, upsert=True)
    logger.info(f"Upserted {len(connectors)} integration connectors.")

    # 4. Seed initial Action Proposals
    seed_proposals = [
        {
            "id": "prop-101",
            "account_id": "acc-101",
            "action_type": "csm_email",
            "title": "Send Urgent Re-engagement Email to VP Logistics",
            "reason": "45% product usage drop and 2 unresolved critical delivery delay tickets",
            "investigation_id": "inv-acc-101",
            "evidence_ids": ["sig-101", "sig-102"],
            "payload": {
                "recipient": "dave.miller@acmedynamics.com",
                "recipient_name": "Dave Miller",
                "subject": "Urgent check-in: Addressing current system telemetry and open tickets",
                "body": "Hi Dave,\n\nI noticed a 45% decline in your team's routing activity over the past 3 weeks along with two open critical delivery tickets. I want to personally ensure your team is supported ahead of your November renewal.\n\nCould we jump on a brief 15-minute call tomorrow?\n\nBest,\nSarah Jenkins"
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_101_init",
            "created_at": now.isoformat()
        },
        {
            "id": "prop-102",
            "account_id": "acc-104",
            "action_type": "crm_update",
            "title": "Update CRM Account Status to High Churn Risk",
            "reason": "Executive disengagement and 35% API drop",
            "investigation_id": "inv-acc-104",
            "evidence_ids": ["sig-109", "sig-110"],
            "payload": {
                "target": "Salesforce CRM",
                "field": "Risk Flag",
                "value": "Executive Disengagement & API Drop"
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_102_init",
            "created_at": now.isoformat()
        },
        {
            "id": "prop-103",
            "account_id": "acc-102",
            "action_type": "csm_email",
            "title": "Technical Architecture Sync on SSO Integration",
            "reason": "25% usage drop following authentication deprecation warning",
            "investigation_id": "inv-acc-102",
            "evidence_ids": ["sig-104", "sig-105"],
            "payload": {
                "recipient": "elena.rostova@cloudnova.io",
                "recipient_name": "Elena Rostova",
                "subject": "CloudNova + Revora: Clearing technical blocker on Ticket #4402",
                "body": "Hi Elena,\n\nI saw the authentication blocker on ticket #4402 and wanted to connect you directly with our Principal Solutions Engineer to get this resolved today.\n\nLet me know your availability for a 20-minute working session.\n\nBest,\nMarcus Chen"
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_103_init",
            "created_at": now.isoformat()
        },
        {
            "id": "prop-104",
            "account_id": "acc-103",
            "action_type": "task_create",
            "title": "Quarterly Telemetry Optimization Review",
            "reason": "Seasonal 12% query drop in Singapore branch during regional holiday",
            "investigation_id": "inv-acc-103",
            "evidence_ids": ["sig-106", "sig-113"],
            "payload": {
                "assigned_to": "Sarah Jenkins",
                "due_date": (now + timedelta(days=7)).strftime("%Y-%m-%d"),
                "priority": "medium",
                "title": "Review Vortex APAC Query Volume Recovery",
                "description": "Verify Singapore query traffic rebounded following corporate holiday."
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_104_init",
            "created_at": now.isoformat()
        },
        {
            "id": "prop-105",
            "account_id": "acc-105",
            "action_type": "csm_email",
            "title": "Expansion Proposal: 50 Additional Hospital Licenses",
            "reason": "Customer reached 98% license saturation with 123 days to renewal",
            "investigation_id": "inv-acc-105",
            "evidence_ids": ["sig-111", "sig-112"],
            "payload": {
                "recipient": "dr.kavita.patel@omnihealth.org",
                "recipient_name": "Dr. Kavita Patel",
                "subject": "OmniHealth + Revora: Expanding capacity for your new hospital clinics",
                "body": "Dear Dr. Patel,\n\nCongratulations on the successful deployment across your regional hospitals! With your license utilization at 98.2%, we have prepared a custom expansion package that preserves your enterprise tier pricing.\n\nWould you like me to send over the updated order form?\n\nWarm regards,\nMarcus Chen"
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_105_init",
            "created_at": now.isoformat()
        },
        {
            "id": "prop-106",
            "account_id": "acc-106",
            "action_type": "csm_email",
            "title": "Urgent Financial Compliance & Contract Safeguard Outreach",
            "reason": "30% drop in banking transaction throughput 33 days before renewal",
            "investigation_id": "inv-acc-106",
            "evidence_ids": ["sig-107"],
            "payload": {
                "recipient": "r.sterling@apexfintech.com",
                "recipient_name": "Robert Sterling",
                "subject": "Action Required: Enterprise SLA review and upcoming November renewal",
                "body": "Hi Robert,\n\nOur system detected a 30% contraction in API throughput alongside an open high-priority compliance ticket. Given your upcoming contract renewal on November 12th, our VP of Engineering and I are available to address any security concerns.\n\nBest regards,\nSarah Jenkins"
            },
            "status": "proposed",
            "version": 1,
            "content_hash": "hash_prop_106_init",
            "created_at": now.isoformat()
        }
    ]
    for prop in seed_proposals:
        db.action_proposals.update_one({"id": prop["id"]}, {"$setOnInsert": prop}, upsert=True)
    logger.info(f"Upserted {len(seed_proposals)} action proposals.")

    # 5. Seed initial Follow-Up Tasks for All Accounts
    seed_tasks = [
        {
            "id": "task-acc-101",
            "account_id": "acc-101",
            "title": "Executive Sponsor Alignment Call",
            "description": "Schedule direct check-in with Dave Miller to address delivery tickets.",
            "assigned_to": "Sarah Jenkins",
            "due_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "priority": "high",
            "status": "pending",
            "evidence_ids": ["sig-101", "sig-102"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-102",
            "account_id": "acc-102",
            "title": "Resolve SSO Deployment Blockers with Engineering",
            "description": "Coordinate with CloudNova lead architect to clear ticket #4402.",
            "assigned_to": "Marcus Chen",
            "due_date": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
            "priority": "high",
            "status": "pending",
            "evidence_ids": ["sig-104"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-103",
            "account_id": "acc-103",
            "title": "Verify APAC Inactivity Rebound",
            "description": "Monitor Singapore branch query logs to verify post-holiday traffic normalizes.",
            "assigned_to": "Sarah Jenkins",
            "due_date": (now + timedelta(days=5)).strftime("%Y-%m-%d"),
            "priority": "low",
            "status": "pending",
            "evidence_ids": ["sig-113"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-104",
            "account_id": "acc-104",
            "title": "Escalate API Outage Root Cause to VP Engineering",
            "description": "Provide HyperScale Robotics team with post-mortem incident report.",
            "assigned_to": "Alex Rivera",
            "due_date": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "priority": "high",
            "status": "pending",
            "evidence_ids": ["sig-109", "sig-110"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-105",
            "account_id": "acc-105",
            "title": "Deliver Q1 License Expansion Contract",
            "description": "Send updated Master Services Agreement with 50 added hospital seats.",
            "assigned_to": "Marcus Chen",
            "due_date": (now + timedelta(days=4)).strftime("%Y-%m-%d"),
            "priority": "medium",
            "status": "pending",
            "evidence_ids": ["sig-111", "sig-112"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-106",
            "account_id": "acc-106",
            "title": "Schedule Executive Risk Intercept with CIO",
            "description": "Coordinate joint review of financial latency and renewal terms.",
            "assigned_to": "Sarah Jenkins",
            "due_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "priority": "high",
            "status": "pending",
            "evidence_ids": ["sig-107"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-107",
            "account_id": "acc-107",
            "title": "Confirm Peak Season Black Friday SLA",
            "description": "Validate 99.99% uptime parameters ahead of Q4 e-commerce sales rush.",
            "assigned_to": "Alex Rivera",
            "due_date": (now + timedelta(days=10)).strftime("%Y-%m-%d"),
            "priority": "medium",
            "status": "pending",
            "evidence_ids": ["sig-114"],
            "created_at": now.isoformat()
        },
        {
            "id": "task-acc-108",
            "account_id": "acc-108",
            "title": "Quarterly Media Infrastructure Sync",
            "description": "Meet with Head of Content Delivery to review publishing bandwidth.",
            "assigned_to": "Marcus Chen",
            "due_date": (now + timedelta(days=6)).strftime("%Y-%m-%d"),
            "priority": "low",
            "status": "pending",
            "evidence_ids": ["sig-115"],
            "created_at": now.isoformat()
        }
    ]
    for tsk in seed_tasks:
        db.tasks.update_one({"id": tsk["id"]}, {"$setOnInsert": tsk}, upsert=True)
    logger.info(f"Upserted {len(seed_tasks)} initial tasks.")

    logger.info("MongoDB initialization completed successfully across all 11 collections.")
    return True

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "revora")
    init_mongodb(uri, db_name)
