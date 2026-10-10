# SignalBridge AI — Hackathon Team Roadmap and Module Ownership

> **Purpose:** This is the shared implementation guide for all four team members and their AI coding agents. Read it before making code changes.
>
> **Project status:** The seven frontend pages already exist. Do not rebuild them from scratch. The goal is to connect them into one working, evidence-first Autonomous RevOps Agent.
>
> **Core constraint:** The hackathon MVP must work without paid CRM subscriptions. Use fictional seeded data first; add a free/live integration only if it is feasible and tested.

---

## 1. What We Are Building

SignalBridge AI helps B2B SaaS Customer Success teams identify concerning customer signals, understand why an account needs attention, and prepare a useful next action.

Customer data may be scattered across:
- CRM: accounts, contacts, ARR, renewal dates, owners, opportunities.
- Email: relevant outreach, replies, customer concerns.
- Calendar: meetings, renewal reviews, follow-ups.
- Product analytics: active users, usage frequency, feature adoption.
- Support: ticket severity, status, age, repeated issues.

The system should:

1. Collect or load data from source adapters.
2. Normalize records into a shared signal format.
3. Associate signals with one canonical customer account.
4. Calculate explainable risk and urgency using deterministic rules.
5. Use an AI agent layer to investigate evidence and explain findings.
6. Generate an editable action proposal.
7. Require server-side human approval before consequential execution.
8. Record action outcomes and audit events.

**Signature feature:** Revenue Risk Autopsy — explains why an account was flagged, links claims to evidence, distinguishes facts from interpretations, states uncertainty, and recommends what to do next.

### Non-goals for the initial MVP

- Do not build seven more pages.
- Do not require five live integrations.
- Do not claim validated churn prediction from demo rules.
- Do not add a vector database, complex distributed agents, or a queue unless a demonstrated need arises.
- Do not allow the LLM to change authoritative scores, invent evidence, bypass approval, or query the database arbitrarily.

---

## 2. Shared Architecture

```text
Existing seven-page React frontend
              |
              v
FastAPI application/API layer
              |
              +-------------------------------+
              |                               |
              v                               v
Member 3: Agent reasoning             Member 4: Tools and workflow
- Risk/urgency rules                  - Mock/live connectors
- One orchestrator                   - MCP/API adapters
- Investigation                      - Action lifecycle
- Evidence-grounded explanation      - Execution and audit workflow
              |                               |
              +---------------+---------------+
                              |
                              v
Member 2: MongoDB, repositories, shared schemas and persistence
                              |
                              v
Seeded data first; optional external sources later
```

These are logical modules. For the MVP, keep one backend deployment and one orchestrator. The specialist agents can be Python modules/classes, not separate deployed services.

### Technology defaults

- Frontend: existing React + TypeScript + Tailwind implementation.
- Backend: Python + FastAPI.
- Database: MongoDB.
- AI: one LLM API if accessible, with a deterministic fallback.
- Integrations: seeded/mock adapters first; optional direct API or MCP adapter later.
- Testing: Python tests for backend/rules/workflows and frontend/API tests where practical.

Do not replace working technology or restructure the repository without a concrete reason.

---

## 3. Team Ownership at a Glance

| Member | Primary ownership | Main deliverable |
|---|---|---|
| **Member 1 — Frontend** | Existing seven pages, shared API client, UI states | All pages work against the shared backend |
| **Member 2 — Backend & Data** | FastAPI foundation, MongoDB, schemas, repositories, seed data, common API routes | Persistent and consistent source of truth |
| **Member 3 — AI Reasoning & Orchestration** | Risk/urgency rules, orchestrator, agent modules, prompts, evidence validation | Reproducible risk assessment and evidence-backed investigation |
| **Member 4 — Tools, Integrations, Action Workflow & QA** | Mock/live adapters, tool interfaces, MCP/API integration, action lifecycle, execution and audit tests | Safe proposal-to-approval-to-outcome workflow |

