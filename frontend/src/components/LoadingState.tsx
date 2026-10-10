interface LoadingStateProps {
  message?: string;
  subtext?: string;
}

export function LoadingState({
  message = "Loading records...",
  subtext = "Retrieving verified account intelligence from database"
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative flex items-center justify-center w-12 h-12 mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB] animate-spin" />
        <div className="absolute w-2 h-2 rounded-full bg-[#0025AE]" />
      </div>
      <h3 className="text-base font-semibold text-[#020062] font-body mb-1">
        {message}
      </h3>
      <p className="text-xs text-slate-500 font-body max-w-sm">
        {subtext}
      </p>
    </div>
  );
}

export default LoadingState;
