import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.feedback_flow_orchestrator import feedback_flow_orchestrator
from app.models.schemas import RunFeedbackFlowRequest

@pytest.fixture
def client():
    return TestClient(app)

def test_feedback_flow_graph():
    """Verify that graph returns all 20 nodes and expected edge connections."""
    graph = feedback_flow_orchestrator.get_graph()
    assert len(graph.nodes) == 20
    assert len(graph.edges) == 20

    node_ids = {n.id for n in graph.nodes}
    expected = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"}
    assert node_ids == expected

def test_feedback_flow_scenarios():
    """Verify execution along distinct scenario paths."""
    # 1. Healthy Scenario
    healthy_exec = feedback_flow_orchestrator.run_flow(
        RunFeedbackFlowRequest(account_id="acc-101", scenario="healthy")
    )
    assert healthy_exec.path_taken == ["A", "B", "C", "D"]
    assert healthy_exec.healthy_marked is True

    # 2. Positive Feedback Scenario
    pos_exec = feedback_flow_orchestrator.run_flow(
        RunFeedbackFlowRequest(account_id="acc-101", scenario="positive")
    )
    assert pos_exec.path_taken == ["A", "B", "C", "E", "F", "G", "H", "I", "J", "K", "L"]
    assert pos_exec.crm_updated is True
    assert pos_exec.healthy_marked is True

    # 3. Negative Feedback (Day 0) Scenario
    neg_exec = feedback_flow_orchestrator.run_flow(
        RunFeedbackFlowRequest(account_id="acc-101", scenario="negative_day0")
    )
    assert neg_exec.path_taken == ["A", "B", "C", "E", "F", "G", "H", "I", "J", "M", "N", "O", "P"]
    assert neg_exec.sales_notified is True
    assert neg_exec.manager_notified is True
    assert "ux_friction" in neg_exec.node_states["N"]["data"]

    # 4. Reminder -> Negative Scenario
    rem_exec = feedback_flow_orchestrator.run_flow(
        RunFeedbackFlowRequest(account_id="acc-101", scenario="reminder_negative")
    )
    assert rem_exec.path_taken == ["A", "B", "C", "E", "F", "G", "H", "Q", "R", "S", "I", "J", "M", "N", "O", "P"]
    assert rem_exec.sales_notified is True
    assert rem_exec.manager_notified is True

    # 5. Unresponsive Escalation Scenario
    unresp_exec = feedback_flow_orchestrator.run_flow(
        RunFeedbackFlowRequest(account_id="acc-101", scenario="unresponsive")
    )
    assert unresp_exec.path_taken == ["A", "B", "C", "E", "F", "G", "H", "Q", "R", "S", "T"]
    assert unresp_exec.sales_notified is True

def test_feedback_flow_api_endpoints(client):
    """Verify HTTP endpoints for graph and execution run."""
    # GET graph
    res_graph = client.get("/api/feedback/flow/graph")
    assert res_graph.status_code == 200
    data_graph = res_graph.json()
    assert len(data_graph["nodes"]) == 20

    # POST run
    res_run = client.post("/api/feedback/flow/run", json={
        "account_id": "acc-101",
        "scenario": "negative_day0"
    })
    assert res_run.status_code == 200
    data_run = res_run.json()
    assert data_run["sales_notified"] is True
    assert "A" in data_run["path_taken"]
    assert "P" in data_run["path_taken"]

    # GET execution by ID
    exec_id = data_run["execution_id"]
    res_get = client.get(f"/api/feedback/flow/executions/{exec_id}")
    assert res_get.status_code == 200
    assert res_get.json()["execution_id"] == exec_id