### Boundary between Members 3 and 4

- **Member 3 owns reasoning:** how the system calculates risk, investigates signals, explains evidence, expresses uncertainty, and recommends an action.
- **Member 4 owns capabilities and execution:** how data/tools are exposed, how adapters work, and how proposals move through approval, execution, failure handling, and audit.
- There must be **one orchestrator**, owned by Member 3.
- Member 2 owns shared schemas, database repositories and common persistence/API foundations.
- Member 4 owns action lifecycle behavior and connector adapters, coordinating persistence changes with Member 2.
- Member 3 must consume tool/service interfaces; it must not build separate connectors or query MongoDB directly from agent code.

---

## 4. Member 1 — Frontend Module

### Objective

Preserve and connect the seven existing pages. Do not redesign or rebuild the app from scratch.

### Tasks

1. Inspect all existing routes, pages, components, forms, buttons and current data sources.
2. Document hardcoded data, broken interactions, missing API calls and navigation problems.
3. Create or improve one shared typed API client.
4. Connect Revenue Radar to account, dashboard and risk APIs.
5. Connect Customer Details to account, contact and signal APIs.
6. Connect Revenue Risk Autopsy to the investigation endpoint.
7. Connect Next-Best-Action Copilot to proposal creation and editing.
8. Connect Trust & Approval Center to approval/rejection, execution status and audit APIs.
9. Connect Settings & Integrations to connector status and sync results.
10. Add loading, empty, error, retry and success states.
11. Ensure page refreshes reflect backend state instead of local fabricated success.
12. Add or update frontend tests where practical.

### Rules

- Do not calculate authoritative risk scores in React.
- Do not invent API fields; use `CONTRACTS.md` and backend schemas.
- Do not put API keys in frontend code.
- Do not fake approval or execution success.
- If a backend endpoint is not ready, use a clearly isolated development mock and document it.
- Do not modify backend business logic.

### Completion criteria

- All seven pages load and navigation works.
- The same account and assessment are shown consistently across pages.
- Evidence and investigation results come from the backend.
- Approval controls call backend endpoints.
- Loading/errors are understandable.
- No UI success state is fabricated.

### Prompt for Member 1's AI coding agent

```text
You are the frontend engineer for SignalBridge AI, a hackathon project.

CONTEXT:
We already have seven frontend pages. Preserve the existing implementation, styles, routes and working components wherever possible. Do not rebuild the app from scratch.

STACK:
React, TypeScript, Tailwind CSS. Backend APIs use FastAPI and MongoDB.

YOUR RESPONSIBILITIES:
1. Inspect the repository and document all seven existing pages, routes, components and current data sources.
2. Identify hardcoded data, broken buttons, missing API calls and navigation problems.
3. Create or improve a shared typed API client.
4. Connect Revenue Radar to account and risk endpoints.
5. Connect Customer Details to account, contact and signal endpoints.
6. Connect Revenue Risk Autopsy to the investigation endpoint and render findings, evidence references and uncertainty.
7. Connect Next-Best-Action Copilot to action-proposal endpoints.
8. Connect Trust & Approval Center to approval, rejection and audit endpoints.
9. Connect Settings & Integrations to integration status and sync results.
10. Add loading, empty, error, retry and success states.
11. Add/update frontend tests where practical.

RULES:
- Do not invent API fields. Use CONTRACTS.md and existing backend schemas.
- Do not calculate authoritative risk scores in the frontend.
- Do not hardcode successful approval or execution states.
- Do not modify backend business logic.
- Do not replace working pages without a demonstrated need.
- If an API is not ready, use a clearly isolated development mock and document it.

FIRST:
Report the current frontend structure, issues, affected files and implementation order.

THEN:
Implement in small, testable steps. List files changed, commands run, test results and remaining backend dependencies.
```

---

## 5. Member 2 — Backend and Data Module

### Objective

Build the common backend and source of truth used by the frontend, agents, connectors and workflow.

