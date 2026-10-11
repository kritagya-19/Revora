import React, { useState, useEffect, useCallback } from 'react';
import type { AccountDetail, AccountRiskSummary, AccountRiskDetail } from '../types/api';
import { fetchAccountRisk, triggerAccountInvestigation } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

interface RiskScoringClassificationViewProps {
  account: AccountDetail;
  allAccounts?: AccountRiskSummary[];
  onSelectAccount?: (accountId: string) => void;
  onNavigateToAutopsy?: () => void;
}

export const RiskScoringClassificationView: React.FC<RiskScoringClassificationViewProps> = ({
  account,
  allAccounts = [],
  onSelectAccount,
  onNavigateToAutopsy
}) => {
  const [riskDetail, setRiskDetail] = useState<AccountRiskDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringInvestigation, setTriggeringInvestigation] = useState<boolean>(false);
  const [investigationMessage, setInvestigationMessage] = useState<string | null>(null);

  const loadRiskData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAccountRisk(account.id);
      setRiskDetail(data);
    } catch (err: any) {
      console.error('Error fetching account risk detail:', err);
      setError(err.message || 'Failed to load risk scoring detail');
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    loadRiskData();
  }, [loadRiskData]);

  const handleTriggerInvestigation = async () => {
    try {
      setTriggeringInvestigation(true);
      setInvestigationMessage(null);
      const res = await triggerAccountInvestigation(account.id);
      setInvestigationMessage(res.message || 'Investigation successfully triggered and queued.');
      // Refresh risk details
      await loadRiskData();
      if (onNavigateToAutopsy) {
        // Small delay so user sees confirmation before navigation
        setTimeout(() => {
          onNavigateToAutopsy();
        }, 1200);
      }
    } catch (err: any) {
      setInvestigationMessage(`Failed to trigger investigation: ${err.message}`);
    } finally {
      setTriggeringInvestigation(false);
    }
  };

  const classification = riskDetail?.classification || account.classification || (
    account.risk_score >= 50 ? 'high_risk' : account.risk_score >= 25 ? 'needing_attention' : 'healthy'
  );

  const getClassificationBadge = (cls: string) => {
    switch (cls) {
      case 'high_risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>High Risk Tier (≥50 pts)</span>
          </span>
        );
      case 'needing_attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Needing Attention Tier (25–49 pts)</span>
          </span>
        );
      case 'healthy':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Healthy Tier (&lt;25 pts)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & META BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-mono text-xs font-semibold uppercase tracking-wider">
                Task B • Risk Engine {riskDetail?.rule_version || 'v2.1.0'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-700/60 text-slate-300 font-mono text-xs">
                Deterministic &amp; Reproducible
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Risk Scoring &amp; Multi-Signal Classification</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Transparent, rule-based risk evaluation combining multi-source signals. Eliminates speculative churn guesses through auditable rules and automated deeper investigation triggers.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            {allAccounts.length > 0 && onSelectAccount && (
              <select
                value={account.id}
                onChange={(e) => onSelectAccount(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                {allAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.risk_score} pts • {acc.classification || acc.risk_level})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={loadRiskData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-600 transition-colors cursor-pointer"
              title="Refresh Risk Evaluation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATISTICAL GUARDRAIL / NO CHURN PROBABILITY DISCLAIMER */}
      <div className="border border-indigo-200/80 bg-indigo-50/70 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs sm:text-sm font-bold text-indigo-950">
              Statistical Guardrail: Churn Probability Omitted by Design
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-200/60 text-indigo-900">
              Confidence: {riskDetail?.statistical_confidence || 'High (Deterministic)'}
            </span>
          </div>
          <p className="text-xs text-indigo-900/80 leading-relaxed">
            {riskDetail?.churn_probability_disclaimer ||
              'SignalBridge AI strictly avoids presenting speculative churn percentage probabilities without validated statistical modeling. Prioritization is guided by transparent, reproducible deterministic risk rules.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">Calculating transparent deterministic risk rules...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-2">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Failed to load risk rules: {error}</span>
          </p>
          <button
            onClick={loadRiskData}
            className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* 3. THREE-TIER CLASSIFICATION & SCORE CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Score & Gauge Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                    Deterministic Risk Score
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                    {riskDetail?.risk_score ?? account.risk_score}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/ 100 max points</span>
                </div>

                <div className="mb-4">
                  {getClassificationBadge(classification)}
                </div>

                {/* Classification Gauge Bar */}
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${Math.min(25, (riskDetail?.risk_score || 0))}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(25, (riskDetail?.risk_score || 0) - 25)) * (25 / 25)}%`
                      }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${Math.max(0, (riskDetail?.risk_score || 0) - 50)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
                    <span>0 (Healthy)</span>
                    <span className="text-amber-600 font-semibold">25 (Attention)</span>
                    <span className="text-rose-600 font-semibold">50 (High Risk)</span>
                    <span>100</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500">
                Primary Driver: <strong className="text-slate-800">{riskDetail?.primary_reason_code || account.primary_reason_code}</strong>
              </div>
            </div>

            {/* 3-Tier Classification Matrix Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Tier Classification Criteria
              </span>

              <div className="space-y-2">
                <div
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    classification === 'healthy'
                      ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20'
                      : 'bg-slate-50/60 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Healthy Tier (&lt; 25)
                    </span>
                    {classification === 'healthy' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800/80 mt-1">
                    Normal usage activity, proactive touchpoints, no critical blockers near renewal.
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    classification === 'needing_attention'
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
                      : 'bg-slate-50/60 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Needing Attention (25 – 49)
                    </span>
                    {classification === 'needing_attention' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800/80 mt-1">
                    Early signals detected (touchpoint gap, moderate contraction, or open support ticket).
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    classification === 'high_risk'
                      ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20'
                      : 'bg-slate-50/60 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      High Risk Tier (≥ 50)
                    </span>
                    {classification === 'high_risk' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-800/80 mt-1">
                    Severe multi-signal contraction, unresolved critical blockers, or compound triggers.
                  </p>
                </div>
              </div>
            </div>

            {/* Investigation Trigger Automation Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                    Automated Investigation Gate
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
                    <Cpu className="w-4 h-4" />
                  </div>
                </div>

                {riskDetail?.investigation_triggered ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Trigger Criteria Satisfied</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Reason: <strong className="font-semibold">{riskDetail.investigation_trigger_reason || 'High risk threshold reached (score ≥ 50).'}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Investigation Standby</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Criteria (Score ≥ 50 or Compound Rules) currently not reached.
                    </p>
                  </div>
                )}
              </div>

              {investigationMessage && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-medium">
                  {investigationMessage}
                </div>
              )}

              <button
                onClick={handleTriggerInvestigation}
                disabled={triggeringInvestigation}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#2563EB] hover:bg-blue-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {triggeringInvestigation ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Running AI Investigation...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Trigger Deeper Investigation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. MULTI-SIGNAL COMPOUND RULES SECTION */}
          <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Compound Multi-Signal Rules</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Combines signals across disparate silos (usage, engagement, support, CRM) instead of evaluating each in isolation.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 self-start sm:self-auto">
                Triggered: {(riskDetail?.compound_rules_triggered || []).length} Compound Rules
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Compound Rule 1: Silent Contraction */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_SILENT_CONTRACTION')
                    ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/20'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-800">
                    COMPOUND_SILENT_CONTRACTION
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_SILENT_CONTRACTION')
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    +10 pts
                  </span>
                </div>
                <h5 className="text-xs font-bold text-slate-900 mb-1">Silent Contraction Risk</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Triggers when severe usage contraction (≥30%) coincides with prolonged CSM touchpoint silence (≥30 days).
                </p>
                <div className="mt-3 text-[10px] font-mono flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_SILENT_CONTRACTION')
                        ? 'bg-rose-500 animate-pulse'
                        : 'bg-slate-300'
                    }`}
                  />
                  <span className="font-semibold text-slate-700">
                    {(riskDetail?.compound_rules_triggered || []).includes('COMPOUND_SILENT_CONTRACTION')
                      ? 'Condition Satisfied (Applied)'
                      : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Compound Rule 2: At-Risk Renewal */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_AT_RISK_RENEWAL')
                    ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/20'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-800">
                    COMPOUND_AT_RISK_RENEWAL
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_AT_RISK_RENEWAL')
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    +15 pts
                  </span>
                </div>
                <h5 className="text-xs font-bold text-slate-900 mb-1">At-Risk Renewal Window</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Triggers when renewal is within 60 days AND active high-severity support tickets remain unresolved.
                </p>
                <div className="mt-3 text-[10px] font-mono flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_AT_RISK_RENEWAL')
                        ? 'bg-rose-500 animate-pulse'
                        : 'bg-slate-300'
                    }`}
                  />
                  <span className="font-semibold text-slate-700">
                    {(riskDetail?.compound_rules_triggered || []).includes('COMPOUND_AT_RISK_RENEWAL')
                      ? 'Condition Satisfied (Applied)'
                      : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Compound Rule 3: Renewal Contraction */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_RENEWAL_CONTRACTION')
                    ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/20'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-800">
                    COMPOUND_RENEWAL_CONTRACTION
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_RENEWAL_CONTRACTION')
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    +15 pts
                  </span>
                </div>
                <h5 className="text-xs font-bold text-slate-900 mb-1">Contract Expiry Contraction</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Triggers when renewal is within 45 days AND license usage drop exceeds 20%.
                </p>
                <div className="mt-3 text-[10px] font-mono flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      (riskDetail?.compound_rules_triggered || []).includes('COMPOUND_RENEWAL_CONTRACTION')
                        ? 'bg-rose-500 animate-pulse'
                        : 'bg-slate-300'
                    }`}
                  />
                  <span className="font-semibold text-slate-700">
                    {(riskDetail?.compound_rules_triggered || []).includes('COMPOUND_RENEWAL_CONTRACTION')
                      ? 'Condition Satisfied (Applied)'
                      : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. TRANSPARENT RULE BREAKDOWN AUDIT TABLE */}
          <div className="border border-[#E2E8F0] rounded-2xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#2563EB]" />
                  <span>Rule Execution Breakdown &amp; Evidence Citation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every point addition cites exact condition logic and verified evidence IDs.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 self-start sm:self-auto">
                Total Score: {riskDetail?.risk_score} pts
              </span>
            </div>

            {(!riskDetail?.rule_breakdown || riskDetail.rule_breakdown.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">Zero penalty rules triggered.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">This account exhibits clean operational metrics across all 5 dimensions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase">
                      <th className="py-2.5 px-3">Rule ID</th>
                      <th className="py-2.5 px-3">Rule Name &amp; Description</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Points</th>
                      <th className="py-2.5 px-3">Citing Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riskDetail.rule_breakdown.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-indigo-700 whitespace-nowrap">
                          {r.rule_id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{r.rule_name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-slate-100 text-slate-700">
                            {r.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-rose-600 text-right whitespace-nowrap">
                          +{r.points} pts
                        </td>
                        <td className="py-3 px-3">
                          {r.evidence_ids && r.evidence_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.evidence_ids.map((evId, evIdx) => (
                                <span
                                  key={evIdx}
                                  className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-[10px]"
                                >
                                  {evId}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">System Metric</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
