import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  User,
  ArrowUpRight,
  X,
  BellRing,
  Check,
  Plus,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  TrendingDown,
  Lightbulb,
  TrendingUp,
  Activity,
  ShieldCheck
} from 'lucide-react';
import {
  fetchDispatchedSurveys,
  fetchFeedbackResponses,
  checkFeedbackTriggerEligibility,
  dispatchFeedbackSurvey,
  scanPortfolioTriggers,
  fetchReminders,
  evaluateReminders,
  completeReminder,
  dismissReminder,
  createReminder,
  fetchRecurringProblemsReport,
  refreshRecurringProblems,
  fetchImprovementInsightsReport,
  implementImprovementInsight,
  evaluateImprovementInsight
} from '../services/api';
import type {
  FeedbackSurveyDispatch,
  CustomerFeedbackRecord,
  FeedbackTriggerCheck,
  AccountRiskSummary,
  CreateFeedbackSurveyRequest,
  BatchTriggerScanResult,
  DynamicReminder,
  CreateReminderRequest,
  ReminderEvaluationResult,
  RecurringProblemsReport,
  ActionableImprovementInsight,
  ImprovementInsightsReport
} from '../types/api';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackFlowInteractiveView } from './FeedbackFlowInteractiveView';
import { RetentionReminderFlowView } from './RetentionReminderFlowView';

interface FeedbackManagementViewProps {
  accounts: AccountRiskSummary[];
  initialAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onNavigateToAutopsy?: (accountId: string) => void;
  onNavigateToTimeline?: (accountId: string) => void;
  onNavigateToApprovals?: () => void;
  onNavigateToCopilot?: (accountId: string) => void;
}