### MongoDB collections

| Collection | Stores |
|---|---|
| `accounts` | Canonical account, owner, ARR, renewal date, status |
| `contacts` | Contact details and account association |
| `signals` | Normalized events, source IDs, timestamps and evidence references |
| `risk_assessments` | Score, urgency, rule contributions and scoring version |
| `investigations` | Findings, evidence IDs, uncertainties and status |
| `action_proposals` | Draft content, action type, target, version and status |
| `approvals` | Decision, reviewer, timestamp and comments |
| `tasks` | Follow-up task and execution status |
| `audit_logs` | Actor, event, target, outcome and timestamp |
| `integrations` | Source, mode and connection status |
| `sync_runs` | Optional sync history, record counts and errors |

Use consistent canonical account IDs. Add indexes for account ID, event timestamp, source record ID and workflow status as appropriate.

### Normalized signal contract

Publish a common schema early. Example:

```json
{
  "signal_id": "sig_usage_001",
  "account_id": "acct_acme",
  "source": "product_analytics",
  "signal_type": "usage_decline",
  "occurred_at": "2026-10-08T10:00:00Z",
  "observed_value": 62,
  "baseline_value": 100,
  "unit": "weekly_active_users",
  "source_record_id": "usage_892"
}
```

### Tasks

1. Inspect the existing repository before changing files.
2. Set up FastAPI and MongoDB.
3. Define shared request/response schemas.
4. Implement repositories and application services.
5. Create canonical account IDs and normalized signals with source provenance.
6. Create a repeatable seed script for 5–10 fictional accounts and realistic linked signals.
7. Implement account, dashboard, signal, risk, investigation, proposal, approval, audit and integration-status API routes.
8. Validate requests, handle missing records and return appropriate HTTP errors.
9. Add indexes, configuration, logging and tests.
10. Coordinate schema changes with Members 1, 3 and 4.

### Suggested API routes

- `GET /health`
- `GET /api/dashboard/summary`
- `GET /api/accounts`
- `GET /api/accounts/{id}`
- `GET /api/accounts/{id}/signals`
- `GET /api/accounts/{id}/risk`
- `POST /api/accounts/{id}/investigate`
- `GET /api/investigations/{id}`
- `POST /api/accounts/{id}/actions/draft`
- `POST /api/action-proposals`
- `GET /api/action-proposals/{id}`
- `GET /api/approvals`
- `POST /api/approvals/{id}/approve`
- `POST /api/approvals/{id}/reject`
- `GET /api/audit-logs`
- `GET /api/integrations`

Route signatures can be adapted to the existing code, but changes must be reflected in `CONTRACTS.md`.

### Rules

- MongoDB is the planned database; do not introduce SQL without team agreement.
- Do not store secrets in source control.
- Do not treat frontend state as authorization.
- Use fictional data by default.
- Member 3 owns risk and reasoning; Member 4 owns connector adapters and action lifecycle behavior.
- Coordinate before changing shared models or endpoint signatures.

### Completion criteria

- Backend starts and connects to MongoDB.
- Seed script can be rerun without uncontrolled duplicates.
- Frontend can retrieve stored accounts and signals.
- Assessments, investigations and proposals persist.
- Schemas and APIs are documented.
- Common authorization/persistence behavior is available to the workflow module.

### Prompt for Member 2's AI coding agent

