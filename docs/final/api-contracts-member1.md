# Member 1 — Data Layer & API Contracts Specification

**Author:** Member 1 (Customer Data, Database & Integrations)  
**Target Audience:** Member 2 (AI Intelligence, Risk & Automation) & Member 3 (Feedback, Reminders & Continuous Improvement)  
**Status:** Complete, Live & Verified in MongoDB (`revora` on `localhost:27017`)  
**Backend Base URL:** `http://localhost:8000`

---

## 1. Overview & Data Layer Guarantees

Member 1 provides a unified, continuous customer data foundation across all 15 enterprise accounts. All source records are ingested, normalized, indexed, and persisted in MongoDB.

### Core Provenance Guarantees
1. **Canonical Customer IDs:** All records use standardized IDs (`acc-101` through `acc-114` plus `acc-hs-101`).
2. **Normalized Source Categories & Types:**
   - **CRM:** `source_category="crm"`, `source_type="hubspot"`
   - **Email:** `source_category="email"`, `source_type="gmail"`
   - **Calendar:** `source_category="calendar"`, `source_type="google_calendar"`
   - **Usage Analytics:** `source_category="usage"`, `source_type="telemetry"`
   - **Support Tickets:** `source_category="support"`, `source_type="zendesk"` / `"hubspot"`
3. **Traceability:** Every signal has a unique `id`, `evidence_id` (e.g. `ev-sig-101`), `source_record_id`, and `occurred_at` / `timestamp`.
4. **Relational Linkage:** 100% of signals, contacts, tasks, feedback submissions, and action tracker items belong to verified active accounts in `db.accounts`.

---

## 2. Monitored Accounts Portfolio (15 Customers)

| Account ID | Company Name | Domain | ARR | Renewal Date | Urgency | CSM Owner | Contact | Tier Profile |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| `acc-101` | Acme Technologies | `acmetechnologies.com` | $120,000 | 2026-11-23 | Within 60d | Sarah Jenkins | David Vance (`d.vance@acmetechnologies.com`) | High Risk |
| `acc-102` | CloudNova Technologies | `cloudnova.io` | $85,000 | 2026-11-20 | Within 60d | Marcus Chen | Rachel Adams (`radams@cloudnova.io`) | Moderate Decline |
| `acc-103` | Vortex Analytics | `vortexdata.ai` | $240,000 | 2026-12-15 | Stable (>60d) | Sarah Jenkins | Liam Gallagher (`liam@vortexdata.ai`) | Healthy / Expansion |
| `acc-104` | HyperScale Labs | `hyperscalelabs.co` | $175,000 | 2026-10-25 | Immediate (<30d) | Alex Rivera | Vikram Patel (`vikram@hyperscalelabs.co`) | High Risk |
| `acc-105` | OmniHealth Solutions | `omnihealth.org` | $95,000 | 2027-02-10 | Stable (>60d) | Marcus Chen | Patricia Hayes (`phayes@omnihealth.org`) | Healthy / Expansion |
| `acc-106` | Apex Fintech Group | `apexfintech.com` | $310,000 | 2026-11-12 | Within 60d | Sarah Jenkins | Michael Sterling (`msterling@apexfintech.com`) | High Risk |
| `acc-107` | KiteFlow Commerce | `kiteflow.shop` | $62,000 | 2027-03-30 | Stable (>60d) | Alex Rivera | Chloe Nguyen (`chloe@kiteflow.shop`) | Healthy / Growth |
| `acc-108` | Starlight Media Network | `starlightmedia.io` | $115,000 | 2027-01-18 | Stable (>60d) | Marcus Chen | Arthur Pendelton (`arthur@starlightmedia.io`) | Moderate Decline |
| `acc-109` | PulseWave Health | `pulsewavehealth.com` | $145,000 | 2026-11-05 | Immediate (<30d) | Sarah Jenkins | Alistair Finch (`afinch@pulsewavehealth.com`) | High Risk |
| `acc-110` | Cobalt Cybersecurity | `cobaltsec.io` | $210,000 | 2027-04-15 | Stable (>60d) | Alex Rivera | Maya Lin (`maya@cobaltsec.io`) | Moderate Decline |
| `acc-111` | DataNest AI | `datanest.ai` | $160,000 | 2026-11-30 | Within 60d | Marcus Chen | Ethan Cole (`ethan@datanest.ai`) | Moderate Decline |
| `acc-112` | QuantumPay Solutions | `quantumpay.com` | $280,000 | 2026-10-31 | Immediate (<30d) | Sarah Jenkins | Priya Sharma (`priya@quantumpay.com`) | High Risk |
| `acc-113` | Zenith Logistics | `zenithlogistics.com` | $78,000 | 2027-05-20 | Stable (>60d) | Alex Rivera | Carlos Mendez (`carlos@zenithlogistics.com`) | Healthy / Steady |
| `acc-114` | Aether Dynamics | `aetherdynamics.tech` | $195,000 | 2026-12-05 | Within 60d | Marcus Chen | Samantha Wright (`samantha@aetherdynamics.tech`) | Moderate Decline |
| `acc-hs-101` | Starlight Industries (HubSpot) | `starlight.io` | $120,000 | 2026-11-23 | Within 60d | Alice Smith | Bob Vance (`bob@starlight.io`) | High Risk |

