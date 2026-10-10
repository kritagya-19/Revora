export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type ActionStatus = 'proposed' | 'approved' | 'executing' | 'succeeded' | 'failed' | 'uncertain';

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

export interface ActionProposal {
  id: string;
  account_id: string;
  action_type: string;
  title: string;
  payload: Record<string, any>;
  status: ActionStatus;
  version: number;
  content_hash: string;
  created_at: string;
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
