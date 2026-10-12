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
  TriggerSyncResponse,
  OutcomeIntelligenceReport,
  HistoryAwareContext,
  FreePipelineStatus,
  OutboxRecord,
  DynamicReminder,
  CreateReminderRequest,
  DismissReminderRequest,
  ReminderEvaluationResult,
  RecurringProblem,
  RecurringProblemsReport,
  RetentionReminderFlowGraph,
  RetentionReminderFlowExecution,
  RunRetentionReminderFlowRequest,
  ApproveRetentionRecoveryRequest,
  PortfolioRetentionAutomationResult
} from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '';

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
  const base = API_BASE ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');
  const url = new URL(`${API_BASE}/api/accounts`, base);
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

export async function triggerAccountInvestigation(accountId: string): Promise<{
  status: string;
  account_id: string;
  investigation_id?: string;
  risk_score: number;
  classification: string;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/risk/trigger-investigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Failed to trigger investigation: ${res.statusText}`);
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

export async function runAccountAutopsy(accountId: string): Promise<RevenueRiskAutopsy> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/${accountId}/autopsy/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Failed to run autopsy: ${res.statusText}`);
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

// Feature 4: Outcome Intelligence API
export async function fetchOutcomeIntelligence(): Promise<OutcomeIntelligenceReport> {
  const res = await fetch(`${API_BASE}/api/tracker/intelligence`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch outcome intelligence: ${res.statusText}`);
  }
  return res.json();
}

// Feature 5: History-Aware Recommendation Context API
export async function fetchAccountHistoryContext(accountId: string): Promise<HistoryAwareContext> {
  const res = await fetch(`${API_BASE}/api/tracker/intelligence/account/${accountId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch account history context: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFreePipelineStatus(): Promise<FreePipelineStatus> {
  const res = await fetch(`${API_BASE}/api/integrations/pipelines/status`);
  if (!res.ok) throw new Error('Failed to fetch pipeline status');
  return res.json();
}

export async function configureFreeWebhook(webhookUrl: string): Promise<{ status: string; webhook_url: string; provider: string }> {
  const res = await fetch(`${API_BASE}/api/integrations/webhook/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl })
  });
  if (!res.ok) throw new Error('Failed to configure webhook');
  return res.json();
}

export async function testFreeWebhook(accountName?: string, accountId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/integrations/webhook/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_name: accountName, account_id: accountId })
  });
  if (!res.ok) throw new Error('Failed to test webhook');
  return res.json();
}

export async function fetchOutboxEvents(limit = 30): Promise<OutboxRecord[]> {
  const res = await fetch(`${API_BASE}/api/integrations/outbox?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch outbox events');
  return res.json();
}

export async function clearOutboxEvents(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/integrations/outbox/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear outbox');
  return res.json();
}

// Feature 1: Action & Outcome Tracker Client APIs
import type {
  ActionTrackerItem,
  SaveOutcomeRequest,
  UpdateActionTrackerStatusRequest
} from '../types/api';

export async function fetchTrackedActions(params?: {
  account_id?: string;
  action_status?: string;
  work_status?: string;
  has_outcome?: boolean;
}): Promise<ActionTrackerItem[]> {
  const query = new URLSearchParams();
  if (params?.account_id) query.append('account_id', params.account_id);
  if (params?.action_status) query.append('action_status', params.action_status);
  if (params?.work_status) query.append('work_status', params.work_status);
  if (params?.has_outcome !== undefined) query.append('has_outcome', String(params.has_outcome));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/tracker${qs}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch tracked actions: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTrackedActionById(itemId: string): Promise<ActionTrackerItem> {
  const res = await fetch(`${API_BASE}/api/tracker/${itemId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch tracked action ${itemId}: ${res.statusText}`);
  }
  return res.json();
}

export async function updateTrackedActionStatus(
  itemId: string,
  req: UpdateActionTrackerStatusRequest
): Promise<ActionTrackerItem> {
  const res = await fetch(`${API_BASE}/api/tracker/${itemId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update status: ${res.statusText}`);
  }
  return res.json();
}

export async function saveActionOutcome(
  itemId: string,
  req: SaveOutcomeRequest
): Promise<ActionTrackerItem> {
  const res = await fetch(`${API_BASE}/api/tracker/${itemId}/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to save outcome: ${res.statusText}`);
  }
  return res.json();
}

export async function autoCaptureActionOutcome(
  itemId: string,
  source?: string
): Promise<ActionTrackerItem> {
  const res = await fetch(`${API_BASE}/api/tracker/${itemId}/auto-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to auto-capture outcome: ${res.statusText}`);
  }
  return res.json();
}

export async function syncApprovedProposalsToTracker(): Promise<ActionTrackerItem[]> {
  const res = await fetch(`${API_BASE}/api/tracker/sync-approved`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to sync approved proposals: ${res.statusText}`);
  }
  return res.json();
}

// Task C: Post-Action Improvement Cycle API methods
import type {
  PostActionImprovementCycle,
  EvaluatePostActionCycleRequest,
  TriggerSecondaryReviewRequest
} from '../types/api';

export async function fetchPostActionCycle(actionId: string): Promise<PostActionImprovementCycle> {
  const res = await fetch(`${API_BASE}/api/tracker/${actionId}/cycle`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch post-action cycle: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluatePostActionCycle(
  actionId: string,
  req?: EvaluatePostActionCycleRequest
): Promise<PostActionImprovementCycle> {
  const res = await fetch(`${API_BASE}/api/tracker/${actionId}/evaluate-cycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: req ? JSON.stringify(req) : undefined
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to evaluate post-action cycle: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerSecondaryReview(
  actionId: string,
  req: TriggerSecondaryReviewRequest
): Promise<PostActionImprovementCycle> {
  const res = await fetch(`${API_BASE}/api/tracker/${actionId}/trigger-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to trigger secondary review: ${res.statusText}`);
  }
  return res.json();
}

// Feature 2: Customer Outcome Timeline Client API
import type { CustomerOutcomeTimelineResponse } from '../types/api';

export async function fetchCustomerOutcomeTimeline(
  accountId: string
): Promise<CustomerOutcomeTimelineResponse> {
  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/outcome-timeline`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch customer outcome timeline: ${res.statusText}`);
  }
  return res.json();
}

