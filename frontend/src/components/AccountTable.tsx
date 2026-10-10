import { useState } from 'react';
import type { AccountRiskSummary } from '../types/api';
import { RiskBadge } from './RiskBadge';
import { ArrowUpDown, ChevronRight, Building, Calendar, DollarSign } from 'lucide-react';

interface AccountTableProps {
  accounts: AccountRiskSummary[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
}

type SortField = 'name' | 'arr' | 'risk_score' | 'urgency_days_to_renewal';

export function AccountTable({
  accounts,
  selectedAccountId,
  onSelectAccount
}: AccountTableProps) {
  const [sortField, setSortField] = useState<SortField>('risk_score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name'); // default names A-Z, numbers desc
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (filterRisk === 'all') return true;
    return acc.risk_level === filterRisk;
  });

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    let factor = sortAsc ? 1 : -1;
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

  return (
    <div className="border border-[#E2E8F0] rounded-lg bg-white overflow-hidden shadow-xs">
      {/* Table Filter Controls */}
      <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
        <div className="flex items-center gap-2 text-xs font-body">
          <span className="text-slate-500 font-medium">Filter Risk Tier:</span>
          <div className="inline-flex rounded-md border border-[#E2E8F0] bg-white p-0.5 text-xs">
            {['all', 'critical', 'high', 'medium', 'low'].map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterRisk(tier)}
                className={`px-2.5 py-1 rounded text-xs capitalize cursor-pointer transition-colors ${
                  filterRisk === tier
                    ? 'bg-[#0025AE] text-white font-medium'
                    : 'text-slate-600 hover:text-[#020062]'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-body">
          Showing <span className="font-semibold text-[#020062]">{sortedAccounts.length}</span> of {accounts.length} accounts
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-body">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-slate-50/60 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Account & Industry</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('risk_score')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Risk Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('arr')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Annual Recurring Revenue</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('urgency_days_to_renewal')}
                className="py-3 px-4 cursor-pointer hover:text-[#020062] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Renewal Window</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4">Primary Trigger / Reason</th>
              <th className="py-3 px-4">CSM Owner</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E2E8F0]">
            {sortedAccounts.map((account) => {
              const isSelected = account.id === selectedAccountId;
              return (
                <tr
                  key={account.id}
                  onClick={() => onSelectAccount(account.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#EFF6FF] border-l-4 border-l-[#0025AE]'
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Account Name & Domain */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-sm text-[#020062]">
                      {account.name}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{account.domain || 'saas.app'}</span>
                      <span className="text-slate-300">•</span>
                      <span>{account.industry || 'B2B Enterprise'}</span>
                    </div>
                  </td>

                  {/* Risk Badge & Score */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <RiskBadge level={account.risk_level} score={account.risk_score} />
                  </td>

                  {/* ARR */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                    ${account.arr.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </td>

                  {/* Renewal Date & Days */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-800">
                      {account.renewal_date}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {account.urgency_days_to_renewal <= 30 ? (
                        <span className="text-red-600 font-semibold">
                          {account.urgency_days_to_renewal} days remaining
                        </span>
                      ) : (
                        <span>in {account.urgency_days_to_renewal} days</span>
                      )}
                    </div>
                  </td>

                  {/* Primary Reason Code */}
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                      {account.primary_reason_code}
                    </span>
                    {account.contributing_factors.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {account.contributing_factors[0]}
                      </p>
                    )}
                  </td>

                  {/* Owner */}
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                    {account.csm_owner}
                  </td>

                  {/* Action Icon */}
                  <td className="py-3.5 px-4 text-right">
                    <div
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-[#0025AE] text-white'
                          : 'text-slate-400 hover:text-[#0025AE] hover:bg-slate-100'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountTable;
