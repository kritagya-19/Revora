import type {
  AccountRiskSummary,
  AccountDetail,
  AccountRiskDetail,
  DashboardSummary,
  Signal,
  EvidenceRecord,
  RevenueRiskAutopsy,
  Investigation,
  AskAccountQuestionResponse,
  ActionProposal,
  AuditLog
} from '../types/api';

const API_BASE = 'http://localhost:8000';

export async function checkBackendHealth(): Promise<{ status: string; execution_mode: string; service: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/api/dashboard/summary`);
  if (!res.ok) throw new Error(`Failed to fetch dashboard summary: ${res.statusText}`);
  return res.json();
}

export async function fetchAccounts(params?: {
  risk_level?: string;
  csm_owner?: string;
  renewal_within_days?: number;
  sort_by?: string;
  search?: string;
}): Promise<AccountRiskSummary[]> {
  const url = new URL(`${API_BASE}/api/accounts`);
  if (params) {
    if (params.risk_level && params.risk_level !== 'all') url.searchParams.set('risk_level', params.risk_level);
    if (params.csm_owner) url.searchParams.set('csm_owner', params.csm_owner);
    if (params.renewal_within_days !== undefined) url.searchParams.set('renewal_within_days', String(params.renewal_within_days));
    if (params.sort_by) url.searchParams.set('sort_by', params.sort_by);
    if (params.search) url.searchParams.set('search', params.search);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountById(accountId: string): Promise<AccountDetail> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}`);
  if (!res.ok) throw new Error(`Failed to fetch account ${accountId}: ${res.statusText}`);
  return res.json();
}

export async function fetchSignalById(signalId: string): Promise<Signal> {
  const res = await fetch(`${API_BASE}/api/signals/${signalId}`);
  if (!res.ok) throw new Error(`Failed to fetch signal ${signalId}: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountRisk(accountId: string): Promise<AccountRiskDetail> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/risk`);
  if (!res.ok) throw new Error(`Failed to fetch account risk: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountEvidence(accountId: string): Promise<EvidenceRecord[]> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/${accountId}/evidence`);
  if (!res.ok) throw new Error(`Failed to fetch evidence: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountAutopsy(accountId: string): Promise<RevenueRiskAutopsy> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/${accountId}/autopsy`);
  if (!res.ok) throw new Error(`Failed to fetch autopsy: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountProposals(accountId: string): Promise<ActionProposal[]> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/account/${accountId}`);
  if (!res.ok) throw new Error(`Failed to fetch proposals: ${res.statusText}`);
  return res.json();
}

export async function updateProposal(proposalId: string, title: string, payload: Record<string, any>): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${proposalId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, payload })
  });
  if (!res.ok) throw new Error(`Failed to update proposal: ${res.statusText}`);
  return res.json();
}

export async function approveProposal(proposalId: string, expectedHash: string, approver = 'CSM User'): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, expected_hash: expectedHash })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Approval failed: ${res.statusText}`);
  }
  return res.json();
}

export async function executeProposal(proposalId: string): Promise<{ proposal_id: string; status: string; execution: Record<string, any> }> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/${proposalId}/execute`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Execution blocked: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccountAudit(accountId: string): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/api/v1/proposals/audit/${accountId}`);
  if (!res.ok) throw new Error(`Failed to fetch audit log: ${res.statusText}`);
  return res.json();
}

// Page 4: Revenue Risk Autopsy & Investigation APIs
export async function fetchAccountInvestigation(accountId: string): Promise<Investigation> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/investigation`);
  if (!res.ok) throw new Error(`Failed to fetch account investigation: ${res.statusText}`);
  return res.json();
}

export async function runAccountInvestigation(accountId: string): Promise<Investigation> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/investigate`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to run investigation: ${res.statusText}`);
  return res.json();
}

export async function fetchInvestigationById(investigationId: string): Promise<Investigation> {
  const res = await fetch(`${API_BASE}/api/investigations/${investigationId}`);
  if (!res.ok) throw new Error(`Failed to fetch investigation ${investigationId}: ${res.statusText}`);
  return res.json();
}

export async function askAccountQuestion(accountId: string, question: string): Promise<AskAccountQuestionResponse> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to answer question: ${res.statusText}`);
  }
  return res.json();
}

