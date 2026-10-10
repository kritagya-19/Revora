import type { RiskLevel } from '../types/api';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, score, showScore = true, size = 'md' }: RiskBadgeProps) {
  const configs: Record<RiskLevel, { bg: string; text: string; border: string; label: string }> = {
    critical: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      label: 'Critical'
    },
    high: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      label: 'High Risk'
    },
    medium: {
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      border: 'border-sky-200',
      label: 'Medium'
    },
    low: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      label: 'Low / Healthy'
    }
  };

  const current = configs[level] || configs.low;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClasses} tracking-tight font-body`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          level === 'critical'
            ? 'bg-red-600 animate-pulse'
            : level === 'high'
            ? 'bg-amber-600'
            : level === 'medium'
            ? 'bg-sky-600'
            : 'bg-emerald-600'
        }`}
      />
      <span>{current.label}</span>
      {showScore && score !== undefined && (
        <span className="font-mono opacity-80 pl-1 border-l border-current/20">
          {score}
        </span>
      )}
    </span>
  );
}

export default RiskBadge;
