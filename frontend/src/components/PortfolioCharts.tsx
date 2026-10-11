import { useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { 
  ShieldAlert, 
  Calendar, 
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingDown
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
      { id: '30', label: '< 30 Days', desc: 'Critical Renewal', accounts: [] as AccountRiskSummary[], color: 'bg-rose-500' },
      { id: '60', label: '30 - 60 Days', desc: 'Urgent Action', accounts: [] as AccountRiskSummary[], color: 'bg-amber-500' },
      { id: '90', label: '60 - 90 Days', desc: 'Active Plan', accounts: [] as AccountRiskSummary[], color: 'bg-blue-600' },
      { id: 'beyond', label: '90+ Days', desc: 'Stable Contract', accounts: [] as AccountRiskSummary[], color: 'bg-emerald-500' }
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
      const widthPct = Math.max(Math.round((arr / maxArr) * 100), 8);
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
      {/* 1. CRITICAL AT-RISK ACCOUNT ALERT: Structured with Problem & Impact */}
      {topPriorityAccount && (
        <div className="bg-white border border-rose-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative overflow-hidden">
          <div className="space-y-3 max-w-2xl">
            {/* Status & Priority Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Priority 1 Churn Risk
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Renews in {topPriorityAccount.urgency_days_to_renewal} days
              </span>
            </div>

            {/* Account & Exposure */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-normal leading-snug">
                {topPriorityAccount.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exposes <strong className="text-slate-900 font-semibold">{formatCur(topPriorityAccount.arr)}</strong> ARR • Churn Risk Score: <strong className="text-rose-600 font-bold">{topPriorityAccount.risk_score}/100</strong>
              </p>
            </div>

            {/* Structured Problem Breakdown */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-md">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                -38% to -52% Telemetry Drop
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-md">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                50 Days Inactive (No Contact)
              </span>
            </div>
          </div>

          {/* Action CTA */}
          <div className="shrink-0 w-full sm:w-auto">
            <button
              onClick={() => onNavigateToAutopsy?.(topPriorityAccount.id)}
              className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Diagnose {topPriorityAccount.name}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* 2. VISUAL CHARTS GRID: Risk Breakdown & Renewal Horizon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART 1: Portfolio Risk Distribution (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-normal flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#2563EB]" />
                <span>Risk Distribution</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total Portfolio ARR: <strong className="text-slate-900">{formatCur(riskMetrics.totalArr)}</strong> ({accounts.length} accounts)
              </p>
            </div>

            {selectedRiskFilter !== 'all' && (
              <button
                onClick={() => onSelectRiskFilter('all')}
                className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold cursor-pointer underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Clean Segmented Distribution Bar */}
          <div className="space-y-1.5">
            <div className="h-4 w-full rounded-lg overflow-hidden flex bg-slate-100 p-0.5 border border-slate-200">
              <div 
                style={{ width: `${Math.max(riskMetrics.critical.pct, 4)}%` }}
                className="bg-rose-500 hover:bg-rose-600 transition-all cursor-pointer rounded-l-md"
                onClick={() => onSelectRiskFilter('critical')}
                title={`Critical: ${riskMetrics.critical.count} accounts (${formatCur(riskMetrics.critical.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.high.pct, 4)}%` }}
                className="bg-amber-500 hover:bg-amber-600 transition-all cursor-pointer"
                onClick={() => onSelectRiskFilter('high')}
                title={`High: ${riskMetrics.high.count} accounts (${formatCur(riskMetrics.high.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.medium.pct, 4)}%` }}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] transition-all cursor-pointer"
                onClick={() => onSelectRiskFilter('medium')}
                title={`Medium: ${riskMetrics.medium.count} accounts (${formatCur(riskMetrics.medium.arr)})`}
              />
              <div 
                style={{ width: `${Math.max(riskMetrics.low.pct, 4)}%` }}
                className="bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer rounded-r-md"
                onClick={() => onSelectRiskFilter('low')}
                title={`Healthy: ${riskMetrics.low.count} accounts (${formatCur(riskMetrics.low.arr)})`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
              <span>0%</span>
              <span>ARR by Risk Tier</span>
              <span>100%</span>
            </div>
          </div>

          {/* Interactive Tier Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {/* Critical */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'critical' ? 'all' : 'critical')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'critical'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                  : 'bg-[#FAFCFF] hover:bg-rose-50/40 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700">Critical</span>
                <span className="text-[11px] font-mono font-bold bg-white text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                  {riskMetrics.critical.count}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1.5">
                {formatCur(riskMetrics.critical.arr)}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {riskMetrics.critical.pct}% of ARR
              </div>
            </button>

            {/* High */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'high' ? 'all' : 'high')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'high'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                  : 'bg-[#FAFCFF] hover:bg-amber-50/40 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">High</span>
                <span className="text-[11px] font-mono font-bold bg-white text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                  {riskMetrics.high.count}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1.5">
                {formatCur(riskMetrics.high.arr)}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {riskMetrics.high.pct}% of ARR
              </div>
            </button>

            {/* Medium */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'medium' ? 'all' : 'medium')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'medium'
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
                  : 'bg-[#FAFCFF] hover:bg-blue-50/40 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2563EB]">Medium</span>
                <span className="text-[11px] font-mono font-bold bg-white text-[#2563EB] px-1.5 py-0.5 rounded border border-blue-200">
                  {riskMetrics.medium.count}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1.5">
                {formatCur(riskMetrics.medium.arr)}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {riskMetrics.medium.pct}% of ARR
              </div>
            </button>

            {/* Healthy */}
            <button
              onClick={() => onSelectRiskFilter(selectedRiskFilter === 'low' ? 'all' : 'low')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRiskFilter === 'low'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
                  : 'bg-[#FAFCFF] hover:bg-emerald-50/40 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">Healthy</span>
                <span className="text-[11px] font-mono font-bold bg-white text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                  {riskMetrics.low.count}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1.5">
                {formatCur(riskMetrics.low.arr)}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {riskMetrics.low.pct}% of ARR
              </div>
            </button>
          </div>
        </div>

        {/* CHART 2: Renewal Horizon Breakdown (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 tracking-normal flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2563EB]" />
              <span>Renewal Horizon</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Urgency breakdown by expiration window
            </p>
          </div>

          {/* Renewal Bucket Progress Rows */}
          <div className="space-y-3.5">
            {horizonMetrics.map((bucket) => (
              <div key={bucket.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{bucket.label}</span>
                    <span className="text-[11px] text-slate-600">({bucket.count})</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCur(bucket.arr)}
                  </span>
                </div>

                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                  <div
                    style={{ width: `${bucket.widthPct}%` }}
                    className={`h-full ${bucket.color} rounded-full transition-all duration-300`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PortfolioCharts;
