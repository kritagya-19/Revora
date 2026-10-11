import logging
from pymongo import MongoClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup")

def purge_demo_data():
    client = MongoClient("mongodb://localhost:27017")
    db = client["revora"]

    demo_ids = [f"acc-10{i}" for i in range(1, 9)]
    logger.info(f"Purging demo accounts: {demo_ids} and mock accounts...")

    # 1. Accounts
    r_acc = db.accounts.delete_many({
        "$or": [
            {"id": {"$in": demo_ids}},
            {"id": "acc-hs-hs-comp-99"},
            {"source_system": {"$ne": "hubspot"}}
        ]
    })
    logger.info(f"Deleted {r_acc.deleted_count} demo/mock accounts from db.accounts.")

    # 2. Contacts
    r_con = db.contacts.delete_many({
        "$or": [
            {"id": {"$regex": "^con-10"}},
            {"id": "cnt-hs-hs-cnt-991"},
            {"source_system": {"$ne": "hubspot"}}
        ]
    })
    logger.info(f"Deleted {r_con.deleted_count} demo/mock contacts from db.contacts.")

    # 3. Signals
    r_sig = db.signals.delete_many({
        "$or": [
            {"id": {"$regex": "^sig-10"}},
            {"id": "sig_test_ingest_01"},
            {"account_id": {"$in": demo_ids + ["acc-hs-hs-comp-99"]}},
            {"source_type": {"$ne": "hubspot"}}
        ]
    })
    logger.info(f"Deleted {r_sig.deleted_count} demo/mock signals from db.signals.")

    # Remaining valid accounts
    remaining_accounts = list(db.accounts.find({}, {"_id": 0, "id": 1, "name": 1, "source_system": 1}))
    valid_ids = [a["id"] for a in remaining_accounts]
    logger.info(f"Remaining accounts in DB: {remaining_accounts}")

    # 4. Dependent collections
    r_prop = db.action_proposals.delete_many({"account_id": {"$nin": valid_ids}})
    r_inv = db.investigations.delete_many({"account_id": {"$nin": valid_ids}})
    r_tsk = db.tasks.delete_many({"account_id": {"$nin": valid_ids}})
    r_app = db.approvals.delete_many({"account_id": {"$nin": valid_ids}})
    r_risk = db.risk_assessments.delete_many({"account_id": {"$nin": valid_ids}})
    r_ev = db.audit_events.delete_many({"account_id": {"$nin": valid_ids}})
    r_log = db.audit_logs.delete_many({"account_id": {"$nin": valid_ids}})
    r_raw = db.hubspot_raw_records.delete_many({"hubspot_id": {"$in": ["hs-comp-99", "hs-cnt-991", "hs-deal-991", "hs-tkt-991"]}})

    logger.info(f"Cleaned dependent records: proposals={r_prop.deleted_count}, investigations={r_inv.deleted_count}, tasks={r_tsk.deleted_count}, approvals={r_app.deleted_count}, risk={r_risk.deleted_count}, audit={r_ev.deleted_count}, raw={r_raw.deleted_count}")

    print("\n=== CURRENT MONGO DB STATUS ===")
    for col in ["accounts", "contacts", "signals", "action_proposals", "investigations", "tasks", "hubspot_raw_records"]:
        print(f"Collection '{col}': {db[col].count_documents({})} documents")
        for doc in db[col].find({}, {"_id": 0, "id": 1, "name": 1, "account_id": 1, "title": 1}).limit(5):
            print(f"   -> {doc}")

if __name__ == "__main__":
    purge_demo_data()
