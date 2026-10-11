import { useState, useMemo, useEffect } from 'react';
import type { AccountDetail, Signal, CustomerFeedbackRecord, DynamicReminder, RecurringProblem } from '../types/api';
import {
  fetchFeedbackResponses,
  fetchReminders,
  completeReminder,
  dismissReminder,
  evaluateReminders,
  fetchRecurringProblemsForAccount
} from '../services/api';
import { FeedbackForm } from './FeedbackForm';
import { RiskBadge } from './RiskBadge';
import {
  Sparkles,
  Users,
  Activity,
  Calendar,
  Mail,
  ArrowLeft,
  AlertCircle,
  Clock,
  Bot,
  TrendingDown,
  Headphones,
  CalendarDays,
  FileText,
  Heart,
  MessageSquare,
  Plus,
  RefreshCw,
  BellRing,
  Check,
  CheckCircle2,
  Layers,
  HelpCircle
} from 'lucide-react';

interface CustomerDetailViewProps {
  account: AccountDetail;
  onBackToAccounts: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onInvestigateWithAI?: () => void;
  onNavigateToCopilot?: () => void;
  onNavigateToFeedback?: () => void;
}

export function CustomerDetailView({
  account,
  onBackToAccounts,
  currency = 'USD',
  onNavigateToApprovals,
  onInvestigateWithAI,
  onNavigateToCopilot,
  onNavigateToFeedback
}: CustomerDetailViewProps) {
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  // Saved Customer Feedback State
  const [feedbackRecords, setFeedbackRecords] = useState<CustomerFeedbackRecord[]>(account.feedback_records || []);
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  // Task B: Dynamic Reminders State
  const [reminders, setReminders] = useState<DynamicReminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState<boolean>(false);
  const [evaluatingReminders, setEvaluatingReminders] = useState<boolean>(false);
  const [reminderFilter, setReminderFilter] = useState<'active' | 'all'>('active');
  const [reminderActionMsg, setReminderActionMsg] = useState<string | null>(null);


  // Synchronize and fetch feedback records for this account when opened/reopened
  useEffect(() => {
    let isMounted = true;
    async function loadFeedback() {
      try {
        setLoadingFeedback(true);
        const records = await fetchFeedbackResponses(account.id);
        if (isMounted) {
          setFeedbackRecords(records);
        }
      } catch (err) {
        console.warn('Failed to load feedback records for account:', err);
        if (isMounted && account.feedback_records) {
          setFeedbackRecords(account.feedback_records);
        }
      } finally {
        if (isMounted) setLoadingFeedback(false);
      }
    }
    loadFeedback();
    return () => {
      isMounted = false;
    };
  }, [account.id]);

  const handleFeedbackSubmitted = (newRecord: CustomerFeedbackRecord) => {
    setFeedbackRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
  };

  const feedbackCount = feedbackRecords.length;
  const avgSatisfaction = feedbackCount > 0
    ? (feedbackRecords.reduce((sum, r) => sum + (r.submission.satisfaction_score || 0), 0) / feedbackCount).toFixed(1)
    : null;

  // Task B: Dynamic Reminders Effect & Handlers
  useEffect(() => {
    let isMounted = true;
    async function loadReminders() {
      try {
        setLoadingReminders(true);
        const data = await fetchReminders({ account_id: account.id });
        if (isMounted) setReminders(data);
      } catch (err) {
        console.warn('Failed to load reminders for account:', err);
      } finally {
        if (isMounted) setLoadingReminders(false);
      }
    }
    loadReminders();
    return () => {
      isMounted = false;
    };
  }, [account.id]);

  const handleCompleteReminder = async (id: string) => {
    try {
      const updated = await completeReminder(id);
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setReminderActionMsg(`Reminder marked as completed.`);
      setTimeout(() => setReminderActionMsg(null), 3500);
    } catch (err: any) {
      alert(`Failed to complete reminder: ${err.message}`);
    }
  };

  const handleDismissReminder = async (id: string) => {
    const reason = prompt('Optional dismissal reason (e.g., Reviewed on weekly call):', 'Reviewed and addressed by CSM');
    if (reason === null) return;
    try {
      const updated = await dismissReminder(id, reason);
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setReminderActionMsg(`Reminder dismissed.`);
      setTimeout(() => setReminderActionMsg(null), 3500);
    } catch (err: any) {
      alert(`Failed to dismiss reminder: ${err.message}`);
    }
  };

  const handleScanReminders = async () => {
    try {
      setEvaluatingReminders(true);
      await evaluateReminders();
      const data = await fetchReminders({ account_id: account.id });
      setReminders(data);
      setReminderActionMsg(`Early warning scan executed. Reminders updated.`);
      setTimeout(() => setReminderActionMsg(null), 3500);
    } catch (err: any) {
      alert(`Reminder scan failed: ${err.message}`);
    } finally {
      setEvaluatingReminders(false);
    }
  };

  // Task D: Recurring Customer Problems touching this account
  const [accountProblems, setAccountProblems] = useState<RecurringProblem[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadAccountProblems() {
      try {
        const data = await fetchRecurringProblemsForAccount(account.id);
        if (isMounted) setAccountProblems(data);
      } catch (err) {
        console.warn('Failed to load recurring problems for account:', err);
      }
    }
    loadAccountProblems();
    return () => {
      isMounted = false;
    };
  }, [account.id]);

  const filteredReminders = useMemo(() => {
    if (reminderFilter === 'active') {
      return reminders.filter((r) => r.status === 'active');
    }
    return reminders;
  }, [reminders, reminderFilter]);


  // Currency formatting
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      if (inrAmount >= 100000) return `₹${(inrAmount / 100000).toFixed(1)} L`;
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  // Timestamp formatting
  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return ts;
    }
  };

  // Filtered timeline signals for active account
  const filteredSignals = useMemo(() => {
    return (account.signals || []).filter((s) => {
      if (timelineFilter !== 'all' && s.source_category.toLowerCase() !== timelineFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [account.signals, timelineFilter]);

  // Handle "Investigate with AI"
  const handleInvestigateWithAI = () => {
    if (onInvestigateWithAI) {
      onInvestigateWithAI();
    }
  };

  // Helper for source category icon
  const getSourceIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'usage':
        return <Activity className="w-4 h-4 text-purple-500" />;
      case 'support':
        return <Headphones className="w-4 h-4 text-rose-500" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'calendar':
        return <CalendarDays className="w-4 h-4 text-amber-500" />;
      case 'crm':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const metrics = account.customer_metrics;

  return (
    <div className="space-y-6">
      {/* 1. TOP NAVIGATION & BREADCRUMB */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToAccounts}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-[#E2E8F0] hover:border-slate-300 px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Customer Accounts</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Customer Accounts</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{account.name}</span>
        </div>
      </div>

      {/* 2. CUSTOMER IDENTITY & ACTION HERO CARD */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
          {/* Left: Account Identity */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-normal">
                {account.name}
              </h1>
              <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {account.tier || 'Enterprise'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 capitalize">
                {account.status || 'Active'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
              <span>Domain: <strong className="text-slate-900 font-mono">{account.domain || 'saas.app'}</strong></span>
              <span>•</span>
              <span>Industry: <strong className="text-slate-900">{account.industry || 'B2B SaaS'}</strong></span>
              <span>•</span>
              <span>CSM Owner: <strong className="text-slate-900">{account.csm_owner}</strong></span>
            </div>
          </div>

          {/* Right: Key Stats & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* ARR Badge */}
            <div className="bg-[#FAFCFF] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                Contract ARR
              </span>
              <span className="text-lg font-bold text-slate-900 font-mono block">
                {formatCurrency(account.arr)}
              </span>
            </div>

            {/* Renewal Window */}
            <div className="bg-[#FAFCFF] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                Renewal Horizon
              </span>
              <div className="text-xs font-semibold text-slate-900 flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{account.renewal_date}</span>
              </div>
              <span className="text-[11px] text-rose-600 font-semibold block">
                {account.urgency_days_to_renewal} days remaining
              </span>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0025AE] text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                title="Record direct feedback for this account"
              >
                <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Record Feedback</span>
              </button>

              {onNavigateToFeedback && (
                <button
                  onClick={onNavigateToFeedback}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-semibold cursor-pointer transition-colors"
                  title="Trigger Survey & View Feedback Insights"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                  <span>Feedback Hub</span>
                </button>
              )}

              {onNavigateToCopilot && (
                <button
                  onClick={onNavigateToCopilot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Action Copilot</span>
                </button>
              )}

              <button
                onClick={handleInvestigateWithAI}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <Bot className="w-3.5 h-3.5 text-blue-100" />
                <span>Run AI Autopsy</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              </button>
            </div>
          </div>
        </div>

        {/* Warning Alert Banner */}
        {account.main_warning && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div className="flex-1 font-medium">
              <span className="font-bold">Detected Churn Signal: </span>
              {account.main_warning}
            </div>
          </div>
        )}
      </div>

      {/* 3. KEY METRICS & TELEMETRY FINDINGS (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Account Health
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#2563EB]">
              <Heart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.health_score ?? account.health_score ?? 50}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Status: <strong className="text-slate-700 capitalize">{account.status}</strong>
          </p>
        </div>

        {/* License Usage Contraction */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              License Usage
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 tracking-tight font-mono">
              {metrics?.usage_drop_pct ? `-${metrics.usage_drop_pct}%` : '-38%'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active Seats: {metrics?.active_users ?? 45} / {metrics?.baseline_users ?? 100}
          </p>
        </div>

        {/* Support Tickets */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Support Escalations
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
              <Headphones className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {metrics?.open_support_tickets ?? 3}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Urgent SLA tickets active
          </p>
        </div>

        {/* Engagement Lag */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              CSM Inactivity
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {metrics?.days_since_touchpoint ?? 50} days
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Since last customer meeting
          </p>
        </div>
      </div>

      {/* 4. CHRONOLOGICAL MULTI-SOURCE EVIDENCE TIMELINE */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-normal flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span>Multi-Source Chronological Evidence Feed</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified signals collected across Usage Telemetry, Zendesk, HubSpot CRM, and Calendar
            </p>
          </div>

          {/* Timeline Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            {['all', 'usage', 'support', 'crm', 'email'].map((cat) => (
              <button
                key={cat}
                onClick={() => setTimelineFilter(cat)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                  timelineFilter === cat
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Signal Items List */}
        <div className="divide-y divide-slate-100">
          {filteredSignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No evidence signals found for the selected category.
            </div>
          ) : (
            filteredSignals.map((sig) => (
              <div
                key={sig.id}
                onClick={() => setSelectedSignal(selectedSignal?.id === sig.id ? null : sig)}
                className="py-3 sm:py-3.5 hover:bg-slate-50/70 rounded-xl px-3 transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200/60 shrink-0">
                      {getSourceIcon(sig.source_category)}
                    </div>
                    <span className="font-semibold text-xs text-slate-900">
                      {sig.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                      {sig.source_category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {formatTimestamp(sig.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                  {sig.description}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. KEY STAKEHOLDERS & CONTACTS */}
      {account.contacts && account.contacts.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-normal flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>Key Stakeholders & Decision Makers</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified champions, executive sponsors, and technical buyers
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {account.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-[#FAFCFF] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">
                    {contact.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {contact.role || 'Stakeholder'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>{contact.role || 'Technical Lead'}</p>
                  <p className="font-mono text-slate-400">{contact.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5.5 DYNAMIC REMINDERS & ACTION ALERTS (TASK B) */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <BellRing className="w-3.5 h-3.5" /> Early Warning Engine
              </span>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Task B — Dynamic Reminders
              </span>
            </div>
            <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
              <span>Active Early Warning Reminders</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated reminders triggered by usage drops, inactivity, overdue tasks, or renewal proximity.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium">
              <button
                onClick={() => setReminderFilter('active')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  reminderFilter === 'active' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Active ({reminders.filter((r) => r.status === 'active').length})
              </button>
              <button
                onClick={() => setReminderFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  reminderFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All ({reminders.length})
              </button>
            </div>

            <button
              onClick={handleScanReminders}
              disabled={evaluatingReminders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              title="Run rules engine across account signals"
            >
              <Sparkles className={`w-3.5 h-3.5 ${evaluatingReminders ? 'animate-spin' : ''}`} />
              <span>{evaluatingReminders ? 'Scanning...' : 'Scan Rules'}</span>
            </button>
          </div>
        </div>

        {reminderActionMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reminderActionMsg}</span>
          </div>
        )}

        {/* Reminders list */}
        {loadingReminders && reminders.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
            Evaluating dynamic reminders for {account.name}...
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="bg-[#FAFCFF] border border-dashed border-[#CBD5E1] rounded-xl p-6 text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              {reminderFilter === 'active' ? 'No active early warning reminders for this account.' : 'No reminders recorded.'}
            </p>
            <p className="text-[11px] text-slate-500">
              Conditions are monitored continuously. Click "Scan Rules" to re-evaluate real-time metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReminders.map((rem) => {
              const isCritical = rem.severity === 'critical';
              const isHigh = rem.severity === 'high';
              const typeLabel = rem.reminder_type.replace('_', ' ').toUpperCase();
              return (
                <div
                  key={rem.id}
                  className={`border rounded-xl p-4 transition-all ${
                    rem.status === 'completed'
                      ? 'bg-slate-50/60 border-slate-200 opacity-75'
                      : rem.status === 'dismissed'
                      ? 'bg-slate-50/40 border-slate-200 opacity-60'
                      : isCritical
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : isHigh
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-[#E2E8F0] hover:border-blue-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
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
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {typeLabel}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            rem.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rem.status === 'completed'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {rem.status}
                        </span>
                        {rem.associated_task_id && (
                          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            Linked Task: {rem.associated_task_id}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {rem.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {rem.description}
                      </p>
                    </div>

                    {/* Actions */}
                    {rem.status === 'active' ? (
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <button
                          onClick={() => handleCompleteReminder(rem.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          title="Mark reminder resolved"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                        <button
                          onClick={() => handleDismissReminder(rem.id)}
                          className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                          title="Dismiss reminder with note"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-mono self-start sm:self-center">
                        {rem.status === 'completed' ? 'Resolved' : `Dismissed: ${rem.dismissed_reason || 'N/A'}`}
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Trigger: {rem.trigger_condition}</span>
                    <span>Dedup Key: {rem.issue_key}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5.6 CROSS-CUSTOMER RECURRING PROBLEM CLUSTERS (TASK D) */}
      {accountProblems.length > 0 && (
        <div className="border border-purple-200 rounded-2xl bg-gradient-to-r from-purple-50/50 via-white to-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Task D Pattern Intelligence
                </span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Cross-Customer Clusters
                </span>
              </div>
              <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                <span>Recurring Problem Clusters Touching This Account</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This account exhibits telemetry drops and support tickets correlated with recurring problems across the portfolio.
              </p>
            </div>

            {onNavigateToFeedback && (
              <button
                type="button"
                onClick={onNavigateToFeedback}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                <span>View Full Registry in Feedback Hub</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {accountProblems.map((prob) => {
              const sevBadge =
                prob.severity === 'critical'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : prob.severity === 'high'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200';

              return (
                <div
                  key={prob.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${sevBadge}`}>
                        {prob.severity}
                      </span>
                      <span className="text-xs font-bold text-[#020062]">{prob.title}</span>
                      <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                        {prob.category}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 shrink-0">
                      Portfolio Impact: ${prob.total_arr_affected.toLocaleString()} ARR ({prob.total_affected_accounts} accounts)
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {prob.summary}
                  </p>

                  {/* Correlation Callout */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-950">Observed Correlation vs Root Cause:</strong>
                      <span>{prob.correlation_explanation}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* 6. SAVED CUSTOMER FEEDBACK & CONTINUOUS IMPROVEMENT LOOP */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Voice of Customer
              </span>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Task A — Feedback Loop
              </span>
            </div>
            <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
              <span>Saved Customer Feedback & Experience History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified survey submissions, CSM check-ins, reported blockers, and AI-recommended retention actions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {feedbackCount > 0 && (
              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-xl text-xs">
                <span className="text-slate-500 font-medium">Recorded:</span>
                <span className="font-mono font-bold text-slate-900">{feedbackCount}</span>
                {avgSatisfaction && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 font-medium">Avg Rating:</span>
                    <span className="font-mono font-bold text-[#0025AE]">{avgSatisfaction}/10</span>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Feedback</span>
            </button>
          </div>
        </div>

        {/* Feedback List Content */}
        {loadingFeedback && feedbackRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
            Loading saved feedback records for {account.name}...
          </div>
        ) : feedbackRecords.length === 0 ? (
          <div className="bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-xl p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0025AE] flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Feedback Records Saved Yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No customer surveys or CSM check-in feedback have been recorded for {account.name}.
                Record direct feedback to generate AI churn analysis and staged retention actions.
              </p>
            </div>
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Feedback Response</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbackRecords.map((item) => {
              const score = item.submission?.satisfaction_score;
              const ana = item.analysis;
              const feedbackTypeLabel = (item.feedback_type || item.submission?.feedback_type || 'Customer Survey').replace('_', ' ').toUpperCase();
              return (
                <div
                  key={item.id}
                  className="bg-[#FAFCFF] border border-[#E2E8F0] hover:border-blue-300 rounded-xl p-4.5 space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs font-mono shrink-0 ${
                        (score || 10) <= 4 ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        (score || 10) <= 6 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {score ? `${score}/10` : 'N/A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{item.recipient_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({item.recipient_email})</span>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#0025AE] border border-blue-100">
                            {feedbackTypeLabel}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Recorded: {formatTimestamp(item.submitted_at || item.created_at)} • Token: {item.survey_code}
                        </span>
                      </div>
                    </div>

                    {ana && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase self-start sm:self-center ${
                        ana.urgency_level === 'critical' ? 'bg-rose-100 text-rose-800' :
                        ana.urgency_level === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-[#0025AE]'
                      }`}>
                        Urgency: {ana.urgency_level}
                      </span>
                    )}
                  </div>

                  {/* Customer verbatim report */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Primary Blocker:</span>
                        <p className="font-semibold text-slate-900 text-xs mt-0.5">
                          {item.submission?.primary_blocker || 'None reported'}
                        </p>
                      </div>
                      {item.submission?.unresolved_issues && (
                        <div>
                          <span className="text-slate-400 font-medium block text-[11px]">Unresolved Issues:</span>
                          <p className="text-slate-700 italic text-xs mt-0.5 leading-relaxed">
                            "{item.submission.unresolved_issues}"
                          </p>
                        </div>
                      )}
                      {item.submission?.feature_improvement_request && (
                        <div>
                          <span className="text-slate-400 font-medium block text-[11px]">Requested Improvement:</span>
                          <p className="text-slate-700 text-xs mt-0.5">
                            {item.submission.feature_improvement_request}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* AI Retention Recommendation */}
                    {ana && (
                      <div className="space-y-1.5 bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#0025AE] text-[11px] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI Retention Recommendation
                          </span>
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold text-slate-700">
                            {ana.classified_churn_reason.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-900 font-medium bg-white p-2 rounded border border-blue-200/60">
                          {ana.recommended_retention_action}
                        </p>
                        {ana.executive_summary && (
                          <p className="text-[11px] text-slate-600 italic">
                            {ana.executive_summary}
                          </p>
                        )}
                        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Sentiment: {ana.sentiment_label}</span>
                          <div className="flex gap-2">
                            {onNavigateToApprovals && (
                              <button
                                onClick={onNavigateToApprovals}
                                className="text-amber-800 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                              >
                                Review Approval Gate →
                              </button>
                            )}
                            {onNavigateToCopilot && (
                              <button
                                onClick={onNavigateToCopilot}
                                className="text-[#0025AE] hover:text-blue-800 font-bold hover:underline cursor-pointer"
                              >
                                Action Copilot →
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

      {/* Modal: Direct Feedback Form for this Account */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-2 sm:p-4 shadow-2xl border border-[#E2E8F0] my-8 max-h-[90vh] overflow-y-auto">
            <FeedbackForm
              accountId={account.id}
              accountName={account.name}
              recipientName={account.contacts?.[0]?.name}
              recipientEmail={account.contacts?.[0]?.email}
              onSubmitted={(record) => {
                handleFeedbackSubmitted(record);
                setShowFeedbackModal(false);
              }}
              onClose={() => setShowFeedbackModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailView;
