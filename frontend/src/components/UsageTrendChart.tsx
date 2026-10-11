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
    <div className="bg-[#121214] border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold block">
            Telemetry Time-Series • {accountName}
          </span>
          <h4 className="text-base font-bold text-white font-headline flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span>Active Seat Usage Contraction vs Baseline</span>
          </h4>
        </div>
        <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2.5 py-1 rounded-md self-start sm:self-auto">
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
                  isCritical ? 'text-rose-400' : isBaseline ? 'text-emerald-400' : 'text-zinc-300'
                }`}>
                  {w.seats}
                </span>

                {/* Vertical Bar */}
                <div className="w-full max-w-[48px] bg-zinc-900 rounded-t-lg overflow-hidden flex items-end h-full p-0.5 border border-zinc-800">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isCritical
                        ? 'bg-linear-to-t from-rose-600 to-rose-400 shadow-lg shadow-rose-950'
                        : isBaseline
                        ? 'bg-linear-to-t from-emerald-600 to-emerald-400'
                        : 'bg-linear-to-t from-blue-600 to-blue-400'
                    }`}
                  />
                </div>

                {/* X-axis Label */}
                <span className="text-xs font-medium text-zinc-400 mt-2 block">
                  {w.label}
                </span>
                <span className={`text-[10px] font-mono mt-0.5 ${
                  isCritical ? 'text-rose-400 font-bold' : 'text-zinc-500'
                }`}>
                  {w.pct}
                </span>
              </div>
            );
          })}
        </div>

        {/* Baseline Legend */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Contract Baseline: {baselineSeats} seats
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Current Activity: {currentSeats} seats
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Source: Ingested Product Telemetry
          </span>
        </div>
      </div>
    </div>
  );
}

export default UsageTrendChart;
