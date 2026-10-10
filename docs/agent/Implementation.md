# SignalBridge AI — UI, Backend, Database, and AI Agent Implementation Plan

## 1. Project objective

Build **SignalBridge AI**, an evidence-first autonomous Revenue Operations (RevOps) assistant for B2B SaaS customer-success teams.

The system connects customer signals from CRM, email, calendar, product usage, and support records; identifies accounts that may need attention; explains the evidence; recommends the next action; and prepares actions for human approval before consequential execution.

**Core workflow:**

`Scattered customer signals → Unified account context → Risk and urgency assessment → Evidence-backed investigation → Proposed action → Human approval → Execution and audit`

The product must not merely display an unexplained risk score or generate a generic summary. Every material claim should be traceable to stored evidence. Unknown or missing information must be clearly labelled.

## 2. Technology stack

Use this stack unless the existing repository already has an established equivalent. Preserve existing project conventions where practical.

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Python, FastAPI
- **Database:** MongoDB (not Supabase or PostgreSQL)
- **AI/LLM:** One LLM API for evidence-grounded explanations and action drafts
- **Integration layer:** CRM, email, calendar, product analytics, and support tools; begin with clearly labelled seeded/demo data
- **Validation:** Pydantic models for backend request/response validation
- **Authentication/authorization:** Add suitable authentication and role checks if supported by the existing project; never rely on frontend-only controls for approval enforcement

### MongoDB requirements

Use MongoDB collections and document references instead of SQL tables and PostgreSQL-specific features.

Suggested collections:
- `accounts`
- `contacts`
- `signals`
- `risk_assessments`
- `investigations`
- `action_proposals`
- `approvals`
- `tasks`
- `audit_logs`
- `integrations`
- `sync_runs` (optional)

Use MongoDB ObjectIds or UUID strings consistently. Keep a consistent identifier type across documents and API payloads. Use indexes for frequently queried fields, including `account_id`, `event_time`, `status`, `renewal_date`, and `created_at`. Use schema validation through Pydantic and, where appropriate, MongoDB collection validators.

Do not use Supabase, PostgreSQL, SQL migrations, SQL joins, or JSONB. Model relationships with reference IDs and perform explicit queries/aggregation in the backend. Embed small, bounded data that is always read with its parent; keep event histories, approvals, and audit records in separate collections so they can grow independently.

## 3. Application navigation and pages

Build in dependency order. First make the data/API foundation work, then build the complete end-to-end workflow.

### Page 1 — App shell and data foundation

**Purpose:** Establish the shared layout, navigation, API connection, and realistic demo dataset.

**UI elements**
- Left sidebar: Revenue Radar, Customers, Approvals, Settings/Integrations
- Top bar: page title, account search, notification area, current user if authentication exists
- Shared components: `AppLayout`, `Sidebar`, `Topbar`, `RiskBadge`, `MetricCard`, `AccountTable`, `LoadingState`, `EmptyState`, `ErrorState`
- Responsive layout and clear loading/error states

**Frontend**
- Set up React + TypeScript + Tailwind.
- Centralize API calls in a small API client.
- Define shared types for accounts, signals, risk assessments, investigations, proposals, approvals, and tasks.
- Do not hardcode account data inside UI components.

**Backend**
- Create the FastAPI application and MongoDB connection lifecycle.
- Add health and initial account endpoints.
- Load environment variables securely; never commit API keys or database credentials.

**MongoDB**
- Connect to the configured MongoDB deployment using an environment variable such as `MONGODB_URI`.
- Create/seed 5–10 fictional accounts and their source signals.
- Keep demo data clearly identifiable as synthetic.

**Initial endpoints**
- `GET /health`
- `GET /api/accounts`
- `GET /api/accounts/{account_id}`

**Acceptance criteria**
- The app loads and retrieves account records from MongoDB.
- Loading, empty, and API error states work.
- No production secrets are stored in source code.

### Page 2 — Revenue Radar

**Purpose:** Help the Customer Success Manager (CSM) identify which accounts deserve attention first.

**UI elements**
- Summary cards calculated from real stored records:
  - Accounts monitored
  - High-risk accounts
  - Renewals due within a configurable window
  - ARR associated with high-risk accounts
- Sortable/filterable account table:
  - Account name
  - ARR
  - Risk score
  - Urgency
  - Main triggered warning
  - Renewal date / days remaining
  - Account owner
  - Open-investigation action
- Filters: risk level, owner, renewal window, and optionally source/signal type
- Clearly distinguish churn risk from expansion opportunities.

**How it works**
1. Backend loads accounts and relevant signals.
2. Deterministic risk rules evaluate each account.
3. Backend calculates or retrieves risk score and urgency separately.
4. ARR and renewal timing are displayed as separate context fields.
5. UI ranks accounts using explicit, explainable sorting rules.

