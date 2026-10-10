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
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  highlight = false
}: MetricCardProps) {
  return (
    <div
      className={`rounded-lg p-5 transition-all duration-200 border bg-white ${
        highlight
          ? 'border-[#0025AE] ring-1 ring-[#0025AE]/20 shadow-sm'
          : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
      }`}
    >
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider font-body text-slate-500">
          {label}
        </span>
        {icon && <div className="text-[#2563EB]">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl lg:text-3xl font-normal text-[#020062] font-headline tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              trend.isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1.5 text-xs text-slate-500 font-body leading-relaxed">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
