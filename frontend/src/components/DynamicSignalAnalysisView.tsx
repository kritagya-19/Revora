import { useState, useEffect } from 'react';
import type {
  AccountDetail,
  AccountRiskSummary,
  AccountSignalAnalysisResult,
  BatchSignalAnalysisSummary
} from '../types/api';
import {
  fetchAccountSignalAnalysis,
  triggerAutomatedPortfolioScan
} from '../services/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Headphones,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  ShieldAlert,
  Zap,
  ArrowRight,
  Database,
  Layers,
  Users,
  Info
} from 'lucide-react';

interface DynamicSignalAnalysisViewProps {
  account: AccountDetail;
  allAccounts?: AccountRiskSummary[];
  onSelectAccount?: (accountId: string) => void;
  onNavigateToAutopsy?: () => void;
}

export function DynamicSignalAnalysisView({
  account,
  allAccounts = [],
  onSelectAccount,
  onNavigateToAutopsy
}: DynamicSignalAnalysisViewProps) {
  const [analysis, setAnalysis] = useState<AccountSignalAnalysisResult | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<BatchSignalAnalysisSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'validation' | 'baseline' | 'portfolio'>('overview');
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async (accId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAccountSignalAnalysis(accId);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dynamic signal analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutomatedScan = async () => {
    try {
      setScanning(true);
      const batchData = await triggerAutomatedPortfolioScan();
      setPortfolioSummary(batchData);
      // Reload current account analysis
      await loadAnalysis(account.id);
    } catch (err: any) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadAnalysis(account.id);
  }, [account.id]);

  if (loading && !analysis) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <RefreshCw className="w-6 h-6 text-[#2563EB] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-700">Evaluating multi-source signals & telemetry...</p>
        <p className="text-[11px] text-slate-400">Comparing 30-day activity against 90-day baseline across usage, CRM, and calendar.</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Signal Analysis Error</span>
        </div>
        <p>{error || 'No analysis data available.'}</p>
        <button
          onClick={() => loadAnalysis(account.id)}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700 cursor-pointer"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  const v = analysis.validation_report;
  const u = analysis.product_usage;
  const e = analysis.customer_engagement;
  const r = analysis.renewal_window;
  const m = analysis.meetings_calendar;
  const s = analysis.support_issues;
  const b = analysis.baseline_comparison;

  const getTrajectoryIcon = (traj: string) => {
    switch (traj) {
      case 'severe_deterioration':
        return <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'deteriorating':
        return <TrendingDown className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Signal Quality & Automated Scan Action */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                Task A • Dynamic Signal Analysis
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {analysis.total_signals_examined} Signals Examined across {analysis.categories_present.length} Sources
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#2563EB]" />
                <span>Multi-Source Signal Intelligence & Integrity: {account.name}</span>
              </h2>
              {allAccounts.length > 0 && onSelectAccount && (
                <select
                  value={account.id}
                  onChange={(e) => onSelectAccount(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium cursor-pointer"
                >
                  {allAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.risk_score} pts)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Signal Quality Score Badge */}
            <div className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 ${
              v.quality_score >= 80
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                : v.quality_score >= 55
                ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                : 'bg-rose-50/70 border-rose-200 text-rose-800'
            }`}>
              <div className="text-right">
                <span className="text-[9px] uppercase font-mono tracking-wider block text-slate-400 font-bold">
                  Signal Integrity
                </span>
                <span className="text-sm font-bold font-mono">
                  {v.quality_score}/100 • {v.confidence_level.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Run Automated Portfolio Scan */}
            <button
              onClick={handleAutomatedScan}
              disabled={scanning}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Automates scanning across all customer accounts in the portfolio"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-300 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning Portfolio...' : 'Automate Scan'}</span>
            </button>

            {onNavigateToAutopsy && (
              <button
                onClick={onNavigateToAutopsy}
                className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Proceed to Autopsy</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-100" />
              </button>
            )}
          </div>
        </div>

        {/* Executive Verdict Banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          v.conflicting_signals.length > 0
            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
            : u.trajectory === 'severe_deterioration'
            ? 'bg-rose-50/80 border-rose-200 text-rose-900'
            : 'bg-blue-50/80 border-blue-200 text-blue-900'
        }`}>
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold uppercase tracking-wider text-[10px] block opacity-80">
              Executive Signal Verdict
            </span>
            <p className="font-medium leading-relaxed">
              {analysis.executive_signal_verdict}
            </p>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5-Dimension Analysis
          </button>
          <button
            onClick={() => setActiveTab('baseline')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'baseline'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Historical Baseline Comparison
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'validation'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Signal Validation</span>
            {v.total_issues_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                {v.total_issues_count}
              </span>
            )}
          </button>
          {portfolioSummary && (
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portfolio Scan Results ({portfolioSummary.total_accounts_scanned})
            </button>
          )}
        </div>
      </div>

      {/* 2. TAB: 5-DIMENSION ANALYSIS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Dimension 1: Product Usage */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-600" />
                <span>Product Usage</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                u.trajectory === 'severe_deterioration'
                  ? 'bg-rose-100 text-rose-800'
                  : u.trajectory === 'deteriorating'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {u.trajectory.replace('_', ' ')}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {u.current_active_users}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  / {u.baseline_active_users} baseline seats
                </span>
              </div>
              <span className="text-xs font-semibold text-rose-600 block mt-0.5">
                -{u.drop_percentage.toFixed(1)}% contraction
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-[#FAFCFF] p-2.5 rounded-xl border border-slate-100">
              {u.summary}
            </p>
            {u.evidence_signal_ids.length > 0 && (
              <div className="text-[10px] font-mono text-slate-400 pt-1">
                Evidence: {u.evidence_signal_ids.slice(0, 2).join(', ')}
              </div>
            )}
          </div>

          {/* Dimension 2: Customer Engagement */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer Engagement</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                e.status === 'critical_silence'
                  ? 'bg-rose-100 text-rose-800'
                  : e.status === 'lag_warning'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {e.status.replace('_', ' ')}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {e.days_since_last_touchpoint}d
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  since last CSM touchpoint
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {Object.entries(e.channel_breakdown).map(([ch, cnt]) => (
                  <span key={ch} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                    {ch}: {cnt}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-[#FAFCFF] p-2.5 rounded-xl border border-slate-100">
              {e.summary}
            </p>
          </div>

          {/* Dimension 3: Renewal Window */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Renewal Window</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                r.window_tier === 'immediate'
                  ? 'bg-rose-100 text-rose-800'
                  : r.window_tier === 'critical'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {r.window_tier} tier
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {r.days_to_renewal}d
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  to contract expiration
                </span>
              </div>
              <span className="text-xs font-semibold text-rose-600 block mt-0.5">
                {r.urgency_label}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-[#FAFCFF] p-2.5 rounded-xl border border-slate-100">
              {r.summary}
            </p>
          </div>

          {/* Dimension 4: Meetings & Calendar */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Meetings & Calendar</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                m.cadence_health === 'cadence_broken'
                  ? 'bg-rose-100 text-rose-800'
                  : m.cadence_health === 'scheduled'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {m.cadence_health.replace('_', ' ')}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {m.upcoming_meetings_count}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  upcoming ({m.recent_meetings_count} past)
                </span>
              </div>
              <span className="text-xs text-slate-500 block mt-0.5">
                Next meeting: {m.next_meeting_date ? m.next_meeting_date.slice(0, 10) : 'None scheduled'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-[#FAFCFF] p-2.5 rounded-xl border border-slate-100">
              {m.summary}
            </p>
          </div>

          {/* Dimension 5: Support Issues */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-rose-600" />
                <span>Support Issues & Blockers</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                s.status === 'critical_blockers'
                  ? 'bg-rose-100 text-rose-800'
                  : s.status === 'escalated'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {s.status.replace('_', ' ')}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {s.critical_tickets_count}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  critical ({s.open_tickets_count} total open)
                </span>
              </div>
              <span className="text-xs text-slate-500 block mt-0.5">
                {s.high_tickets_count} high priority tickets
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-[#FAFCFF] p-2.5 rounded-xl border border-slate-100">
              {s.summary}
            </p>
          </div>

          {/* Summary Card */}
          <div className="bg-[#020062] text-white rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Telemetry Synthesis</span>
              </span>
              <p className="text-xs text-blue-100 leading-relaxed">
                Multi-source signals verified and correlated. Deterministic risk engine evaluates these dimensions to produce transparent, auditable churn classifications.
              </p>
            </div>
            <div className="pt-2 border-t border-blue-900/60 flex items-center justify-between text-xs">
              <span className="text-blue-300 font-mono">Signals Integrity:</span>
              <span className="font-bold text-emerald-400">{v.quality_score}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: BASELINE COMPARISON */}
      {activeTab === 'baseline' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#2563EB]" />
              <span>Historical Baseline vs Current Activity Comparison</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares current 30-day activity against the established 90-day baseline to detect momentum and trajectory changes.
            </p>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80 bg-[#FAFCFF] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Product Usage Delta
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${
                  b.usage_delta_pct < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {b.usage_delta_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">vs 90d baseline</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Baseline seats: {u.baseline_active_users} • Current: {u.current_active_users}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-[#FAFCFF] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Engagement Frequency Delta
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${
                  b.touchpoint_frequency_delta_pct < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {b.touchpoint_frequency_delta_pct.toFixed(0)}%
                </span>
                <span className="text-xs text-slate-400">vs weekly cadence</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Touchpoint lag: {e.days_since_last_touchpoint} days
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-[#FAFCFF] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Support Escalation Delta
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${
                  b.support_volume_delta > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  +{b.support_volume_delta}
                </span>
                <span className="text-xs text-slate-400">critical/high tickets</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {s.critical_tickets_count} critical blockers open
              </p>
            </div>
          </div>

          {/* Trajectory Breakdown */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2">
              {getTrajectoryIcon(b.trajectory)}
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Computed Trajectory: {b.trajectory.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {b.trend_description}
            </p>
          </div>
        </div>
      )}

      {/* 4. TAB: SIGNAL VALIDATION (MISSING, STALE, CONFLICTING, INSUFFICIENT) */}
      {activeTab === 'validation' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <span>Signal Health & Telemetry Validation</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically identifies missing signals, stale data, cross-silo contradictions, and insufficient signal volumes.
              </p>
            </div>
            <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
              v.is_valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {v.is_valid ? 'SIGNALS VALIDATED' : 'ANOMALIES DETECTED'}
            </span>
          </div>

          {/* Counts Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60">
              <span className="text-[10px] font-mono text-rose-700 uppercase font-bold block">
                Conflicting Signals
              </span>
              <span className="text-xl font-bold font-mono text-rose-900">
                {v.conflicting_signals.length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60">
              <span className="text-[10px] font-mono text-amber-700 uppercase font-bold block">
                Missing Telemetry
              </span>
              <span className="text-xl font-bold font-mono text-amber-900">
                {v.missing_signals.length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-mono text-slate-600 uppercase font-bold block">
                Stale Records
              </span>
              <span className="text-xl font-bold font-mono text-slate-900">
                {v.stale_signals.length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/60">
              <span className="text-[10px] font-mono text-purple-700 uppercase font-bold block">
                Insufficient Checks
              </span>
              <span className="text-xl font-bold font-mono text-purple-900">
                {v.insufficient_signals.length}
              </span>
            </div>
          </div>

          {/* Issue Cards */}
          <div className="space-y-3">
            {/* Conflicting Signals */}
            {v.conflicting_signals.map((iss, idx) => (
              <div key={`conf-${idx}`} className="p-4 rounded-xl border border-rose-200 bg-rose-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Cross-Silo Contradiction Detected ({iss.category})</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-800">
                    High Severity
                  </span>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed font-medium">
                  {iss.description}
                </p>
                <div className="pt-2 border-t border-rose-200/80 text-[11px] text-rose-800 flex items-start gap-1.5">
                  <span className="font-bold shrink-0">Recommendation:</span>
                  <span>{iss.recommendation}</span>
                </div>
              </div>
            ))}

            {/* Missing Telemetry */}
            {v.missing_signals.map((iss, idx) => (
              <div key={`miss-${idx}`} className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span>Missing Data Source: {iss.category}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-800">
                    {iss.severity}
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {iss.description}
                </p>
                <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <span className="font-bold shrink-0">Action:</span>
                  <span>{iss.recommendation}</span>
                </div>
              </div>
            ))}

            {/* Stale Signals */}
            {v.stale_signals.map((iss, idx) => (
              <div key={`stale-${idx}`} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>Stale Record: {iss.category}</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{iss.severity}</span>
                </div>
                <p className="text-xs text-slate-600">{iss.description}</p>
                <p className="text-[11px] text-slate-500 italic">Action: {iss.recommendation}</p>
              </div>
            ))}

            {/* Insufficient Signals */}
            {v.insufficient_signals.map((iss, idx) => (
              <div key={`insuff-${idx}`} className="p-4 rounded-xl border border-purple-200 bg-purple-50 space-y-2">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-purple-600" />
                  <span>Telemetry Volume Warning</span>
                </span>
                <p className="text-xs text-purple-900">{iss.description}</p>
                <p className="text-[11px] text-purple-800 font-medium">Recommendation: {iss.recommendation}</p>
              </div>
            ))}

            {v.total_issues_count === 0 && (
              <div className="py-8 text-center text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                All signals validated! No missing, stale, or conflicting telemetry detected for this account.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB: PORTFOLIO SCAN RESULTS */}
      {activeTab === 'portfolio' && portfolioSummary && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#2563EB]" />
              <span>Automated Portfolio Scan Summary ({portfolioSummary.total_accounts_scanned} Accounts)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregate signal integrity report across all monitored customer accounts.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-[#FAFCFF]">
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">
                Avg Quality Score
              </span>
              <span className="text-xl font-bold font-mono text-slate-900">
                {portfolioSummary.average_signal_quality_score}%
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
              <span className="text-[10px] font-mono text-rose-700 uppercase font-bold block">
                With Conflicts
              </span>
              <span className="text-xl font-bold font-mono text-rose-900">
                {portfolioSummary.accounts_with_conflicts}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
              <span className="text-[10px] font-mono text-amber-700 uppercase font-bold block">
                With Missing Data
              </span>
              <span className="text-xl font-bold font-mono text-amber-900">
                {portfolioSummary.accounts_with_missing_signals}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">
                With Stale Signals
              </span>
              <span className="text-xl font-bold font-mono text-slate-900">
                {portfolioSummary.accounts_with_stale_signals}
              </span>
            </div>
          </div>

          {/* Account List */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {portfolioSummary.account_summaries.map((accItem) => (
              <div
                key={accItem.account_id}
                onClick={() => onSelectAccount && onSelectAccount(accItem.account_id)}
                className="p-3 sm:p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {accItem.account_name}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      accItem.quality_score >= 80
                        ? 'bg-emerald-100 text-emerald-800'
                        : accItem.quality_score >= 55
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {accItem.quality_score}%
                    </span>
                    {accItem.conflicts_count > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                        {accItem.conflicts_count} Conflicts
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    {accItem.verdict}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DynamicSignalAnalysisView;
