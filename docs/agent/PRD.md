# SignalBridge AI --- Product Requirements Document (PRD)

**Document status:** MVP specification\
**Product:** SignalBridge AI\
**Team:** The Identifiers\
**Primary capability:** Revenue Risk Autopsy\
**Target build:** 36-hour hackathon MVP\
**Last updated:** 2026-10-10

------------------------------------------------------------------------

## 1. Purpose of This Document

This PRD defines what SignalBridge AI must do, who it serves, the user
problems it addresses, the MVP scope, functional and non-functional
requirements, acceptance criteria, and success measures.

It is the product-level source of truth. Technical implementation
details belong in `SYSTEM_ARCHITECTURE.md`, `TECH_STACK.md`,
`SYSTEM_FLOW.md`, `AI_LAYER.md`, `DATABASE_AND_API.md`, and
`IMPLEMENTATION_PLAN.md`. Those documents must remain consistent with
this PRD.

### Requirement labels

-   **P0 --- MVP required:** Must work in the hackathon demonstration.
-   **P1 --- Important enhancement:** Implement only after all P0
    acceptance criteria pass.
-   **P2 --- Post-MVP:** Out of scope for the first working version.
-   **Decision needed:** A product detail not yet established by the
    source material. Do not silently invent a final business
    requirement.

------------------------------------------------------------------------

## 2. Product Summary

SignalBridge AI is an evidence-first revenue intelligence assistant for
customer-success teams at B2B SaaS companies with recurring contracts.

Customer information is spread across CRM records, emails, calendars,
product usage, and customer conversations. Because the signals are
disconnected, teams can miss early signs of customer disengagement,
renewal risk, or expansion opportunities.

SignalBridge AI brings relevant signals into a unified account view,
ranks accounts using transparent risk and urgency rules, explains why an
account deserves attention using source-linked evidence, identifies what
remains unknown, and prepares a useful next action. A human reviews and
approves consequential actions before execution. The system records
decisions and execution outcomes.

**Core product chain:**

> Scattered signals → Unified account context → Risk and opportunity
> detection → Evidence-backed explanation → Recommended action → Human
> approval → Execution → Audit history

The product is not merely a churn score, generic chatbot, or
AI-generated account summary. Its defining experience is a verifiable
path from evidence to an approved action.

------------------------------------------------------------------------

## 3. Problem Statement

### 3.1 Source problem

Sales and customer-success teams store customer information in separate
systems, including CRM records, emails, calendars, product usage, and
conversations. Early indicators of churn or expansion may be missed
because employees must manually locate and interpret the signals.

The challenge is to connect signals across sources, identify revenue
risks and opportunities, explain the evidence behind conclusions, and
recommend the next useful action.

### 3.2 User pain points and root causes

  -----------------------------------------------------------------------
  Pain point              Root cause              SignalBridge AI
                                                  response
  ----------------------- ----------------------- -----------------------
  Customer context is     Separate systems and    Unified account profile
  scattered               records                 and evidence timeline

  Important accounts are  Signals are viewed      Cross-signal risk
  noticed late            individually            detection and
                                                  prioritization

  Risk warnings are       Scores lack inspectable Revenue Risk Autopsy
  difficult to trust      context                 with clickable source
                                                  evidence

  Teams cannot prioritize Limited time and        Ranking by risk,
  every account equally   inconsistent triage     urgency, and available
                                                  revenue exposure

  Follow-up takes time    Emails and tasks are    Next-Best-Action
                          created manually        Copilot prepares
                                                  proposed actions

  CRM follow-through is   Actions happen across   Reviewable,
  inconsistent            separate workflows      approval-based action
                                                  workflow

  AI may overstate what   Incomplete evidence and Separate facts,
  the data proves         uncertain               interpretation, and
                          interpretation          unknowns; enforce human
                                                  review
  -----------------------------------------------------------------------

### 3.3 Intended outcome

Help customer-success teams investigate accounts more efficiently,
understand why an account needs attention, prioritize appropriate
follow-up, and verify that approved actions were completed.

