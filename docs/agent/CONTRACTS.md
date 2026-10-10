# CONTRACTS.md — SignalBridge AI / Revora API & Database Contracts

> **Authority:** Single source of truth for Member 1 (Frontend), Member 2 (Backend & Data), Member 3 (AI & Risk), and Member 4 (Connectors & Actions).  
> **Status:** Active & Implemented. All schemas, collection indexes, and API routes documented below are implemented in the FastAPI backend and MongoDB database.

---

## 1. Canonical Identifiers & Conventions

- **Account IDs:** Stable canonical string identifiers, format `acc-101`, `acc-102` (or `acct_<company>`).
- **Signal IDs:** Format `sig-101`, `sig-102` (or `sig_<source>_<number>`).
- **Proposal IDs:** Format `prop-101`, `prop-<uuid>`.
- **Task IDs:** Format `task-acc-101`, `task-<uuid>`.
- **Approval IDs:** Format `appr-prop-101`.
- **Investigation IDs:** Format `inv-acc-101`, `inv-<uuid>`.
- **Connector IDs:** Format `conn-crm-01`, `conn-email-01`, etc.
- **Timestamps:** ISO 8601 UTC strings (`YYYY-MM-DDTHH:MM:SSZ`).

---

## 2. MongoDB Collections (11 Collections)

| Collection | Role & Contents | Primary & Secondary Indexes |
|---|---|---|
| `accounts` | Canonical accounts, ARR, renewal dates, status | `id` (unique), `renewal_date`, `status` |
| `contacts` | Account stakeholder contacts & sentiments | `id` (unique), `account_id` |
| `signals` | Normalized telemetry events & source provenance | `id` (unique), `(account_id, timestamp)`, `source_record_id` |
| `risk_assessments` | Deterministic risk scores, urgency, rules | `(account_id, evaluated_at)` |
| `investigations` | Evidence-grounded autopsy findings & uncertainties | `id` (unique), `(account_id, created_at)` |
| `action_proposals` | Draft action items with cryptographic content hash | `id` (unique), `account_id`, `status` |
| `approvals` | Human review decisions, approver, content hash | `id` (unique), `proposal_id`, `account_id` |
| `tasks` | Follow-up action tasks, assignees, due dates | `id` (unique), `account_id`, `status` |
| `audit_logs` | Immutable audit trail of state changes & dispatches | `(account_id, timestamp)` |
| `integrations` | Active connector configuration & freshness status | `id` (unique), `category` |
| `sync_runs` | Sync execution telemetry, durations, record counts | `id` (unique), `(integration_id, started_at)` |

---

## 3. Normalized Signal Contract

External ingestion adapters, connectors, and agent pipelines emit signals in this normalized JSON structure:

```json
{
  "signal_id": "sig_usage_001",
  "account_id": "acc-101",
  "source": "product_analytics",
  "signal_type": "usage_decline",
  "occurred_at": "2026-10-08T10:00:00Z",
  "observed_value": 62,
  "baseline_value": 100,
  "unit": "weekly_active_users",
  "source_record_id": "usage_892",
  "severity": "high",
  "title": "Severe Usage Contraction",
  "summary": "Active seats dropped from 100 to 62 over the last 14 days.",
  "metadata": {
    "drop_percentage": 38.0
  }
}
```

*Note: The backend bidirectionally maps `id` ↔ `signal_id`, `source_category` ↔ `source`, and `timestamp` ↔ `occurred_at`.*

---

## 4. API Endpoints Specification

Base URL: `http://localhost:8000` (All endpoints support both `/api/...` and `/api/v1/...`).

### System & Health
- `GET /health`  
  **Response:** `{"status": "healthy", "service": "revora-backend", "environment": "development", "execution_mode": "simulated"}`

---

### Page 2: Revenue Radar & Portfolio
- `GET /api/dashboard/summary`  
  **Response:**
  ```json
  {
    "total_accounts_monitored": 8,
    "high_risk_accounts_count": 3,
    "renewals_due_soon_count": 2,
    "high_risk_arr": 325000.0,
    "total_portfolio_arr": 1105000.0,
    "average_risk_score": 58.4,
    "rule_version": "v1.0.0"
  }
  ```

- `GET /api/accounts`  
  **Query Params:** `risk_level`, `csm_owner`, `renewal_within_days`, `search`  
  **Response:** `AccountRiskSummary[]`

- `GET /api/accounts/{account_id}`  
  **Response:** `AccountDetail` (includes embedded `contacts`, `signals`, and `customer_metrics`).

- `GET /api/accounts/{account_id}/risk`  
  **Response:** `AccountRiskDetail` (transparent breakdown of triggered rules, weights, and urgency).

---

### Page 3: Evidence Timeline & Signals
- `GET /api/accounts/{account_id}/signals` (alias: `GET /api/signals/account/{account_id}`)  
  **Response:** `Signal[]` (sorted by timestamp descending).

- `GET /api/signals/{signal_id}`  
  **Response:** `Signal` (traceable source metadata and values).

- `POST /api/signals`  
  **Request Body:** `Signal` (normalized or standard)  
  **Response:** `Signal` (status `201 Created`, logs audit trail).

- `GET /api/accounts/{account_id}/evidence`  
  **Response:** `EvidenceRecord[]`

---

