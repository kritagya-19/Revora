"""
Agent 1 — Signal Analysis
Goal: Understands changes in customer behavior.

Input: Normalized signals from CRM, email, calendar, product usage, and support (via InvestigationContext).
Work: Group related events, compare recent usage with historical baselines, identify gaps, and summarize relevant changes.
Implementation: Python performs numeric comparisons and time-window calculations.
                An LLM can help interpret customer messages or summarize related events.
Output: Structured summary of observations, changes, and missing data (SignalAnalysisOutput).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.ai.schemas import (
    InvestigationContext,
    SignalAnalysisOutput,
    SignalCluster,
)
from app.core.config import settings
from app.core.llm_client import llm_client

logger = logging.getLogger("revora.ai.agent1_signal_analysis")


class Agent1SignalAnalysis:
    """
    Specialized Module 1: Understands behavioral shifts, usage drop baselines,
    and groups multi-source events into thematic clusters.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

    def analyze(self, context: InvestigationContext) -> SignalAnalysisOutput:
        """
        Coordinates Python numeric baseline calculations and event clustering.
        """
        account = context.account
        evidence = context.selected_evidence

        # 1. Compare usage with historical baseline
        usage_comparison = self._calculate_usage_baselines(account, evidence)

        # 2. Group related events into thematic clusters
        clusters = self._cluster_events(evidence)

        # 3. Detect and summarize missing data gaps
        missing_gaps = [f"[{g.category.upper()}] {g.description}" for g in context.data_gaps]

        # 4. Synthesize observations with citations
        observations, cited_ids = self._generate_observations(account, evidence, usage_comparison, clusters)

        # 5. Optional LLM enhancement for interpreting message nuances if API key configured
        if llm_client.is_available() or (self.api_key and self.api_key.strip()):
            observations = self._enhance_with_llm(account, observations, clusters)

        return SignalAnalysisOutput(
            account_id=account.account_id,
            observations=observations,
            usage_baseline_comparison=usage_comparison,
            event_clusters=clusters,
            missing_data_gaps=missing_gaps,
            cited_evidence_ids=cited_ids,
            analyzed_at=datetime.now(timezone.utc).isoformat()
        )

    def _calculate_usage_baselines(self, account, evidence) -> Dict[str, Any]:
        """
        Performs numeric comparison between recent product usage and historical baselines.
        """
        metrics = account.customer_metrics
        active_users = metrics.active_users if metrics else 0
        baseline_users = metrics.baseline_users if metrics else active_users
        drop_pct = metrics.usage_drop_pct if metrics else 0.0

        # Scan evidence metadata for more recent telemetry
        for e in evidence:
            if e.source_category == "usage":
                meta = e.metadata or {}
                if "current_seats" in meta:
                    active_users = int(meta["current_seats"])
                if "baseline" in meta:
                    baseline_users = int(meta["baseline"])
                if "drop_pct" in meta:
                    drop_pct = max(drop_pct, float(meta["drop_pct"]))

        net_seat_loss = max(0, baseline_users - active_users)
        trajectory = "severe_contraction" if drop_pct >= 30 else ("moderate_contraction" if drop_pct >= 15 else "stable")

        return {
            "current_active_users": active_users,
            "historical_baseline_users": baseline_users,
            "net_seats_contracted": net_seat_loss,
            "usage_drop_pct": round(drop_pct, 1),
            "trajectory": trajectory,
            "unit": "active_licenses"
        }

    def _cluster_events(self, evidence) -> List[SignalCluster]:
        """
        Groups related events into thematic clusters:
        1. Usage & Adoption
        2. Engagement & Touchpoints
        3. Support & Stability
        4. Commercial & Lifecycle
        """
        groups: Dict[str, Dict[str, Any]] = {
            "usage": {"theme": "Platform Adoption & Seat Velocity", "items": []},
            "engagement": {"theme": "Stakeholder Engagement & Touchpoints", "items": []},
            "support": {"theme": "Operational Stability & Support Tickets", "items": []},
            "commercial": {"theme": "Contract Milestones & Renewal Intent", "items": []},
        }

        for e in evidence:
            cat = e.source_category.lower()
            if cat == "usage":
                groups["usage"]["items"].append(e)
            elif cat in ("email", "calendar", "crm"):
                if "cancel" in e.signal_id.lower() or "downgrade" in e.signal_id.lower() or "renewal" in e.signal_id.lower():
                    groups["commercial"]["items"].append(e)
                else:
                    groups["engagement"]["items"].append(e)
            elif cat == "support":
                groups["support"]["items"].append(e)
            else:
                groups["commercial"]["items"].append(e)

        clusters: List[SignalCluster] = []
        for key, grp in groups.items():
            items = grp["items"]
            if not items:
                continue

            eids = [item.evidence_id for item in items]
            summary_parts = [f"{item.title} ({item.occurred_at[:10]})" for item in items[:3]]
            summary_text = f"{len(items)} related event(s): " + "; ".join(summary_parts)

            clusters.append(SignalCluster(
                category=key,
                theme=grp["theme"],
                event_count=len(items),
                evidence_ids=eids,
                summary=summary_text
            ))

        return clusters

    def _generate_observations(self, account, evidence, usage_comp, clusters) -> tuple[List[str], List[str]]:
        """
        Synthesizes structured observations with grounded citations.
        """
        obs: List[str] = []
        cited_ids: List[str] = []

        # Observation 1: Usage changes
        if usage_comp["usage_drop_pct"] > 0:
            usage_eids = [e.evidence_id for e in evidence if e.source_category == "usage"]
            cited_ids.extend(usage_eids)
            citation_str = f" [{', '.join(usage_eids)}]" if usage_eids else ""
            obs.append(
                f"Product usage contracted by {usage_comp['usage_drop_pct']:.1f}% "
                f"({usage_comp['current_active_users']} active seats vs baseline of {usage_comp['historical_baseline_users']}){citation_str}."
            )

        # Observation 2: Engagement velocity
        comm_items = [e for e in evidence if e.source_category in ("email", "calendar", "crm")]
        if comm_items:
            comm_eids = [e.evidence_id for e in comm_items]
            cited_ids.extend(comm_eids)
            latest = comm_items[0]
            obs.append(
                f"Stakeholder communications indicate interaction friction: '{latest.title}' [{latest.evidence_id}]."
            )

        # Observation 3: Support tickets
        support_items = [e for e in evidence if e.source_category == "support"]
        if support_items:
            sup_eids = [e.evidence_id for e in support_items]
            cited_ids.extend(sup_eids)
            crit_count = sum(1 for e in support_items if e.severity in ("critical", "high"))
            obs.append(
                f"{len(support_items)} technical support signal(s) recorded ({crit_count} high/critical) [{', '.join(sup_eids)}]."
            )

        # Observation 4: Renewal proximity
        obs.append(
            f"Account is {account.days_to_renewal} days from renewal ({account.renewal_date}) under ARR of ${account.arr:,.0f}."
        )

        return obs, list(dict.fromkeys(cited_ids))

    def _enhance_with_llm(self, account, baseline_obs, clusters) -> List[str]:
        """
        Uses OpenRouter / Gemini to distill nuances of customer sentiment if available.
        """
        prompt = (
            f"Account: {account.name} (ARR: ${account.arr:,.0f}).\n"
            f"Baseline observations: {json.dumps(baseline_obs)}\n"
            f"Clusters: {json.dumps([c.model_dump() for c in clusters])}\n"
            "Return a JSON list of strings summarizing the 3-4 most critical behavioral observations. "
            "Keep any citation tags like [EVID-...] intact."
        )

        if llm_client.is_available():
            try:
                res = llm_client.generate_json(
                    prompt,
                    system_prompt="You are Agent 1 (Signal Analysis Specialist) for Revora. Return a JSON list of strings."
                )
                if isinstance(res, list) and len(res) > 0:
                    return res
                elif isinstance(res, dict) and "observations" in res and isinstance(res["observations"], list):
                    return res["observations"]
            except Exception as e:
                logger.debug(f"OpenRouter signal enhancement failed: {e}")

        if self.api_key and self.api_key.strip():
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                if response.text:
                    res = json.loads(response.text)
                    if isinstance(res, list) and len(res) > 0:
                        return res
            except Exception as e:
                logger.debug(f"Gemini signal enhancement skipped: {e}")

        return baseline_obs
