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
      className={`rounded-2xl p-6 transition-all duration-200 border relative overflow-hidden ${
        highlight
          ? 'bg-slate-900 border-rose-500/50 ring-1 ring-rose-500/30 shadow-lg shadow-rose-950/20'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          {label}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-blue-400 shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-3xl sm:text-4xl font-bold text-white font-mono tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono ${
              trend.isPositive ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800' : 'text-rose-400 bg-rose-950/60 border border-rose-800'
            }`}
          >
            {trend.value}
          </span>
        )}
        {badge && (
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed font-body">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
