export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type ActionStatus = 'proposed' | 'approved' | 'rejected' | 'executing' | 'succeeded' | 'failed' | 'retry_pending' | 'uncertain';

export interface Contact {
  id: string;
  account_id: string;
  name: string;
  email: string;
  role?: string;
  is_primary: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  last_contact_date?: string;
}

export interface Signal {
  id: string;
  account_id: string;
  source_category: string;
  source_type?: string;
  signal_type: string;
  event_type?: string;
  title: string;
  summary: string;
  description?: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  timestamp: string;
  event_time?: string;
  observed_value?: string;
  source_record_id?: string;
  metadata?: Record<string, any>;
}

export interface CustomerMetrics {
  active_users: number;
  baseline_users: number;
  usage_trend: string;
  usage_drop_pct: number;
  recent_engagement: string;
  days_since_touchpoint: number;
  open_support_tickets: number;
  critical_tickets: number;
  days_to_renewal: number;
  renewal_urgency: string;
  health_score: number;
}

export interface AccountRiskSummary {
  id: string;
  name: string;
  domain?: string;
  arr: number;
  renewal_date: string;
  csm_owner: string;
  industry?: string;
  health_score?: number;
  tier?: string;
  status?: string;
  risk_level: RiskLevel;
  risk_score: number;
  urgency_days_to_renewal: number;
  urgency_label?: string;
  primary_reason_code: string;
  main_warning?: string;
  contributing_factors: string[];
}

export interface AccountDetail extends AccountRiskSummary {
  contacts: Contact[];
  signals: Signal[];
  customer_metrics?: CustomerMetrics;
}

export interface AccountRiskDetail {
  account_id: string;
  account_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  urgency_days_to_renewal: number;
  urgency_label: string;
  primary_reason_code: string;
  main_warning: string;
  contributing_factors: string[];
  rule_version: string;
  signals_count: number;
  arr: number;
  renewal_date: string;
}

export interface DashboardSummary {
  total_accounts_monitored: number;
  high_risk_accounts_count: number;
  renewals_due_soon_count: number;
  high_risk_arr: number;
  total_portfolio_arr: number;
  average_risk_score: number;
  rule_version: string;
}

export interface EvidenceRecord {
  id: string;
  account_id: string;
  source_category: 'crm' | 'email' | 'calendar' | 'usage' | 'support';
  title: string;
  summary: string;
  timestamp: string;
  metadata: Record<string, any>;
  raw_reference?: string;
}

export interface AutopsyFact {
  evidence_id: string;
  claim: string;
  source_category: string;
  timestamp: string;
}

export interface InvestigationFinding {
  claim: string;
  evidence_ids: string[];
  type?: string;
  severity?: string;
}

export interface RecommendedAction {
  type?: string;
  action_type?: string;
  title: string;
  reason: string;
  target_recipient?: string;
  suggested_payload?: Record<string, any>;
}

export interface Investigation {
  id: string;
  account_id: string;
  account_name: string;
  risk_summary: string;
  risk_score: number;
  risk_level: RiskLevel;
  primary_reason_code: string;
  findings: InvestigationFinding[];
  causal_explanation: string;
  uncertainties: string[];
  recommended_action: RecommendedAction;
  rule_version: string;
  created_at: string;
}

export interface AskAccountQuestionResponse {
  account_id: string;
  question: string;
  answer: string;
  cited_evidence_ids: string[];
  confidence: string;
  uncertainties: string[];
}

export interface RevenueRiskAutopsy {
  account_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  rule_version: string;
  facts: AutopsyFact[];
  interpretations: string[];
  unknowns: string[];
  suggested_action_type: string;
}

// Page 5: Next-Best-Action Copilot Types
export interface EmailDraftItem {
  recipient: string;
  recipient_name?: string;
  subject: string;
  body: string;
  reason: string;
  evidence_ids: string[];
}

export interface ProposedTask {
  id?: string;
  account_id: string;
  title: string;
  description: string;
  assigned_to: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  status?: string;
  evidence_ids: string[];
  created_at?: string;
}

export interface ProposedCRMUpdate {
  field_name: string;
  current_value: string;
  proposed_value: string;
  reason: string;
  evidence_ids: string[];
}

