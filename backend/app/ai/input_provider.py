"""
AI Input Provider for Revora AI Layer.
Interfaces with backend repositories and MongoDB to retrieve:
1. Account Context (account records, contacts, customer metrics)
2. Normalized Signals (multi-source telemetry across CRM, Email, Calendar, Product Usage, and Support)
"""

import logging
from datetime import datetime
from typing import List, Optional, Tuple

from app.ai.schemas import AccountContext, NormalizedSignal
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.ai.input_provider")


class AccountAIInputProvider:
    """
    Supplies validated Account Context and Normalized Signals to the AI pipeline.
    Ensures agent reasoning does not perform raw, ungrounded database queries directly.
    """

    def __init__(self, repository=None):
        self.repo = repository or account_repo

    def get_account_context(self, account_id: str) -> Optional[AccountContext]:
        """
        Retrieves canonical account context from backend and MongoDB.
        """
        account_detail = self.repo.get_account_by_id(account_id)
        if not account_detail:
            logger.warning(f"Account '{account_id}' not found in backend/MongoDB.")
            return None

        # Parse days to renewal safely
        days_to_ren = account_detail.urgency_days_to_renewal
        if days_to_ren is None:
            try:
                ren_date = datetime.fromisoformat(account_detail.renewal_date.split("T")[0])
                days_to_ren = max(0, (ren_date - datetime.utcnow()).days)
            except Exception:
                days_to_ren = 60

        return AccountContext(
            account_id=account_detail.id,
            name=account_detail.name,
            domain=account_detail.domain,
            arr=account_detail.arr,
            renewal_date=account_detail.renewal_date,
            days_to_renewal=days_to_ren,
            csm_owner=account_detail.csm_owner,
            industry=account_detail.industry,
            health_score=account_detail.health_score,
            tier=account_detail.tier or "Standard",
            status=account_detail.status or "active",
            contacts=account_detail.contacts or [],
            customer_metrics=account_detail.customer_metrics
        )

    def get_normalized_signals(self, account_id: str) -> List[NormalizedSignal]:
        """
        Retrieves normalized signals for the account with source provenance.
        """
        raw_signals = self.repo.get_account_signals(account_id)
        normalized: List[NormalizedSignal] = []

        for s in raw_signals:
            sig_dict = s.model_dump()
            # Ensure signal_id and occurred_at are aligned with normalized schema
            sig_dict["signal_id"] = s.id
            sig_dict["occurred_at"] = s.timestamp
            try:
                norm_sig = NormalizedSignal(**sig_dict)
                normalized.append(norm_sig)
            except Exception as e:
                logger.warning(f"Error parsing normalized signal {s.id}: {e}")

        return normalized

    def get_account_input_bundle(self, account_id: str) -> Tuple[AccountContext, List[NormalizedSignal]]:
        """
        Fetches the complete input bundle required by Stage 1 (Context Builder).
        Raises ValueError if the account record does not exist.
        """
        context = self.get_account_context(account_id)
        if not context:
            raise ValueError(f"Account '{account_id}' does not exist in backend or MongoDB.")

        signals = self.get_normalized_signals(account_id)
        return context, signals


# Default singleton instance
input_provider = AccountAIInputProvider()