export function FeedbackManagementView({
  accounts,
  initialAccountId,
  onSelectAccount,
  onNavigateToAutopsy,
  onNavigateToTimeline,
  onNavigateToApprovals,
  onNavigateToCopilot
}: FeedbackManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'retention_remainder_flow' | 'flow' | 'overview' | 'surveys' | 'interactive_form' | 'reminders' | 'recurring_problems' | 'improvement_insights'>('retention_remainder_flow');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || (accounts[0]?.id || 'acc-101'));
  
  // Data State
  const [surveys, setSurveys] = useState<FeedbackSurveyDispatch[]>([]);
  const [responses, setResponses] = useState<CustomerFeedbackRecord[]>([]);
  const [triggerCheck, setTriggerCheck] = useState<FeedbackTriggerCheck | null>(null);

  // Task B: Dynamic Reminders State
  const [reminders, setReminders] = useState<DynamicReminder[]>([]);
  const [evaluatingReminders, setEvaluatingReminders] = useState<boolean>(false);
  const [reminderTypeFilter, setReminderTypeFilter] = useState<string>('all');
  const [reminderStatusFilter, setReminderStatusFilter] = useState<string>('active');
  const [reminderScopeFilter, setReminderScopeFilter] = useState<'all' | 'selected'>('all');
  const [reminderSearch, setReminderSearch] = useState<string>('');
  const [reminderEvalResult, setReminderEvalResult] = useState<ReminderEvaluationResult | null>(null);

  // Task D: Recurring Customer Problems State
  const [recurringReport, setRecurringReport] = useState<RecurringProblemsReport | null>(null);
  const [refreshingRecurring, setRefreshingRecurring] = useState<boolean>(false);
  const [recurringCategoryFilter, setRecurringCategoryFilter] = useState<string>('all');
  const [recurringSeverityFilter, setRecurringSeverityFilter] = useState<string>('all');
  const [recurringSearch, setRecurringSearch] = useState<string>('');
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);

  // Task E: Actionable Improvement Insights State
  const [insightsReport, setInsightsReport] = useState<ImprovementInsightsReport | null>(null);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [insightCategoryFilter, setInsightCategoryFilter] = useState<string>('all');
  const [insightStatusFilter, setInsightStatusFilter] = useState<string>('all');
  const [insightSearch, setInsightSearch] = useState<string>('');
  const [showImplementModal, setShowImplementModal] = useState<boolean>(false);
  const [selectedInsightForImplement, setSelectedInsightForImplement] = useState<ActionableImprovementInsight | null>(null);
  const [implementManagerName, setImplementManagerName] = useState<string>('Sarah Jenkins (CSM Lead)');
  const [implementNotes, setImplementNotes] = useState<string>('');
  const [implementing, setImplementing] = useState<boolean>(false);
  const [evaluatingInsightId, setEvaluatingInsightId] = useState<string | null>(null);

  // Manual Reminder Creation Modal State
  const [showCreateReminderModal, setShowCreateReminderModal] = useState<boolean>(false);
  const [newReminderAccountId, setNewReminderAccountId] = useState<string>(selectedAccountId);
  const [newReminderTitle, setNewReminderTitle] = useState<string>('');
  const [newReminderDesc, setNewReminderDesc] = useState<string>('');
  const [newReminderSeverity, setNewReminderSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [newReminderDueDate, setNewReminderDueDate] = useState<string>('');
  const [creatingReminder, setCreatingReminder] = useState<boolean>(false);
  const [createReminderError, setCreateReminderError] = useState<string | null>(null);
  
  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [triggerLoading, setTriggerLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New Survey Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [customIntro, setCustomIntro] = useState<string>('');
  const [selectedSurveyCodeForFill, setSelectedSurveyCodeForFill] = useState<string>('rev-fb-acme-101');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'selected'>('all');
  const [formFillMode, setFormFillMode] = useState<'account' | 'token'>('account');

  // Portfolio Auto-Trigger Scanner State
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<BatchTriggerScanResult | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);


  useEffect(() => {
    loadAllFeedbackData();
  }, [selectedAccountId]);

  const handleRunPortfolioScan = async (forceIgnore: boolean = false) => {
    try {
      setScanning(true);
      setError(null);
      const result = await scanPortfolioTriggers(forceIgnore);
      setScanResult(result);
      await loadAllFeedbackData();
    } catch (err: any) {
      setError(err.message || 'Portfolio scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleRefreshRecurring = async () => {
    try {
      setRefreshingRecurring(true);
      const rep = await refreshRecurringProblems();
      setRecurringReport(rep);
    } catch (err: any) {
      alert(`Failed to refresh recurring problems: ${err.message}`);
    } finally {
      setRefreshingRecurring(false);
    }
  };

  const loadAllFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [surveysData, responsesData, remindersData, recurringData, insightsData] = await Promise.all([
        fetchDispatchedSurveys(),
        fetchFeedbackResponses(),
        fetchReminders(),
        fetchRecurringProblemsReport().catch(() => null),
        fetchImprovementInsightsReport().catch(() => null)
      ]);
      setSurveys(surveysData);
      setResponses(responsesData);
      setReminders(remindersData);
      if (recurringData) setRecurringReport(recurringData);
      if (insightsData) setInsightsReport(insightsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback records');
    } finally {
      setLoading(false);
    }

    if (selectedAccountId) {
      try {
        setTriggerLoading(true);
        const check = await checkFeedbackTriggerEligibility(selectedAccountId);
        setTriggerCheck(check);
      } catch (err: any) {
        console.warn('Error loading trigger check:', err);
      } finally {
        setTriggerLoading(false);
      }
    }
  };

  const handleDispatchSurvey = async () => {
    if (!selectedAccountId) return;
    try {
      setDispatching(true);
      setDispatchError(null);
      const req: CreateFeedbackSurveyRequest = {
        account_id: selectedAccountId,
        custom_intro: customIntro || undefined,
        delivery_channel: 'email'
      };
      const dispatched = await dispatchFeedbackSurvey(req);
      setShowDispatchModal(false);
      setCustomIntro('');
      // Reload surveys list
      const surveysData = await fetchDispatchedSurveys();
      setSurveys(surveysData);
      setSelectedSurveyCodeForFill(dispatched.survey_code);
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to dispatch survey');
    } finally {
      setDispatching(false);
    }
  };

  // Task B: Dynamic Reminders Handlers
  const handleRunPortfolioReminderScan = async () => {
    try {
      setEvaluatingReminders(true);
      setError(null);
      const result = await evaluateReminders();
      setReminderEvalResult(result);
      const rems = await fetchReminders();
      setReminders(rems);
    } catch (err: any) {
      setError(err.message || 'Reminder evaluation failed');
    } finally {
      setEvaluatingReminders(false);
    }
  };

  const handleCompleteReminder = async (id: string) => {
    try {
      const updated = await completeReminder(id);
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      alert(`Failed to complete reminder: ${err.message}`);
    }
  };

  const handleDismissReminder = async (id: string) => {
    const reason = prompt('Optional dismissal reason (e.g., Addressed on CSM call):', 'Reviewed and addressed by CSM');
    if (reason === null) return;
    try {
      const updated = await dismissReminder(id, reason);
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      alert(`Failed to dismiss reminder: ${err.message}`);
    }
  };

  const handleCreateManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) {
      setCreateReminderError('Please enter a reminder title');
      return;
    }
    try {
      setCreatingReminder(true);
      setCreateReminderError(null);
      const req: CreateReminderRequest = {
        account_id: newReminderAccountId,
        title: newReminderTitle.trim(),
        description: newReminderDesc.trim() || 'Manual reminder created by CSM',
        reminder_type: 'custom',
        severity: newReminderSeverity,
        due_date: newReminderDueDate || undefined
      };
      const created = await createReminder(req);
      setReminders((prev) => [created, ...prev]);
      setShowCreateReminderModal(false);
      setNewReminderTitle('');
      setNewReminderDesc('');
      setNewReminderDueDate('');
    } catch (err: any) {
      setCreateReminderError(err.message || 'Failed to create reminder');
    } finally {
      setCreatingReminder(false);
    }
  };

  // Filtered dynamic reminders
  const filteredReminders = reminders.filter((rem) => {
    if (reminderScopeFilter === 'selected' && rem.account_id !== selectedAccountId) {
      return false;
    }
    if (reminderStatusFilter !== 'all' && rem.status !== reminderStatusFilter) {
      return false;
    }
    if (reminderTypeFilter !== 'all' && rem.reminder_type !== reminderTypeFilter) {
      return false;
    }
    if (!reminderSearch) return true;
    const q = reminderSearch.toLowerCase();
    return (
      rem.title.toLowerCase().includes(q) ||
      rem.description.toLowerCase().includes(q) ||
      rem.account_name.toLowerCase().includes(q) ||
      rem.trigger_condition.toLowerCase().includes(q) ||
      rem.issue_key.toLowerCase().includes(q)
    );
  });

  // Filtered recurring problems (Task D)
  const filteredProblems = (recurringReport?.problems || []).filter((p) => {
    if (recurringCategoryFilter !== 'all' && p.category !== recurringCategoryFilter) {
      return false;
    }
    if (recurringSeverityFilter !== 'all' && p.severity !== recurringSeverityFilter) {
      return false;
    }
    if (!recurringSearch) return true;
    const q = recurringSearch.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.repeated_complaints.some((c) => c.toLowerCase().includes(q)) ||
      p.affected_accounts.some((a) => a.account_name.toLowerCase().includes(q))
    );
  });

  const handleRefreshInsights = async () => {
    try {
      setLoadingInsights(true);
      const rep = await fetchImprovementInsightsReport();
      setInsightsReport(rep);
    } catch (err: any) {
      alert(`Failed to refresh improvement insights: ${err.message}`);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleImplementInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsightForImplement) return;
    try {
      setImplementing(true);
      const updated = await implementImprovementInsight(selectedInsightForImplement.id, {
        manager_name: implementManagerName,
        implementation_notes: implementNotes || undefined
      });
      setInsightsReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          insights: prev.insights.map((i) => (i.id === updated.id ? updated : i)),
          implemented_initiatives: prev.implemented_initiatives + 1,
          active_recommendations: Math.max(0, prev.active_recommendations - 1)
        };
      });
      setShowImplementModal(false);
      setSelectedInsightForImplement(null);
      setImplementNotes('');
    } catch (err: any) {
      alert(`Failed to implement initiative: ${err.message}`);
    } finally {
      setImplementing(false);
    }
  };

  const handleEvaluateOutcome = async (insightId: string) => {
    try {
      setEvaluatingInsightId(insightId);
      const updated = await evaluateImprovementInsight(insightId);
      setInsightsReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          insights: prev.insights.map((i) => (i.id === updated.id ? updated : i))
        };
      });
    } catch (err: any) {
      alert(`Failed to evaluate subsequent telemetry: ${err.message}`);
    } finally {
      setEvaluatingInsightId(null);
    }
  };

  // Filtered actionable improvement insights (Task E)
  const filteredInsights = (insightsReport?.insights || []).filter((ins) => {
    if (insightCategoryFilter !== 'all' && ins.category !== insightCategoryFilter) {
      return false;
    }
    if (insightStatusFilter !== 'all' && ins.status !== insightStatusFilter) {
      return false;
    }
    if (!insightSearch) return true;
    const q = insightSearch.toLowerCase();
    return (
      ins.title.toLowerCase().includes(q) ||
      ins.problem_title.toLowerCase().includes(q) ||
      ins.recommended_action.toLowerCase().includes(q) ||
      ins.target_audience.toLowerCase().includes(q) ||
      ins.owner_role.toLowerCase().includes(q) ||
      ins.affected_customers.some((c) => c.toLowerCase().includes(q))
    );
  });

  // Filtered responses
  const filteredResponses = responses.filter((r) => {
    if (scopeFilter === 'selected' && r.account_id !== selectedAccountId) {
      return false;
    }
    if (filterReason !== 'all' && r.analysis?.classified_churn_reason !== filterReason) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.account_name.toLowerCase().includes(q) ||
      r.recipient_name.toLowerCase().includes(q) ||
      (r.submission.primary_blocker && r.submission.primary_blocker.toLowerCase().includes(q)) ||
      (r.analysis?.recommended_retention_action && r.analysis.recommended_retention_action.toLowerCase().includes(q))
    );
  });


  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Feature: Feedback Form & Survey Loop
            </span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Closed-Loop Customer Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#020062] font-headline">
            Customer Feedback Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Evaluate trigger eligibility, send targeted survey forms, review customer blockers, and execute AI-recommended retention actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRunPortfolioScan(false)}
            disabled={scanning}
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Scan all monitored accounts against declining usage and risk trigger rules"
          >
            <Sparkles className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Auto-Scan Triggers'}
          </button>
          <button
            onClick={() => loadAllFeedbackData()}
            className="p-2.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
            title="Refresh feedback data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Dispatch New Survey
          </button>
        </div>
      </div>

      {/* Auto-Trigger Scan Result Banner */}
      {scanResult && (
        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-indigo-900 block flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Automated Portfolio Trigger Scan Completed
            </span>
            <p className="text-indigo-800 mt-0.5">
              Scanned <span className="font-bold">{scanResult.scanned_accounts_count}</span> accounts •{' '}
              <span className="font-bold text-emerald-700">{scanResult.auto_triggered_surveys.length}</span> surveys auto-dispatched •{' '}
              <span className="font-bold text-slate-600">{scanResult.duplicate_prevented_count}</span> duplicate requests prevented •{' '}
              <span className="font-bold text-amber-700">{scanResult.cooldown_prevented_count}</span> fatigue cooldowns enforced.
            </p>
          </div>
          <button
            onClick={() => setScanResult(null)}
            className="text-indigo-600 hover:text-indigo-900 text-[11px] font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadAllFeedbackData()}
            className="text-rose-900 font-bold hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Account Selector & Trigger Engine Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Context */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Target Account
            </span>
            <span className="text-xs font-medium text-slate-500">
              {accounts.length} Accounts Monitored
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Account for Feedback Review:
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                if (onSelectAccount) onSelectAccount(e.target.value);
              }}
              className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — Risk: {acc.risk_score} ({acc.risk_level.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {selectedAccount && (
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ARR Exposure:</span>
                <span className="font-bold font-mono text-slate-900">${selectedAccount.arr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Renewal Date:</span>
                <span className="font-semibold text-slate-800">{selectedAccount.renewal_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CSM Owner:</span>
                <span className="font-semibold text-slate-800">{selectedAccount.csm_owner}</span>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] flex gap-2">
                {onNavigateToAutopsy && (
                  <button
                    onClick={() => onNavigateToAutopsy(selectedAccount.id)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-[#0025AE] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all cursor-pointer text-center"
                  >
                    View Autopsy
                  </button>
                )}
                {onNavigateToTimeline && (
                  <button
                    onClick={() => onNavigateToTimeline(selectedAccount.id)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-all cursor-pointer text-center"
                  >
                    View Timeline
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Feedback Trigger Decision Engine */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#020062]">
                  Feedback Trigger Service — Decision Rules
                </h3>
                <p className="text-[11px] text-slate-500">
                  Checks deterministic churn signals, survey frequency cooldown, and contact preferences.
                </p>
              </div>
            </div>

            {triggerCheck && (
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${
                triggerCheck.eligible
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {triggerCheck.eligible ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Eligible for Survey
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Cooldown / Not Eligible
                  </>
                )}
              </span>
            )}
          </div>

          {triggerLoading ? (
            <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" /> Evaluating deterministic trigger rules...
            </div>
          ) : triggerCheck ? (
            <div className="space-y-4 pt-1 text-xs">
              {/* Trigger Rules Audit Cards */}
              {triggerCheck.matched_rules && triggerCheck.matched_rules.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {triggerCheck.matched_rules.map((rule) => (
                    <div
                      key={rule.rule_id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                        rule.triggered
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                        rule.triggered ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {rule.triggered ? '!' : '✓'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold block truncate leading-tight text-[11px]">
                          {rule.rule_name}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          {rule.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reasons & Safeguards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-[#E2E8F0]">
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-700 block">Trigger Decision Audit:</span>
                  <ul className="space-y-1">
                    {triggerCheck.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                        <span className="text-[#2563EB] mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duplicate Pending Survey:</span>
                    <span className={`font-mono font-bold ${triggerCheck.duplicate_pending_survey ? 'text-amber-700' : 'text-slate-700'}`}>
                      {triggerCheck.duplicate_pending_survey ? `ACTIVE (${triggerCheck.pending_survey_code})` : 'NONE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cooldown Guard:</span>
                    <span className={`font-mono font-bold ${triggerCheck.cooldown_active ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {triggerCheck.cooldown_active ? `ACTIVE (${triggerCheck.cooldown_days_remaining}d left)` : 'CLEARED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recommended Template:</span>
                    <span className="font-mono text-[#0025AE] truncate">
                      {triggerCheck.recommended_template_id}
                    </span>
                  </div>
                  {triggerCheck.last_survey_sent_at && (
                    <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-200">
                      <span>Last Survey Sent:</span>
                      <span>{new Date(triggerCheck.last_survey_sent_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Select an account to view trigger assessment.</p>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="border-b border-[#E2E8F0] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'retention_remainder_flow', label: '🔄 37-Node Retention Engine', count: 'remainder.md' },
            { id: 'flow', label: '⚡ 20-Node Feedback Flow', count: 'Interactive' },
            { id: 'recurring_problems', label: '🔍 Recurring Problems', count: recurringReport ? recurringReport.problems.length : null },
            { id: 'improvement_insights', label: '💡 Improvement Insights', count: insightsReport ? insightsReport.insights.length : null },
            { id: 'reminders', label: '⏰ Dynamic Reminders', count: reminders.filter((r) => r.status === 'active').length },
            { id: 'overview', label: 'All Responses & AI Analysis', count: responses.length },
            { id: 'surveys', label: 'Dispatched Surveys', count: surveys.length },
            { id: 'interactive_form', label: 'Fill / Test Feedback Form', count: null }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === tab.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  tab.id === 'retention_remainder_flow' ? 'bg-purple-100 text-purple-700 font-bold border border-purple-200' :
                  tab.id === 'flow' ? 'bg-indigo-100 text-indigo-700 font-bold' :
                  tab.id === 'recurring_problems' ? 'bg-purple-100 text-purple-800 font-bold' :
                  tab.id === 'improvement_insights' ? 'bg-emerald-100 text-emerald-800 font-bold' :
                  tab.id === 'reminders' ? 'bg-amber-100 text-amber-800 font-bold' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SUBTAB -1: 37-Node Retention & Reminders Continuous Improvement Flow */}
      {activeSubTab === 'retention_remainder_flow' && (
        <RetentionReminderFlowView
          onOpenFeedbackForm={() => {
            setActiveSubTab('interactive_form');
          }}
          onNavigateToFeedback={() => {
            setActiveSubTab('overview');
          }}
        />
      )}

      {/* SUBTAB 0: 20-Node Interactive Agent Flowchart */}
      {activeSubTab === 'flow' && (
        <FeedbackFlowInteractiveView
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => {
            setSelectedAccountId(accId);
            onSelectAccount?.(accId);
          }}
          onNavigateToCopilot={onNavigateToCopilot}
          onNavigateToApprovals={onNavigateToApprovals}
          onNavigateToTimeline={onNavigateToTimeline}
        />
      )}

      {/* SUBTAB 1: Overview & All Responses */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by account, contact, blocker or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              {/* Scope filter: All accounts vs Selected account */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    scopeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Accounts ({responses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('selected')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    scopeFilter === 'selected'
                      ? 'bg-white text-[#0025AE] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {selectedAccount?.name || 'Selected'} ({responses.filter((r) => r.account_id === selectedAccountId).length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-600">Churn Driver:</span>
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-700"
              >
                <option value="all">All Drivers</option>
                <option value="adoption_blocker">Adoption Blocker</option>
                <option value="technical_bugs">Technical Bugs</option>
                <option value="pricing">Pricing & Minimums</option>
                <option value="poor_onboarding">Poor Onboarding</option>
              </select>
            </div>
          </div>

          {/* Responses Grid / Table */}
          {filteredResponses.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Feedback Responses Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Dispatch a survey or use the "Fill / Test Feedback Form" tab to generate responses.
              </p>
              <button
                onClick={() => setActiveSubTab('interactive_form')}
                className="mt-4 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Open Feedback Form
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResponses.map((item) => {
                const score = item.submission.satisfaction_score;
                const ana = item.analysis;
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E2E8F0] hover:border-blue-200 rounded-2xl p-5 shadow-xs transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm ${
                          (score || 10) <= 4 ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          (score || 10) <= 6 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {score ? `${score}/10` : 'N/A'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#020062]">{item.account_name}</h4>
                            <span className="text-[11px] font-mono text-slate-400">• {new Date(item.submitted_at).toLocaleDateString()}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            Respondent: {item.recipient_name} ({item.recipient_email})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ana && (
                          <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            ana.urgency_level === 'critical' ? 'bg-rose-100 text-rose-800' :
                            ana.urgency_level === 'high' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-[#0025AE]'
                          }`}>
                            Urgency: {ana.urgency_level}
                          </span>
                        )}
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.survey_code}
                        </span>
                      </div>
                    </div>

                    {/* Customer Reported Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                        <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" /> Customer Verbatim Feedback:
                        </span>
                        <div>
                          <span className="text-slate-500 font-medium">Reported Blocker:</span>
                          <p className="text-slate-900 font-semibold mt-0.5">
                            {item.submission.primary_blocker || 'None reported'}
                          </p>
                        </div>
                        {item.submission.unresolved_issues && (
                          <div>
                            <span className="text-slate-500 font-medium">Unresolved Friction:</span>
                            <p className="text-slate-700 mt-0.5 italic">
                              "{item.submission.unresolved_issues}"
                            </p>
                          </div>
                        )}
                        {item.submission.feature_improvement_request && (
                          <div>
                            <span className="text-slate-500 font-medium">Requested Improvement:</span>
                            <p className="text-slate-700 mt-0.5">
                              {item.submission.feature_improvement_request}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* AI Outcome & Retention Action */}
                      {ana && (
                        <div className="space-y-2.5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0025AE] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" /> AI Synthesis & Retention Action
                            </span>
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded font-bold">
                              Confidence: {Math.round((ana.confidence_score || 0.88) * 100)}%
                            </span>
                          </div>

                          {/* Executive Summary */}
                          {ana.executive_summary && (
                            <p className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-blue-100 leading-relaxed font-medium">
                              {ana.executive_summary}
                            </p>
                          )}

                          <div>
                            <span className="text-slate-500 font-medium">Classified Driver:</span>
                            <span className="ml-1.5 font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                              {ana.classified_churn_reason.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 font-medium">Recommended Retention Action:</span>
                            <p className="text-slate-900 font-semibold mt-0.5 bg-white p-2.5 rounded-lg border border-blue-200 shadow-2xs">
                              {ana.recommended_retention_action}
                            </p>
                          </div>

                          {/* Uncertainties & Blindspots */}
                          {ana.uncertainties && ana.uncertainties.length > 0 && (
                            <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 space-y-1">
                              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                                Uncertainties & Unknowns:
                              </span>
                              <ul className="space-y-0.5">
                                {ana.uncertainties.map((u, i) => (
                                  <li key={i} className="text-[10px] text-amber-800 flex items-start gap-1">
                                    <span className="mt-0.5 text-amber-600">•</span>
                                    <span>{u}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-blue-100">
                            <span className="italic">Sentiment: {ana.sentiment_label}</span>
                            <div className="flex items-center gap-2">
                              {onNavigateToApprovals && (
                                <button
                                  onClick={onNavigateToApprovals}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                  title="Review and approve proposed feedback retention interventions"
                                >
                                  Review in Approval Gate →
                                </button>
                              )}
                              {onNavigateToCopilot && (
                                <button
                                  onClick={() => onNavigateToCopilot(item.account_id)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0025AE] border border-blue-200 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                  title="Open in Next-Best-Action Copilot to inspect generated drafts"
                                >
                                  Inspect in Copilot →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: Dispatched Surveys */}
      {activeSubTab === 'surveys' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#020062]">Dispatched Survey Registry</h3>
            <span className="text-xs text-slate-500 font-mono">{surveys.length} total dispatches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-slate-500 uppercase tracking-wider font-mono border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-3">Survey Code</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent At</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {surveys.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-[#0025AE]">{s.survey_code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.account_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.recipient_name} ({s.recipient_email})</td>
                    <td className="px-4 py-3 font-mono uppercase text-slate-500">{s.delivery_channel}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold ${
                        s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        s.status === 'sent' ? 'bg-blue-100 text-[#0025AE]' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(s.sent_at || s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedSurveyCodeForFill(s.survey_code);
                          setActiveSubTab('interactive_form');
                        }}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        Open Form <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Interactive Customer Feedback Form */}
      {activeSubTab === 'interactive_form' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-blue-200">
                <button
                  type="button"
                  onClick={() => setFormFillMode('account')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                    formFillMode === 'account' ? 'bg-[#2563EB] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Customer Account
                </button>
                <button
                  type="button"
                  onClick={() => setFormFillMode('token')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                    formFillMode === 'token' ? 'bg-[#2563EB] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Survey Token
                </button>
              </div>

              {formFillMode === 'account' ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#0025AE]">Target Account:</span>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      onSelectAccount?.(e.target.value);
                    }}
                    className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-semibold text-slate-800 text-xs"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.risk_level.toUpperCase()} - ${acc.arr.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#0025AE]">Survey Token:</span>
                  <select
                    value={selectedSurveyCodeForFill}
                    onChange={(e) => setSelectedSurveyCodeForFill(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-mono text-slate-800 text-xs"
                  >
                    {surveys.map((s) => (
                      <option key={s.survey_code} value={s.survey_code}>
                        {s.survey_code} ({s.account_name} - {s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <span className="text-slate-500 italic">
              Demonstrates Task A: Functional customer feedback submission connected to AI churn analysis and saved against account.
            </span>
          </div>

          <FeedbackForm
            key={formFillMode === 'account' ? `acc-${selectedAccountId}` : `tok-${selectedSurveyCodeForFill}`}
            surveyCode={formFillMode === 'token' ? selectedSurveyCodeForFill : undefined}
            accountId={formFillMode === 'account' ? selectedAccountId : undefined}
            accountName={formFillMode === 'account' ? selectedAccount?.name : undefined}
            recipientName={formFillMode === 'account' ? selectedAccount?.csm_owner : undefined}
            onSubmitted={() => {
              loadAllFeedbackData();
            }}
          />
        </div>
      )}

      {/* SUBTAB 4: Dynamic Reminders (Task B) */}
      {activeSubTab === 'reminders' && (
        <div className="space-y-4">
          {/* Top Control Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5" /> Early Warning & Intervention System
                </span>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Task B
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#020062]">
                Dynamic Early Warning Reminders
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates usage drops (&ge;20%), engagement inactivity (&ge;21d), overdue follow-ups, and unresolved customer blockers.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleRunPortfolioReminderScan}
                disabled={evaluatingReminders}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${evaluatingReminders ? 'animate-spin' : ''}`} />
                <span>{evaluatingReminders ? 'Scanning Portfolio...' : 'Scan Portfolio Reminders'}</span>
              </button>

              <button
                onClick={() => {
                  setNewReminderAccountId(selectedAccountId);
                  setShowCreateReminderModal(true);
                }}
                className="px-3.5 py-2.5 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-slate-500" />
                <span>+ Custom Reminder</span>
              </button>
            </div>
          </div>

          {/* Scan Results Alert */}
          {reminderEvalResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Portfolio Scan Completed Successfully
                </span>
                <p className="text-emerald-800 mt-0.5">
                  Scanned <span className="font-bold">{reminderEvalResult.total_accounts_scanned}</span> accounts •{' '}
                  <span className="font-bold text-amber-700">{reminderEvalResult.new_reminders_triggered}</span> new reminders triggered •{' '}
                  <span className="font-bold text-slate-600">{reminderEvalResult.duplicates_prevented}</span> duplicate reminders prevented •{' '}
                  <span className="font-bold text-indigo-700">{reminderEvalResult.active_reminders_count}</span> total active reminders.
                </p>
              </div>
              <button
                onClick={() => setReminderEvalResult(null)}
                className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
              <span className="text-slate-400 font-medium block">Total Reminders</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-0.5">{reminders.length}</span>
            </div>
            <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-amber-700 font-medium block">Active Reminders</span>
              <span className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                {reminders.filter((r) => r.status === 'active').length}
              </span>
            </div>
            <div className="bg-white border border-rose-200 bg-rose-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-rose-700 font-medium block">Critical / High Severity</span>
              <span className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                {reminders.filter((r) => r.status === 'active' && (r.severity === 'critical' || r.severity === 'high')).length}
              </span>
            </div>
            <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-emerald-700 font-medium block">Resolved / Dismissed</span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                {reminders.filter((r) => r.status === 'completed' || r.status === 'dismissed').length}
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reminders by title, account, or condition..."
                  value={reminderSearch}
                  onChange={(e) => setReminderSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              {/* Scope filter */}
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] shrink-0">
                <button
                  type="button"
                  onClick={() => setReminderScopeFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                    reminderScopeFilter === 'all' ? 'bg-[#2563EB] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Accounts ({reminders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReminderScopeFilter('selected')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                    reminderScopeFilter === 'selected' ? 'bg-[#2563EB] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {selectedAccount ? selectedAccount.name : 'Selected Account'} (
                  {reminders.filter((r) => r.account_id === selectedAccountId).length})
                </button>
              </div>
            </div>

            {/* Dropdowns */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <select
                value={reminderStatusFilter}
                onChange={(e) => setReminderStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="active">Active Only</option>
                <option value="completed">Completed</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All Statuses</option>
              </select>

              <select
                value={reminderTypeFilter}
                onChange={(e) => setReminderTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="all">All Trigger Types</option>
                <option value="usage_drop">Usage Drops</option>
                <option value="reduced_engagement">Engagement Inactivity</option>
                <option value="overdue_followup">Overdue Follow-ups</option>
                <option value="unresolved_feedback">Unresolved Feedback</option>
                <option value="renewal_proximity">Renewal Proximity</option>
                <option value="custom">Custom CSM</option>
              </select>
            </div>
          </div>

          {/* Reminders List */}
          {filteredReminders.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <BellRing className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Reminders Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No reminders match the current filter criteria. Run a portfolio scan to evaluate all account risk rules.
              </p>
              <button
                onClick={handleRunPortfolioReminderScan}
                disabled={evaluatingReminders}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Scan Portfolio Accounts</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredReminders.map((rem) => {
                const isCritical = rem.severity === 'critical';
                const isHigh = rem.severity === 'high';
                const typeLabel = rem.reminder_type.replace('_', ' ').toUpperCase();
                return (
                  <div
                    key={rem.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
                      rem.status === 'completed'
                        ? 'opacity-70 border-slate-200'
                        : rem.status === 'dismissed'
                        ? 'opacity-60 border-slate-200'
                        : isCritical
                        ? 'border-rose-200 hover:border-rose-300'
                        : isHigh
                        ? 'border-amber-200 hover:border-amber-300'
                        : 'border-[#E2E8F0] hover:border-blue-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isHigh
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-[#0025AE] border border-blue-200'
                            }`}
                          >
                            {rem.severity}
                          </span>
                          <span className="text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            {typeLabel}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              rem.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : rem.status === 'completed'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {rem.status}
                          </span>
                          <span className="text-xs font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {rem.account_name}
                          </span>
                          {rem.csm_owner && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Owner: {rem.csm_owner}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {rem.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                          {rem.description}
                        </p>
                      </div>

                      {/* Action buttons */}
                      {rem.status === 'active' ? (
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <button
                            onClick={() => handleCompleteReminder(rem.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            title="Mark reminder resolved"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                          <button
                            onClick={() => handleDismissReminder(rem.id)}
                            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                            title="Dismiss reminder with reason"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 font-mono self-start sm:self-center bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          {rem.status === 'completed' ? '✓ Resolved' : `Dismissed: ${rem.dismissed_reason || 'N/A'}`}
                        </div>
                      )}
                    </div>

                    {/* Metadata & Audit footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>Trigger: <strong className="text-slate-700">{rem.trigger_condition}</strong></span>
                        {rem.associated_task_id && (
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            Linked Task: {rem.associated_task_id}
                          </span>
                        )}
                        {rem.due_date && <span>Due: {rem.due_date}</span>}
                      </div>
                      <div className="text-slate-400 truncate">
                        Fingerprint: {rem.issue_key}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: Recurring Customer Problems (Task D) */}
      {activeSubTab === 'recurring_problems' && (
        <div className="space-y-5">
          {/* Top Engine Banner */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-md border border-purple-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Task D Engine: Cross-Customer Problem Correlation
                </span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Telemetry + Support + Survey Ingestion
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#020062] font-headline">
                Recurring Customer Problems Registry
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                Synthesizes repeated friction patterns across customer accounts. Groups related feedback, support tickets, and usage contractions into evidence-linked problem clusters while strictly distinguishing observed correlation from confirmed root cause.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefreshRecurring}
                disabled={refreshingRecurring}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingRecurring ? 'animate-spin' : ''}`} />
                {refreshingRecurring ? 'Re-clustering...' : 'Re-cluster & Refresh Telemetry'}
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
              <span className="text-slate-400 font-medium block">Problems Identified</span>
              <span className="text-xl font-bold font-mono text-purple-900 mt-0.5">
                {recurringReport?.total_problems_identified || 0}
              </span>
            </div>
            <div className="bg-white border border-rose-200 bg-rose-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-rose-700 font-medium block">Critical Clusters</span>
              <span className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                {recurringReport?.critical_problems_count || 0}
              </span>
            </div>
            <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-indigo-700 font-medium block">Impacted Accounts</span>
              <span className="text-xl font-bold font-mono text-indigo-900 mt-0.5">
                {recurringReport?.total_accounts_impacted || 0}
              </span>
            </div>
            <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-emerald-700 font-medium block">Portfolio ARR at Risk</span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                ${(recurringReport?.total_arr_at_risk || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search recurring problems, complaints, or accounts..."
                value={recurringSearch}
                onChange={(e) => setRecurringSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <select
                value={recurringCategoryFilter}
                onChange={(e) => setRecurringCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="all">All Categories</option>
                <option value="API & Webhook Reliability">API & Webhook Reliability</option>
                <option value="Authentication & Access Configuration">Authentication & Access Configuration</option>
                <option value="Onboarding & User Enablement">Onboarding & User Enablement</option>
                <option value="Data Processing & Performance">Data Processing & Performance</option>
                <option value="Contract & Value Realization">Contract & Value Realization</option>
              </select>

              <select
                value={recurringSeverityFilter}
                onChange={(e) => setRecurringSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Severity</option>
                <option value="high">High Severity</option>
                <option value="medium">Medium Severity</option>
              </select>
            </div>
          </div>

          {/* Problems List */}
          {filteredProblems.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center space-y-3">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No recurring customer problems match your filter</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try clearing search terms or re-cluster signals across all active accounts.
              </p>
              <button
                type="button"
                onClick={handleRefreshRecurring}
                className="px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold hover:bg-purple-100 cursor-pointer"
              >
                Re-cluster Problems
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProblems.map((prob) => {
                const isExpanded = expandedProblemId === prob.id;
                const sevBadge =
                  prob.severity === 'critical'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : prob.severity === 'high'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';

                return (
                  <div
                    key={prob.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4 transition-all hover:border-purple-300"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${sevBadge}`}>
                            {prob.severity}
                          </span>
                          <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-100">
                            {prob.category}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Cluster: {prob.cluster_key}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#020062]">{prob.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{prob.summary}</p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1.5 shrink-0 text-xs">
                        <div className="bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl font-mono text-right">
                          <span className="text-purple-700 font-bold block">
                            ${prob.total_arr_affected.toLocaleString()} ARR
                          </span>
                          <span className="text-[11px] text-purple-600">
                            Across {prob.total_affected_accounts} Accounts
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {prob.frequency_score} signals ({prob.feedback_count} feedback, {prob.support_ticket_count} tickets, {prob.usage_drop_signal_count} usage drops)
                        </span>
                      </div>
                    </div>

                    {/* Task D Critical Distinction: Observed Correlation vs Root Cause */}
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span className="font-bold text-amber-900 uppercase tracking-wider text-[11px] font-mono">
                            Distinction: Observed Correlation vs Root Cause
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            Relationship: {prob.relationship_type.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-amber-200">
                            Status: {prob.root_cause_status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <p className="text-amber-900 leading-relaxed font-sans text-xs">
                        {prob.correlation_explanation}
                      </p>

                      <div className="pt-2 border-t border-amber-200/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <strong className="text-amber-900 block mb-1">Confounding Factors to Verify:</strong>
                          <ul className="space-y-0.5 text-amber-800 list-disc list-inside">
                            {prob.confounding_factors.map((factor, fIdx) => (
                              <li key={fIdx}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-amber-900 block mb-1">Empirical Investigation Required:</strong>
                          <p className="text-amber-800 leading-snug">{prob.investigation_needed}</p>
                        </div>
                      </div>
                    </div>

                    {/* Repeated Complaints & Adoption Difficulties */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Repeated Complaints */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                          <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" /> Repeated Customer Complaints
                        </span>
                        {prob.repeated_complaints.length > 0 ? (
                          <ul className="space-y-1.5">
                            {prob.repeated_complaints.map((comp, cIdx) => (
                              <li key={cIdx} className="text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200/70 text-[11px] leading-snug">
                                &ldquo;{comp}&rdquo;
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 text-[11px]">No verbatim quotes recorded yet.</p>
                        )}
                      </div>

                      {/* Adoption Difficulties */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-600" /> Identified Adoption Difficulties
                        </span>
                        {prob.adoption_difficulties.length > 0 ? (
                          <ul className="space-y-1.5">
                            {prob.adoption_difficulties.map((diff, dIdx) => (
                              <li key={dIdx} className="text-slate-700 flex items-start gap-1.5 text-[11px] leading-snug">
                                <span className="text-rose-500 font-bold">•</span>
                                <span>{diff}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 text-[11px]">No adoption barriers noted.</p>
                        )}
                      </div>
                    </div>

                    {/* Toggle Button for Evidence Links and Affected Accounts */}
                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setExpandedProblemId(isExpanded ? null : prob.id)}
                        className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1.5 cursor-pointer py-1"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {isExpanded ? 'Hide Supporting Evidence & Accounts' : `Inspect ${prob.affected_accounts.length} Affected Accounts & ${prob.evidence_links.length} Linked Records`}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <span className="text-[11px] text-slate-400 font-mono">
                        Observed: {new Date(prob.first_observed_at).toLocaleDateString()} &rarr; {new Date(prob.last_observed_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Expanded Drawer: Affected Accounts & Granular Evidence Links */}
                    {isExpanded && (
                      <div className="space-y-4 pt-3 border-t border-[#E2E8F0]">
                        {/* Affected Accounts */}
                        <div className="space-y-2">
                          <span className="font-bold text-slate-800 text-xs block">
                            Impacted Customer Accounts ({prob.affected_accounts.length})
                          </span>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                                <tr>
                                  <th className="py-2 px-3">Account Name</th>
                                  <th className="py-2 px-3">ARR</th>
                                  <th className="py-2 px-3">CSM Owner</th>
                                  <th className="py-2 px-3">Health / Risk</th>
                                  <th className="py-2 px-3">Primary Complaint</th>
                                  <th className="py-2 px-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {prob.affected_accounts.map((acc) => (
                                  <tr key={acc.account_id} className="hover:bg-slate-50/80">
                                    <td className="py-2.5 px-3 font-semibold text-[#020062]">
                                      {acc.account_name}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono">
                                      ${acc.arr.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">
                                      {acc.csm_owner}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        acc.risk_level === 'critical' ? 'bg-rose-100 text-rose-800' :
                                        acc.risk_level === 'high' ? 'bg-amber-100 text-amber-800' :
                                        'bg-slate-100 text-slate-700'
                                      }`}>
                                        {acc.health_score} / {acc.risk_level}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={acc.primary_complaint}>
                                      {acc.primary_complaint}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAccountId(acc.account_id);
                                          onSelectAccount?.(acc.account_id);
                                        }}
                                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold text-[11px] cursor-pointer"
                                      >
                                        Select Account
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Granular Supporting Evidence Records */}
                        <div className="space-y-2">
                          <span className="font-bold text-slate-800 text-xs block">
                            Granular Linked Records &amp; Telemetry Drops ({prob.evidence_links.length})
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {prob.evidence_links.map((ev, eIdx) => {
                              const typeColor =
                                ev.evidence_type === 'feedback'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : ev.evidence_type === 'support_ticket'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200';

                              return (
                                <div
                                  key={eIdx}
                                  className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-1.5 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${typeColor}`}>
                                      {ev.evidence_type.toUpperCase()}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {ev.record_id} • {new Date(ev.timestamp).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="font-semibold text-slate-800 truncate">
                                    {ev.account_name}: {ev.title}
                                  </div>
                                  <p className="text-[11px] text-slate-600 line-clamp-2">
                                    {ev.description_or_quote}
                                  </p>
                                  {ev.metric_value && (
                                    <div className="text-[10px] font-mono text-purple-700 font-semibold">
                                      Metric: {ev.metric_value}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: Actionable Improvement Insights (Task E) */}
      {activeSubTab === 'improvement_insights' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-600" /> Member 3 — Task E: Actionable Improvement Insights
                </span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Cross-Disciplinary Retention Initiatives
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#020062] font-headline">
                Manager &amp; CSM Improvement Insights
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                Recommends concrete improvements synthesized from recurring customer friction across onboarding, customer training clinics, product architectural changes, and process documentation. Tracks subsequent customer behavioral telemetry following implementation.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefreshInsights}
                disabled={loadingInsights}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingInsights ? 'animate-spin' : ''}`} />
                {loadingInsights ? 'Refreshing...' : 'Refresh Telemetry & Insights'}
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
              <span className="text-slate-400 font-medium block">Total Initiatives</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {insightsReport?.total_insights || 0}
              </span>
            </div>
            <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-amber-700 font-medium block">Active Recommendations</span>
              <span className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                {insightsReport?.active_recommendations || 0}
              </span>
            </div>
            <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-emerald-700 font-medium block">Implemented &amp; Monitoring</span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                {insightsReport?.implemented_initiatives || 0}
              </span>
            </div>
            <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-xl p-3 shadow-xs">
              <span className="text-indigo-700 font-medium block">Total Protected ARR</span>
              <span className="text-xl font-bold font-mono text-indigo-900 mt-0.5">
                ${(insightsReport?.total_arr_protected || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search initiatives, actions, owners, or accounts..."
                value={insightSearch}
                onChange={(e) => setInsightSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <select
                value={insightCategoryFilter}
                onChange={(e) => setInsightCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="all">All Disciplines</option>
                <option value="onboarding_improvement">Onboarding Improvements</option>
                <option value="customer_training">Customer Training &amp; Clinics</option>
                <option value="product_change">Product Architectural Changes</option>
                <option value="documentation_process">Documentation &amp; Process</option>
              </select>

              <select
                value={insightStatusFilter}
                onChange={(e) => setInsightStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-slate-700 font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="recommended">Recommended</option>
                <option value="planned">Planned</option>
                <option value="implemented">Implemented</option>
                <option value="monitoring">Monitoring</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Initiatives List */}
          {filteredInsights.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center space-y-3">
              <Lightbulb className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No improvement insights match your filter</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try clearing search terms or selecting another category filter.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredInsights.map((ins) => {
                const categoryBadge =
                  ins.category === 'onboarding_improvement'
                    ? { label: 'ONBOARDING IMPROVEMENT', color: 'bg-sky-50 text-sky-700 border-sky-200' }
                    : ins.category === 'customer_training'
                    ? { label: 'CUSTOMER TRAINING & CLINIC', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                    : ins.category === 'product_change'
                    ? { label: 'PRODUCT ARCHITECTURAL CHANGE', color: 'bg-purple-50 text-purple-700 border-purple-200' }
                    : { label: 'DOCUMENTATION & PROCESS', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

                const statusBadge =
                  ins.status === 'recommended'
                    ? { label: 'RECOMMENDED', color: 'bg-amber-50 text-amber-700 border-amber-200' }
                    : ins.status === 'planned'
                    ? { label: 'PLANNED', color: 'bg-blue-50 text-blue-700 border-blue-200' }
                    : ins.status === 'implemented'
                    ? { label: 'IMPLEMENTED', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                    : ins.status === 'monitoring'
                    ? { label: 'MONITORING OUTCOME', color: 'bg-teal-50 text-teal-700 border-teal-200' }
                    : { label: 'COMPLETED', color: 'bg-slate-100 text-slate-700 border-slate-200' };

                const verdictBadge = ins.subsequent_behavior?.verdict === 'improving'
                  ? { label: '🌿 REBOUNDING (+USAGE)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                  : ins.subsequent_behavior?.verdict === 'stable'
                  ? { label: '🔵 STABILIZED', color: 'bg-blue-50 text-blue-700 border-blue-200' }
                  : ins.subsequent_behavior?.verdict === 'deteriorating'
                  ? { label: '🔴 DETERIORATING', color: 'bg-rose-50 text-rose-700 border-rose-200' }
                  : { label: '🟡 MONITORING DATA', color: 'bg-amber-50 text-amber-700 border-amber-200' };

                return (
                  <div
                    key={ins.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-5 transition-all hover:border-emerald-300"
                  >
                    {/* Top Row: Category, Status, ARR */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${categoryBadge.color}`}>
                          {categoryBadge.label}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Effort: {ins.estimated_effort}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          ${ins.total_arr_protected.toLocaleString()} Protected ARR
                        </span>
                      </div>
                    </div>

                    {/* Linked Problem Banner */}
                    <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-700 font-semibold truncate">
                        <span className="text-purple-600 font-mono text-[10px] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          LINKED PROBLEM
                        </span>
                        <span className="truncate">{ins.problem_title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {ins.problem_id}
                      </span>
                    </div>

                    {/* Main Title & Action Content */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-bold text-[#020062] font-headline">
                          {ins.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-semibold text-slate-700">Target Audience:</span> {ins.target_audience} •{' '}
                          <span className="font-semibold text-slate-700">Initiative Owner:</span> {ins.owner_role}
                        </p>
                      </div>

                      {/* Recommended Action Card */}
                      <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1.5">
                        <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Recommended Action for Manager:
                        </div>
                        <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                          {ins.recommended_action}
                        </p>
                      </div>

                      {/* Rationale & Expected Lift */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-1">
                          <span className="font-semibold text-slate-700 block">Root Problem Rationale:</span>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {ins.rationale}
                          </p>
                        </div>
                        <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-1">
                          <span className="font-semibold text-slate-700 block flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> Expected Retention Lift:
                          </span>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {ins.expected_retention_lift}
                          </p>
                        </div>
                      </div>

                      {/* Affected Customer Accounts */}
                      <div className="pt-1">
                        <span className="text-xs font-bold text-slate-700 block mb-1.5">
                          Target / Affected Customer Accounts ({ins.affected_customers.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {ins.affected_customers.map((custName, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                const acc = accounts.find((a) => a.name.toLowerCase().includes(custName.toLowerCase()));
                                if (acc) {
                                  setSelectedAccountId(acc.id);
                                  onSelectAccount?.(acc.id);
                                }
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <User className="w-3 h-3 text-slate-500" />
                              {custName}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Subsequent Customer Behavior Tracker Section */}
                    <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-blue-600" /> Subsequent Customer Behavioral Outcome Tracking
                        </span>

                        {ins.status === 'recommended' || ins.status === 'planned' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInsightForImplement(ins);
                              setShowImplementModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Check className="w-3.5 h-3.5" /> Adopt &amp; Implement Initiative
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEvaluateOutcome(ins.id)}
                            disabled={evaluatingInsightId === ins.id}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${evaluatingInsightId === ins.id ? 'animate-spin' : ''}`} />
                            {evaluatingInsightId === ins.id ? 'Evaluating...' : 'Re-evaluate Telemetry'}
                          </button>
                        )}
                      </div>

                      {ins.subsequent_behavior ? (
                        <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <span className="text-[11px] text-slate-500">
                              Implemented by <strong className="text-slate-800">{ins.implemented_by}</strong> on {ins.implemented_at ? new Date(ins.implemented_at).toLocaleDateString() : 'Recent'}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${verdictBadge.color}`}>
                              {verdictBadge.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-medium">Usage Trajectory</span>
                              <span className="text-sm font-bold font-mono text-emerald-700">
                                {ins.subsequent_behavior.usage_delta_pct > 0 ? `+${ins.subsequent_behavior.usage_delta_pct}%` : `${ins.subsequent_behavior.usage_delta_pct}%`}
                              </span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-medium">Subsequent Tickets</span>
                              <span className="text-sm font-bold font-mono text-slate-800">
                                {ins.subsequent_behavior.subsequent_tickets_count} logged
                              </span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 block font-medium">Follow-up CSAT</span>
                              <span className="text-sm font-bold font-mono text-indigo-700">
                                {ins.subsequent_behavior.subsequent_feedback_rating ? `${ins.subsequent_behavior.subsequent_feedback_rating}/10` : 'Pending'}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic">
                            "{ins.subsequent_behavior.behavior_summary}"
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                          <span>Awaiting manager adoption to initiate subsequent behavioral telemetry tracking.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Adopt & Implement Initiative */}
      {showImplementModal && selectedInsightForImplement && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleImplementInitiative}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-emerald-600" /> Adopt &amp; Implement Improvement Initiative
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowImplementModal(false);
                  setSelectedInsightForImplement(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-mono text-[10px] text-emerald-700 font-bold uppercase">
                  {selectedInsightForImplement.category.replace('_', ' ')}
                </span>
                <h4 className="font-bold text-slate-900 text-xs">
                  {selectedInsightForImplement.title}
                </h4>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  {selectedInsightForImplement.recommended_action}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Manager / CSM Owner Name:
                </label>
                <input
                  type="text"
                  required
                  value={implementManagerName}
                  onChange={(e) => setImplementManagerName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins (CSM Lead)"
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Implementation Notes &amp; Target Milestone:
                </label>
                <textarea
                  rows={3}
                  value={implementNotes}
                  onChange={(e) => setImplementNotes(e.target.value)}
                  placeholder="e.g. Scheduled clinic with customer IT leads; verified metadata xml endpoint deployed to production."
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
                Upon adoption, status will transition to <strong>IMPLEMENTED</strong> and real-time telemetry tracking will monitor subsequent usage delta and support ticket resolution.
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImplementModal(false);
                  setSelectedInsightForImplement(null);
                }}
                className="px-4 py-2 bg-[#F1F5F9] text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={implementing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {implementing ? 'Implementing...' : 'Confirm Adoption & Track'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Modal: Create Custom Reminder */}
      {showCreateReminderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateManualReminder}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-600" /> Create Custom Account Reminder
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateReminderModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createReminderError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {createReminderError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Account:</label>
                <select
                  value={newReminderAccountId}
                  onChange={(e) => setNewReminderAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-slate-800 font-semibold"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (${acc.arr.toLocaleString()} - Risk: {acc.risk_score})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reminder Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule adoption checkpoint with VP Engineering"
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Context:</label>
                <textarea
                  rows={2}
                  placeholder="Specific follow-up required or reason for flag..."
                  value={newReminderDesc}
                  onChange={(e) => setNewReminderDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Severity:</label>
                  <select
                    value={newReminderSeverity}
                    onChange={(e) => setNewReminderSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-slate-800"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date (Optional):</label>
                  <input
                    type="date"
                    value={newReminderDueDate}
                    onChange={(e) => setNewReminderDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateReminderModal(false)}
                className="px-4 py-2 bg-[#F1F5F9] text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingReminder}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {creatingReminder ? 'Creating...' : 'Create Reminder'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Dispatch Survey */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2563EB]" /> Dispatch Feedback Survey
              </h3>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispatchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {dispatchError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Account:</label>
                <input
                  type="text"
                  disabled
                  value={selectedAccount ? `${selectedAccount.name} (Risk: ${selectedAccount.risk_score})` : 'Select account'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Channel:</label>
                <select
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option>Email (Approved Customer-Facing Channel)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custom Invitation Message (Optional):
                </label>
                <textarea
                  rows={3}
                  value={customIntro}
                  onChange={(e) => setCustomIntro(e.target.value)}
                  placeholder="e.g. Hi David, we noticed recent shifts in API usage and wanted to check in to ensure you have the engineering support you need..."
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-3">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 bg-[#F1F5F9] text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchSurvey}
                disabled={dispatching}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {dispatching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Dispatch Survey
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
