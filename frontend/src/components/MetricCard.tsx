import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  highlight?: boolean;
  badge?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  highlight = false,
  badge
}: MetricCardProps) {
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 transition-all duration-150 border bg-white shadow-xs ${
        highlight
          ? 'border-rose-200 ring-1 ring-rose-200/50'
          : 'border-[#E2E8F0] hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-headline font-bold text-slate-900 tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md font-mono ${
              trend.isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
            }`}
          >
            {trend.value}
          </span>
        )}
        {badge && (
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-slate-500 font-body mt-2 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
