from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from app.core.config import settings
from app.api.routes import accounts, proposals, dashboard, signals, investigations

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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred", "path": str(request.url.path)}
    )