**Risk scoring**
- Use a transparent 0–100 rule-based score for the MVP.
- Store triggered rules and their evidence references.
- Do not describe the score as a churn probability.
- Example display bands (demo settings only): 0–29 low, 30–59 medium, 60–79 high, 80–100 critical.
- Tune weights and thresholds only after review against real historical outcomes.

**Urgency**
- Calculate separately from risk.
- Consider days to renewal, issue severity, time unresolved, action deadlines, and escalation status.
- Make the reason for urgency visible.

**Revenue exposure**
- Display ARR associated with the account.
- Do not calculate “expected revenue loss” from the risk score alone.
- Only show expected exposure using a churn probability if a separately validated/calibrated probability is available.
- Label all synthetic/demo amounts.

**Endpoints**
- `GET /api/accounts`
- `GET /api/accounts/{account_id}/risk`
- `GET /api/dashboard/summary`

**Acceptance criteria**
- All dashboard figures are calculated from MongoDB data.
- Every score has a traceable set of triggered rules.
- Risk, urgency, and ARR are displayed separately.

### Page 3 — Customer Details and Unified Evidence Timeline

**Purpose:** Show one account’s context and let the user inspect source evidence.

**UI elements**
- Customer header: name, owner, subscription status, ARR, renewal date, risk score, urgency
- Key metrics: active users, usage trend, engagement, open support issues, days until renewal
- Chronological evidence timeline
- Source-type labels: CRM, email, calendar, product analytics, support
- Clicking a signal opens its details and source record reference
- Button: **Investigate with AI**

**Signal document fields**
- `_id`
- `account_id`
- `source_type`
- `event_type`
- `event_time`
- `observed_value` (when applicable)
- `description`
- `source_record_id` (when available)
- `metadata` (bounded source-specific object)
- `created_at`
- `is_demo` or equivalent source provenance indicator

**How it works**
1. Frontend requests the account and its signals.
2. Backend queries signals by `account_id`, orders them by `event_time`, and paginates if needed.
3. UI displays the records and timestamps.
4. The application does not ask the LLM to invent timeline events.

**Endpoints**
- `GET /api/accounts/{account_id}`
- `GET /api/accounts/{account_id}/signals`
- `GET /api/signals/{signal_id}`

**Acceptance criteria**
- Each displayed fact comes from a stored record.
- The user can inspect the source and timestamp.
- Missing or stale data is visible instead of being silently treated as a negative signal.

### Page 4 — Revenue Risk Autopsy (signature AI feature)

**Purpose:** Explain why an account may be at risk, show supporting evidence, expose uncertainty, and recommend a sensible next action.

**UI elements**
- Two-column layout:
  - Left: risk factors, observed facts, evidence links, missing/uncertain information
  - Right: AI explanation, recommendation, and follow-up questions about this account
- Show observed facts separately from interpretations.
- Clicking a claim opens the referenced signal.
- Include a “last assessed” timestamp.
- Show errors or insufficient evidence clearly.

**AI workflow**
1. Backend fetches the account, risk assessment, and relevant signals from MongoDB.
2. Backend selects evidence relevant to the current investigation.
3. Backend sends the structured evidence and deterministic risk results to the LLM.
4. LLM returns structured findings, evidence IDs, uncertainty statements, and a recommended action.
5. Backend validates the output against actual stored records.
6. Reject or remove any evidence ID that does not exist or does not belong to the selected account.
7. Save the investigation result and display it.

**Suggested structured response**
```json
{
  "account_id": "acct_001",
  "risk_summary": "Elevated renewal risk requires investigation",
  "findings": [
    {
      "claim": "Product usage declined by 38%",
      "evidence_ids": ["signal_id_101"],
      "type": "observed_fact"
    }
  ],
  "uncertainties": [
    "The reason for the usage decline is unknown"
  ],
  "recommended_action": {
    "type": "customer_check_in",
    "reason": "Investigate adoption and renewal readiness"
  }
}
```

This is a schema example, not a factual account result. Use Pydantic models to validate the response.

**Important AI rules**
- The LLM must not invent customer facts, source IDs, dates, metrics, or churn probabilities.
- A lack of email reply does not prove dissatisfaction.
- Reduced product usage does not prove the customer will churn.
- Show missing, stale, conflicting, and unavailable data.
- Use deterministic calculations for risk and urgency; use the LLM for evidence-grounded explanation and drafting.
- Keep model prompts and API keys on the backend.

**MongoDB**
- `risk_assessments`: account reference, score, triggered rules, evidence references, calculation version, assessed timestamp
- `investigations`: account reference, assessment reference, findings, evidence references, uncertainties, recommendation, model metadata, created timestamp