---

## 3. Data Contract for Member 2 (AI Intelligence & Risk)

Member 2 uses the following endpoints to power the Risk Radar, Revenue Risk Autopsy, AI Copilot, and Investigation screens.

### 3.1. Ranked Accounts List
**Endpoint:** `GET /api/accounts`  
**Query Parameters:**
- `risk_level` (`critical`, `high`, `medium`, `low`, `all`)
- `csm_owner` (string filter)
- `renewal_within_days` (integer)
- `sort_by` (`risk_score`, `arr`, `renewal_date`, `name`)
- `search` (text search across name, domain, CSM, primary reason)

**Sample Response Item (`AccountRiskSummary`):**
```json
{
  "id": "acc-101",
  "name": "Acme Technologies",
  "domain": "acmetechnologies.com",
  "arr": 120000.0,
  "renewal_date": "2026-11-23",
  "csm_owner": "Sarah Jenkins",
  "industry": "Enterprise SaaS Platform",
  "health_score": 38,
  "tier": "Enterprise",
  "status": "active",
  "risk_level": "high",
  "risk_score": 55,
  "urgency_days_to_renewal": 42,
  "urgency_label": "Within 60d",
  "primary_reason_code": "high_usage_drop_near_renewal",
  "main_warning": "Core Workflow Ingest Down 45%: Active fleet routing calls contracted 45%",
  "contributing_factors": [
    "Usage contracted by 45.0%",
    "Renewal in 42 days",
    "2 unresolved critical support tickets"
  ]
}
```

### 3.2. Account Risk Breakdown
**Endpoint:** `GET /api/accounts/{account_id}/risk`  
**Response Model:** `AccountRiskDetail`  
**Sample Response:**
```json
{
  "account_id": "acc-101",
  "account_name": "Acme Technologies",
  "risk_score": 55,
  "risk_level": "high",
  "urgency_days_to_renewal": 42,
  "urgency_label": "Within 60d",
  "primary_reason_code": "high_usage_drop_near_renewal",
  "main_warning": "Core Workflow Ingest Down 45%",
  "contributing_factors": [
    "Usage contracted by 45.0%",
    "Renewal in 42 days",
    "2 unresolved critical support tickets"
  ],
  "rule_version": "v2.0.0",
  "signals_count": 18,
  "arr": 120000.0,
  "renewal_date": "2026-11-23"
}
```

### 3.3. Multi-Source Signals & Evidence Records
**Endpoints:**
- `GET /api/accounts/{account_id}/signals` -> Chronological list of `Signal`
- `GET /api/accounts/{account_id}/evidence` -> Chronological list of `EvidenceRecord`
- `GET /api/signals?account_id={id}&source_type={type}` -> Portfolio-wide filtered signals

**Sample Signal Payload (`Signal`):**
```json
{
  "id": "sig-gmail-acc-101",
  "signal_id": "sig-gmail-acc-101",
  "account_id": "acc-101",
  "source_category": "email",
  "source_type": "gmail",
  "source": "gmail",
  "evidence_id": "ev-sig-gmail-acc-101",
  "source_record_id": "rec-sig-gmail-acc-101",
  "signal_type": "customer_reply",
  "event_type": "email_received",
  "title": "Gmail: Inbound renewal objection from David Vance (VP of Engineering)",
  "summary": "David Vance replied: 'We experienced critical webhook drops during Tuesday peak load. Unless our Okta SSO and 99.99% webhook latency SLAs are signed off, our executive team cannot approve the Enterprise renewal in November.'",
  "severity": "high",
  "timestamp": "2026-10-10T00:10:00Z",
  "metadata": {
    "thread_id": "gm-th-acc-101-01",
    "sender": "d.vance@acmetechnologies.com",
    "sender_name": "David Vance",
    "recipient": "sarah.jenkins@revora.app",
    "subject": "Re: Enterprise Renewal & Telemetry Issues",
    "sentiment": "negative",
    "customer_reply": "Unless our Okta SSO and 99.99% webhook latency SLAs are signed off, our executive team cannot approve the Enterprise renewal in November.",
    "urgency": "immediate"
  }
}
```

