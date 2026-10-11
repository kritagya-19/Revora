from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from app.core.config import settings
from app.api.routes import accounts, proposals, dashboard, signals, investigations, approvals, integrations, tasks, tracker, analyzer, feedback, reminders, recurring_problems, improvement_insights

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("revora.api")

app = FastAPI(
    title="SignalBridge AI / Revora API",
    version="1.0.0",
    description="Evidence-first revenue intelligence and deterministic risk autopsy engine."
)

# CORS Middleware - Permissive for local development across all localhost & 127.0.0.1 ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *settings.cors_origins_list,
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "revora-backend",
        "environment": settings.ENVIRONMENT,
        "execution_mode": settings.EXECUTION_MODE
    }

# Include routers with both standard and versioned prefixes
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Revenue Radar Dashboard"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Revenue Radar Dashboard"])

app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts & Risk Radar"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts & Risk Radar"])

app.include_router(signals.router, prefix="/api/signals", tags=["Signals & Evidence Timeline"])
app.include_router(signals.router, prefix="/api/v1/signals", tags=["Signals & Evidence Timeline"])

app.include_router(investigations.router, prefix="/api", tags=["Revenue Risk Autopsy"])
app.include_router(investigations.router, prefix="/api/v1", tags=["Revenue Risk Autopsy"])

app.include_router(proposals.router, prefix="/api/proposals", tags=["Proposals & Approval Gate"])
app.include_router(proposals.router, prefix="/api/v1/proposals", tags=["Proposals & Approval Gate"])
app.include_router(proposals.router, prefix="/api/action-proposals", tags=["Next-Best-Action Copilot Proposals"])
app.include_router(proposals.router, prefix="/api/v1/action-proposals", tags=["Next-Best-Action Copilot Proposals"])

# Page 6: Trust & Approval Center endpoints
app.include_router(approvals.router, prefix="/api/approvals", tags=["Trust & Approval Center"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["Trust & Approval Center"])

# Tasks endpoints
app.include_router(tasks.router, prefix="/api/tasks", tags=["Follow-up Tasks"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["Follow-up Tasks"])

# Page 7: Settings and Integrations endpoints
app.include_router(integrations.router, prefix="/api/integrations", tags=["Settings & Integrations"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Settings & Integrations"])

# Feature 1: Action & Outcome Tracker endpoints
app.include_router(tracker.router, prefix="/api/tracker", tags=["Action & Outcome Tracker"])
app.include_router(tracker.router, prefix="/api/v1/tracker", tags=["Action & Outcome Tracker"])

# Feature 3: AI Outcome Analyzer endpoints
app.include_router(analyzer.router, prefix="/api/outcome-analyzer", tags=["AI Outcome Analyzer"])
app.include_router(analyzer.router, prefix="/api/v1/outcome-analyzer", tags=["AI Outcome Analyzer"])

# Feedback Form & Early-Churn Survey Loop endpoints
app.include_router(feedback.router, prefix="/api/feedback", tags=["Customer Feedback & Survey Loop"])
app.include_router(feedback.router, prefix="/api/v1/feedback", tags=["Customer Feedback & Survey Loop"])

# Dynamic Reminders endpoints (Task B)
app.include_router(reminders.router, prefix="/api/reminders", tags=["Dynamic Reminders"])
app.include_router(reminders.router, prefix="/api/v1/reminders", tags=["Dynamic Reminders"])

# Recurring Customer Problems endpoints (Task D)
app.include_router(recurring_problems.router, prefix="/api/recurring-problems", tags=["Recurring Customer Problems"])
app.include_router(recurring_problems.router, prefix="/api/v1/recurring-problems", tags=["Recurring Customer Problems"])

# Actionable Improvement Insights & Outcome Tracking endpoints (Task E)
app.include_router(improvement_insights.router, prefix="/api/improvement-insights", tags=["Actionable Improvement Insights"])
app.include_router(improvement_insights.router, prefix="/api/v1/improvement-insights", tags=["Actionable Improvement Insights"])

# Global audit logs endpoints
@app.get("/api/audit-logs", tags=["Audit Log"])
def get_global_audit_logs(account_id: str = None, event_type: str = None, limit: int = 100):
    from app.services.proposal_repository import proposal_repo
    logs = proposal_repo.get_all_audit_logs(limit=limit)
    if account_id:
        logs = [entry for entry in logs if entry.get("account_id") == account_id]
    if event_type:
        logs = [entry for entry in logs if entry.get("event_type") == event_type]
    return logs

@app.get("/api/v1/audit-logs", tags=["Audit Log"])
def get_global_audit_logs_v1(account_id: str = None, event_type: str = None, limit: int = 100):
    return get_global_audit_logs(account_id=account_id, event_type=event_type, limit=limit)

# Agent-Layer Pipeline Orchestration Endpoint (5-Stage AI Architecture)
@app.post("/api/agent/pipeline/{account_id}", tags=["Agent Architecture"])
@app.get("/api/agent/pipeline/{account_id}", tags=["Agent Architecture"])
def run_agent_pipeline(account_id: str):
    """
    Executes the full 5-Stage AI Pipeline:
    1. Context Builder -> 2. Deterministic Intelligence -> 3. Signal Analysis
    -> 4. Risk Explanation -> 5. Investigation & Action Planning
    """
    from app.ai.orchestrator import agent_orchestrator
    from fastapi import HTTPException
    try:
        result = agent_orchestrator.orchestrate_account(account_id)
        return {
            "account_id": result.account_id,
            "account_name": result.account_name,
            "pipeline_stages": {
                "deterministic_risk": {
                    "risk_score": result.deterministic_risk.risk_score,
                    "risk_level": result.deterministic_risk.risk_level.value,
                    "primary_reason_code": result.deterministic_risk.primary_reason_code,
                    "rule_version": result.deterministic_risk.rule_version,
                },
                "signal_analysis": {
                    "baseline_comparison": getattr(result.signal_analysis, "usage_baseline_comparison", getattr(result.signal_analysis, "baseline_comparison", {})),
                    "missing_data_flags": getattr(result.signal_analysis, "missing_data_gaps", getattr(result.signal_analysis, "missing_data_flags", [])),
                },
                "investigation": {
                    "verified_facts_count": len(result.investigation.verified_facts),
                    "uncertainties": result.investigation.uncertainties,
                    "causal_narrative": getattr(result.investigation, "causal_explanation", getattr(result.investigation, "causal_narrative", "")),
                    "causal_explanation": getattr(result.investigation, "causal_explanation", getattr(result.investigation, "causal_narrative", "")),
                },
                "action_plan": {
                    "action_type": result.action_plan.action_type,
                    "title": result.action_plan.title,
                    "reason": result.action_plan.reason,
                },
            },
            "orchestrated_at": result.orchestrated_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent pipeline failed: {e}")



@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred", "path": str(request.url.path)}
    )
