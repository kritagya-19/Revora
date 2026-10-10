"""
Revora AI Layer Package.

Pipeline Stages:
1. Input Layer: Account Context and Normalized Signals (Backend & MongoDB)
2. Stage 1: Context Builder (Selects relevant account records and verifiable evidence)
3. Stage 2: Deterministic Intelligence (Risk score, urgency, trends, rule breakdown)
4. Stage 3: Agent Orchestrator (Signal Analysis, Risk Explanation, Investigation, Action Planning)
5. Stage 4: Output Validator (Schema, evidence citations, ownership checks)
6. Stage 5: Persist and Display (Investigation, action proposals, human approval)
"""

from app.ai.schemas import (
    AccountContext,
    NormalizedSignal,
    EvidenceItem,
    DataGap,
    ContextBuilderConfig,
    InvestigationContext,
    SeverityLevel,
    RuleEvaluation,
    TrendSummary,
    UrgencyAssessment,
    DeterministicRiskResult,
    SignalCluster,
    SignalAnalysisOutput,
    RiskExplanationOutput,
    FactItem,
    InterpretationItem,
    InvestigationAutopsy,
    ProposedEmailDraft,
    ProposedTaskDraft,
    ActionPlanOutput,
    OrchestratedInvestigationResult,
    ValidationResult,
)
from app.ai.input_provider import AccountAIInputProvider, input_provider
from app.ai.context_builder import ContextBuilder, context_builder
from app.ai.deterministic import DeterministicIntelligenceEngine, deterministic_engine
from app.ai.orchestrator import AgentOrchestrator, agent_orchestrator
from app.ai.validators import OutputValidator, output_validator
from app.ai.persistence import PersistAndDisplayManager, persist_manager
from app.ai.agents import (
    Agent1SignalAnalysis,
    Agent2RiskExplanation,
    Agent3Investigation,
    Agent4ActionPlanning,
)

__all__ = [
    "AccountContext",
    "NormalizedSignal",
    "EvidenceItem",
    "DataGap",
    "ContextBuilderConfig",
    "InvestigationContext",
    "SeverityLevel",
    "RuleEvaluation",
    "TrendSummary",
    "UrgencyAssessment",
    "DeterministicRiskResult",
    "SignalCluster",
    "SignalAnalysisOutput",
    "RiskExplanationOutput",
    "FactItem",
    "InterpretationItem",
    "InvestigationAutopsy",
    "ProposedEmailDraft",
    "ProposedTaskDraft",
    "ActionPlanOutput",
    "OrchestratedInvestigationResult",
    "ValidationResult",
    "AccountAIInputProvider",
    "input_provider",
    "ContextBuilder",
    "context_builder",
    "DeterministicIntelligenceEngine",
    "deterministic_engine",
    "AgentOrchestrator",
    "agent_orchestrator",
    "Agent1SignalAnalysis",
    "Agent2RiskExplanation",
    "Agent3Investigation",
    "Agent4ActionPlanning",
    "OutputValidator",
    "output_validator",
    "PersistAndDisplayManager",
    "persist_manager",
]
