import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  User,
  ArrowUpRight,
  X
} from 'lucide-react';
import {
  fetchDispatchedSurveys,
  fetchFeedbackResponses,
  checkFeedbackTriggerEligibility,
  dispatchFeedbackSurvey,
  scanPortfolioTriggers
} from '../services/api';
import type {
  FeedbackSurveyDispatch,
  CustomerFeedbackRecord,
  FeedbackTriggerCheck,
  AccountRiskSummary,
  CreateFeedbackSurveyRequest,
  BatchTriggerScanResult
} from '../types/api';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackFlowInteractiveView } from './FeedbackFlowInteractiveView';

interface FeedbackManagementViewProps {
  accounts: AccountRiskSummary[];
  initialAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onNavigateToAutopsy?: (accountId: string) => void;
  onNavigateToTimeline?: (accountId: string) => void;
  onNavigateToApprovals?: () => void;
  onNavigateToCopilot?: (accountId: string) => void;
}

export function FeedbackManagementView({
  accounts,
  initialAccountId,
  onSelectAccount,
  onNavigateToAutopsy,
  onNavigateToTimeline,
  onNavigateToApprovals,
  onNavigateToCopilot
}: FeedbackManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'flow' | 'overview' | 'surveys' | 'interactive_form'>('flow');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || (accounts[0]?.id || 'acc-101'));
  
  // Data State
  const [surveys, setSurveys] = useState<FeedbackSurveyDispatch[]>([]);
  const [responses, setResponses] = useState<CustomerFeedbackRecord[]>([]);
  const [triggerCheck, setTriggerCheck] = useState<FeedbackTriggerCheck | null>(null);
  
  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [triggerLoading, setTriggerLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New Survey Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [customIntro, setCustomIntro] = useState<string>('');
  const [selectedSurveyCodeForFill, setSelectedSurveyCodeForFill] = useState<string>('rev-fb-acme-101');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterReason, setFilterReason] = useState<string>('all');

  // Portfolio Auto-Trigger Scanner State
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<BatchTriggerScanResult | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  useEffect(() => {
    loadAllFeedbackData();
  }, [selectedAccountId]);

  const handleRunPortfolioScan = async (forceIgnore: boolean = false) => {
    try {
      setScanning(true);
      setError(null);
      const result = await scanPortfolioTriggers(forceIgnore);
      setScanResult(result);
      await loadAllFeedbackData();
    } catch (err: any) {
      setError(err.message || 'Portfolio scan failed');
    } finally {
      setScanning(false);
    }
  };

  const loadAllFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [surveysData, responsesData] = await Promise.all([
        fetchDispatchedSurveys(),
        fetchFeedbackResponses()
      ]);
      setSurveys(surveysData);
      setResponses(responsesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback records');
    } finally {
      setLoading(false);
    }

    if (selectedAccountId) {
      try {
        setTriggerLoading(true);
        const check = await checkFeedbackTriggerEligibility(selectedAccountId);
        setTriggerCheck(check);
      } catch (err: any) {
        console.warn('Error loading trigger check:', err);
      } finally {
        setTriggerLoading(false);
      }
    }
  };

  const handleDispatchSurvey = async () => {
    if (!selectedAccountId) return;
    try {
      setDispatching(true);
      setDispatchError(null);
      const req: CreateFeedbackSurveyRequest = {
        account_id: selectedAccountId,
        custom_intro: customIntro || undefined,
        delivery_channel: 'email'
      };
      const dispatched = await dispatchFeedbackSurvey(req);
      setShowDispatchModal(false);
      setCustomIntro('');
      // Reload surveys list
      const surveysData = await fetchDispatchedSurveys();
      setSurveys(surveysData);
      setSelectedSurveyCodeForFill(dispatched.survey_code);
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to dispatch survey');
    } finally {
      setDispatching(false);
    }
  };

  // Filtered responses
  const filteredResponses = responses.filter((r) => {
    if (filterReason !== 'all' && r.analysis?.classified_churn_reason !== filterReason) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.account_name.toLowerCase().includes(q) ||
      r.recipient_name.toLowerCase().includes(q) ||
      (r.submission.primary_blocker && r.submission.primary_blocker.toLowerCase().includes(q)) ||
      (r.analysis?.recommended_retention_action && r.analysis.recommended_retention_action.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Feature: Feedback Form & Survey Loop
            </span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Closed-Loop Customer Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#020062] font-headline">
            Customer Feedback Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Evaluate trigger eligibility, send targeted survey forms, review customer blockers, and execute AI-recommended retention actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRunPortfolioScan(false)}
            disabled={scanning}
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Scan all monitored accounts against declining usage and risk trigger rules"
          >
            <Sparkles className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Auto-Scan Triggers'}
          </button>
          <button
            onClick={() => loadAllFeedbackData()}
            className="p-2.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
            title="Refresh feedback data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Dispatch New Survey
          </button>
        </div>
      </div>

      {/* Auto-Trigger Scan Result Banner */}
      {scanResult && (
        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-indigo-900 block flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Automated Portfolio Trigger Scan Completed
            </span>
            <p className="text-indigo-800 mt-0.5">
              Scanned <span className="font-bold">{scanResult.scanned_accounts_count}</span> accounts •{' '}
              <span className="font-bold text-emerald-700">{scanResult.auto_triggered_surveys.length}</span> surveys auto-dispatched •{' '}
              <span className="font-bold text-slate-600">{scanResult.duplicate_prevented_count}</span> duplicate requests prevented •{' '}
              <span className="font-bold text-amber-700">{scanResult.cooldown_prevented_count}</span> fatigue cooldowns enforced.
            </p>
          </div>
          <button
            onClick={() => setScanResult(null)}
            className="text-indigo-600 hover:text-indigo-900 text-[11px] font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadAllFeedbackData()}
            className="text-rose-900 font-bold hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Account Selector & Trigger Engine Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Context */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Target Account
            </span>
            <span className="text-xs font-medium text-slate-500">
              {accounts.length} Accounts Monitored
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Account for Feedback Review:
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                if (onSelectAccount) onSelectAccount(e.target.value);
              }}
              className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — Risk: {acc.risk_score} ({acc.risk_level.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {selectedAccount && (
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ARR Exposure:</span>
                <span className="font-bold font-mono text-slate-900">${selectedAccount.arr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Renewal Date:</span>
                <span className="font-semibold text-slate-800">{selectedAccount.renewal_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CSM Owner:</span>
                <span className="font-semibold text-slate-800">{selectedAccount.csm_owner}</span>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] flex gap-2">
                {onNavigateToAutopsy && (
                  <button
                    onClick={() => onNavigateToAutopsy(selectedAccount.id)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-[#0025AE] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all cursor-pointer text-center"
                  >
                    View Autopsy
                  </button>
                )}
                {onNavigateToTimeline && (
                  <button
                    onClick={() => onNavigateToTimeline(selectedAccount.id)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-all cursor-pointer text-center"
                  >
                    View Timeline
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Feedback Trigger Decision Engine */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#020062]">
                  Feedback Trigger Service — Decision Rules
                </h3>
                <p className="text-[11px] text-slate-500">
                  Checks deterministic churn signals, survey frequency cooldown, and contact preferences.
                </p>
              </div>
            </div>

            {triggerCheck && (
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${
                triggerCheck.eligible
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {triggerCheck.eligible ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Eligible for Survey
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Cooldown / Not Eligible
                  </>
                )}
              </span>
            )}
          </div>

          {triggerLoading ? (
            <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" /> Evaluating deterministic trigger rules...
            </div>
          ) : triggerCheck ? (
            <div className="space-y-4 pt-1 text-xs">
              {/* Trigger Rules Audit Cards */}
              {triggerCheck.matched_rules && triggerCheck.matched_rules.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {triggerCheck.matched_rules.map((rule) => (
                    <div
                      key={rule.rule_id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                        rule.triggered
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                        rule.triggered ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {rule.triggered ? '!' : '✓'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold block truncate leading-tight text-[11px]">
                          {rule.rule_name}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          {rule.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reasons & Safeguards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-[#E2E8F0]">
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-700 block">Trigger Decision Audit:</span>
                  <ul className="space-y-1">
                    {triggerCheck.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                        <span className="text-[#2563EB] mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duplicate Pending Survey:</span>
                    <span className={`font-mono font-bold ${triggerCheck.duplicate_pending_survey ? 'text-amber-700' : 'text-slate-700'}`}>
                      {triggerCheck.duplicate_pending_survey ? `ACTIVE (${triggerCheck.pending_survey_code})` : 'NONE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cooldown Guard:</span>
                    <span className={`font-mono font-bold ${triggerCheck.cooldown_active ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {triggerCheck.cooldown_active ? `ACTIVE (${triggerCheck.cooldown_days_remaining}d left)` : 'CLEARED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recommended Template:</span>
                    <span className="font-mono text-[#0025AE] truncate">
                      {triggerCheck.recommended_template_id}
                    </span>
                  </div>
                  {triggerCheck.last_survey_sent_at && (
                    <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-200">
                      <span>Last Survey Sent:</span>
                      <span>{new Date(triggerCheck.last_survey_sent_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Select an account to view trigger assessment.</p>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="border-b border-[#E2E8F0] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'flow', label: '⚡ 20-Node Agent Flowchart', count: 'Interactive' },
            { id: 'overview', label: 'All Responses & AI Analysis', count: responses.length },
            { id: 'surveys', label: 'Dispatched Surveys', count: surveys.length },
            { id: 'interactive_form', label: 'Fill / Test Feedback Form', count: null }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === tab.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  tab.id === 'flow' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SUBTAB 0: 20-Node Interactive Agent Flowchart */}
      {activeSubTab === 'flow' && (
        <FeedbackFlowInteractiveView
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => {
            setSelectedAccountId(accId);
            onSelectAccount?.(accId);
          }}
          onNavigateToCopilot={onNavigateToCopilot}
          onNavigateToApprovals={onNavigateToApprovals}
          onNavigateToTimeline={onNavigateToTimeline}
        />
      )}

      {/* SUBTAB 1: Overview & All Responses */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by account, contact, blocker or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-600">Churn Driver:</span>
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-slate-700"
              >
                <option value="all">All Drivers</option>
                <option value="adoption_blocker">Adoption Blocker</option>
                <option value="technical_bugs">Technical Bugs</option>
                <option value="pricing">Pricing & Minimums</option>
                <option value="poor_onboarding">Poor Onboarding</option>
              </select>
            </div>
          </div>

          {/* Responses Grid / Table */}
          {filteredResponses.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Feedback Responses Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Dispatch a survey or use the "Fill / Test Feedback Form" tab to generate responses.
              </p>
              <button
                onClick={() => setActiveSubTab('interactive_form')}
                className="mt-4 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Open Feedback Form
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResponses.map((item) => {
                const score = item.submission.satisfaction_score;
                const ana = item.analysis;
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E2E8F0] hover:border-blue-200 rounded-2xl p-5 shadow-xs transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm ${
                          (score || 10) <= 4 ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          (score || 10) <= 6 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {score ? `${score}/10` : 'N/A'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#020062]">{item.account_name}</h4>
                            <span className="text-[11px] font-mono text-slate-400">• {new Date(item.submitted_at).toLocaleDateString()}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            Respondent: {item.recipient_name} ({item.recipient_email})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ana && (
                          <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            ana.urgency_level === 'critical' ? 'bg-rose-100 text-rose-800' :
                            ana.urgency_level === 'high' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-[#0025AE]'
                          }`}>
                            Urgency: {ana.urgency_level}
                          </span>
                        )}
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.survey_code}
                        </span>
                      </div>
                    </div>

                    {/* Customer Reported Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                        <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" /> Customer Verbatim Feedback:
                        </span>
                        <div>
                          <span className="text-slate-500 font-medium">Reported Blocker:</span>
                          <p className="text-slate-900 font-semibold mt-0.5">
                            {item.submission.primary_blocker || 'None reported'}
                          </p>
                        </div>
                        {item.submission.unresolved_issues && (
                          <div>
                            <span className="text-slate-500 font-medium">Unresolved Friction:</span>
                            <p className="text-slate-700 mt-0.5 italic">
                              "{item.submission.unresolved_issues}"
                            </p>
                          </div>
                        )}
                        {item.submission.feature_improvement_request && (
                          <div>
                            <span className="text-slate-500 font-medium">Requested Improvement:</span>
                            <p className="text-slate-700 mt-0.5">
                              {item.submission.feature_improvement_request}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* AI Outcome & Retention Action */}
                      {ana && (
                        <div className="space-y-2.5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0025AE] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" /> AI Synthesis & Retention Action
                            </span>
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded font-bold">
                              Confidence: {Math.round((ana.confidence_score || 0.88) * 100)}%
                            </span>
                          </div>

                          {/* Executive Summary */}
                          {ana.executive_summary && (
                            <p className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-blue-100 leading-relaxed font-medium">
                              {ana.executive_summary}
                            </p>
                          )}

                          <div>
                            <span className="text-slate-500 font-medium">Classified Driver:</span>
                            <span className="ml-1.5 font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                              {ana.classified_churn_reason.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 font-medium">Recommended Retention Action:</span>
                            <p className="text-slate-900 font-semibold mt-0.5 bg-white p-2.5 rounded-lg border border-blue-200 shadow-2xs">
                              {ana.recommended_retention_action}
                            </p>
                          </div>

                          {/* Uncertainties & Blindspots */}
                          {ana.uncertainties && ana.uncertainties.length > 0 && (
                            <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 space-y-1">
                              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                                Uncertainties & Unknowns:
                              </span>
                              <ul className="space-y-0.5">
                                {ana.uncertainties.map((u, i) => (
                                  <li key={i} className="text-[10px] text-amber-800 flex items-start gap-1">
                                    <span className="mt-0.5 text-amber-600">•</span>
                                    <span>{u}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-blue-100">
                            <span className="italic">Sentiment: {ana.sentiment_label}</span>
                            <div className="flex items-center gap-2">
                              {onNavigateToApprovals && (
                                <button
                                  onClick={onNavigateToApprovals}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                  title="Review and approve proposed feedback retention interventions"
                                >
                                  Review in Approval Gate →
                                </button>
                              )}
                              {onNavigateToCopilot && (
                                <button
                                  onClick={() => onNavigateToCopilot(item.account_id)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0025AE] border border-blue-200 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                  title="Open in Next-Best-Action Copilot to inspect generated drafts"
                                >
                                  Inspect in Copilot →
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
      )}

      {/* SUBTAB 2: Dispatched Surveys */}
      {activeSubTab === 'surveys' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#020062]">Dispatched Survey Registry</h3>
            <span className="text-xs text-slate-500 font-mono">{surveys.length} total dispatches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-slate-500 uppercase tracking-wider font-mono border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-3">Survey Code</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent At</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {surveys.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-[#0025AE]">{s.survey_code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.account_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.recipient_name} ({s.recipient_email})</td>
                    <td className="px-4 py-3 font-mono uppercase text-slate-500">{s.delivery_channel}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold ${
                        s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        s.status === 'sent' ? 'bg-blue-100 text-[#0025AE]' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(s.sent_at || s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedSurveyCodeForFill(s.survey_code);
                          setActiveSubTab('interactive_form');
                        }}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        Open Form <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Interactive Customer Feedback Form */}
      {activeSubTab === 'interactive_form' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0025AE]">Testing Survey Token:</span>
              <select
                value={selectedSurveyCodeForFill}
                onChange={(e) => setSelectedSurveyCodeForFill(e.target.value)}
                className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-mono text-slate-800"
              >
                {surveys.map((s) => (
                  <option key={s.survey_code} value={s.survey_code}>
                    {s.survey_code} ({s.account_name} - {s.status})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-slate-500 italic">
              Demonstrates Step 4 & 5: Customer fills out ratings and submit connects to AI analysis.
            </span>
          </div>

          <FeedbackForm
            surveyCode={selectedSurveyCodeForFill}
            onSubmitted={() => {
              loadAllFeedbackData();
            }}
          />
        </div>
      )}

      {/* Modal: Dispatch Survey */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#020062] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2563EB]" /> Dispatch Feedback Survey
              </h3>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispatchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {dispatchError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Account:</label>
                <input
                  type="text"
                  disabled
                  value={selectedAccount ? `${selectedAccount.name} (Risk: ${selectedAccount.risk_score})` : 'Select account'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Channel:</label>
                <select
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option>Email (Approved Customer-Facing Channel)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custom Invitation Message (Optional):
                </label>
                <textarea
                  rows={3}
                  value={customIntro}
                  onChange={(e) => setCustomIntro(e.target.value)}
                  placeholder="e.g. Hi David, we noticed recent shifts in API usage and wanted to check in to ensure you have the engineering support you need..."
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-3">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 bg-[#F1F5F9] text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchSurvey}
                disabled={dispatching}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {dispatching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Dispatch Survey
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
