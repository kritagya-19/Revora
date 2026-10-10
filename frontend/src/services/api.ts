import type {
  AccountRiskSummary,
  AccountDetail,
  EvidenceRecord,
  RevenueRiskAutopsy,
  ActionProposal,
  AuditLog
} from '../types/api';

const API_BASE = 'http://localhost:8000';

export async function checkBackendHealth(): Promise<{ status: string; execution_mode: string; service: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchAccounts(): Promise<AccountRiskSummary[]> {
  const res = await fetch(`${API_BASE}/api/accounts`);
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountById(accountId: string): Promise<AccountDetail> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}`);
  if (!res.ok) throw new Error(`Failed to fetch account ${accountId}: ${res.statusText}`);
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
