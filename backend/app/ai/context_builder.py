"""
Stage 1: Context Builder for Revora AI Layer.
Selects relevant account records, timelines, and verifiable evidence.
Identifies telemetry gaps and blind spots for downstream agent reasoning.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from app.ai.input_provider import AccountAIInputProvider, input_provider
from app.ai.schemas import (
    AccountContext,
    ContextBuilderConfig,
    DataGap,
    EvidenceItem,
    InvestigationContext,
    NormalizedSignal,
)
from app.models.schemas import Contact

logger = logging.getLogger("revora.ai.context_builder")


class ContextBuilder:
    """
    Stage 1: Context Builder.
    Transforms raw account records and normalized signals into a curated,
    grounded, and citation-ready InvestigationContext.
    """

    def __init__(self, data_provider: Optional[AccountAIInputProvider] = None):
        self.provider = data_provider or input_provider

    def build_context(
        self,
        account_id: str,
        config: Optional[ContextBuilderConfig] = None
    ) -> InvestigationContext:
        """
        Main entry point: fetches data via input provider, selects relevant records,
        curates evidence, and identifies data gaps.
        """
        cfg = config or ContextBuilderConfig()
        account_ctx, signals = self.provider.get_account_input_bundle(account_id)

        # 1. Select and rank evidence
        selected_evidence, evidence_catalog = self._select_and_rank_evidence(
            account_ctx=account_ctx,
            signals=signals,
            config=cfg
        )

        # 2. Identify data gaps and blind spots
        data_gaps = self._detect_data_gaps(account_ctx, signals, selected_evidence)

        # 3. Select key stakeholders
        primary_contact, key_stakeholders = self._select_stakeholders(account_ctx.contacts)

        # 4. Assemble final InvestigationContext
        investigation_ctx = InvestigationContext(
            account=account_ctx,
            selected_evidence=selected_evidence,
            evidence_catalog=evidence_catalog,
            all_signals_count=len(signals),
            selected_evidence_count=len(selected_evidence),
            data_gaps=data_gaps,
            key_stakeholders=key_stakeholders,
            primary_contact=primary_contact,
            time_window_days=cfg.lookback_days,
            built_at=datetime.now(timezone.utc).isoformat()
        )

        logger.info(
            f"ContextBuilder built context for account '{account_id}': "
            f"{len(selected_evidence)}/{len(signals)} evidence items selected, "
            f"{len(data_gaps)} gaps identified."
        )

        return investigation_ctx

    def _select_and_rank_evidence(
        self,
        account_ctx: AccountContext,
        signals: List[NormalizedSignal],
        config: ContextBuilderConfig
    ) -> Tuple[List[EvidenceItem], Dict[str, str]]:
        """
        Filters signals by lookback window, scores relevance, ensures category diversity,
        and builds the citation evidence catalog.
        """
        if not signals:
            return [], {}

        now = datetime.now(timezone.utc)
        scored_items: List[EvidenceItem] = []

        for sig in signals:
            # Parse timestamp safely
            try:
                sig_dt = datetime.fromisoformat(sig.occurred_at.replace("Z", "+00:00"))
                if sig_dt.tzinfo is None:
                    sig_dt = sig_dt.replace(tzinfo=timezone.utc)
                age_days = max(0, (now - sig_dt).days)
            except Exception:
                age_days = 30
                sig_dt = now

            # Filter out signals older than lookback window unless critical
            if age_days > config.lookback_days and sig.severity not in ("critical", "high"):
                continue

            # Calculate relevance score (0.0 - 1.0)
            score, reasons = self._calculate_relevance_score(sig, age_days, account_ctx)

            # Determine canonical evidence ID
            evidence_id = sig.signal_id
            if not evidence_id.startswith("EVID-"):
                evidence_id = f"EVID-{evidence_id}"

            rec_id = sig.source_record_id or f"rec_{sig.signal_id}"
            raw_ref = f"source://{sig.source_category}/{rec_id}"

            item = EvidenceItem(
                evidence_id=evidence_id,
                signal_id=sig.signal_id,
                account_id=sig.account_id,
                source_category=sig.source_category,
                source_record_id=sig.source_record_id,
                title=sig.title,
                summary=sig.summary,
                severity=sig.severity,
                occurred_at=sig.occurred_at,
                observed_value=sig.observed_value,
                baseline_value=sig.baseline_value,
                unit=sig.unit,
                relevance_score=score,
                relevance_reasons=reasons,
                raw_reference=raw_ref,
                metadata=sig.metadata
            )
            scored_items.append(item)

        # Sort by relevance score descending
        scored_items.sort(key=lambda x: x.relevance_score, reverse=True)

        # Category-balanced selection up to config.max_evidence_count
        selected: List[EvidenceItem] = []
        catalog: Dict[str, str] = {}
        category_counts: Dict[str, int] = {}

        # First pass: Include all critical items if configured
        if config.include_all_critical:
            for item in scored_items:
                if item.severity == "critical" and item not in selected:
                    selected.append(item)
                    catalog[item.evidence_id] = f"{item.title}: {item.summary}"
                    category_counts[item.source_category] = category_counts.get(item.source_category, 0) + 1

        # Second pass: Select top remaining items while maintaining diverse categories
        for item in scored_items:
            if len(selected) >= config.max_evidence_count:
                break
            if item in selected:
                continue

            # Limit single category domination (max 5 per category unless quota remains)
            cat_count = category_counts.get(item.source_category, 0)
            if cat_count < 5 or len(selected) < (config.max_evidence_count // 2):
                selected.append(item)
                catalog[item.evidence_id] = f"{item.title}: {item.summary}"
                category_counts[item.source_category] = cat_count + 1

        # Fallback: if quota remains and items were skipped due to category caps, add them
        if len(selected) < config.max_evidence_count:
            for item in scored_items:
                if len(selected) >= config.max_evidence_count:
                    break
                if item not in selected:
                    selected.append(item)
                    catalog[item.evidence_id] = f"{item.title}: {item.summary}"

        # Sort final selection by date descending (most recent first)
        selected.sort(key=lambda x: x.occurred_at, reverse=True)
        return selected, catalog

    def _calculate_relevance_score(
        self,
        sig: NormalizedSignal,
        age_days: int,
        account_ctx: AccountContext
    ) -> Tuple[float, List[str]]:
        """
        Computes composite relevance score and tracks rationale.
        """
        reasons: List[str] = []
        base_score = 0.5

        # 1. Severity weight
        if sig.severity == "critical":
            base_score += 0.4
            reasons.append("Critical severity anomaly")
        elif sig.severity == "high":
            base_score += 0.25
            reasons.append("High severity signal")
        elif sig.severity == "medium":
            base_score += 0.1
        elif sig.severity == "low":
            base_score -= 0.1

        # 2. Recency boost (decay over 90 days)
        if age_days <= 7:
            base_score += 0.15
            reasons.append("High recency (occurred within past 7 days)")
        elif age_days <= 30:
            base_score += 0.05
            reasons.append("Recent event (within past 30 days)")
        elif age_days > 60:
            base_score -= 0.1

        # 3. Renewal proximity context
        if account_ctx.days_to_renewal <= 60 and any(kw in sig.signal_type.lower() for kw in ("renewal", "usage", "drop", "ticket")):
            base_score += 0.1
            reasons.append("Heightened relevance due to upcoming renewal window (<60d)")

        score = max(0.1, min(1.0, round(base_score, 2)))
        return score, reasons

    def _detect_data_gaps(
        self,
        account_ctx: AccountContext,
        all_signals: List[NormalizedSignal],
        selected_evidence: List[EvidenceItem]
    ) -> List[DataGap]:
        """
        Detects data gaps, telemetry blind spots, and communication lags.
        """
        gaps: List[DataGap] = []
        categories_present: Set[str] = {s.source_category.lower() for s in all_signals}

        # 1. Product Usage telemetry check
        usage_signals = [s for s in all_signals if s.source_category == "usage"]
        if not usage_signals:
            gaps.append(DataGap(
                category="usage",
                description="No product usage telemetry ingested for this account.",
                impact="Cannot reliably track license saturation, feature adoption, or active seat decay.",
                severity="high"
            ))
        elif account_ctx.customer_metrics and account_ctx.customer_metrics.usage_drop_pct > 25:
            gaps.append(DataGap(
                category="usage_diagnostics",
                description=f"Significant usage contraction (-{account_ctx.customer_metrics.usage_drop_pct:.0f}%) detected without feature-level breakdown.",
                impact="Root cause of license abandonment requires customer interview.",
                severity="medium"
            ))

        # 2. CSM Touchpoint & Communication Lag check
        touchpoint_signals = [s for s in all_signals if s.source_category in ("email", "calendar", "crm")]
        touchpoint_lag_days = 0
        for s in all_signals:
            if s.signal_type == "touchpoint_lag" and isinstance(s.observed_value, (int, float)):
                touchpoint_lag_days = max(touchpoint_lag_days, int(s.observed_value))

        if touchpoint_lag_days >= 14 or not touchpoint_signals:
            days_str = f"{touchpoint_lag_days} days" if touchpoint_lag_days > 0 else "exceeding safe baseline"
            gaps.append(DataGap(
                category="crm_engagement",
                description=f"Communication gap: No recorded executive touchpoint or meeting for {days_str}.",
                impact="Account is operating in an unmonitored window near renewal.",
                severity="high" if account_ctx.days_to_renewal <= 60 else "medium"
            ))

        # 3. Support Tickets resolution check
        critical_tickets = [s for s in all_signals if s.source_category == "support" and s.severity in ("critical", "high")]
        if critical_tickets:
            gaps.append(DataGap(
                category="support_resolution",
                description=f"{len(critical_tickets)} high/critical support ticket(s) recorded in current observation cycle.",
                impact="Unresolved blockers may directly depress customer sentiment during renewal.",
                severity="high"
            ))

        # 4. Stakeholder coverage check
        contacts = account_ctx.contacts
        has_primary = any(c.is_primary for c in contacts)
        has_champion = any("champion" in (c.role or "").lower() or "director" in (c.role or "").lower() for c in contacts)

        if not contacts:
            gaps.append(DataGap(
                category="stakeholders",
                description="No stakeholder contacts recorded in CRM for this account.",
                impact="Action planning cannot dispatch personalized outreach emails.",
                severity="critical"
            ))
        elif not has_primary and not has_champion:
            gaps.append(DataGap(
                category="stakeholders",
                description="No designated primary contact or executive champion logged.",
                impact="Risk of outreach going to unengaged operational users rather than budget owners.",
                severity="medium"
            ))

        return gaps

    def _select_stakeholders(self, contacts: List[Contact]) -> Tuple[Optional[Contact], List[Contact]]:
        """
        Identifies primary contact and sorted list of relevant stakeholders.
        """
        if not contacts:
            return None, []

        primary = next((c for c in contacts if c.is_primary), None)
        if not primary and contacts:
            primary = contacts[0]

        # Order: primary first, then others
        ordered = [primary] if primary else []
        for c in contacts:
            if c != primary:
                ordered.append(c)

        return primary, ordered

    # --- Utility methods for downstream agents and prompt generation ---

    @staticmethod
    def validate_evidence_citation(context: InvestigationContext, evidence_id: str) -> bool:
        """
        Validates whether a cited evidence ID exists in the curated context catalog.
        Accepts raw signal IDs or prefixed EVID- IDs.
        """
        if evidence_id in context.evidence_catalog:
            return True
        # Check without EVID- prefix or with EVID- prefix
        stripped = evidence_id.replace("EVID-", "")
        for item in context.selected_evidence:
            if item.signal_id == stripped or item.evidence_id == evidence_id:
                return True
        return False

    @staticmethod
    def format_evidence_for_prompt(context: InvestigationContext) -> str:
        """
        Formats curated evidence into an injection-ready, citation-indexed Markdown block
        for LLM prompts (Agent 3 & Agent 4).
        """
        if not context.selected_evidence:
            return "No verifiable evidence records available for this account."

        lines = [
            "### Curated Evidence Catalog (Grounding Citations):",
            "You MUST cite the Evidence ID (e.g. `[EVID-...]`) for every claim, risk factor, and finding.",
            ""
        ]

        for item in context.selected_evidence:
            obs = f" | Observed: {item.observed_value}" if item.observed_value is not None else ""
            lines.append(
                f"- **[{item.evidence_id}]** ({item.source_category.upper()} | Severity: {item.severity.upper()} | Date: {item.occurred_at[:10]}): "
                f"**{item.title}** - {item.summary}{obs}"
            )

        if context.data_gaps:
            lines.append("")
            lines.append("### Identified Data Gaps & Telemetry Limitations:")
            for gap in context.data_gaps:
                lines.append(f"- **[{gap.category.upper()}]** {gap.description} *(Impact: {gap.impact})*")

        return "\n".join(lines)


# Default singleton instance
context_builder = ContextBuilder()