// Feature 3: AI Outcome Analyzer Client APIs
import type { OutcomeAnalysisRequest, OutcomeAnalysisResult } from '../types/api';

export async function analyzeOutcomeNotes(
  req: OutcomeAnalysisRequest
): Promise<OutcomeAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/outcome-analyzer/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to analyze notes: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOutcomeAnalysesForAccount(
  accountId: string
): Promise<OutcomeAnalysisResult[]> {
  const res = await fetch(`${API_BASE}/api/outcome-analyzer/account/${accountId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch analyses: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOutcomeAnalysisById(
  analysisId: string
): Promise<OutcomeAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/outcome-analyzer/${analysisId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch analysis ${analysisId}: ${res.statusText}`);
  }
  return res.json();
}

// ==========================================
// Feature: Feedback Form & Survey Client APIs
// ==========================================
import type {
  SurveyFormTemplate,
  FeedbackTriggerCheck,
  FeedbackSurveyDispatch,
  CreateFeedbackSurveyRequest,
  PublicSurveyFormData,
  FeedbackResponseSubmission,
  CustomerFeedbackRecord,
  BatchTriggerScanResult
} from '../types/api';

export async function fetchSurveyTemplates(): Promise<SurveyFormTemplate[]> {
  const res = await fetch(`${API_BASE}/api/feedback/templates`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch survey templates: ${res.statusText}`);
  }
  return res.json();
}

export async function checkFeedbackTriggerEligibility(
  accountId: string,
  forceIgnoreCooldown?: boolean
): Promise<FeedbackTriggerCheck> {
  const query = forceIgnoreCooldown ? '?force_ignore_cooldown=true' : '';
  const res = await fetch(`${API_BASE}/api/feedback/check-trigger/${accountId}${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to check trigger eligibility: ${res.statusText}`);
  }
  return res.json();
}

export async function scanPortfolioTriggers(
  forceIgnoreCooldown?: boolean
): Promise<BatchTriggerScanResult> {
  const query = forceIgnoreCooldown ? '?force_ignore_cooldown=true' : '';
  const res = await fetch(`${API_BASE}/api/feedback/scan-triggers${query}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to run portfolio trigger scan: ${res.statusText}`);
  }
  return res.json();
}

export async function dispatchFeedbackSurvey(req: CreateFeedbackSurveyRequest): Promise<FeedbackSurveyDispatch> {
  const res = await fetch(`${API_BASE}/api/feedback/surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to dispatch survey: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDispatchedSurveys(accountId?: string): Promise<FeedbackSurveyDispatch[]> {
  const url = new URL(`${API_BASE}/api/feedback/surveys`);
  if (accountId) url.searchParams.set('account_id', accountId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch surveys: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPublicSurveyForm(surveyCode: string): Promise<PublicSurveyFormData> {
  const res = await fetch(`${API_BASE}/api/feedback/form/${surveyCode}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load feedback form: ${res.statusText}`);
  }
  return res.json();
}

export async function submitCustomerFeedback(submission: FeedbackResponseSubmission): Promise<CustomerFeedbackRecord> {
  const res = await fetch(`${API_BASE}/api/feedback/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to submit feedback: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFeedbackResponses(accountId?: string): Promise<CustomerFeedbackRecord[]> {
  const url = new URL(`${API_BASE}/api/feedback/responses`);
  if (accountId) url.searchParams.set('account_id', accountId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch feedback responses: ${res.statusText}`);
  }
  return res.json();
}

// ==========================================
// 20-Node Interactive Feedback Flow APIs
// ==========================================
import type {
  FeedbackFlowGraph,
  FeedbackFlowExecution,
  RunFeedbackFlowRequest
} from '../types/api';

export async function fetchFeedbackFlowGraph(): Promise<FeedbackFlowGraph> {
  const res = await fetch(`${API_BASE}/api/feedback/flow/graph`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch feedback flow graph: ${res.statusText}`);
  }
  return res.json();
}

export async function runFeedbackFlow(req: RunFeedbackFlowRequest): Promise<FeedbackFlowExecution> {
  const res = await fetch(`${API_BASE}/api/feedback/flow/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to run feedback flow: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFeedbackFlowExecutions(accountId?: string): Promise<FeedbackFlowExecution[]> {
  const url = new URL(`${API_BASE}/api/feedback/flow/executions`);
  if (accountId) url.searchParams.set('account_id', accountId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch flow executions: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFeedbackFlowExecution(executionId: string): Promise<FeedbackFlowExecution> {
  const res = await fetch(`${API_BASE}/api/feedback/flow/executions/${executionId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch execution: ${res.statusText}`);
  }
  return res.json();
}

import type { PortfolioAutomationResult } from '../types/api';

export async function automatePortfolioFeedback(): Promise<PortfolioAutomationResult> {
  const res = await fetch(`${API_BASE}/api/feedback/flow/automate-portfolio`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to automate portfolio: ${res.statusText}`);
  }
  return res.json();
}

// ==========================================
// Member 2 Task A: Dynamic Signal Analysis API
// ==========================================

import type {
  AccountSignalAnalysisResult,
  SignalValidationReport,
  BatchSignalAnalysisSummary
} from '../types/api';

export async function fetchAccountSignalAnalysis(accountId: string): Promise<AccountSignalAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/signals/account/${accountId}/analysis`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch signal analysis: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccountSignalValidation(accountId: string): Promise<SignalValidationReport> {
  const res = await fetch(`${API_BASE}/api/signals/account/${accountId}/validation`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch signal validation: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPortfolioSignalAnalysis(): Promise<BatchSignalAnalysisSummary> {
  const res = await fetch(`${API_BASE}/api/signals/portfolio/analysis`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch portfolio signal analysis: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerAutomatedPortfolioScan(): Promise<BatchSignalAnalysisSummary> {
  const res = await fetch(`${API_BASE}/api/signals/portfolio/automated-scan`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to trigger automated scan: ${res.statusText}`);
  }
  return res.json();
}

// Task B: Dynamic Reminders API
export async function fetchReminders(params?: {
  account_id?: string;
  status?: string;
  reminder_type?: string;
  severity?: string;
}): Promise<DynamicReminder[]> {
  const base = API_BASE ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');
  const url = new URL(`${API_BASE}/api/reminders`, base);
  if (params) {
    if (params.account_id) url.searchParams.set('account_id', params.account_id);
    if (params.status && params.status !== 'all') url.searchParams.set('status', params.status);
    if (params.reminder_type && params.reminder_type !== 'all') url.searchParams.set('reminder_type', params.reminder_type);
    if (params.severity && params.severity !== 'all') url.searchParams.set('severity', params.severity);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch reminders: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateReminders(): Promise<ReminderEvaluationResult> {
  const res = await fetch(`${API_BASE}/api/reminders/evaluate`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to evaluate reminders: ${res.statusText}`);
  }
  return res.json();
}

export async function completeReminder(reminderId: string): Promise<DynamicReminder> {
  const res = await fetch(`${API_BASE}/api/reminders/${reminderId}/complete`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to complete reminder: ${res.statusText}`);
  }
  return res.json();
}

export async function dismissReminder(reminderId: string, reason?: string): Promise<DynamicReminder> {
  const res = await fetch(`${API_BASE}/api/reminders/${reminderId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Dismissed by user' } as DismissReminderRequest)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to dismiss reminder: ${res.statusText}`);
  }
  return res.json();
}

export async function createReminder(req: CreateReminderRequest): Promise<DynamicReminder> {
  const res = await fetch(`${API_BASE}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create reminder: ${res.statusText}`);
  }
  return res.json();
}

// Task D: Recurring Customer Problems API methods
export async function fetchRecurringProblemsReport(category?: string): Promise<RecurringProblemsReport> {
  const url = new URL(`${API_BASE}/api/recurring-problems`, window.location.origin);
  if (category && category !== 'all') {
    url.searchParams.set('category', category);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch recurring problems: ${res.statusText}`);
  }
  return res.json();
}

export async function refreshRecurringProblems(): Promise<RecurringProblemsReport> {
  const res = await fetch(`${API_BASE}/api/recurring-problems/refresh`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to refresh recurring problems: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRecurringProblemById(problemId: string): Promise<RecurringProblem> {
  const res = await fetch(`${API_BASE}/api/recurring-problems/${problemId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch problem detail: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRecurringProblemsForAccount(accountId: string): Promise<RecurringProblem[]> {
  const res = await fetch(`${API_BASE}/api/recurring-problems/account/${accountId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch problems for account: ${res.statusText}`);
  }
  return res.json();
}

// ==========================================
// Task E: Actionable Improvement Insights & Outcome Tracking APIs
// ==========================================
import type {
  ImprovementInsightsReport,
  ActionableImprovementInsight,
  ImplementImprovementRequest,
  EvaluateImprovementOutcomeRequest
} from '../types/api';

export async function fetchImprovementInsightsReport(
  category?: string,
  status?: string
): Promise<ImprovementInsightsReport> {
  const base = API_BASE ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');
  const url = new URL(`${API_BASE}/api/improvement-insights`, base);
  if (category && category !== 'all') {
    url.searchParams.set('category', category);
  }
  if (status && status !== 'all') {
    url.searchParams.set('status', status);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch improvement insights report: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchImprovementInsightById(insightId: string): Promise<ActionableImprovementInsight> {
  const res = await fetch(`${API_BASE}/api/improvement-insights/${insightId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch improvement insight: ${res.statusText}`);
  }
  return res.json();
}

export async function implementImprovementInsight(
  insightId: string,
  req: ImplementImprovementRequest
): Promise<ActionableImprovementInsight> {
  const res = await fetch(`${API_BASE}/api/improvement-insights/${insightId}/implement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to implement improvement insight: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateImprovementInsight(
  insightId: string,
  req?: EvaluateImprovementOutcomeRequest
): Promise<ActionableImprovementInsight> {
  const res = await fetch(`${API_BASE}/api/improvement-insights/${insightId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: req ? JSON.stringify(req) : undefined
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to evaluate improvement insight: ${res.statusText}`);
  }
  return res.json();
}

// ==========================================
// 37-Node Retention & Reminders Flow API Functions (remainder.md)
// ==========================================

export async function fetchRetentionReminderFlowGraph(): Promise<RetentionReminderFlowGraph> {
  const res = await fetch(`${API_BASE}/api/reminders/retention-flow/graph`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch retention reminder flow graph: ${res.statusText}`);
  }
  return res.json();
}

export async function runRetentionReminderFlow(req: RunRetentionReminderFlowRequest): Promise<RetentionReminderFlowExecution> {
  const res = await fetch(`${API_BASE}/api/reminders/retention-flow/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to run retention reminder flow: ${res.statusText}`);
  }
  return res.json();
}

export async function approveRetentionRecovery(req: ApproveRetentionRecoveryRequest): Promise<RetentionReminderFlowExecution> {
  const res = await fetch(`${API_BASE}/api/reminders/retention-flow/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to approve retention recovery: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRetentionFlowExecutions(accountId?: string): Promise<RetentionReminderFlowExecution[]> {
  const url = accountId
    ? `${API_BASE}/api/reminders/retention-flow/executions?account_id=${encodeURIComponent(accountId)}`
    : `${API_BASE}/api/reminders/retention-flow/executions`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch retention flow executions: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRetentionFlowExecutionById(executionId: string): Promise<RetentionReminderFlowExecution> {
  const res = await fetch(`${API_BASE}/api/reminders/retention-flow/executions/${executionId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch retention flow execution: ${res.statusText}`);
  }
  return res.json();
}

export async function runPortfolioRetentionAutomation(): Promise<PortfolioRetentionAutomationResult> {
  const res = await fetch(`${API_BASE}/api/reminders/retention-flow/portfolio-automation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to run portfolio retention automation: ${res.statusText}`);
  }
  return res.json();
}
