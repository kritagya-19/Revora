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
      className={`rounded-xl p-6 transition-all duration-200 border bg-white ${
        highlight
          ? 'border-rose-300 ring-1 ring-rose-200 shadow-xs'
          : 'border-[#E2E8F0] hover:border-[#2563EB]/30 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-body">
          {label}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[#F0F5FF] border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-3xl sm:text-4xl font-headline font-bold text-[#020062] tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono ${
              trend.isPositive ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-rose-800 bg-rose-50 border border-rose-200'
            }`}
          >
            {trend.value}
          </span>
        )}
        {badge && (
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#0025AE] border border-blue-200">
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-slate-500 font-body mt-2.5">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