Reduced churn or increased revenue is a potential downstream business
outcome, not a proven result of the MVP. The product must not claim that
it predicts churn accurately or improves retention until those outcomes
are measured using suitable data.

------------------------------------------------------------------------

## 4. Target Users and Customers

### 4.1 Primary user

**Customer Success Manager (CSM)** at a B2B SaaS company managing
recurring customer relationships and renewals.

The CSM needs to: - Find accounts that warrant attention. - Understand
the evidence behind a risk warning. - Investigate missing context before
making assumptions. - Decide what customer interaction is appropriate. -
Prepare follow-up work quickly. - Retain control over customer
communications and CRM changes.

### 4.2 Secondary users

-   **Account Executive / Account Owner:** Reviews account risk and
    completes assigned follow-up.
-   **Sales or Customer Success Manager:** Prioritizes team attention
    and reviews account status.
-   **Revenue Operations (RevOps):** Wants more consistent processes,
    better visibility, and auditable follow-through.
-   **Company leadership:** May use summarized risk and revenue exposure
    information, but executive reporting is not a separate MVP feature.

### 4.3 Initial target customer

B2B SaaS companies with recurring contracts and a customer-success team
responsible for renewals. The initial product is a focused workflow, not
a complete CRM replacement or enterprise customer-success platform.

### 4.4 User permissions

The MVP must distinguish ordinary viewing from consequential actions. If
multi-user authentication is implemented, only an authorized user may
approve actions for accounts they are permitted to manage. The precise
role matrix is a **decision needed** if the team adds multiple
permission levels.

------------------------------------------------------------------------

## 5. Product Goals

### 5.1 MVP goals

1.  Bring signals from at least three source types into one account
    context.
2.  Identify accounts that deserve investigation using transparent,
    deterministic rules.
3.  Show why a risk assessment was made and let users inspect its source
    evidence.
4.  Distinguish observed facts from interpretation and unknowns.
5.  Prepare a personalized email draft, follow-up task, and proposed CRM
    update.
6.  Require explicit human approval before consequential actions.
7.  Record action status and an audit trail.
8.  Demonstrate the complete workflow reliably using clearly labelled
    seeded data when live integrations are unavailable.

### 5.2 Non-goals for the MVP

-   Replacing the customer's CRM or customer-success platform.
-   Guaranteeing churn prediction or claiming validated predictive
    accuracy.
-   Training a custom ML model without an appropriate labelled
    historical dataset.
-   Building a large autonomous multi-agent system.
-   Connecting every CRM, email, calendar, messaging, and analytics
    provider.
-   Sending customer emails or changing a live CRM record without
    explicit approval.
-   Treating generated text as verified fact solely because it is valid
    JSON.
-   Claiming quantified financial savings or retention improvements
    without measurement.
-   Building a full enterprise permission-management system unless
    required by the demonstration environment.

------------------------------------------------------------------------

## 6. Product Features and Requirements

### 6.1 P0 --- Revenue Radar

**Purpose:** Help users decide which accounts need attention first.

**Requirements** - Display 5--10 seeded accounts for the hackathon
demonstration. - Show account name, risk level/score, renewal date,
available revenue exposure, and key contributing signals where data
exists. - Rank accounts using documented risk and urgency logic. - Allow
a user to open an account and inspect its details. - Make it clear when
records are simulated. - Show missing or stale data rather than silently
interpreting it as a negative customer signal.

**Acceptance criteria** - The dashboard loads account records from the
backend/database, not only hard-coded frontend arrays. - The same
account data and scoring-rule version produce the same risk score. -
Users can identify why an account is ranked highly. - Missing values are
represented honestly and do not crash the interface.

### 6.2 P0 --- Unified Evidence Timeline

**Purpose:** Reduce the need to search separate systems for account
context.

**Requirements** - Display relevant CRM, email, calendar/meeting,
product-usage, and conversation signals when available. - Normalize
records into a common format with an account ID, source type, source
record ID, event timestamp, and content or metric. - Sort records
chronologically. - Let the user inspect a signal and its source
details. - Preserve the distinction between source event time and
ingestion time. - Identify simulated records clearly. - Avoid combining
records when account identity is ambiguous.

