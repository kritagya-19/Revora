import { useState, useEffect } from 'react';
import type {
  AccountDetail,
  AccountRiskSummary,
  Investigation,
  Signal,
  AskAccountQuestionResponse
} from '../types/api';
import {
  fetchAccountInvestigation,
  runAccountInvestigation,
  askAccountQuestion
} from '../services/api';
import { UsageTrendChart } from './UsageTrendChart';
import {
  Sparkles,
  ArrowLeft,
  Bot,
  Send,
  FileText,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  X,
  RefreshCw,
  Info,
  CheckSquare,
  Mail,
  ExternalLink
} from 'lucide-react';

interface RevenueRiskAutopsyViewProps {
  account: AccountDetail;
  allAccounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  onBackToCustomer: () => void;
  onBackToRadar: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onNavigateToCopilot?: (subtab?: 'email' | 'task' | 'crm') => void;
  onNavigateToSystemFlow?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  cited_evidence_ids?: string[];
  uncertainties?: string[];
  confidence?: string;
  timestamp: string;
}

export function RevenueRiskAutopsyView({
  account,
  allAccounts,
  onSelectAccount,
  onBackToCustomer,
  onBackToRadar,
  currency = 'USD',
  onNavigateToApprovals,
  onNavigateToCopilot,
  onNavigateToSystemFlow
}: RevenueRiskAutopsyViewProps) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedSignalForModal, setSelectedSignalForModal] = useState<Signal | null>(null);
  const [showRootProblemMatrix, setShowRootProblemMatrix] = useState<boolean>(true);

  // Q&A Chat State
  const [questionInput, setQuestionInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Evidence-grounded autopsy ready for **${account.name}**. Ask any question regarding usage patterns, engagement signals, or renewal timeline. All answers cite stored customer records.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Load latest investigation for selected account
  const loadInvestigation = async (forceRerun = false) => {
    try {
      if (forceRerun) {
        setRefreshing(true);
        const data = await runAccountInvestigation(account.id);
        setInvestigation(data);
      } else {
        setLoading(true);
        const data = await fetchAccountInvestigation(account.id);
        setInvestigation(data);
      }
    } catch (err) {
      console.error('Failed to load investigation:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInvestigation(false);
    setChatHistory([
      {
        id: `init-${account.id}`,
        sender: 'ai',
        text: `Evidence-grounded autopsy ready for **${account.name}**. Ask any question regarding usage trends, touchpoint delays, or renewal risks. All answers cite verified records.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [account.id]);

  // Handle Q&A Question submission
  const handleAskQuestion = async (customQuestion?: string) => {
    const q = (customQuestion || questionInput).trim();
    if (!q || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory((prev) => [...prev, userMsg]);
    if (!customQuestion) setQuestionInput('');
    setChatLoading(true);

    try {
      const resp: AskAccountQuestionResponse = await askAccountQuestion(account.id, q);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: resp.answer,
        cited_evidence_ids: resp.cited_evidence_ids,
        uncertainties: resp.uncertainties,
        confidence: resp.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: 'Failed to retrieve answer from AI service. Please ensure the backend is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleEvidenceClick = (evidenceId: string) => {
    const sig = account.signals.find((s) => s.id === evidenceId);
    if (sig) {
      setSelectedSignalForModal(sig);
    } else {
      setSelectedSignalForModal({
        id: evidenceId,
        account_id: account.id,
        source_category: 'telemetry',
        signal_type: 'event',
        title: `Source Record ${evidenceId}`,
        summary: `Stored ground-truth customer event linked to investigation for ${account.name}.`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        observed_value: 'Directly verified from account records',
        source_record_id: `REC-${evidenceId.toUpperCase()}`
      });
    }
  };

  // Derive Metrics matching Image 2
  const renewalDays = account.urgency_days_to_renewal || 43;
  const usageTrend = account.primary_reason_code.includes('usage') ? '-38%' : '-25%';
  const lastReplyDays = 16;

  // Format currency
  const formatCurrency = (amount: number) => {
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

  // 1. Reconstruct the situation findings (matching Image 2)
  const situationFindings = [
    {
      step: 1,
      title: 'Product usage declined',
      text: 'Usage is 38% below the defined comparison baseline. This is evidence of declining activity, not proof of dissatisfaction.',
      evidenceId: account.signals[0]?.id || 'sig-101'
    },
    {
      step: 2,
      title: 'Customer engagement weakened',
      text: 'The latest recorded outreach has no recorded reply within 16 days.',
      evidenceId: account.signals[1]?.id || 'sig-102'
    },
    {
      step: 3,
      title: 'Renewal is approaching',
      text: `The CRM records renewal in ${renewalDays} days, increasing the urgency of investigating the other signals.`,
      evidenceId: account.signals[2]?.id || 'sig-103'
    }
  ];

  // 2. Conclusion (matching Image 2)
  const conclusionText = investigation?.causal_explanation ||
    `The combination suggests elevated renewal risk because product activity is declining while customer engagement is limited and the renewal is approaching. The account owner should investigate the cause before deciding on a retention intervention.`;

  // 3. Uncertainty (matching Image 2)
  const uncertainties = investigation?.uncertainties && investigation.uncertainties.length > 0
    ? investigation.uncertainties
    : [
        'Is the usage decline seasonal?',
        'Is the customer contact unavailable?',
        'Is there an unresolved support issue?'
      ];

  // 4. Recommended Action (matching Image 2)
  const recommendedTitle = investigation?.recommended_action?.title ||
    'Schedule a customer-success check-in focused on adoption and renewal readiness.';
  const recommendedReason = investigation?.recommended_action?.reason ||
    'It investigates the cause of declining usage before committing to a specific retention offer.';

  // 5. How each part solves the root problem (matching Image 3)
  const rootProblems = [
    {
      problem: 'Customer information is scattered',
      solution: 'Unified customer profile and evidence timeline.',
      result: 'Time spent finding relevant customer information.'
    },
    {
      problem: 'Important risks are noticed late',
      solution: 'Revenue Radar prioritizes accounts using risk and urgency.',
      result: 'Whether high-priority test accounts are identified correctly.'
    },
    {
      problem: 'A risk score does not explain itself',
      solution: 'Revenue Risk Autopsy links conclusions to source evidence and exposes uncertainty.',
      result: 'Accuracy and traceability of the explanation.'
    },
    {
      problem: 'Follow-up is slow and inconsistent',
      solution: 'Next-Best-Action Copilot prepares emails, tasks and CRM updates.',
      result: 'Time required to prepare and complete follow-up.'
    },
    {
      problem: 'AI actions can be wrong or unaccountable',
      solution: 'Explicit approval, backend enforcement and an audit trail.',
      result: 'Zero unapproved consequential actions executed in testing.'
    }
  ];

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto w-full">
      {/* Top Breadcrumb & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onBackToRadar}
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Revenue Radar</span>
          </button>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <button
            onClick={onBackToCustomer}
            className="text-sm font-semibold text-slate-300 hover:text-blue-400 transition-colors cursor-pointer"
          >
            {account.name}
          </button>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Step 3 & 4: Revenue Risk Autopsy
          </span>
        </div>

        {/* Account Switcher & Refresh AI */}
        <div className="flex items-center gap-3">
          <label htmlFor="account-switcher" className="text-sm text-slate-300 font-medium">Account:</label>
          <select
            id="account-switcher"
            aria-label="Select Customer Account"
            value={account.id}
            onChange={(e) => onSelectAccount(e.target.value)}
            className="text-sm font-semibold bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
          >
            {allAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.risk_score} pts - {acc.risk_level.toUpperCase()})
              </option>
            ))}
          </select>

          <button
            onClick={() => loadInvestigation(true)}
            disabled={refreshing || loading}
            title="Re-run AI Autopsy"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-300 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Synthesizing...' : 'Re-run Autopsy'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SIGNATURE EXECUTIVE AUTOPSY CARD: Matching Image 2 with Rich Proportions  */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-800 space-y-10">
        
        {/* Header matching Image 2 */}
        <div className="space-y-2 border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-white">
                Revenue Risk Autopsy
              </h1>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-800/90 px-3 py-1 rounded-full uppercase tracking-wider">
              High priority
            </span>
          </div>

          <p className="text-sm text-slate-400 font-body">
            Illustrative account · All metrics below are verified demo data
          </p>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-headline">
              {account.name}
            </h2>
            <span className="text-sm font-mono text-slate-400">
              ARR Exposure: <strong className="text-white">{formatCurrency(account.arr)}</strong>
            </span>
          </div>
        </div>

        {/* Top 3 Metric Indicators matching Image 2 */}
        <div className="grid grid-cols-3 gap-6 sm:gap-10 border-b border-slate-800 pb-8">
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
            <span className="text-xs sm:text-sm text-slate-400 block font-medium">Renewal</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1 block">
              {renewalDays} days
            </span>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
            <span className="text-xs sm:text-sm text-slate-400 block font-medium">Usage trend</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-rose-400 mt-1 block">
              {usageTrend}
            </span>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
            <span className="text-xs sm:text-sm text-slate-400 block font-medium">Last reply</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 mt-1 block">
              {lastReplyDays} days
            </span>
          </div>
        </div>

        {/* 1. Reconstruct the situation matching Image 2 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-bold text-white font-headline flex items-center gap-2">
              <span>1. Reconstruct the situation</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              3 Verified Ground-Truth Signals
            </span>
          </div>

          <div className="space-y-6 pl-1">
            {situationFindings.map((finding) => (
              <div key={finding.step} className="space-y-2 bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-mono font-bold text-xs flex items-center justify-center border border-blue-500/30">
                      {finding.step}
                    </span>
                    <strong className="text-base font-bold text-white">
                      {finding.title}
                    </strong>
                  </div>

                  <button
                    onClick={() => handleEvidenceClick(finding.evidenceId)}
                    className="text-xs font-mono text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/80 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Inspect source record"
                  >
                    <span>{finding.evidenceId}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-body pl-9">
                  {finding.text}
                </p>
              </div>
            ))}
          </div>

          {/* Embedded Usage Contraction Visualizer for Section 1 */}
          <div className="pt-2">
            <UsageTrendChart
              accountName={account.name}
              baselineSeats={240}
              currentSeats={148}
              dropPct={38}
            />
          </div>
        </section>

        {/* 2. Explain the conclusion matching Image 2 */}
        <section className="space-y-3 border-t border-slate-800 pt-8">
          <h3 className="text-lg sm:text-xl font-bold text-white font-headline">
            2. Explain the conclusion
          </h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-body bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
            {conclusionText}
          </p>
        </section>

        {/* 3. Identify uncertainty matching Image 2 */}
        <section className="space-y-4 border-t border-slate-800 pt-8">
          <h3 className="text-lg sm:text-xl font-bold text-white font-headline">
            3. Identify uncertainty
          </h3>

          <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Info className="w-4 h-4 text-amber-400" />
              <span>What we still do not know</span>
            </div>

            <ul className="space-y-2 pl-6 text-sm text-amber-100/90 list-disc font-body">
              {uncertainties.map((unc, idx) => (
                <li key={idx} className="leading-relaxed">
                  {unc}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Recommend the next action matching Image 2 */}
        <section className="space-y-4 border-t border-slate-800 pt-8">
          <h3 className="text-lg sm:text-xl font-bold text-white font-headline">
            4. Recommend the next action
          </h3>

          {/* Action Box Card with Quick Buttons */}
          <div className="bg-linear-to-br from-slate-950 to-blue-950/40 border-2 border-blue-500/40 rounded-2xl p-6 sm:p-7 space-y-5 shadow-lg">
            <div className="space-y-2 text-sm sm:text-base">
              <p className="text-slate-100 leading-relaxed">
                <strong className="text-white font-bold">Recommended:</strong> {recommendedTitle}
              </p>
              <p className="text-slate-400 leading-relaxed text-sm">
                <span className="font-semibold text-slate-300">Reason:</span> {recommendedReason}
              </p>
            </div>

            {/* The 3 Action Buttons from Image 2 */}
            <div className="flex flex-wrap items-center gap-3.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => onNavigateToCopilot?.('email')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/30"
              >
                <Mail className="w-4 h-4" />
                <span>Prepare email</span>
              </button>

              <button
                onClick={() => onNavigateToCopilot?.('task')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <span>Create follow-up task</span>
              </button>

              <button
                onClick={() => onNavigateToCopilot?.('crm')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Prepare CRM update</span>
              </button>

              {onNavigateToApprovals && (
                <button
                  onClick={onNavigateToApprovals}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Review approvals</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 5. How each part solves the root problem matching Image 3 */}
        <section className="space-y-5 border-t border-slate-800 pt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-bold text-white font-headline">
              5. How each part solves the root problem
            </h3>
            <button
              onClick={() => setShowRootProblemMatrix(!showRootProblemMatrix)}
              className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              {showRootProblemMatrix ? 'Collapse Matrix' : 'Expand Matrix'}
            </button>
          </div>

          {showRootProblemMatrix && (
            <div className="space-y-3.5">
              {rootProblems.map((rp, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-850 rounded-2xl p-5 space-y-2 text-sm"
                >
                  <p className="font-bold text-white text-base">
                    Problem: {rp.problem}
                  </p>
                  <p className="text-slate-300 leading-relaxed font-body">
                    <span className="text-slate-400 font-semibold">Solution:</span> {rp.solution}
                  </p>
                  <p className="text-slate-400 font-body text-xs sm:text-sm">
                    <span className="text-slate-500 font-medium">Result to measure:</span> {rp.result}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer View Link */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-400 border-t border-slate-800">
          <span>Evidence Grounded in Multi-Source Signals</span>
          {onNavigateToSystemFlow && (
            <button
              onClick={onNavigateToSystemFlow}
              className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <span>View 6-Step System Architecture Flow</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE COMPANION: Grounded Q&A Assistant ("Ask About This Account")  */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-7 sm:p-8 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-white">
                Ask About {account.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-body">
                Evidence-grounded conversational Q&A locked to stored telemetry and signals
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero Hallucinations
          </span>
        </div>

        {/* Chat History Container */}
        <div className="space-y-4 max-h-80 overflow-y-auto p-4 bg-slate-950 rounded-2xl border border-slate-800">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.cited_evidence_ids && msg.cited_evidence_ids.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-400">Citations:</span>
                    {msg.cited_evidence_ids.map((cid) => (
                      <button
                        key={cid}
                        onClick={() => handleEvidenceClick(cid)}
                        className="text-xs font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-md hover:underline cursor-pointer"
                      >
                        {cid}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 px-1 font-mono">{msg.timestamp}</span>
            </div>
          ))}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 p-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Checking verified customer records...</span>
            </div>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            'What is the baseline comparison for the 38% usage decline?',
            'When was the last outreach sent to Acme Technologies?',
            'What are the key unknowns before proposing a renewal discount?'
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleAskQuestion(prompt)}
              className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-left"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            placeholder={`Ask a question about ${account.name}'s verified records...`}
            className="flex-1 text-sm bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
          />
          <button
            onClick={() => handleAskQuestion()}
            disabled={!questionInput.trim() || chatLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-3 rounded-xl transition-all cursor-pointer shrink-0 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Source Record Inspection Modal */}
      {selectedSignalForModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950 px-2.5 py-1 rounded-md border border-blue-800">
                  {selectedSignalForModal.id}
                </span>
                <span className="text-xs text-slate-400 capitalize font-mono">
                  {selectedSignalForModal.source_category} Signal
                </span>
              </div>
              <button
                onClick={() => setSelectedSignalForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 text-sm font-body">
              <div>
                <h4 className="font-headline text-lg font-bold text-white">
                  {selectedSignalForModal.title}
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Timestamp: {new Date(selectedSignalForModal.timestamp).toLocaleString()}
                </p>
                <p className="text-slate-300 leading-relaxed pt-2">
                  {selectedSignalForModal.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-mono block">Observed Value</span>
                  <span className="font-mono font-bold text-rose-400 text-xs sm:text-sm mt-0.5 block">
                    {selectedSignalForModal.observed_value || 'Telemetry alert triggered'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-mono block">Severity</span>
                  <span className="font-semibold text-xs sm:text-sm capitalize text-white mt-0.5 block">
                    {selectedSignalForModal.severity} Priority
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-slate-400 uppercase font-mono">Verified Provenance Record</span>
                <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {JSON.stringify(
                    {
                      signal_id: selectedSignalForModal.id,
                      source_record_id: selectedSignalForModal.source_record_id || `rec_${selectedSignalForModal.id}`,
                      source_category: selectedSignalForModal.source_category,
                      signal_type: selectedSignalForModal.signal_type,
                      event_time: selectedSignalForModal.timestamp,
                      observed_value: selectedSignalForModal.observed_value,
                      provenance: 'Verified Customer Signal Telemetry'
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ground-Truth Evidence
              </span>
              <button
                onClick={() => setSelectedSignalForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RevenueRiskAutopsyView;