### 3.4. Revenue Risk Autopsy Context
**Endpoint:** `GET /api/accounts/{account_id}/autopsy`  
**Response Model:** `RevenueRiskAutopsy`  
**Sample Response:**
```json
{
  "account_id": "acc-101",
  "risk_score": 55,
  "risk_level": "high",
  "rule_version": "v2.0.0",
  "facts": [
    {
      "evidence_id": "sig-usage-acc-101",
      "claim": "Core Workflow Ingest Down 45%",
      "source_category": "usage",
      "timestamp": "2026-10-11T01:10:00Z"
    },
    {
      "evidence_id": "sig-supp-acc-101",
      "claim": "Ticket #4401: Delivery Route Ingestion Webhook Outage",
      "source_category": "support",
      "timestamp": "2026-10-09T02:10:00Z"
    }
  ],
  "interpretations": [
    "Customer experienced 45% usage decline alongside 2 unresolved support tickets ahead of November renewal."
  ],
  "unknowns": [
    "External stakeholder sentiment from executive board members not yet captured in CRM."
  ],
  "suggested_action_type": "csm_email"
}
```

---

## 4. Data Contract for Member 3 (Feedback, Reminders & Outcomes)

Member 3 uses the following endpoints to power the Feedback Survey Loop, Continuous Improvement Engine, Task Reminders, and Outcome Tracker.

### 4.1. Automatic Feedback Triggers
**Endpoint:** `GET /api/feedback/check-trigger/{account_id}`  
**Query Parameters:** `force_ignore_cooldown` (boolean, default false)  
**Sample Response (`FeedbackTriggerCheck`):**
```json
{
  "account_id": "acc-101",
  "account_name": "Acme Technologies",
  "eligible": true,
  "risk_level": "high",
  "risk_score": 55,
  "matched_rules": [
    {
      "rule_id": "usage_drop_severe",
      "rule_name": "Active Telemetry Contraction >= 30%",
      "triggered": true,
      "description": "Observed 45.0% contraction in usage metrics",
      "observed_value": 45.0,
      "threshold": 30.0
    },
    {
      "rule_id": "critical_support_bugs",
      "rule_name": "Open Critical Support Bugs",
      "triggered": true,
      "description": "Detected 2 unresolved critical support tickets",
      "observed_value": 2,
      "threshold": 1
    }
  ],
  "reasons": [
    "Usage drop (45.0%) exceeds 30% threshold",
    "2 open critical support tickets"
  ],
  "cooldown_active": false,
  "cooldown_days_remaining": 0,
  "duplicate_pending_survey": false,
  "recommended_template_id": "survey-tpl-churn-early-warning"
}
```

### 4.2. Feedback Submission & AI Analysis
**Endpoints:**
- `GET /api/feedback` -> List all analyzed feedback
- `GET /api/feedback/account/{account_id}` -> Feedback for specific customer
- `POST /api/feedback` -> Submit and analyze feedback

**Sample Submission (`FeedbackResponseSubmission`):**
```json
{
  "survey_code": "rev-fb-acme-101",
  "account_id": "acc-101",
  "respondent_email": "d.vance@acmetechnologies.com",
  "respondent_name": "David Vance",
  "satisfaction_score": 4,
  "usage_trend_self_report": "decreased",
  "primary_blocker": "Authentication / SSO or permissions issues",
  "unresolved_issues": "SSO integration times out frequently for Europe team.",
  "feature_improvement_request": "Okta SSO v2 support and faster webhook sync.",
  "additional_comments": "Need this fixed before Q4 renewal."
}
```

