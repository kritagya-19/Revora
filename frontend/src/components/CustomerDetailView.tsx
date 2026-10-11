import { useState, useMemo } from 'react';
import type { AccountDetail, Signal, RevenueRiskAutopsy } from '../types/api';
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
  ArrowRight
} from 'lucide-react';

interface CustomerDetailViewProps {
  account: AccountDetail;
  onBackToRadar: () => void;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
  onInvestigateWithAI?: () => void;
  onNavigateToCopilot?: () => void;
}

export function CustomerDetailView({
  account,
  onBackToRadar,
  currency = 'USD',
  onNavigateToApprovals,
  onInvestigateWithAI,
  onNavigateToCopilot
}: CustomerDetailViewProps) {
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [autopsy, setAutopsy] = useState<RevenueRiskAutopsy | null>(null);
  const [autopsyLoading, setAutopsyLoading] = useState<boolean>(false);
  const [showAutopsyModal, setShowAutopsyModal] = useState<boolean>(false);

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
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  // Filtered timeline signals
  const filteredSignals = useMemo(() => {
    return account.signals.filter((s) => {
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
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToRadar}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Revenue Radar</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Step 2 of 6: Customer 360 & Telemetry Deep Dive</span>
          <div className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            Account ID: <strong className="text-blue-400 font-semibold">{account.id}</strong>
          </div>
        </div>
      </div>

      {/* SECTION A: Customer Header Hero */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/90 backdrop-blur-md p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          {/* Left: Account Identity & Owners */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-3xl lg:text-4xl text-white font-bold tracking-tight">
                {account.name}
              </h1>
              <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
              <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                {account.tier || 'Enterprise'}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 capitalize">
                {account.status || 'Active'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 font-body">
              <span>Domain: <strong className="text-slate-200 font-mono">{account.domain || 'saas.app'}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Industry: <strong className="text-slate-200">{account.industry || 'Enterprise SaaS'}</strong></span>
              <span className="text-slate-600">•</span>
              <span>CSM Owner: <strong className="text-slate-200">{account.csm_owner}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Primary Driver: <strong className="font-mono text-blue-400">{account.primary_reason_code}</strong></span>
            </div>
          </div>

          {/* Right: Key Stats & CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-right min-w-[130px]">
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Contract ARR
              </span>
              <span className="text-2xl lg:text-3xl font-headline text-white font-bold block">
                {formatCurrency(account.arr)}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-right min-w-[150px]">
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Renewal Horizon
              </span>
              <div className="text-lg font-headline text-white font-bold flex items-center justify-end gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>{account.renewal_date}</span>
              </div>
              <span className="text-xs text-rose-400 font-semibold block mt-1">
                {account.urgency_days_to_renewal} days remaining
              </span>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              {onNavigateToCopilot && (
                <button
                  onClick={onNavigateToCopilot}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold cursor-pointer transition-all shadow-md"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Action Copilot</span>
                </button>
              )}

              <button
                onClick={handleInvestigateWithAI}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer transition-all shadow-lg hover:shadow-blue-600/30 ring-1 ring-blue-400/30"
              >
                <Bot className="w-4 h-4 text-blue-100" />
                <span>Investigate with AI</span>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner snippet */}
        {account.main_warning && (
          <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-xl flex items-center gap-3 text-sm text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1 font-medium">
              <strong className="text-rose-300">Deterministic Trigger Alert:</strong> {account.main_warning}
            </div>
            <span className="font-mono text-xs text-rose-300 bg-rose-900/40 px-3 py-1 rounded-lg border border-rose-700/60">
              Deterministic Rule Fired
            </span>
          </div>
        )}
      </div>

      {/* SECTION B: Customer Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active users and usage trend */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-slate-900/90 shadow-md space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active Users & Trend
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-white font-bold">
              {metrics?.active_users ?? 132}
            </span>
            <span className="text-sm text-slate-400 font-mono">
              / {metrics?.baseline_users ?? 240} seats
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-rose-400 font-medium">
            <TrendingDown className="w-4 h-4 shrink-0" />
            <span>{metrics?.usage_trend ?? '-45% contraction over 30d'}</span>
          </div>
        </div>

        {/* Metric 2: Recent customer engagement */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-slate-900/90 shadow-md space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Recent Engagement
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-headline text-white font-bold leading-tight">
            {metrics?.days_since_touchpoint ?? 4}d Touchpoint Lag
          </div>
          <p className="text-xs text-slate-400">
            {metrics?.recent_engagement ?? 'Inbound budget downgrade inquiry'}
          </p>
        </div>

        {/* Metric 3: Open support issues */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-slate-900/90 shadow-md space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Open Support Issues
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Headphones className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-white font-bold">
              {metrics?.open_support_tickets ?? 1}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {metrics?.critical_tickets ?? 1} Critical SLA
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Ticket #4920: Data sync latency exceeding SLA
          </p>
        </div>

        {/* Metric 4: Days until renewal */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-slate-900/90 shadow-md space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Days Until Renewal
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-rose-400 font-bold">
              {account.urgency_days_to_renewal}
            </span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Days Remaining
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Target renewal date: <strong className="text-slate-200">{account.renewal_date}</strong>
          </p>
        </div>
      </div>

      {/* SECTION C: Unified Evidence Timeline & Key Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Evidence Timeline */}
        <div className="lg:col-span-2 border border-slate-800 rounded-2xl bg-slate-900/90 p-6 shadow-md space-y-6">
          {/* Timeline Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-white">
                  Unified Evidence Timeline
                </h3>
                <p className="text-xs text-slate-400 font-body">
                  Chronological multi-source telemetry recorded with immutable timestamps
                </p>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
              <span className="text-slate-400 text-xs mr-1">Filter:</span>
              {['all', 'usage', 'support', 'email', 'calendar', 'crm'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTimelineFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs uppercase font-medium cursor-pointer transition-colors ${
                    timelineFilter === cat
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Items */}
          {filteredSignals.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No evidence records matched the category filter "{timelineFilter}".
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
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
                      className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 bg-slate-900 flex items-center justify-center transition-all group-hover:scale-125 ${
                        isHigh ? 'border-rose-500 bg-rose-950' : 'border-blue-500 bg-blue-950'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-rose-500' : 'bg-blue-400'}`} />
                    </div>

                    {/* Timeline Event Card */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950 transition-all space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                            {getSourceIcon(signal.source_category)}
                          </div>
                          <span className="font-semibold text-sm text-slate-200 group-hover:text-blue-400 transition-colors">
                            {signal.title}
                          </span>
                          <span className="font-mono text-xs uppercase font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {signal.source_category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-md uppercase ${
                              isHigh
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : signal.severity === 'medium'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {signal.severity}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-300 leading-relaxed font-body">
                        {signal.summary}
                      </p>

                      {signal.observed_value && (
                        <div className="text-xs text-slate-300 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono flex items-center justify-between">
                          <span>Observed: <strong className="text-white">{signal.observed_value}</strong></span>
                          <span className="text-slate-500 text-xs">ID: {signal.id}</span>
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
        <div className="border border-slate-800 rounded-2xl bg-slate-900/90 p-6 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="font-headline text-lg font-bold text-white">
                Key Stakeholders
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {account.contacts.length} contacts
            </span>
          </div>

          <div className="space-y-3">
            {account.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">
                        {contact.name}
                      </span>
                      {contact.is_primary && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                          Primary
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {contact.role || 'Executive'}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-md capitalize ${
                      contact.sentiment === 'negative'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : contact.sentiment === 'positive'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {contact.sentiment}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono text-xs">{contact.email}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick CTA to Action Proposals */}
          {onNavigateToApprovals && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={onNavigateToApprovals}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <Layers className="w-4 h-4" />
                <span>View Prepared Action Drafts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                  {getSourceIcon(selectedSignal.source_category)}
                </div>
                <h3 className="font-headline text-lg font-bold text-white">
                  Signal Provenance Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm font-body">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Title</span>
                <p className="font-semibold text-base text-white">{selectedSignal.title}</p>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Summary</span>
                <p className="text-slate-300 leading-relaxed">{selectedSignal.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block text-xs">Source Category</span>
                  <strong className="uppercase font-mono text-white text-sm">{selectedSignal.source_category}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Severity</span>
                  <strong className="uppercase font-mono text-rose-400 text-sm">{selectedSignal.severity}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Timestamp</span>
                  <strong className="font-mono text-slate-200">{new Date(selectedSignal.timestamp).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Record ID</span>
                  <strong className="font-mono text-slate-200">{selectedSignal.source_record_id || selectedSignal.id}</strong>
                </div>
              </div>

              {selectedSignal.metadata && Object.keys(selectedSignal.metadata).length > 0 && (
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1.5">
                    Raw Telemetry Payload
                  </span>
                  <pre className="p-3 bg-slate-950 border border-slate-800 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto">
                    {JSON.stringify(selectedSignal.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Investigate with AI" Autopsy Modal */}
      {showAutopsyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 lg:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline text-2xl font-bold text-white">
                    AI Revenue Risk Autopsy
                  </h3>
                  <p className="text-xs text-slate-400 font-body">
                    Evidence-grounded causal analysis for {account.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutopsyModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {autopsyLoading ? (
              <div className="py-12 text-center text-sm text-slate-400 space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Synthesizing multi-source signals and grounding claims in stored evidence...</p>
              </div>
            ) : (
              <div className="space-y-5 text-sm font-body">
                {/* 1. Verified Facts */}
                <div className="p-5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Verified Source Facts</span>
                  </div>
                  <div className="space-y-2">
                    {autopsy?.facts?.map((fact, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-slate-200">
                        <span className="font-mono text-xs bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/50 text-emerald-300 font-bold shrink-0">
                          {fact.evidence_id}
                        </span>
                        <span className="leading-relaxed">{fact.claim}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Causal Interpretations */}
                <div className="p-5 bg-blue-950/20 border border-blue-800/40 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <span>Causal Risk Reasoning</span>
                  </div>
                  <ul className="space-y-2 text-slate-200 list-disc list-inside leading-relaxed">
                    {autopsy?.interpretations?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Unknowns & Blindspots */}
                <div className="p-5 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span>Explicitly Labeled Unknowns</span>
                  </div>
                  <ul className="space-y-2 text-slate-200 list-disc list-inside leading-relaxed">
                    {autopsy?.unknowns?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Scoring Engine: Deterministic v1.0.0
              </span>
              <button
                onClick={() => {
                  setShowAutopsyModal(false);
                  if (onNavigateToApprovals) onNavigateToApprovals();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold cursor-pointer shadow-md"
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
