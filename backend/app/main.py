from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from app.core.config import settings
from app.api.routes import accounts, proposals, dashboard, signals, investigations, approvals, integrations

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("revora.api")

app = FastAPI(
    title="SignalBridge AI / Revora API",
    version="1.0.0",
    description="Evidence-first revenue intelligence and deterministic risk autopsy engine."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
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

# Page 7: Settings and Integrations endpoints
app.include_router(integrations.router, prefix="/api/integrations", tags=["Settings & Integrations"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Settings & Integrations"])

# Global audit logs alias
@app.get("/api/audit-logs", tags=["Audit Log"])
def get_global_audit_logs(limit: int = 100):
    from app.services.proposal_repository import proposal_repo
    return proposal_repo.get_all_audit_logs(limit=limit)

@app.get("/api/v1/audit-logs", tags=["Audit Log"])
def get_global_audit_logs_v1(limit: int = 100):
    from app.services.proposal_repository import proposal_repo
    return proposal_repo.get_all_audit_logs(limit=limit)

# Agent-Layer Pipeline Orchestration Endpoint
@app.post("/api/agent/pipeline/{account_id}", tags=["Agent Architecture"])
@app.get("/api/agent/pipeline/{account_id}", tags=["Agent Architecture"])
def run_agent_pipeline(account_id: str):
    """
    Executes the 4-tier Agent Pipeline:
    1. Signal Analysis -> 2. Risk Assessment -> 3. Investigation -> 4. Action Planning
    """
    from app.services.agent_orchestrator import agent_orchestrator
    from fastapi import HTTPException
    try:
        return agent_orchestrator.execute_full_cycle(account_id)
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