**Endpoints**
- `POST /api/accounts/{account_id}/investigate`
- `GET /api/investigations/{investigation_id}`

**Acceptance criteria**
- Claims are linked to actual stored evidence.
- Invalid or cross-account evidence references are rejected.
- The interface distinguishes fact, interpretation, and uncertainty.

### Page 5 — Next-Best-Action Copilot

**Purpose:** Turn the investigation into practical, editable action proposals.

**UI sections**
1. **Email draft**
   - Recipient, subject, editable body, rationale
   - Save draft and submit for approval
2. **Follow-up task**
   - Title, description, assignee, due date, priority
   - Create proposed task
3. **CRM update proposal**
   - Current value, proposed value, rationale, supporting evidence
   - Show exactly which fields would change

**How it works**
1. The AI proposes an action based on the validated investigation.
2. Backend validates the proposed structure and account association.
3. Store the proposal in MongoDB with `pending_approval` status.
4. Let the user edit the proposal.
5. Keep it unexecuted until the approval workflow authorizes execution.

**Collections**
- `action_proposals`
- `tasks`

**Endpoints**
- `POST /api/accounts/{account_id}/actions/draft`
- `POST /api/action-proposals`
- `GET /api/action-proposals/{proposal_id}`
- `PATCH /api/action-proposals/{proposal_id}`

**Acceptance criteria**
- Drafts and tasks are saved and linked to the relevant account and investigation.
- Editing a proposal does not execute it.
- No email is described as sent unless the provider confirms the send succeeded.

### Page 6 — Trust and Approval Center

**Purpose:** Ensure humans review consequential actions and can see their execution status.

**UI elements**
- Pending proposals list
- Account name, action type, owner, status, created time
- Review screen with full email, task, or proposed CRM field changes
- Approve and reject actions
- Optional rejection reason
- Execution result: succeeded, failed, or awaiting retry
- Audit history

**Workflow**
1. Proposal is created with `pending_approval` status.
2. Authorized user reviews the exact action.
3. Approval or rejection is recorded.
4. Execution service independently checks authorization, approval state, and proposal validity.
5. Approved operation executes through a provider integration or clearly labelled demo implementation.
6. Record the actual result and audit event.
7. Prevent duplicate execution; use idempotency keys or equivalent safeguards.

**Collections**
- `approvals`
- `audit_logs`
- `action_proposals`
- `tasks`

**Endpoints**
- `GET /api/approvals`
- `POST /api/approvals/{approval_id}/approve`
- `POST /api/approvals/{approval_id}/reject`
- `GET /api/audit-logs`

**Security requirements**
- Enforce approval on the backend, not only in the UI.
- Check user permissions.
- Do not allow rejected, expired, or already-executed proposals to execute.
- Record reviewer, decision, time, operation, result, and failure details.
- Clearly distinguish persisted demo actions from real external actions.

**Acceptance criteria**
- Unapproved consequential actions cannot execute.
- Approve/reject decisions persist in MongoDB.
- The audit log records real execution outcomes, including failures.

### Page 7 — Settings and Integrations (optional after the core workflow)

**Purpose:** Show which data sources are connected, simulated, stale, or unavailable.

**UI elements**
- CRM, email, calendar, product analytics, and support source cards
- Status and last-sync timestamp
- Data freshness warnings
- Connect/retry controls only where implemented
- Clear labels for live versus simulated sources

**Backend and MongoDB**
- `integrations` collection
- Optional `sync_runs` collection
- Keep credentials and tokens in environment variables or a secure secrets store, never in frontend code or ordinary logs.

Do not build a complex integration marketplace before the main risk-to-action workflow works.

## 4. Agent architecture

Use one backend-controlled **Revenue Intelligence Agent** for the MVP. It should coordinate approved functions rather than act as an unrestricted autonomous system.

Suggested functions:
- `get_account_context(account_id)`
- `get_relevant_signals(account_id)`
- `calculate_risk(account_id)`
- `investigate_account(account_id)`
- `draft_email(account_id, investigation_id)`
- `prepare_task(account_id, investigation_id)`
- `prepare_crm_update(account_id, investigation_id)`
- `validate_proposal(proposal_id)`
- `request_approval(proposal_id)`

Keep action execution in a separate service that checks approval and permissions. The LLM must not have unrestricted database access or be able to bypass this service.

## 5. Suggested MongoDB document shapes

These are starting shapes; align naming and ID conventions across all collections.