```text
You are the backend and data engineer for SignalBridge AI.

CONTEXT:
Seven frontend pages already exist. Members 1, 3 and 4 depend on your API and data schemas. Stack: Python, FastAPI and MongoDB. The MVP must work without paid CRM subscriptions.

YOUR RESPONSIBILITIES:
1. Inspect the existing repository before changing files.
2. Establish/improve FastAPI and MongoDB connectivity.
3. Define schemas for accounts, contacts, signals, risk assessments, investigations, proposals, approvals, tasks, integrations and audit logs.
4. Define canonical account IDs and a normalized signal format with source provenance.
5. Create a repeatable seed script for 5–10 fictional accounts and linked signals.
6. Implement account, dashboard, signal, risk, investigation, proposal, approval and audit API routes.
7. Use repository/service functions so routes do not contain all business logic.
8. Validate inputs, handle missing records and return suitable HTTP errors.
9. Add indexes, environment configuration, logging and tests.
10. Publish API examples and schemas in CONTRACTS.md.

COORDINATION:
- Member 3 owns risk rules and agent reasoning.
- Member 4 owns connector adapters and action lifecycle behavior.
- Coordinate before changing shared schemas or routes.
- Keep main.py and shared model changes under controlled ownership.

RULES:
- MongoDB only unless the team explicitly agrees otherwise.
- Never commit credentials.
- Never rely on frontend state for authorization.
- Use fictional seed data by default.
- Do not rewrite frontend code.

FIRST:
Inspect the repo and report current state, missing functionality, files and dependencies.

THEN:
Implement incrementally. Report changed files, tests, setup commands, API examples and known limitations.
```

---

## 6. Member 3 — AI Reasoning and Agent Orchestration

### Objective

Build the system's reasoning: deterministic risk/urgency, evidence-grounded investigation, uncertainty handling and next-action recommendations.

### Risk and urgency rules

Implement reproducible functions such as:

```python
def calculate_risk(account, signals) -> dict:
    ...

def calculate_urgency(account, signals) -> dict:
    ...
```

Initial demo-only risk weights:

| Rule | Illustrative points |
|---|---:|
| Usage decline greater than 30% | +25 |
| No relevant reply for 14+ days | +15 |
| Renewal within 60 days without readiness evidence | +20 |
| Severe unresolved support issue | +20 |
| Confirmed loss of key champion | +10 |
| Explicit downgrade/cancellation request | +25 |

Cap the score at 100, version the rules, avoid double-counting the same underlying issue, and return a rule-by-rule breakdown. These weights are not validated churn probabilities.

Urgency is separate from risk and ARR. Define explicit thresholds in code and explain the urgency drivers.

### One orchestrator, four specialist modules

1. **Signal Analysis:** group events, identify trends and data gaps.
2. **Risk Assessment:** explain the deterministic score and urgency.
3. **Investigation:** connect evidence, distinguish facts from interpretations and state uncertainty.
4. **Action Planning:** propose a useful next step and draft content for review.

The modules may be Python classes/functions in one backend. Do not deploy separate services just to call the system multi-agent.

### Orchestration flow

1. Validate account ID.
2. Obtain account context and signals through agreed service/tool interfaces.
3. Calculate deterministic risk and urgency.
4. Select relevant evidence.
5. Ask the LLM for a structured investigation.
6. Validate the response schema and account-scoped evidence IDs.
7. Record facts, interpretations, hypotheses and uncertainty separately.
8. Generate an action proposal if appropriate.
9. Return validated results for persistence by the backend.

### Rules

- No direct MongoDB queries from agent modules.
- No arbitrary tool access.
- No LLM-generated authoritative score.
- No fabricated evidence IDs.
- No approval enforcement or external execution inside the agent reasoning module.
- Use a deterministic fallback if the LLM is unavailable or returns invalid output.

### Completion criteria

- Identical inputs and scoring version yield identical scores.
- Investigation references real evidence for the correct account.
- Uncertainty and missing context are visible.
- Invalid LLM output cannot be stored as trusted findings.
- The system remains usable without a successful LLM API call.

### Prompt for Member 3's AI coding agent

