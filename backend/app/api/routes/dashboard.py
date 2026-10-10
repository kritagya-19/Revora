from fastapi import APIRouter
from app.models.schemas import DashboardSummary
from app.services.account_repository import account_repo

router = APIRouter()

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    """
    Returns aggregate revenue radar metrics calculated directly from stored account records:
    - Accounts monitored
    - High / critical risk accounts
    - Renewals due soon (<= 60 days)
    - Total ARR exposed to high churn risk
    - Overall portfolio ARR and average risk score
    """
    return account_repo.get_dashboard_summary()