**Acceptance criteria** - Timeline records belong to the selected
account. - Each material signal displays its source and timestamp. -
Records are ordered consistently. - An ambiguous account match is
flagged or excluded rather than silently guessed.

### 6.3 P0 --- Revenue Risk Autopsy (signature feature)

**Purpose:** Explain why an account warrants investigation and show the
evidence behind the conclusion.

The interface must present three separate categories:

1.  **Observed facts:** What the available records actually state.
2.  **Reasoned interpretation:** Why the combination of facts may
    indicate risk or opportunity.
3.  **Unknowns:** Missing or conflicting information and plausible
    alternative explanations.

**Requirements** - Use the deterministic risk engine for the score and
contributing factors. - Retrieve relevant source records before asking
the LLM to explain the assessment. - Include evidence IDs in the
generated output. - Make material claims clickable so users can inspect
the supporting records. - Validate that every cited evidence ID exists
and belongs to the selected account. - Preserve numeric values and dates
from validated source data. - Surface missing information, stale data,
contradictions, and uncertainty. - Do not treat a lack of reply as proof
of dissatisfaction or declining usage as proof that churn will occur. -
Provide a safe fallback explanation if the LLM service is unavailable or
returns invalid output.

**Acceptance criteria** - Each displayed factual claim can be traced to
an existing source record or is clearly labelled as
unavailable/unverified. - Invalid or cross-account evidence references
are rejected. - The score is not silently altered by the LLM. - The
interface differentiates facts, interpretation, and unknowns. - The user
can reach the relevant evidence from the explanation.

### 6.4 P0 --- Deterministic Risk and Urgency Engine

**Purpose:** Provide consistent and explainable account prioritization.

**Requirements** - Calculate risk using explicit, versioned rules. -
Define the usage baseline/comparison period and decline threshold. -
Define the non-response threshold. - Calculate renewal urgency from the
renewal date. - Avoid double-counting the same underlying event. - Treat
missing data as unknown, not automatically negative. - Keep risk score,
urgency, revenue exposure, and data completeness distinguishable. -
Store the scoring-rule version with every assessment. - Document the
rules and weights used in the demo.

**Acceptance criteria** - Identical inputs and rule versions produce
identical scores. - The contributing factors can be inspected. -
Boundary cases, missing dates, and stale signals have tests. - The UI
does not label a rule-based score as a validated churn probability.

**Important limitation:** The initial weights are demonstration
assumptions. They must not be presented as statistically validated churn
coefficients.

### 6.5 P0 --- Next-Best-Action Copilot

**Purpose:** Convert an assessment into useful, reviewable work.

For the selected account, prepare three separate proposals:

**A. Email draft** - Personalized to the account context. - Focused on
an appropriate next step, such as a customer-success check-in. - Does
not claim that an email has been sent. - Editable before approval.

**B. Follow-up task** - Contains a title, objective, account reference,
owner if known, due date if justified, and status. - Does not invent an
owner or deadline when required data is unavailable; request review or
use an explicitly labelled default.

**C. Proposed CRM update** - Contains the suggested risk status,
supporting reason, and next action. - Does not update a live CRM merely
because a proposal was generated.

**Acceptance criteria** - Each proposal is persisted and has a unique
ID, version, payload, and status. - Proposals are independently
reviewable and approvable. - Editing a proposal creates a new version
and invalidates approval for the prior version. - The UI clearly
distinguishes proposed work from executed work.

### 6.6 P0 --- Trust and Approval Center

**Purpose:** Keep a human in control of consequential actions.

**Requirements** - Allow a user to review, edit, approve, or reject each
proposal independently. - Enforce approval in the backend, not only
through frontend buttons. - Verify authorization, proposal version, and
current status immediately before execution. - Prevent duplicate
execution using an idempotency mechanism. - Block execution of rejected,
expired, changed, or unapproved proposals. - Record reviewer, decision,
timestamp, and approved version. - Show the current state and any
validation errors to the user.

