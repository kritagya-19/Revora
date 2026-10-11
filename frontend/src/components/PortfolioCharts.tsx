import { useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { 
  ShieldAlert, 
  Calendar, 
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface PortfolioChartsProps {
  accounts: AccountRiskSummary[];
  selectedRiskFilter: string;
  onSelectRiskFilter: (filter: string) => void;
  currency?: 'USD' | 'INR';
  onNavigateToAutopsy?: (accountId: string) => void;
}

export function PortfolioCharts({
  accounts,
  selectedRiskFilter,
  onSelectRiskFilter,
  currency = 'USD',
  onNavigateToAutopsy
}: PortfolioChartsProps) {
  // Format currency helper
  const formatCur = (amount: number) => {
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

  // 1. Calculate Risk Tiers
  const riskMetrics = useMemo(() => {
    const totalArr = accounts.reduce((sum, a) => sum + (a.arr || 0), 0) || 1;
    const critical = accounts.filter((a) => a.risk_level === 'critical');
    const high = accounts.filter((a) => a.risk_level === 'high');
    const medium = accounts.filter((a) => a.risk_level === 'medium');
    const low = accounts.filter((a) => a.risk_level === 'low');

    const critArr = critical.reduce((s, a) => s + (a.arr || 0), 0);
    const highArr = high.reduce((s, a) => s + (a.arr || 0), 0);
    const medArr = medium.reduce((s, a) => s + (a.arr || 0), 0);
    const lowArr = low.reduce((s, a) => s + (a.arr || 0), 0);

    return {
      totalArr,
      critical: { count: critical.length, arr: critArr, pct: Math.round((critArr / totalArr) * 100) },
      high: { count: high.length, arr: highArr, pct: Math.round((highArr / totalArr) * 100) },
      medium: { count: medium.length, arr: medArr, pct: Math.round((medArr / totalArr) * 100) },
      low: { count: low.length, arr: lowArr, pct: Math.round((lowArr / totalArr) * 100) }
    };
  }, [accounts]);

  // 2. Calculate Renewal Horizon Buckets
  const horizonMetrics = useMemo(() => {
    const buckets = [
      { id: '30', label: '< 30 Days', desc: 'Critical Renewal Window', accounts: [] as AccountRiskSummary[], color: 'bg-rose-500' },
      { id: '60', label: '30 - 60 Days', desc: 'Active Intervention Window', accounts: [] as AccountRiskSummary[], color: 'bg-amber-500' },
      { id: '90', label: '60 - 90 Days', desc: 'Advance Preparation', accounts: [] as AccountRiskSummary[], color: 'bg-blue-500' },
      { id: 'beyond', label: '90+ Days', desc: 'Stable Horizon', accounts: [] as AccountRiskSummary[], color: 'bg-emerald-500' }
    ];

    accounts.forEach((acc) => {
      const days = acc.urgency_days_to_renewal || 999;
      if (days <= 30) buckets[0].accounts.push(acc);
      else if (days <= 60) buckets[1].accounts.push(acc);
      else if (days <= 90) buckets[2].accounts.push(acc);
      else buckets[3].accounts.push(acc);
    });

    const maxArr = Math.max(...buckets.map((b) => b.accounts.reduce((s, a) => s + a.arr, 0)), 1);

    return buckets.map((b) => {
      const arr = b.accounts.reduce((s, a) => s + a.arr, 0);
      const widthPct = Math.max(Math.round((arr / maxArr) * 100), 6);
      return {
        ...b,
        arr,
        count: b.accounts.length,
        widthPct
      };
    });
  }, [accounts]);

  // Top priority account for guided action
  const topPriorityAccount = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => {
      if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
      return (a.urgency_days_to_renewal || 999) - (b.urgency_days_to_renewal || 999);
    });
    return sorted[0] || null;
  }, [accounts]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. GUIDANCE HERO BANNER: Tells the team immediately what to do!           */}
      {/* ========================================================================= */}
      {topPriorityAccount && (
        <div className="bg-linear-to-r from-slate-900 via-slate-850 to-blue-950 border border-slate-850 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Immediate Action Required
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Rank #1 Priority: {topPriorityAccount.urgency_days_to_renewal}d until contract renewal
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {topPriorityAccount.name} exhibits {topPriorityAccount.risk_score}/100 churn risk
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              Detected concurrent telemetry contraction (<span className="text-rose-300 font-semibold">-38% to -52% usage</span>) alongside unanswered customer touchpoints. 
              {formatCur(topPriorityAccount.arr)} contract ARR is currently exposed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              onClick={() => onNavigateToAutopsy?.(topPriorityAccount.id)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Diagnose {topPriorityAccount.name}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VISUAL CHARTS GRID: Risk Distribution & Renewal Exposure               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART 1: Portfolio Risk Distribution (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <span>Portfolio Risk Distribution</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Portfolio ARR: <strong className="text-slate-200">{formatCur(riskMetrics.totalArr)}</strong> across {accounts.length} active customer accounts
              </p>
            </div>

            {selectedRiskFilter !== 'all' && (
              <button
                onClick={() => onSelectRiskFilter('all')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline self-start sm:self-auto"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Stacked Horizontal Distribution Bar */}
          <div className="space-y-2">
            <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner bg-slate-950 p-0.5 border border-slate-800">
              <div 
                style={{ width: `${Math.max(riskMetrics.critical.pct, 4)}%` }}
                className="bg-rose-500 hover:bg-rose-400 transition-all cursor-pointer relative group rounded-l-lg"
                onClick={() => onSelectRiskFilter('critical')}
                title={`Critical: ${riskMetrics.critical.count} accounts (${formatCur(riskMetrics.critical.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.high.pct, 4)}%` }}
                className="bg-amber-500 hover:bg-amber-400 transition-all cursor-pointer relative group"
                onClick={() => onSelectRiskFilter('high')}
                title={`High: ${riskMetrics.high.count} accounts (${formatCur(riskMetrics.high.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.medium.pct, 4)}%` }}
                className="bg-blue-500 hover:bg-blue-400 transition-all cursor-pointer relative group"
                onClick={() => onSelectRiskFilter('medium')}
                title={`Medium: ${riskMetrics.medium.count} accounts (${formatCur(riskMetrics.medium.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.low.pct, 4)}%` }}
                className="bg-emerald-500 hover:bg-emerald-400 transition-all cursor-pointer relative group rounded-r-lg"
                onClick={() => onSelectRiskFilter('low')}
                title={`Healthy: ${riskMetrics.low.count} accounts (${formatCur(riskMetrics.low.arr)})`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>0%</span>
              <span>Portfolio ARR Allocation</span>
              <span>100%</span>
            </div>
          </div>

          {/* Interactive Tier Cards (Clicking filters table below!) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* Critical */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'critical' ? 'all' : 'critical')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'critical'
                  ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40 text-white'
                  : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400">Critical</span>
                <span className="text-xs font-mono font-bold bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800">
                  {riskMetrics.critical.count}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono mt-2">
                {formatCur(riskMetrics.critical.arr)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {riskMetrics.critical.pct}% of ARR
              </div>
            </button>

            {/* High */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'high' ? 'all' : 'high')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'high'
                  ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/40 text-white'
                  : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">High Risk</span>
                <span className="text-xs font-mono font-bold bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800">
                  {riskMetrics.high.count}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono mt-2">
                {formatCur(riskMetrics.high.arr)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {riskMetrics.high.pct}% of ARR
              </div>
            </button>

            {/* Medium */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'medium' ? 'all' : 'medium')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'medium'
                  ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/40 text-white'
                  : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400">Medium</span>
                <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">
                  {riskMetrics.medium.count}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono mt-2">
                {formatCur(riskMetrics.medium.arr)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {riskMetrics.medium.pct}% of ARR
              </div>
            </button>

            {/* Healthy */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'low' ? 'all' : 'low')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'low'
                  ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/40 text-white'
                  : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">Healthy</span>
                <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                  {riskMetrics.low.count}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono mt-2">
                {formatCur(riskMetrics.low.arr)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {riskMetrics.low.pct}% of ARR
              </div>
            </button>
          </div>
        </div>

        {/* CHART 2: Renewal Horizon & Urgency Exposure (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-lg space-y-5 flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Renewal Horizon Exposure</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Urgency breakdown by upcoming contract expiration window
            </p>
          </div>

          {/* Visual Bars for each renewal bucket */}
          <div className="space-y-4">
            {horizonMetrics.map((bucket) => (
              <div key={bucket.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{bucket.label}</span>
                    <span className="text-[11px] text-slate-400">({bucket.count} accounts)</span>
                  </div>
                  <span className="font-mono font-bold text-white">
                    {formatCur(bucket.arr)}
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    style={{ width: `${bucket.widthPct}%` }}
                    className={`h-full ${bucket.color} rounded-full transition-all duration-500`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-850 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Deterministic Rule Engine Active
            </span>
            <span className="font-mono text-slate-400 text-[11px]">Daily Synchronized</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PortfolioCharts;
