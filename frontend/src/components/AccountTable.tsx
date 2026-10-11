import { useState, useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { RiskBadge } from './RiskBadge';
import {
  ArrowUpDown,
  Building,
  DollarSign,
  Search,
  Flame,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  UserX,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface AccountTableProps {
  accounts: AccountRiskSummary[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  currency?: 'USD' | 'INR';
  onCurrencyChange?: (currency: 'USD' | 'INR') => void;
  onInvestigateAccount?: (accountId: string) => void;
}

type SortField = 'name' | 'arr' | 'risk_score' | 'urgency_days_to_renewal';

export function AccountTable({
  accounts,
  selectedAccountId,
  onSelectAccount,
  currency = 'USD',
  onCurrencyChange,
  onInvestigateAccount
}: AccountTableProps) {
  const [sortField, setSortField] = useState<SortField>('risk_score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterRenewal, setFilterRenewal] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  // Extract unique CSM owners
  const csmOwners = useMemo(() => {
    const owners = new Set<string>();
    accounts.forEach((a) => {
      if (a.csm_owner) owners.add(a.csm_owner);
    });
    return Array.from(owners);
  }, [accounts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  // Currency formatter
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      if (inrAmount >= 100000) return `₹${(inrAmount / 100000).toFixed(1)} L`;
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (filterRisk !== 'all' && acc.risk_level !== filterRisk) return false;
      if (filterOwner !== 'all' && acc.csm_owner !== filterOwner) return false;
      if (filterRenewal === '30' && (acc.urgency_days_to_renewal || 999) > 30) return false;
      if (filterRenewal === '60' && (acc.urgency_days_to_renewal || 999) > 60) return false;
      if (filterRenewal === '90' && (acc.urgency_days_to_renewal || 999) > 90) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesName = acc.name.toLowerCase().includes(q);
        const matchesDomain = acc.domain && acc.domain.toLowerCase().includes(q);
        const matchesOwner = acc.csm_owner && acc.csm_owner.toLowerCase().includes(q);
        const matchesTrigger = acc.primary_reason_code && acc.primary_reason_code.toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesOwner && !matchesTrigger) return false;
      }
      return true;
    });
  }, [accounts, filterRisk, filterOwner, filterRenewal, tableSearch]);

  // Sort accounts
  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      const factor = sortAsc ? 1 : -1;
      if (sortField === 'name') return a.name.localeCompare(b.name) * factor;
      if (sortField === 'arr') return (a.arr - b.arr) * factor;
      if (sortField === 'risk_score') return (a.risk_score - b.risk_score) * factor;
      if (sortField === 'urgency_days_to_renewal') {
        return ((a.urgency_days_to_renewal || 999) - (b.urgency_days_to_renewal || 999)) * factor;
      }
      return 0;
    });
  }, [filteredAccounts, sortField, sortAsc]);

  const resetFilters = () => {
    setFilterRisk('all');
    setFilterOwner('all');
    setFilterRenewal('all');
    setTableSearch('');
    setSortField('risk_score');
    setSortAsc(false);
  };

  const hasActiveFilters =
    filterRisk !== 'all' ||
    filterOwner !== 'all' ||
    filterRenewal !== 'all' ||
    tableSearch.trim().length > 0;

  // Helper to format concise problem info
  const getProblemInfo = (account: AccountRiskSummary) => {
    const code = account.primary_reason_code || '';
    if (code.includes('usage') || code.includes('drop')) {
      return {
        label: 'Usage Contraction (-52%)',
        color: 'text-rose-700 bg-rose-50 border-rose-200/70',
        icon: TrendingDown
      };
    }
    if (code.includes('champion') || code.includes('sponsor')) {
      return {
        label: 'Champion Departure',
        color: 'text-amber-800 bg-amber-50 border-amber-200/70',
        icon: UserX
      };
    }
    if (code.includes('sla') || code.includes('ticket')) {
      return {
        label: 'Critical SLA Escalation',
        color: 'text-rose-700 bg-rose-50 border-rose-200/70',
        icon: AlertTriangle
      };
    }
    if (code.includes('renewal')) {
      return {
        label: 'Contract Expiration Near',
        color: 'text-amber-800 bg-amber-50 border-amber-200/70',
        icon: Clock
      };
    }
    return {
      label: 'Stable Engagement',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/70',
      icon: CheckCircle2
    };
  };

  return (
    <div className="border border-[#E2E8F0] rounded-2xl bg-white overflow-hidden shadow-xs">
      {/* Table Header & Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Section Title */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-normal">
              Customer Risk Ranking
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized by compound churn risk score and renewal timeline
            </p>
          </div>

          {/* Right Controls: Currency Toggle & Reset */}
          <div className="flex items-center gap-2">
            {onCurrencyChange && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                <button
                  onClick={() => onCurrencyChange('USD')}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    currency === 'USD'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => onCurrencyChange('INR')}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    currency === 'INR'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  ₹ INR
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
          {/* Risk Level Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Risk:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'critical', label: 'Critical' },
                { key: 'high', label: 'High' },
                { key: 'medium', label: 'Medium' },
                { key: 'low', label: 'Healthy' }
              ].map((tier) => (
                <button
                  key={tier.key}
                  onClick={() => setFilterRisk(tier.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    filterRisk === tier.key
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Owner Dropdown */}
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="all">All CSMs</option>
              {csmOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>

            {/* Renewal Dropdown */}
            <select
              value={filterRenewal}
              onChange={(e) => setFilterRenewal(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="all">All Renewals</option>
              <option value="30">≤ 30 Days</option>
              <option value="60">≤ 60 Days</option>
              <option value="90">≤ 90 Days</option>
            </select>

            {/* In-table Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1.5" />
              <input
                type="text"
                placeholder="Filter accounts..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2563EB] w-36 sm:w-44"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Structured Table: All columns fit 100% width with NO horizontal swipe needed */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-[#FAFCFF] text-slate-500 uppercase tracking-wider text-[11px] font-mono">
              <th
                onClick={() => handleSort('name')}
                className="py-2.5 px-3 sm:px-4 cursor-pointer hover:text-slate-900 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'name' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('arr')}
                className="py-2.5 px-3 sm:px-4 cursor-pointer hover:text-slate-900 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>ARR</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'arr' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('risk_score')}
                className="py-2.5 px-3 sm:px-4 cursor-pointer hover:text-slate-900 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-slate-400" />
                  <span>Risk Score</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'risk_score' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                </div>
              </th>

              <th className="py-2.5 px-3 sm:px-4">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Detected Issue</span>
                </div>
              </th>

              <th
                onClick={() => handleSort('urgency_days_to_renewal')}
                className="py-2.5 px-3 sm:px-4 cursor-pointer hover:text-slate-900 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Renewal Window</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'urgency_days_to_renewal' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                </div>
              </th>

              <th className="py-2.5 px-3 sm:px-4">
                <span>CSM</span>
              </th>

              <th className="py-2.5 px-3 sm:px-4 text-right">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedAccounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                  No customer accounts match the selected filter criteria.
                </td>
              </tr>
            ) : (
              sortedAccounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isUrgent = (account.urgency_days_to_renewal || 999) <= 30;
                const problem = getProblemInfo(account);
                const ProblemIcon = problem.icon;

                return (
                  <tr
                    key={account.id}
                    onClick={() => onSelectAccount(account.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F0F5FF] border-l-4 border-l-[#2563EB]'
                        : 'hover:bg-slate-50/70 bg-white'
                    }`}
                  >
                    {/* 1. Account Name & Domain */}
                    <td className="py-3 px-3 sm:px-4">
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 transition-colors">
                        {account.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-slate-400">{account.domain || 'saas.app'}</span>
                        <span className="text-slate-300">•</span>
                        <span>{account.industry || 'B2B SaaS'}</span>
                      </div>
                    </td>

                    {/* 2. Contract ARR */}
                    <td className="py-3 px-3 sm:px-4 font-mono font-semibold text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                      {formatCurrency(account.arr)}
                    </td>

                    {/* 3. Risk Score + Badge */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
                    </td>

                    {/* 4. Structured Problem / Detected Issue */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${problem.color}`}>
                        <ProblemIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{problem.label}</span>
                      </span>
                    </td>

                    {/* 5. Combined Renewal Window (Countdown + Date) */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                            isUrgent
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : (account.urgency_days_to_renewal || 999) <= 60
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {isUrgent ? 'Immediate' : `In ${account.urgency_days_to_renewal}d`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {account.renewal_date}
                        </span>
                      </div>
                    </td>

                    {/* 6. CSM Owner */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] border border-slate-200">
                          {account.csm_owner
                            ? account.csm_owner
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                            : 'CS'}
                        </div>
                        <span className="text-xs text-slate-700">
                          {account.csm_owner || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* 7. Action CTA: Always in view without swiping */}
                    <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInvestigateAccount) {
                            onInvestigateAccount(account.id);
                          } else {
                            onSelectAccount(account.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer"
                        title={`Diagnose risk for ${account.name}`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-200" />
                        <span>Diagnose</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountTable;
