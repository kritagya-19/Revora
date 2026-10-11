from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional
from app.models.schemas import (
    SurveyFormTemplate,
    FeedbackTriggerCheck,
    FeedbackSurveyDispatch,
    FeedbackResponseSubmission,
    CustomerFeedbackRecord,
    CreateFeedbackSurveyRequest,
    BatchTriggerScanResult
)
from app.services.feedback_repository import feedback_repo
from app.services.feedback_service import feedback_service

router = APIRouter()

@router.get("/templates", response_model=List[SurveyFormTemplate])
def list_survey_templates():
    """
    GET /api/feedback/templates
    Returns all pre-built and custom survey form templates (questions, categories, rating scales).
    """
    return feedback_repo.get_templates()

@router.get("/templates/{template_id}", response_model=SurveyFormTemplate)
def get_survey_template(template_id: str):
    """
    GET /api/feedback/templates/{template_id}
    Retrieves the specific survey template.
    """
    tpl = feedback_repo.get_template_by_id(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Survey template {template_id} not found")
    return tpl

@router.get("/check-trigger/{account_id}", response_model=FeedbackTriggerCheck)
def check_feedback_trigger(
    account_id: str,
    force_ignore_cooldown: bool = Query(False, description="Simulate trigger ignoring 14-day cooldown")
):
    """
    GET /api/feedback/check-trigger/{account_id}
    Phase 3: Automatic Feedback Triggers.
    Evaluates multi-factor rules (usage drop, touchpoint lag, renewal proximity, critical bugs),
    guards against duplicates and frequency fatigue, and records audit trail.
    """
    try:
        return feedback_service.evaluate_trigger_eligibility(account_id, force_ignore_cooldown=force_ignore_cooldown)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trigger check failed: {e}")

@router.post("/scan-triggers", response_model=BatchTriggerScanResult)
def scan_portfolio_and_auto_trigger(
    force_ignore_cooldown: bool = Query(False, description="Scan portfolio and trigger eligible accounts")
):
    """
    POST /api/feedback/scan-triggers
    Portfolio-wide auto trigger engine:
    Scans all monitored accounts against risk & usage decline rules,
    enforces duplicate prevention & cooldown rules, and automatically creates survey dispatches.
    """
    try:
        return feedback_service.scan_and_auto_trigger_portfolio(force_ignore_cooldown=force_ignore_cooldown)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch trigger scan failed: {e}")

@router.post("/surveys", response_model=FeedbackSurveyDispatch)
def create_and_send_survey(req: CreateFeedbackSurveyRequest):
    """
    POST /api/feedback/surveys
    Step 4 in flow: Send a personalized feedback form.
    Dispatches survey via email or customer channel and creates unique survey link.
    """
    try:
        return feedback_service.dispatch_survey(req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Survey dispatch failed: {e}")

@router.get("/surveys", response_model=List[FeedbackSurveyDispatch])
def list_surveys(
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    status: Optional[str] = Query(None, description="Filter by status: pending, sent, opened, completed, expired")
):
    """
    GET /api/feedback/surveys
    Lists all dispatched surveys and their current completion statuses.
    """
    return feedback_repo.list_surveys(account_id=account_id, status=status)

@router.get("/form/{survey_code}")
def get_public_survey_form(survey_code: str):
    """
    GET /api/feedback/form/{survey_code}
    Public or customer-facing endpoint: Loads survey metadata, template questions,
    and recipient info for the customer to fill out.
    """
    survey = feedback_repo.get_survey_by_code(survey_code)
    if not survey:
        raise HTTPException(status_code=404, detail=f"Survey with code {survey_code} not found")

    template = feedback_repo.get_template_by_id(survey.template_id)
    return {
        "survey_code": survey.survey_code,
        "account_id": survey.account_id,
        "account_name": survey.account_name,
        "recipient_name": survey.recipient_name,
        "recipient_email": survey.recipient_email,
        "status": survey.status,
        "custom_intro": survey.custom_intro,
        "template": template
    }

@router.post("/submit", response_model=CustomerFeedbackRecord)
def submit_customer_feedback(submission: FeedbackResponseSubmission):
    """
    POST /api/feedback/submit
    Step 5, 6, 7 in flow:
    - Customer submits ratings, reduced usage reasons, and blockers.
    - AI analyzes the response: classifies root cause, identifies urgency, connects to evidence.
    - Recommends retention action (e.g. arrange training, resolve blocker, CS escalation).
    - Persists in MongoDB and registers in the Account Timeline.
    """
    try:
        return feedback_service.submit_and_analyze_feedback(submission)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback submission and analysis failed: {e}")

@router.get("/responses", response_model=List[CustomerFeedbackRecord])
def list_feedback_responses(
    account_id: Optional[str] = Query(None, description="Filter responses by account ID")
):
    """
    GET /api/feedback/responses
    Lists submitted feedback records with their AI analysis summaries.
    """
    return feedback_repo.list_feedback_records(account_id=account_id)

@router.get("/responses/{record_id}", response_model=CustomerFeedbackRecord)
def get_feedback_response(record_id: str):
    """
    GET /api/feedback/responses/{record_id}
    Retrieves full feedback response and analysis details.
    """
    record = feedback_repo.get_feedback_record_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Feedback record {record_id} not found")
    return record


# ==========================================
# 20-Node Interactive Feedback Flow Routes
# ==========================================

from app.models.schemas import (
    FeedbackFlowGraph,
    FeedbackFlowExecution,
    RunFeedbackFlowRequest
)
from app.services.feedback_flow_orchestrator import feedback_flow_orchestrator

@router.get("/flow/graph", response_model=FeedbackFlowGraph)
def get_feedback_flow_graph():
    """
    GET /api/feedback/flow/graph
    Returns the complete 20-node DAG definition, metadata, and directional edge links.
    """
    return feedback_flow_orchestrator.get_graph()

@router.post("/flow/run", response_model=FeedbackFlowExecution)
def run_feedback_flow(req: RunFeedbackFlowRequest):
    """
    POST /api/feedback/flow/run
    Executes or simulates the complete 20-node Feedback Form Flow for an account.
    """
    try:
        return feedback_flow_orchestrator.run_flow(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run feedback flow: {e}")

@router.get("/flow/executions", response_model=List[FeedbackFlowExecution])
def list_feedback_flow_executions(
    account_id: Optional[str] = Query(None, description="Filter executions by account ID")
):
    """
    GET /api/feedback/flow/executions
    Lists recent flow executions and their status.
    """
    return feedback_flow_orchestrator.list_executions(account_id=account_id)

@router.get("/flow/executions/{execution_id}", response_model=FeedbackFlowExecution)
def get_feedback_flow_execution(execution_id: str):
    """
    GET /api/feedback/flow/executions/{execution_id}
    Retrieves full execution details with node-by-node telemetry.
    """
    exec_res = feedback_flow_orchestrator.get_execution(execution_id)
    if not exec_res:
        raise HTTPException(status_code=404, detail=f"Flow execution {execution_id} not found")
    return exec_res