**Acceptance criteria** - No unapproved consequential action executes in
tests. - Editing an approved proposal invalidates the old approval. -
Repeated approval requests do not create duplicate effects. - Rejections
are recorded and cannot execute. - The action payload executed is the
payload that was approved.

### 6.7 P0 --- Execution and Audit History

**Purpose:** Show what happened after approval and maintain
traceability.

**Requirements** - For the seeded-data MVP, persist approved tasks and
CRM-like updates in the demo database. - If an actual email provider is
connected, mark an email as sent only after the provider confirms
successful sending. - Track action lifecycle states such as proposed,
approved, executing, succeeded, failed, and uncertain. - Record each
attempt and outcome. - Handle timeouts without assuming failure or
success until reconciled. - Prevent unsafe retries and duplicate
actions. - Show audit history for the selected account/action.

**Acceptance criteria** - Successful execution produces a persisted
result and audit event. - Failed actions display failure, not success. -
Uncertain results remain visibly uncertain until checked. - Every
approval, rejection, attempt, and outcome can be traced to its proposal.

### 6.8 P1 --- Counterfactual interaction

Allow the user to explore a hypothetical change, such as "What if the
customer champion is on leave?"

The system should explain which assumptions or signals change and how
the assessment or recommended action would differ. It must clearly label
the scenario as hypothetical and must not modify real source data.

### 6.9 P1 --- Expansion opportunity scenario

Demonstrate a potential expansion signal, such as increasing usage or
broader adoption. Explain the supporting evidence and recommend an
appropriate follow-up without claiming that expansion is certain.

### 6.10 P2 --- Multiple live integrations, predictive ML, and multi-agent orchestration

Defer these until the P0 end-to-end workflow works. Add a live
integration only after verifying provider access, authentication,
permissions, quotas, and failure handling. Add predictive ML only with
suitable labelled historical data and evaluation. Add agent
orchestration only if a demonstrated workflow need justifies the added
complexity.

------------------------------------------------------------------------

## 7. End-to-End User Journey

1.  The user opens Revenue Radar.
2.  The backend returns account records and their latest risk summaries.
3.  The user selects an account.
4.  The system displays its unified, chronological evidence timeline.
5.  The user selects **Investigate / Revenue Risk Autopsy**.
6.  The backend validates signals, calculates risk and urgency, and
    retrieves relevant evidence.
7.  The LLM receives a bounded evidence package and generates a
    structured explanation, uncertainties, and recommended action.
8.  The backend validates the output and evidence references.
9.  The UI displays facts, interpretation, unknowns, and supporting
    records.
10. The Copilot prepares an email draft, follow-up task, and proposed
    CRM update.
11. The user reviews, edits, approves, or rejects each proposal.
12. The backend checks authorization, approval version, and action
    status.
13. Approved actions are executed in the demo environment or connected
    provider.
14. The system verifies and persists the result and audit history.
15. The UI shows the final status and lets the user inspect the record.

------------------------------------------------------------------------

## 8. Illustrative Demo Scenario

**Account:** Acme Technologies\
**All values below are fictional demo data.**

-   Product usage is 38% below a defined comparison baseline.
-   No recorded reply exists for 16 days.
-   Renewal is in 43 days.
-   A prior example in the problem statement also describes a last
    meeting 21 days ago and no next step recorded; include these only if
    the seeded dataset explicitly contains those records.

**Expected product behavior** - The account is ranked according to the
documented demo rules. - The Autopsy shows each validated fact and links
it to the corresponding source record. - The interpretation states that
the combined signals warrant investigation; it does not claim churn is
certain. - Unknowns may include seasonality, contact availability, or
unresolved support issues. - The Copilot recommends a customer-success
check-in focused on product adoption and renewal readiness. - The system
drafts an email, proposes a follow-up task, and proposes a CRM update. -
Each action is reviewed independently and requires approval before
consequential execution. - The final outcome is accurately recorded.

Do not add fictional values to real integrations or present demo records
as real customer findings.

