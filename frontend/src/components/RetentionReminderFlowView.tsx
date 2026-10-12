import React, { useState, useEffect } from 'react';
import type {
  RetentionReminderFlowGraph,
  RetentionReminderFlowExecution,
  AccountRiskSummary,
  PortfolioRetentionAutomationResult
} from '../types/api';
import {
  fetchRetentionReminderFlowGraph,
  runRetentionReminderFlow,
  approveRetentionRecovery,
  runPortfolioRetentionAutomation,
  fetchAccounts
} from '../services/api';
import {
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Send,
  UserCheck,
  ShieldAlert,
  ExternalLink,
  MessageSquare,
  Activity,
  Bot,
  Zap,
  Building2,
  Layers,
  ThumbsUp,
  ThumbsDown,
  HelpCircle
} from 'lucide-react';

interface RetentionReminderFlowViewProps {
  onOpenFeedbackForm?: (surveyCode: string) => void;
  onNavigateToFeedback?: () => void;
}

export const RetentionReminderFlowView: React.FC<RetentionReminderFlowViewProps> = ({
  onOpenFeedbackForm,
  onNavigateToFeedback
}) => {
  const [graph, setGraph] = useState<RetentionReminderFlowGraph | null>(null);
  const [accounts, setAccounts] = useState<AccountRiskSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-101');
  const [selectedScenario, setSelectedScenario] = useState<string>('auto');
  const [execution, setExecution] = useState<RetentionReminderFlowExecution | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customScore, setCustomScore] = useState<number>(4);
  const [customBlocker, setCustomBlocker] = useState<string>('SSO integration and latency');
  const [customComment, setCustomComment] = useState<string>('Engineering lead reported blocking auth timeouts.');
  const [portfolioRunning, setPortfolioRunning] = useState<boolean>(false);
  const [portfolioResult, setPortfolioResult] = useState<PortfolioRetentionAutomationResult | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError(null);
      const [graphData, accList] = await Promise.all([
        fetchRetentionReminderFlowGraph(),
        fetchAccounts()
      ]);
      setGraph(graphData);
      setAccounts(accList);
      if (accList.length > 0) {
        setSelectedAccountId(accList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize retention flow');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunFlow(scenarioOverride?: string) {
    if (!selectedAccountId) return;
    try {
      setLoading(true);
      setError(null);
      const sc = scenarioOverride || selectedScenario;
      const res = await runRetentionReminderFlow({
        account_id: selectedAccountId,
        scenario: sc,
        custom_satisfaction_score: sc === 'custom' ? customScore : undefined,
        custom_blocker: sc === 'custom' ? customBlocker : undefined,
        custom_comments: sc === 'custom' ? customComment : undefined,
        human_approval_decision: 'approved',
        post_action_risk_reduced: true
      });
      setExecution(res);
      setActiveNodeId(res.current_node || (res.path_taken[res.path_taken.length - 1] ?? null));
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveProposal(decision: 'approved' | 'rejected') {
    if (!execution) return;
    try {
      setApprovalSubmitting(true);
      const updated = await approveRetentionRecovery({
        execution_id: execution.execution_id,
        decision,
        reviewer: 'CS Director (You)',
        notes: decision === 'approved' ? 'Approved service continuity credit & senior support session' : 'Rejected commercial credit; requested non-monetary training session'
      });
      setExecution(updated);
      setActiveNodeId(updated.current_node);
    } catch (err: any) {
      setError(err.message || 'Failed to update approval');
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function handleRunPortfolioAutomation() {
    try {
      setPortfolioRunning(true);
      setError(null);
      const result = await runPortfolioRetentionAutomation();
      setPortfolioResult(result);
    } catch (err: any) {
      setError(err.message || 'Portfolio automation failed');
    } finally {
      setPortfolioRunning(false);
    }
  }

  const activeNodeState = execution && activeNodeId ? execution.node_states[activeNodeId] : null;
  const activeNodeDef = graph?.nodes.find((n) => n.id === activeNodeId);

  // Group nodes by 6 strategic columns/stages for visual representation
  const STAGES = [
    {
      title: 'Stage 1: Signal Sensing',
      subtitle: 'Telemetry & Risk Gates',
      nodeIds: ['A', 'B', 'C', 'D']
    },
    {
      title: 'Stage 2: Retention Plan',
      subtitle: 'Diagnostics & Reminder',
      nodeIds: ['E', 'F', 'G', 'H', 'I', 'J']
    },
    {
      title: 'Stage 3: Feedback Loop',
      subtitle: 'Connected Form & SLA',
      nodeIds: ['K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'AF']
    },
    {
      title: 'Stage 4: Feedback Diagnosis',
      subtitle: 'Root Cause & Escalation',
      nodeIds: ['O', 'T', 'U', 'V', 'W', 'AG', 'X', 'AH']
    },
    {
      title: 'Stage 5: Recovery & Review',
      subtitle: 'Proposal & Human Gate',
      nodeIds: ['Y', 'Z', 'AA', 'AB', 'AC', 'AE', 'AD']
    },
    {
      title: 'Stage 6: Post-Action Tracking',
      subtitle: 'Resolution & Health',
      nodeIds: ['AI', 'AJ', 'AK']
    }
  ];

  function getNodeBadgeStyle(category: string, isVisited: boolean, isCurrent: boolean) {
    let base = 'border transition-all duration-200 cursor-pointer p-3 rounded-lg text-left relative ';
    if (isCurrent) {
      base += 'ring-2 ring-primary-400 shadow-lg shadow-primary-500/20 scale-[1.02] ';
    }
    if (!isVisited && execution) {
      base += 'opacity-40 hover:opacity-75 ';
    }

    switch (category) {
      case 'source':
        return base + 'bg-blue-950/30 border-blue-800/50 hover:border-blue-500 text-blue-200';
      case 'agent':
        return base + 'bg-purple-950/30 border-purple-800/50 hover:border-purple-500 text-purple-200';
      case 'decision':
        return base + 'bg-amber-950/30 border-amber-800/50 hover:border-amber-500 text-amber-200';
      case 'positive':
        return base + 'bg-emerald-950/30 border-emerald-800/50 hover:border-emerald-500 text-emerald-200';
      case 'negative':
        return base + 'bg-rose-950/30 border-rose-800/50 hover:border-rose-500 text-rose-200';
      case 'action':
      default:
        return base + 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-200';
    }
  }

  function getNodeCategoryIcon(category: string, id: string) {
    if (id === 'AB') return <UserCheck className="w-4 h-4 text-amber-400" />;
    if (id === 'L' || id === 'P') return <MessageSquare className="w-4 h-4 text-sky-400" />;
    if (id === 'J' || id === 'AD') return <Send className="w-4 h-4 text-emerald-400" />;
    switch (category) {
      case 'source':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'agent':
        return <Bot className="w-4 h-4 text-purple-400" />;
      case 'decision':
        return <HelpCircle className="w-4 h-4 text-amber-400" />;
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'negative':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'action':
      default:
        return <Zap className="w-4 h-4 text-sky-400" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> 37-Node Autonomous Engine
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Connected to Feedback Form
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
              Retention & Reminders Continuous Improvement Flow
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Implements the specification in <code className="text-primary-300">remainder.md</code>. Senses churn signals,
              generates dynamic reminders, dispatches tracked feedback forms, executes AI sentiment analysis, enforces human
              approval for recovery concessions, and tracks subsequent customer health in CRM.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleRunPortfolioAutomation}
              disabled={portfolioRunning}
              className="px-4 py-2.5 rounded-lg border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
            >
              {portfolioRunning ? (
                <RotateCcw className="w-4 h-4 animate-spin text-purple-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-400" />
              )}
              Scan Portfolio & Auto-Trigger
            </button>

            {onNavigateToFeedback && (
              <button
                onClick={onNavigateToFeedback}
                className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4 text-sky-400" />
                Feedback Management View
              </button>
            )}
          </div>
        </div>

        {/* Control Bar: Account, Scenario, and Actions */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Customer Account
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-750 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (Risk: {a.risk_score} - {a.risk_level.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Simulation Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="auto">Auto (Driven by Live Account Signals)</option>
              <option value="positive_feedback">Positive Feedback (Score 9/10 → Mark Healthy)</option>
              <option value="negative_feedback_approved">Negative Feedback (Approved Concession → Retained)</option>
              <option value="negative_feedback_rejected">Negative Feedback (Manager Rejected → Cancel & Revise)</option>
              <option value="unresponsive_escalated">Unresponsive (2x Reminders → Sales Phone Call & CRM)</option>
              <option value="not_at_risk">Not at Risk (Account Healthy → Normal Monitoring)</option>
              <option value="custom">Custom Live Simulation</option>
            </select>
          </div>

          {selectedScenario === 'custom' && (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Feedback Rating: {customScore}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={customScore}
                  onChange={(e) => setCustomScore(Number(e.target.value))}
                  className="w-full accent-primary-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Blocker Topic</label>
                <input
                  type="text"
                  value={customBlocker}
                  onChange={(e) => setCustomBlocker(e.target.value)}
                  placeholder="e.g. SSO auth timeout"
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-750 rounded text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Customer Quote</label>
                <input
                  type="text"
                  value={customComment}
                  onChange={(e) => setCustomComment(e.target.value)}
                  placeholder="Verbatim comments"
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-750 rounded text-xs text-slate-200"
                />
              </div>
            </div>
          )}

          <div className={selectedScenario === 'custom' ? 'md:col-span-4 flex justify-end gap-3 mt-1' : 'flex items-end gap-2'}>
            <button
              onClick={() => handleRunFlow()}
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 transition disabled:opacity-50"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              Execute Retention Flow
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Portfolio Automation Result Toast Banner */}
      {portfolioResult && (
        <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-purple-200">Portfolio Retention Automation Completed</h4>
              <p className="text-xs text-purple-300/80">
                Scanned {portfolioResult.scanned_accounts} accounts · Detected {portfolioResult.at_risk_detected} at-risk ·
                Dispatched {portfolioResult.direct_reminders_dispatched} reminders & {portfolioResult.feedback_forms_dispatched} surveys ·
                Approved {portfolioResult.recovery_messages_approved} recovery messages.
              </p>
            </div>
          </div>
          <button
            onClick={() => setPortfolioResult(null)}
            className="text-xs text-purple-300 hover:text-white px-3 py-1 rounded bg-purple-900/50 border border-purple-700/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Execution Status Banner */}
      {execution && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
              execution.healthy_marked
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : execution.sales_notified
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-primary-500/20 border-primary-500/40 text-primary-400'
            }`}>
              {execution.healthy_marked ? (
                <CheckCircle className="w-5 h-5" />
              ) : execution.sales_notified ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Activity className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{execution.account_name}</span>
                <span className="text-xs text-slate-400">({execution.execution_id})</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Scenario: {execution.scenario}
                </span>
                {execution.healthy_marked && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Marked Healthy in CRM
                  </span>
                )}
                {execution.sales_notified && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Sales Escalated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">{execution.outcome_summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block">Path Traversed</span>
              <span className="font-semibold text-white">{execution.path_taken.length} Nodes</span>
            </div>
            <div>
              <span className="text-slate-500 block">Current Terminal</span>
              <span className="font-semibold text-primary-400">Node {execution.current_node}</span>
            </div>
          </div>
        </div>
      )}

      {/* Human Approval Required Gate Modal / Banner (Nodes AB & AC) */}
      {execution && execution.node_states['AB'] && (
        <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UserCheck className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-amber-200">
                    Node AB: Manager Reviews and Approves Recovery Message
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Human-in-the-Loop Gate
                  </span>
                </div>
                <p className="text-xs text-amber-300/80 mt-1 max-w-2xl">
                  {execution.node_states['AB'].summary ||
                    'A personalized recovery concession (15% service credit & dedicated senior architect) has been generated. Requires manager approval before dispatch.'}
                </p>
                {execution.node_states['Z']?.data?.message_payload && (
                  <div className="mt-2 p-2.5 rounded bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
                    <p className="text-primary-300 font-semibold mb-1">
                      Subject: {execution.node_states['Z'].data.message_payload.subject}
                    </p>
                    <p className="text-slate-400 whitespace-pre-line">
                      {execution.node_states['Z'].data.message_payload.body}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                onClick={() => handleApproveProposal('approved')}
                disabled={approvalSubmitting}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Approve & Send (Node AD)
              </button>
              <button
                onClick={() => handleApproveProposal('rejected')}
                disabled={approvalSubmitting}
                className="px-3.5 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Reject / Cancel (Node AE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Flowchart DAG Representation (6 Columns) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-400" /> Complete 37-Node Retention & Reminders Topology
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any node to inspect telemetry payload, decision logic, and CRM records.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/40 border border-blue-400" /> Source
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500/40 border border-purple-400" /> Agent
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-400" /> Decision
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-400" /> Positive
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-400" /> Negative
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500/40 border border-sky-400" /> Action
            </span>
          </div>
        </div>

        {/* 6 Stage Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {STAGES.map((stage, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5">
              <div className="pb-2 border-b border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary-400 block">
                  {stage.title}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">{stage.subtitle}</span>
              </div>

              <div className="space-y-2 flex-1">
                {stage.nodeIds.map((nodeId) => {
                  const nodeDef = graph?.nodes.find((n) => n.id === nodeId);
                  if (!nodeDef) return null;

                  const isVisited = execution ? execution.path_taken.includes(nodeId) : false;
                  const isCurrent = execution?.current_node === nodeId;
                  const isSelected = activeNodeId === nodeId;

                  return (
                    <button
                      key={nodeId}
                      onClick={() => setActiveNodeId(nodeId)}
                      className={`w-full ${getNodeBadgeStyle(nodeDef.category_class, isVisited, isCurrent || isSelected)}`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                          {getNodeCategoryIcon(nodeDef.category_class, nodeId)}
                          <span className="font-bold text-xs">Node {nodeId}</span>
                        </div>
                        {nodeDef.day_label && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-slate-800 text-slate-300 font-mono">
                            {nodeDef.day_label}
                          </span>
                        )}
                        {isVisited && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                        )}
                      </div>

                      <div className="text-xs font-semibold line-clamp-1 text-slate-100">{nodeDef.title}</div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{nodeDef.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Node Telemetry Inspector & Connected Feedback Form Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Telemetry Inspector */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Node Inspector: {activeNodeDef ? `Node ${activeNodeDef.id} - ${activeNodeDef.title}` : 'Select a node'}
                </h3>
                <p className="text-xs text-slate-400">
                  {activeNodeDef?.subtitle || 'Telemetry, decision state, and payload audit log'}
                </p>
              </div>
            </div>
            {activeNodeDef && (
              <span className={`px-2 py-0.5 text-xs font-semibold uppercase rounded-full ${
                activeNodeDef.category_class === 'positive'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : activeNodeDef.category_class === 'negative'
                  ? 'bg-rose-500/20 text-rose-300'
                  : activeNodeDef.category_class === 'agent'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-primary-500/20 text-primary-300'
              }`}>
                {activeNodeDef.category_class}
              </span>
            )}
          </div>

          {activeNodeDef ? (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Node Purpose
                </label>
                <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  {activeNodeDef.summary}
                </p>
              </div>

              {activeNodeState ? (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Execution Output & Decision
                    </label>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Timestamp: {activeNodeState.timestamp || 'Executed'}</span>
                        <span className="font-semibold text-emerald-400">Status: {activeNodeState.status}</span>
                      </div>
                      <p className="text-slate-200">{activeNodeState.summary}</p>
                      {activeNodeState.decision && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-primary-300">
                          <span className="font-semibold">Decision Taken:</span>
                          <span className="px-2 py-0.5 rounded bg-primary-950 border border-primary-750 font-bold">
                            {activeNodeState.decision}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Raw JSON Data Payload
                    </label>
                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                      {JSON.stringify(activeNodeState.data, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400">
                  This node has not been executed yet in the current simulation.
                  Click "Execute Retention Flow" to observe live telemetry.
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">Click any node on the graph to inspect details.</p>
          )}
        </div>

        {/* Connected Feedback Form Portal Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Connected Feedback Form Portal</h3>
                  <p className="text-xs text-slate-400">
                    Live link between Retention Flow (remainder.md) & Feedback Engine
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Live Interop
              </span>
            </div>

            <div className="space-y-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Active Survey Token</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-sky-300">
                    {execution?.feedback_survey_code || 'rev-fb-101-demo'}
                  </span>
                  {execution?.feedback_survey_code && onOpenFeedbackForm && (
                    <button
                      onClick={() => onOpenFeedbackForm(execution.feedback_survey_code!)}
                      className="px-2.5 py-1 rounded bg-sky-900/60 hover:bg-sky-800 text-sky-200 text-xs font-medium flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Form
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Node L: Generate & Send Survey:</span>
                  <span className={`font-semibold ${execution?.feedback_survey_id ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {execution?.feedback_survey_id ? 'Dispatched with Tracked Token' : 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Node P: 48h Follow-up Reminder Email:</span>
                  <span className={`font-semibold ${execution?.path_taken.includes('P') ? 'text-amber-400' : 'text-slate-400'}`}>
                    {execution?.path_taken.includes('P') ? 'Sent (Customer Re-prompted)' : 'Not Triggered'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Node O: Feedback Analyzed:</span>
                  <span className={`font-semibold ${execution?.feedback_received ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {execution?.feedback_received ? 'Sentiment & Root Cause Extracted' : 'Awaiting Input'}
                  </span>
                </div>
              </div>

              {/* Quick Simulator Buttons */}
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Simulate Form Response Actions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRunFlow('positive_feedback')}
                    className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/50 text-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                    Simulate Positive (Score 9)
                  </button>
                  <button
                    onClick={() => handleRunFlow('negative_feedback_approved')}
                    className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/50 text-rose-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                    Simulate Negative (Score 4)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Feedback records automatically register on Account Timeline & Continuous Improvement Log.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
