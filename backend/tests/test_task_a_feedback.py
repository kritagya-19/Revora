import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.account_repository import account_repo
from app.services.feedback_repository import feedback_repo

client = TestClient(app)

def test_public_survey_form_retrieval_and_dynamic_fallback():
    """Verify that feedback form metadata loads correctly for both existing survey codes and accounts."""
    # 1. Existing pre-seeded survey code
    resp1 = client.get("/api/feedback/form/rev-fb-acme-101")
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()
    assert data1["survey_code"] == "rev-fb-acme-101"
    assert data1["account_id"] == "acc-101"
    assert "template" in data1
    assert data1["template"] is not None

    # 2. Dynamic account fallback (direct account feedback form)
    resp2 = client.get("/api/feedback/form/acc-102")
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()
    assert data2["account_id"] == "acc-102"
    assert data2["account_name"] != ""
    assert data2["recipient_email"] != ""
    assert "template" in data2

def test_submit_feedback_saves_against_correct_account_and_records_type_and_issue():
    """
    Task A Core:
    - Connect the existing form to the backend.
    - Save feedback against the correct customer and account.
    - Record feedback type, content, timestamp, and relevant action or issue.
    """
    target_account_id = "acc-102"
    survey_code = f"rev-fb-test-{target_account_id}-custom"
    
    submission_payload = {
        "survey_code": survey_code,
        "account_id": target_account_id,
        "respondent_name": "Marcus Vance",
        "respondent_email": "marcus@vanceenterprises.com",
        "feedback_type": "support_escalation",
        "satisfaction_score": 3,
        "usage_trend_self_report": "Usage dropped significantly due to workflow blockers",
        "primary_blocker": "Data latency or API integration bugs",
        "unresolved_issues": "Webhook delivery delays exceeding 15 minutes causing downstream reporting failures",
        "feature_improvement_request": "Dedicated webhook cluster or retry queue configuration",
        "additional_comments": "Urgent escalation from our VP of Operations.",
        "answers": [
            {"question_id": "q-sat", "category": "satisfaction", "prompt": "Satisfaction score", "answer_value": 3},
            {"question_id": "q-blocker", "category": "blockers", "prompt": "Primary blocker", "answer_value": "Data latency or API integration bugs"}
        ]
    }

    # Submit feedback via POST /api/feedback/submit
    resp = client.post("/api/feedback/submit", json=submission_payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Verify saved fields
    assert data["account_id"] == target_account_id
    assert data["feedback_type"] == "support_escalation"
    assert data["recipient_name"] == "Marcus Vance"
    assert data["recipient_email"] == "marcus@vanceenterprises.com"
    assert data["submission"]["satisfaction_score"] == 3
    assert data["submission"]["primary_blocker"] == "Data latency or API integration bugs"
    assert "Webhook delivery delays" in data["submission"]["unresolved_issues"]
    assert data["submitted_at"] is not None

    # Verify AI analysis generated for continuous improvement
    assert data["analysis"] is not None
    assert data["analysis"]["classified_churn_reason"] != ""
    assert data["analysis"]["urgency_level"] in ("critical", "high", "medium", "low")
    assert data["analysis"]["recommended_retention_action"] != ""

def test_display_saved_feedback_when_account_reopened():
    """
    Task A Definition of Done:
    - Display saved feedback when the account is reopened.
    Verify both GET /api/accounts/{account_id} and GET /api/feedback/responses?account_id={account_id}.
    """
    target_account_id = "acc-102"

    # 1. Reopen account dossier via GET /api/accounts/{account_id}
    resp_acc = client.get(f"/api/accounts/{target_account_id}")
    assert resp_acc.status_code == 200, resp_acc.text
    acc_detail = resp_acc.json()

    assert "feedback_records" in acc_detail
    assert len(acc_detail["feedback_records"]) > 0

    # Verify latest record matches our submission
    latest_fb = acc_detail["feedback_records"][0]
    assert latest_fb["account_id"] == target_account_id
    assert latest_fb["submission"]["satisfaction_score"] is not None
    assert latest_fb["submission"]["primary_blocker"] != ""
    assert latest_fb["submitted_at"] != ""

    # 2. Verify dedicated filtered feedback responses endpoint GET /api/feedback/responses?account_id={account_id}
    resp_fb_list = client.get(f"/api/feedback/responses?account_id={target_account_id}")
    assert resp_fb_list.status_code == 200, resp_fb_list.text
    records = resp_fb_list.json()
    assert len(records) > 0
    assert all(r["account_id"] == target_account_id for r in records)

    # 3. Verify feedback ingested into account signals feed
    resp_sig = client.get(f"/api/accounts/{target_account_id}/signals")
    assert resp_sig.status_code == 200, resp_sig.text
    signals = resp_sig.json()
    fb_signals = [s for s in signals if s.get("source_category") == "support" or "Feedback" in s.get("title", "")]
    assert len(fb_signals) > 0, "Feedback signal was not ingested into account signals"
