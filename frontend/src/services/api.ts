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
  AuditLog,
  DraftActionsResponse,
  CreateActionProposalRequest,
  PatchActionProposalRequest,
  EnrichedPendingApproval,
  IntegrationConnector,
  SyncRunRecord,
  TriggerSyncResponse
} from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';

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

export const fetchProposalsForAccount = fetchAccountProposals;

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

// Page 5: Next-Best-Action Copilot API endpoints
export async function draftAccountActions(accountId: string): Promise<DraftActionsResponse> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/actions/draft`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to draft actions: ${res.statusText}`);
  }
  return res.json();
}

export async function createActionProposal(req: CreateActionProposalRequest): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/api/action-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create action proposal: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchActionProposalById(proposalId: string): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/api/action-proposals/${proposalId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch proposal ${proposalId}: ${res.statusText}`);
  }
  return res.json();
}

export async function patchActionProposal(proposalId: string, req: PatchActionProposalRequest): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/api/action-proposals/${proposalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to patch proposal: ${res.statusText}`);
  }
  return res.json();
}

// Page 6: Trust & Approval Center APIs
export async function fetchPendingApprovals(status?: string): Promise<EnrichedPendingApproval[]> {
  const url = status ? `${API_BASE}/api/approvals?status=${encodeURIComponent(status)}` : `${API_BASE}/api/approvals`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch approvals: ${res.statusText}`);
  }
  return res.json();
}

export async function approvePendingProposal(
  proposalId: string,
  expectedHash?: string,
  approver = 'CSM Team',
  autoExecute = true
): Promise<{ proposal: ActionProposal; approval_status: string; reviewer: string; execution: Record<string, any> }> {
  const res = await fetch(`${API_BASE}/api/approvals/${proposalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approver,
      expected_hash: expectedHash,
      auto_execute: autoExecute
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Approval failed: ${res.statusText}`);
  }
  return res.json();
}

export async function rejectPendingProposal(
  proposalId: string,
  reason: string,
  reviewer = 'CSM Team'
): Promise<{ proposal: ActionProposal; approval_status: string; decision_reason: string; reviewer: string }> {
  const res = await fetch(`${API_BASE}/api/approvals/${proposalId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason,
      reviewer
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Rejection failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchGlobalAuditLogs(limit = 100): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/api/audit-logs?limit=${limit}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch audit logs: ${res.statusText}`);
  }
  return res.json();
}

// Page 7: Settings & Integrations APIs
export async function fetchIntegrations(): Promise<IntegrationConnector[]> {
  const res = await fetch(`${API_BASE}/api/integrations`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch integrations: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerIntegrationSync(integrationId: string): Promise<TriggerSyncResponse> {
  const res = await fetch(`${API_BASE}/api/integrations/${integrationId}/sync`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to trigger sync: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRecentSyncRuns(limit = 20): Promise<SyncRunRecord[]> {
  const res = await fetch(`${API_BASE}/api/integrations/sync-runs/recent?limit=${limit}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch sync runs: ${res.statusText}`);
  }
  return res.json();
}




