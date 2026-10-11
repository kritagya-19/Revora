import { useState, useEffect, useMemo } from 'react';
import type { ActionTrackerItem, ActionExecutionStatus, WorkStatus } from '../types/api';
import {
  fetchTrackedActions,
  saveActionOutcome,
  updateTrackedActionStatus,
  autoCaptureActionOutcome,
  syncApprovedProposalsToTracker
} from '../services/api';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  XCircle,
  FileText,
  User,
  Building,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calendar,
  Layers,
  Check,
  MessageSquare,
  BookmarkCheck,
  Zap,
  Info,
  X
} from 'lucide-react';

interface ActionOutcomeTrackerViewProps {
  onSelectAccount?: (accountId: string) => void;
  onNavigateToCopilot?: (accountId?: string) => void;
  onNavigateToAutopsy?: (accountId?: string) => void;
}

export function ActionOutcomeTrackerView({
  onSelectAccount,
  onNavigateToCopilot,
  onNavigateToAutopsy
}: ActionOutcomeTrackerViewProps) {
  const [items, setItems] = useState<ActionTrackerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionStatusFilter, setActionStatusFilter] = useState<string>('all');
  const [workStatusFilter, setWorkStatusFilter] = useState<string>('all');
  const [hasOutcomeFilter, setHasOutcomeFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ActionTrackerItem | null>(null);

  // Outcome Form State
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [outcomeCustomerResponse, setOutcomeCustomerResponse] = useState<string>('');
  const [outcomeCommitments, setOutcomeCommitments] = useState<string>('');
  const [outcomeNextSteps, setOutcomeNextSteps] = useState<string>('');
  const [outcomeRecordedBy, setOutcomeRecordedBy] = useState<string>('Sarah Jenkins (CSM Lead)');
  const [savingOutcome, setSavingOutcome] = useState<boolean>(false);
  const [syncingApproved, setSyncingApproved] = useState<boolean>(false);
  const [autoCapturingId, setAutoCapturingId] = useState<string | null>(null);

  // Status updates in-flight
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadTrackerData = async () => {
    try {
      setLoading(true);
      const data = await fetchTrackedActions();
      setItems(data);
      if (selectedItem) {
        const refreshed = data.find((d) => d.id === selectedItem.id);
        if (refreshed) {
          setSelectedItem(refreshed);
          populateOutcomeForm(refreshed);
        }
      }
    } catch (err: any) {
      console.error('Failed to load tracked actions:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to fetch tracked actions from backend'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrackerData();
  }, []);

  const populateOutcomeForm = (item: ActionTrackerItem) => {
    if (item.outcome) {
      setOutcomeNotes(item.outcome.notes || '');
      setOutcomeCustomerResponse(item.outcome.customer_response || '');
      setOutcomeCommitments(item.outcome.commitments || '');
      setOutcomeNextSteps(item.outcome.next_steps || '');
      setOutcomeRecordedBy(item.outcome.recorded_by || 'Sarah Jenkins (CSM Lead)');
    } else if (item.auto_capture_preview) {
      setOutcomeNotes(item.auto_capture_preview.detected_notes || '');
      setOutcomeCustomerResponse(item.auto_capture_preview.detected_customer_response || '');
      setOutcomeCommitments(item.auto_capture_preview.detected_commitments || '');
      setOutcomeNextSteps(item.auto_capture_preview.detected_next_steps || '');
      setOutcomeRecordedBy(`Auto-Captured (${item.auto_capture_preview.source || 'Integration'})`);
    } else {
      setOutcomeNotes('');
      setOutcomeCustomerResponse('');
      setOutcomeCommitments('');
      setOutcomeNextSteps('');
      setOutcomeRecordedBy('Sarah Jenkins (CSM Lead)');
    }
  };

  const handleSelectItem = (item: ActionTrackerItem) => {
    setSelectedItem(item);
    populateOutcomeForm(item);
  };

  const handleSyncApprovedProposals = async () => {
    try {
      setSyncingApproved(true);
      const synced = await syncApprovedProposalsToTracker();
      setItems(synced);
      setToast({
        type: 'success',
        message: `Synced ${synced.length} actions from approved interventions.`
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to sync approved proposals'
      });
    } finally {
      setSyncingApproved(false);
    }
  };

  const handleUpdateStatus = async (
    item: ActionTrackerItem,
    newActionStatus?: ActionExecutionStatus,
    newWorkStatus?: WorkStatus
  ) => {
    try {
      setUpdatingStatusId(item.id);
      const updated = await updateTrackedActionStatus(item.id, {
        action_status: newActionStatus,
        work_status: newWorkStatus
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (selectedItem?.id === updated.id) {
        setSelectedItem(updated);
      }
      setToast({
        type: 'success',
        message: `Updated status: Action (${updated.action_status}) • Work (${updated.work_status})`
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to update action status'
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveOutcome = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedItem) return;

    if (!outcomeNotes.trim()) {
      setToast({ type: 'error', message: 'Please provide outcome execution notes.' });
      return;
    }

    try {
      setSavingOutcome(true);
      const updated = await saveActionOutcome(selectedItem.id, {
        notes: outcomeNotes,
        customer_response: outcomeCustomerResponse || 'Not documented',
        commitments: outcomeCommitments || 'None specified',
        next_steps: outcomeNextSteps || 'Monitor telemetry in 7 days',
        recorded_by: outcomeRecordedBy,
        supporting_evidence_ids: selectedItem.evidence_ids || [],
        auto_captured: false
      });

      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedItem(updated);
      populateOutcomeForm(updated);
      setToast({
        type: 'success',
        message: `Outcome captured successfully! Closed loop verified for ${updated.account_name}.`
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to record outcome'
      });
    } finally {
      setSavingOutcome(false);
    }
  };

  const handleAutoCapture = async (item: ActionTrackerItem) => {
    try {
      setAutoCapturingId(item.id);
      const updated = await autoCaptureActionOutcome(item.id);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (selectedItem?.id === item.id) {
        setSelectedItem(updated);
        populateOutcomeForm(updated);
      }
      setToast({
        type: 'success',
        message: `Auto-captured outcome telemetry from connected integration for ${item.account_name}!`
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Auto-capture failed'
      });
    } finally {
      setAutoCapturingId(null);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (actionStatusFilter !== 'all' && item.action_status !== actionStatusFilter) return false;
      if (workStatusFilter !== 'all' && item.work_status !== workStatusFilter) return false;
      if (hasOutcomeFilter === 'captured' && !item.outcome) return false;
      if (hasOutcomeFilter === 'pending' && !!item.outcome) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.account_name.toLowerCase().includes(q) ||
        item.action_type.toLowerCase().includes(q) ||
        item.assigned_to.toLowerCase().includes(q) ||
        (item.outcome?.notes || '').toLowerCase().includes(q) ||
        (item.outcome?.customer_response || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, actionStatusFilter, workStatusFilter, hasOutcomeFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const executed = items.filter((i) => i.action_status === 'executed').length;
    const completedWork = items.filter((i) => i.work_status === 'completed').length;
    const outcomesCaptured = items.filter((i) => !!i.outcome).length;
    const pendingOutcomes = total - outcomesCaptured;
    const autoCapturable = items.filter((i) => i.auto_capture_available && !i.outcome).length;

    return {
      total,
      executed,
      completedWork,
      outcomesCaptured,
      pendingOutcomes,
      autoCapturable,
      closureRate: total > 0 ? Math.round((outcomesCaptured / total) * 100) : 0
    };
  }, [items]);

  // Helper for badge rendering
  const getActionStatusBadge = (status: ActionExecutionStatus) => {
    switch (status) {
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Executed
          </span>
        );
      case 'executing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <PlayCircle className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            Executing
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  const getWorkStatusBadge = (status: WorkStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <Check className="w-3 h-3 text-teal-600" />
            Completed
          </span>
        );
      case 'in progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" />
            In Progress
          </span>
        );
      case 'not started':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Not Started
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-sm transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Feature 1 Header Banner */}
      <div className="bg-gradient-to-r from-[#020062] via-[#0025AE] to-[#2563EB] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-white/5 pointer-events-none transform skew-x-12" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-xs mb-3">
              <ClipboardCheck className="w-3.5 h-3.5 text-blue-200" />
              Feature 1 — Closed-Loop Execution
            </div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-white">
              Action & Outcome Tracker
            </h2>
            <p className="text-blue-100 text-sm mt-1.5 leading-relaxed font-body">
              Tracks every approved action from execution to completion and outcome capture.
              The system knows what the team actually did, instead of just knowing what it recommended.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleSyncApprovedProposals}
              disabled={syncingApproved}
              className="px-4 py-2.5 rounded-xl bg-white text-[#0025AE] text-sm font-semibold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncingApproved ? 'animate-spin' : ''}`} />
              <span>Sync Approved Proposals</span>
            </button>
          </div>
        </div>

        {/* Closed-Loop KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Tracked Actions</span>
            <span className="text-2xl font-bold text-white block mt-0.5">{metrics.total}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Executed Actions</span>
            <span className="text-2xl font-bold text-white block mt-0.5">{metrics.executed}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Work Completed</span>
            <span className="text-2xl font-bold text-white block mt-0.5">{metrics.completedWork}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Outcomes Logged</span>
            <span className="text-2xl font-bold text-emerald-300 block mt-0.5">{metrics.outcomesCaptured}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Closure Rate</span>
            <span className="text-2xl font-bold text-white block mt-0.5">{metrics.closureRate}%</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-blue-200 text-xs block font-medium">Auto-Capture Ready</span>
            <span className="text-2xl font-bold text-amber-300 block mt-0.5">{metrics.autoCapturable}</span>
          </div>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Actions List & Filters (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by action title, account name, customer response or owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1 text-slate-500 font-medium mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              {/* Action Status Filter */}
              <select
                value={actionStatusFilter}
                onChange={(e) => setActionStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">Action Status (All)</option>
                <option value="approved">Approved</option>
                <option value="executing">Executing</option>
                <option value="executed">Executed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              {/* Work Status Filter */}
              <select
                value={workStatusFilter}
                onChange={(e) => setWorkStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">Work Status (All)</option>
                <option value="not started">Not Started</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              {/* Outcome Filter */}
              <select
                value={hasOutcomeFilter}
                onChange={(e) => setHasOutcomeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">Outcome Capture (All)</option>
                <option value="captured">Outcome Captured</option>
                <option value="pending">Outcome Pending</option>
              </select>

              {(actionStatusFilter !== 'all' || workStatusFilter !== 'all' || hasOutcomeFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setActionStatusFilter('all');
                    setWorkStatusFilter('all');
                    setHasOutcomeFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium ml-auto cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Action Items List */}
          {loading ? (
            <div className="bg-white p-12 rounded-xl border border-[#E2E8F0] text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#2563EB] mb-3" />
              <p className="font-medium text-sm">Loading action tracker items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-[#E2E8F0] text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-[#020062]">No tracked actions match filters</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                No items found. Click 'Sync Approved Proposals' to pull recently approved actions from the Approval Center.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const hasOutcome = !!item.outcome;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`bg-white rounded-xl border p-4.5 transition-all cursor-pointer shadow-2xs hover:border-[#2563EB] ${
                      isSelected
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-blue-50/20'
                        : 'border-[#E2E8F0] hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs text-[#0025AE] bg-[#F0F5FF] px-2 py-0.5 rounded border border-[#2563EB]/20 font-mono">
                            {item.account_name}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500 font-mono uppercase">
                            {item.action_type.replace('_', ' ')}
                          </span>
                          {item.proposal_id && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({item.proposal_id})
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-[#020062] leading-snug">
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {getActionStatusBadge(item.action_status)}
                        {getWorkStatusBadge(item.work_status)}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-2 font-body">
                        {item.description}
                      </p>
                    )}

                    {/* Metadata Strip */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">{item.assigned_to}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasOutcome ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Outcome Captured {item.outcome?.auto_captured ? '(Auto)' : ''}
                          </span>
                        ) : item.auto_capture_available ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            Auto-Capture Ready
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            Outcome pending
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detail & Outcome Form Drawer (5 Columns) */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          {selectedItem ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#E2E8F0]">
              {/* Header */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-t-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-[#0025AE] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {selectedItem.id}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-600 font-body">
                      {selectedItem.account_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getActionStatusBadge(selectedItem.action_status)}
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#020062] leading-tight font-headline">
                  {selectedItem.title}
                </h3>

                {/* Account & Recommendation Links */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/70 text-xs">
                  {onSelectAccount && (
                    <button
                      onClick={() => onSelectAccount(selectedItem.account_id)}
                      className="inline-flex items-center gap-1 text-[#2563EB] hover:text-[#0025AE] font-semibold cursor-pointer"
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>View Account Context</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {selectedItem.investigation_id && onNavigateToAutopsy && (
                    <button
                      onClick={() => onNavigateToAutopsy(selectedItem.account_id)}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Original Autopsy ({selectedItem.investigation_id})</span>
                    </button>
                  )}
                  {selectedItem.proposal_id && onNavigateToCopilot && (
                    <button
                      onClick={() => onNavigateToCopilot(selectedItem.account_id)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Copilot Proposal ({selectedItem.proposal_id})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Controller (Action status + Work status) */}
              <div className="p-5 space-y-3 bg-[#F8FAFC]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                    Execution State Management
                  </span>
                  {updatingStatusId === selectedItem.id && (
                    <span className="text-xs text-blue-600 animate-pulse font-mono">Updating...</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Action Status</label>
                    <select
                      value={selectedItem.action_status}
                      disabled={updatingStatusId === selectedItem.id}
                      onChange={(e) =>
                        handleUpdateStatus(
                          selectedItem,
                          e.target.value as ActionExecutionStatus,
                          selectedItem.work_status
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-800 font-semibold focus:outline-hidden focus:border-[#2563EB]"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="executing">Executing</option>
                      <option value="executed">Executed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Work Status</label>
                    <select
                      value={selectedItem.work_status}
                      disabled={updatingStatusId === selectedItem.id}
                      onChange={(e) =>
                        handleUpdateStatus(
                          selectedItem,
                          selectedItem.action_status,
                          e.target.value as WorkStatus
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-800 font-semibold focus:outline-hidden focus:border-[#2563EB]"
                    >
                      <option value="not started">Not Started</option>
                      <option value="in progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Owner: <strong className="text-slate-700">{selectedItem.assigned_to}</strong></span>
                  <span>Mode: <strong className="text-slate-700 uppercase font-mono">{selectedItem.execution_mode}</strong></span>
                </div>
              </div>

              {/* Recommendation Payload View */}
              {selectedItem.recommendation_payload && Object.keys(selectedItem.recommendation_payload).length > 0 && (
                <div className="p-5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Original Recommendation Details</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                    {selectedItem.recommendation_payload.recipient && (
                      <p><strong>Recipient:</strong> {selectedItem.recommendation_payload.recipient}</p>
                    )}
                    {selectedItem.recommendation_payload.subject && (
                      <p><strong>Subject:</strong> {selectedItem.recommendation_payload.subject}</p>
                    )}
                    {selectedItem.recommendation_payload.task && (
                      <p><strong>Task:</strong> {selectedItem.recommendation_payload.task}</p>
                    )}
                    {selectedItem.recommendation_payload.body && (
                      <p className="mt-1 pt-1 border-t border-slate-200 text-slate-600 line-clamp-3">
                        {selectedItem.recommendation_payload.body}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Automatic Capture Callout (If Available) */}
              {selectedItem.auto_capture_available && !selectedItem.outcome && selectedItem.auto_capture_preview && (
                <div className="p-5 bg-blue-50/70 border-b border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0025AE]">
                      <Zap className="w-4 h-4 text-[#2563EB]" />
                      <span>Automatic Capture Available</span>
                    </div>
                    <span className="text-[11px] font-mono bg-blue-100 text-[#0025AE] px-2 py-0.5 rounded">
                      {selectedItem.auto_capture_preview.source}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-body">
                    Telemetry detected from connected integration: {selectedItem.auto_capture_preview.detected_event}
                  </p>

                  <button
                    onClick={() => handleAutoCapture(selectedItem)}
                    disabled={autoCapturingId === selectedItem.id}
                    className="w-full py-2 px-3 rounded-lg bg-[#2563EB] hover:bg-[#0025AE] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <Zap className={`w-3.5 h-3.5 ${autoCapturingId === selectedItem.id ? 'animate-spin' : ''}`} />
                    <span>Auto-Ingest Outcome from Integration</span>
                  </button>
                </div>
              )}

              {/* Outcome Form */}
              <form onSubmit={handleSaveOutcome} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#020062] font-headline">
                    <ClipboardCheck className="w-4 h-4 text-[#2563EB]" />
                    <span>Outcome & Customer Feedback Form</span>
                  </div>
                  {selectedItem.outcome && (
                    <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Captured
                    </span>
                  )}
                </div>

                {/* Form Field 1: Execution Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Execution Notes & Context <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe what the team actually did, outreach delivery, or discussion summary..."
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-body"
                  />
                </div>

                {/* Form Field 2: Customer Response */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>Customer Response & Sentiment</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Customer reaction, objections, confirmation, or stakeholder sentiment..."
                    value={outcomeCustomerResponse}
                    onChange={(e) => setOutcomeCustomerResponse(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-body"
                  />
                </div>

                {/* Form Field 3: Commitments Made */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Agreed Commitments</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Agreed deliverables from CSM, technical roadmap milestones, or customer commitments..."
                    value={outcomeCommitments}
                    onChange={(e) => setOutcomeCommitments(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-body"
                  />
                </div>

                {/* Form Field 4: Next Steps */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>Next Steps & Follow-ups</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Immediate next touchpoint, calendar invites, or follow-up milestones..."
                    value={outcomeNextSteps}
                    onChange={(e) => setOutcomeNextSteps(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-body"
                  />
                </div>

                {/* Recorded By */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Recorded By</label>
                    <input
                      type="text"
                      value={outcomeRecordedBy}
                      onChange={(e) => setOutcomeRecordedBy(e.target.value)}
                      className="w-full p-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB]"
                    />
                  </div>

                  {selectedItem.outcome?.recorded_at && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Timestamp</label>
                      <div className="p-2 text-xs bg-slate-50 rounded-lg border border-slate-200 text-slate-600 font-mono">
                        {new Date(selectedItem.outcome.recorded_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={savingOutcome}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0025AE] hover:bg-[#020062] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <BookmarkCheck className={`w-4 h-4 ${savingOutcome ? 'animate-spin' : ''}`} />
                  <span>
                    {selectedItem.outcome ? 'Update Captured Outcome' : 'Save & Close Feedback Loop'}
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center text-slate-500 space-y-3">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-[#020062]">Select an action to inspect</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Select any action from the left panel to update execution progress, log customer responses, or review automated outcome ingestion.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActionOutcomeTrackerView;
