import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import (
    IntegrationConnector,
    IntegrationStatus,
    IntegrationMode,
    SyncRunRecord,
    TriggerSyncResponse
)

logger = logging.getLogger("revora.integrations")

class IntegrationRepository:
    def __init__(self):
        self._integrations: Dict[str, IntegrationConnector] = {}
        self._sync_runs: List[SyncRunRecord] = []
        self.db = None
        self._init_mongodb()
        self._init_seed_connectors()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"IntegrationRepository MongoDB fallback to memory: {e}")
                self.db = None

    def _init_seed_connectors(self):
        now = datetime.utcnow()
        # Seed default connectors covering CRM, Email, Calendar, Usage, and Database
        c1 = IntegrationConnector(
            id="conn-crm-01",
            name="Salesforce CRM Connector",
            category="crm",
            provider="Salesforce",
            status=IntegrationStatus.CONNECTED,
            mode=IntegrationMode.SIMULATED,
            is_real_connector=False,
            endpoint_or_host="https://na124.salesforce.com/services/data/v58.0",
            last_sync_time=(now - timedelta(minutes=14)).isoformat(),
            records_synced=1420,
            data_freshness_status="fresh",
            freshness_minutes=14,
            freshness_warning=None,
            config_details={"auth_type": "OAuth2.0 Web Server Flow", "instance": "Enterprise Tier", "objects": ["Account", "Contact", "Opportunity"]}
        )

        c2 = IntegrationConnector(
            id="conn-email-01",
            name="Google Workspace / Gmail Sync",
            category="email",
            provider="Gmail API",
            status=IntegrationStatus.CONNECTED,
            mode=IntegrationMode.SIMULATED,
            is_real_connector=False,
            endpoint_or_host="https://gmail.googleapis.com/gmail/v1/users/me",
            last_sync_time=(now - timedelta(minutes=28)).isoformat(),
            records_synced=8940,
            data_freshness_status="fresh",
            freshness_minutes=28,
            freshness_warning=None,
            config_details={"auth_type": "Service Account Key", "scope": "metadata.readonly", "monitored_domains": ["revora.internal"]}
        )

        c3 = IntegrationConnector(
            id="conn-cal-01",
            name="Google Calendar Meeting Telemetry",
            category="calendar",
            provider="Google Calendar",
            status=IntegrationStatus.CONNECTED,
            mode=IntegrationMode.SIMULATED,
            is_real_connector=False,
            endpoint_or_host="https://www.googleapis.com/calendar/v3",
            last_sync_time=(now - timedelta(hours=3, minutes=12)).isoformat(),
            records_synced=430,
            data_freshness_status="stale_warning",
            freshness_minutes=192,
            freshness_warning="No webhook touchpoints detected in last 3 hours. Renewal meeting changes may be delayed.",
            config_details={"auth_type": "OAuth 2.0 Webhook", "monitored_events": ["Executive Sync", "QBR", "Renewal Review"]}
        )

        c4 = IntegrationConnector(
            id="conn-usage-01",
            name="Product Analytics & License Usage",
            category="usage",
            provider="Mixpanel / Segment Analytics",
            status=IntegrationStatus.CONNECTED,
            mode=IntegrationMode.SIMULATED,
            is_real_connector=False,
            endpoint_or_host="https://api.mixpanel.com/track",
            last_sync_time=(now - timedelta(minutes=5)).isoformat(),
            records_synced=45820,
            data_freshness_status="fresh",
            freshness_minutes=5,
            freshness_warning=None,
            config_details={"auth_type": "Server-side Secret Key", "ingestion_stream": "daily_license_aggregates", "event_batching": "5-minute windows"}
        )

        # Real Connector representation: MongoDB Database Engine
        is_mongo_active = self.db is not None
        c5 = IntegrationConnector(
            id="conn-db-01",
            name="MongoDB Atlas / Primary Record Store",
            category="database",
            provider="MongoDB Database",
            status=IntegrationStatus.CONNECTED if is_mongo_active else IntegrationStatus.DEGRADED,
            mode=IntegrationMode.LIVE,
            is_real_connector=True,
            endpoint_or_host=settings.MONGODB_URI.split("@")[-1] if "@" in settings.MONGODB_URI else settings.MONGODB_URI,
            last_sync_time=now.isoformat(),
            records_synced=8,
            data_freshness_status="fresh" if is_mongo_active else "delayed",
            freshness_minutes=1 if is_mongo_active else 45,
            freshness_warning=None if is_mongo_active else "Local standalone mode active; MongoDB server unreachable at localhost:27017.",
            config_details={"db_name": settings.MONGODB_DB_NAME, "collections": ["accounts", "signals", "contacts", "action_proposals", "tasks", "audit_events"]}
        )

        for c in [c1, c2, c3, c4, c5]:
            self._integrations[c.id] = c

        # Initial seed sync runs
        sr1 = SyncRunRecord(
            id=f"sync-{uuid.uuid4().hex[:8]}",
            integration_id="conn-usage-01",
            provider="Mixpanel",
            status="success",
            records_ingested=240,
            records_updated=18,
            duration_ms=420,
            started_at=(now - timedelta(minutes=6)).isoformat(),
            completed_at=(now - timedelta(minutes=5)).isoformat(),
            mode=IntegrationMode.SIMULATED,
            log_message="Completed batch ingestion of daily active seat allocations."
        )
        self._sync_runs.append(sr1)

        if self.db is not None:
            try:
                for c in [c1, c2, c3, c4, c5]:
                    doc = c.model_dump()
                    self.db.integrations.update_one({"id": c.id}, {"$setOnInsert": doc}, upsert=True)
                self.db.sync_runs.update_one({"id": sr1.id}, {"$setOnInsert": sr1.model_dump()}, upsert=True)
            except Exception as e:
                logger.warning(f"Error seeding MongoDB integrations: {e}")

    def get_all_integrations(self) -> List[IntegrationConnector]:
        if self.db is not None:
            try:
                docs = list(self.db.integrations.find({}, {"_id": 0}))
                if docs:
                    return [IntegrationConnector(**doc) for doc in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_all_integrations error: {e}")
        return list(self._integrations.values())

    def get_integration_by_id(self, integration_id: str) -> Optional[IntegrationConnector]:
        if self.db is not None:
            try:
                doc = self.db.integrations.find_one({"id": integration_id}, {"_id": 0})
                if doc:
                    return IntegrationConnector(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_integration_by_id error: {e}")
        return self._integrations.get(integration_id)

    def trigger_synchronization(self, integration_id: str) -> TriggerSyncResponse:
        conn = self.get_integration_by_id(integration_id)
        if not conn:
            raise ValueError(f"Integration connector {integration_id} not found")

        now = datetime.utcnow()
        sync_run_id = f"sync-{uuid.uuid4().hex[:8]}"

        # Update connector status and freshness
        conn.last_sync_time = now.isoformat()
        conn.freshness_minutes = 0
        conn.data_freshness_status = "fresh"
        conn.freshness_warning = None
        conn.status = IntegrationStatus.CONNECTED
        conn.records_synced += 15

        self._integrations[conn.id] = conn

        # Record sync run log
        sync_record = SyncRunRecord(
            id=sync_run_id,
            integration_id=conn.id,
            provider=conn.provider,
            status="success",
            records_ingested=15,
            records_updated=5,
            duration_ms=310,
            started_at=now.isoformat(),
            completed_at=now.isoformat(),
            mode=conn.mode,
            log_message=f"Manual resynchronization completed for {conn.name} ({conn.mode.value} mode)."
        )
        self._sync_runs.insert(0, sync_record)

        if self.db is not None:
            try:
                self.db.integrations.update_one({"id": conn.id}, {"$set": conn.model_dump()}, upsert=True)
                self.db.sync_runs.insert_one(sync_record.model_dump())
            except Exception as e:
                logger.warning(f"MongoDB trigger_sync error: {e}")

        return TriggerSyncResponse(
            integration_id=conn.id,
            status="success",
            sync_run_id=sync_run_id,
            message=f"Synchronized {conn.name} successfully. Telemetry up-to-date.",
            last_sync_time=conn.last_sync_time,
            freshness_minutes=0
        )

    def get_recent_sync_runs(self, limit: int = 20) -> List[SyncRunRecord]:
        if self.db is not None:
            try:
                docs = list(self.db.sync_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(limit))
                if docs:
                    return [SyncRunRecord(**doc) for doc in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_sync_runs error: {e}")
        return self._sync_runs[:limit]

integration_repo = IntegrationRepository()
