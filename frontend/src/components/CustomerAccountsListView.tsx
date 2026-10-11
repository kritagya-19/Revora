import { useState, useMemo } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { RiskBadge } from './RiskBadge';
import {
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  Search,
  Building,
  Clock,
  ArrowRight,
  RotateCcw,
  TrendingDown,
  UserX,
  CheckCircle2,
  Heart
} from 'lucide-react';

interface CustomerAccountsListViewProps {
  accounts: AccountRiskSummary[];
  onSelectAccount: (accountId: string) => void;
  currency: 'USD' | 'INR';
  onCurrencyChange: (currency: 'USD' | 'INR') => void;
  onInvestigateAccount?: (accountId: string) => void;
}

type SortField = 'name' | 'arr' | 'health_score' | 'risk_score' | 'urgency_days_to_renewal';

export function CustomerAccountsListView({
  accounts,
  onSelectAccount,
  currency = 'USD',
  onCurrencyChange
}: CustomerAccountsListViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('risk_score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Currency Formatter
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

  // High-Level Summary Metrics
  const summaryStats = useMemo(() => {
    const totalCount = accounts.length;
    const totalArr = accounts.reduce((sum, a) => sum + (a.arr || 0), 0);
    const avgHealth = totalCount > 0 ? Math.round(accounts.reduce((sum, a) => sum + (a.health_score || 0), 0) / totalCount) : 0;
    const atRiskCount = accounts.filter((a) => a.risk_level === 'critical' || a.risk_level === 'high').length;
    const atRiskArr = accounts.filter((a) => a.risk_level === 'critical' || a.risk_level === 'high').reduce((sum, a) => sum + (a.arr || 0), 0);

    return {
      totalCount,
      totalArr,
      avgHealth,
      atRiskCount,
      atRiskArr
    };
  }, [accounts]);

  // Extract unique CSMs and Tiers
  const csmOwners = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.csm_owner) set.add(a.csm_owner);
    });
    return Array.from(set);
  }, [accounts]);

  const tiers = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.tier) set.add(a.tier);
    });
    return Array.from(set);
  }, [accounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (selectedRisk !== 'all' && acc.risk_level.toLowerCase() !== selectedRisk.toLowerCase()) return false;
      if (selectedOwner !== 'all' && acc.csm_owner !== selectedOwner) return false;
      if (selectedTier !== 'all' && acc.tier?.toLowerCase() !== selectedTier.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = acc.name.toLowerCase().includes(q);
        const matchesDomain = acc.domain && acc.domain.toLowerCase().includes(q);
        const matchesIndustry = acc.industry && acc.industry.toLowerCase().includes(q);
        const matchesOwner = acc.csm_owner && acc.csm_owner.toLowerCase().includes(q);
        const matchesReason = acc.primary_reason_code && acc.primary_reason_code.toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesIndustry && !matchesOwner && !matchesReason) return false;
      }
      return true;
    });
  }, [accounts, selectedRisk, selectedOwner, selectedTier, searchQuery]);

  // Sort accounts
  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      const factor = sortAsc ? 1 : -1;
      if (sortField === 'name') return a.name.localeCompare(b.name) * factor;
      if (sortField === 'arr') return (a.arr - b.arr) * factor;
      if (sortField === 'health_score') return ((a.health_score ?? 0) - (b.health_score ?? 0)) * factor;
      if (sortField === 'risk_score') return (a.risk_score - b.risk_score) * factor;
      if (sortField === 'urgency_days_to_renewal') {
        return ((a.urgency_days_to_renewal || 999) - (b.urgency_days_to_renewal || 999)) * factor;
      }
      return 0;
    });
  }, [filteredAccounts, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRisk('all');
    setSelectedOwner('all');
    setSelectedTier('all');
    setSortField('risk_score');
    setSortAsc(false);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedRisk !== 'all' ||
    selectedOwner !== 'all' ||
    selectedTier !== 'all';

  // Helper for structured problem label
  const getProblemInfo = (acc: AccountRiskSummary) => {
    const code = acc.primary_reason_code || '';
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
        label: 'Renewal Window Approaching',
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

  // Health Score color helper
  const getHealthBadge = (score: number) => {
    if (score >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Accounts */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Total Accounts
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#2563EB]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {summaryStats.totalCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active B2B SaaS Customer Portfolio
          </p>
        </div>

        {/* Portfolio ARR */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Portfolio ARR
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCur(summaryStats.totalArr)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total Contract Recurring Revenue
          </p>
        </div>

        {/* Average Health Score */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Portfolio Health
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {summaryStats.avgHealth}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Average customer telemetry health
          </p>
        </div>

        {/* At-Risk Accounts */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              At-Risk Accounts
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 tracking-tight">
              {summaryStats.atRiskCount}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({formatCur(summaryStats.atRiskArr)} ARR)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            High or critical churn likelihood
          </p>
        </div>
      </div>

      {/* 2. CUSTOMER ACCOUNTS DIRECTORY TABLE */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white overflow-hidden shadow-xs">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-normal flex items-center gap-2">
                <Building className="w-4 h-4 text-[#2563EB]" />
                <span>Customer Accounts Directory</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select any customer to inspect 360 telemetry, signals, and risk findings
              </p>
            </div>

            {/* Currency & Reset Controls */}
            <div className="flex items-center gap-2">
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

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
            {/* Risk Filter Segmented Pills */}
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
                    onClick={() => setSelectedRisk(tier.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      selectedRisk === tier.key
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdowns & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* CSM Dropdown */}
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="all">All CSMs</option>
                {csmOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>

              {/* Tier Dropdown */}
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="all">All Tiers</option>
                {tiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1.5" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2563EB] w-40 sm:w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Clean Responsive Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-[#FAFCFF] text-slate-500 uppercase tracking-wider text-[11px] font-mono">
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-2.5 sm:px-3.5 cursor-pointer hover:text-slate-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Account</span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('arr')}
                  className="py-2.5 px-2 sm:px-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ARR</span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('health_score')}
                  className="py-2.5 px-2 sm:px-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Health</span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('risk_score')}
                  className="py-2.5 px-2 sm:px-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Status</span>
                  </div>
                </th>

                <th className="py-2.5 px-2 sm:px-3">
                  <span>Key Finding / Issue</span>
                </th>

                <th
                  onClick={() => handleSort('urgency_days_to_renewal')}
                  className="py-2.5 px-2 sm:px-3 cursor-pointer hover:text-slate-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Renewal</span>
                  </div>
                </th>

                <th className="py-2.5 px-2 sm:px-3">
                  <span>CSM</span>
                </th>

                <th className="py-2.5 px-2 sm:px-3 text-right sticky right-0 bg-[#FAFCFF] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] z-10">
                  <span>Action</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sortedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No customer accounts match your current filter settings.
                  </td>
                </tr>
              ) : (
                sortedAccounts.map((account) => {
                  const problem = getProblemInfo(account);
                  const ProblemIcon = problem.icon;
                  const isUrgent = (account.urgency_days_to_renewal || 999) <= 30;

                  return (
                    <tr
                      key={account.id}
                      onClick={() => onSelectAccount(account.id)}
                      className="cursor-pointer hover:bg-slate-50/70 bg-white transition-colors group"
                    >
                      {/* 1. Account Name, Domain & Tier */}
                      <td className="py-2.5 px-2.5 sm:px-3.5">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-[#2563EB] transition-colors leading-tight">
                          {account.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                          <span>{account.domain || 'saas.app'}</span>
                          <span>•</span>
                          <span className="px-1 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-medium font-sans">
                            {account.tier || 'Enterprise'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Contract ARR */}
                      <td className="py-2.5 px-2 sm:px-3 font-mono font-semibold text-xs text-slate-900 whitespace-nowrap">
                        {formatCur(account.arr)}
                      </td>

                      {/* 3. Health Score Badge */}
                      <td className="py-2.5 px-2 sm:px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${getHealthBadge(
                            account.health_score || 50
                          )}`}
                        >
                          <Activity className="w-2.5 h-2.5" />
                          <span>{account.health_score || 50}/100</span>
                        </span>
                      </td>

                      {/* 4. Risk Status Badge */}
                      <td className="py-2.5 px-2 sm:px-3 whitespace-nowrap">
                        <RiskBadge level={account.risk_level} score={account.risk_score} size="sm" />
                      </td>

                      {/* 5. Key Finding / Issue */}
                      <td className="py-2.5 px-2 sm:px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${problem.color}`}>
                          <ProblemIcon className="w-3 h-3 shrink-0" />
                          <span>{problem.label}</span>
                        </span>
                      </td>

                      {/* 6. Renewal Window (Stacked for compact fit) */}
                      <td className="py-2.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border w-fit ${
                              isUrgent
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : (account.urgency_days_to_renewal || 999) <= 60
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {isUrgent ? 'Immediate' : `In ${account.urgency_days_to_renewal}d`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {account.renewal_date}
                          </span>
                        </div>
                      </td>

                      {/* 7. CSM Owner */}
                      <td className="py-2.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4.5 h-4.5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[8.5px] border border-slate-200">
                            {account.csm_owner
                              ? account.csm_owner
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                              : 'CS'}
                          </div>
                          <span className="text-[11px] text-slate-700 truncate max-w-[85px]">
                            {account.csm_owner || 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      {/* 8. Action CTA: Always visible without scrolling */}
                      <td className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/70 transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAccount(account.id);
                          }}
                          className="inline-flex items-center gap-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-all shadow-2xs cursor-pointer group-hover:shadow-xs"
                        >
                          <span>View Details</span>
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
    </div>
  );
}

export default CustomerAccountsListView;
