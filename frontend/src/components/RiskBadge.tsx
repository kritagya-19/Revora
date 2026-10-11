import type { RiskLevel, AccountClassification } from '../types/api';

interface RiskBadgeProps {
  level?: RiskLevel;
  score?: number;
  classification?: AccountClassification;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ level, score, classification, showScore = true, size = 'md' }: RiskBadgeProps) {
  const configs: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
    critical: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-600 animate-pulse',
      label: 'Critical'
    },
    high_risk: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-600 animate-pulse',
      label: 'High Risk'
    },
    high: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-600',
      label: 'High Risk'
    },
    needing_attention: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-600',
      label: 'Needing Attention'
    },
    medium: {
      bg: 'bg-blue-50',
      text: 'text-[#0025AE]',
      border: 'border-blue-200',
      dot: 'bg-[#2563EB]',
      label: 'Medium'
    },
    healthy: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      dot: 'bg-emerald-600',
      label: 'Healthy'
    },
    low: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      dot: 'bg-emerald-600',
      label: 'Healthy'
    }
  };

  const key = classification || level || (score !== undefined ? (score >= 50 ? 'high_risk' : score >= 25 ? 'needing_attention' : 'healthy') : 'low');
  const current = configs[key] || configs.low;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3 py-1.5 text-sm font-bold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClasses} font-mono shadow-2xs`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot} shrink-0`} />
      <span className="font-semibold">{current.label}</span>
      {showScore && score !== undefined && (
        <span className="font-bold pl-1.5 border-l border-current/30 text-[#020062]">
          {score}
        </span>
      )}
    </span>
  );
}

export default RiskBadge;
