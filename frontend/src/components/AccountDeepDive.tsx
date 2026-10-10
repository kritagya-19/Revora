import { useState, useEffect } from 'react';
import type { AccountDetail, RevenueRiskAutopsy, EvidenceRecord } from '../types/api';
import { fetchAccountAutopsy, fetchAccountEvidence } from '../services/api';
import { RiskBadge } from './RiskBadge';
import {
  ShieldAlert,
  FileCheck2,
  HelpCircle,
  Sparkles,
  Users,
  Activity,
  Mail,
  ArrowRight
} from 'lucide-react';

interface AccountDeepDiveProps {
  account: AccountDetail;
  currency?: 'USD' | 'INR';
  onNavigateToApprovals?: () => void;
}

export function AccountDeepDive({
  account,
  currency = 'USD',
  onNavigateToApprovals
}: AccountDeepDiveProps) {
  const [autopsy, setAutopsy] = useState<RevenueRiskAutopsy | null>(null);
  const [, setEvidence] = useState<EvidenceRecord[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadDeepDive() {
      try {
        const [autopsyData, evidenceData] = await Promise.all([
          fetchAccountAutopsy(account.id).catch(() => null),
          fetchAccountEvidence(account.id).catch(() => [])
        ]);
        if (isMounted) {
          setAutopsy(autopsyData);
          setEvidence(evidenceData);
        }
      } catch (err) {
        console.error('Error loading deep dive:', err);
      }
    }
    loadDeepDive();
    return () => {
      isMounted = false;
    };
  }, [account.id]);

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

  return (
    <div className="border border-[#E2E8F0] rounded-xl bg-white overflow-hidden shadow-xs space-y-6 p-6">
      {/* 1. Deep Dive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#E2E8F0] gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-headline text-2xl text-[#020062] font-bold">
              {account.name}
            </h2>
            <RiskBadge level={account.risk_level} score={account.risk_score} />
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
              {account.tier || 'Enterprise'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              {account.status || 'Active'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500 font-body">
            <span>Domain: <strong className="text-slate-700">{account.domain || 'saas.app'}</strong></span>
            <span>•</span>
            <span>Industry: <strong className="text-slate-700">{account.industry || 'B2B Software'}</strong></span>
            <span>•</span>
            <span>CSM Owner: <strong className="text-slate-700">{account.csm_owner}</strong></span>
            <span>•</span>
            <span>Renewal Date: <strong className="text-slate-700">{account.renewal_date}</strong> (in {account.urgency_days_to_renewal} days)</span>
          </div>
        </div>

        {/* Right Header Stats */}
        <div className="flex items-center gap-4 bg-slate-50 border border-[#E2E8F0] rounded-lg p-3">
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Contract Value
            </span>
            <span className="text-xl font-headline text-[#020062] font-bold block">
              {formatCurrency(account.arr)}
            </span>
          </div>
          <div className="w-px h-8 bg-[#E2E8F0]" />
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Health Score
            </span>
            <span className="text-xl font-mono text-slate-800 font-bold block">
              {account.health_score ?? 65}/100
            </span>
          </div>
        </div>
      </div>

      {/* 2. Revenue Risk Autopsy (Deterministic Engine & Grounded Explanation) */}
      <div className="border border-[#0025AE]/20 bg-[#0025AE]/3 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0025AE] text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-[#020062] flex items-center gap-2">
                Revenue Risk Autopsy
                <span className="font-mono text-[10px] font-normal px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                  {autopsy?.rule_version || 'Rule v1.0.0'}
                </span>
              </h3>
              <p className="text-xs text-slate-600 font-body">
                Deterministic primary trigger: <strong className="font-mono text-[#0025AE]">{account.primary_reason_code}</strong>
              </p>
            </div>
          </div>

          {onNavigateToApprovals && (
            <button
              onClick={onNavigateToApprovals}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0025AE] text-white text-xs font-semibold hover:bg-[#2563EB] cursor-pointer transition-colors shadow-xs"
            >
              <span>Review Next Best Action</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3-Part Autopsy Grid: Facts, Interpretations, Unknowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Column A: Facts (Verified Grounded Claims) */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>Verified Facts ({autopsy?.facts?.length ?? account.signals.length})</span>
            </div>
            <p className="text-[11px] text-slate-500 font-body">
              Multi-source signals observed and persisted in database.
            </p>
            <div className="space-y-2 pt-1">
              {autopsy?.facts && autopsy.facts.length > 0 ? (
                autopsy.facts.map((fact, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{fact.evidence_id}</span>
                      <span className="uppercase">{fact.source_category}</span>
                    </div>
                    <p className="font-medium text-slate-800 leading-snug">{fact.claim}</p>
                  </div>
                ))
              ) : (
                account.signals.slice(0, 3).map((sig) => (
                  <div key={sig.id} className="p-2 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{sig.id}</span>
                      <span className="uppercase">{sig.source_category}</span>
                    </div>
                    <p className="font-medium text-slate-800 leading-snug">{sig.title}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column B: Interpretations */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0025AE]">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Risk Interpretation</span>
            </div>
            <p className="text-[11px] text-slate-500 font-body">
              How cross-source intelligence compounds into churn likelihood.
            </p>
            <div className="space-y-2 pt-1">
              {autopsy?.interpretations && autopsy.interpretations.length > 0 ? (
                autopsy.interpretations.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-blue-50/50 border border-blue-100 rounded text-xs text-slate-700 leading-relaxed">
                    {item}
                  </div>
                ))
              ) : (
                account.contributing_factors.map((factor, idx) => (
                  <div key={idx} className="p-2.5 bg-blue-50/50 border border-blue-100 rounded text-xs text-slate-700 leading-relaxed">
                    {factor}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column C: Unknowns & Missing Evidence */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Unknowns & Missing Data</span>
            </div>
            <p className="text-[11px] text-slate-500 font-body">
              Information gaps explicitly labeled to avoid false assumptions.
            </p>
            <div className="space-y-2 pt-1">
              {autopsy?.unknowns && autopsy.unknowns.length > 0 ? (
                autopsy.unknowns.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-amber-50/50 border border-amber-100 rounded text-xs text-slate-700 leading-relaxed">
                    {item}
                  </div>
                ))
              ) : (
                <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded text-xs text-slate-700 leading-relaxed">
                  Competitor renewal pitch status and executive budget authorization remain unverified.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Multi-Source Signals & Stakeholder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stakeholder Contacts */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-slate-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-semibold text-sm text-[#020062]">
                Key Stakeholders & Contacts
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {account.contacts.length} recorded
            </span>
          </div>

          {account.contacts.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No contacts found for this account.</p>
          ) : (
            <div className="space-y-2.5">
              {account.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3 bg-white border border-[#E2E8F0] rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#020062]">
                        {contact.name}
                      </span>
                      {contact.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          Primary
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {contact.role || 'Executive'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                      <Mail className="w-3 h-3" />
                      <span>{contact.email}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                        contact.sentiment === 'negative'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : contact.sentiment === 'positive'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {contact.sentiment} sentiment
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cross-Source Unified Signals */}
        <div className="border border-[#E2E8F0] rounded-xl p-5 bg-slate-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-semibold text-sm text-[#020062]">
                Unified Signals Timeline
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {account.signals.length} signals
            </span>
          </div>

          {account.signals.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No signals recorded.</p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {account.signals.map((sig) => (
                <div
                  key={sig.id}
                  className="p-3.5 bg-white border border-[#E2E8F0] rounded-lg space-y-1.5 transition-all hover:border-[#2563EB]/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {sig.source_category}
                      </span>
                      <span className="font-semibold text-xs text-[#020062]">
                        {sig.title}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                        sig.severity === 'high'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : sig.severity === 'medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {sig.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {sig.summary}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                    <span>ID: {sig.id}</span>
                    <span>{new Date(sig.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountDeepDive;
