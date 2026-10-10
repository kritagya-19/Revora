"""
MongoDB Initialization & Seed Script for Revora / SignalBridge AI
Initializes MongoDB collections, sets up indexes, and seeds repeatable demo data.
"""

import json
import logging
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

    # Create collections and indexes
    logger.info("Setting up indexes...")
    db.accounts.create_index([("id", ASCENDING)], unique=True)
    db.accounts.create_index([("renewal_date", ASCENDING)])
    db.accounts.create_index([("status", ASCENDING)])

    db.contacts.create_index([("id", ASCENDING)], unique=True)
    db.contacts.create_index([("account_id", ASCENDING)])

    db.signals.create_index([("id", ASCENDING)], unique=True)
    db.signals.create_index([("account_id", ASCENDING), ("timestamp", DESCENDING)])

    db.risk_assessments.create_index([("account_id", ASCENDING), ("evaluated_at", DESCENDING)])

    db.action_proposals.create_index([("id", ASCENDING)], unique=True)
    db.action_proposals.create_index([("account_id", ASCENDING)])
    db.action_proposals.create_index([("status", ASCENDING)])

    db.audit_events.create_index([("account_id", ASCENDING), ("created_at", DESCENDING)])

    # Seed data if available
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
            db.signals.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        logger.info(f"Upserted {len(signals)} signals.")

    logger.info("MongoDB initialization completed successfully.")
    return True

if __name__ == "__main__":
    import os
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "revora")
    init_mongodb(uri, db_name)