------------------------------------------------------------------------

## 9. Functional and Non-Functional Requirements

### 9.1 Functional requirements

-   **FR-01:** Retrieve and display accounts.
-   **FR-02:** Retrieve account-specific source signals.
-   **FR-03:** Normalize and chronologically display evidence.
-   **FR-04:** Calculate transparent risk and urgency values.
-   **FR-05:** Generate an evidence-grounded assessment and next action.
-   **FR-06:** Validate AI output and evidence references.
-   **FR-07:** Generate independent email, task, and CRM proposals.
-   **FR-08:** Edit, approve, or reject each proposal.
-   **FR-09:** Enforce approval and authorization on the backend.
-   **FR-10:** Execute approved operations safely.
-   **FR-11:** Persist status, outcomes, and audit events.
-   **FR-12:** Display errors, missing evidence, and uncertain outcomes
    honestly.
-   **FR-13:** Support a seeded-data demonstration without live provider
    dependencies.

### 9.2 Non-functional requirements

**Reliability** - The main demo must work using seeded data if an
external integration is unavailable. - External API failures must not
corrupt saved account or action records. - The UI must display loading,
empty, error, and success states.

**Security** - Keep provider secrets on the backend. - Never expose
service-role keys or LLM API keys in frontend code. - Validate all
client input and enforce access controls server-side. - Do not execute
actions based solely on model output. - Use least-privilege credentials
for live integrations. - Avoid sending real customer confidential
information to a provider without reviewing applicable terms and
permissions.

**Traceability** - Every material assessment must retain its evidence
references and scoring-rule version. - Every proposal must have a stable
ID and version. - Every decision and execution attempt must be recorded.

**Usability** - A user should be able to navigate from an account to its
evidence, assessment, proposal, approval, and result without manually
searching separate screens. - Facts, interpretations, unknowns,
simulated records, and action statuses must be visually distinguishable.

**Performance** - Avoid unnecessary repeated LLM calls. - Persist valid
assessments where appropriate and invalidate or refresh them when
relevant signals change. - Use pagination or bounded result sets if the
dataset grows. - Exact latency targets are a **decision needed**;
measure response times during testing rather than inventing a guarantee.

**Accessibility** - Use clear labels, readable contrast,
keyboard-accessible controls, and status text that does not rely only on
color.

------------------------------------------------------------------------

## 10. Data and AI Boundaries

### The risk engine owns

-   Rule-based risk score.
-   Factor contributions.
-   Renewal urgency calculation.
-   Rule version.
-   Deterministic ranking inputs.

### The evidence service owns

-   Account-scoped retrieval.
-   Source IDs and timestamps.
-   Data freshness and completeness checks.
-   Validation that records belong to the selected account.

### The LLM owns

-   Plain-language explanation of validated factors.
-   Interpretation of combinations of signals, clearly labelled as
    interpretation.
-   Alternative explanations and unknowns.
-   Recommended next action.
-   Email draft and structured proposal content.

### The backend owns

-   Schema validation.
-   Evidence-reference validation.
-   Authorization and approval enforcement.
-   Proposal versioning.
-   Execution, retries, reconciliation, and idempotency.
-   Persistence and audit logging.

**The LLM must not be the authority for risk scores, evidence existence,
access control, approval state, or execution success.** Valid JSON does
not prove factual correctness.

------------------------------------------------------------------------

## 11. Success Metrics and Evaluation

