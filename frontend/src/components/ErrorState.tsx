import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Connection Error",
  message = "Failed to communicate with the backend API service. Ensure the server is running on port 8000.",
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-red-200 rounded-xl bg-red-50/40">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
        <AlertTriangle className="w-6 h-6 stroke-[2]" />
      </div>
      <h3 className="text-base font-semibold text-red-950 font-body mb-1">
        {title}
      </h3>
      <p className="text-xs text-red-700/80 font-body max-w-md mb-5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white border border-red-300 text-red-800 hover:bg-red-50 text-xs font-medium font-body transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;