```text
You are the AI reasoning and agent-orchestration engineer for SignalBridge AI.

CONTEXT:
Member 2 owns FastAPI foundations, MongoDB repositories and shared schemas. Member 4 owns integration/tool adapters and action execution workflows.

YOUR RESPONSIBILITIES:
1. Inspect the repo and read CONTRACTS.md.
2. Implement deterministic risk scoring and urgency rules using the normalized signal schema.
3. Version the scoring rules and return score, rule contributions, evidence IDs and urgency explanation.
4. Build one orchestrator for account investigation.
5. Implement Signal Analysis, Risk Assessment, Investigation and Action Planning modules.
6. Use an LLM only for contextual interpretation, evidence-based explanations and draft generation.
7. Define strict structured output schemas.
8. Validate every evidence reference against supplied signals and the requested account.
9. Separate observed facts, interpretations, hypotheses and missing information.
10. Provide a deterministic fallback for LLM failures, rate limits and invalid output.
11. Add tests for scoring, urgency, evidence validation and orchestration.

INTERFACES:
- Use data/service interfaces agreed with Member 2.
- Use Member 4's tool interfaces when source data or an action requires a tool.
- Do not create a second orchestrator.
- Do not implement approval enforcement or external execution.
- Do not query MongoDB directly from agent code.
- Do not let the LLM set authoritative scores or access arbitrary tools.

FIRST:
Propose modules, function signatures, schemas, rules and tests.

THEN:
Implement incrementally. Provide examples, changed files, tests, required environment variables and known limitations.
```

---

## 7. Member 4 — Tools, Integrations, Action Workflow and QA

### Objective

Provide the agent system with controlled source/action tools and implement the workflow from proposal through approval, execution and audit.

### A. Tool interfaces and mock adapters

Create small interfaces for the data/actions needed by the MVP, such as:

```python
class CRMTools:
    async def get_account(self, account_id: str):
        ...

    async def get_activities(self, account_id: str):
        ...

class EmailTools:
    async def get_messages(self, account_id: str):
        ...

    async def draft_email(self, proposal: dict):
        ...
```

Build mock adapters first:

- `MockCRMTools`
- `MockEmailTools`
- `MockCalendarTools`
- `MockProductUsageTools`
- `MockSupportTools`

They should use the team's fictional records and return the same normalized formats expected from a live connector.

### B. Optional MCP/direct API integration

After the seeded workflow works:

1. Select one useful platform.
2. Verify the connector, operations, credentials and limits.
3. Implement a direct API or MCP-backed adapter behind the common interface.
4. Normalize the returned records.
5. Test the adapter against the same contract as mock data.
6. Display accurate connector status in Settings.

Do not build five live connectors or both MCP and direct API adapters for every source.

### C. Action lifecycle

Use explicit states:

```text
draft
  -> pending_approval
  -> approved
  -> executing
  -> executed
```

Other outcomes may include `rejected`, `failed` and `cancelled`.

Approval is not execution. Record the actual result independently.

Before executing, verify:

- Proposal exists and is in the correct state.
- Reviewer is authorized.
- Approved proposal version matches the version being executed.
- Action has not already been executed.
- Target and operation are allowed.
- The request is not a duplicate.

Use idempotency or equivalent duplicate prevention. Record successes, failures and external action IDs when available. A simulated email executor must be labeled as simulated.

### D. QA cases

Test:
- Healthy, declining, urgent and ambiguous accounts.
- Missing/stale data and invalid evidence IDs.
- LLM unavailable.
- Proposal rejected.
- Attempted execution before approval.
- Repeated execution request.
- Connector error or expired credentials.
- End-to-end account → investigation → proposal → approval → outcome.

### Rules

- Do not build a second orchestrator.
- Do not duplicate shared schemas or create a second database.
- Do not claim an integration is live unless tested.
- Do not perform external writes without the required authorized approval.
- Do not block the MVP on live integrations.

### Completion criteria

- Mock tools work without paid subscriptions.
- Any live adapter implemented returns normalized data.
- Approval/rejection persists.
- Unapproved actions cannot execute.
- Duplicate execution is prevented.
- Outcomes and audit events are recorded.
- End-to-end workflow tests pass.

### Prompt for Member 4's AI coding agent

