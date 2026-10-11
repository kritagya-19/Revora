import { useState, useEffect, useMemo } from 'react';
import type {
  CustomerOutcomeTimelineResponse,
  TimelineEventType,
  AccountRiskSummary
} from '../types/api';
import { fetchCustomerOutcomeTimeline } from '../services/api';
import {
  History,
  Calendar,
  CheckCircle2,
  Clock,
  PlayCircle,
  User,
  Sparkles,
  RefreshCw,
  Search,
  ArrowRight,
  Layers,
  MessageSquare,
  BookmarkCheck,
  CalendarDays,
  ShieldAlert,
  Mail,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface CustomerOutcomeTimelineViewProps {
  initialAccountId?: string;
  accounts: AccountRiskSummary[];
  onSelectAccount?: (accountId: string) => void;
  onNavigateToCopilot?: (accountId: string) => void;
  onNavigateToAutopsy?: (accountId: string) => void;
  onNavigateToTracker?: () => void;
  currency?: 'USD' | 'INR';
}

export function CustomerOutcomeTimelineView({
  initialAccountId,
  accounts,
  onSelectAccount,
  onNavigateToCopilot,
  onNavigateToAutopsy,
  onNavigateToTracker,
  currency = 'USD'
}: CustomerOutcomeTimelineViewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || (accounts.length > 0 ? accounts[0].id : '')
  );
  const [timelineData, setTimelineData] = useState<CustomerOutcomeTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'commitments' | 'summary'>('timeline');

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  const loadTimeline = async (accId: string) => {
    if (!accId) return;
    try {
      setLoading(true);
      const data = await fetchCustomerOutcomeTimeline(accId);
      setTimelineData(data);
    } catch (err) {
      console.error('Failed to load outcome timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadTimeline(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (!timelineData) return [];
    return timelineData.events.filter((event) => {
      if (eventTypeFilter !== 'all' && event.event_type !== eventTypeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        event.author_or_actor.toLowerCase().includes(q) ||
        (event.customer_response || '').toLowerCase().includes(q) ||
        (event.commitments || '').toLowerCase().includes(q) ||
        (event.next_steps || '').toLowerCase().includes(q)
      );
    });
  }, [timelineData, eventTypeFilter, searchQuery]);

  const getEventBadge = (type: TimelineEventType) => {
    switch (type) {
      case 'outcome_captured':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Outcome Captured
          </span>
        );
      case 'action_executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <PlayCircle className="w-3.5 h-3.5 text-teal-600" />
            Action Executed
          </span>
        );
      case 'approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
            Intervention Approved
          </span>
        );
      case 'recommendation':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            AI Recommendation
          </span>
        );
      case 'risk_assessment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Risk Autopsy
          </span>
        );
      case 'meeting_note':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
            Meeting Note
          </span>
        );
      case 'email_communication':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <Mail className="w-3.5 h-3.5 text-purple-600" />
            Email Touchpoint
          </span>
        );
      case 'signal':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 font-mono">
            Telemetry Signal
          </span>
        );
    }
  };

  const getEventIcon = (type: TimelineEventType) => {
    switch (type) {
      case 'outcome_captured':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'action_executed':
        return <PlayCircle className="w-5 h-5 text-teal-600" />;
      case 'approval':
        return <BookmarkCheck className="w-5 h-5 text-blue-600" />;
      case 'recommendation':
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
      case 'risk_assessment':
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case 'meeting_note':
        return <CalendarDays className="w-5 h-5 text-amber-600" />;
      case 'email_communication':
        return <Mail className="w-5 h-5 text-purple-600" />;
      case 'signal':
      default:
        return <Layers className="w-5 h-5 text-slate-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inr = amount * 83;
      return `₹${(inr / 100000).toFixed(1)}L`;
    }
    return `$${(amount / 1000).toFixed(0)}k ARR`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Feature 2 Overview */}
      <div className="bg-gradient-to-r from-[#020062] via-[#081B4E] to-[#1E3A8A] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-xs mb-3">
              <History className="w-3.5 h-3.5 text-blue-300" />
              Feature 2 — Customer Outcome Timeline
            </div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-white">
              Complete Account History & Outcome Journal
            </h2>
            <p className="text-blue-100 text-sm mt-1.5 leading-relaxed font-body">
              Displays the complete history of an account's signals, recommendations, approvals, actions,
              customer responses, and outcomes in chronological order. The salesperson and AI can understand
              the account's history without reconstructing it manually.
            </p>
          </div>

          {/* Account Selector Dropdown */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shrink-0 min-w-[280px]">
            <label className="block text-xs font-semibold text-blue-200 mb-1.5 font-mono uppercase">
              Select Account to Inspect
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                if (onSelectAccount) onSelectAccount(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white text-[#020062] font-semibold text-sm focus:outline-hidden"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.risk_level.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Account Snapshot Bar */}
        {timelineData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">Customer Account</span>
              <span className="text-base font-bold text-white block mt-0.5 truncate">
                {timelineData.account_name}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">ARR Valuation</span>
              <span className="text-base font-bold text-white block mt-0.5">
                {formatCurrency(timelineData.arr)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">Total Timeline Events</span>
              <span className="text-2xl font-bold text-white block mt-0.5">
                {timelineData.summary.total_events}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">Outcomes Logged</span>
              <span className="text-2xl font-bold text-emerald-300 block mt-0.5">
                {timelineData.summary.outcomes_captured_count}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">Open Commitments</span>
              <span className="text-2xl font-bold text-amber-300 block mt-0.5">
                {timelineData.summary.outstanding_commitments_count}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-blue-200 text-xs block font-medium">CSM Owner</span>
              <span className="text-sm font-semibold text-white block mt-0.5 truncate">
                {timelineData.csm_owner}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Sub-Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-[#0025AE] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Chronological Timeline ({timelineData?.events.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('commitments')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'commitments'
                ? 'bg-[#0025AE] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Outstanding Commitments</span>
            {timelineData && timelineData.outstanding_commitments.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-400 text-[#020062] font-mono">
                {timelineData.outstanding_commitments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-[#0025AE] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Account Executive Briefing
          </button>
        </div>

        {/* Search & Event Type Filter */}
        <div className="flex items-center gap-3 flex-1 max-w-lg justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search timeline notes, commitments, responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB]"
            />
          </div>

          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 text-slate-700 text-xs font-semibold focus:outline-hidden"
          >
            <option value="all">All Events</option>
            <option value="outcome_captured">Outcomes & Responses</option>
            <option value="action_executed">Executed Actions</option>
            <option value="recommendation">Recommendations</option>
            <option value="risk_assessment">Risk Autopsies</option>
            <option value="meeting_note">Meeting Notes</option>
            <option value="email_communication">Email Responses</option>
            <option value="signal">Signals & Telemetry</option>
          </select>

          <button
            onClick={() => loadTimeline(selectedAccountId)}
            className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 text-slate-500 cursor-pointer"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-16 rounded-xl border border-[#E2E8F0] text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#2563EB] mb-3" />
          <p className="font-semibold text-sm text-[#020062]">Compiling Chronological Account History...</p>
          <p className="text-xs text-slate-400 mt-1">
            Aggregating signals, previous autopsies, proposals, executed actions, and recorded outcomes.
          </p>
        </div>
      ) : activeTab === 'commitments' ? (
        /* TAB: Outstanding Commitments */
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#020062] font-headline">
                Agreed Commitments & Follow-Up Deliverables
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every commitment captured in customer outcomes or meeting notes for {timelineData?.account_name}.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
              {timelineData?.outstanding_commitments.length || 0} Commitments
            </span>
          </div>

          {!timelineData?.outstanding_commitments.length ? (
            <div className="p-12 text-center text-slate-400">
              <BookmarkCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No open commitments recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                Log outcomes in Feature 1 (Action & Outcome Tracker) to record commitments.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timelineData.outstanding_commitments.map((com) => (
                <div
                  key={com.commitment_id}
                  className="bg-amber-50/40 border border-amber-200 rounded-xl p-4.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold text-amber-900 font-mono">
                        {com.commitment_id}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold font-mono uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      {com.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 font-medium leading-relaxed font-body">
                    {com.title}
                  </p>

                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {com.owner}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Due: {com.due_date || 'Next Sync'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'summary' ? (
        /* TAB: Account Executive Briefing */
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-[#020062] font-headline">
              AI Salesperson & Account Executive Briefing
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant synthesized summary of the customer's trajectory, preventing manual account history reconstruction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
              <span className="text-xs font-bold text-[#0025AE] uppercase tracking-wider font-mono">
                1. Situation & Risk Baseline
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                Account stands at <strong>{timelineData?.current_risk_level.toUpperCase()}</strong> risk (Score: {timelineData?.current_risk_score}/100).
                Earliest telemetry recorded on{' '}
                <strong>
                  {timelineData?.summary.first_interaction
                    ? new Date(timelineData.summary.first_interaction).toLocaleDateString()
                    : 'N/A'}
                </strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1.5">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider font-mono">
                2. Actions Undertaken
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                The team has formulated <strong>{timelineData?.summary.recommendations_count}</strong> AI recommendations, resulting in{' '}
                <strong>{timelineData?.summary.actions_executed_count}</strong> verified executions and{' '}
                <strong>{timelineData?.summary.outcomes_captured_count}</strong> captured outcomes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">
                3. Customer Posture
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                Feedback captures active collaboration. Currently <strong>{timelineData?.outstanding_commitments.length}</strong> agreed
                deliverables are actively outstanding between CSM and client leadership.
              </p>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700">
              Need to take immediate intervention or log a fresh outcome?
            </span>
            <div className="flex items-center gap-2">
              {onNavigateToTracker && (
                <button
                  onClick={onNavigateToTracker}
                  className="px-3 py-1.5 rounded-lg bg-[#0025AE] text-white text-xs font-semibold hover:bg-[#020062] transition-all cursor-pointer"
                >
                  Go to Action Tracker
                </button>
              )}
              {onNavigateToCopilot && (
                <button
                  onClick={() => onNavigateToCopilot(selectedAccountId)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  Draft in Copilot
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAB: Chronological Timeline Feed */
        <div className="space-y-4">
          <div className="relative pl-6 space-y-6 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {filteredEvents.map((event) => {
              const isExpanded = expandedEventId === event.id;
              const hasResponseOrCommitments =
                !!event.customer_response || !!event.commitments || !!event.next_steps;

              return (
                <div key={event.id} className="relative group">
                  {/* Timeline Dot / Icon */}
                  <div className="absolute -left-6 top-1.5 w-7 h-7 rounded-full bg-white border-2 border-slate-300 group-hover:border-[#2563EB] flex items-center justify-center shadow-xs transition-colors z-10">
                    <span className="scale-75">{getEventIcon(event.event_type)}</span>
                  </div>

                  {/* Card Container */}
                  <div
                    className={`bg-white rounded-xl border transition-all p-5 shadow-2xs hover:shadow-xs hover:border-[#2563EB]/40 ${
                      event.event_type === 'outcome_captured'
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : event.event_type === 'action_executed'
                        ? 'border-teal-200 bg-teal-50/15'
                        : event.event_type === 'risk_assessment'
                        ? 'border-rose-200 bg-rose-50/15'
                        : 'border-[#E2E8F0]'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getEventBadge(event.event_type)}
                        <span className="text-xs text-slate-400 font-mono">•</span>
                        <span className="text-xs font-bold text-slate-700 font-body">
                          {event.author_or_actor}
                        </span>
                        {event.status && (
                          <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {event.status}
                          </span>
                        )}
                      </div>

                      {/* When Recorded */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-[#020062] mt-2 font-headline leading-snug">
                      {event.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed font-body">
                      {event.description}
                    </p>

                    {/* Rich Details Callout for Outcomes: Customer Response, Commitments, Next Steps */}
                    {hasResponseOrCommitments && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-lg border">
                        {event.customer_response && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 font-mono uppercase">
                              <MessageSquare className="w-3 h-3 text-[#2563EB]" />
                              Customer Response
                            </span>
                            <p className="text-xs text-slate-700 font-body">
                              {event.customer_response}
                            </p>
                          </div>
                        )}

                        {event.commitments && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1 font-mono uppercase">
                              <BookmarkCheck className="w-3 h-3 text-amber-600" />
                              Commitments Made
                            </span>
                            <p className="text-xs text-slate-700 font-body">
                              {event.commitments}
                            </p>
                          </div>
                        )}

                        {event.next_steps && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-teal-800 flex items-center gap-1 font-mono uppercase">
                              <ArrowRight className="w-3 h-3 text-teal-600" />
                              Next Steps
                            </span>
                            <p className="text-xs text-slate-700 font-body">
                              {event.next_steps}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recommendation Payload Expansion */}
                    {event.original_recommendation && Object.keys(event.original_recommendation).length > 0 && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                          className="text-xs text-[#2563EB] hover:text-[#0025AE] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide' : 'View'} Recommendation Payload</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                            {event.original_recommendation.subject && (
                              <p><strong>Subject:</strong> {event.original_recommendation.subject}</p>
                            )}
                            {event.original_recommendation.recipient && (
                              <p><strong>Recipient:</strong> {event.original_recommendation.recipient}</p>
                            )}
                            {event.original_recommendation.body && (
                              <p className="pt-1 border-t border-slate-200 text-slate-600">
                                {event.original_recommendation.body}
                              </p>
                            )}
                            {event.original_recommendation.task && (
                              <p><strong>Task:</strong> {event.original_recommendation.task}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata & Evidence Links */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                      <div className="flex items-center gap-2">
                        <span>Event ID: {event.id}</span>
                        {event.evidence_ids && event.evidence_ids.length > 0 && (
                          <span>• Evidence: {event.evidence_ids.join(', ')}</span>
                        )}
                      </div>

                      {event.event_type === 'risk_assessment' && onNavigateToAutopsy && (
                        <button
                          onClick={() => onNavigateToAutopsy(event.account_id)}
                          className="text-[#0025AE] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Full Autopsy</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerOutcomeTimelineView;
