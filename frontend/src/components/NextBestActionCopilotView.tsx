import { useState, useEffect } from 'react';
import type {
  AccountDetail,
  AccountRiskSummary,
  DraftActionsResponse,
  ActionProposal
} from '../types/api';
import {
  draftAccountActions,
  createActionProposal,
  patchActionProposal,
  fetchProposalsForAccount
} from '../services/api';
import {
  Mail,
  CheckSquare,
  Database,
  Sparkles,
  ArrowRight,
  Send,
  Save,
  CheckCircle2,
  User,
  Calendar,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Edit3,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

interface NextBestActionCopilotViewProps {
  account: AccountDetail;
  allAccounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  onBackToCustomer: () => void;
  onBackToRadar: () => void;
  onNavigateToApprovals: () => void;
  currency?: 'USD' | 'INR';
}

type TabType = 'email' | 'task' | 'crm';

export function NextBestActionCopilotView({
  account,
  allAccounts,
  onSelectAccount,
  onBackToCustomer,
  onBackToRadar,
  onNavigateToApprovals
}: NextBestActionCopilotViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const [loadingDrafts, setLoadingDrafts] = useState<boolean>(true);
  const [draftData, setDraftData] = useState<DraftActionsResponse | null>(null);
  
  // Track saved proposals per category
  const [savedEmailProp, setSavedEmailProp] = useState<ActionProposal | null>(null);
  const [savedTaskProp, setSavedTaskProp] = useState<ActionProposal | null>(null);
  const [savedCrmProp, setSavedCrmProp] = useState<ActionProposal | null>(null);

  // Form states for Email Draft
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [emailReason, setEmailReason] = useState<string>('');

  // Form states for Task
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('high');

  // Form states for CRM Update
  const [crmFieldName, setCrmFieldName] = useState<string>('Account Risk Tier & Forecast Category');
  const [crmCurrentValue, setCrmCurrentValue] = useState<string>('');
  const [crmProposedValue, setCrmProposedValue] = useState<string>('');
  const [crmReason, setCrmReason] = useState<string>('');

  // UI state
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'submitting'>('idle');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
    proposalId?: string;
    version?: number;
    hash?: string;
  } | null>(null);

  // Load drafts and proposals whenever account changes
  const loadActionsAndProposals = async () => {
    try {
      setLoadingDrafts(true);
      setFeedbackBanner(null);

      const [draftsRes, existingProps] = await Promise.all([
        draftAccountActions(account.id),
        fetchProposalsForAccount(account.id).catch(() => [])
      ]);

      setDraftData(draftsRes);

      // Populate Email Tab
      setEmailRecipient(draftsRes.email_draft.recipient || '');
      setEmailSubject(draftsRes.email_draft.subject || '');
      setEmailBody(draftsRes.email_draft.body || '');
      setEmailReason(draftsRes.email_draft.reason || '');

      // Populate Task Tab
      setTaskTitle(draftsRes.task_draft.title || '');
      setTaskDescription(draftsRes.task_draft.description || '');
      setTaskAssignedTo(draftsRes.task_draft.assigned_to || account.csm_owner);
      setTaskDueDate(draftsRes.task_draft.due_date || account.renewal_date);
      setTaskPriority(draftsRes.task_draft.priority || 'high');

      // Populate CRM Tab
      setCrmFieldName(draftsRes.crm_update.field_name || 'Account Risk Tier');
      setCrmCurrentValue(draftsRes.crm_update.current_value || 'Healthy');
      setCrmProposedValue(draftsRes.crm_update.proposed_value || 'High Churn Risk');
      setCrmReason(draftsRes.crm_update.reason || '');

      // Find any already created proposals for this account
      const foundEmail = existingProps.find((p: ActionProposal) => p.action_type === 'csm_email' || p.action_type === 'csm_outreach_email');
      const foundTask = existingProps.find((p: ActionProposal) => p.action_type === 'task_create');
      const foundCrm = existingProps.find((p: ActionProposal) => p.action_type === 'crm_update');

      if (foundEmail) setSavedEmailProp(foundEmail);
      if (foundTask) setSavedTaskProp(foundTask);
      if (foundCrm) setSavedCrmProp(foundCrm);

    } catch (err: any) {
      console.error('Failed to load actions:', err);
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Error communicating with Next-Best-Action Copilot API'
      });
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    loadActionsAndProposals();
  }, [account.id]);

  // Handler: Save Draft (or PATCH if already exists)
  const handleSaveDraft = async (type: TabType) => {
    try {
      setSavingState('saving');
      setFeedbackBanner(null);

      if (type === 'email') {
        const payload = {
          recipient: emailRecipient,
          subject: emailSubject,
          body: emailBody,
          evidence_ids: draftData?.email_draft.evidence_ids || []
        };

        if (savedEmailProp) {
          // PATCH existing proposal
          const patched = await patchActionProposal(savedEmailProp.id, {
            title: emailSubject,
            reason: emailReason,
            payload: payload
          });
          setSavedEmailProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `Email draft updated in action_proposals table (v${patched.version}). Content hash re-keyed.`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          // POST /api/action-proposals
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'csm_email',
            title: emailSubject || `Renewal Check-in with ${account.name}`,
            reason: emailReason,
            payload: payload,
            evidence_ids: draftData?.email_draft.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedEmailProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `New email proposal created in action_proposals table (ID: ${created.id}).`,
            proposalId: created.id,
            version: created.version,
            hash: created.content_hash
          });
        }
      } else if (type === 'task') {
        const payload = {
          title: taskTitle,
          description: taskDescription,
          assigned_to: taskAssignedTo,
          due_date: taskDueDate,
          priority: taskPriority,
          evidence_ids: draftData?.task_draft.evidence_ids || []
        };

        if (savedTaskProp) {
          const patched = await patchActionProposal(savedTaskProp.id, {
            title: taskTitle,
            reason: taskDescription,
            payload: payload
          });
          setSavedTaskProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `Proposed task updated in action_proposals and tasks tables (v${patched.version}).`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'task_create',
            title: taskTitle,
            reason: taskDescription,
            payload: payload,
            evidence_ids: draftData?.task_draft.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedTaskProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `Proposed task created and stored in tasks table (ID: ${created.id}).`,
            proposalId: created.id,
            version: created.version,
            hash: created.content_hash
          });
        }
      } else if (type === 'crm') {
        const payload = {
          field_name: crmFieldName,
          current_value: crmCurrentValue,
          proposed_value: crmProposedValue,
          evidence_ids: draftData?.crm_update.evidence_ids || []
        };

        if (savedCrmProp) {
          const patched = await patchActionProposal(savedCrmProp.id, {
            title: `Update ${crmFieldName} for ${account.name}`,
            reason: crmReason,
            payload: payload
          });
          setSavedCrmProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `CRM update proposal patched in action_proposals table (v${patched.version}).`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'crm_update',
            title: `Update ${crmFieldName} for ${account.name}`,
            reason: crmReason,
            payload: payload,
            evidence_ids: draftData?.crm_update.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedCrmProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `Structured CRM update proposal created (ID: ${created.id}).`,
            proposalId: created.id,
            version: created.version,
            hash: created.content_hash
          });
        }
      }
    } catch (err: any) {
      console.error('Error saving proposal:', err);
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Failed to save action proposal'
      });
    } finally {
      setSavingState('idle');
    }
  };

  // Handler: Submit for Approval Gate
  const handleSubmitForApproval = async (type: TabType) => {
    try {
      setSavingState('submitting');
      // Ensure it is saved first
      await handleSaveDraft(type);
      setFeedbackBanner({
        type: 'info',
        message: 'Action Proposal submitted to the Human-Gated Approval Center. Ready for CSM review and hash-bound signoff.'
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Submission failed'
      });
    } finally {
      setSavingState('idle');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Account Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-body flex-wrap">
          <button
            onClick={onBackToRadar}
            className="hover:text-[#0025AE] transition-colors cursor-pointer font-medium"
          >
            Revenue Radar
          </button>
          <span>/</span>
          <button
            onClick={onBackToCustomer}
            className="hover:text-[#0025AE] transition-colors cursor-pointer font-medium"
          >
            {account.name}
          </button>
          <span>/</span>
          <span className="text-[#020062] font-bold">Page 5 — Next-Best-Action Copilot</span>
        </div>

        {/* Account Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 font-medium">Switch Account:</span>
          <div className="relative">
            <select
              value={account.id}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-1.5 font-medium text-[#020062] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
            >
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.risk_level.toUpperCase()} • Score: {a.risk_score})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 text-[#0025AE] border border-blue-100 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Next-Best-Action Copilot</span>
              <span className="text-slate-600">• Human-in-the-Loop Safe Action Gate</span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-[#020062]">
              Action Proposals for {account.name}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Once the AI identifies a problem, it helps you take immediate, structured action. The AI prepares 
              proposals grounded in verified account context and evidence references, without sending emails or 
              making unrestricted updates directly.
            </p>
          </div>

          {/* Quick Context Pill */}
          <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-6 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 block">
                Primary Driver
              </span>
              <span className="text-xs font-bold text-[#020062] capitalize">
                {account.primary_reason_code.replace('_', ' ')}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 block">
                Urgency
              </span>
              <span className="text-xs font-bold text-red-600">
                {account.urgency_days_to_renewal} days to renewal
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 block">
                Account Owner
              </span>
              <span className="text-xs font-bold text-slate-800">
                {account.csm_owner}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackBanner && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs flex items-center justify-between gap-4 transition-all ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : feedbackBanner.type === 'info'
                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
              )}
              <div>
                <span className="font-semibold">{feedbackBanner.message}</span>
                {feedbackBanner.hash && (
                  <span className="font-mono text-[11px] block text-slate-600 mt-0.5">
                    Proposal ID: <strong className="text-slate-800">{feedbackBanner.proposalId}</strong> • Version: <strong>v{feedbackBanner.version}</strong> • Content Hash: <code className="bg-white/80 px-1 py-0.5 rounded text-[10px]">{feedbackBanner.hash}</code>
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onNavigateToApprovals}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:border-slate-300 font-semibold text-xs text-[#020062] shadow-2xs hover:bg-slate-50 cursor-pointer shrink-0"
            >
              <span>View in Approval Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Three Tabs Header */}
      <div className="flex border-b border-[#E2E8F0] gap-2">
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === 'email'
              ? 'border-[#0025AE] text-[#0025AE] bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Draft</span>
          {savedEmailProp && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
              v{savedEmailProp.version}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('task')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === 'task'
              ? 'border-[#0025AE] text-[#0025AE] bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Follow-up Task</span>
          {savedTaskProp && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
              v{savedTaskProp.version}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('crm')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === 'crm'
              ? 'border-[#0025AE] text-[#0025AE] bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>CRM Update</span>
          {savedCrmProp && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
              v{savedCrmProp.version}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Email Draft */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-lg font-bold text-[#020062] flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#2563EB]" />
                Personalized Follow-up Email Draft
              </h2>
              <p className="text-xs text-slate-600 font-body">
                AI synthesized from verified account context and recent risk triggers. Edit directly before saving.
              </p>
            </div>

            {loadingDrafts && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                <span>Synthesizing from telemetry...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-600" />
                Recipient (Executive Sponsor or Primary Stakeholder)
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="recipient@customer.com"
                className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 font-mono text-[#020062] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Subject Line
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email Subject"
                className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 font-body font-medium text-[#020062] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Reason for Outreach */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
            <span className="text-[11px] font-semibold text-[#0025AE] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              Strategic Reason for Outreach:
            </span>
            <input
              type="text"
              value={emailReason}
              onChange={(e) => setEmailReason(e.target.value)}
              className="w-full text-xs bg-transparent border-0 font-body text-slate-700 focus:outline-none focus:ring-0 p-0"
            />
          </div>

          {/* Editable Email Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                Editable Email Body
              </label>
              <span className="text-[11px] text-slate-600">
                You can freely edit the content; edits increment versioning safely.
              </span>
            </div>
            <textarea
              rows={10}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full text-xs font-body leading-relaxed bg-slate-50/60 border border-[#E2E8F0] rounded-xl p-4 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all font-mono"
            />
          </div>

          {/* Evidence References */}
          {draftData?.email_draft.evidence_ids && draftData.email_draft.evidence_ids.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-700">Grounded Evidence IDs:</span>
              {draftData.email_draft.evidence_ids.map((eid) => (
                <span
                  key={eid}
                  className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700 border border-slate-200"
                >
                  {eid}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-xs text-slate-600">
              State: <strong className="text-slate-800">{savedEmailProp ? `Saved (v${savedEmailProp.version})` : 'Unsaved Draft'}</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('email')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#020062] font-semibold text-xs shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-slate-600" />
                <span>Save Draft</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('email')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Follow-up Task */}
      {activeTab === 'task' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-lg font-bold text-[#020062] flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#2563EB]" />
                Follow-up Operational Task
              </h2>
              <p className="text-xs text-slate-600 font-body">
                Structured operational task for the account owner to drive remediation through execution gates.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Task Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Task Title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
                className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 font-medium text-[#020062] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            {/* Task Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                Task Description & Action Instructions
              </label>
              <textarea
                rows={4}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Details of the operational follow-up"
                className="w-full text-xs font-body leading-relaxed bg-slate-50 border border-[#E2E8F0] rounded-xl p-3 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assigned Account Owner */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                  Assigned Account Owner
                </label>
                <input
                  type="text"
                  value={taskAssignedTo}
                  onChange={(e) => setTaskAssignedTo(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />
                  Priority Level
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>
          </div>

          {/* Evidence Citations */}
          {draftData?.task_draft.evidence_ids && draftData.task_draft.evidence_ids.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-700">Backing Evidence Signals:</span>
              {draftData.task_draft.evidence_ids.map((eid) => (
                <span
                  key={eid}
                  className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700 border border-slate-200"
                >
                  {eid}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-xs text-slate-600">
              Database Table: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">tasks</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">action_proposals</code>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('task')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#020062] font-semibold text-xs shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-slate-600" />
                <span>Save Proposed Task</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('task')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Create Proposed Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CRM Update */}
      {activeTab === 'crm' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-lg font-bold text-[#020062] flex items-center gap-2">
                <Database className="w-5 h-5 text-[#2563EB]" />
                Structured CRM Update Proposal
              </h2>
              <p className="text-xs text-slate-600 font-body">
                The AI prepares structured field modifications based on verified risk scores. Direct CRM writing is restricted.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Field Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Target CRM Field
              </label>
              <input
                type="text"
                value={crmFieldName}
                onChange={(e) => setCrmFieldName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg px-3 py-2 font-mono text-[#020062] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            {/* Current vs Proposed Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Value */}
              <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                  Current Field Value
                </span>
                <input
                  type="text"
                  value={crmCurrentValue}
                  onChange={(e) => setCrmCurrentValue(e.target.value)}
                  className="w-full text-xs bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
                <span className="text-[11px] text-slate-600 block">
                  Synchronized from Salesforce / HubSpot CRM snapshot
                </span>
              </div>

              {/* Proposed Value */}
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#0025AE] block">
                  Proposed Field Value
                </span>
                <input
                  type="text"
                  value={crmProposedValue}
                  onChange={(e) => setCrmProposedValue(e.target.value)}
                  className="w-full text-xs bg-white border border-blue-300 rounded-lg px-3 py-2 font-bold text-[#020062] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
                <span className="text-[11px] text-[#2563EB] block">
                  Calculated by deterministic risk rules and telemetry
                </span>
              </div>
            </div>

            {/* Reason for the Change */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
                Reason for the Change
              </label>
              <textarea
                rows={3}
                value={crmReason}
                onChange={(e) => setCrmReason(e.target.value)}
                placeholder="Strategic justification for updating CRM record"
                className="w-full text-xs font-body leading-relaxed bg-slate-50 border border-[#E2E8F0] rounded-xl p-3 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            {/* Evidence Supporting Proposal */}
            <div className="p-4 bg-slate-50/80 border border-[#E2E8F0] rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Evidence Supporting the Proposal
              </span>
              <div className="space-y-1.5">
                {account.signals.slice(0, 3).map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-[#E2E8F0]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                        {sig.id}
                      </span>
                      <span className="font-medium text-slate-800">{sig.title}</span>
                      <span className="text-slate-600 text-[11px]">— {sig.summary}</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-mono">
                      {sig.source_category.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-xs text-slate-600">
              Protection: <strong className="text-slate-800">Unrestricted CRM writes strictly disallowed</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('crm')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#020062] font-semibold text-xs shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-slate-600" />
                <span>Save Draft Proposal</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('crm')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Gate Architecture Summary */}
      <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0025AE]/10 text-[#0025AE] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#020062]">
              Human-in-the-Loop Safe Proposal Architecture
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Every proposal is keyed by SHA-256 hash. If any user edits the draft after proposal, the hash changes 
              and prior approvals are invalidated. Direct execution can only take place through the Approval Center.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToApprovals}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:border-slate-300 text-xs font-semibold text-[#020062] shadow-2xs shrink-0 cursor-pointer"
        >
          <span>Open Approval Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default NextBestActionCopilotView;
