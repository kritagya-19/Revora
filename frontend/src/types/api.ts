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
  signal_type: string;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  timestamp: string;
  metadata?: Record<string, any>;
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
  primary_reason_code: string;
  contributing_factors: string[];
}

export interface AccountDetail extends AccountRiskSummary {
  contacts: Contact[];
  signals: Signal[];
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
