import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_retention_reminder_flow_graph():
    """Verify GET /api/reminders/retention-flow/graph returns 37 nodes and correct DAG edges."""
    response = client.get("/api/reminders/retention-flow/graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data

    nodes = data["nodes"]
    assert len(nodes) == 37

    node_ids = {n["id"] for n in nodes}
    expected_node_ids = {
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
        "K", "L", "M", "N", "P", "Q", "R", "S", "AF", "O",
        "T", "U", "V", "W", "AG", "X", "AH", "Y", "Z", "AA",
        "AB", "AC", "AE", "AD", "AI", "AJ", "AK"
    }
    assert expected_node_ids.issubset(node_ids)

    # Check node categories and types
    source_nodes = [n for n in nodes if n["category_class"] == "source"]
    agent_nodes = [n for n in nodes if n["category_class"] == "agent"]
    decision_nodes = [n for n in nodes if n["category_class"] == "decision"]
    positive_nodes = [n for n in nodes if n["category_class"] == "positive"]
    negative_nodes = [n for n in nodes if n["category_class"] == "negative"]
    action_nodes = [n for n in nodes if n["category_class"] == "action"]

    assert len(source_nodes) >= 1
    assert len(agent_nodes) == 5  # B, G, K, O, Y
    assert len(decision_nodes) >= 6
    assert len(positive_nodes) >= 2  # D, U
    assert len(negative_nodes) >= 6  # V, W, X, S, AF, AK
    assert len(action_nodes) >= 15


def test_run_retention_flow_positive_feedback():
    """Verify execution path for positive feedback leads to node U (Mark Customer Healthy)."""
    payload = {
        "account_id": "acc-101",
        "scenario": "positive_feedback"
    }
    response = client.post("/api/reminders/retention-flow/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["account_id"] == "acc-101"
    assert data["status"] == "completed"
    assert data["current_node"] == "U"
    assert data["healthy_marked"] is True
    assert data["feedback_received"] is True
    assert data["direct_reminder_sent"] is True
    assert data["feedback_survey_code"] is not None

    path = data["path_taken"]
    assert "A" in path
    assert "B" in path
    assert "C" in path
    assert "E" in path
    assert "F" in path
    assert "J" in path  # Reminder sent
    assert "L" in path  # Feedback form sent
    assert "O" in path  # Analyze feedback
    assert "T" in path  # Feedback outcome
    assert "U" in path  # Mark healthy


def test_run_retention_flow_negative_feedback_approved():
    """Verify full negative feedback recovery path with manager approval leads to resolution."""
    payload = {
        "account_id": "acc-101",
        "scenario": "negative_feedback_approved",
        "custom_blocker": "SSO authorization timeout and latency",
        "human_approval_decision": "approved",
        "post_action_risk_reduced": True
    }
    response = client.post("/api/reminders/retention-flow/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "completed"
    assert data["sales_notified"] is True
    assert data["manager_notified"] is True
    assert data["recovery_message_sent"] is True
    assert data["recovery_proposal_id"] is not None
    assert data["healthy_marked"] is True

    path = data["path_taken"]
    assert "V" in path  # Identify problems
    assert "W" in path  # Notify sales team
    assert "X" in path  # Notify manager
    assert "Y" in path  # Retention reminder agent
    assert "Z" in path  # Prepare recovery message
    assert "AA" in path # Human approval required
    assert "AB" in path # Manager reviews and approves
    assert "AC" in path # Approved
    assert "AD" in path # Send recovery message
    assert "AI" in path # Track engagement
    assert "AJ" in path # Risk reduced


def test_run_retention_flow_negative_feedback_rejected():
    """Verify negative feedback with manager rejection halts at node AE (Revise or Cancel)."""
    payload = {
        "account_id": "acc-102",
        "scenario": "negative_feedback_rejected"
    }
    response = client.post("/api/reminders/retention-flow/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["current_node"] == "AE"
    assert data["recovery_message_sent"] is False
    assert "AE" in data["path_taken"]
    assert "AD" not in data["path_taken"]


def test_run_retention_flow_unresponsive_escalation():
    """Verify non-responsive customer escalates via node P (reminder email) -> S -> AF."""
    payload = {
        "account_id": "acc-103",
        "scenario": "unresponsive_escalated"
    }
    response = client.post("/api/reminders/retention-flow/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["current_node"] == "AF"
    assert data["sales_notified"] is True
    assert data["crm_updated"] is True
    assert data["feedback_received"] is False

    path = data["path_taken"]
    assert "L" in path  # Initial form
    assert "P" in path  # Reminder email sent
    assert "Q" in path  # Secondary wait
    assert "R" in path  # Secondary check
    assert "S" in path  # Notify sales team
    assert "AF" in path # Update CRM


def test_approve_retention_recovery_proposal():
    """Verify POST /api/reminders/retention-flow/approve updates execution state."""
    # Run initial flow to generate execution
    init_res = client.post("/api/reminders/retention-flow/run", json={
        "account_id": "acc-101",
        "scenario": "negative_feedback_approved"
    })
    exec_id = init_res.json()["execution_id"]

    # Test approval
    approve_res = client.post("/api/reminders/retention-flow/approve", json={
        "execution_id": exec_id,
        "decision": "approved",
        "reviewer": "Director Jane Doe",
        "notes": "Authorized 15% continuity credit."
    })
    assert approve_res.status_code == 200
    appr_data = approve_res.json()
    assert appr_data["recovery_message_sent"] is True
    assert appr_data["node_states"]["AB"]["data"]["reviewer"] == "Director Jane Doe"


def test_portfolio_retention_automation():
    """Verify POST /api/reminders/retention-flow/portfolio-automation scans all accounts."""
    response = client.post("/api/reminders/retention-flow/portfolio-automation")
    assert response.status_code == 200
    data = response.json()

    assert data["scanned_accounts"] > 0
    assert "at_risk_detected" in data
    assert "retention_plans_created" in data
    assert "direct_reminders_dispatched" in data
    assert "feedback_forms_dispatched" in data
    assert len(data["accounts_detail"]) > 0
