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
    <div className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Page 6: Trust & Human-Gated Approval Center</span>
              <span className="text-slate-600">• Zero Unapproved Writes</span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-[#020062]">
              Action Authorization & Governance
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every action proposal prepared by the AI copilot must pass through this human authorization gate. 
              Unapproved operations are strictly blocked. Approved items execute through secure adapters with 
              immutable cryptographic audit records.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 block font-bold">
                Pending
              </span>
              <span className="text-2xl font-headline font-bold text-amber-900 block">
                {pendingCount}
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 block font-bold">
                Approved
              </span>
              <span className="text-2xl font-headline font-bold text-emerald-900 block">
                {approvedCount}
              </span>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 block font-bold">
                Rejected
              </span>
              <span className="text-2xl font-headline font-bold text-slate-800 block">
                {rejectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs flex items-center justify-between gap-4 transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : notification.type === 'info'
                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : notification.type === 'info' ? (
                <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold block">{notification.message}</span>
                {notification.details && (
                  <span className="text-slate-600 text-[11px] font-mono block mt-0.5">
                    {notification.details}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-black/5 rounded text-slate-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main View Mode Selector & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainView('proposals')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mainView === 'proposals'
                ? 'bg-[#0025AE] text-white shadow-xs'
                : 'bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Action Proposals ({proposals.length})</span>
          </button>

          <button
            onClick={() => setMainView('audit')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mainView === 'audit'
                ? 'bg-[#0025AE] text-white shadow-xs'
                : 'bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Immutable Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {mainView === 'proposals' && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {(['all', 'proposed', 'approved', 'rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                    activeFilter === tab
                      ? 'bg-white text-[#020062] font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#2563EB]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* VIEW A: Proposals Table */}
      {mainView === 'proposals' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          {filteredProposals.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-headline text-base font-bold text-[#020062]">
                No proposals in '{activeFilter}' state
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All pending operations have been authorized or no proposals match this filter. Create new proposals from Page 5 Action Copilot.
              </p>
              {onNavigateToCopilot && (
                <button
                  onClick={onNavigateToCopilot}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0025AE] font-semibold hover:underline cursor-pointer pt-2"
                >
                  <span>Open Action Copilot</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E2E8F0] text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Customer & Owner</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4">Proposal Summary</th>
                    <th className="py-3 px-4">Supporting Evidence</th>
                    <th className="py-3 px-4">Status & Version</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredProposals.map((prop) => {
                    const isProcessing = actionInProgressId === prop.id;
                    const isProposed = prop.status === 'proposed';
                    const isApproved = prop.status === 'approved' || prop.status === 'succeeded';

                    return (
                      <tr key={prop.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Customer & Owner */}
                        <td className="py-3.5 px-4 font-body">
                          <div className="font-bold text-[#020062] flex items-center gap-1.5">
                            {onSelectAccount ? (
                              <button
                                onClick={() => onSelectAccount(prop.account_id)}
                                className="hover:text-[#0025AE] hover:underline cursor-pointer text-left"
                              >
                                {prop.customer_name}
                              </button>
                            ) : (
                              <span>{prop.customer_name}</span>
                            )}
                            <RiskBadge level={prop.risk_level} score={prop.risk_score} size="sm" />
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>CSM: <strong>{prop.account_owner}</strong></span>
                            <span>•</span>
                            <span className="text-red-600 font-semibold">{prop.urgency_days_to_renewal}d renewal</span>
                          </div>
                        </td>

                        {/* Action Type */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold ${
                              prop.action_type.includes('email')
                                ? 'bg-blue-50 text-[#0025AE] border border-blue-100'
                                : prop.action_type.includes('task')
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-purple-50 text-purple-900 border border-purple-200'
                            }`}
                          >
                            {prop.action_type.includes('email') ? (
                              <Mail className="w-3 h-3" />
                            ) : prop.action_type.includes('task') ? (
                              <CheckSquare className="w-3 h-3" />
                            ) : (
                              <Database className="w-3 h-3" />
                            )}
                            <span>{prop.action_type}</span>
                          </span>
                        </td>

                        {/* Proposal Summary */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="font-semibold text-slate-800 block truncate">
                            {prop.title}
                          </span>
                          <span className="text-[11px] text-slate-500 line-clamp-1 block">
                            {prop.reason || prop.payload?.subject || prop.payload?.reason || prop.payload?.description || 'Grounded customer outreach'}
                          </span>
                        </td>

                        {/* Supporting Evidence */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            {prop.payload?.evidence_ids && Array.isArray(prop.payload.evidence_ids) && prop.payload.evidence_ids.length > 0 ? (
                              prop.payload.evidence_ids.slice(0, 3).map((eid: string) => (
                                <span
                                  key={eid}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 border border-slate-200"
                                >
                                  {eid}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">Account Telemetry</span>
                            )}
                          </div>
                        </td>

                        {/* Status & Version */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isProposed
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : isApproved
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-red-100 text-red-900 border border-red-300'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isProposed ? 'bg-amber-500 animate-pulse' : isApproved ? 'bg-emerald-600' : 'bg-red-600'
                                }`}
                              />
                              {prop.status}
                            </span>
                            <div className="text-[10px] font-mono text-slate-600">
                              v{prop.version} • <code className="bg-slate-100 px-1 py-0.2 rounded">{prop.content_hash}</code>
                            </div>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {/* Review Button (Exact Details Drawer) */}
                            <button
                              onClick={() => setSelectedProposal(prop)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#020062] font-semibold text-xs shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>Review</span>
                            </button>

                            {/* Approve Button */}
                            {isProposed && (
                              <button
                                onClick={() => handleApprove(prop)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-red-200 hover:bg-red-50 text-red-700 font-semibold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            )}

                            {/* Executed Badge */}
                            {isApproved && (
                              <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded">
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
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="font-headline text-base font-bold text-[#020062] flex items-center gap-2">
                <History className="w-4 h-4 text-[#2563EB]" />
                Immutable System Audit History
              </h3>
              <p className="text-xs text-slate-500">
                Chronological record of proposal creation, content mutations, human signoffs, and execution results.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              audit_events table
            </span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No audit events logged yet. Actions approved or rejected will be captured here.
              </div>
            ) : (
              auditLogs.map((log, i) => (
                <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                          log.event_type.includes('approved')
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.event_type.includes('rejected')
                            ? 'bg-red-100 text-red-800'
                            : log.event_type.includes('succeeded')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.event_type}
                      </span>
                      <span className="font-semibold text-slate-800">
                        Actor: <strong>{log.actor}</strong>
                      </span>
                      {log.proposal_id && (
                        <span className="font-mono text-slate-500 text-[11px]">
                          ({log.proposal_id})
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200/80">
                      {JSON.stringify(log.details)}
                    </div>
                  </div>

                  <div className="text-slate-500 font-mono text-[11px] shrink-0">
                    <Clock className="w-3 h-3 inline mr-1 text-slate-400" />
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 p-6 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0025AE] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-[#020062]">
                    Proposal Review & Audit Inspection
                  </h3>
                  <span className="text-xs text-slate-500 font-body block">
                    Inspect exact payload parameters before authorising execution
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedProposal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account & Metadata Banner */}
            <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl flex items-center justify-between flex-wrap gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Customer</span>
                <strong className="text-sm font-headline text-[#020062]">{selectedProposal.customer_name}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Owner</span>
                <strong className="text-slate-800">{selectedProposal.account_owner}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Content Hash</span>
                <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                  {selectedProposal.content_hash}
                </code>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Status</span>
                <span className="font-bold uppercase text-amber-700">{selectedProposal.status}</span>
              </div>
            </div>

            {/* Exact Payload Display */}
            <div className="space-y-4 text-xs">
              <h4 className="font-semibold text-slate-800">
                Action Payload Details ({selectedProposal.action_type})
              </h4>

              {/* CRM Update Details */}
              {selectedProposal.action_type.includes('crm') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block">
                      Current Value in CRM
                    </span>
                    <div className="font-bold text-slate-800">
                      {selectedProposal.payload?.current_value || selectedProposal.payload?.value || 'Standard Risk'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-[#0025AE] block">
                      Proposed New Value
                    </span>
                    <div className="font-bold text-[#020062]">
                      {selectedProposal.payload?.proposed_value || selectedProposal.payload?.value || 'High Churn Risk'}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Draft Details */}
              {selectedProposal.action_type.includes('email') && (
                <div className="space-y-3 p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Recipient</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedProposal.payload?.recipient}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Subject</span>
                    <span className="font-semibold text-[#020062]">{selectedProposal.payload?.subject}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Message Body</span>
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedProposal.payload?.body}
                    </div>
                  </div>
                </div>
              )}

              {/* Task Details */}
              {selectedProposal.action_type.includes('task') && (
                <div className="space-y-3 p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Task Title</span>
                    <span className="font-bold text-[#020062]">{selectedProposal.payload?.title || selectedProposal.title}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned To & Due Date</span>
                    <span className="text-slate-800">
                      {selectedProposal.payload?.assigned_to || selectedProposal.account_owner} • Due: {selectedProposal.payload?.due_date || 'Within 7 days'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Description</span>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700">
                      {selectedProposal.payload?.description || selectedProposal.reason}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON inspection */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-500">Raw Parameter Payload</span>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[10px] overflow-x-auto max-h-32">
                  {JSON.stringify(selectedProposal.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
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
                      className="px-4 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold cursor-pointer"
                    >
                      Reject Proposal
                    </button>

                    <button
                      onClick={() => handleApprove(selectedProposal)}
                      disabled={actionInProgressId === selectedProposal.id}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full space-y-4 p-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-[#020062]">
                  Reject Action Proposal
                </h3>
                <span className="text-xs text-slate-500 font-body block">
                  Proposal for {rejectingProposal.customer_name} ({rejectingProposal.action_type})
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700">
                Reason for Rejection (Recorded in Audit Trail)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Discussing renewal internally with VP before notifying client; timing inappropriate."
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setRejectingProposal(null)}
                className="px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionInProgressId === rejectingProposal.id}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
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
