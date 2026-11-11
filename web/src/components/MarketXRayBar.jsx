import React from 'react';
import { Layers, BarChart2 } from 'lucide-react';

export default function MarketXRayBar({ xrayData }) {
  if (!xrayData) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-900/30 px-4 py-3 text-center text-[11px] text-slate-500">
        Waiting for live market snapshot…
      </div>
    );
  }

  const {
    advancing = 0,
    declining = 0,
    neutral = 0,
    advanceDeclineRatio = 0,
    bullishSetupsCount = 0,
    bearishSetupsCount = 0,
    sectors = []
  } = xrayData;

  const total = advancing + declining + neutral || 1;
  const advPct = Math.round((advancing / total) * 100);
  const decPct = Math.round((declining / total) * 100);

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-500">Order blocks</div>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold font-mono">
              <span className="text-emerald-400">{bullishSetupsCount} up</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400">{bearishSetupsCount} down</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
              <span>Breadth · A/D {advanceDeclineRatio}</span>
              <span className="font-mono text-slate-400">
                {advancing}/{declining}
              </span>
            </div>
            <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div style={{ width: `${advPct}%` }} className="bg-emerald-500 transition-all" />
              <div style={{ width: `${decPct}%` }} className="bg-rose-500 transition-all" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2.5 overflow-hidden">
          <div className="text-[10px] font-medium text-slate-500 mb-1.5">Top sectors</div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(sectors || []).slice(0, 5).map((sec) => (
              <span
                key={sec.name}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  sec.avgChange >= 0
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                }`}
              >
                {sec.name}{' '}
                <span className="font-mono">
                  {sec.avgChange >= 0 ? `+${sec.avgChange}%` : `${sec.avgChange}%`}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
