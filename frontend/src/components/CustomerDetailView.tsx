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
}

export function CustomerDetailView({
  account,
  onBackToRadar,
  currency = 'USD',
  onNavigateToApprovals,
  onInvestigateWithAI
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

  const metrics = account.customer_metrics;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back Navigation Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToRadar}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0025AE] bg-white border border-[#E2E8F0] px-3.5 py-2 rounded-lg cursor-pointer transition-all hover:border-[#0025AE]/30 shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Revenue Radar</span>
        </button>

        <div className="text-xs text-slate-400 font-mono">
          Account ID: <strong className="text-slate-700">{account.id}</strong>
        </div>
      </div>

      {/* SECTION A: Customer Header */}
      <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
          {/* Left: Account Identity & Owners */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-3xl text-[#020062] font-bold tracking-tight">
                {account.name}
              </h1>
              <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {account.tier || 'Enterprise'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 capitalize">
                {account.status || 'Active'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-body">
              <span>Domain: <strong className="text-slate-800 font-mono">{account.domain || 'saas.app'}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Industry: <strong className="text-slate-800">{account.industry || 'Enterprise SaaS'}</strong></span>
              <span className="text-slate-300">•</span>
              <span>CSM Owner: <strong className="text-slate-800">{account.csm_owner}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Primary Reason: <strong className="font-mono text-[#0025AE]">{account.primary_reason_code}</strong></span>
            </div>
          </div>

          {/* Right: Key Stats & "Investigate with AI" CTA Button */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-lg p-3 text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Contract ARR
              </span>
              <span className="text-2xl font-headline text-[#020062] font-bold block">
                {formatCurrency(account.arr)}
              </span>
            </div>

            <div className="bg-slate-50 border border-[#E2E8F0] rounded-lg p-3 text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Renewal Horizon
              </span>
              <div className="text-lg font-headline text-[#020062] font-bold flex items-center justify-end gap-1">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                <span>{account.renewal_date}</span>
              </div>
              <span className="text-[11px] text-red-600 font-semibold block">
                {account.urgency_days_to_renewal} days remaining
              </span>
            </div>

            {/* Prominent Action Button: Investigate with AI */}
            <button
              onClick={handleInvestigateWithAI}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0025AE] text-white text-xs font-bold hover:bg-[#2563EB] cursor-pointer transition-all shadow-md hover:shadow-lg"
            >
              <Bot className="w-4 h-4 text-blue-200" />
              <span>Investigate with AI</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Warning Banner snippet */}
        {account.main_warning && (
          <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg flex items-center gap-3 text-xs text-red-900">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1">
              <strong>Primary Alert:</strong> {account.main_warning}
            </div>
            <span className="font-mono text-[10px] text-red-700 bg-white px-2 py-0.5 rounded border border-red-200">
              Deterministic Trigger
            </span>
          </div>
        )}
      </div>

      {/* SECTION B: Customer Metrics Banner (4 Specific High-Impact Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active users and usage trend */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-body">
              Active Users & Trend
            </span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-[#020062] font-bold">
              {metrics?.active_users ?? 132}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / {metrics?.baseline_users ?? 240} seats
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{metrics?.usage_trend ?? '-45% contraction over 30d'}</span>
          </div>
        </div>

        {/* Metric 2: Recent customer engagement */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-body">
              Recent Engagement
            </span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-headline text-[#020062] font-bold leading-tight">
            {metrics?.days_since_touchpoint ?? 4}d Touchpoint Lag
          </div>
          <p className="text-xs text-slate-500 font-body">
            {metrics?.recent_engagement ?? 'Inbound budget downgrade inquiry'}
          </p>
        </div>

        {/* Metric 3: Open support issues */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-body">
              Open Support Issues
            </span>
            <div className="p-1.5 rounded-md bg-red-50 text-red-600">
              <Headphones className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-[#020062] font-bold">
              {metrics?.open_support_tickets ?? 1}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
              {metrics?.critical_tickets ?? 1} Critical SLA
            </span>
          </div>
          <p className="text-xs text-slate-500 font-body">
            Ticket #4920: Data sync latency exceeding SLA
          </p>
        </div>

        {/* Metric 4: Days until renewal */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-body">
              Days Until Renewal
            </span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline text-red-600 font-bold">
              {account.urgency_days_to_renewal}
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Days Remaining
            </span>
          </div>
          <p className="text-xs text-slate-500 font-body">
            Target renewal date: <strong>{account.renewal_date}</strong>
          </p>
        </div>
      </div>

      {/* SECTION C: Unified Evidence Timeline & Key Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Evidence Timeline */}
        <div className="lg:col-span-2 border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-xs space-y-5">
          {/* Timeline Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-[#020062]">
                  Unified Evidence Timeline
                </h3>
                <p className="text-[11px] text-slate-500 font-body">
                  Chronological multi-source telemetry recorded with immutable timestamps
                </p>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
              <span className="text-slate-400 text-[11px]">Filter:</span>
              {['all', 'usage', 'support', 'email', 'calendar', 'crm'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTimelineFilter(cat)}
                  className={`px-2 py-1 rounded-md text-[11px] uppercase font-medium cursor-pointer transition-colors ${
                    timelineFilter === cat
                      ? 'bg-[#0025AE] text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:text-[#020062] hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Items */}
          {filteredSignals.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No evidence records matched the category filter "{timelineFilter}".
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
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
                      className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all group-hover:scale-125 ${
                        isHigh ? 'border-red-500 bg-red-50' : 'border-[#2563EB] bg-blue-50'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-red-600' : 'bg-[#2563EB]'}`} />
                    </div>

                    {/* Timeline Event Card */}
                    <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#2563EB]/40 hover:shadow-xs transition-all space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-slate-100 border border-slate-200">
                            {getSourceIcon(signal.source_category)}
                          </div>
                          <span className="font-semibold text-xs text-[#020062] group-hover:text-[#2563EB] transition-colors">
                            {signal.title}
                          </span>
                          <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {signal.source_category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              isHigh
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : signal.severity === 'medium'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {signal.severity}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-body">
                        {signal.summary}
                      </p>

                      {signal.observed_value && (
                        <div className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono flex items-center justify-between">
                          <span>Observed: <strong>{signal.observed_value}</strong></span>
                          <span className="text-slate-400 text-[10px]">ID: {signal.id}</span>
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
        <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-headline text-md font-bold text-[#020062]">
                Key Stakeholders
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {account.contacts.length} contacts
            </span>
          </div>

          <div className="space-y-3">
            {account.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 bg-slate-50/60 border border-[#E2E8F0] rounded-lg space-y-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-[#020062]">
                        {contact.name}
                      </span>
                      {contact.is_primary && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold border border-blue-200">
                          Primary
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {contact.role || 'Executive'}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                      contact.sentiment === 'negative'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : contact.sentiment === 'positive'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {contact.sentiment}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span className="font-mono text-[10px]">{contact.email}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick CTA to Action Proposals */}
          {onNavigateToApprovals && (
            <div className="pt-3 border-t border-[#E2E8F0]">
              <button
                onClick={onNavigateToApprovals}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-100 hover:bg-[#0025AE] text-slate-700 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Prepared Action Drafts</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signal Detail Modal / Drawer */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-slate-100">
                  {getSourceIcon(selectedSignal.source_category)}
                </div>
                <h3 className="font-headline text-lg font-bold text-[#020062]">
                  Signal Provenance Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-body">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Title</span>
                <p className="font-semibold text-sm text-[#020062]">{selectedSignal.title}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Summary</span>
                <p className="text-slate-700 leading-relaxed">{selectedSignal.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Source Category</span>
                  <strong className="uppercase font-mono text-slate-800">{selectedSignal.source_category}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Severity</span>
                  <strong className="uppercase font-mono text-red-600">{selectedSignal.severity}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Timestamp</span>
                  <strong className="font-mono text-slate-800">{new Date(selectedSignal.timestamp).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Record ID</span>
                  <strong className="font-mono text-slate-800">{selectedSignal.source_record_id || selectedSignal.id}</strong>
                </div>
              </div>

              {selectedSignal.metadata && Object.keys(selectedSignal.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Raw Telemetry Payload
                  </span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(selectedSignal.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 bg-[#0025AE] text-white rounded-lg text-xs font-medium hover:bg-[#2563EB] cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Investigate with AI" Autopsy Modal */}
      {showAutopsyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0025AE] text-white flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-[#020062]">
                    AI Revenue Risk Autopsy
                  </h3>
                  <p className="text-[11px] text-slate-500 font-body">
                    Evidence-grounded causal analysis for {account.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutopsyModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {autopsyLoading ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Synthesizing multi-source signals and grounding claims in stored evidence...</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-body">
                {/* 1. Verified Facts */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Verified Source Facts</span>
                  </div>
                  <div className="space-y-1.5">
                    {autopsy?.facts?.map((fact, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-700">
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold shrink-0">
                          {fact.evidence_id}
                        </span>
                        <span>{fact.claim}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Causal Interpretations */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0025AE]">
                    <Sparkles className="w-4 h-4 text-[#2563EB]" />
                    <span>Causal Risk Reasoning</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
                    {autopsy?.interpretations?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Unknowns & Blindspots */}
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Explicitly Labeled Unknowns</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
                    {autopsy?.unknowns?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Scoring Engine: Deterministic v1.0.0
              </span>
              <button
                onClick={() => {
                  setShowAutopsyModal(false);
                  if (onNavigateToApprovals) onNavigateToApprovals();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0025AE] text-white rounded-lg text-xs font-bold hover:bg-[#2563EB] cursor-pointer shadow-xs"
              >
                <span>Proceed to Human-Gated Action Gate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailView;