### `accounts`
```json
{
  "_id": "acct_001",
  "name": "Acme Technologies",
  "arr": 1200000,
  "currency": "INR",
  "renewal_date": "2026-11-22T00:00:00Z",
  "owner_id": "user_001",
  "status": "active",
  "is_demo": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### `signals`
```json
{
  "_id": "signal_101",
  "account_id": "acct_001",
  "source_type": "product_analytics",
  "event_type": "usage_decline",
  "event_time": "2026-10-09T10:00:00Z",
  "observed_value": {
    "baseline_active_users": 100,
    "current_active_users": 62,
    "decline_percent": 38
  },
  "description": "Active users decreased compared with the selected baseline.",
  "source_record_id": "demo_usage_101",
  "is_demo": true,
  "created_at": "2026-10-09T10:05:00Z"
}
```

### `risk_assessments`
```json
{
  "_id": "risk_001",
  "account_id": "acct_001",
  "score": 75,
  "urgency_score": 60,
  "triggered_rules": [
    {
      "rule_id": "usage_decline",
      "points": 25,
      "evidence_ids": ["signal_101"]
    }
  ],
  "calculation_version": "v1",
  "assessed_at": "2026-10-10T10:00:00Z"
}
```

### `action_proposals`
```json
{
  "_id": "proposal_001",
  "account_id": "acct_001",
  "investigation_id": "investigation_001",
  "action_type": "customer_check_in",
  "payload": {
    "subject": "Checking in on product adoption",
    "body": "Editable draft content goes here."
  },
  "evidence_ids": ["signal_101"],
  "status": "pending_approval",
  "created_at": "2026-10-10T10:00:00Z"
}
```

The dates and IDs above are illustrative. In the actual application, generate IDs and timestamps programmatically and use a consistent date/time format, preferably UTC in storage.

## 6. API design and backend conventions

- Use Pydantic request/response models.
- Validate ObjectId/UUID formats at the API boundary.
- Return consistent error responses and appropriate HTTP status codes.
- Paginate timelines and large account lists.
- Filter all account-specific queries by the authorized user's access.
- Add indexes for account references, event timestamps, proposal status, renewal date, and audit timestamps.
- Use MongoDB transactions where supported and justified; otherwise design state transitions carefully and make execution idempotent.
- Do not return secrets or provider tokens to the frontend.
- Keep scoring rules deterministic and versioned.
- Store the evidence references and assessment version used for every investigation.

## 7. Implementation order for a 36-hour hackathon

1. **Hours 0–5:** App shell, FastAPI, MongoDB connection, seeded data, basic endpoints.
2. **Hours 5–10:** Revenue Radar, deterministic risk rules, urgency, ARR, sorting and filters.
3. **Hours 10–14:** Customer detail page and evidence timeline.
4. **Hours 14–19:** AI investigation, structured output, evidence validation and uncertainty.
5. **Hours 19–24:** Email draft, task proposal, CRM proposal.
6. **Hours 24–29:** Approval workflow, backend enforcement, execution statuses and audit logs.
7. **Hours 29–36:** Testing, UI polish, deployment, demo fallback and rehearsal.

These are planning estimates. If time is short, prioritize a reliable end-to-end flow with seeded data over many incomplete live integrations.

## 8. Required demo journey

The final demo must work in this sequence:

1. Open Revenue Radar and see 5–10 fictional accounts.
2. Select a high-risk account.
3. Inspect its evidence timeline.
4. Open Revenue Risk Autopsy and review facts, interpretation, uncertainty, and recommendation.
5. Generate and edit an email draft and follow-up task.
6. Review the proposed CRM change.
7. Attempt to execute an unapproved action and demonstrate that the backend blocks it.
8. Approve a proposal.
9. Show the saved demo action or actual provider result.
10. Open the audit history and verify the outcome.

Never claim a simulated integration is live. Clearly label all demo records and synthetic metrics.

## 9. Success criteria

The MVP is ready to present when:
- Dashboard numbers match MongoDB data.
- Risk scores are reproducible from documented rules.
- Risk, urgency, and ARR exposure remain distinct.
- Every material AI finding references valid account evidence.
- Missing or uncertain evidence is shown explicitly.
- Proposed actions are editable and persisted.
- Unapproved consequential actions cannot execute.
- Approval decisions and action outcomes appear in the audit history.
- The entire demo journey works reliably.

Measure investigation time, evidence correctness, prioritization quality, false alerts, and action completion. Do not claim churn reduction or predictive accuracy until supported by real-world outcome data.

## 10. Final implementation principle

Build **one complete vertical slice** before adding complexity:

**Revenue Radar → Customer Evidence → AI Risk Autopsy → Proposed Action → Human Approval → Execution Result → Audit Log**

Use deterministic code for calculations, an LLM for evidence-grounded explanation and drafting, MongoDB for persistence, and backend-enforced approval for consequential actions. This is the core SignalBridge AI product.