export interface DraftActionsResponse {
  account_id: string;
  account_name: string;
  investigation_id?: string;
  email_draft: EmailDraftItem;
  task_draft: ProposedTask;
  crm_update: ProposedCRMUpdate;
  created_at: string;
}

export interface CreateActionProposalRequest {
  account_id: string;
  action_type: 'csm_email' | 'task_create' | 'crm_update' | string;
  title: string;
  reason?: string;
  payload: Record<string, any>;
  evidence_ids?: string[];
  investigation_id?: string;
}

export interface PatchActionProposalRequest {
  title?: string;
  reason?: string;
  payload?: Record<string, any>;
  status?: ActionStatus;
}

export interface ActionProposal {
  id: string;
  account_id: string;
  action_type: string;
  title: string;
  reason?: string;
  investigation_id?: string;
  evidence_ids?: string[];
  payload: Record<string, any>;
  status: ActionStatus;
  version: number;
  content_hash: string;
  created_at: string;
  updated_at?: string;
  approved_by?: string;
  approved_at?: string;
  execution_result?: Record<string, any>;
}

export interface AuditLog {
  account_id: string;
  proposal_id?: string;
  event_type: string;
  actor: string;
  details: Record<string, any>;
  timestamp: string;
}

// Page 6: Trust & Approval Center Types
export interface EnrichedPendingApproval {
  id: string;
  account_id: string;
  customer_name: string;
  account_owner: string;
  risk_score: number;
  risk_level: RiskLevel;
  urgency_days_to_renewal: number;
  action_type: string;
  title: string;
  reason?: string;
  payload: Record<string, any>;
  evidence_ids: string[];
  status: ActionStatus;
  version: number;
  content_hash: string;
  created_at: string;
  updated_at?: string;
  approved_by?: string;
  approved_at?: string;
  execution_result?: Record<string, any>;
}

// Page 7: Settings & Integrations Types
export type IntegrationStatus = 'connected' | 'syncing' | 'degraded' | 'disconnected';
export type IntegrationMode = 'live' | 'simulated';

export interface IntegrationConnector {
  id: string;
  name: string;
  category: 'crm' | 'email' | 'calendar' | 'usage' | 'database' | string;
  provider: string;
  status: IntegrationStatus;
  mode: IntegrationMode;
  is_real_connector: boolean;
  endpoint_or_host?: string;
  last_sync_time: string;
  records_synced: number;
  data_freshness_status: 'fresh' | 'stale_warning' | 'delayed' | string;
  freshness_minutes: number;
  freshness_warning?: string | null;
  config_details?: Record<string, any>;
}

export interface SyncRunRecord {
  id: string;
  integration_id: string;
  provider: string;
  status: 'success' | 'in_progress' | 'failed' | string;
  records_ingested: number;
  records_updated: number;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
  mode: IntegrationMode;
  log_message: string;
}

export interface TriggerSyncResponse {
  integration_id: string;
  status: string;
  sync_run_id: string;
  message: string;
  last_sync_time: string;
  freshness_minutes: number;
}

// Feature 1: Action & Outcome Tracker Types
export type ActionExecutionStatus = 'pending' | 'approved' | 'executing' | 'executed' | 'failed';
export type WorkStatus = 'not started' | 'in progress' | 'completed';

export interface OutcomeRecord {
  outcome_id: string;
  action_tracker_id: string;
  notes: string;
  customer_response: string;
  commitments: string;
  next_steps: string;
  supporting_evidence_ids: string[];
  recorded_by: string;
  recorded_at: string;
  auto_captured: boolean;
  capture_source?: string | null;
}

