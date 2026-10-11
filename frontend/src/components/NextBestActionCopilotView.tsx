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
  initialTab?: TabType;
}

type TabType = 'email' | 'task' | 'crm';

export function NextBestActionCopilotView({
  account,
  allAccounts,
  onSelectAccount,
  onBackToCustomer,
  onBackToRadar,
  onNavigateToApprovals,
  initialTab = 'email'
}: NextBestActionCopilotViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
      console.error('Error loading action drafts:', err);
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Failed to load action drafts'
      });
    } finally {
      setLoadingsFalse: setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    loadActionsAndProposals();
  }, [account.id]);

  // Handler: Save / Patch Draft
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
          const patched = await patchActionProposal(savedEmailProp.id, {
            title: emailSubject,
            reason: emailReason,
            payload: payload
          });
          setSavedEmailProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `Email proposal updated to v${patched.version} with content hash verification.`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'csm_email',
            title: emailSubject || `Outreach to ${account.name}`,
            reason: emailReason || 'Proactive churn remediation email',
            payload: payload,
            evidence_ids: draftData?.email_draft.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedEmailProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `Email draft proposal created (ID: ${created.id}). Ready for Approval Gate.`,
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
            message: `Follow-up task updated to v${patched.version}.`,
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
            message: `Task proposal registered in approval queue (ID: ${created.id}).`,
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
            message: `CRM update proposal patched (v${patched.version}).`,
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
      await handleSaveDraft(type);
      setFeedbackBanner({
        type: 'info',
        message: 'Action proposal submitted to the Human-Gated Approval Center. Ready for CSM review and hash-bound signoff.'
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Account Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 lg:p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-body flex-wrap">
          <button
            onClick={onBackToRadar}
            className="hover:text-[#020062] text-slate-600 transition-colors cursor-pointer font-medium"
          >
            Revenue Radar
          </button>
          <span className="text-slate-300">/</span>
          <button
            onClick={onBackToCustomer}
            className="hover:text-[#020062] text-slate-600 transition-colors cursor-pointer font-medium"
          >
            {account.name}
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-[#020062] font-semibold">Step 4 of 5: Next-Best-Action Copilot</span>
        </div>

        {/* Account Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">Switch Account:</span>
          <div className="relative">
            <select
              value={account.id}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 font-medium text-[#020062] focus:outline-none focus:border-[#2563EB] cursor-pointer"
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
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-xs relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#0025AE] border border-blue-200 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Next-Best-Action Copilot</span>
              <span className="text-slate-400">• Human-in-the-Loop Safe Action Gate</span>
            </div>
            <h1 className="font-headline text-3xl font-normal text-[#020062]">
              Action Proposals for {account.name}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed font-body">
              Once risk telemetry identifies churn probability, Revora prepares immediate, structured mitigation proposals.
              Every proposed outreach or CRM modification is grounded in verified evidence with cryptographic hash integrity, 
              guaranteeing zero unrestricted autonomous writes without human authorization.
            </p>
          </div>

          {/* Quick Context Pill */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-6 shrink-0">
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block mb-1">
                Primary Driver
              </span>
              <span className="text-sm font-bold text-[#020062] capitalize">
                {account.primary_reason_code.replace('_', ' ')}
              </span>
            </div>
            <div className="h-10 w-px bg-[#E2E8F0]" />
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block mb-1">
                Urgency
              </span>
              <span className="text-sm font-bold text-rose-700">
                {account.urgency_days_to_renewal} days to renewal
              </span>
            </div>
            <div className="h-10 w-px bg-[#E2E8F0]" />
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block mb-1">
                Account Owner
              </span>
              <span className="text-sm font-bold text-[#020062]">
                {account.csm_owner}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackBanner && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center justify-between gap-4 transition-all ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : feedbackBanner.type === 'info'
                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
              )}
              <div>
                <span className="font-semibold block">{feedbackBanner.message}</span>
                {feedbackBanner.hash && (
                  <span className="font-mono text-xs block text-slate-600 mt-1">
                    Proposal ID: <strong className="text-[#020062]">{feedbackBanner.proposalId}</strong> • Version: <strong>v{feedbackBanner.version}</strong> • Content Hash: <code className="bg-white px-2 py-0.5 rounded text-xs text-[#0025AE] font-mono border border-blue-200">{feedbackBanner.hash}</code>
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onNavigateToApprovals}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 font-semibold text-xs text-[#020062] border border-[#E2E8F0] shadow-xs cursor-pointer shrink-0"
            >
              <span>View in Approval Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Three Tabs Header */}
      <div className="flex border-b border-[#E2E8F0] gap-3">
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'email'
              ? 'border-[#2563EB] text-[#0025AE] bg-white shadow-xs'
              : 'border-transparent text-slate-600 hover:text-[#020062] hover:bg-slate-50'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Draft</span>
          {savedEmailProp && (
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-mono border border-emerald-200">
              v{savedEmailProp.version}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('task')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'task'
              ? 'border-[#2563EB] text-[#0025AE] bg-white shadow-xs'
              : 'border-transparent text-slate-600 hover:text-[#020062] hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Follow-up Task</span>
          {savedTaskProp && (
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-mono border border-emerald-200">
              v{savedTaskProp.version}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('crm')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'crm'
              ? 'border-[#2563EB] text-[#0025AE] bg-white shadow-xs'
              : 'border-transparent text-slate-600 hover:text-[#020062] hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>CRM Update</span>
          {savedCrmProp && (
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-mono border border-emerald-200">
              v{savedCrmProp.version}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Email Draft */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 lg:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-xl font-normal text-[#020062] flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#2563EB]" />
                Personalized Follow-up Email Draft
              </h2>
              <p className="text-sm text-slate-500 font-body mt-0.5">
                AI synthesized from verified account context and recent risk triggers. Edit directly before saving.
              </p>
            </div>

            {loadingDrafts && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Synthesizing from telemetry...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Recipient */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Recipient (Executive Sponsor or Primary Stakeholder)
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="recipient@customer.com"
                className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 font-mono text-[#020062] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Subject Line
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email Subject"
                className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 font-body font-medium text-[#020062] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          {/* Reason for Outreach */}
          <div className="p-4 bg-[#F0F5FF] border border-blue-200 rounded-xl space-y-1.5">
            <span className="text-xs font-semibold text-[#0025AE] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              Strategic Reason for Outreach:
            </span>
            <input
              type="text"
              value={emailReason}
              onChange={(e) => setEmailReason(e.target.value)}
              className="w-full text-sm bg-transparent border-0 font-body text-[#020062] focus:outline-none focus:ring-0 p-0"
            />
          </div>

          {/* Editable Email Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-400" />
                Editable Email Body
              </label>
              <span className="text-xs text-slate-500">
                You can freely edit the content; edits increment versioning safely.
              </span>
            </div>
            <textarea
              rows={10}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full text-sm font-body leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-slate-800 focus:border-[#2563EB] focus:outline-none transition-all font-mono"
            />
          </div>

          {/* Evidence References */}
          {draftData?.email_draft.evidence_ids && draftData.email_draft.evidence_ids.length > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-slate-500 flex-wrap">
              <span className="font-semibold text-slate-700">Grounded Evidence IDs:</span>
              {draftData.email_draft.evidence_ids.map((eid) => (
                <span
                  key={eid}
                  className="px-2.5 py-0.5 rounded-md bg-[#F0F5FF] font-mono text-xs text-[#0025AE] border border-blue-200"
                >
                  {eid}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-sm text-slate-500">
              State: <strong className="text-[#020062]">{savedEmailProp ? `Saved (v${savedEmailProp.version})` : 'Unsaved Draft'}</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('email')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-[#E2E8F0] cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-400" />
                <span>Save Draft</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('email')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-sm shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Submit for Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Follow-up Task */}
      {activeTab === 'task' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 lg:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-xl font-normal text-[#020062] flex items-center gap-2.5">
                <CheckSquare className="w-5 h-5 text-[#2563EB]" />
                Follow-up Operational Task
              </h2>
              <p className="text-sm text-slate-500 font-body mt-0.5">
                Structured operational task for the account owner to drive remediation through execution gates.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Task Title */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Task Title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
                className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 font-medium text-[#020062] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Task Description */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-400" />
                Task Description & Action Instructions
              </label>
              <textarea
                rows={4}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Details of the operational follow-up"
                className="w-full text-sm font-body leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-slate-800 focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Assigned Account Owner */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  Assigned Account Owner
                </label>
                <input
                  type="text"
                  value={taskAssignedTo}
                  onChange={(e) => setTaskAssignedTo(e.target.value)}
                  className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#020062] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#020062] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-400" />
                  Priority Level
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#020062] focus:border-[#2563EB] focus:outline-none cursor-pointer"
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
            <div className="flex items-center gap-2.5 text-sm text-slate-500 flex-wrap">
              <span className="font-semibold text-slate-700">Backing Evidence Signals:</span>
              {draftData.task_draft.evidence_ids.map((eid) => (
                <span
                  key={eid}
                  className="px-2.5 py-0.5 rounded-md bg-[#F0F5FF] font-mono text-xs text-[#0025AE] border border-blue-200"
                >
                  {eid}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Action Ledger: <code className="bg-[#F8FAFC] px-2 py-0.5 rounded text-xs text-slate-600 border border-[#E2E8F0]">task_create proposal</code>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('task')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-[#E2E8F0] cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-400" />
                <span>Save Proposed Task</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('task')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-sm shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Proposed Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CRM Update */}
      {activeTab === 'crm' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 lg:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-headline text-xl font-normal text-[#020062] flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#2563EB]" />
                Structured CRM Update Proposal
              </h2>
              <p className="text-sm text-slate-500 font-body mt-0.5">
                The AI prepares structured field modifications based on verified risk scores. Direct CRM writing is restricted.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Field Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Target CRM Field
              </label>
              <input
                type="text"
                value={crmFieldName}
                onChange={(e) => setCrmFieldName(e.target.value)}
                className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 font-mono text-[#020062] focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Current vs Proposed Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Current Value */}
              <div className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
                <span className="text-xs uppercase font-mono font-bold tracking-wider text-slate-500 block">
                  Current Field Value
                </span>
                <input
                  type="text"
                  value={crmCurrentValue}
                  onChange={(e) => setCrmCurrentValue(e.target.value)}
                  className="w-full text-sm bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-slate-800 font-medium focus:border-[#2563EB] focus:outline-none"
                />
                <span className="text-xs text-slate-500 block">
                  Synchronized from Salesforce / HubSpot CRM snapshot
                </span>
              </div>

              {/* Proposed Value */}
              <div className="p-5 bg-[#F0F5FF] border border-blue-200 rounded-xl space-y-2.5">
                <span className="text-xs uppercase font-mono font-bold tracking-wider text-[#0025AE] block">
                  Proposed Field Value
                </span>
                <input
                  type="text"
                  value={crmProposedValue}
                  onChange={(e) => setCrmProposedValue(e.target.value)}
                  className="w-full text-sm bg-white border border-blue-300 rounded-xl px-4 py-2 font-bold text-[#020062] focus:border-[#2563EB] focus:outline-none"
                />
                <span className="text-xs text-[#0025AE] block">
                  Calculated by deterministic risk rules and telemetry
                </span>
              </div>
            </div>

            {/* Reason for the Change */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-400" />
                Reason for the Change
              </label>
              <textarea
                rows={3}
                value={crmReason}
                onChange={(e) => setCrmReason(e.target.value)}
                placeholder="Strategic justification for updating CRM record"
                className="w-full text-sm font-body leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-slate-800 focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Evidence Supporting Proposal */}
            <div className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3">
              <span className="text-sm font-semibold text-slate-700 block">
                Evidence Supporting the Proposal
              </span>
              <div className="space-y-2">
                {account.signals.slice(0, 3).map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-[#E2E8F0]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-[#F0F5FF] text-[#0025AE] border border-blue-200">
                        {sig.id}
                      </span>
                      <span className="font-medium text-[#020062]">{sig.title}</span>
                      <span className="text-slate-500">— {sig.summary}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono uppercase">
                      {sig.source_category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Protection: <strong className="text-emerald-700">Direct write restricted • Requires gate signoff</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDraft('crm')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-[#E2E8F0] cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-400" />
                <span>Save Draft Proposal</span>
              </button>

              <button
                onClick={() => handleSubmitForApproval('crm')}
                disabled={savingState !== 'idle'}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-sm shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit for Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Gate Architecture Summary */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F0F5FF] text-[#2563EB] border border-blue-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#020062]">
              Human-in-the-Loop Safe Proposal Architecture
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
              Every proposal is keyed by SHA-256 hash. If any user edits the draft after proposal, the hash changes 
              and prior approvals are invalidated. Direct execution can only take place through the Approval Center.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToApprovals}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-sm font-semibold text-white shadow-xs shrink-0 cursor-pointer transition-colors"
        >
          <span>Open Approval Center</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default NextBestActionCopilotView;
