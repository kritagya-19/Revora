import { useState, useEffect } from 'react';
import type { EnrichedPendingApproval, AuditLog } from '../types/api';
import {
  fetchPendingApprovals,
  approvePendingProposal,
  rejectPendingProposal,
  fetchGlobalAuditLogs
} from '../services/api';
import { RiskBadge } from './RiskBadge';
import {
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Database,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Clock,
  User,
  History,
  X
} from 'lucide-react';

interface ApprovalCenterViewProps {
  onSelectAccount?: (accountId: string) => void;
  onNavigateToCopilot?: () => void;
}

export function ApprovalCenterView({
  onSelectAccount,
  onNavigateToCopilot
}: ApprovalCenterViewProps) {
  const [proposals, setProposals] = useState<EnrichedPendingApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'proposed' | 'approved' | 'rejected'>('all');
  
  // Modal / Detail drawer
  const [selectedProposal, setSelectedProposal] = useState<EnrichedPendingApproval | null>(null);
  const [rejectingProposal, setRejectingProposal] = useState<EnrichedPendingApproval | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  
  // Processing state
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Tab between Pending Approvals & Audit Trail
  const [mainView, setMainView] = useState<'proposals' | 'audit'>('proposals');

  const loadData = async () => {
    try {
      setLoading(true);
      const [propsData, auditData] = await Promise.all([
        fetchPendingApprovals(),
        fetchGlobalAuditLogs(50).catch(() => [])
      ]);
      setProposals(propsData);
      setAuditLogs(auditData);
    } catch (err: any) {
      console.error('Failed to load approvals:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Error fetching approvals from server'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (proposal: EnrichedPendingApproval) => {
    try {
      setActionInProgressId(proposal.id);
      setNotification(null);

      const result = await approvePendingProposal(
        proposal.id,
        proposal.content_hash,
        'Sarah Jenkins (CSM Lead)',
        true
      );

      setNotification({
        type: 'success',
        message: `Action Proposal ${proposal.id} Approved & Executed!`,
        details: result.execution?.message || 'Executed through simulated gate.'
      });

      // Reload fresh state
      await loadData();
      if (selectedProposal && selectedProposal.id === proposal.id) {
        setSelectedProposal(null);
      }
    } catch (err: any) {
      console.error('Approval failed:', err);
      setNotification({
        type: 'error',
        message: `Approval failed: ${err.message || 'Permission or state error'}`
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleOpenReject = (proposal: EnrichedPendingApproval) => {
    setRejectingProposal(proposal);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingProposal) return;
    if (!rejectReason.trim()) {
      alert('Please provide a short reason for rejecting this proposal.');
      return;
    }

    try {
      setActionInProgressId(rejectingProposal.id);
      setNotification(null);

      await rejectPendingProposal(
        rejectingProposal.id,
        rejectReason.trim(),
        'Sarah Jenkins (CSM Lead)'
      );

      setNotification({
        type: 'info',
        message: `Proposal ${rejectingProposal.id} marked as Rejected. Execution was blocked.`
      });

      setRejectingProposal(null);
      setRejectReason('');
      await loadData();
      if (selectedProposal && selectedProposal.id === rejectingProposal.id) {
        setSelectedProposal(null);
      }
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setNotification({
        type: 'error',
        message: `Rejection failed: ${err.message}`
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.status === activeFilter;
  });

  const pendingCount = proposals.filter((p) => p.status === 'proposed').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved' || p.status === 'succeeded').length;
  const rejectedCount = proposals.filter((p) => p.status === 'rejected').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Step 6 of 6: Human Approval & Safe Execution Gate</span>
              <span className="text-slate-500">• Zero Autonomous Writes</span>
            </div>
            <h1 className="font-headline text-3xl font-bold text-white">
              Action Authorization & Governance
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-body">
              Every action proposal prepared by the AI copilot must pass through this human authorization gate. 
              Unapproved operations are strictly blocked. Approved items execute through secure adapters with 
              immutable cryptographic audit records.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 text-center min-w-[105px]">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 block font-bold mb-1">
                Pending
              </span>
              <span className="text-3xl font-headline font-bold text-amber-200 block">
                {pendingCount}
              </span>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-4 text-center min-w-[105px]">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 block font-bold mb-1">
                Approved
              </span>
              <span className="text-3xl font-headline font-bold text-emerald-200 block">
                {approvedCount}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center min-w-[105px]">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block font-bold mb-1">
                Rejected
              </span>
              <span className="text-3xl font-headline font-bold text-slate-300 block">
                {rejectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center justify-between gap-4 transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-800/60'
                : notification.type === 'info'
                ? 'bg-blue-950/40 text-blue-200 border border-blue-800/60'
                : 'bg-rose-950/40 text-rose-200 border border-rose-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : notification.type === 'info' ? (
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold block">{notification.message}</span>
                {notification.details && (
                  <span className="text-slate-300 text-xs font-mono block mt-1">
                    {notification.details}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main View Mode Selector & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMainView('proposals')}
            className={`flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              mainView === 'proposals'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Action Proposals ({proposals.length})</span>
          </button>

          <button
            onClick={() => setMainView('audit')}
            className={`flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              mainView === 'audit'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Immutable Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {mainView === 'proposals' && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['all', 'proposed', 'approved', 'rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                    activeFilter === tab
                      ? 'bg-slate-800 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'proposed' ? 'Pending' : tab}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm font-semibold text-slate-300 hover:text-white shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* VIEW A: Proposals Table */}
      {mainView === 'proposals' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          {filteredProposals.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="font-headline text-xl font-bold text-white">
                No proposals in '{activeFilter}' state
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                All pending operations have been authorized or no proposals match this filter. Create new proposals from Step 4 Action Copilot.
              </p>
              {onNavigateToCopilot && (
                <button
                  onClick={onNavigateToCopilot}
                  className="inline-flex items-center gap-2 text-sm text-blue-400 font-semibold hover:underline cursor-pointer pt-2"
                >
                  <span>Open Action Copilot</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold tracking-wider uppercase text-xs">
                  <tr>
                    <th className="py-4 px-5">Customer & Owner</th>
                    <th className="py-4 px-5">Action Type</th>
                    <th className="py-4 px-5">Proposal Summary</th>
                    <th className="py-4 px-5">Supporting Evidence</th>
                    <th className="py-4 px-5">Status & Version</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredProposals.map((prop) => {
                    const isProcessing = actionInProgressId === prop.id;
                    const isProposed = prop.status === 'proposed';
                    const isApproved = prop.status === 'approved' || prop.status === 'succeeded';

                    return (
                      <tr key={prop.id} className="hover:bg-slate-950/50 transition-colors">
                        {/* Customer & Owner */}
                        <td className="py-4 px-5 font-body">
                          <div className="font-bold text-white flex items-center gap-2">
                            {onSelectAccount ? (
                              <button
                                onClick={() => onSelectAccount(prop.account_id)}
                                className="hover:text-blue-400 hover:underline cursor-pointer text-left text-base"
                              >
                                {prop.customer_name}
                              </button>
                            ) : (
                              <span className="text-base">{prop.customer_name}</span>
                            )}
                            <RiskBadge level={prop.risk_level} score={prop.risk_score} size="sm" />
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>CSM: <strong className="text-slate-300">{prop.account_owner}</strong></span>
                            <span>•</span>
                            <span className="text-rose-400 font-semibold">{prop.urgency_days_to_renewal}d renewal</span>
                          </div>
                        </td>

                        {/* Action Type */}
                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold ${
                              prop.action_type.includes('email')
                                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                : prop.action_type.includes('task')
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                            }`}
                          >
                            {prop.action_type.includes('email') ? (
                              <Mail className="w-3.5 h-3.5" />
                            ) : prop.action_type.includes('task') ? (
                              <CheckSquare className="w-3.5 h-3.5" />
                            ) : (
                              <Database className="w-3.5 h-3.5" />
                            )}
                            <span>{prop.action_type}</span>
                          </span>
                        </td>

                        {/* Proposal Summary */}
                        <td className="py-4 px-5 max-w-xs">
                          <span className="font-semibold text-slate-200 block truncate">
                            {prop.title}
                          </span>
                          <span className="text-xs text-slate-400 line-clamp-1 block mt-0.5">
                            {prop.reason || prop.payload?.subject || prop.payload?.reason || prop.payload?.description || 'Grounded customer outreach'}
                          </span>
                        </td>

                        {/* Supporting Evidence */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {prop.payload?.evidence_ids && Array.isArray(prop.payload.evidence_ids) && prop.payload.evidence_ids.length > 0 ? (
                              prop.payload.evidence_ids.slice(0, 3).map((eid: string) => (
                                <span
                                  key={eid}
                                  className="px-2 py-0.5 rounded bg-slate-950 font-mono text-xs text-blue-300 border border-slate-800"
                                >
                                  {eid}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">Account Telemetry</span>
                            )}
                          </div>
                        </td>

                        {/* Status & Version */}
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold uppercase ${
                                isProposed
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : isApproved
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isProposed ? 'bg-amber-400 animate-pulse' : isApproved ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              {prop.status}
                            </span>
                            <div className="text-xs font-mono text-slate-400">
                              v{prop.version} • <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300">{prop.content_hash}</code>
                            </div>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-2.5">
                            {/* Review Button */}
                            <button
                              onClick={() => setSelectedProposal(prop)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 shadow-xs cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>Review</span>
                            </button>

                            {/* Approve Button */}
                            {isProposed && (
                              <button
                                onClick={() => handleApprove(prop)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>
                            )}

                            {/* Reject Button */}
                            {isProposed && (
                              <button
                                onClick={() => handleOpenReject(prop)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-semibold text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            )}

                            {/* Executed Badge */}
                            {isApproved && (
                              <span className="text-xs text-emerald-400 font-semibold inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Executed ({prop.execution_result?.mode || 'simulated'})
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW B: Immutable Audit Trail */}
      {mainView === 'audit' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-headline text-lg font-bold text-white flex items-center gap-2.5">
                <History className="w-5 h-5 text-blue-400" />
                Immutable System Audit History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chronological record of proposal creation, content mutations, human signoffs, and execution results.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-950 text-blue-300 px-3 py-1 rounded-lg border border-slate-800">
              audit_events ledger
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                No audit events logged yet. Actions approved or rejected will be captured here.
              </div>
            ) : (
              auditLogs.map((log, i) => (
                <div key={i} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-xs uppercase ${
                          log.event_type.includes('approved')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : log.event_type.includes('rejected')
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : log.event_type.includes('succeeded')
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.event_type}
                      </span>
                      <span className="font-semibold text-white">
                        Actor: <strong className="text-blue-300">{log.actor}</strong>
                      </span>
                      {log.proposal_id && (
                        <span className="font-mono text-slate-400 text-xs">
                          ({log.proposal_id})
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300 font-mono text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
                      {JSON.stringify(log.details)}
                    </div>
                  </div>

                  <div className="text-slate-400 font-mono text-xs shrink-0">
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Exact Review Before Approval */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 p-6 lg:p-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-white">
                    Proposal Review & Audit Inspection
                  </h3>
                  <span className="text-xs text-slate-400 font-body block mt-0.5">
                    Inspect exact payload parameters before authorising execution
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedProposal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account & Metadata Banner */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between flex-wrap gap-4 text-xs">
              <div>
                <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Customer</span>
                <strong className="text-base font-headline text-white">{selectedProposal.customer_name}</strong>
              </div>
              <div>
                <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Owner</span>
                <strong className="text-slate-200 text-sm">{selectedProposal.account_owner}</strong>
              </div>
              <div>
                <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Content Hash</span>
                <code className="font-mono text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-blue-300">
                  {selectedProposal.content_hash}
                </code>
              </div>
              <div>
                <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Status</span>
                <span className="font-bold uppercase text-amber-400 text-xs">{selectedProposal.status}</span>
              </div>
            </div>

            {/* Exact Payload Display */}
            <div className="space-y-4 text-sm">
              <h4 className="font-semibold text-white">
                Action Payload Details ({selectedProposal.action_type})
              </h4>

              {/* CRM Update Details */}
              {selectedProposal.action_type.includes('crm') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <span className="text-xs uppercase font-mono font-bold text-slate-400 block">
                      Current Value in CRM
                    </span>
                    <div className="font-bold text-slate-200 text-base">
                      {selectedProposal.payload?.current_value || selectedProposal.payload?.value || 'Standard Risk'}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-950/20 border border-blue-800/40 rounded-xl space-y-1.5">
                    <span className="text-xs uppercase font-mono font-bold text-blue-400 block">
                      Proposed New Value
                    </span>
                    <div className="font-bold text-white text-base">
                      {selectedProposal.payload?.proposed_value || selectedProposal.payload?.value || 'High Churn Risk'}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Draft Details */}
              {selectedProposal.action_type.includes('email') && (
                <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Recipient</span>
                    <span className="font-mono font-semibold text-white text-sm">{selectedProposal.payload?.recipient}</span>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Subject</span>
                    <span className="font-semibold text-white text-base">{selectedProposal.payload?.subject}</span>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Message Body</span>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedProposal.payload?.body}
                    </div>
                  </div>
                </div>
              )}

              {/* Task Details */}
              {selectedProposal.action_type.includes('task') && (
                <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Task Title</span>
                    <span className="font-bold text-white text-base">{selectedProposal.payload?.title || selectedProposal.title}</span>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Assigned To & Due Date</span>
                    <span className="text-slate-300">
                      {selectedProposal.payload?.assigned_to || selectedProposal.account_owner} • Due: {selectedProposal.payload?.due_date || 'Within 7 days'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Description</span>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                      {selectedProposal.payload?.description || selectedProposal.reason}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON inspection */}
              <div className="space-y-1.5">
                <span className="text-xs uppercase font-mono text-slate-400">Raw Parameter Payload</span>
                <pre className="bg-slate-950 border border-slate-800 text-emerald-400 p-3.5 rounded-xl font-mono text-xs overflow-x-auto max-h-32">
                  {JSON.stringify(selectedProposal.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                {selectedProposal.status === 'proposed' && (
                  <>
                    <button
                      onClick={() => {
                        handleOpenReject(selectedProposal);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold cursor-pointer"
                    >
                      Reject Proposal
                    </button>

                    <button
                      onClick={() => handleApprove(selectedProposal)}
                      disabled={actionInProgressId === selectedProposal.id}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                    >
                      Approve & Execute Action
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT PROMPT MODAL */}
      {rejectingProposal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full space-y-4 p-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-white">
                  Reject Action Proposal
                </h3>
                <span className="text-xs text-slate-400 font-body block mt-0.5">
                  Proposal for {rejectingProposal.customer_name} ({rejectingProposal.action_type})
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-semibold text-slate-300 block">
                Reason for Rejection (Recorded in Audit Trail)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Discussing renewal internally with VP before notifying client; timing inappropriate."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                onClick={() => setRejectingProposal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionInProgressId === rejectingProposal.id}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalCenterView;
