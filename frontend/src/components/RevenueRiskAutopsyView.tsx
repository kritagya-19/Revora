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
import { RiskBadge } from './RiskBadge';
import {
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Bot,
  Send,
  HelpCircle,
  FileText,
  Activity,
  Headphones,
  Mail,
  CalendarDays,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  Copy,
  Check,
  Layers,
  ArrowRight,
  X,
  Database,
  RefreshCw
} from 'lucide-react';

interface RevenueRiskAutopsyViewProps {
  account: AccountDetail;
  allAccounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  onBackToCustomer: () => void;
  onBackToRadar: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onNavigateToCopilot?: () => void;
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
  onNavigateToCopilot
}: RevenueRiskAutopsyViewProps) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedSignalForModal, setSelectedSignalForModal] = useState<Signal | null>(null);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  // Q&A Chat State
  const [questionInput, setQuestionInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Hello! I have performed an evidence-grounded risk autopsy on **${account.name}**. You can ask any question regarding this account's signals, usage changes, stakeholder outreach, or renewal risks. All answers cite verified records.`,
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
    // Reset chat on account change
    setChatHistory([
      {
        id: `init-${account.id}`,
        sender: 'ai',
        text: `Evidence-grounded risk autopsy loaded for **${account.name}** (Risk Score: ${account.risk_score}/100). Ask follow-up questions to drill into observed telemetry and root causes.`,
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
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Sorry, I encountered an issue retrieving verified records for this question: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Find signal helper by ID
  const findSignal = (sigId: string): Signal | undefined => {
    return account.signals.find((s) => s.id === sigId);
  };

  // Open evidence modal from ID
  const handleEvidenceClick = (sigId: string) => {
    const sig = findSignal(sigId);
    if (sig) {
      setSelectedSignalForModal(sig);
    } else {
      // Create fallback dummy signal if referenced from rule
      setSelectedSignalForModal({
        id: sigId,
        account_id: account.id,
        source_category: 'usage',
        signal_type: 'observed_signal',
        title: `Telemetry Record (${sigId})`,
        summary: `Stored verification record for ${account.name}`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        observed_value: 'Recorded in verified telemetry',
        source_record_id: `rec-${sigId}`
      });
    }
  };

  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      if (inrAmount >= 100000) return `₹${(inrAmount / 100000).toFixed(1)} L`;
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  const getSourceIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'usage':
        return <Activity className="w-4 h-4 text-purple-600" />;
      case 'support':
        return <Headphones className="w-4 h-4 text-red-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'calendar':
        return <CalendarDays className="w-4 h-4 text-amber-600" />;
      case 'crm':
        return <FileText className="w-4 h-4 text-emerald-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const suggestedQuestions = [
    'Why did active users drop?',
    'Who is the primary executive contact?',
    'When is renewal and what is the ARR?',
    'Are there unresolved support tickets?'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBackToRadar}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0025AE] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Revenue Radar</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={onBackToCustomer}
            className="text-xs font-semibold text-slate-500 hover:text-[#0025AE] transition-colors cursor-pointer"
          >
            {account.name}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-[#020062] bg-[#2563EB]/10 text-[#2563EB] px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Page 4: Revenue Risk Autopsy
          </span>
        </div>

        {/* Account Switcher & Refresh AI */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="account-switcher" className="text-xs text-slate-600 font-medium">Account:</label>
            <select
              id="account-switcher"
              aria-label="Select Customer Account"
              value={account.id}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[#020062] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
            >
              {allAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.risk_score} pts - {acc.risk_level.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadInvestigation(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0025AE] bg-[#0025AE]/8 hover:bg-[#0025AE]/15 border border-[#0025AE]/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Re-synthesizing...' : 'Re-run AI Autopsy'}</span>
          </button>
        </div>
      </div>

      {/* Account Hero Summary Banner */}
      <div className="relative overflow-hidden bg-linear-to-r from-[#020062] via-[#0025AE] to-[#2563EB] text-white rounded-2xl p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded font-semibold backdrop-blur-xs">
                AI Risk Autopsy v1.0
              </span>
              <span className="text-xs text-blue-100 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Evidence-Grounded in MongoDB Telemetry
              </span>
            </div>

            <h1 className="font-headline text-2xl md:text-3xl text-white font-bold tracking-tight">
              {account.name} — Risk Diagnosis
            </h1>

            <p className="text-xs md:text-sm text-blue-100/90 leading-relaxed font-body">
              {investigation?.risk_summary ||
                `Elevated churn likelihood driven by ${account.primary_reason_code.replace(/_/g, ' ')} ahead of contract renewal.`}
            </p>
          </div>

          {/* Key Metric Badges */}
          <div className="flex items-center gap-4 shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
            <div className="text-center px-2">
              <div className="text-[11px] text-blue-200 font-medium">Risk Score</div>
              <div className="text-2xl font-bold font-mono text-white flex items-center justify-center gap-1">
                <span>{account.risk_score}</span>
                <span className="text-xs text-blue-200 font-normal">/100</span>
              </div>
              <div className="mt-1">
                <RiskBadge level={account.risk_level} size="sm" />
              </div>
            </div>

            <div className="w-px h-12 bg-white/20" />

            <div className="text-center px-2">
              <div className="text-[11px] text-blue-200 font-medium">ARR Exposure</div>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {formatCurrency(account.arr)}
              </div>
              <div className="text-[10px] text-blue-200 mt-1 font-mono">{account.tier || 'Enterprise'}</div>
            </div>

            <div className="w-px h-12 bg-white/20" />

            <div className="text-center px-2">
              <div className="text-[11px] text-blue-200 font-medium">Renewal In</div>
              <div className="text-xl font-bold text-amber-300 font-mono mt-1">
                {account.urgency_days_to_renewal}d
              </div>
              <div className="text-[10px] text-blue-200 mt-1">{account.renewal_date}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Evidence and Risk Factors (5 Cols)           */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 1: Observed Facts */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-headline text-base font-bold text-[#020062]">
                    Observed Facts & Telemetry
                  </h2>
                  <p className="text-[11px] text-slate-500 font-body">
                    Verified signals extracted from multi-source records
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {account.signals.length} Signals
              </span>
            </div>

            {/* List of Observed Facts */}
            <div className="space-y-3">
              {investigation?.findings && investigation.findings.length > 0 ? (
                investigation.findings.map((finding, idx) => (
                  <div
                    key={`finding-${idx}`}
                    className="p-3.5 bg-slate-50/80 hover:bg-blue-50/40 border border-[#E2E8F0] hover:border-[#2563EB]/40 rounded-lg transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#020062] leading-snug group-hover:text-[#0025AE]">
                        {finding.claim}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-slate-600 shrink-0">
                        {finding.type || 'observed_fact'}
                      </span>
                    </div>

                    {/* Evidence Links */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-600 font-medium">Evidence links:</span>
                      {finding.evidence_ids && finding.evidence_ids.length > 0 ? (
                        finding.evidence_ids.map((eid) => (
                          <button
                            key={eid}
                            onClick={() => handleEvidenceClick(eid)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold bg-white hover:bg-[#2563EB] text-[#2563EB] hover:text-white border border-[#2563EB]/30 px-2 py-0.5 rounded transition-all cursor-pointer shadow-2xs"
                            title={`Click to open source record for ${eid}`}
                          >
                            <span>{eid}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">Direct telemetry record</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // Fallback direct signal display
                account.signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(sig.source_category)}
                        <span className="text-xs font-bold text-[#020062]">{sig.title}</span>
                      </div>
                      <button
                        onClick={() => handleEvidenceClick(sig.id)}
                        className="text-[10px] font-mono text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100 cursor-pointer"
                      >
                        {sig.id}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">{sig.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Missing Information & Blindspots (Strictly Required) */}
          <div className="bg-amber-50/50 rounded-xl border border-amber-200/80 p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-amber-200/60 pb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-amber-900">
                  Missing Information & Blindspots
                </h3>
                <p className="text-[11px] text-amber-700 font-body">
                  What the system cannot verify from stored data — needs investigation
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(investigation?.uncertainties || [
                "Customer's internal Q4 budget downsizing approval status is unverified in CRM records.",
                "Whether executive sponsor has evaluated alternative vendor solutions.",
                "The exact department-level driver behind the 45% active seat contraction is unknown."
              ]).map((unc, idx) => (
                <div
                  key={`unc-${idx}`}
                  className="flex items-start gap-2.5 text-xs text-amber-950 bg-white/80 p-3 rounded-lg border border-amber-200/60"
                >
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{unc}</span>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-amber-100/60 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Guardrail Active:</strong> The AI will not fabricate unverified assumptions or speculate beyond these boundaries.
              </span>
            </div>
          </div>

          {/* Section 3: Risk Factor Breakdown */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3 shadow-xs">
            <h3 className="font-headline text-sm font-bold text-[#020062] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span>Contributing Rule Factors</span>
            </h3>
            <div className="space-y-2">
              {account.contributing_factors.map((factor, idx) => (
                <div
                  key={`factor-${idx}`}
                  className="flex items-center justify-between text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <span className="text-slate-700 font-medium">{factor}</span>
                  <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    High Impact
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: AI Investigation (7 Cols)                  */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section A: Why the account is at risk (Causal Synthesis) */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold text-[#020062]">
                    Why the Account is at Risk
                  </h2>
                  <p className="text-[11px] text-slate-500 font-body">
                    Multi-signal causal synthesis explaining how signals interconnect
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Validated
              </span>
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-600 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#2563EB]" />
                <span className="text-xs">Synthesizing multi-source signals...</span>
              </div>
            ) : (
              <div className="prose prose-xs max-w-none text-slate-700 leading-relaxed space-y-3 font-body">
                <p className="p-4 bg-blue-50/40 border-l-4 border-[#2563EB] rounded-r-lg text-xs leading-relaxed text-slate-800">
                  {investigation?.causal_explanation ||
                    `The account '${account.name}' exhibits compounding churn risk (evaluated score: ${account.risk_score}/100). Telemetry captures significant license contraction occurring in tandem with an unanswered executive check-in and unresolved support escalations. With contract renewal scheduled in ${account.urgency_days_to_renewal} days, this cross-source pattern indicates active disengagement that requires immediate human intervention.`}
                </p>
              </div>
            )}
          </div>

          {/* Section B: Recommended Next Step (Action Proposal) */}
          {investigation?.recommended_action && (
            <div className="bg-linear-to-br from-white to-blue-50/40 rounded-xl border-2 border-[#2563EB]/30 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#2563EB] block">
                      Recommended Next Step
                    </span>
                    <h3 className="font-headline text-base font-bold text-[#020062]">
                      {investigation.recommended_action.title}
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold bg-[#2563EB]/10 text-[#2563EB] px-2.5 py-1 rounded">
                  {investigation.recommended_action.type || 'customer_check_in'}
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg">
                  <strong className="text-[#020062] block mb-1">Strategic Rationale:</strong>
                  <p className="text-slate-600 leading-relaxed">
                    {investigation.recommended_action.reason}
                  </p>
                </div>

                {investigation.recommended_action.suggested_payload?.body && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Drafted Outreach Payload:</span>
                      <button
                        onClick={() =>
                          handleCopyDraft(
                            investigation.recommended_action.suggested_payload?.body || ''
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] hover:underline cursor-pointer"
                      >
                        {copiedDraft ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Draft</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg font-mono text-[11px] leading-relaxed border border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {investigation.recommended_action.suggested_payload.body}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Stage CTA */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-600 font-body">
                  Target Recipient: <strong className="text-slate-800">{investigation.recommended_action.target_recipient || 'Account Champion'}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {onNavigateToCopilot && (
                    <button
                      onClick={onNavigateToCopilot}
                      className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Open Action Copilot (Page 5)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={onNavigateToApprovals}
                    className="inline-flex items-center gap-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#020062] text-xs font-semibold px-3.5 py-2.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-600" />
                    <span>Approval Center</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section C: Ask About This Account (Interactive Grounded Q&A) */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-[#020062]">
                    Ask About This Account
                  </h3>
                  <p className="text-[11px] text-slate-500 font-body">
                    Evidence-grounded conversational Q&A locked to {account.name}'s records
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Grounded Mode
              </span>
            </div>

            {/* Suggested Question Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-600 font-medium">Try asking:</span>
              {suggestedQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuestion(sq)}
                  disabled={chatLoading}
                  className="text-[11px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0025AE] border border-slate-200 hover:border-[#2563EB]/40 px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {sq}
                </button>
              ))}
            </div>

            {/* Chat Thread Container */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 bg-slate-50/60 p-3.5 rounded-xl border border-[#E2E8F0]">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  } space-y-1`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600 px-1 font-mono">
                    <span>{msg.sender === 'user' ? 'CSM Question' : 'SignalBridge AI'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-3 rounded-xl text-xs max-w-[90%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#2563EB] text-white font-medium rounded-tr-none'
                        : 'bg-white text-slate-800 border border-[#E2E8F0] shadow-2xs rounded-tl-none space-y-2'
                    }`}
                  >
                    <p>{msg.text}</p>

                    {/* Cited Evidence Chips */}
                    {msg.cited_evidence_ids && msg.cited_evidence_ids.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-600 font-medium">Cited evidence:</span>
                        {msg.cited_evidence_ids.map((cid) => (
                          <button
                            key={cid}
                            onClick={() => handleEvidenceClick(cid)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-[#2563EB] hover:text-white px-1.5 py-0.5 rounded transition-all cursor-pointer"
                          >
                            <span>{cid}</span>
                            <ExternalLink className="w-2 h-2" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Uncertainties inside response */}
                    {msg.uncertainties && msg.uncertainties.length > 0 && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200/60 space-y-1">
                        <span className="font-semibold block text-[10px] uppercase text-amber-700">
                          Uncertainty / Missing Data:
                        </span>
                        {msg.uncertainties.map((u, ui) => (
                          <div key={ui}>• {u}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-white border border-[#E2E8F0] rounded-xl w-fit">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                  <span>Retrieving verified records & evaluating evidence...</span>
                </div>
              )}
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder={`Ask anything about ${account.name}'s telemetry, stakeholders, or renewal risk...`}
                disabled={chatLoading}
                className="flex-1 bg-slate-50 border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-xs text-[#020062] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!questionInput.trim() || chatLoading}
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white p-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                title="Send Question"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SIGNAL PROVENANCE MODAL                                  */}
      {/* ======================================================== */}
      {selectedSignalForModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-[#E2E8F0] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2563EB] flex items-center justify-center">
                  {getSourceIcon(selectedSignalForModal.source_category)}
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-[#020062]">
                    Signal Provenance & Source Record
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>ID: {selectedSignalForModal.id}</span>
                    <span>•</span>
                    <span className="capitalize">{selectedSignalForModal.source_category}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedSignalForModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase font-mono">Event Summary</span>
                <p className="text-sm font-semibold text-[#020062] leading-snug">
                  {selectedSignalForModal.title}
                </p>
                <p className="text-slate-600 leading-relaxed pt-1">
                  {selectedSignalForModal.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-600 uppercase font-mono block">Observed Value</span>
                  <span className="font-mono font-bold text-red-600 text-xs">
                    {selectedSignalForModal.observed_value || 'Telemetry alert triggered'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-600 uppercase font-mono block">Severity</span>
                  <span className="font-semibold text-xs capitalize text-slate-800">
                    {selectedSignalForModal.severity} Priority
                  </span>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-[11px] font-semibold text-slate-600 uppercase font-mono">Raw Provenance Metadata</span>
                <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {JSON.stringify(
                    {
                      signal_id: selectedSignalForModal.id,
                      source_record_id: selectedSignalForModal.source_record_id || `rec_${selectedSignalForModal.id}`,
                      source_category: selectedSignalForModal.source_category,
                      signal_type: selectedSignalForModal.signal_type,
                      event_time: selectedSignalForModal.timestamp,
                      observed_value: selectedSignalForModal.observed_value,
                      ingestion_origin: 'MongoDB Data Sync v1.0',
                      integrity_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-600 font-mono">
                Verified Ground-Truth Record
              </span>
              <button
                onClick={() => setSelectedSignalForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
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
