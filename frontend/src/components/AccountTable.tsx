import { useState, useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { RiskBadge } from './RiskBadge';
import {
  ArrowUpDown,
  ChevronRight,
  Building,
  Calendar,
  DollarSign,
  Search,
  Flame,
  AlertCircle,
  Clock,
  User,
  Activity,
  RotateCcw
} from 'lucide-react';

interface AccountTableProps {
  accounts: AccountRiskSummary[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  currency?: 'USD' | 'INR';
  onCurrencyChange?: (currency: 'USD' | 'INR') => void;
}

type SortField = 'name' | 'arr' | 'risk_score' | 'urgency_days_to_renewal';

export function AccountTable({
  accounts,
  selectedAccountId,
  onSelectAccount,
  currency = 'USD',
  onCurrencyChange
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
      setSortAsc(field === 'name'); // default names A-Z, numbers desc
    }
  };

  // Currency formatter
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      // Convert illustrative 1 USD ~ 83 INR
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

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Risk tier filter
      if (filterRisk !== 'all' && acc.risk_level !== filterRisk) {
        return false;
      }
      // Owner filter
      if (filterOwner !== 'all' && acc.csm_owner !== filterOwner) {
        return false;
      }
      // Renewal horizon filter
      if (filterRenewal === '30' && acc.urgency_days_to_renewal > 30) {
        return false;
      }
      if (filterRenewal === '60' && acc.urgency_days_to_renewal > 60) {
        return false;
      }
      if (filterRenewal === '90' && acc.urgency_days_to_renewal > 90) {
        return false;
      }
      // Table search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesName = acc.name.toLowerCase().includes(q);
        const matchesDomain = acc.domain?.toLowerCase().includes(q) || false;
        const matchesOwner = acc.csm_owner.toLowerCase().includes(q);
        const matchesWarning = acc.main_warning?.toLowerCase().includes(q) || false;
        const matchesReason = acc.primary_reason_code.toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesOwner && !matchesWarning && !matchesReason) {
          return false;
        }
      }
      return true;
    });
  }, [accounts, filterRisk, filterOwner, filterRenewal, tableSearch]);

  // Sort accounts
  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      const factor = sortAsc ? 1 : -1;
      if (sortField === 'name') {
        return a.name.localeCompare(b.name) * factor;
      } else if (sortField === 'arr') {
        return (a.arr - b.arr) * factor;
      } else if (sortField === 'risk_score') {
        return (a.risk_score - b.risk_score) * factor;
      } else if (sortField === 'urgency_days_to_renewal') {
        return (a.urgency_days_to_renewal - b.urgency_days_to_renewal) * factor;
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
    <div className="border border-[#E2E8F0] rounded-xl bg-white overflow-hidden shadow-xs">
      {/* Table Header & Interactive Control Bar */}
      <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Section Title and Quick Stats */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-[#020062] leading-tight">
                Ranked Customer Accounts
              </h3>
              <p className="text-[11px] text-slate-500 font-body">
                Deterministic risk priority · Verified against multi-source evidence
              </p>
            </div>
          </div>

          {/* Right: Currency Toggle & Filter Summary */}
          <div className="flex items-center gap-2">
            {onCurrencyChange && (
              <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg p-0.5 text-xs font-medium">
                <button
                  onClick={() => onCurrencyChange('USD')}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                    currency === 'USD'
                      ? 'bg-[#0025AE] text-white'
                      : 'text-slate-600 hover:text-[#020062]'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => onCurrencyChange('INR')}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                    currency === 'INR'
                      ? 'bg-[#0025AE] text-white'
                      : 'text-slate-600 hover:text-[#020062]'
                  }`}
                >
                  ₹ INR
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:text-[#020062] hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]/70">
          {/* Risk Level Pills */}
          <div className="flex items-center gap-1.5 text-xs font-body">
            <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              Risk:
            </span>
            <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-xs">
              {[
                { key: 'all', label: 'All' },
                { key: 'critical', label: 'Critical' },
                { key: 'high', label: 'High' },
                { key: 'medium', label: 'Medium' },
                { key: 'low', label: 'Low' }
              ].map((tier) => (
                <button
                  key={tier.key}
                  onClick={() => setFilterRisk(tier.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                    filterRisk === tier.key
                      ? 'bg-[#0025AE] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#020062] hover:bg-slate-50'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Dropdowns: CSM Owner & Renewal Window */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-body">
            {/* CSM Filter */}
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                className="bg-white border border-[#E2E8F0] text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="all">All CSM Owners</option>
                {csmOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>

            {/* Renewal Window Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterRenewal}
                onChange={(e) => setFilterRenewal(e.target.value)}
                className="bg-white border border-[#E2E8F0] text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="all">All Renewal Windows</option>
                <option value="30">Due in ≤ 30 Days</option>
                <option value="60">Due in ≤ 60 Days</option>
                <option value="90">Due in ≤ 90 Days</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter table rows..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2563EB] w-36 sm:w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-body">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'name' ? 'text-[#0025AE]' : 'text-slate-300'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('arr')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>ARR</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'arr' ? 'text-[#0025AE]' : 'text-slate-300'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('risk_score')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-slate-400" />
                  <span>Risk Score</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'risk_score' ? 'text-[#0025AE]' : 'text-slate-300'}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('urgency_days_to_renewal')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Urgency</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'urgency_days_to_renewal' ? 'text-[#0025AE]' : 'text-slate-300'}`} />
                </div>
              </th>

              <th className="py-3 px-4 min-w-[220px]">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Main Warning / Trigger</span>
                </div>
              </th>

              <th className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Renewal</span>
                </div>
              </th>

              <th className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Owner</span>
                </div>
              </th>

              <th className="py-3 px-4 text-right">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E2E8F0]">
            {sortedAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                  No customer accounts match the selected filter criteria.
                </td>
              </tr>
            ) : (
              sortedAccounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isUrgent = account.urgency_days_to_renewal <= 30;

                return (
                  <tr
                    key={account.id}
                    onClick={() => onSelectAccount(account.id)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-[#EFF6FF] border-l-4 border-l-[#0025AE]'
                        : 'hover:bg-slate-50/90 bg-white'
                    }`}
                  >
                    {/* 1. Account Name & Industry */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-sm text-[#020062] group-hover:text-[#2563EB] transition-colors">
                        {account.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-slate-600">{account.domain || 'saas.app'}</span>
                        <span className="text-slate-300">•</span>
                        <span>{account.industry || 'B2B SaaS'}</span>
                      </div>
                    </td>

                    {/* 2. ARR */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(account.arr)}
                    </td>

                    {/* 3. Risk Score + Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RiskBadge level={account.risk_level} score={account.risk_score} />
                    </td>

                    {/* 4. Urgency */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isUrgent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                          Immediate (&lt;30d)
                        </span>
                      ) : account.urgency_days_to_renewal <= 60 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Within 60d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Stable (&gt;60d)
                        </span>
                      )}
                    </td>

                    {/* 5. Main Warning / Detected Signal */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] uppercase tracking-wide border border-slate-200">
                          {account.primary_reason_code.replace(/_/g, ' ')}
                        </span>
                        <p className="text-[11px] text-slate-600 font-normal line-clamp-1 max-w-sm">
                          {account.main_warning || (account.contributing_factors.length > 0 ? account.contributing_factors[0] : 'Active monitoring')}
                        </p>
                      </div>
                    </td>

                    {/* 6. Renewal Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {account.renewal_date}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        in <strong>{account.urgency_days_to_renewal}</strong> days
                      </div>
                    </td>

                    {/* 7. Owner */}
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#0025AE]/10 text-[#0025AE] font-bold text-[10px] flex items-center justify-center">
                          {account.csm_owner.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span>{account.csm_owner}</span>
                      </div>
                    </td>

                    {/* 8. Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAccount(account.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#0025AE] text-white shadow-xs'
                            : 'bg-slate-100 text-[#0025AE] hover:bg-[#2563EB] hover:text-white'
                        }`}
                      >
                        <span>Investigate</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3.5 border-t border-[#E2E8F0] bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div>
          Showing <strong className="text-[#020062]">{sortedAccounts.length}</strong> of {accounts.length} accounts
          {hasActiveFilters && <span className="ml-1 text-slate-400">(filtered)</span>}
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            High / Critical Priority: {sortedAccounts.filter((a) => a.risk_level === 'critical' || a.risk_level === 'high').length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Medium: {sortedAccounts.filter((a) => a.risk_level === 'medium').length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Healthy / Low: {sortedAccounts.filter((a) => a.risk_level === 'low').length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AccountTable;