The MVP should be evaluated using a known seeded dataset and repeatable
tests.

  -----------------------------------------------------------------------
  Metric                  How to measure it       MVP success condition
  ----------------------- ----------------------- -----------------------
  Account prioritization  Compare expected seeded Known scenarios produce
                          factors with displayed  the expected factors
                          ranking                 and documented ranking

  Evidence traceability   Check every factual     Every material factual
                          claim against stored    claim is traceable or
                          records                 explicitly unverified

  Score reproducibility   Recalculate the same    Identical inputs
                          inputs with the same    produce identical
                          rule version            scores

  Approval safety         Attempt execution       Zero unapproved or
                          without approval, after stale-version actions
                          rejection, and after    execute in tests
                          editing                 

  Execution accuracy      Compare displayed       UI and database
                          status with actual      accurately represent
                          demo/provider result    success, failure, or
                                                  uncertainty

  Workflow completion     Run the full            A complete end-to-end
                          account-to-audit        demo can be repeated
                          journey                 reliably

  Investigation effort    Time a manual review    Record actual measured
                          and an assisted review  times; do not assume
                          of the same account     savings in advance

  AI reliability          Test evidence IDs,      Invalid outputs are
                          altered values,         rejected or safely
                          malformed output, and   handled
                          API failure             
  -----------------------------------------------------------------------

Churn reduction, retention improvement, and revenue growth are
longer-term outcome metrics. They cannot be established by the hackathon
demo alone.

------------------------------------------------------------------------

## 12. MVP Scope and Delivery Priorities

### P0 --- Required before the demonstration

-   Revenue Radar with 5--10 seeded accounts.
-   At least three source types represented in the dataset.
-   Unified Evidence Timeline.
-   Deterministic risk and urgency rules.
-   Revenue Risk Autopsy with clickable evidence and uncertainty.
-   Email draft, follow-up task, and proposed CRM update.
-   Independent human approval/rejection.
-   Backend-enforced approval.
-   Persisted demo action execution and audit history.
-   Error handling and repeatable end-to-end tests.

### P1 --- Only after P0 is stable

-   Counterfactual interaction.
-   Expansion opportunity scenario.
-   One verified live connector, if time and credentials permit.
-   UI polish beyond what is needed for a clear demo.

### P2 --- Explicitly deferred

-   Multiple live CRM/email/calendar integrations.
-   Predictive churn ML.
-   Complex multi-agent orchestration.
-   Enterprise-scale deployment and advanced administration.
-   Claims of measured retention or revenue impact without longitudinal
    validation.

------------------------------------------------------------------------

## 13. Dependencies and Related Project Documents

This PRD defines product behavior. Keep implementation details in
focused documents:

-   `AGENT_RULES.md` --- instructions and constraints for coding agents.
-   `SYSTEM_FLOW.md` --- detailed user and backend flow, including
    failure branches.
-   `SYSTEM_ARCHITECTURE.md` --- component boundaries and system
    diagrams.
-   `TECH_STACK.md` --- chosen technologies, package versions, setup,
    and service limitations.
-   `IMPLEMENTATION_PLAN.md` --- phases, tasks, dependencies, ownership,
    and completion gates.
-   `AI_LAYER.md` --- prompt design, model I/O, validation, fallback,
    and AI testing.
-   `DATABASE_AND_API.md` --- database schema, migrations, endpoint
    contracts, and error conventions.

If implementation documents disagree with this PRD, do not silently
choose one. Identify the conflict and resolve it explicitly. Security
and approval requirements must not be weakened for convenience.

------------------------------------------------------------------------

## 14. Open Decisions

These details are not conclusively established by the source materials
and must be confirmed before implementation if they affect the MVP:

1.  **Authentication:** Is a single-user demo sufficient, or must the
    MVP support multiple authenticated users?
2.  **Revenue exposure:** Is ARR available for every seeded account, and
    what currency should the demo use?
3.  **Risk thresholds:** What precise score bands, usage baseline,
    non-response threshold, and renewal urgency windows will the demo
    use?
4.  **Action execution:** Will all actions execute in the demo database,
    or will one provider be connected live?
5.  **Integration provider:** If a live connector is attempted, which
    provider and which narrowly scoped operations will be supported?
6.  **Task deadline:** Should the due date be a configurable default,
    derived from renewal urgency, or selected by the account owner?
7.  **Retention of audit records:** What data-retention requirements
    apply beyond the hackathon demo?

For the initial build, use synthetic data, document the selected demo
defaults, and avoid building optional functionality while these
questions remain unresolved.

------------------------------------------------------------------------

## 15. Definition of Done

The MVP is ready to demonstrate only when all of the following are true:

