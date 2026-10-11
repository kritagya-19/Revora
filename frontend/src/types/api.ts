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

export interface HistoryAwareContext {
  account_id: string;
  previous_actions_count: number;
  previous_actions: Array<{
    id?: string;
    title: string;
    action_type: string;
    work_status: string;
    action_status: string;
    assigned_to: string;
    created_at?: string;
    outcome_notes?: string;
    customer_response?: string;
    commitments?: string;
    next_steps?: string;
    recorded_at?: string;
  }>;
  similar_situations_from_other_accounts: Array<{
    account_name: string;
    action_type: string;
    action_title: string;
    situation: string;
    action_taken: string;
    customer_response: string;
    observed_result: string;
    success: boolean;
  }>;
  unresolved_commitments: Array<{
    action_id?: string;
    action_title?: string;
    commitment: string;
    next_steps?: string;
    recorded_at?: string;
    owner?: string;
  }>;
  days_since_last_followup?: number | null;
  preferable_to_repeating_reason: string;
  confidence_score: number;
  confidence_justification: string;
  historical_examples_supporting: number;
  supporting_evidence_ids: string[];
}

export interface DraftActionsResponse {
  account_id: string;
  account_name: string;
  investigation_id?: string;
  email_draft: EmailDraftItem;
  task_draft: ProposedTask;
  crm_update: ProposedCRMUpdate;
  history_aware_context?: HistoryAwareContext | null;
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

// Feature 4: Outcome Intelligence Types
export interface ActionTypeResponseStat {
  action_type: string;
  action_type_label: string;
  total_dispatched: number;
  responses_received: number;
  response_rate_pct: number;
  avg_response_hours: number;
  benchmark_verdict: 'High Impact' | 'Moderate' | 'Passive' | string;
}

export interface TimelinessMetric {
  total_completed: number;
  completed_on_time: number;
  on_time_rate_pct: number;
  overdue_count: number;
  avg_completion_days: number;
}

export interface CustomerBlocker {
  blocker_id: string;
  category: string;
  description: string;
  affected_accounts_count: number;
  affected_account_names: string[];
  unresolved: boolean;
  first_observed: string;
  last_touchpoint: string;
  severity: 'critical' | 'high' | 'medium' | string;
  recommended_remedy: string;
}

export interface ActionSignalAssociation {
  action_type: string;
  action_type_label: string;
  positive_subsequent_signals_count: number;
  neutral_or_no_change_count: number;
  negative_subsequent_signals_count: number;
  success_rate_pct: number;
  observed_impact_summary: string;
}

export interface LearnedPattern {
  pattern_id: string;
  title: string;
  condition: string;
  recommended_strategy: string;
  ineffective_strategy: string;
  historical_examples_count: number;
  success_confidence_pct: number;
  cited_account_ids: string[];
  empirical_evidence_summary: string;
}

export interface OutcomeIntelligenceReport {
  total_historical_actions: number;
  overall_response_rate_pct: number;
  on_time_completion_pct: number;
  unresolved_blockers_count: number;
  positive_outcome_pct: number;
  action_type_stats: ActionTypeResponseStat[];
  timeliness: TimelinessMetric;
  unresolved_blockers: CustomerBlocker[];
  action_signal_associations: ActionSignalAssociation[];
  learned_patterns: LearnedPattern[];
  generated_at: string;
}