export interface ActionTrackerItem {
  id: string;
  proposal_id?: string | null;
  account_id: string;
  account_name: string;
  action_type: string;
  title: string;
  description?: string | null;
  investigation_id?: string | null;
  evidence_ids: string[];
  recommendation_payload: Record<string, any>;
  action_status: ActionExecutionStatus;
  work_status: WorkStatus;
  assigned_to: string;
  execution_mode: string;
  execution_result?: Record<string, any> | null;
  outcome?: OutcomeRecord | null;
  auto_capture_available: boolean;
  auto_capture_preview?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CreateActionTrackerRequest {
  account_id: string;
  title: string;
  action_type: string;
  proposal_id?: string;
  description?: string;
  investigation_id?: string;
  evidence_ids?: string[];
  recommendation_payload?: Record<string, any>;
  action_status?: ActionExecutionStatus;
  work_status?: WorkStatus;
  assigned_to?: string;
}

export interface SaveOutcomeRequest {
  notes: string;
  customer_response: string;
  commitments: string;
  next_steps: string;
  recorded_by?: string;
  supporting_evidence_ids?: string[];
  auto_captured?: boolean;
  capture_source?: string;
}

export interface UpdateActionTrackerStatusRequest {
  action_status?: ActionExecutionStatus;
  work_status?: WorkStatus;
  assigned_to?: string;
}

// Feature 2: Customer Outcome Timeline Types
export type TimelineEventType =
  | 'signal'
  | 'recommendation'
  | 'approval'
  | 'action_executed'
  | 'customer_response'
  | 'outcome_captured'
  | 'risk_assessment'
  | 'meeting_note'
  | 'email_communication';

export interface OutstandingCommitment {
  commitment_id: string;
  account_id: string;
  title: string;
  owner: string;
  due_date?: string | null;
  status: 'open' | 'in_progress' | 'fulfilled' | string;
  source_event_id?: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  account_id: string;
  event_type: TimelineEventType;
  category: string;
  title: string;
  description: string;
  timestamp: string;
  author_or_actor: string;
  severity?: string | null;
  status?: string | null;
  metadata?: Record<string, any>;
  customer_response?: string | null;
  commitments?: string | null;
  next_steps?: string | null;
  risk_score_at_time?: number | null;
  risk_level_at_time?: string | null;
  original_recommendation?: Record<string, any> | null;
  evidence_ids?: string[];
}

export interface CustomerOutcomeTimelineResponse {
  account_id: string;
  account_name: string;
  csm_owner: string;
  arr: number;
  current_risk_score: number;
  current_risk_level: string;
  events: TimelineEvent[];
  outstanding_commitments: OutstandingCommitment[];
  summary: {
    total_events: number;
    signals_count: number;
    recommendations_count: number;
    actions_executed_count: number;
    outcomes_captured_count: number;
    outstanding_commitments_count: number;
    first_interaction?: string | null;
    latest_interaction?: string | null;
  };
}

// Feature 3: AI Outcome Analyzer Types
export interface SentimentEvidence {
  interpretation: string;
  sentiment_label: string;
  supporting_quote_or_evidence: string;
  confidence: number;
  is_interpretation_notice: string;
}

export interface AdoptionBlocker {
  blocker_title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  feature_or_area: string;
  evidence: string;
  workaround_exists: boolean;
}

export interface RenewalObjection {
  objection_type: string;
  description: string;
  direct_evidence: string;
  impact_level: string;
}

export interface CustomerCommitmentItem {
  commitment_text: string;
  responsible_party: string;
  agreed_timeline?: string | null;
  status: string;
}

export interface UnresolvedIssue {
  issue_title: string;
  description: string;
  recommended_follow_up: string;
  target_owner: string;
  urgency: string;
}

export interface OutcomeAnalysisRequest {
  account_id: string;
  source_type: 'meeting_note' | 'email_thread' | 'customer_feedback' | 'call_transcript' | string;
  title?: string;
  raw_text: string;
  meeting_date?: string;
  participants?: string;
  auto_ingest_as_evidence?: boolean;
}

export interface OutcomeAnalysisResult {
  id: string;
  account_id: string;
  account_name: string;
  source_type: string;
  title: string;
  raw_text: string;
  meeting_date?: string | null;
  participants?: string | null;
  analyzed_at: string;
  sentiment_analysis: SentimentEvidence;
  adoption_blockers: AdoptionBlocker[];
  renewal_objections: RenewalObjection[];
  commitments_and_next_steps: CustomerCommitmentItem[];
  unresolved_issues: UnresolvedIssue[];
  structured_investigation_brief: string;
  generated_signal_id?: string | null;
  rule_notice: string;
}