-   [ ] Revenue Radar loads seeded accounts from the backend.
-   [ ] The timeline shows account-specific records from at least three
    source types.
-   [ ] The risk engine calculates deterministic, inspectable factors.
-   [ ] Revenue Risk Autopsy separates facts, interpretation, and
    unknowns.
-   [ ] Every material factual claim links to valid evidence or is
    clearly marked unverified.
-   [ ] The Copilot generates an editable email draft, task, and CRM
    proposal.
-   [ ] Each proposal can be approved or rejected independently.
-   [ ] Backend checks prevent unapproved, rejected, changed, or
    duplicate actions from executing.
-   [ ] Execution outcomes are verified and accurately displayed.
-   [ ] Approval decisions and outcomes persist in audit history.
-   [ ] Invalid AI output and AI-provider failure are handled safely.
-   [ ] The complete demo can be repeated without manual database
    repair.
-   [ ] Seeded/demo data and simulated integrations are clearly
    labelled.
-   [ ] No unsupported claims of churn prediction, savings, or retention
    improvement are presented as proven results.

------------------------------------------------------------------------

## 16. Product Principle

**SignalBridge AI converts scattered customer signals into a
prioritized, evidence-backed understanding of revenue risk, then helps a
human take the next appropriate action safely and accountably.**

The product succeeds when users can see what happened, inspect why it
matters, understand what remains unknown, approve an appropriate action,
and verify what actually occurred---not merely when an AI model
generates a convincing answer.


---

## 17. Integration Implementation Options and MVP Boundary

### 17.1 Purpose

SignalBridge AI may use existing integration platforms, MCP servers, or direct provider APIs to connect customer data and execute approved actions. The team must not build every provider integration from scratch when a suitable, secure connector already exists.

These are implementation options, not proof that any external account is connected. Provider availability, authentication, permissions, quotas, and supported operations must be verified during implementation.

### 17.2 Supported implementation paths

- **Composio:** Candidate integration layer for discovering/using supported application tools and managing connected-app authorization. Use it only after verifying that the required app, read operations, write operations, and runtime SDK are available.
- **MCP server:** Use a suitable Model Context Protocol server when it exposes the required provider operations and can be called securely from the backend. MCP is a tool-connection protocol, not the risk engine or approval system.
- **Direct provider API:** Use a provider API when it is simpler, more reliable, or better supported for the required operation.
- **Mock provider:** Required for repeatable local development and demo fallback. It must be clearly labelled as simulated and must never claim to have sent a real email or changed a live CRM record.

Do not integrate Composio and MCP merely for architectural novelty. Select the smallest working path for the first connector.

### 17.3 Scope and priorities

- **P0:** A mock provider that supports the complete workflow, including source provenance and simulated action outcomes.
- **P0:** A provider-neutral backend interface so a live connector can replace the mock without changing risk scoring or approval logic.
- **P0 if access/time permit:** One real CRM read integration, plus one tested action path only if credentials, scopes, and verification are available.
- **P1:** Add a second data source or action provider such as Gmail, Calendar, or Slack after the complete vertical slice passes.
- **P2:** Multiple live CRM providers, broad connector coverage, and complex orchestration.

The product must remain demonstrable when external services are unavailable.

### 17.4 Candidate providers

The first CRM is a decision to finalize; HubSpot is a candidate, not a locked requirement. Salesforce is an alternative. Gmail and Calendar can provide communication/meeting signals; Slack can provide notifications; Linear is optional and should only be used if it fits the team's workflow. Product-usage signals may initially be synthetic.

### 17.5 Acceptance criteria

- The UI identifies mock/simulated versus live connections and action outcomes.
- All external calls pass through the backend integration boundary.
- The backend validates account ownership, action type, proposal version, and approval before a write operation.
- Secrets are not exposed to the frontend, model prompts, logs, or source control.
- Provider errors, rate limits, timeouts, and uncertain outcomes are represented truthfully.
- A mock-only run completes the demo from clean seed data.
- The selected live connector is tested against its actual supported operations before being described as implemented.
