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

export interface FreePipelineStatus {
  webhook: {
    configured: boolean;
    url: string;
    provider: string;
    supports: string[];
  };
  smtp: {
    configured: boolean;
    host: string;
    port: number;
    sender: string;
    supports: string[];
  };
  outbox_count: number;
  free_tier_notice: string;
}

export interface OutboxRecord {
  id: string;
  timestamp: string;
  type?: string;
  event_type?: string;
  provider?: string;
  to_email?: string;
  to_name?: string;
  subject?: string;
  body_text?: string;
  html_body?: string;
  title?: string;
  description?: string;
  account_name?: string;
  status: string;
  status_code?: number;
  error?: string;
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

// ==========================================
// Feature: Feedback Form & Survey Loop Types
// ==========================================

export type SurveyDeliveryChannel = 'email' | 'in_app' | 'portal' | 'slack';
export type SurveyStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'expired' | 'cancelled';

export interface SurveyQuestion {
  id: string;
  question_type: 'rating_1_10' | 'rating_1_5' | 'multichoice' | 'text' | string;
  prompt: string;
  category: 'satisfaction' | 'product_usage' | 'blockers' | 'feature_requests' | string;
  options?: string[];
  required: boolean;
}

export interface SurveyFormTemplate {
  id: string;
  name: string;
  description: string;
  target_risk_level?: string | null;
  questions: SurveyQuestion[];
}

export interface TriggerAuditRecord {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  description: string;
  observed_value?: any;
  threshold?: any;
}

export interface FeedbackTriggerCheck {
  account_id: string;
  account_name?: string | null;
  eligible: boolean;
  risk_level: string;
  risk_score: number;
  matched_rules?: TriggerAuditRecord[];
  reasons: string[];
  cooldown_active: boolean;
  cooldown_days_remaining?: number;
  duplicate_pending_survey?: boolean;
  pending_survey_code?: string | null;
  last_survey_sent_at?: string | null;
  contact_preferences: {
    preferred_channel?: string;
    opt_in_surveys?: boolean;
    max_frequency_days?: number;
    primary_contact_available?: boolean;
    [key: string]: any;
  };
  recommended_template_id?: string | null;
  recommended_intro?: string | null;
}

export interface BatchTriggerScanResult {
  scanned_accounts_count: number;
  eligible_count: number;
  cooldown_prevented_count: number;
  duplicate_prevented_count: number;
  auto_triggered_surveys: FeedbackSurveyDispatch[];
  scan_timestamp: string;
}

export interface FeedbackSurveyDispatch {
  id: string;
  survey_code: string;
  account_id: string;
  account_name: string;
  contact_id?: string | null;
  recipient_email: string;
  recipient_name: string;
  delivery_channel: SurveyDeliveryChannel;
  template_id: string;
  status: SurveyStatus;
  created_at: string;
  sent_at?: string | null;
  completed_at?: string | null;
  trigger_risk_score?: number | null;
  trigger_risk_level?: string | null;
  trigger_factors?: string[];
  form_url: string;
  custom_intro?: string | null;
}

export interface FeedbackAnswer {
  question_id: string;
  category: string;
  prompt: string;
  answer_value: any;
}

export interface FeedbackResponseSubmission {
  survey_code: string;
  account_id?: string;
  respondent_email?: string;
  respondent_name?: string;
  satisfaction_score?: number;
  usage_trend_self_report?: string;
  primary_blocker?: string;
  unresolved_issues?: string;
  feature_improvement_request?: string;
  additional_comments?: string;
  answers?: FeedbackAnswer[];
  submitted_at?: string;
}

export interface FeedbackAnalysisSummary {
  id: string;
  response_id: string;
  account_id: string;
  account_name: string;
  classified_churn_reason: 'adoption_blocker' | 'pricing' | 'poor_onboarding' | 'champion_left' | 'technical_bugs' | 'feature_gap' | string;
  urgency_level: 'critical' | 'high' | 'medium' | 'low' | string;
  sentiment_label: 'frustrated' | 'at_risk' | 'neutral' | 'satisfied' | string;
  sentiment_interpretation: string;
  executive_summary?: string;
  key_blockers: string[];
  customer_concerns?: string[];
  improvement_requests: string[];
  uncertainties?: string[];
  recommended_retention_action: string;
  action_type: 'csm_intervention' | 'training_session' | 'executive_sponsor_call' | 'bug_escalation' | string;
  recommended_action_draft?: {
    recipient?: string;
    subject?: string;
    body_outline?: string;
    [key: string]: any;
  };
  evidence_connection: string[];
  confidence_score?: number;
  generated_signal_id?: string | null;
  analyzed_at: string;
  rule_notice: string;
}

export interface CustomerFeedbackRecord {
  id: string;
  survey_code: string;
  account_id: string;
  account_name: string;
  recipient_email: string;
  recipient_name: string;
  submission: FeedbackResponseSubmission;
  analysis?: FeedbackAnalysisSummary | null;
  created_at: string;
  submitted_at: string;
  timeline_event_id?: string | null;
}

export interface CreateFeedbackSurveyRequest {
  account_id: string;
  contact_id?: string;
  delivery_channel?: SurveyDeliveryChannel;
  template_id?: string;
  custom_intro?: string;
  recipient_email?: string;
  recipient_name?: string;
}

export interface PublicSurveyFormData {
  survey_code: string;
  account_id: string;
  account_name: string;
  recipient_name: string;
  recipient_email: string;
  status: SurveyStatus;
  custom_intro?: string;
  template: SurveyFormTemplate;
}

export type FeedbackFlowNodeType = 'source' | 'agent' | 'decision' | 'positive' | 'negative' | 'action';

export interface FeedbackFlowNode {
  id: string;
  title: string;
  subtitle: string;
  node_type: FeedbackFlowNodeType;
  category_class: string;
  day_label?: string | null;
  status?: string;
  summary?: string | null;
  output_payload?: Record<string, any> | null;
}

export interface FeedbackFlowEdge {
  from_node: string;
  to_node: string;
  label?: string | null;
}

export interface FeedbackFlowGraph {
  nodes: FeedbackFlowNode[];
  edges: FeedbackFlowEdge[];
}

export interface FeedbackFlowExecution {
  execution_id: string;
  account_id: string;
  account_name: string;
  scenario: string;
  path_taken: string[];
  current_node: string;
  node_states: Record<string, {
    title: string;
    subtitle?: string;
    status: string;
    day_label?: string;
    timestamp: string;
    decision?: string;
    data: Record<string, any>;
    summary: string;
  }>;
  status: 'running' | 'completed' | 'waiting';
  started_at: string;
  completed_at?: string | null;
  outcome_summary: string;
  sales_notified: boolean;
  manager_notified: boolean;
  crm_updated: boolean;
  healthy_marked: boolean;
}

export interface RunFeedbackFlowRequest {
  account_id: string;
  scenario?: 'auto' | 'healthy' | 'negative_day0' | 'reminder_negative' | 'unresponsive' | 'positive';
  custom_satisfaction_score?: number;
  custom_blocker?: string;
  custom_comments?: string;
}

export interface PortfolioAutomationResult {
  scanned_accounts: number;
  at_risk_detected: number;
  day0_surveys_dispatched: number;
  day2_reminders_sent: number;
  sales_escalations_triggered: number;
  healthy_monitored: number;
  webhooks_dispatched: number;
  emails_recorded: number;
  timestamp: string;
  automated_actions: Array<{
    account_id: string;
    account_name: string;
    action_taken: string;
    execution_id?: string;
    risk_score: number;
  }>;
}