```text
You are the integrations, tools, action-workflow and QA engineer for SignalBridge AI.

CONTEXT:
Member 2 owns FastAPI foundations, MongoDB repositories and shared schemas. Member 3 owns risk rules, AI modules and the single agent orchestrator. You own connector/tool adapters, action lifecycle integration and end-to-end testing.

YOUR RESPONSIBILITIES:
1. Inspect the repo and read CONTRACTS.md.
2. Define minimal tool interfaces for CRM, email, calendar, product usage and support.
3. Implement mock adapters using the team's fictional seeded data.
4. Ensure mock and live adapters return the same normalized record format.
5. Evaluate one useful free integration or MCP-backed connector only after the seeded workflow works.
6. Coordinate tool interfaces with Member 3.
7. Coordinate persistence, API and authorization requirements with Member 2.
8. Implement action lifecycle transitions: draft, pending approval, approved, executing, executed, rejected, failed and cancelled where applicable.
9. Ensure approval is enforced by the backend.
10. Validate that the executed action matches the approved proposal version.
11. Add idempotency/duplicate prevention.
12. Record audit events and actual execution outcomes.
13. Clearly distinguish simulated execution from real external actions.
14. Test connector errors, invalid inputs, approval bypass, duplicate execution and the full workflow.

RULES:
- Do not create a second orchestrator.
- Do not build a second database or duplicate shared models.
- Do not claim a connector is live unless it is tested.
- Do not send real emails or perform external writes without explicit authorized approval.
- Do not block the MVP on integrations.

FIRST:
Propose tool interfaces, adapter structure, state machine, approval checks, audit events and tests.

THEN:
Implement the mock workflow first. Add one live adapter only if feasible. Report changed files, tests, limitations and demo run instructions.
```

---

## 8. How Members 3 and 4 integrate smoothly

### Ownership by interface

| Member 3 provides | Member 4 provides |
|---|---|
| `calculate_risk(...)` | Data/tool interfaces that supply relevant source records |
| `calculate_urgency(...)` | Mock/live source adapters |
| `investigate_account(...)` | Tool access interface used by the orchestrator |
| `generate_action_proposal(...)` | Proposal lifecycle and execution interface |
| Evidence-linked findings and uncertainty | Approval, execution, failure handling and audit |

Example agreed signatures:

```python
# Member 3: reasoning
async def investigate_account(account_id: str) -> dict:
    ...

# Member 4: tools/data access
async def get_account_context(account_id: str) -> dict:
    ...

# Member 4: action workflow
async def execute_approved_action(proposal_id: str) -> dict:
    ...
```

These are proposed signatures; adapt them to the existing code and shared contracts.

### Conflict-prevention rules

- One orchestrator: Member 3 owns it.
- Risk rules: Member 3 owns them.
- Connector/tool interfaces and adapters: Member 4 owns them.
- Shared database and schemas: Member 2 owns them.
- Frontend: Member 1 owns it.
- Approval workflow behavior: Member 4 coordinates with Member 2 on persistence and server-side authorization.
- Shared schema changes must be discussed and documented before merging.

Start by exchanging one sample account, its normalized signals, a sample investigation response and a mock action proposal. Both members can then develop against the same test fixture.

---

## 9. Phased build plan

The timeline below is an example for a 24–36-hour hackathon. Adjust it to your actual deadline.

| Phase | Lead | Supporting members | Exit condition |
|---|---|---|---|
| 0. Audit and contracts | Member 2 | All | Schemas, routes and ownership agreed |
| 1. Data foundation | Member 2 | Members 1, 3, 4 | Seeded accounts/signals load through APIs |
| 2. Risk and investigation | Member 3 | Members 2, 4, 1 | Evidence-backed investigation appears in UI |
| 3. Action workflow | Member 4 | Members 2, 3, 1 | Proposal, approval/rejection and audit work |
| 4. Connect existing pages | Member 1 | Members 2, 3, 4 | All seven pages use the shared backend |
| 5. Optional live integration | Member 4 | Members 2, 3 | One tested connector, or reliable mock fallback |
| 6. Final test and pitch | All | All | Full demo works from the UI |

