import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.free_pipeline_service import free_pipelines

client = TestClient(app)

def test_free_pipeline_endpoints():
    # 1. Pipeline status
    status_resp = client.get("/api/integrations/pipelines/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "webhook" in data
    assert "smtp" in data
    assert "$0.00" in data["free_tier_notice"] or "free options" in data["free_tier_notice"].lower()

    # 2. Configure Discord webhook URL
    conf_resp = client.post("/api/integrations/webhook/configure", json={
        "webhook_url": "https://discord.com/api/webhooks/12345/test-token"
    })
    assert conf_resp.status_code == 200
    conf_data = conf_resp.json()
    assert conf_data["provider"] == "discord"

    # 3. Test Webhook Ping
    test_resp = client.post("/api/integrations/webhook/test", json={
        "account_name": "Acme Technologies",
        "account_id": "acc-101"
    })
    assert test_resp.status_code == 200
    test_data = test_resp.json()
    assert "status" in test_data

    # 4. Outbox inspection
    outbox_resp = client.get("/api/integrations/outbox?limit=10")
    assert outbox_resp.status_code == 200
    events = outbox_resp.json()
    assert len(events) >= 1

    # 5. Clear outbox
    clear_resp = client.post("/api/integrations/outbox/clear")
    assert clear_resp.status_code == 200
    assert client.get("/api/integrations/outbox").json() == []
