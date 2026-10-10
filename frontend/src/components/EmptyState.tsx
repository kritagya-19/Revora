import type { ReactNode } from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({
  title = "No accounts found",
  description = "No matching customer records meet your current search or filter criteria.",
  actionText,
  onAction,
  icon
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-[#E2E8F0] rounded-xl bg-slate-50/50">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-[#2563EB] mb-4">
        {icon || <Database className="w-6 h-6 stroke-[1.75]" />}
      </div>
      <h3 className="text-base font-semibold text-[#020062] font-body mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 font-body max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-md bg-[#2563EB] hover:bg-[#0025AE] text-white text-xs font-medium font-body transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
