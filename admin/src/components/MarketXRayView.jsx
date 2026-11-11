import React from 'react';
import { Activity, Layers, TrendingUp, TrendingDown, Flame, BarChart3 } from 'lucide-react';

export default function MarketXRayView({ xrayData, onSelectStock }) {
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

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center">
            <Activity className="mr-2 h-6 w-6 text-cyan-400" />
            Market X-Ray & Institutional Macro Flow
          </h1>
          <p className="text-xs text-slate-400">
            Real-time sector rotation, market breadth distribution, and Smart Money momentum.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Auto-Refreshes every 2s</span>
        </div>
      </div>

      {/* Macro Breadth Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Gauge */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Market Sentiment Gauge
          </span>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-extrabold ${
                advancing >= declining ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {advancing >= declining ? 'BULLISH DISTRIBUTION' : 'BEARISH DISTRIBUTION'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {advancing} stocks advancing vs {declining} declining across tracked NSE F&O universe.
          </p>
        </div>

        {/* Advance/Decline Ratio */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Advance / Decline Ratio
          </span>
          <div className="text-3xl font-extrabold font-mono text-cyan-400">
            {advanceDeclineRatio} : 1.0
          </div>
          <p className="text-xs text-slate-400">
            Strength ratio indicator for institutional participation.
          </p>
        </div>

        {/* Order Block Density */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Order Block Density
          </span>
          <div className="flex items-center space-x-4 text-2xl font-mono font-extrabold">
            <span className="text-emerald-400">{bullishSetupsCount} Bullish</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400">{bearishSetupsCount} Bearish</span>
          </div>
          <p className="text-xs text-slate-400">
            High quality demand & supply zones formed within active market sessions.
          </p>
        </div>
      </div>

      {/* Sector Heatmap Breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center">
            <BarChart3 className="mr-2 h-4 w-4 text-cyan-400" />
            Sector Performance & Capital Flow Map
          </h2>
          <span className="text-xs text-slate-400">Sorted by Relative Strength</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(sectors || []).map((sec) => (
            <div
              key={sec.name}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                sec.avgChange >= 0
                  ? 'border-emerald-900/40 bg-emerald-950/20 hover:border-emerald-500/50'
                  : 'border-rose-900/40 bg-rose-950/20 hover:border-rose-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{sec.name}</h3>
                  <span className="text-[11px] text-slate-400">{sec.count} Stocks Active</span>
                </div>
                <div
                  className={`font-mono text-base font-extrabold ${
                    sec.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sec.avgChange >= 0 ? `+${sec.avgChange}%` : `${sec.avgChange}%`}
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  style={{ width: `${Math.min(Math.abs(sec.avgChange) * 40, 100)}%` }}
                  className={`h-full ${sec.avgChange >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
