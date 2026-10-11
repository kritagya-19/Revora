import { useState, useMemo } from 'react';
import type { AccountDetail, AccountRiskSummary, Signal, RevenueRiskAutopsy } from '../types/api';
import { fetchAccountAutopsy } from '../services/api';
import { RiskBadge } from './RiskBadge';
import {
  Sparkles,
  Users,
  Activity,
  Calendar,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Bot,
  MessageSquare,
  TrendingDown,
  Headphones,
  CalendarDays,
  FileText,
  X,
  Layers,
  ArrowRight,
  Search,
  Building2
} from 'lucide-react';

interface CustomerDetailViewProps {
  account: AccountDetail;
  allAccounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  onBackToRadar: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onInvestigateWithAI?: () => void;
  onNavigateToCopilot?: () => void;
  onNavigateToFeedback?: () => void;
}

export function CustomerDetailView({
  account,
  allAccounts = [],
  onSelectAccount,
  onBackToRadar,
  currency = 'USD',
  onNavigateToApprovals,
  onInvestigateWithAI,
  onNavigateToCopilot,
  onNavigateToFeedback
}: CustomerDetailViewProps) {
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [autopsy, setAutopsy] = useState<RevenueRiskAutopsy | null>(null);
  const [autopsyLoading, setAutopsyLoading] = useState<boolean>(false);
  const [showAutopsyModal, setShowAutopsyModal] = useState<boolean>(false);

  // Customer Directory Search & Risk Filter State
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'split' | 'full'>('split');

  // Currency formatting
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) {
        return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      } else if (inrAmount >= 100000) {
        return `₹${(inrAmount / 100000).toFixed(1)} L`;
      }
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  // Sort and filter all customer accounts by Risk Priority (Critical -> High -> Medium -> Healthy)
  const prioritizedAccounts = useMemo(() => {
    const riskOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      healthy: 1,
      low: 1
    };

    return [...allAccounts]
      .filter((acc) => {
        if (riskFilter !== 'all' && acc.risk_level.toLowerCase() !== riskFilter.toLowerCase()) {
          return false;
        }
        if (!customerSearch.trim()) return true;
        const q = customerSearch.toLowerCase();
        return (
          acc.name.toLowerCase().includes(q) ||
          (acc.domain && acc.domain.toLowerCase().includes(q)) ||
          (acc.industry && acc.industry.toLowerCase().includes(q)) ||
          (acc.csm_owner && acc.csm_owner.toLowerCase().includes(q)) ||
          (acc.primary_reason_code && acc.primary_reason_code.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const pA = riskOrder[a.risk_level.toLowerCase()] || 0;
        const pB = riskOrder[b.risk_level.toLowerCase()] || 0;
        if (pA !== pB) return pB - pA; // highest priority first
        return (b.risk_score || 0) - (a.risk_score || 0); // highest score first
      });
  }, [allAccounts, riskFilter, customerSearch]);

  // Risk count stats
  const riskCounts = useMemo(() => {
    return {
      all: allAccounts.length,
      critical: allAccounts.filter((a) => a.risk_level.toLowerCase() === 'critical').length,
      high: allAccounts.filter((a) => a.risk_level.toLowerCase() === 'high').length,
      medium: allAccounts.filter((a) => a.risk_level.toLowerCase() === 'medium').length,
      healthy: allAccounts.filter((a) => a.risk_level.toLowerCase() === 'healthy' || a.risk_level.toLowerCase() === 'low').length
    };
  }, [allAccounts]);

  // Filtered timeline signals for active account
  const filteredSignals = useMemo(() => {
    return (account.signals || []).filter((s) => {
      if (timelineFilter !== 'all' && s.source_category.toLowerCase() !== timelineFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [account.signals, timelineFilter]);

  // Handle "Investigate with AI"
  const handleInvestigateWithAI = async () => {
    if (onInvestigateWithAI) {
      onInvestigateWithAI();
      return;
    }
    setShowAutopsyModal(true);
    if (!autopsy) {
      try {
        setAutopsyLoading(true);
        const data = await fetchAccountAutopsy(account.id);
        setAutopsy(data);
      } catch (err) {
        console.error('Error loading AI autopsy:', err);
      } finally {
        setAutopsyLoading(false);
      }
    }
  };

  // Helper for source category icon
  const getSourceIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'usage':
        return <Activity className="w-4 h-4 text-purple-400" />;
      case 'support':
        return <Headphones className="w-4 h-4 text-rose-400" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-400" />;
      case 'calendar':
        return <CalendarDays className="w-4 h-4 text-amber-400" />;
      case 'crm':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const metrics = account.customer_metrics;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* TOP HEADER: Navigation, Risk Priority Switcher & View Mode Toggle        */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 lg:p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToRadar}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#020062] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Revenue Radar</span>
          </button>
          <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />
          <div>
            <h2 className="text-base font-normal text-[#020062] font-headline flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>Customer 360 & Priority Directory</span>
            </h2>
            <p className="text-xs text-slate-500 font-body">
              Browse all customer accounts by risk priority or select any business to inspect telemetry
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Active Account Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-[#020062]'
              }`}
            >
              Split View ({allAccounts.length})
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'full'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-[#020062]'
              }`}
            >
              Full Dossier
            </button>
          </div>

          <div className="text-xs text-slate-600 font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 rounded-xl hidden md:block">
            Viewing: <strong className="text-[#0025AE] font-semibold">{account.name}</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MASTER-DETAIL LAYOUT: Left Directory (All Customers) + Right 360 Dossier */}
      {/* ========================================================================= */}
      <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-6`}>
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Customer Directory Ranked by Risk Priority                 */}
        {/* ======================================================================= */}
        {viewMode === 'split' && (
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 lg:p-5 shadow-xs space-y-4 sticky top-6">
              {/* Directory Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="font-headline text-base font-normal text-[#020062]">
                    All Customer Accounts
                  </h3>
                </div>
                <span className="text-xs font-mono bg-[#F0F5FF] text-[#0025AE] px-2.5 py-0.5 rounded-md border border-blue-200">
                  {prioritizedAccounts.length} / {allAccounts.length}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search any customer, domain, CSM..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-9 pr-8 py-2 text-xs text-[#020062] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
                {customerSearch && (
                  <button
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Risk Priority Filters */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button
                  onClick={() => setRiskFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    riskFilter === 'all'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-slate-600 hover:text-[#020062] border border-[#E2E8F0]'
                  }`}
                >
                  All ({riskCounts.all})
                </button>
                <button
                  onClick={() => setRiskFilter('critical')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    riskFilter === 'critical'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  Critical ({riskCounts.critical})
                </button>
                <button
                  onClick={() => setRiskFilter('high')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    riskFilter === 'high'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  High ({riskCounts.high})
                </button>
                <button
                  onClick={() => setRiskFilter('medium')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    riskFilter === 'medium'
                      ? 'bg-[#0025AE] text-white shadow-xs'
                      : 'bg-blue-50 text-[#0025AE] hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  Medium ({riskCounts.medium})
                </button>
                <button
                  onClick={() => setRiskFilter('healthy')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    riskFilter === 'healthy'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Healthy ({riskCounts.healthy})
                </button>
              </div>

              {/* Scrollable Customer List by Risk Priority */}
              <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {prioritizedAccounts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No customers match "{customerSearch}".
                  </div>
                ) : (
                  prioritizedAccounts.map((item) => {
                    const isSelected = item.id === account.id;
                    const isUrgent = item.urgency_days_to_renewal <= 30;

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectAccount(item.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#F0F5FF] border-[#2563EB] ring-1 ring-[#2563EB]/40 shadow-xs'
                            : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Row 1: Name, Risk Badge, Active Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-sm text-[#020062] truncate block">
                              {item.name}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#2563EB] text-white font-bold shrink-0">
                                Active Dossier
                              </span>
                            )}
                          </div>
                          <RiskBadge level={item.risk_level} score={item.risk_score} size="sm" />
                        </div>

                        {/* Row 2: ARR & Renewal Urgency */}
                        <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                          <span className="font-mono text-slate-700 font-semibold">
                            {formatCurrency(item.arr)}
                          </span>
                          <span
                            className={`font-semibold ${
                              isUrgent ? 'text-rose-700' : 'text-slate-500'
                            }`}
                          >
                            {item.urgency_days_to_renewal}d to renewal
                          </span>
                        </div>

                        {/* Row 3: Primary Risk Reason & CSM */}
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-slate-500 font-body">
                          <span className="font-mono text-[#0025AE] truncate max-w-[170px]">
                            {item.primary_reason_code}
                          </span>
                          <span className="text-slate-500 truncate">
                            CSM: {item.csm_owner.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: Full 360 Customer Detail Dossier for Selected Business    */}
        {/* ======================================================================= */}
        <div className={`${viewMode === 'split' ? 'lg:col-span-8 xl:col-span-8' : 'lg:col-span-12'} space-y-6`}>
          {/* SECTION A: Customer Header Hero */}
          <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 lg:p-8 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E2E8F0]">
              {/* Left: Account Identity & Owners */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-headline text-3xl lg:text-4xl text-[#020062] font-normal tracking-tight">
                    {account.name}
                  </h1>
                  <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
                  <span className="text-xs px-3 py-1 rounded-full bg-[#F8FAFC] text-slate-700 font-medium border border-[#E2E8F0]">
                    {account.tier || 'Enterprise'}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium border border-emerald-200 capitalize">
                    {account.status || 'Active'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 font-body">
                  <span>Domain: <strong className="text-[#020062] font-mono">{account.domain || 'saas.app'}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Industry: <strong className="text-[#020062]">{account.industry || 'Enterprise SaaS'}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>CSM Owner: <strong className="text-[#020062]">{account.csm_owner}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Primary Driver: <strong className="font-mono text-[#0025AE]">{account.primary_reason_code}</strong></span>
                </div>
              </div>

              {/* Right: Key Stats & CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-right min-w-[130px]">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold mb-1">
                    Contract ARR
                  </span>
                  <span className="text-2xl lg:text-3xl font-headline text-[#020062] font-normal block">
                    {formatCurrency(account.arr)}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-right min-w-[150px]">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold mb-1">
                    Renewal Horizon
                  </span>
                  <div className="text-lg font-headline text-[#020062] font-normal flex items-center justify-end gap-1.5">
                    <Calendar className="w-4 h-4 text-[#2563EB]" />
                    <span>{account.renewal_date}</span>
                  </div>
                  <span className="text-xs text-rose-700 font-semibold block mt-1">
                    {account.urgency_days_to_renewal} days remaining
                  </span>
                </div>

                {/* CTAs */}
                <div className="flex items-center gap-3">
                  {onNavigateToFeedback && (
                    <button
                      onClick={onNavigateToFeedback}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-sm font-semibold cursor-pointer transition-all shadow-xs"
                      title="Trigger Survey & View Feedback Insights"
                    >
                      <MessageSquare className="w-4 h-4 text-purple-600" />
                      <span>Feedback Loop</span>
                    </button>
                  )}

                  {onNavigateToCopilot && (
                    <button
                      onClick={onNavigateToCopilot}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 hover:text-[#020062] text-sm font-semibold cursor-pointer transition-all shadow-xs"
                    >
                      <Sparkles className="w-4 h-4 text-[#2563EB]" />
                      <span>Action Copilot</span>
                    </button>
                  )}

                  <button
                    onClick={handleInvestigateWithAI}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-bold cursor-pointer transition-all shadow-xs"
                  >
                    <Bot className="w-4 h-4 text-blue-100" />
                    <span>Investigate with AI</span>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                  </button>
                </div>
              </div>
            </div>

            {/* Warning Banner snippet */}
            {account.main_warning && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-sm text-rose-800">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="flex-1 font-medium">
                  <strong className="text-rose-900">Deterministic Trigger Alert:</strong> {account.main_warning}
                </div>
                <span className="font-mono text-xs text-rose-800 bg-white px-3 py-1 rounded-lg border border-rose-200">
                  Deterministic Rule Fired
                </span>
              </div>
            )}
          </div>

          {/* SECTION B: Customer Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Active users and usage trend */}
            <div className="border border-[#E2E8F0] rounded-2xl p-5 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Active Users & Trend
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-headline text-[#020062] font-normal">
                  {metrics?.active_users ?? 132}
                </span>
                <span className="text-sm text-slate-500 font-mono">
                  / {metrics?.baseline_users ?? 240} seats
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-rose-700 font-medium">
                <TrendingDown className="w-4 h-4 shrink-0" />
                <span>{metrics?.usage_trend ?? '-45% contraction over 30d'}</span>
              </div>
            </div>

            {/* Metric 2: Recent customer engagement */}
            <div className="border border-[#E2E8F0] rounded-2xl p-5 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Recent Engagement
                </span>
                <div className="p-2 rounded-lg bg-blue-50 text-[#0025AE] border border-blue-200">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-headline text-[#020062] font-normal leading-tight">
                {metrics?.days_since_touchpoint ?? 4}d Touchpoint Lag
              </div>
              <p className="text-xs text-slate-500">
                {metrics?.recent_engagement ?? 'Inbound budget downgrade inquiry'}
              </p>
            </div>

            {/* Metric 3: Open support issues */}
            <div className="border border-[#E2E8F0] rounded-2xl p-5 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Open Support Issues
                </span>
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  <Headphones className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-headline text-[#020062] font-normal">
                  {metrics?.open_support_tickets ?? 1}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 font-bold border border-rose-200">
                  {metrics?.critical_tickets ?? 1} Critical SLA
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ticket #4920: Data sync latency exceeding SLA
              </p>
            </div>

            {/* Metric 4: Days until renewal */}
            <div className="border border-[#E2E8F0] rounded-2xl p-5 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Days Until Renewal
                </span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-headline text-rose-700 font-normal">
                  {account.urgency_days_to_renewal}
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Days Remaining
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Target renewal date: <strong className="text-[#020062]">{account.renewal_date}</strong>
              </p>
            </div>
          </div>

          {/* SECTION C: Unified Evidence Timeline & Key Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Evidence Timeline */}
            <div className="lg:col-span-2 border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs space-y-6">
              {/* Timeline Header & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] text-[#2563EB] border border-blue-200 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-normal text-[#020062]">
                      Unified Evidence Timeline
                    </h3>
                    <p className="text-xs text-slate-500 font-body">
                      Chronological multi-source telemetry recorded with immutable timestamps
                    </p>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
                  <span className="text-slate-500 text-xs mr-1">Filter:</span>
                  {['all', 'usage', 'support', 'email', 'calendar', 'crm'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTimelineFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs uppercase font-medium cursor-pointer transition-colors ${
                        timelineFilter === cat
                          ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                          : 'bg-[#F8FAFC] text-slate-600 hover:text-[#020062] hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline Items */}
              {filteredSignals.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No evidence records matched the category filter "{timelineFilter}".
                </div>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0]">
                  {filteredSignals.map((signal) => {
                    const isHigh = signal.severity === 'high';
                    const formattedDate = new Date(signal.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={signal.id}
                        onClick={() => setSelectedSignal(signal)}
                        className="relative group cursor-pointer transition-all"
                      >
                        {/* Timeline Node Dot */}
                        <div
                          className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all group-hover:scale-125 ${
                            isHigh ? 'border-rose-500 bg-rose-50' : 'border-[#2563EB] bg-blue-50'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-rose-500' : 'bg-[#2563EB]'}`} />
                        </div>

                        {/* Timeline Event Card */}
                        <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-blue-300 hover:bg-white transition-all space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-white border border-[#E2E8F0]">
                                {getSourceIcon(signal.source_category)}
                              </div>
                              <span className="font-semibold text-sm text-[#020062] group-hover:text-[#2563EB] transition-colors">
                                {signal.title}
                              </span>
                              <span className="font-mono text-xs uppercase font-bold px-2 py-0.5 rounded-md bg-white text-slate-600 border border-[#E2E8F0]">
                                {signal.source_category}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-md uppercase ${
                                  isHigh
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : signal.severity === 'medium'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {signal.severity}
                              </span>
                              <span className="text-xs text-slate-500 font-mono">
                                {formattedDate}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 leading-relaxed font-body">
                            {signal.summary}
                          </p>

                          {signal.observed_value && (
                            <div className="text-xs text-slate-700 bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 font-mono flex items-center justify-between">
                              <span>Observed: <strong className="text-[#020062]">{signal.observed_value}</strong></span>
                              <span className="text-slate-400 text-xs">ID: {signal.id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 1 Column: Key Stakeholders */}
            <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#2563EB]" />
                  <h3 className="font-headline text-lg font-normal text-[#020062]">
                    Key Stakeholders
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#0025AE] bg-[#F0F5FF] px-2 py-0.5 rounded border border-blue-200">
                  {(account.contacts || []).length} contacts
                </span>
              </div>

              <div className="space-y-3">
                {(account.contacts || []).map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#020062]">
                            {contact.name}
                          </span>
                          {contact.is_primary && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-[#0025AE] font-bold border border-blue-200">
                              Primary
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          {contact.role || 'Executive'}
                        </span>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md capitalize ${
                          contact.sentiment === 'negative'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : contact.sentiment === 'positive'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {contact.sentiment}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-xs">{contact.email}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick CTA to Action Proposals */}
              {onNavigateToApprovals && (
                <div className="pt-4 border-t border-[#E2E8F0]">
                  <button
                    onClick={onNavigateToApprovals}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F8FAFC] hover:bg-[#2563EB] text-slate-700 hover:text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs"
                  >
                    <Layers className="w-4 h-4" />
                    <span>View Prepared Action Drafts</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Signal Provenance Record                                         */}
      {/* ========================================================================= */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#F0F5FF] border border-blue-200">
                  {getSourceIcon(selectedSignal.source_category)}
                </div>
                <h3 className="font-headline text-lg font-normal text-[#020062]">
                  Signal Provenance Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm font-body">
              <div>
                <span className="text-xs uppercase font-bold text-slate-500 block mb-1">Title</span>
                <p className="font-semibold text-base text-[#020062]">{selectedSignal.title}</p>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-slate-500 block mb-1">Summary</span>
                <p className="text-slate-600 leading-relaxed">{selectedSignal.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block text-xs">Source Category</span>
                  <strong className="uppercase font-mono text-[#020062] text-sm">{selectedSignal.source_category}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Severity</span>
                  <strong className="uppercase font-mono text-rose-700 text-sm">{selectedSignal.severity}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Timestamp</span>
                  <strong className="font-mono text-slate-700">{new Date(selectedSignal.timestamp).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Record ID</span>
                  <strong className="font-mono text-slate-700">{selectedSignal.source_record_id || selectedSignal.id}</strong>
                </div>
              </div>

              {selectedSignal.metadata && Object.keys(selectedSignal.metadata).length > 0 && (
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 block mb-1.5">
                    Raw Telemetry Payload
                  </span>
                  <pre className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0025AE] rounded-xl text-xs font-mono overflow-x-auto">
                    {JSON.stringify(selectedSignal.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: "Investigate with AI" Autopsy Modal                              */}
      {/* ========================================================================= */}
      {showAutopsyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-2xl w-full p-6 lg:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline text-2xl font-normal text-[#020062]">
                    AI Revenue Risk Autopsy
                  </h3>
                  <p className="text-xs text-slate-500 font-body">
                    Evidence-grounded causal analysis for {account.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutopsyModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {autopsyLoading ? (
              <div className="py-12 text-center text-sm text-slate-500 space-y-3">
                <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Synthesizing multi-source signals and grounding claims in stored evidence...</p>
              </div>
            ) : (
              <div className="space-y-5 text-sm font-body">
                {/* 1. Verified Facts */}
                <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Verified Source Facts</span>
                  </div>
                  <div className="space-y-2">
                    {autopsy?.facts?.map((fact, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-slate-700">
                        <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold shrink-0">
                          {fact.evidence_id}
                        </span>
                        <span className="leading-relaxed">{fact.claim}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Causal Interpretations */}
                <div className="p-5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0025AE]">
                    <Sparkles className="w-5 h-5 text-[#2563EB]" />
                    <span>Causal Risk Reasoning</span>
                  </div>
                  <ul className="space-y-2 text-slate-700 list-disc list-inside leading-relaxed">
                    {autopsy?.interpretations?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Unknowns & Blindspots */}
                <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span>Explicitly Labeled Unknowns</span>
                  </div>
                  <ul className="space-y-2 text-slate-700 list-disc list-inside leading-relaxed">
                    {autopsy?.unknowns?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Scoring Engine: Deterministic v1.0.0
              </span>
              <button
                onClick={() => {
                  setShowAutopsyModal(false);
                  if (onNavigateToApprovals) onNavigateToApprovals();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-sm font-bold cursor-pointer shadow-xs"
              >
                <span>Proceed to Human-Gated Action Gate</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailView;
