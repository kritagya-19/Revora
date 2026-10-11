import { useState, useMemo } from 'react';
import type { AccountDetail, Signal } from '../types/api';
import { RiskBadge } from './RiskBadge';
import {
  Sparkles,
  Users,
  Activity,
  Calendar,
  Mail,
  ArrowLeft,
  AlertCircle,
  Clock,
  Bot,
  TrendingDown,
  Headphones,
  CalendarDays,
  FileText,
  Heart,
  MessageSquare
} from 'lucide-react';

interface CustomerDetailViewProps {
  account: AccountDetail;
  onBackToAccounts: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onInvestigateWithAI?: () => void;
  onNavigateToCopilot?: () => void;
  onNavigateToFeedback?: () => void;
}

export function CustomerDetailView({
  account,
  onBackToAccounts,
  currency = 'USD',
  onInvestigateWithAI,
  onNavigateToCopilot,
  onNavigateToFeedback
}: CustomerDetailViewProps) {
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  // Currency formatting
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      if (inrAmount >= 100000) return `₹${(inrAmount / 100000).toFixed(1)} L`;
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  // Timestamp formatting
  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return ts;
    }
  };

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
  const handleInvestigateWithAI = () => {
    if (onInvestigateWithAI) {
      onInvestigateWithAI();
    }
  };

  // Helper for source category icon
  const getSourceIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'usage':
        return <Activity className="w-4 h-4 text-purple-500" />;
      case 'support':
        return <Headphones className="w-4 h-4 text-rose-500" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'calendar':
        return <CalendarDays className="w-4 h-4 text-amber-500" />;
      case 'crm':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'slack':
        return <MessageSquare className="w-4 h-4 text-sky-500" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const metrics = account.customer_metrics;

  return (
    <div className="space-y-6">
      {/* 1. TOP NAVIGATION & BREADCRUMB */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToAccounts}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-[#E2E8F0] hover:border-slate-300 px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Customer Accounts</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Customer Accounts</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{account.name}</span>
        </div>
      </div>

      {/* 2. CUSTOMER IDENTITY & ACTION HERO CARD */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
          {/* Left: Account Identity */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-normal">
                {account.name}
              </h1>
              <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {account.tier || 'Enterprise'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 capitalize">
                {account.status || 'Active'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
              <span>Domain: <strong className="text-slate-900 font-mono">{account.domain || 'saas.app'}</strong></span>
              <span>•</span>
              <span>Industry: <strong className="text-slate-900">{account.industry || 'B2B SaaS'}</strong></span>
              <span>•</span>
              <span>CSM Owner: <strong className="text-slate-900">{account.csm_owner}</strong></span>
            </div>
          </div>

          {/* Right: Key Stats & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* ARR Badge */}
            <div className="bg-[#FAFCFF] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                Contract ARR
              </span>
              <span className="text-lg font-bold text-slate-900 font-mono block">
                {formatCurrency(account.arr)}
              </span>
            </div>

            {/* Renewal Window */}
            <div className="bg-[#FAFCFF] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                Renewal Horizon
              </span>
              <div className="text-xs font-semibold text-slate-900 flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{account.renewal_date}</span>
              </div>
              <span className="text-[11px] text-rose-600 font-semibold block">
                {account.urgency_days_to_renewal} days remaining
              </span>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2">
              {onNavigateToFeedback && (
                <button
                  onClick={onNavigateToFeedback}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-semibold cursor-pointer transition-colors"
                  title="Trigger Survey & View Feedback Insights"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                  <span>Feedback Loop</span>
                </button>
              )}

              {onNavigateToCopilot && (
                <button
                  onClick={onNavigateToCopilot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Action Copilot</span>
                </button>
              )}

              <button
                onClick={handleInvestigateWithAI}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <Bot className="w-3.5 h-3.5 text-blue-100" />
                <span>Run AI Autopsy</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              </button>
            </div>
          </div>
        </div>

        {/* Warning Alert Banner */}
        {account.main_warning && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div className="flex-1 font-medium">
              <span className="font-bold">Detected Churn Signal: </span>
              {account.main_warning}
            </div>
          </div>
        )}
      </div>

      {/* 3. KEY METRICS & TELEMETRY FINDINGS (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Account Health
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#2563EB]">
              <Heart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.health_score ?? account.health_score ?? 50}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Status: <strong className="text-slate-700 capitalize">{account.status}</strong>
          </p>
        </div>

        {/* License Usage Contraction */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              License Usage
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 tracking-tight font-mono">
              {metrics?.usage_drop_pct ? `-${metrics.usage_drop_pct}%` : '-38%'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active Seats: {metrics?.active_users ?? 45} / {metrics?.baseline_users ?? 100}
          </p>
        </div>

        {/* Support Tickets */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Support Escalations
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
              <Headphones className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {metrics?.open_support_tickets ?? 3}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Urgent SLA tickets active
          </p>
        </div>

        {/* Engagement Lag */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              CSM Inactivity
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {metrics?.days_since_touchpoint ?? 50} days
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Since last customer meeting
          </p>
        </div>
      </div>

      {/* 4. CHRONOLOGICAL MULTI-SOURCE EVIDENCE TIMELINE */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-normal flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span>Multi-Source Chronological Evidence Feed</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified signals collected across Usage Telemetry, Zendesk, HubSpot CRM, and Calendar
            </p>
          </div>

          {/* Timeline Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs overflow-x-auto">
            {['all', 'crm', 'email', 'calendar', 'slack', 'usage', 'support'].map((cat) => (
              <button
                key={cat}
                onClick={() => setTimelineFilter(cat)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  timelineFilter === cat
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Signal Items List */}
        <div className="divide-y divide-slate-100">
          {filteredSignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No evidence signals found for the selected category.
            </div>
          ) : (
            filteredSignals.map((sig) => {
              const isLive = !sig.is_simulated && sig.mode !== 'simulated';
              return (
              <div
                key={sig.id}
                onClick={() => setSelectedSignal(selectedSignal?.id === sig.id ? null : sig)}
                className="py-3 sm:py-3.5 hover:bg-slate-50/70 rounded-xl px-3 transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200/60 shrink-0">
                      {getSourceIcon(sig.source_category)}
                    </div>
                    <span className="font-semibold text-xs text-slate-900">
                      {sig.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                      {sig.source_category}
                    </span>
                    {isLive ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        LIVE API
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                        SIMULATED
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {formatTimestamp(sig.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                  {sig.description || sig.summary}
                </p>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* 5. KEY STAKEHOLDERS & CONTACTS */}
      {account.contacts && account.contacts.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-normal flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>Key Stakeholders & Decision Makers</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified champions, executive sponsors, and technical buyers
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {account.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-[#FAFCFF] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">
                    {contact.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {contact.role || 'Stakeholder'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>{contact.role || 'Technical Lead'}</p>
                  <p className="font-mono text-slate-400">{contact.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailView;
