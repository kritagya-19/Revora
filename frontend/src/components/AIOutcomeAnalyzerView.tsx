import { useState, useEffect } from 'react';
import type {
  OutcomeAnalysisResult,
  AccountRiskSummary,
  OutcomeAnalysisRequest
} from '../types/api';
import {
  analyzeOutcomeNotes,
  fetchOutcomeAnalysesForAccount
} from '../services/api';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  BookmarkCheck,
  RefreshCw,
  PlusCircle,
  ShieldAlert,
  ChevronDown,
  Quote,
  Target,
  ArrowRight,
  Database
} from 'lucide-react';

interface AIOutcomeAnalyzerViewProps {
  initialAccountId?: string;
  accounts: AccountRiskSummary[];
  onSelectAccount?: (accountId: string) => void;
  onNavigateToAutopsy?: (accountId: string) => void;
  onNavigateToTimeline?: (accountId: string) => void;
}

export function AIOutcomeAnalyzerView({
  initialAccountId,
  accounts,
  onSelectAccount,
  onNavigateToAutopsy,
  onNavigateToTimeline
}: AIOutcomeAnalyzerViewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || (accounts.length > 0 ? accounts[0].id : '')
  );
  const [analyses, setAnalyses] = useState<OutcomeAnalysisResult[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<OutcomeAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Form State
  const [rawText, setRawText] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('meeting_note');
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [participants, setParticipants] = useState<string>('');
  const [autoIngest, setAutoIngest] = useState<boolean>(true);

  // Quick preset sample notes
  const [showPresets, setShowPresets] = useState<boolean>(false);

  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadAccountAnalyses = async (accId: string) => {
    if (!accId) return;
    try {
      setLoading(true);
      const data = await fetchOutcomeAnalysesForAccount(accId);
      setAnalyses(data);
      if (data.length > 0) {
        setSelectedAnalysis(data[0]);
      } else {
        setSelectedAnalysis(null);
      }
    } catch (err: any) {
      console.error('Failed to load analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountAnalyses(selectedAccountId);
    }
  }, [selectedAccountId]);

  const handleRunAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawText.trim()) {
      setToast({ type: 'error', message: 'Please paste or write meeting notes or email text.' });
      return;
    }

    try {
      setAnalyzing(true);
      const req: OutcomeAnalysisRequest = {
        account_id: selectedAccountId,
        source_type: sourceType,
        title: noteTitle || `${sourceType.replace('_', ' ').toUpperCase()} — ${meetingDate}`,
        raw_text: rawText,
        meeting_date: meetingDate,
        participants: participants || 'CSM & Customer Stakeholders',
        auto_ingest_as_evidence: autoIngest
      };

      const result = await analyzeOutcomeNotes(req);
      setAnalyses((prev) => [result, ...prev]);
      setSelectedAnalysis(result);
      setToast({
        type: 'success',
        message: `Notes successfully transformed into structured intelligence! ${
          autoIngest ? 'Ingested into Revora evidence store.' : ''
        }`
      });
      // Clear form
      setRawText('');
      setNoteTitle('');
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'LLM Outcome analysis failed.'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyPreset = (type: 'sso_blocker' | 'competitor_threat' | 'expansion_sync') => {
    if (type === 'sso_blocker') {
      setNoteTitle('Technical Review & Okta SSO Roadblock Discussion');
      setSourceType('meeting_note');
      setParticipants('David Kim (VP Eng), Sarah Jenkins (CSM), Marcus Vance (SE)');
      setRawText(
        `Debrief with VP of Engineering David and his lead security architect. David emphasized that while product response times are down 40% across their staging pipelines, their 50 backend engineers still can't use the core workspace. Okta SAML certificate verification keeps failing on callback validation.

David was very explicit: renewal is coming up in 43 days. Finance has already flagged our seat licenses as under-utilized, and they will completely freeze the 20% enterprise expansion unless SAML SSO is 100% operational by next Wednesday. David appeared anxious about committing before their internal audit review.

Agreed next steps: Marcus (Revora SE) will provide a dedicated XML certificate test file by tomorrow noon. David committed to having his DevOps engineer run a joint debugging screen share on Thursday at 2 PM.`
      );
    } else if (type === 'competitor_threat') {
      setNoteTitle('Email thread: Leadership Change & Competitor Evaluation Warning');
      setSourceType('email_thread');
      setParticipants('Jordan Blake (Interim Director), Elena Rostova (CSM)');
      setRawText(
        `From: Jordan Blake <j.blake@customer.io>
Elena,
Following our VP's departure last week, executive leadership is conducting an emergency budget consolidation. We have noticed our weekly API pipeline consumption drop by 50% as several projects were deprioritized.
Given the current economic targets, our CFO is demanding a 30% reduction across all tooling renewals. Additionally, our new infrastructure director has scheduled an evaluation of Datadog's unified suite next week as a cost-cutting alternative.
Unless Revora can match our target discount and demonstrate concrete ROI for the remaining developers, we will not be renewing the enterprise contract in December.

Next steps: Please send a revised renewal quotation reflecting adjusted seat minimums before Friday.`
      );
    } else {
      setNoteTitle('Executive Business Review & Q4 Expansion Strategy');
      setSourceType('meeting_note');
      setParticipants('Rachel Green (VP Analytics), Marcus Vance (CSM Lead)');
      setRawText(
        `EBR meeting concluded with Analytics leadership. Rachel gave enthusiastic feedback on the recent machine learning pipeline acceleration. She noted that their executive team considers Revora a tier-1 mission-critical asset.
However, she noted two adoption blockers: the marketing analytics team hasn't been onboarded because they lack self-service reporting templates, and cross-department permissions are too rigid.
Rachel promised that if we deliver marketing dashboard templates by month-end, she will champion a $45k contract expansion for 25 additional seats in Q4.`
      );
    }
    setShowPresets(false);
  };

  const filteredAnalyses = analyses;

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
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#020062] via-[#0A195E] to-[#1D4ED8] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-xs mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              Feature 3 — AI Outcome Analyzer
            </div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-white">
              Unstructured Feedback to Structured Intelligence
            </h2>
            <p className="text-blue-100 text-sm mt-1.5 leading-relaxed font-body">
              Uses an LLM to turn free-text meeting notes, emails, and user feedback into structured,
              searchable account information. Raw notes become useful context for the next investigation cycle.
            </p>
          </div>

          {/* Account Selector */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shrink-0 min-w-[280px]">
            <label className="block text-xs font-semibold text-blue-200 mb-1.5 font-mono uppercase">
              Target Customer Account
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
                  {acc.name} — {acc.risk_level.toUpperCase()} Risk
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Core Architectural Principle Reminder Callout */}
        <div className="mt-5 p-3 rounded-xl bg-white/10 border border-white/15 flex items-center gap-3 text-xs text-blue-100">
          <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            <strong>Deterministic Safety Rule:</strong> Customer sentiment is explicitly treated as an{' '}
            <span className="underline decoration-amber-300 font-semibold text-white">
              interpretation supported by quoted evidence
            </span>
            , never asserted as an unverified ground-truth fact about internal mental states.
          </span>
        </div>
      </div>

      {/* Main Grid: Left (Input Form & History) + Right (Structured Output Brief) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Form + Past Analyses (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Analysis Form */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#020062] font-headline">
                  Parse Unstructured Notes
                </h3>
              </div>

              {/* Sample Preset Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPresets(!showPresets)}
                  className="px-2.5 py-1 text-xs font-semibold text-[#0025AE] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Insert Sample</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showPresets && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs">
                    <button
                      onClick={() => handleApplyPreset('sso_blocker')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 block cursor-pointer"
                    >
                      <strong className="block text-[#020062]">Acme: SSO Roadblock Meeting</strong>
                      <span className="text-slate-500 text-[11px]">Authentication blocker & 43-day renewal freeze</span>
                    </button>
                    <button
                      onClick={() => handleApplyPreset('competitor_threat')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 block border-t border-slate-100 cursor-pointer"
                    >
                      <strong className="block text-rose-700">HyperScale: Datadog Threat Email</strong>
                      <span className="text-slate-500 text-[11px]">Sponsor exit, cost freeze & Datadog trial</span>
                    </button>
                    <button
                      onClick={() => handleApplyPreset('expansion_sync')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 block border-t border-slate-100 cursor-pointer"
                    >
                      <strong className="block text-emerald-700">EBR Expansion & Analytics Feedback</strong>
                      <span className="text-slate-500 text-[11px]">Positive reception with marketing blocker</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleRunAnalysis} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Source Format</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full p-2 rounded-lg border border-[#E2E8F0] font-semibold text-slate-700 focus:outline-hidden focus:border-[#2563EB]"
                  >
                    <option value="meeting_note">Meeting Note / Call</option>
                    <option value="email_thread">Email Thread</option>
                    <option value="customer_feedback">User Feedback / NPS</option>
                    <option value="call_transcript">Call Transcript</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Interaction Date</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-[#E2E8F0] text-slate-700 focus:outline-hidden focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title / Context</label>
                <input
                  type="text"
                  placeholder="e.g., Weekly Sync with VP Engineering"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Participants</label>
                <input
                  type="text"
                  placeholder="e.g., David Kim (VP Eng), Sarah Jenkins (CSM)"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Raw Text, Notes, or Email Body <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Paste unstructured customer feedback, meeting takeaways, objections, or email correspondence here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-body"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  id="autoIngest"
                  checked={autoIngest}
                  onChange={(e) => setAutoIngest(e.target.checked)}
                  className="rounded text-[#2563EB] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="autoIngest" className="text-slate-600 cursor-pointer">
                  Automatically register as a verified Signal in the Account Evidence Store
                </label>
              </div>

              <button
                type="submit"
                disabled={analyzing}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0025AE] hover:bg-[#020062] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                <span>{analyzing ? 'Synthesizing with LLM...' : 'Extract Structured Intelligence'}</span>
              </button>
            </form>
          </div>

          {/* Past Analyses Drawer */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                Account Knowledge Archive ({filteredAnalyses.length})
              </span>
              <button
                onClick={() => loadAccountAnalyses(selectedAccountId)}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 italic">Loading past analyses...</p>
            ) : filteredAnalyses.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No structured reports saved for this account yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredAnalyses.map((item) => {
                  const isSelected = selectedAnalysis?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAnalysis(item)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#2563EB] bg-blue-50/50 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                        <span className="uppercase text-[#0025AE] font-semibold">{item.source_type}</span>
                        <span>{new Date(item.analyzed_at).toLocaleDateString()}</span>
                      </div>
                      <h5 className="font-bold text-[#020062] line-clamp-1">{item.title}</h5>
                      <p className="text-slate-500 line-clamp-1 mt-0.5 text-[11px]">
                        {item.structured_investigation_brief}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Structured Intelligence Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-4 sticky top-24">
          {selectedAnalysis ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-slate-100">
              {/* Header */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-t-xl">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0025AE] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {selectedAnalysis.id}
                    </span>
                    <span className="font-medium text-slate-700">{selectedAnalysis.account_name}</span>
                  </div>
                  <span className="font-mono">{new Date(selectedAnalysis.analyzed_at).toLocaleString()}</span>
                </div>

                <h3 className="text-lg font-bold text-[#020062] font-headline leading-tight">
                  {selectedAnalysis.title}
                </h3>

                {selectedAnalysis.participants && (
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>Participants:</strong> {selectedAnalysis.participants}
                  </p>
                )}
              </div>

              {/* 1. Customer Sentiment & Concerns (Framed as Interpretation) */}
              <div className="p-5 space-y-3 bg-blue-50/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                      1. Sentiment & Stance (Interpreted)
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase ${
                      selectedAnalysis.sentiment_analysis.sentiment_label === 'positive'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedAnalysis.sentiment_analysis.sentiment_label === 'critical_risk'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedAnalysis.sentiment_analysis.sentiment_label === 'frustrated'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedAnalysis.sentiment_analysis.sentiment_label.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-body">
                  {selectedAnalysis.sentiment_analysis.interpretation}
                </p>

                {/* Supporting Quote / Evidence */}
                <div className="bg-white p-3 rounded-lg border border-blue-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                  <Quote className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-semibold text-slate-800 text-[11px] uppercase tracking-wider font-mono">
                      Supporting Evidence Excerpt
                    </span>
                    <p className="italic text-slate-600 mt-0.5">
                      "{selectedAnalysis.sentiment_analysis.supporting_quote_or_evidence}"
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono italic">
                  * {selectedAnalysis.sentiment_analysis.is_interpretation_notice}
                </div>
              </div>

              {/* 2. Product-Adoption Blockers */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                      2. Product-Adoption Blockers ({selectedAnalysis.adoption_blockers.length})
                    </span>
                  </div>
                </div>

                {selectedAnalysis.adoption_blockers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No adoption blockers identified.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAnalysis.adoption_blockers.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-amber-200 bg-amber-50/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-800">{b.blocker_title}</strong>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            {b.severity}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          <strong>Feature/Area:</strong> {b.feature_or_area}
                        </p>
                        <p className="text-slate-500 text-[11px] italic">
                          <strong>Evidence:</strong> {b.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Renewal Concerns & Objections */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                      3. Renewal-Related Objections ({selectedAnalysis.renewal_objections.length})
                    </span>
                  </div>
                </div>

                {selectedAnalysis.renewal_objections.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No renewal objections surfaced.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAnalysis.renewal_objections.map((obj, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-rose-200 bg-rose-50/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-rose-900 uppercase font-mono text-[11px]">
                            {obj.objection_type} Concern
                          </strong>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold uppercase">
                            Impact: {obj.impact_level}
                          </span>
                        </div>
                        <p className="text-slate-700">{obj.description}</p>
                        <p className="text-slate-500 text-[11px] italic">
                          <strong>Quote:</strong> "{obj.direct_evidence}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Customer Commitments & Agreed Next Steps */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                    4. Agreed Commitments & Next Steps ({selectedAnalysis.commitments_and_next_steps.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedAnalysis.commitments_and_next_steps.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-emerald-900 uppercase font-mono">
                          Owner: {c.responsible_party}
                        </span>
                        <span className="font-mono text-slate-500">
                          Due: {c.agreed_timeline || 'Next Sync'}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{c.commitment_text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Unresolved Issues & Recommended Follow-Up */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-[#020062] uppercase tracking-wider font-mono">
                    5. Unresolved Issues & Immediate Follow-up
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedAnalysis.unresolved_issues.map((u, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/20 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-[#020062]">{u.issue_title}</strong>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold uppercase">
                          Urgency: {u.urgency}
                        </span>
                      </div>
                      <p className="text-slate-600">{u.description}</p>
                      <div className="pt-1.5 border-t border-indigo-100 text-[11px] text-[#0025AE] font-semibold">
                        Recommended Action: {u.recommended_follow_up} ({u.target_owner})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Investigation Ready Synthesis */}
              <div className="p-5 bg-slate-50 rounded-b-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#020062] font-mono uppercase text-[11px]">
                    Structured Executive Briefing for Next Investigation
                  </span>
                  {selectedAnalysis.generated_signal_id && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Database className="w-3 h-3" />
                      Signal ID: {selectedAnalysis.generated_signal_id}
                    </span>
                  )}
                </div>

                <p className="text-slate-700 leading-relaxed font-body bg-white p-3 rounded-lg border border-slate-200">
                  {selectedAnalysis.structured_investigation_brief}
                </p>

                {/* Quick Link Navigation */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  {onNavigateToTimeline && (
                    <button
                      onClick={() => onNavigateToTimeline(selectedAnalysis.account_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0025AE] bg-blue-50 hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      View on Customer Timeline
                    </button>
                  )}
                  {onNavigateToAutopsy && (
                    <button
                      onClick={() => onNavigateToAutopsy(selectedAnalysis.account_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0025AE] hover:bg-[#020062] transition-all cursor-pointer"
                    >
                      Run AI Autopsy with Evidence
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center text-slate-500 space-y-3">
              <Bot className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-[#020062]">No Analysis Selected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Paste meeting notes or email text on the left, or click "Insert Sample" to generate
                structured intelligence and extract blockers, objections, and commitments.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIOutcomeAnalyzerView;
