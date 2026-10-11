import { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Zap,
  Send,
  Mail,
  Bell,
  Sliders,
  ShieldCheck,
  Radio,
  X,
  ExternalLink
} from 'lucide-react';
import {
  fetchFeedbackFlowGraph,
  runFeedbackFlow,
  automatePortfolioFeedback
} from '../services/api';
import type {
  FeedbackFlowGraph,
  FeedbackFlowExecution,
  FeedbackFlowNode,
  AccountRiskSummary,
  PortfolioAutomationResult
} from '../types/api';

interface FeedbackFlowInteractiveViewProps {
  accounts: AccountRiskSummary[];
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onNavigateToCopilot?: (accountId: string) => void;
  onNavigateToApprovals?: () => void;
  onNavigateToTimeline?: (accountId: string) => void;
}

export function FeedbackFlowInteractiveView({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onNavigateToCopilot,
  onNavigateToApprovals,
  onNavigateToTimeline
}: FeedbackFlowInteractiveViewProps) {
  const [currentAccountId, setCurrentAccountId] = useState<string>(
    selectedAccountId || accounts[0]?.id || 'acc-101'
  );
  const [graph, setGraph] = useState<FeedbackFlowGraph | null>(null);
  const [execution, setExecution] = useState<FeedbackFlowExecution | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Control Mode: 'scenarios' | 'custom_form'
  const [activeTab, setActiveTab] = useState<'scenarios' | 'custom_form'>('scenarios');

  // Selected preset scenario
  const [scenario, setScenario] = useState<
    'negative_day0' | 'reminder_negative' | 'unresponsive' | 'positive' | 'healthy' | 'auto'
  >('negative_day0');

  // Custom Live Dynamic Form states
  const [customScore, setCustomScore] = useState<number>(2);
  const [customBlocker, setCustomBlocker] = useState<string>('UX / Navigation & Complex Workflows');
  const [customComments, setCustomComments] = useState<string>(
    'The product dashboard feels confusing, and our onboarding team is encountering friction during account setup.'
  );

  // Portfolio-wide Zero-Cost Automation states
  const [portfolioResult, setPortfolioResult] = useState<PortfolioAutomationResult | null>(null);
  const [automatingPortfolio, setAutomatingPortfolio] = useState<boolean>(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState<boolean>(false);

  // Inspected node
  const [selectedNodeId, setSelectedNodeId] = useState<string>('N');

  const selectedAccount = accounts.find((a) => a.id === currentAccountId);

  useEffect(() => {
    loadGraph();
  }, []);

  useEffect(() => {
    if (currentAccountId) {
      handleRunFlow(scenario);
    }
  }, [currentAccountId]);

  const loadGraph = async () => {
    try {
      const g = await fetchFeedbackFlowGraph();
      setGraph(g);
    } catch (err: any) {
      setError(err.message || 'Failed to load flow graph');
    }
  };

  const handleRunFlow = async (chosenScenario = scenario) => {
    try {
      setRunning(true);
      setError(null);
      const res = await runFeedbackFlow({
        account_id: currentAccountId,
        scenario: chosenScenario
      });
      setExecution(res);
      // Auto-inspect the most impactful terminal node
      if (res.path_taken.includes('N')) {
        setSelectedNodeId('N');
      } else if (res.path_taken.includes('T')) {
        setSelectedNodeId('T');
      } else if (res.path_taken.includes('L')) {
        setSelectedNodeId('L');
      } else if (res.path_taken.includes('D')) {
        setSelectedNodeId('D');
      } else if (res.path_taken.length > 0) {
        setSelectedNodeId(res.path_taken[res.path_taken.length - 1]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute flow');
    } finally {
      setRunning(false);
    }
  };

  const handleRunCustomFlow = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await runFeedbackFlow({
        account_id: currentAccountId,
        scenario: 'auto',
        custom_satisfaction_score: customScore,
        custom_blocker: customBlocker,
        custom_comments: customComments
      });
      setExecution(res);
      setScenario('auto');
      if (res.path_taken.includes('N')) {
        setSelectedNodeId('N');
      } else if (res.path_taken.includes('L')) {
        setSelectedNodeId('L');
      } else if (res.path_taken.length > 0) {
        setSelectedNodeId(res.path_taken[res.path_taken.length - 1]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute custom flow');
    } finally {
      setRunning(false);
    }
  };

  const handleAutomatePortfolio = async () => {
    try {
      setAutomatingPortfolio(true);
      setError(null);
      const res = await automatePortfolioFeedback();
      setPortfolioResult(res);
      setShowPortfolioModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to run zero-cost portfolio automation');
    } finally {
      setAutomatingPortfolio(false);
    }
  };

  // Node Category styling according to user flowchart classes
  const getNodeStyles = (node: FeedbackFlowNode, isTraversed: boolean) => {
    let baseBg = 'bg-[#E8F2FF]';
    let baseBorder = 'border-[#4682D8]';
    let baseText = 'text-[#102A56]';
    let badgeText = 'SOURCE';

    switch (node.node_type) {
      case 'source':
        baseBg = 'bg-[#E8F2FF]';
        baseBorder = 'border-[#4682D8]';
        baseText = 'text-[#102A56]';
        badgeText = 'DATA SOURCE';
        break;
      case 'agent':
        baseBg = 'bg-[#EDE9FF]';
        baseBorder = 'border-[#8065D8]';
        baseText = 'text-[#30205B]';
        badgeText = 'AI AGENT';
        break;
      case 'decision':
        baseBg = 'bg-[#FFF2CC]';
        baseBorder = 'border-[#D6A62E]';
        baseText = 'text-[#553D00]';
        badgeText = 'DECISION';
        break;
      case 'positive':
        baseBg = 'bg-[#DDF7E5]';
        baseBorder = 'border-[#35A65A]';
        baseText = 'text-[#124B28]';
        badgeText = 'HEALTHY';
        break;
      case 'negative':
        baseBg = 'bg-[#FFE3E3]';
        baseBorder = 'border-[#E5484D]';
        baseText = 'text-[#751C24]';
        badgeText = 'ESCALATION';
        break;
      case 'action':
        baseBg = 'bg-[#E4F3FF]';
        baseBorder = 'border-[#2684C7]';
        baseText = 'text-[#103D63]';
        badgeText = 'ACTION';
        break;
    }

    const isSelected = selectedNodeId === node.id;
    const highlightRing = isSelected
      ? 'ring-4 ring-blue-500/40 shadow-lg scale-[1.02]'
      : isTraversed
      ? 'shadow-md border-2'
      : 'opacity-50 grayscale-[25%] border-dashed';

    return { baseBg, baseBorder, baseText, badgeText, highlightRing };
  };

  const inspectedNode = graph?.nodes.find((n) => n.id === selectedNodeId);
  const inspectedNodeState = execution?.node_states[selectedNodeId];

  // Helper to check if edge is traversed
  const isEdgeTraversed = (fromId: string, toId: string) => {
    if (!execution?.path_taken) return false;
    const path = execution.path_taken;
    const fromIdx = path.indexOf(fromId);
    const toIdx = path.indexOf(toId);
    return fromIdx !== -1 && toIdx !== -1 && toIdx === fromIdx + 1;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Control Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                20-Node Interactive Orchestrator
              </span>
              <span className="text-xs text-slate-500 font-mono">docs/features-flow/feedback.md</span>
            </div>
            <h1 className="text-2xl font-bold font-headline text-[#020062] flex items-center gap-2.5">
              <span>Feedback Form Agent Flow</span>
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Deterministic multi-agent pipeline: Collects signals, evaluates risk thresholds, generates personalized surveys, manages 48h reminder escalation, routes sentiment into UX/Product/Competitor breakdowns, and drives zero-cost free automation.
            </p>
          </div>

          {/* Account Picker & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 font-semibold mb-1">Target Account</label>
              <select
                value={currentAccountId}
                onChange={(e) => {
                  setCurrentAccountId(e.target.value);
                  onSelectAccount?.(e.target.value);
                }}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.risk_level.toUpperCase()} - {acc.risk_score} pts)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleRunFlow()}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 mt-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-xs transition-colors disabled:opacity-50"
            >
              {running ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Simulating Flow...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Agent Simulation</span>
                </>
              )}
            </button>

            {/* Zero-Cost Portfolio Automation Trigger */}
            <button
              onClick={handleAutomatePortfolio}
              disabled={automatingPortfolio}
              className="flex items-center gap-2 px-4 py-2 mt-5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-sm shadow-xs transition-all disabled:opacity-50"
              title="Runs autonomous feedback collection, survey token dispatch, reminder checks, and webhooks across all monitored accounts at $0 cost."
            >
              {automatingPortfolio ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Automating Portfolio...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>⚡ Run Free Portfolio Automation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {selectedAccount && (
          <div className="mt-2 text-xs text-slate-500 font-mono">
            Selected: <span className="font-semibold text-slate-800">{selectedAccount.name}</span> ({selectedAccount.csm_owner || 'Unassigned CSM'} • ${(selectedAccount.arr || 0).toLocaleString()} ARR)
          </div>
        )}

        {/* Tab Switcher: Presets vs Live Dynamic Form Input */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('scenarios')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'scenarios'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Pre-built Scenarios</span>
              </button>
              <button
                onClick={() => setActiveTab('custom_form')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'custom_form'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>✍️ Live Dynamic Form Input</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Cost Pipelines: Active (Discord / Slack Webhooks + Local Outbox)</span>
            </div>
          </div>

          {/* TAB 1: Preset Scenarios */}
          {activeTab === 'scenarios' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase mr-1">Presets:</span>
              
              <button
                onClick={() => {
                  setScenario('negative_day0');
                  handleRunFlow('negative_day0');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  scenario === 'negative_day0'
                    ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🚨 Day 0 Negative Feedback (UX / Product Friction)
              </button>

              <button
                onClick={() => {
                  setScenario('reminder_negative');
                  handleRunFlow('reminder_negative');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  scenario === 'reminder_negative'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ⏰ Day 2 Reminder Responded (Competitor Threat)
              </button>

              <button
                onClick={() => {
                  setScenario('unresponsive');
                  handleRunFlow('unresponsive');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  scenario === 'unresponsive'
                    ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🛑 Unresponsive Timeout (Escalate to Phone Call)
              </button>

              <button
                onClick={() => {
                  setScenario('positive');
                  handleRunFlow('positive');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  scenario === 'positive'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ✨ Positive Feedback (Mark Healthy & Update CRM)
              </button>

              <button
                onClick={() => {
                  setScenario('healthy');
                  handleRunFlow('healthy');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  scenario === 'healthy'
                    ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🛡️ Low Risk Account (Normal Monitoring Maintained)
              </button>
            </div>
          )}

          {/* TAB 2: Live Dynamic Form Controls */}
          {activeTab === 'custom_form' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 pt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold font-headline text-slate-900">
                    Dynamic Customer Feedback Simulator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Input customized satisfaction ratings, specific blockers, and comments. The agent flow will dynamically evaluate sentiment, route through the 20-node state machine, and trigger zero-cost notifications.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400">Quick Fill:</span>
                  <button
                    onClick={() => {
                      setCustomScore(1);
                      setCustomBlocker('UX / Constant SSO login timeouts');
                      setCustomComments('Our entire analytics team was locked out twice this week due to session expiration. This is hurting our daily reporting.');
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-mono text-rose-700 hover:bg-rose-50"
                  >
                    UX Friction
                  </button>
                  <button
                    onClick={() => {
                      setCustomScore(2);
                      setCustomBlocker('Competitor Offering 35% Lower Price');
                      setCustomComments('Our VP of Engineering is evaluating competitor Acme Platform because renewal quotes came in too high.');
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-mono text-amber-700 hover:bg-amber-50"
                  >
                    Competitor Threat
                  </button>
                  <button
                    onClick={() => {
                      setCustomScore(5);
                      setCustomBlocker('None / Seamless Rollout');
                      setCustomComments('We love the new automated pipeline! Everything is working cleanly and adoption has expanded to 3 new squads.');
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-mono text-emerald-700 hover:bg-emerald-50"
                  >
                    Delighted (Positive)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* 1. Score Selector (1-5) */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="block text-xs font-mono font-bold uppercase text-slate-600">
                    Satisfaction Rating ({customScore}/5):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((scoreVal) => {
                      const isSel = customScore === scoreVal;
                      let bg = isSel ? 'bg-indigo-600 text-white font-bold' : 'bg-white border text-slate-700 hover:bg-slate-100';
                      if (isSel && scoreVal <= 2) bg = 'bg-rose-600 text-white font-bold shadow-xs';
                      if (isSel && scoreVal === 3) bg = 'bg-amber-600 text-white font-bold shadow-xs';
                      if (isSel && scoreVal >= 4) bg = 'bg-emerald-600 text-white font-bold shadow-xs';

                      return (
                        <button
                          key={scoreVal}
                          onClick={() => setCustomScore(scoreVal)}
                          className={`p-2 rounded-lg text-center text-xs transition flex flex-col items-center justify-center border border-slate-200 ${bg}`}
                        >
                          <span className="text-sm font-bold">{scoreVal}★</span>
                          <span className="text-[10px] opacity-80">
                            {scoreVal === 1 ? 'Critical' : scoreVal === 2 ? 'Poor' : scoreVal === 3 ? 'Neutral' : scoreVal === 4 ? 'Good' : 'Super'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {customScore <= 2 ? '🔴 Sentiment: Escalates to Negative Branch (M → N → O, P)' :
                     customScore === 3 ? '🟡 Sentiment: Evaluates comments & custom blockers' :
                     '🟢 Sentiment: Routes to Healthy Branch (K → L)'}
                  </div>
                </div>

                {/* 2. Primary Blocker */}
                <div className="md:col-span-8 space-y-1.5">
                  <label className="block text-xs font-mono font-bold uppercase text-slate-600">
                    Primary Roadblock / Blocker Category:
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'UX / Navigation & Complex Workflows',
                      'Product / Missing Integrations & Slow API',
                      'Competitor / Reviewing Alternative Vendor',
                      'Pricing / Budget CFO Scrutiny',
                      'None / Seamless Rollout'
                    ].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => setCustomBlocker(chip)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                          customBlocker === chip
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customBlocker}
                    onChange={(e) => setCustomBlocker(e.target.value)}
                    placeholder="Type custom blocker..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 3. Written Comments */}
                <div className="md:col-span-12 space-y-1.5">
                  <label className="block text-xs font-mono font-bold uppercase text-slate-600">
                    Customer Verbatim Comments:
                  </label>
                  <textarea
                    rows={2}
                    value={customComments}
                    onChange={(e) => setCustomComments(e.target.value)}
                    placeholder="Enter customer feedback text..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleRunCustomFlow}
                  disabled={running}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Flow Traversal...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>⚡ Submit Dynamic Feedback & Execute 20-Node Flow</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500">
          <span className="font-semibold uppercase text-slate-400">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#E8F2FF] border border-[#4682D8]"></span>
            <span>Source Telemetry</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#EDE9FF] border border-[#8065D8]"></span>
            <span>AI Agent</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FFF2CC] border border-[#D6A62E]"></span>
            <span>Decision Gate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#DDF7E5] border border-[#35A65A]"></span>
            <span>Positive Outcome</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FFE3E3] border border-[#E5484D]"></span>
            <span>Negative Escalation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#E4F3FF] border border-[#2684C7]"></span>
            <span>System Action</span>
          </span>
        </div>
      </div>

      {/* 2. Trajectory Status Banner */}
      {execution && (
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 font-mono font-bold">
              {execution.path_taken.length}
            </div>
            <div>
              <div className="text-xs font-mono text-indigo-300 font-semibold uppercase">
                Active Traversal Path ({execution.path_taken.join(' → ')})
              </div>
              <div className="text-sm font-medium text-slate-200 mt-0.5">
                {execution.outcome_summary}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {execution.sales_notified && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Sales Alerted
              </span>
            )}
            {execution.manager_notified && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Manager Briefed
              </span>
            )}
            {execution.crm_updated && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                CRM Updated
              </span>
            )}
            {execution.healthy_marked && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Healthy Status
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Split View: Interactive Graph Canvas + Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Flowchart Node Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200/80 rounded-xl p-6 shadow-inner relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              Mermaid Flow Canvas · Click any node to inspect artifacts
            </span>
            <span className="text-xs text-slate-400">
              Traversed Nodes: {execution?.path_taken.length || 0} / 20
            </span>
          </div>

          {/* Structured Visual Flowchart Layout */}
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            
            {/* ROW 1: A (Collect Signals) */}
            <div className="flex justify-center">
              {renderNodeCard('A')}
            </div>

            <div className="flex justify-center text-slate-400">
              <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('A', 'B') ? 'text-indigo-600 stroke-[3]' : ''}`} />
            </div>

            {/* ROW 2: B (Signal Analysis Agent) */}
            <div className="flex justify-center">
              {renderNodeCard('B')}
            </div>

            <div className="flex justify-center text-slate-400">
              <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('B', 'C') ? 'text-indigo-600 stroke-[3]' : ''}`} />
            </div>

            {/* ROW 3: C (Customer at Risk? Decision) */}
            <div className="flex justify-center">
              {renderNodeCard('C')}
            </div>

            {/* Split from C: Left -> D (No), Right -> E (Yes) */}
            <div className="grid grid-cols-2 gap-8 items-start pt-2">
              {/* Branch Left: No -> D (Normal Monitoring) */}
              <div className="flex flex-col items-center space-y-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('C', 'D') ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  No
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('C', 'D') ? 'text-blue-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('D')}
              </div>

              {/* Branch Right: Yes -> E (Feedback Agent) */}
              <div className="flex flex-col items-center space-y-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('C', 'E') ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  Yes
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('C', 'E') ? 'text-indigo-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('E')}
              </div>
            </div>

            {/* Down from E: F (Send Feedback Form Day 0) */}
            <div className="flex justify-center pt-2">
              <div className="flex flex-col items-center space-y-3">
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('E', 'F') ? 'text-indigo-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('F')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('F', 'G') ? 'text-indigo-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('G')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('G', 'H') ? 'text-indigo-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('H')}
              </div>
            </div>

            {/* Split from H: Yes -> I (Submitted), No -> Q (Wait 48h Escalation) */}
            <div className="grid grid-cols-2 gap-8 items-start pt-2">
              {/* Branch Left: Yes -> Goes directly down to I */}
              <div className="flex flex-col items-center space-y-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('H', 'I') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  H: Yes (Submitted Day 0)
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('H', 'I') ? 'text-emerald-600 stroke-[3]' : 'text-slate-400'}`} />
              </div>

              {/* Branch Right: No -> Q -> R -> S */}
              <div className="flex flex-col items-center space-y-3 border-l-2 border-dashed border-amber-300 pl-4">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('H', 'Q') ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  H: No (Not Submitted)
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('H', 'Q') ? 'text-amber-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('Q')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('Q', 'R') ? 'text-amber-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('R')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('R', 'S') ? 'text-amber-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('S')}

                {/* S: Decision: Yes -> Convergence at I, No -> T (Escalate Call) */}
                <div className="w-full flex flex-col items-center space-y-2 pt-2">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('S', 'T') ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    S: No (Unresponsive)
                  </span>
                  <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('S', 'T') ? 'text-rose-600 stroke-[3]' : 'text-slate-400'}`} />
                  {renderNodeCard('T')}
                </div>
              </div>
            </div>

            {/* CONVERGENCE AT NODE I (Analyze Feedback) */}
            <div className="flex justify-center pt-4 border-t-2 border-indigo-200/60">
              <div className="flex flex-col items-center space-y-3 w-full max-w-md">
                <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full font-bold">
                  Convergence: Submission Received (Day 0 or Day 2)
                </span>
                {renderNodeCard('I')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('I', 'J') ? 'text-indigo-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('J')}
              </div>
            </div>

            {/* Split from J: Positive (K -> L) vs Negative (M -> N -> O, P) */}
            <div className="grid grid-cols-2 gap-8 items-start pt-4 border-t border-slate-200">
              {/* Positive Branch */}
              <div className="flex flex-col items-center space-y-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('J', 'K') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  Positive Sentiment
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('J', 'K') ? 'text-emerald-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('K')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('K', 'L') ? 'text-emerald-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('L')}
              </div>

              {/* Negative Branch */}
              <div className="flex flex-col items-center space-y-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isEdgeTraversed('J', 'M') ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  Negative Sentiment
                </span>
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('J', 'M') ? 'text-rose-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('M')}
                <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('M', 'N') ? 'text-rose-600 stroke-[3]' : 'text-slate-400'}`} />
                {renderNodeCard('N')}

                {/* Sub-actions from N: O and P */}
                <div className="w-full grid grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col items-center space-y-2">
                    <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('N', 'O') ? 'text-rose-600 stroke-[3]' : 'text-slate-400'}`} />
                    {renderNodeCard('O')}
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <ChevronRight className={`w-5 h-5 rotate-90 ${isEdgeTraversed('N', 'P') ? 'text-rose-600 stroke-[3]' : 'text-slate-400'}`} />
                    {renderNodeCard('P')}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right: Node Artifacts & Telemetry Inspector (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-5 sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold font-mono text-sm flex items-center justify-center">
                {selectedNodeId}
              </span>
              <div>
                <h3 className="font-headline font-bold text-slate-900 text-base">Node Inspector</h3>
                <span className="text-[11px] font-mono text-slate-400">Live Agent Telemetry & Artifacts</span>
              </div>
            </div>
            {inspectedNode && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                inspectedNode.node_type === 'agent' ? 'bg-purple-100 text-purple-800' :
                inspectedNode.node_type === 'decision' ? 'bg-amber-100 text-amber-800' :
                inspectedNode.node_type === 'positive' ? 'bg-emerald-100 text-emerald-800' :
                inspectedNode.node_type === 'negative' ? 'bg-rose-100 text-rose-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {inspectedNode.node_type}
              </span>
            )}
          </div>

          {inspectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-slate-900">{inspectedNode.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{inspectedNode.subtitle}</div>
                {inspectedNode.day_label && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Timing SLA: {inspectedNode.day_label}
                  </span>
                )}
              </div>

              {/* Traversal State */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-slate-500">Execution Status:</span>
                  <span className={`font-mono font-bold ${
                    execution?.path_taken.includes(selectedNodeId)
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}>
                    {execution?.path_taken.includes(selectedNodeId) ? '✓ TRAVERSED' : '○ SKIPPED / PENDING'}
                  </span>
                </div>
                {inspectedNodeState?.summary && (
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    {inspectedNodeState.summary}
                  </p>
                )}
              </div>

              {/* Node Specific Payloads */}
              {inspectedNodeState?.data && (
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider">
                    Node Artifact Payload
                  </div>

                  {/* Node B (Signal Analysis Agent) */}
                  {selectedNodeId === 'B' && (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between p-2 rounded bg-slate-50 border">
                        <span className="text-slate-500">Usage Contraction:</span>
                        <span className="font-bold text-rose-600">-{inspectedNodeState.data.usage_drop_pct}%</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-slate-50 border">
                        <span className="text-slate-500">Touchpoint Inactivity:</span>
                        <span className="font-bold text-amber-600">{inspectedNodeState.data.touchpoint_lag_days} days</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-slate-50 border">
                        <span className="text-slate-500">Contract Renewal:</span>
                        <span className="font-bold text-slate-800">{inspectedNodeState.data.days_to_renewal} days</span>
                      </div>
                    </div>
                  )}

                  {/* Node E (Feedback Agent: Generated Survey) */}
                  {selectedNodeId === 'E' && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs space-y-2">
                      <div className="font-bold text-purple-900">Personalized Outreach Intro:</div>
                      <p className="italic text-purple-800">"{inspectedNodeState.data.personalized_intro}"</p>
                      <div className="font-bold text-purple-900 pt-1">Generated Questions:</div>
                      <ul className="list-disc pl-4 space-y-1 text-purple-950">
                        {inspectedNodeState.data.generated_questions?.map((q: any) => (
                          <li key={q.id}>{q.prompt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Node F (Send Feedback Form Day 0) */}
                  {selectedNodeId === 'F' && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs space-y-2">
                      <div className="font-bold text-blue-950">Day 0 Outreach Delivery:</div>
                      <div className="space-y-1 text-blue-900 font-mono text-[11px]">
                        <div>Recipient: {inspectedNodeState.data.recipient}</div>
                        <div>Token Code: <span className="font-bold bg-blue-100 px-1 py-0.5 rounded">{inspectedNodeState.data.survey_code}</span></div>
                        <div>Delivery URL: {inspectedNodeState.data.form_url}</div>
                      </div>
                    </div>
                  )}

                  {/* Node Q (Send Reminder Email Day 2) */}
                  {selectedNodeId === 'Q' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                      <div className="font-bold text-amber-950">Day 2 Reminder Email:</div>
                      <p className="text-amber-900 italic">"{inspectedNodeState.data.reminder_body}"</p>
                      <div className="text-[11px] font-mono text-amber-800">Subject: {inspectedNodeState.data.subject}</div>
                    </div>
                  )}

                  {/* Node I (Analyze Feedback) */}
                  {selectedNodeId === 'I' && (
                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs space-y-2">
                      <div className="font-bold text-indigo-950">Sentiment Analysis Evaluation:</div>
                      <div className="flex justify-between text-indigo-900 font-mono">
                        <span>Customer Rating: {inspectedNodeState.data.satisfaction_score}/10</span>
                        <span className="font-bold uppercase">Tone: {inspectedNodeState.data.detected_sentiment}</span>
                      </div>
                      <div className="pt-1">
                        <span className="font-bold text-indigo-900">Reported Blocker:</span>
                        <p className="text-indigo-800 italic mt-0.5">"{inspectedNodeState.data.stated_blocker}"</p>
                      </div>
                      <div>
                        <span className="font-bold text-indigo-900">Customer Verbatim:</span>
                        <p className="text-indigo-800 text-[11px] mt-0.5">"{inspectedNodeState.data.customer_comments}"</p>
                      </div>
                    </div>
                  )}

                  {/* Node N (Analyze Customer Issues: UX, Product, Competitor) */}
                  {selectedNodeId === 'N' && (
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                        <span className="font-bold text-indigo-900 block mb-1">🖥️ UX & Onboarding Friction:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-indigo-800">
                          {inspectedNodeState.data.ux_friction?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                        <span className="font-bold text-blue-900 block mb-1">⚙️ Product & Technical Gaps:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
                          {inspectedNodeState.data.product_concerns?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                        <span className="font-bold text-rose-900 block mb-1">💼 Competitor & Pricing Threat:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                          {inspectedNodeState.data.competitor_concerns?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Node O (Notify Sales Team) */}
                  {selectedNodeId === 'O' && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-2">
                      <div className="font-bold text-rose-900">Urgent Sales Call Instructions:</div>
                      <p className="text-rose-800">Assigned Rep: <span className="font-semibold">{inspectedNodeState.data.target_rep}</span></p>
                      <div className="font-bold text-rose-900">Talking Points for Call:</div>
                      <ul className="list-disc pl-4 space-y-1 text-rose-950">
                        {inspectedNodeState.data.talking_points?.map((tp: string, i: number) => (
                          <li key={i}>{tp}</li>
                        ))}
                      </ul>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => onNavigateToApprovals?.()}
                          className="flex-1 py-1.5 px-3 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 transition"
                        >
                          Review in Approvals
                        </button>
                        {onNavigateToCopilot && (
                          <button
                            onClick={() => onNavigateToCopilot(currentAccountId)}
                            className="py-1.5 px-3 rounded bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
                          >
                            Open Copilot
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Node P (Notify Manager) */}
                  {selectedNodeId === 'P' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                      <div className="font-bold text-amber-900">Executive Briefing to Leadership:</div>
                      <p className="text-amber-800 leading-relaxed font-mono">
                        {inspectedNodeState.data.executive_briefing}
                      </p>
                      <div className="text-amber-900 font-semibold pt-1">
                        Recommended Intervention: {inspectedNodeState.data.recommended_management_action}
                      </div>
                    </div>
                  )}

                  {/* Node T (Unresponsive Sales Notification) */}
                  {selectedNodeId === 'T' && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-2">
                      <div className="font-bold text-rose-900">🚨 Unresponsive Account Call Request:</div>
                      <p className="text-rose-800 font-semibold">{inspectedNodeState.data.action_instructions}</p>
                      <div className="text-[11px] font-mono text-rose-700 pt-1">
                        Survey attempts ignored: {inspectedNodeState.data.risk_context?.unresponsive_attempts} touches across 96 hours.
                      </div>
                      <button
                        onClick={() => onNavigateToApprovals?.()}
                        className="w-full mt-2 py-1.5 px-3 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 transition"
                      >
                        Open Sales Call Proposal
                      </button>
                    </div>
                  )}

                  {/* Node L (Mark Customer Healthy) */}
                  {selectedNodeId === 'L' && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                      <div className="font-bold text-emerald-900">✨ Account Health Re-evaluated:</div>
                      <div className="flex justify-between text-emerald-800">
                        <span>Previous Risk: {inspectedNodeState.data.previous_risk_score} pts</span>
                        <span className="font-bold text-emerald-700">Updated Risk: {inspectedNodeState.data.updated_risk_score} pts</span>
                      </div>
                      <p className="text-emerald-800 italic">{inspectedNodeState.data.crm_field_updated}</p>
                      <button
                        onClick={() => onNavigateToTimeline?.(currentAccountId)}
                        className="w-full mt-2 py-1.5 px-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
                      >
                        Inspect in Customer Timeline
                      </button>
                    </div>
                  )}

                  {/* Zero-Cost Automation Outbox / Webhook Dispatches for this Node */}
                  {(inspectedNodeState.data.free_email_dispatched || inspectedNodeState.data.free_webhook_dispatched) && (
                    <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Zero-Cost Automated Pipeline Dispatches:</span>
                      </div>

                      {inspectedNodeState.data.free_email_dispatched && (
                        <div className="bg-white/80 p-2 rounded border border-emerald-100 text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <Mail className="w-3 h-3 text-indigo-600" />
                            <span>Outbox Email Staged (Free Mode):</span>
                          </div>
                          <div className="text-slate-600 font-mono text-[10px]">
                            <div><span className="font-semibold text-slate-700">To:</span> {inspectedNodeState.data.free_email_dispatched.to}</div>
                            <div className="truncate"><span className="font-semibold text-slate-700">Subject:</span> {inspectedNodeState.data.free_email_dispatched.subject}</div>
                          </div>
                        </div>
                      )}

                      {inspectedNodeState.data.free_webhook_dispatched && (
                        <div className="bg-white/80 p-2 rounded border border-emerald-100 text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <Bell className="w-3 h-3 text-emerald-600" />
                            <span>Webhook Dispatched (Discord / Slack format):</span>
                          </div>
                          <div className="text-slate-600 font-mono text-[10px]">
                            <div><span className="font-semibold text-slate-700">Destination:</span> {inspectedNodeState.data.free_webhook_dispatched.destination}</div>
                            <div><span className="font-semibold text-slate-700">Status:</span> {inspectedNodeState.data.free_webhook_dispatched.status}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generic raw telemetry JSON preview */}
                  {!['B', 'E', 'F', 'Q', 'I', 'N', 'O', 'P', 'T', 'L'].includes(selectedNodeId) && (
                    <pre className="text-[11px] font-mono p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto max-h-48">
                      {JSON.stringify(inspectedNodeState.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-400">
              Click any node in the flowchart to inspect telemetry & agent thoughts.
            </div>
          )}
        </div>
      </div>

      {/* 4. Zero-Cost Portfolio Automation Modal */}
      {showPortfolioModal && portfolioResult && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-headline">Zero-Cost Portfolio Automation Results</h3>
                  <p className="text-xs text-emerald-100">
                    Fully automated feedback loops triggered across all customer accounts ($0 cost).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPortfolioModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Stat Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] font-mono text-slate-500 uppercase block">Scanned</span>
                  <span className="text-2xl font-bold font-headline text-slate-900">{portfolioResult.scanned_accounts}</span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                  <span className="text-[11px] font-mono text-indigo-600 uppercase block">Day 0 Surveys</span>
                  <span className="text-2xl font-bold font-headline text-indigo-700">{portfolioResult.day0_surveys_dispatched}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] font-mono text-emerald-600 uppercase block">Healthy Accounts</span>
                  <span className="text-2xl font-bold font-headline text-emerald-700">{portfolioResult.healthy_monitored}</span>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                  <span className="text-[11px] font-mono text-teal-600 uppercase block">Webhooks Fired</span>
                  <span className="text-2xl font-bold font-headline text-teal-700">{portfolioResult.webhooks_dispatched}</span>
                </div>
              </div>

              {/* Account Decisions List */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider">
                  Automated Pipeline Decisions
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {portfolioResult.automated_actions.map((act) => (
                    <div key={act.account_id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition">
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>{act.account_name}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            act.risk_score >= 60 ? 'bg-rose-100 text-rose-800' :
                            act.risk_score >= 40 ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            Risk: {act.risk_score} pts
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {act.action_taken}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setCurrentAccountId(act.account_id);
                          setShowPortfolioModal(false);
                          handleRunFlow('auto');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium text-xs hover:bg-indigo-100 transition flex items-center gap-1 shrink-0"
                      >
                        <span>Inspect in Canvas</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All automated emails staged in local outbox and webhooks dispatched formatted for Discord & Slack without any third-party subscription costs.</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowPortfolioModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper renderer for each node in flowchart
  function renderNodeCard(nodeId: string) {
    const node = graph?.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const isTraversed = execution?.path_taken.includes(nodeId) || false;
    const { baseBg, baseBorder, baseText, badgeText, highlightRing } = getNodeStyles(node, isTraversed);

    return (
      <button
        key={node.id}
        onClick={() => setSelectedNodeId(node.id)}
        className={`w-72 p-3.5 rounded-xl border transition-all text-left relative cursor-pointer select-none ${baseBg} ${baseBorder} ${baseText} ${highlightRing}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-white/80 font-mono font-bold text-xs flex items-center justify-center border shadow-2xs">
              {node.id}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
              {badgeText}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {node.day_label && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/60 border border-black/10">
                {node.day_label}
              </span>
            )}
            {isTraversed && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
          </div>
        </div>

        <div className="font-headline font-bold text-sm tracking-tight leading-snug">
          {node.title}
        </div>
        <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2 leading-relaxed">
          {node.subtitle}
        </div>
      </button>
    );
  }
}
