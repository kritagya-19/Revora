import type { RiskLevel } from '../types/api';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ level, score, showScore = true, size = 'md' }: RiskBadgeProps) {
  const configs: Record<RiskLevel, { bg: string; text: string; border: string; dot: string; label: string }> = {
    critical: {
      bg: 'bg-rose-950/80',
      text: 'text-rose-300',
      border: 'border-rose-800/90',
      dot: 'bg-rose-500 animate-pulse',
      label: 'Critical'
    },
    high: {
      bg: 'bg-amber-950/80',
      text: 'text-amber-300',
      border: 'border-amber-800/90',
      dot: 'bg-amber-500',
      label: 'High Risk'
    },
    medium: {
      bg: 'bg-blue-950/80',
      text: 'text-blue-300',
      border: 'border-blue-800/90',
      dot: 'bg-blue-500',
      label: 'Medium'
    },
    low: {
      bg: 'bg-emerald-950/80',
      text: 'text-emerald-300',
      border: 'border-emerald-800/90',
      dot: 'bg-emerald-500',
      label: 'Healthy'
    }
  };

  const current = configs[level] || configs.low;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-bold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border ${current.bg} ${current.text} ${current.border} ${sizeClasses} font-mono`}
    >
      <span className={`h-2 w-2 rounded-full ${current.dot} shrink-0`} />
      <span className="font-semibold">{current.label}</span>
      {showScore && score !== undefined && (
        <span className="font-bold pl-1.5 border-l border-current/30 text-white">
          {score}
        </span>
      )}
    </span>
  );
}

export default RiskBadge;
