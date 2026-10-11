import { useState, useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { RiskBadge } from './RiskBadge';
import {
  ArrowUpDown,
  Building,
  Calendar,
  DollarSign,
  Search,
  Flame,
  AlertCircle,
  Clock,
  User,
  Activity,
  RotateCcw,
  Sparkles,
  ArrowRight
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

  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden shadow-xl">
      {/* Table Header & Controls Bar */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/60 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Section Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline text-lg sm:text-xl font-bold text-white tracking-tight">
                Ranked Customer Accounts
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-body">
                Deterministic risk priority · Verified against multi-source evidence
              </p>
            </div>
          </div>

          {/* Right Controls: Currency Toggle & Reset */}
          <div className="flex items-center gap-3">
            {onCurrencyChange && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
                <button
                  onClick={() => onCurrencyChange('USD')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    currency === 'USD'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => onCurrencyChange('INR')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    currency === 'INR'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ₹ INR
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          {/* Risk Level Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 font-medium font-mono uppercase tracking-wider">
              Risk:
            </span>
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1 gap-1">
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
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    filterRisk === tier.key
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Owner Dropdown */}
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All CSM Owners</option>
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
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Renewal Windows</option>
              <option value="30">Within 30 Days</option>
              <option value="60">Within 60 Days</option>
              <option value="90">Within 90 Days</option>
            </select>

            {/* In-table Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search rows..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm font-body">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider text-xs font-mono font-bold">
              <th
                onClick={() => handleSort('name')}
                className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-500" />
                  <span>Account</span>
                  <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'name' ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('arr')}
                className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span>ARR</span>
                  <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'arr' ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('risk_score')}
                className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-slate-500" />
                  <span>Risk Score</span>
                  <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'risk_score' ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('urgency_days_to_renewal')}
                className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Urgency</span>
                  <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'urgency_days_to_renewal' ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
              </th>

              <th className="py-4 px-6 min-w-[240px]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  <span>Primary Trigger</span>
                </div>
              </th>

              <th className="py-4 px-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Renewal</span>
                </div>
              </th>

              <th className="py-4 px-6">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Owner</span>
                </div>
              </th>

              <th className="py-4 px-6 text-right">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {sortedAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  No customer accounts match the selected filter criteria.
                </td>
              </tr>
            ) : (
              sortedAccounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isUrgent = (account.urgency_days_to_renewal || 999) <= 30;

                return (
                  <tr
                    key={account.id}
                    onClick={() => onSelectAccount(account.id)}
                    className={`cursor-pointer transition-all group ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-4 border-l-blue-500 text-white'
                        : 'hover:bg-slate-850/80 bg-slate-900 text-slate-200'
                    }`}
                  >
                    {/* 1. Account Name & Industry */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                        {account.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                        <span className="font-mono text-slate-400">{account.domain || 'saas.app'}</span>
                        <span className="text-slate-600">•</span>
                        <span>{account.industry || 'B2B SaaS'}</span>
                      </div>
                    </td>

                    {/* 2. ARR */}
                    <td className="py-4 px-6 font-mono font-bold text-base text-white whitespace-nowrap">
                      {formatCurrency(account.arr)}
                    </td>

                    {/* 3. Risk Score + Badge */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <RiskBadge level={account.risk_level} score={account.risk_score} size="md" />
                    </td>

                    {/* 4. Urgency */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                          isUrgent
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                            : (account.urgency_days_to_renewal || 999) <= 60
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {isUrgent ? 'Immediate (<30d)' : `In ${account.urgency_days_to_renewal}d`}
                      </span>
                    </td>

                    {/* 5. Primary Warning Trigger */}
                    <td className="py-4 px-6">
                      <div className="text-xs font-medium text-slate-200 line-clamp-1">
                        {account.main_warning || account.primary_reason_code.replace(/_/g, ' ')}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mt-1">
                        {account.primary_reason_code.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* 6. Renewal Date */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="text-sm font-semibold text-white font-mono">
                        {account.renewal_date}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        in {account.urgency_days_to_renewal} days
                      </div>
                    </td>

                    {/* 7. CSM Owner */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-500/40">
                          {account.csm_owner
                            ? account.csm_owner
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                            : 'CS'}
                        </div>
                        <span className="text-xs font-medium text-slate-300">
                          {account.csm_owner || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* 8. Action CTA */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInvestigateAccount) {
                            onInvestigateAccount(account.id);
                          } else {
                            onSelectAccount(account.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer group-hover:scale-105"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Diagnose</span>
                        <ArrowRight className="w-3.5 h-3.5" />
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
