import React from 'react';
import { TrendingUp, TrendingDown, Layers, BarChart2, CheckCircle2 } from 'lucide-react';

export default function MarketXRayBar({ xrayData }) {
  if (!xrayData) return null;

  const {
    advancing = 0,
    declining = 0,
    neutral = 0,
    totalStocks = 0,
    advanceDeclineRatio = 1,
    sectors = [],
    bullishSetupsCount = 0,
    bearishSetupsCount = 0
  } = xrayData;

  const total = advancing + declining + neutral || 1;
  const advPct = Math.round((advancing / total) * 100);
  const decPct = Math.round((declining / total) * 100);

  return (
    <div className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Metric 1: Order Block Distribution */}
        <div className="flex items-center space-x-3.5 rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Live Order Blocks</div>
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-emerald-400 font-bold text-sm">
                ▲ {bullishSetupsCount} Bullish
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 font-bold text-sm">
                ▼ {bearishSetupsCount} Bearish
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: Advance / Decline Ratio */}
        <div className="flex items-center space-x-3.5 rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-400">
              <span>Breadth (A/D: {advanceDeclineRatio})</span>
              <span>{advancing} Adv / {declining} Dec</span>
            </div>
            {/* Split Bar */}
            <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div style={{ width: `${advPct}%` }} className="bg-emerald-500 transition-all duration-500"></div>
              <div style={{ width: `${decPct}%` }} className="bg-rose-500 transition-all duration-500"></div>
            </div>
          </div>
        </div>

        {/* Metric 3: Leading Sectors */}
        <div className="md:col-span-2 flex items-center space-x-3 rounded-xl bg-slate-950/60 p-3 border border-slate-800/60 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            Sectors:
          </span>
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-0.5">
            {(sectors || []).slice(0, 5).map((sec) => (
              <div
                key={sec.name}
                className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-mono shrink-0 border ${
                  sec.avgChange >= 0
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                }`}
              >
                <span className="font-sans font-medium text-slate-300">{sec.name}</span>
                <span className="font-bold">
                  {sec.avgChange >= 0 ? `+${sec.avgChange}%` : `${sec.avgChange}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