**Returned Object (`CustomerFeedbackRecord`):**
```json
{
  "id": "fbr-101",
  "survey_code": "rev-fb-acme-101",
  "account_id": "acc-101",
  "account_name": "Acme Technologies",
  "recipient_email": "d.vance@acmetechnologies.com",
  "recipient_name": "David Vance",
  "submission": { ... },
  "analysis": {
    "classified_churn_reason": "adoption_blocker",
    "urgency_level": "critical",
    "sentiment_label": "frustrated",
    "sentiment_interpretation": "Engineering leadership expresses frustration over recurring authentication blockers.",
    "key_blockers": ["Okta SAML assertion timeout", "Europe delivery team lockout"],
    "recommended_retention_action": "Schedule dedicated solutions engineer working session within 24 hours.",
    "confidence_score": 0.91,
    "rule_notice": "Sentiment is treated as an interpretation, not a verified fact about internal mental state."
  },
  "submitted_at": "2026-10-10T14:30:00Z"
}
```

### 4.3. Follow-Up Tasks & Reminders
**Endpoints:**
- `GET /api/tasks` -> List all tasks (supports `account_id` and `status` query filters)
- `POST /api/tasks` -> Create new task
- `PATCH /api/tasks/{task_id}` -> Update task status (`pending`, `completed`), priority, or assignee

**Sample Task Response (`ProposedTask`):**
```json
{
  "id": "task-acc-101",
  "account_id": "acc-101",
  "title": "Executive Sponsor Alignment Call",
  "description": "Schedule direct check-in with David Vance to address delivery webhook tickets.",
  "assigned_to": "Sarah Jenkins",
  "due_date": "2026-11-08",
  "priority": "high",
  "status": "pending",
  "evidence_ids": ["sig-101", "sig-102"],
  "created_at": "2026-10-08T09:00:00Z"
}
```

### 4.4. Closed-Loop Action & Outcome Tracker
**Endpoints:**
- `GET /api/tracker` -> List tracked actions (filter by `account_id`, `has_outcome`)
- `POST /api/tracker` -> Register new tracked action
- `POST /api/tracker/{id}/outcome` -> Record outcome form (notes, customer response, commitments, next steps)
- `GET /api/tracker/intelligence` -> Continuous improvement metrics (historical response rates, recurring blockers, learned patterns)
- `GET /api/tracker/intelligence/account/{account_id}` -> History-aware anti-repetition context

**Sample Outcome Record in `ActionTrackerItem`:**
```json
{
  "id": "act-track-101",
  "account_id": "acc-101",
  "account_name": "Acme Technologies",
  "action_type": "csm_outreach_email",
  "title": "Urgent Renewal Outreach Email to VP Engineering",
  "action_status": "executed",
  "work_status": "completed",
  "assigned_to": "Sarah Jenkins (CSM Lead)",
  "outcome": {
    "outcome_id": "out-101",
    "notes": "Delivered outreach. VP replied same day expressing interest in keeping platform but needed clarity on tiered pricing & seat consolidation.",
    "customer_response": "Positive — VP confirmed commitment to renewal if SSO and seat tiering are finalized before renewal deadline.",
    "commitments": "Revora CSM will prepare custom ROI breakdown and SSO tier guide by Thursday. Acme will invite VP Eng and IT Lead to final pricing review.",
    "next_steps": "Follow up with tailored architecture pricing deck by Oct 15; schedule formal renewal sign-off call.",
    "recorded_by": "Sarah Jenkins (CSM Lead)",
    "recorded_at": "2026-10-11T15:30:00Z"
  }
}
```

---

## 5. Verification Checklist & Test Coverage

All contracts are tested and verified via automated test suites in `backend/tests/`:
- `tests/test_member1_task_a.py`: Verifies HubSpot integration, CRM data ingestion, Gmail & Calendar connectors.
- `tests/test_member1_task_b.py`: Verifies Pydantic schema validation, persistence of feedback, tasks, outcomes, and risk assessments across restarts.
- `tests/test_member1_task_c.py`: Verifies Gmail & Calendar coverage across all 15 accounts, varied usage levels, customer replies, and relational integrity.
- `tests/test_member1_task_d.py`: Verifies exact API response structures for Member 2 and Member 3 and cross-member data alignment.

```bash
# To run full verification of Member 1 deliverables:
pytest tests/test_member1_task_a.py tests/test_member1_task_b.py tests/test_member1_task_c.py tests/test_member1_task_d.py -v
```
**Result: 21 passed in 8.5s (100% PASS).**
