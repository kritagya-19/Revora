import { TrendingDown } from 'lucide-react';

interface UsageTrendChartProps {
  accountName?: string;
  baselineSeats?: number;
  currentSeats?: number;
  dropPct?: number;
}

export function UsageTrendChart({
  accountName = 'Acme Technologies',
  baselineSeats = 240,
  currentSeats = 148,
  dropPct = 38
}: UsageTrendChartProps) {
  const weeks = [
    { label: 'Week -3', seats: baselineSeats, pct: '100% (Baseline)', status: 'baseline' },
    { label: 'Week -2', seats: 215, pct: '-10% drop', status: 'mild' },
    { label: 'Week -1', seats: 178, pct: '-26% drop', status: 'elevated' },
    { label: 'Current', seats: currentSeats, pct: `-${dropPct}% contraction`, status: 'critical' }
  ];

  const maxSeats = Math.max(baselineSeats, 250);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#0025AE] font-bold block">
            Telemetry Time-Series • {accountName}
          </span>
          <h4 className="text-base font-normal text-[#020062] font-headline flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>Active Seat Usage Contraction vs Baseline</span>
          </h4>
        </div>
        <span className="text-xs font-mono font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md self-start sm:self-auto">
          -{dropPct}% Below Baseline
        </span>
      </div>

      {/* SVG Line / Bar Visualization */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3 items-end h-36 pt-4 px-2">
          {weeks.map((w, idx) => {
            const heightPct = Math.round((w.seats / maxSeats) * 100);
            const isCritical = w.status === 'critical';
            const isBaseline = w.status === 'baseline';

            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end group">
                <span className={`text-[11px] font-mono font-bold mb-1.5 transition-colors ${
                  isCritical ? 'text-rose-700' : isBaseline ? 'text-emerald-700' : 'text-slate-600'
                }`}>
                  {w.seats}
                </span>

                {/* Vertical Bar */}
                <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-full p-0.5 border border-[#E2E8F0]">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isCritical
                        ? 'bg-rose-500 shadow-xs'
                        : isBaseline
                        ? 'bg-emerald-500'
                        : 'bg-[#2563EB]'
                    }`}
                  />
                </div>

                {/* X-axis Label */}
                <span className="text-xs font-medium text-slate-600 mt-2 block">
                  {w.label}
                </span>
                <span className={`text-[10px] font-mono mt-0.5 ${
                  isCritical ? 'text-rose-700 font-bold' : 'text-slate-400'
                }`}>
                  {w.pct}
                </span>
              </div>
            );
          })}
        </div>

        {/* Baseline Legend */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Contract Baseline: <strong className="text-[#020062]">{baselineSeats} seats</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Current Activity: <strong className="text-[#020062]">{currentSeats} seats</strong>
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Source: Ingested Product Telemetry
          </span>
        </div>
      </div>
    </div>
  );
}

export default UsageTrendChart;
