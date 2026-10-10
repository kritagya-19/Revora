# Revora AI Layer Package

This directory hosts the complete implementation of the Revora AI Layer pipeline as described in [`docs/ai_architecture/AI_LAYER.md`](file:///d:/Kritagya/Revora/docs/ai_architecture/AI_LAYER.md).

Architecture Reference: `ai_layer_architecture.png` (saved in this directory and in `docs/ai_architecture/`).

## Architecture & Module Structure

```
Input: Account context & normalized signals (Backend & MongoDB)
             ↓
[ Stage 1: Context Builder ] (context_builder.py, input_provider.py)
Selects relevant account records and verifiable evidence
             ↓
[ Stage 2: Deterministic Intelligence ] (deterministic.py)
Authoritative Risk score · Urgency · Trends · Rule breakdown
             ↓
[ Stage 3: Agent Orchestrator ] (orchestrator.py)
Coordinates the 4 specialized agents:
├── Agent 1: Signal Analysis (agents/agent1_signal_analysis.py)
├── Agent 2: Risk Explanation (agents/agent2_risk_explanation.py)
├── Agent 3: Investigation (agents/agent3_investigation.py)
└── Agent 4: Action Planning (agents/agent4_action_planning.py)
             ↓
[ Stage 4: Output Validator ] (validators.py)
Enforces output schemas, evidence ID citations, and account ownership
             ↓
[ Stage 5: Persist and Display ] (persistence.py)
Investigation → Action proposal → Staged for Human Approval
```

## Modules
- `schemas.py`: Strictly typed Pydantic models for context, signals, evidence, rule evaluations, autopsies, proposals, and validation results.
- `input_provider.py`: Abstraction layer fetching account context and normalized signals from MongoDB & backend repositories without direct, ungrounded DB operations.
- `context_builder.py`: Stage 1 Context Builder (evidence selection, relevance ranking, catalog citation generation, blind spot/data gap detection).
- `deterministic.py`: Stage 2 Deterministic Intelligence Engine (reproducible mathematical scoring, urgency calculation isolated from ARR, directional trends, rule breakdown).
- `orchestrator.py`: Stage 3 Central Orchestrator coordinating the execution across all 4 agents.
- `agents/`:
  - `agent1_signal_analysis.py`: Understands changes in customer behavior, usage delta vs baseline, and event clustering.
  - `agent2_risk_explanation.py`: Plain-language explanation of risk drivers while locking authoritative scores.
  - `agent3_investigation.py`: Generates the grounded Revenue Risk Autopsy report (separating verified facts from interpretations).
  - `agent4_action_planning.py`: Drafts next-best-action proposals (outreach email and CSM tasks) staged in draft form awaiting human approval.
- `validators.py`: Stage 4 Output Validator (schema check, anti-hallucination citation check, account ownership check, deterministic supremacy check, human approval status check).
- `persistence.py`: Stage 5 Persist and Display Manager (saves investigation and risk assessment to MongoDB, stages action proposals with content hashing in `ActionStatus.PROPOSED`, integrates with `/api/approvals`).