### Page 4: Revenue Risk Autopsy (AI Investigation)
- `POST /api/accounts/{account_id}/investigate`  
  **Response:** `Investigation`
  ```json
  {
    "id": "inv-acc-101",
    "account_id": "acc-101",
    "account_name": "Acme Dynamics",
    "risk_summary": "Immediate renewal jeopardy: 45% usage decline and open critical delivery issues.",
    "risk_score": 88,
    "risk_level": "critical",
    "primary_reason_code": "USAGE_DROP_AND_UNRESOLVED_TICKETS",
    "findings": [
      {
        "claim": "Weekly routing activity declined by 45% over 3 weeks.",
        "evidence_ids": ["sig-101"],
        "type": "observed_fact"
      }
    ],
    "causal_explanation": "Routing volume dropped precipitously after support incident ticket #3910.",
    "uncertainties": ["Customer executive team has not confirmed alternate routing vendor."],
    "recommended_action": {
      "type": "customer_check_in",
      "action_type": "csm_email",
      "title": "Send Urgent Re-engagement Email to VP Logistics",
      "reason": "Address delivery delay issues prior to renewal deadline."
    },
    "rule_version": "v1.0.0",
    "created_at": "2026-10-10T12:00:00Z"
  }
  ```

- `GET /api/investigations/{investigation_id}`  
  **Response:** `Investigation`

- `POST /api/accounts/{account_id}/autopsy/ask`  
  **Request Body:** `{"question": "Why did usage decline?"}`  
  **Response:** `AskAccountQuestionResponse` (evidence-cited answers with explicit confidence).

---

### Page 5: Next-Best-Action Copilot (Proposals & Drafts)
- `POST /api/accounts/{account_id}/actions/draft`  
  **Response:** `DraftActionsResponse` (contains candidate `email_draft`, `task_draft`, `crm_update`).

- `POST /api/action-proposals`  
  **Request Body:**
  ```json
  {
    "account_id": "acc-101",
    "action_type": "csm_email",
    "title": "Re-engagement outreach",
    "payload": {
      "recipient": "dave@acmedynamics.com",
      "subject": "Urgent Sync",
      "body": "Hi Dave..."
    },
    "evidence_ids": ["sig-101"]
  }
  ```
  **Response:** `ActionProposal` (stored with status `"proposed"` and content hash).

- `GET /api/action-proposals/{proposal_id}`  
  **Response:** `ActionProposal`

- `PUT /api/action-proposals/{proposal_id}` / `PATCH /api/action-proposals/{proposal_id}`  
  **Behavior:** Increments version number, recomputes content hash, and automatically invalidates prior approvals.

---

### Page 6: Trust & Approval Center
- `GET /api/approvals`  
  **Response:** `EnrichedPendingApproval[]` (all proposals requiring human review).

- `POST /api/approvals/{proposal_id}/approve`  
  **Request Body:** `{"approver": "CSM Sarah", "expected_hash": "<content_hash>"}`  
  **Status Code:** `200 OK` on success, `409 Conflict` if proposal content changed.

- `POST /api/approvals/{proposal_id}/reject`  
  **Request Body:** `{"reason": "Wait for technical lead review", "reviewer": "CSM Sarah"}`  
  **Status Code:** `200 OK`.

- `POST /api/approvals/{proposal_id}/execute`  
  **Behavior:** Checks status is `"approved"` and has authorized human signature. Dispatches simulation or live provider.  
  **Status Code:** `200 OK`, `403 Forbidden` if unapproved.

---

### Follow-Up Tasks Management
- `GET /api/tasks` (optional query: `account_id`, `status`)  
  **Response:** `ProposedTask[]`

- `GET /api/tasks/{task_id}`  
  **Response:** `ProposedTask`

- `POST /api/tasks`  
  **Request Body:**
  ```json
  {
    "account_id": "acc-101",
    "title": "Executive Sponsor Alignment Call",
    "description": "Schedule meeting with VP Logistics",
    "assigned_to": "Sarah Jenkins",
    "due_date": "2026-11-08",
    "priority": "high",
    "evidence_ids": ["sig-101"]
  }
  ```
  **Response:** `ProposedTask` (`201 Created`).

- `PATCH /api/tasks/{task_id}`  
  **Request Body:** `{"status": "completed"}`  
  **Response:** `ProposedTask`.

---

### Page 7: Settings & Integrations
- `GET /api/integrations`  
  **Response:** `IntegrationConnector[]` (6 connectors: Salesforce, Gmail, Calendar, Mixpanel, Zendesk, MongoDB).

- `GET /api/integrations/{integration_id}`  
  **Response:** `IntegrationConnector`

- `POST /api/integrations/{integration_id}/sync`  
  **Response:** `TriggerSyncResponse` (executes background sync, refreshes timestamps, records sync run).

- `GET /api/integrations/sync-runs`  
  **Response:** `SyncRunRecord[]`

---

### Audit Logs
- `GET /api/audit-logs`  
  **Query Params:** `account_id`, `event_type`, `limit` (default 100)  
  **Response:** `AuditLog[]`
  ```json
  [
    {
      "account_id": "acc-101",
      "proposal_id": "prop-101",
      "event_type": "proposal_approved",
      "actor": "Sarah Jenkins",
      "details": { "version": 1, "hash": "..." },
      "timestamp": "2026-10-10T12:05:00Z"
    }
  ]
  ```

---

## 5. Error Contract

All errors return JSON with clear `detail`:

```json
{
  "detail": "Action execution blocked: Proposal prop-101 is in status 'proposed', not 'approved'."
}
```

| HTTP Code | Usage |
|---|---|
| `400 Bad Request` | Malformed inputs or missing required parameters |
| `403 Forbidden` | Unapproved consequential action execution attempted |
| `404 Not Found` | Requested account, signal, proposal, or task not found |
| `409 Conflict` | Approval hash mismatch (proposal edited during review) |
| `422 Unprocessable` | Pydantic schema validation failure |
| `500 Internal Error` | Unhandled backend exception |
