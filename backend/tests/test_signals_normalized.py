from app.models.schemas import Signal
from app.services.account_repository import account_repo

def test_normalized_signal_contract_parsing():
    # Test normalized payload format as specified in roadmap
    payload = {
        "signal_id": "sig_usage_test_99",
        "account_id": "acc-101",
        "source": "product_analytics",
        "signal_type": "usage_decline",
        "occurred_at": "2026-10-08T10:00:00Z",
        "observed_value": 62,
        "baseline_value": 100,
        "unit": "weekly_active_users",
        "source_record_id": "usage_892"
    }
    
    signal = Signal(**payload)
    assert signal.id == "sig_usage_test_99"
    assert signal.signal_id == "sig_usage_test_99"
    assert signal.source_category == "product_analytics"
    assert signal.source == "product_analytics"
    assert signal.timestamp == "2026-10-08T10:00:00Z"
    assert signal.observed_value == 62
    assert signal.baseline_value == 100
    assert signal.source_record_id == "usage_892"

def test_signal_ingestion_and_retrieval():
    payload = {
        "signal_id": "sig_test_ingest_01",
        "account_id": "acc-102",
        "source": "support",
        "signal_type": "critical_ticket_opened",
        "occurred_at": "2026-10-10T14:30:00Z",
        "observed_value": "High severity outage reported",
        "source_record_id": "zd_ticket_9999"
    }
    sig = Signal(**payload)
    ingested = account_repo.create_signal(sig)
    assert ingested.id == "sig_test_ingest_01"

    retrieved = account_repo.get_signal_by_id("sig_test_ingest_01")
    assert retrieved is not None
    assert retrieved.signal_type == "critical_ticket_opened"