Work can overlap: Member 1 can build the API client while Member 2 builds endpoints; Members 3 and 4 can work against agreed mock interfaces.

---

## 10. Free-first strategy

The MVP must not depend on paid CRM accounts.

| Need | Initial approach |
|---|---|
| CRM records | Fictional seeded accounts and contacts |
| Emails | Seeded messages and reply timestamps |
| Calendar | Seeded meetings and follow-ups |
| Product usage | Generated daily/weekly activity records |
| Support | Seeded tickets with severity and status |
| Database | MongoDB Atlas free cluster, if available, or local MongoDB |
| LLM | An accessible free-tier API if available; deterministic fallback required |
| Connectors | Mock adapters first; one optional free/live integration later |
| Actions | Simulated executor with clear UI labeling |

Use synthetic customer data for the demo. Clearly distinguish simulated data and actions from real integrations and execution.

---

## 11. Shared repository and Git rules

Suggested structure; adapt to the existing repository rather than rewriting it:

```text
signalbridge-ai/
├── frontend/
│   └── src/
│       ├── pages/          # Existing seven pages
│       ├── components/
│       ├── api/             # Shared API client
│       └── types/
├── backend/
│   └── app/
│       ├── api/             # Member 2
│       ├── models/          # Member 2
│       ├── db/              # Member 2
│       ├── repositories/    # Member 2
│       ├── services/        # Member 2
│       ├── rules/           # Member 3
│       ├── agents/          # Member 3
│       ├── tools/           # Member 4
│       ├── integrations/    # Member 4
│       ├── workflows/       # Member 4
│       └── main.py
├── seed_data/
├── tests/
├── CONTRACTS.md
├── .env.example
└── README.md
```

Rules:

1. Keep `main` runnable.
2. Use feature branches and small pull requests.
3. Never commit `.env` files or credentials.
4. Test each module before merging.
5. Avoid simultaneous edits to shared schemas, `main.py` and common types.
6. Use a shared development database without unexpectedly resetting other members' data.
7. Document setup, environment variables and commands.
8. Stop major refactoring before the final demo and test the merged `main`.

---

## 12. Create `CONTRACTS.md` before parallel implementation

The team must agree on:

- Account and signal schema.
- Risk rules, score breakdown and urgency categories.
- Agent investigation input/output schema.
- API routes and request/response examples.
- Action status values and valid transitions.
- Approval rules and execution result format.
- Connector interface and mock/live status.
- Environment variables and project run commands.

No member should invent a competing schema. If a contract changes, notify the affected owners and update the documentation.

---

## 13. Final end-to-end acceptance test

The application is ready for the demo when the team can:

1. Open Revenue Radar and select a fictional account.
2. See backend-calculated risk, urgency, ARR and renewal context.
3. Open Customer Details and confirm the signals belong to that account.
4. Run Revenue Risk Autopsy and inspect evidence-backed findings and uncertainty.
5. Generate an editable action proposal.
6. Reject one proposal and verify that it cannot execute.
7. Approve another proposal and execute the simulated action.
8. Refresh the page and verify proposal status, outcome and audit history persist.
9. See accurate labels for simulated data, simulated actions and any real connected platform.
10. Complete the workflow without manually editing the database during the presentation.

## Final instruction to the whole team

**Ask your AI coding agent to inspect the existing repository first, read this document and `CONTRACTS.md`, report the files it intends to change, and implement one module at a time.**

Do not ask each AI agent to independently build the whole application. The work must fit into the shared repository, follow the agreed interfaces and preserve the seven existing pages.

The first milestone is:

> A customer loads from MongoDB, receives a reproducible risk score, gets an evidence-backed investigation, and supports an approved or rejected action—all through the existing UI.
