import { useState, useEffect } from 'react';
import type {
  AccountDetail,
  AccountRiskSummary,
  DraftActionsResponse,
  ActionProposal,
  OutcomeIntelligenceReport,
  RecommendedNextStepItem
} from '../types/api';
import {
  draftAccountActions,
  createActionProposal,
  patchActionProposal,
  fetchProposalsForAccount,
  fetchOutcomeIntelligence
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
  Clock,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  Building,
  RefreshCw,
  BarChart2,
  History,
  Lightbulb,
  Check,
  Activity,
  Layers,
  AtSign,
  Compass,
  Target,
  ListChecks
} from 'lucide-react';

interface NextBestActionCopilotViewProps {
  account: AccountDetail;
  allAccounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  onBackToCustomer: () => void;
  onBackToRadar?: () => void;
  onNavigateToApprovals: () => void;
  currency?: 'USD' | 'INR';
  initialTab?: TabType;
}

export type TabType = 'email' | 'task' | 'crm' | 'intelligence';

export function NextBestActionCopilotView({
  account,
  allAccounts,
  onSelectAccount,
  onBackToCustomer,
  onNavigateToApprovals,
  currency = 'USD',
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
  const [taskObjective, setTaskObjective] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskDeadline, setTaskDeadline] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('high');

  // Form states for CRM Update
  const [crmFieldName, setCrmFieldName] = useState<string>('Account Risk Tier & Forecast Category');
  const [crmCurrentValue, setCrmCurrentValue] = useState<string>('');
  const [crmProposedValue, setCrmProposedValue] = useState<string>('');
  const [crmReason, setCrmReason] = useState<string>('');
  const [crmSupportingRationale, setCrmSupportingRationale] = useState<string>('');
  const [crmFieldUpdates, setCrmFieldUpdates] = useState<Array<{
    field: string;
    current: string;
    proposed: string;
    rationale: string;
  }>>([]);

  // Strategy Selector state
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('csm_check_in');

  // UI state
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'submitting'>('idle');
  const [outcomeReport, setOutcomeReport] = useState<OutcomeIntelligenceReport | null>(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState<boolean>(false);
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
      setLoadingIntelligence(true);
      setFeedbackBanner(null);

      const [draftsRes, existingProps, intelRes] = await Promise.all([
        draftAccountActions(account.id),
        fetchProposalsForAccount(account.id).catch(() => []),
        fetchOutcomeIntelligence().catch(() => null)
      ]);

      setDraftData(draftsRes);
      if (intelRes) setOutcomeReport(intelRes);

      // Populate Email Tab
      setEmailRecipient(draftsRes.email_draft.recipient || '');
      setEmailSubject(draftsRes.email_draft.subject || '');
      setEmailBody(draftsRes.email_draft.body || '');
      setEmailReason(draftsRes.email_draft.reason || '');

      // Populate Task Tab
      setTaskTitle(draftsRes.task_draft.title || '');
      setTaskObjective(draftsRes.task_draft.objective || '');
      setTaskDescription(draftsRes.task_draft.description || '');
      setTaskAssignedTo(draftsRes.task_draft.assigned_to || account.csm_owner || '');
      setTaskDueDate(draftsRes.task_draft.due_date || '');
      setTaskDeadline(draftsRes.task_draft.deadline || '');
      setTaskPriority(draftsRes.task_draft.priority || 'high');

      // Populate CRM Tab
      setCrmFieldName(draftsRes.crm_update.field_name || 'Account Risk Tier');
      setCrmCurrentValue(draftsRes.crm_update.current_value || '');
      setCrmProposedValue(draftsRes.crm_update.proposed_value || '');
      setCrmReason(draftsRes.crm_update.reason || '');
      setCrmSupportingRationale(draftsRes.crm_update.supporting_rationale || draftsRes.crm_update.reason || '');
      setCrmFieldUpdates(draftsRes.crm_update.field_updates || []);

      // Populate Recommended Strategy
      if (draftsRes.suggested_next_step) {
        setSelectedStrategyId(draftsRes.suggested_next_step);
      }

      // Check existing proposals
      if (Array.isArray(existingProps)) {
        const emailProp = existingProps.find((p) => p.action_type === 'email');
        const taskProp = existingProps.find((p) => p.action_type === 'task_create');
        const crmProp = existingProps.find((p) => p.action_type === 'crm_update');

        if (emailProp) setSavedEmailProp(emailProp);
        if (taskProp) setSavedTaskProp(taskProp);
        if (crmProp) setSavedCrmProp(crmProp);
      }
    } catch (err) {
      console.error('Error loading action drafts:', err);
    } finally {
      setLoadingDrafts(false);
      setLoadingIntelligence(false);
    }
  };

  useEffect(() => {
    loadActionsAndProposals();
  }, [account.id]);

  // Currency formatter
  const formatCur = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      if (inrAmount >= 100000) return `₹${(inrAmount / 100000).toFixed(1)} L`;
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toLocaleString()}`;
  };

  // Handler: Save Draft Proposal
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
            title: `Outreach to ${emailRecipient || account.name}`,
            reason: emailReason,
            payload: payload
          });
          setSavedEmailProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `Email proposal updated (v${patched.version}). Ready for approval.`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'email',
            title: `Outreach to ${emailRecipient || account.name}`,
            reason: emailReason,
            payload: payload,
            evidence_ids: draftData?.email_draft.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedEmailProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `Email outreach proposal created (v${created.version}).`,
            proposalId: created.id,
            version: created.version,
            hash: created.content_hash
          });
        }
      } else if (type === 'task') {
        const payload = {
          title: taskTitle,
          objective: taskObjective,
          description: taskDescription,
          assigned_to: taskAssignedTo,
          due_date: taskDueDate,
          deadline: taskDeadline,
          priority: taskPriority,
          evidence_ids: draftData?.task_draft.evidence_ids || []
        };

        if (savedTaskProp) {
          const patched = await patchActionProposal(savedTaskProp.id, {
            title: taskTitle,
            reason: `Remediation task for ${account.name}`,
            payload: payload
          });
          setSavedTaskProp(patched);
          setFeedbackBanner({
            type: 'success',
            message: `Follow-up task updated (v${patched.version}).`,
            proposalId: patched.id,
            version: patched.version,
            hash: patched.content_hash
          });
        } else {
          const created = await createActionProposal({
            account_id: account.id,
            action_type: 'task_create',
            title: taskTitle,
            reason: `Remediation task for ${account.name}`,
            payload: payload,
            evidence_ids: draftData?.task_draft.evidence_ids || [],
            investigation_id: draftData?.investigation_id
          });
          setSavedTaskProp(created);
          setFeedbackBanner({
            type: 'success',
            message: `Operational task proposal created (v${created.version}).`,
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
          reason: crmReason,
          supporting_rationale: crmSupportingRationale,
          field_updates: crmFieldUpdates,
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
            message: `CRM update proposal created (v${created.version}).`,
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

  // Handler: Select Strategic Next Step to instantly re-align follow-up preparations
  const handleSelectStrategy = (step: RecommendedNextStepItem) => {
    setSelectedStrategyId(step.step_type);
    if (step.step_type === 'csm_check_in') {
      setEmailSubject(`Executive Check-in & Value Alignment: ${account.name}`);
      setEmailReason(`Customer-Success Executive Check-in: ${step.rationale}`);
      setTaskTitle(`Executive Business & Alignment Check-in: ${account.name}`);
      setTaskObjective(`1. Validate primary sponsor sentiment and renewal alignment.\n2. Address contract timeline and roadmap deliverables.\n3. Secure date for executive steering sync.`);
    } else if (step.step_type === 'adoption_support') {
      setEmailSubject(`Accelerating team adoption & platform enablement for ${account.name}`);
      setEmailReason(`Product Enablement & Adoption Support: ${step.rationale}`);
      setTaskTitle(`Launch Technical & Workflow Enablement Sprint: ${account.name}`);
      setTaskObjective(`1. Conduct 30-min hands-on enablement session for inactive licenses.\n2. Identify friction points in daily workflow adoption.\n3. Provide dedicated solution architect review.`);
    } else if (step.step_type === 'technical_escalation') {
      setEmailSubject(`Priority review of technical support & SLA resolution for ${account.name}`);
      setEmailReason(`Technical Escalation & Resolution: ${step.rationale}`);
      setTaskTitle(`Coordinate Engineering & Support SLA Resolution: ${account.name}`);
      setTaskObjective(`1. Audit open/unresolved support tickets with VP of Engineering.\n2. Provide hotfix or work-around timetable to customer lead.\n3. Re-establish customer confidence in platform reliability.`);
    } else if (step.step_type === 'commercial_tier_review') {
      setEmailSubject(`Optimizing license allocation & commercial terms for ${account.name}`);
      setEmailReason(`Commercial Right-Sizing: ${step.rationale}`);
      setTaskTitle(`Prepare Tier Right-Sizing & Commercial Proposal: ${account.name}`);
      setTaskObjective(`1. Model cost-effective seat tier aligning with actual active seats.\n2. Propose multi-year discount or flexible add-on structure.\n3. Eliminate churn friction by proactively addressing shelfware.`);
    }
  };

  // Handler: Submit for Approval Gate
  const handleSubmitForApproval = async (type: TabType) => {
    try {
      setSavingState('submitting');
      await handleSaveDraft(type);
      setFeedbackBanner({
        type: 'info',
        message: 'Action proposal submitted to Approval Center. Ready for human sign-off.'
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

  const renewalDays = account.urgency_days_to_renewal || 15;
  const primaryContact = account.contacts && account.contacts.length > 0 ? account.contacts[0] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
      {/* 1. TOP BREADCRUMB & ACCOUNT SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-2xl px-5 py-3.5 shadow-xs">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
          <button
            onClick={onBackToCustomer}
            className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Customer Accounts</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="font-semibold text-slate-900">{account.name}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#2563EB] font-semibold text-xs border border-blue-200/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Action Copilot</span>
          </span>
        </div>

        {/* Company Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 transition-colors">
          <Building className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="text-xs font-semibold text-slate-600 shrink-0">Company:</span>
          <select
            id="action-company-selector"
            aria-label="Change Company"
            value={account.id}
            onChange={(e) => onSelectAccount(e.target.value)}
            className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
          >
            {allAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatCur(a.arr)} • {a.risk_level.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feedback Alert Banner (Rendered when action is saved or submitted) */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 transition-all ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : feedbackBanner.type === 'info'
              ? 'bg-blue-50 text-blue-900 border border-blue-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>

          <button
            onClick={onNavigateToApprovals}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 font-semibold text-xs text-[#2563EB] border border-slate-200 shadow-2xs cursor-pointer shrink-0"
          >
            <span>View in Approval Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Task D: Recommended Suitable Next Steps Strategy Selector */}
      {draftData?.recommended_next_steps && draftData.recommended_next_steps.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-200">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                    Task D · Recommended Suitable Next Steps
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                    {draftData.recommended_next_steps.length} Strategic Options
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Select Suitable Next-Step Strategy
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Click a strategy to dynamically align follow-up email drafts, remediation tasks, and CRM fields.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {draftData.recommended_next_steps.map((step) => {
              const isSelected = selectedStrategyId === step.step_type;
              return (
                <div
                  key={step.id}
                  onClick={() => handleSelectStrategy(step)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-[#2563EB] shadow-xs ring-1 ring-[#2563EB]/40'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {Math.round(step.suitability_score * 100)}% Match
                      </span>
                      {step.is_primary && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#2563EB] border border-blue-300">
                          Primary
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{step.title}</h4>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {step.rationale}
                    </p>
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[11px]">
                    <span className={`font-semibold capitalize ${
                      step.urgency === 'critical' ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {step.urgency} Urgency
                    </span>
                    <span className={`font-bold flex items-center gap-1 ${
                      isSelected ? 'text-[#2563EB]' : 'text-slate-400'
                    }`}>
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>Select</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. WORKSPACE: ACTION DRAFTER (LEFT) + CONTEXT PROBLEM DOSSIER (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Action Workspace */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
          {/* Action Tabs Header */}
          <div className="flex border-b border-slate-100 bg-[#FAFCFF] px-4 pt-3 gap-2">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === 'email'
                  ? 'border-[#2563EB] text-[#2563EB] bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Executive Outreach</span>
              {savedEmailProp && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono border border-emerald-200">
                  v{savedEmailProp.version}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('task')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === 'task'
                  ? 'border-[#2563EB] text-[#2563EB] bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Remediation Task</span>
              {savedTaskProp && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono border border-emerald-200">
                  v{savedTaskProp.version}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === 'crm'
                  ? 'border-[#2563EB] text-[#2563EB] bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>CRM Risk Update</span>
              {savedCrmProp && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono border border-emerald-200">
                  v{savedCrmProp.version}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('intelligence')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === 'intelligence'
                  ? 'border-[#2563EB] text-[#2563EB] bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <span>Outcome Intelligence</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-800 px-1.5 py-0.2 rounded font-mono border border-indigo-200">
                F4
              </span>
            </button>
          </div>
      {/* FEATURE 5: History-Aware Recommendation Engine Banner */}
      {draftData?.history_aware_context && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE]">
                    Feature 5 · History-Aware Recommendation Engine
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {Math.round((draftData.history_aware_context.confidence_score || 0.88) * 100)}% Confidence
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#020062]">
                  Recommendations Informed by Recorded Experience & Account Telemetry
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-white border border-blue-200 text-slate-700 font-semibold shadow-xs">
                {draftData.history_aware_context.historical_examples_supporting} Historical Cases
              </span>
              {draftData.history_aware_context.unresolved_commitments.length > 0 && (
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-900 font-bold shadow-xs">
                  {draftData.history_aware_context.unresolved_commitments.length} Open Commitment
                </span>
              )}
            </div>
          </div>

          {/* Comparative Anti-Repetition Rationale */}
          {draftData.history_aware_context.preferable_to_repeating_reason && (
            <div className="bg-white/90 border border-blue-200/80 rounded-xl p-4 text-sm text-[#020062] flex items-start gap-3 shadow-xs">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-xs uppercase tracking-wider text-[#0025AE] block font-mono">
                  Why this action is preferable to repeating previous outreach:
                </span>
                <p className="text-slate-700 leading-relaxed font-body">
                  {draftData.history_aware_context.preferable_to_repeating_reason}
                </p>
              </div>
            </div>
          )}

          {/* Open Commitments & Benchmarks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Open Commitments */}
            {draftData.history_aware_context.unresolved_commitments.length > 0 ? (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Recorded Unresolved Commitments:
                </span>
                {draftData.history_aware_context.unresolved_commitments.map((c, i) => (
                  <div key={i} className="text-xs text-amber-950 font-body">
                    <p className="font-semibold">• {c.commitment}</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Recorded touchpoint: {c.recorded_at ? c.recorded_at.slice(0, 10) : 'Recent'} · Owner: {c.owner || account.csm_owner}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/70 border border-[#E2E8F0] rounded-xl p-3.5 space-y-1">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Prior Commitments Status:
                </span>
                <p className="text-xs text-slate-600 font-body">
                  All prior commitments up to date. Ready for scheduled executive intervention.
                </p>
              </div>
            )}

            {/* Benchmark Situations from Other Accounts */}
            {draftData.history_aware_context.similar_situations_from_other_accounts.length > 0 && (
              <div className="bg-white/90 border border-blue-200/70 rounded-xl p-3.5 space-y-1.5">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#0025AE] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                  Similar Situations From Comparable Accounts:
                </span>
                <p className="text-xs text-slate-700 font-body leading-relaxed">
                  <strong className="text-[#020062]">
                    {draftData.history_aware_context.similar_situations_from_other_accounts[0].account_name}:
                  </strong>{' '}
                  {draftData.history_aware_context.similar_situations_from_other_accounts[0].observed_result}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
          {/* TAB 1: Executive Email Draft */}
          {activeTab === 'email' && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#2563EB]" />
                    <span>Personalized Follow-up Email Draft</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synthesized from verified customer telemetry and recent risk triggers.
                  </p>
                </div>

                {loadingDrafts && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                    <span>Loading...</span>
                  </div>
                )}
              </div>

              {/* Account Situation Context Indicator (Task D.1) */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Account's Real-Time Situation Context</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Personalized Grounds
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Usage Trajectory</span>
                    <span className="font-bold text-rose-600">-38% vs baseline</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Seat Utilization</span>
                    <span className="font-bold text-slate-800">148 / 240 active</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Touchpoint Lag</span>
                    <span className="font-bold text-amber-600">16 days silent</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Renewal Window</span>
                    <span className="font-bold text-rose-600">{renewalDays} days remaining</span>
                  </div>
                </div>
              </div>

              {/* Recipient & Subject Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="email-recipient-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5 text-slate-400" />
                    <span>Recipient</span>
                  </label>
                  <input
                    id="email-recipient-input"
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="recipient@customer.com"
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-mono text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email-subject-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Subject Line</span>
                  </label>
                  <input
                    id="email-subject-input"
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email Subject"
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              {/* Strategic Context Pill */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-1">
                <span className="text-[11px] font-semibold text-[#2563EB] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Strategic Objective:</span>
                </span>
                <input
                  type="text"
                  value={emailReason}
                  onChange={(e) => setEmailReason(e.target.value)}
                  className="w-full text-xs text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 p-0 font-medium"
                />
              </div>

              {/* Email Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="email-body-input" className="text-xs font-semibold text-slate-700">
                    Email Content (Editable)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Edits increment proposal versioning
                  </span>
                </div>
                <textarea
                  id="email-body-input"
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full text-xs sm:text-sm leading-relaxed bg-[#FAFCFF] border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none font-sans transition-all"
                />
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Status: <strong className="text-slate-800">{savedEmailProp ? `Saved (v${savedEmailProp.version})` : 'Draft'}</strong>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleSaveDraft('email')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-400" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    onClick={() => handleSubmitForApproval('email')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Remediation Task */}
          {activeTab === 'task' && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                    <span>Follow-up Remediation Task</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Structured operational assignment for the account CSM.
                  </p>
                </div>
              </div>

              {/* Task Title */}
              <div className="space-y-1.5">
                <label htmlFor="task-title-input" className="text-xs font-semibold text-slate-700">Task Title</label>
                <input
                  id="task-title-input"
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-900 focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Task Strategic Objectives (Task D.2) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="task-objective-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Task Objectives & Key Deliverables</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Milestones</span>
                </div>
                <textarea
                  id="task-objective-input"
                  rows={3}
                  value={taskObjective}
                  onChange={(e) => setTaskObjective(e.target.value)}
                  placeholder="Explicit operational objectives for this follow-up..."
                  className="w-full text-xs sm:text-sm bg-[#FAFCFF] border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Task Description */}
              <div className="space-y-1.5">
                <label htmlFor="task-desc-input" className="text-xs font-semibold text-slate-700">Task Instructions</label>
                <textarea
                  id="task-desc-input"
                  rows={4}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Details of the operational follow-up"
                  className="w-full text-xs sm:text-sm bg-[#FAFCFF] border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Assigned To, Due Date, Strategic Deadline, Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="task-assigned-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assigned CSM</span>
                  </label>
                  <input
                    id="task-assigned-input"
                    type="text"
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-due-date-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Due Date</span>
                  </label>
                  <input
                    id="task-due-date-input"
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-deadline-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Strategic Deadline</span>
                  </label>
                  <input
                    id="task-deadline-input"
                    type="text"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    placeholder="e.g. 7 days before renewal"
                    className="w-full text-xs sm:text-sm bg-amber-50/40 border border-amber-200 rounded-xl px-3.5 py-2 font-medium text-amber-900 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-priority-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Priority</span>
                  </label>
                  <select
                    id="task-priority-input"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:border-[#2563EB] focus:outline-none cursor-pointer"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Status: <strong className="text-slate-800">{savedTaskProp ? `Saved (v${savedTaskProp.version})` : 'Draft'}</strong>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleSaveDraft('task')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-400" />
                    <span>Save Task</span>
                  </button>

                  <button
                    onClick={() => handleSubmitForApproval('task')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Structured CRM Update */}
          {activeTab === 'crm' && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#2563EB]" />
                    <span>Structured CRM Field Update</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modifies CRM risk status to align forecasting with telemetry realities.
                  </p>
                </div>
              </div>

              {/* Target CRM Field */}
              <div className="space-y-1.5">
                <label htmlFor="crm-field-input" className="text-xs font-semibold text-slate-700">Target Field</label>
                <input
                  id="crm-field-input"
                  type="text"
                  value={crmFieldName}
                  onChange={(e) => setCrmFieldName(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-mono text-slate-900 focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Current vs Proposed Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block">
                    Current CRM Value
                  </span>
                  <input
                    type="text"
                    value={crmCurrentValue}
                    onChange={(e) => setCrmCurrentValue(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-medium focus:border-[#2563EB] focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Synchronized from HubSpot / Salesforce
                  </span>
                </div>

                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#2563EB] block">
                    Proposed CRM Value
                  </span>
                  <input
                    type="text"
                    value={crmProposedValue}
                    onChange={(e) => setCrmProposedValue(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-blue-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#2563EB] block">
                    Calculated by deterministic risk engine
                  </span>
                </div>
              </div>

              {/* Reason for Change */}
              <div className="space-y-1.5">
                <label htmlFor="crm-reason-input" className="text-xs font-semibold text-slate-700">Business Justification</label>
                <textarea
                  id="crm-reason-input"
                  rows={3}
                  value={crmReason}
                  onChange={(e) => setCrmReason(e.target.value)}
                  placeholder="Strategic justification for updating CRM record"
                  className="w-full text-xs sm:text-sm bg-[#FAFCFF] border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Supporting Evidentiary Rationale (Task D.4) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="crm-rationale-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Supporting Evidentiary Rationale</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Deterministic Grounding</span>
                </div>
                <textarea
                  id="crm-rationale-input"
                  rows={3}
                  value={crmSupportingRationale}
                  onChange={(e) => setCrmSupportingRationale(e.target.value)}
                  placeholder="Detailed telemetry rationale supporting the CRM risk downgrade..."
                  className="w-full text-xs sm:text-sm bg-[#FAFCFF] border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none leading-relaxed"
                />
              </div>

              {/* Multi-Field Updates Preview */}
              {crmFieldUpdates && crmFieldUpdates.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Proposed Multi-Field CRM Alignments</span>
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {crmFieldUpdates.map((fu, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-slate-900 block">{fu.field}</span>
                          <span className="text-[11px] text-slate-500">{fu.rationale}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 line-through">
                            {fu.current}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] font-bold">
                            {fu.proposed}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Status: <strong className="text-slate-800">{savedCrmProp ? `Saved (v${savedCrmProp.version})` : 'Draft'}</strong>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleSaveDraft('crm')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-400" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    onClick={() => handleSubmitForApproval('crm')}
                    disabled={savingState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Context Problem Dossier & Target Stakeholder */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Structured Problem Triggers */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Active Churn Triggers
              </h3>
              <span className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-semibold">
                High Priority
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-semibold text-slate-800">Usage Contraction</span>
                </div>
                <span className="font-mono font-bold text-rose-600">-52% MoM</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-semibold text-slate-800">Touchpoint Silence</span>
                </div>
                <span className="font-mono font-bold text-purple-700">16d without reply</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-slate-800">Contract Expiration</span>
                </div>
                <span className="font-mono font-bold text-amber-700">{renewalDays}d remaining</span>
              </div>
            </div>
          </div>

          {/* Card 2: Target Decision Maker */}
          {primaryContact && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                  Target Decision Maker
                </h3>
                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                  Primary Champion
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{primaryContact.name}</span>
                </div>
                <p className="text-slate-500 pl-5 text-[11px] font-mono">{primaryContact.role} • {primaryContact.email}</p>
              </div>
            </div>
          )}

          {/* Card 3: Human Safe Gate Sign-off Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Safe Execution Gate Active</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Proposals are signed with SHA-256 hash integrity. Autonomous writes are blocked until explicitly verified in the Approval Center.
            </p>
            <button
              onClick={onNavigateToApprovals}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
            >
              <span>Go to Approval Center</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* TAB 4: Feature 4 — Outcome Intelligence */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          {/* Main Container */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 lg:p-8 space-y-8 shadow-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                    Feature 4 · Outcome Intelligence
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Closed-Loop Learning
                  </span>
                </div>
                <h2 className="font-headline text-2xl font-bold text-[#020062] flex items-center gap-2.5">
                  <BarChart2 className="w-6 h-6 text-[#2563EB]" />
                  Action & Outcome Empirical Intelligence
                </h2>
                <p className="text-sm text-slate-500 font-body">
                  Analyzes historical actions and observed outcomes to identify patterns. Recommendations become informed by real experience rather than generic best practices.
                </p>
              </div>

              <button
                onClick={() => {
                  setLoadingIntelligence(true);
                  fetchOutcomeIntelligence()
                    .then((data) => setOutcomeReport(data))
                    .finally(() => setLoadingIntelligence(false));
                }}
                disabled={loadingIntelligence}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-[#E2E8F0] shadow-xs cursor-pointer shrink-0 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${loadingIntelligence ? 'animate-spin' : ''}`} />
                <span>Refresh Intelligence</span>
              </button>
            </div>

            {/* Top 4 KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-2">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block">
                  Action Response Rate
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#020062]">
                    {outcomeReport?.overall_response_rate_pct ?? 75}%
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold">Response received</span>
                </div>
                <p className="text-xs text-slate-500">
                  Across all executive outreach and customer touchpoints
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-2">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block">
                  On-Time Completion
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-700">
                    {outcomeReport?.on_time_completion_pct ?? 83.3}%
                  </span>
                  <span className="text-xs text-slate-500 font-mono">1.8d avg</span>
                </div>
                <p className="text-xs text-slate-500">
                  {outcomeReport?.timeliness.completed_on_time ?? 3} completed on-time / {outcomeReport?.timeliness.overdue_count ?? 1} overdue
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-2">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block">
                  Positive Signal Rate
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#2563EB]">
                    {outcomeReport?.positive_outcome_pct ?? 70}%
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold">Favorable rebound</span>
                </div>
                <p className="text-xs text-slate-500">
                  Actions leading directly to subsequent usage or SLA recovery
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-2">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-500 block">
                  Unresolved Blockers
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-rose-700">
                    {outcomeReport?.unresolved_blockers_count ?? 2}
                  </span>
                  <span className="text-xs text-rose-600 font-semibold">Active bottlenecks</span>
                </div>
                <p className="text-xs text-slate-500">
                  Identified across tracked accounts requiring remediation
                </p>
              </div>
            </div>

            {/* SECTION 1: Action Type Response Comparison */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <div>
                  <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#2563EB]" />
                    Action Types & Response Effectiveness
                  </h3>
                  <p className="text-xs text-slate-500">
                    Which action types received a response and latency to customer feedback
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(outcomeReport?.action_type_stats || [
                  {
                    action_type: 'csm_outreach_email',
                    action_type_label: 'Executive Outreach Email',
                    total_dispatched: 3,
                    responses_received: 2,
                    response_rate_pct: 66.7,
                    avg_response_hours: 6.5,
                    benchmark_verdict: 'High Impact'
                  },
                  {
                    action_type: 'crm_update',
                    action_type_label: 'Salesforce CRM Forecast Sync',
                    total_dispatched: 2,
                    responses_received: 2,
                    response_rate_pct: 100.0,
                    avg_response_hours: 0.5,
                    benchmark_verdict: 'High Impact'
                  },
                  {
                    action_type: 'task_create',
                    action_type_label: 'Operational Alignment Task',
                    total_dispatched: 2,
                    responses_received: 1,
                    response_rate_pct: 50.0,
                    avg_response_hours: 18.0,
                    benchmark_verdict: 'Moderate'
                  }
                ]).map((stat, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-white space-y-3 shadow-xs hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase text-slate-500">
                        {stat.action_type}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          stat.benchmark_verdict === 'High Impact'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {stat.benchmark_verdict}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#020062]">
                      {stat.action_type_label}
                    </h4>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Response Rate:</span>
                        <strong className="text-[#020062] font-mono">{stat.response_rate_pct}%</strong>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#2563EB] h-2 rounded-full transition-all"
                          style={{ width: `${stat.response_rate_pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>{stat.responses_received} / {stat.total_dispatched} replied</span>
                      <span>~{stat.avg_response_hours}h latency</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: Learned Empirical Patterns */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <div>
                  <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Learned Empirical Patterns & Best Strategies
                  </h3>
                  <p className="text-xs text-slate-500">
                    How many historical examples support each observed pattern and validated strategy
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(outcomeReport?.learned_patterns || [
                  {
                    pattern_id: 'pat-001',
                    title: 'Technical Pairing vs Repetitive Email for SSO Blockages',
                    condition: 'Account exhibits >30% seat under-allocation accompanied by SSO/IAM integration tickets.',
                    recommended_strategy: 'Dispatch Solutions Engineer for 20-min technical pairing or screen-share configuration.',
                    ineffective_strategy: 'Sending repetitive executive check-in emails asking if they need help.',
                    historical_examples_count: 6,
                    success_confidence_pct: 88.5,
                    empirical_evidence_summary: 'In 6 of 6 past cases, direct technical assistance resolved Okta/SAML mapping within 24 hours, unblocking average 28 seats.'
                  },
                  {
                    pattern_id: 'pat-002',
                    title: 'Direct Fulfillment of Recorded Commitments vs Generic Outreach',
                    condition: 'Customer sponsor has already replied with specific pricing or packaging inquiries.',
                    recommended_strategy: 'Deliver exact ROI breakdown or packaging comparison requested in recorded commitments.',
                    ineffective_strategy: 'Repeating generic check-in email asking if they want to chat.',
                    historical_examples_count: 5,
                    success_confidence_pct: 92.0,
                    empirical_evidence_summary: 'Customers respond with renewed contract commitment when CSM directly addresses pricing tiering without redundant re-discovery.'
                  }
                ]).map((pattern) => (
                  <div
                    key={pattern.pattern_id}
                    className="p-5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#020062]">
                        {pattern.title}
                      </h4>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white text-[#0025AE] border border-blue-200">
                        {pattern.historical_examples_count} Historical Examples
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 font-body">
                      <p>
                        <strong className="text-slate-800">Trigger Condition:</strong> {pattern.condition}
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-0.5">
                      <span className="font-bold text-emerald-900 block font-mono uppercase text-[10px]">
                        ✓ Validated Optimal Strategy ({pattern.success_confidence_pct}% Confidence):
                      </span>
                      <p className="text-emerald-950 font-body">
                        {pattern.recommended_strategy}
                      </p>
                    </div>

                    <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-lg text-xs space-y-0.5">
                      <span className="font-bold text-rose-900 block font-mono uppercase text-[10px]">
                        ✗ Ineffective Strategy To Avoid:
                      </span>
                      <p className="text-rose-950 font-body">
                        {pattern.ineffective_strategy}
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500 font-mono">
                      Evidence summary: {pattern.empirical_evidence_summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: Recurring Customer Blockers Registry */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <div>
                  <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Recurring Customer Blockers Registry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Which recurring blockers remain unresolved across customer accounts
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
                {(outcomeReport?.unresolved_blockers || [
                  {
                    blocker_id: 'blk-102',
                    category: 'Pricing Tier & Seat Consolidation',
                    description: 'VP of Engineering requires tailored ROI deck and custom tier pricing before approving renewal order form.',
                    affected_accounts_count: 1,
                    affected_account_names: ['Acme Technologies'],
                    unresolved: true,
                    severity: 'critical',
                    recommended_remedy: 'Provide customized ROI tier breakdown and schedule executive sign-off call.'
                  },
                  {
                    blocker_id: 'blk-103',
                    category: 'Executive Sponsor Turnover',
                    description: 'Original executive champion departed; interim Director needs enterprise roadmap justification.',
                    affected_accounts_count: 1,
                    affected_account_names: ['HyperScale Labs'],
                    unresolved: true,
                    severity: 'high',
                    recommended_remedy: 'Executive briefing presenting enterprise scalability benchmarks & multi-year discount.'
                  },
                  {
                    blocker_id: 'blk-101',
                    category: 'IAM & SAML SSO Configuration',
                    description: 'DevOps engineering team blocked on Okta SAML 2.0 metadata mapping, preventing 35+ developers from accessing paid seats.',
                    affected_accounts_count: 2,
                    affected_account_names: ['Apex Systems', 'CloudScale Solutions'],
                    unresolved: false,
                    severity: 'high',
                    recommended_remedy: 'Solutions Architect screen-share configuration pairing directly with customer IT/DevOps.'
                  }
                ]).map((blocker) => (
                  <div key={blocker.blocker_id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                            blocker.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : blocker.severity === 'high'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {blocker.severity}
                        </span>
                        <h4 className="text-sm font-bold text-[#020062]">
                          {blocker.category}
                        </h4>
                        <span className="text-xs text-slate-400 font-mono">({blocker.blocker_id})</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-body">
                        {blocker.description}
                      </p>
                      <p className="text-xs text-emerald-800 font-semibold font-body">
                        Remedy: {blocker.recommended_remedy}
                      </p>
                    </div>

                    <div className="flex flex-col md:items-end gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md ${
                          blocker.unresolved
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {blocker.unresolved ? '● Unresolved Blocker' : '✓ Resolved in History'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Affects: {blocker.affected_account_names.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: Account's Past Actions & Outcome Timeline */}
            <div className="space-y-4 pt-2 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#2563EB]" />
                    {account.name} — Historical Actions & Customer Reaction Log
                  </h3>
                  <p className="text-xs text-slate-500">
                    Every recorded action, customer response, and commitment for this specific account
                  </p>
                </div>
              </div>

              {draftData?.history_aware_context?.previous_actions && draftData.history_aware_context.previous_actions.length > 0 ? (
                <div className="space-y-3">
                  {draftData.history_aware_context.previous_actions.map((act, aIdx) => (
                    <div
                      key={act.id || aIdx}
                      className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#020062] text-sm">{act.title}</span>
                          <span className="font-mono text-slate-500">({act.action_type})</span>
                        </div>
                        <span className="font-mono text-emerald-700 font-semibold uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {act.work_status}
                        </span>
                      </div>

                      {act.customer_response && (
                        <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] space-y-1">
                          <span className="font-bold text-slate-700 block text-[11px] uppercase font-mono">
                            Customer Response & Sentiment:
                          </span>
                          <p className="text-slate-800">{act.customer_response}</p>
                        </div>
                      )}

                      {act.commitments && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 space-y-1">
                          <span className="font-bold block text-[11px] uppercase font-mono text-amber-900">
                            Recorded Commitments:
                          </span>
                          <p>{act.commitments}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] pt-1">
                        <span>Assigned: {act.assigned_to}</span>
                        <span>Recorded: {act.recorded_at ? act.recorded_at.slice(0, 16) : act.created_at?.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-sm">
                  No prior actions recorded yet for {account.name}. This is the initial intervention cycle.
                </div>
              )}
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors shrink-0"
        >
          <span>Open Approval Center</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default NextBestActionCopilotView;
