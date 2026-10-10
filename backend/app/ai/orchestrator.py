"""
Agent Orchestrator for Revora AI Layer.
Coordinates the investigation workflow across the 4 specialized agents:
1. Context Builder (Stage 1) -> Selected Evidence & Account Context
2. Deterministic Intelligence (Stage 2) -> Authoritative Risk Score, Urgency, Trends
3. Agent 1 — Signal Analysis -> Baseline comparison, event clustering, missing data
4. Agent 2 — Risk Explanation -> Plain-language explanation preserving authoritative scores
5. Agent 3 — Investigation -> Revenue Risk Autopsy (facts vs interpretations, uncertainties)
6. Agent 4 — Action Planning -> Next-best-action proposal staged for human review
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from app.ai.agents.agent1_signal_analysis import Agent1SignalAnalysis
from app.ai.agents.agent2_risk_explanation import Agent2RiskExplanation
from app.ai.agents.agent3_investigation import Agent3Investigation
from app.ai.agents.agent4_action_planning import Agent4ActionPlanning
from app.ai.context_builder import ContextBuilder, context_builder
from app.ai.deterministic import DeterministicIntelligenceEngine, deterministic_engine
from app.ai.schemas import (
    ContextBuilderConfig,
    OrchestratedInvestigationResult,
)

logger = logging.getLogger("revora.ai.orchestrator")


class AgentOrchestrator:
    """
    Central Orchestrator: Coordinates the multi-agent reasoning pipeline.
    Owns sequencing, data exchange between stages, and guardrail enforcement.
    """

    def __init__(
        self,
        builder: Optional[ContextBuilder] = None,
        risk_engine: Optional[DeterministicIntelligenceEngine] = None,
        agent1: Optional[Agent1SignalAnalysis] = None,
        agent2: Optional[Agent2RiskExplanation] = None,
        agent3: Optional[Agent3Investigation] = None,
        agent4: Optional[Agent4ActionPlanning] = None,
    ):
        self.context_builder = builder or context_builder
        self.risk_engine = risk_engine or deterministic_engine
        self.agent1 = agent1 or Agent1SignalAnalysis()
        self.agent2 = agent2 or Agent2RiskExplanation()
        self.agent3 = agent3 or Agent3Investigation()
        self.agent4 = agent4 or Agent4ActionPlanning()

    def orchestrate_account(
        self,
        account_id: str,
        config: Optional[ContextBuilderConfig] = None
    ) -> OrchestratedInvestigationResult:
        """
        Executes the full AI pipeline sequentially for an account:
        1. Context Builder
        2. Deterministic Intelligence
        3. Agent 1: Signal Analysis
        4. Agent 2: Risk Explanation
        5. Agent 3: Investigation (Autopsy)
        6. Agent 4: Action Planning (Draft Proposal)
        """
        logger.info(f"Starting Agent Orchestrator pipeline for account '{account_id}'...")

        # Step 1: Stage 1 - Context Builder
        inv_context = self.context_builder.build_context(account_id, config=config)
        account_name = inv_context.account.name

        # Step 2: Stage 2 - Deterministic Intelligence
        deterministic_risk = self.risk_engine.evaluate_context(inv_context)

        # Step 3: Agent 1 - Signal Analysis
        signal_analysis = self.agent1.analyze(inv_context)

        # Step 4: Agent 2 - Risk Explanation (Preserves authoritative score)
        risk_explanation = self.agent2.explain(inv_context, deterministic_risk)

        # Step 5: Agent 3 - Investigation (Revenue Risk Autopsy)
        investigation_autopsy = self.agent3.investigate(
            context=inv_context,
            deterministic_risk=deterministic_risk,
            signal_analysis=signal_analysis,
            risk_explanation=risk_explanation
        )

        # Step 6: Agent 4 - Action Planning (Editable Proposal awaiting Human Approval)
        action_plan = self.agent4.plan_action(
            context=inv_context,
            autopsy=investigation_autopsy
        )

        logger.info(
            f"Completed Agent Orchestrator pipeline for account '{account_id}'. "
            f"Score: {deterministic_risk.risk_score}, "
            f"Facts: {len(investigation_autopsy.verified_facts)}, "
            f"Action: {action_plan.action_type}"
        )

        return OrchestratedInvestigationResult(
            account_id=account_id,
            account_name=account_name,
            context=inv_context,
            deterministic_risk=deterministic_risk,
            signal_analysis=signal_analysis,
            risk_explanation=risk_explanation,
            investigation=investigation_autopsy,
            action_plan=action_plan,
            orchestrated_at=datetime.now(timezone.utc).isoformat()
        )


# Default singleton instance
agent_orchestrator = AgentOrchestrator()
