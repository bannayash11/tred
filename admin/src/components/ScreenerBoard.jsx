import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Filter,
  Search,
  ExternalLink,
  Target,
  Clock,
  Sparkles,
  Maximize2
} from 'lucide-react';

export default function ScreenerBoard({
  screenerData,
  onSelectStock,
  liveUpdatedSymbols = new Set()
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [minScore, setMinScore] = useState(60);
  const [timeframe, setTimeframe] = useState('5m');

  const bullishList = screenerData?.bullishSetups || [];
  const bearishList = screenerData?.bearishSetups || [];

  const filterSetups = (list) => {
    return list.filter((item) => {
      const matchSearch =
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSector = selectedSector === 'ALL' || item.sector === selectedSector;
      const matchScore = item.score >= minScore;
      return matchSearch && matchSector && matchScore;
    });
  };

  const filteredBullish = filterSetups(bullishList);
  const filteredBearish = filterSetups(bearishList);

  const sectors = ['ALL', 'Banking', 'IT', 'Auto', 'Energy', 'Metals', 'Pharma', 'Financials'];

  return (
    <div className="space-y-5">
      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-md">
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search F&O stocks (e.g. RELIANCE, HDFCBANK)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-slate-950/80 py-2 pl-10 pr-4 text-xs font-medium text-slate-100 placeholder-slate-500 border border-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Sector Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-1">
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                selectedSector === sec
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* Timeframe & Score Filter */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            {['1m', '5m', '15m'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                  timeframe === tf ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5 text-slate-400">
            <span className="text-[11px]">Min Score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="rounded-lg bg-slate-950 px-2 py-1 text-[11px] font-mono text-cyan-400 border border-slate-800 focus:outline-none"
            >
              <option value={60}>60+</option>
              <option value={75}>75+ (High Quality)</option>
              <option value={85}>85+ (Institutional Prime)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Dual Boards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= BULLISH BOARD ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                Bullish Order Blocks ({filteredBullish.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Institutional Demand Zones</span>
          </div>

          <div className="space-y-3">
            {filteredBullish.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                No bullish setups matching the current filters.
              </div>
            ) : (
              filteredBullish.map((setup) => {
                const isTick = liveUpdatedSymbols.has(setup.symbol);
                return (
                  <div
                    key={setup.symbol}
                    onClick={() => onSelectStock(setup.symbol)}
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl ${
                      isTick
                        ? 'border-emerald-500/80 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-800/80 bg-slate-900/70 hover:border-emerald-500/40'
                    }`}
                  >
                    {/* Top Row: Symbol, Price, Score */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-base font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                              {setup.symbol}
                            </span>
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/50">
                              {setup.sector}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{setup.name}</span>
                        </div>
                      </div>

                      {/* Quality Score & Price */}
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-mono text-sm font-bold text-white">
                            ₹{setup.currentPrice.toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`font-mono text-xs font-semibold ${
                              setup.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {setup.change >= 0 ? `+${setup.change}%` : `${setup.change}%`}
                          </span>
                        </div>
                        {/* Score Pill */}
                        <div className="mt-1 flex items-center justify-end space-x-1">
                          <span className="rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-800/50 shadow-sm">
                            ★ {setup.score}/100 Quality
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Zone Box Metrics */}
                    <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/70 p-2.5 border border-slate-800/60 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Order Block Zone</div>
                        <div className="font-mono font-semibold text-emerald-300">
                          ₹{setup.zoneBottom} - ₹{setup.zoneTop}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400">Distance to Zone</div>
                        <div className="font-mono font-semibold text-slate-200">
                          {setup.distancePercent}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400">Liquidity Target</div>
                        <div className="font-mono font-semibold text-cyan-400">
                          ₹{setup.liquidityTarget}
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Structure status & View Chart */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center text-emerald-400 font-medium">
                          <Sparkles className="mr-1 h-3 w-3" />
                          {setup.testCount === 0 ? 'Fresh Untouched Zone' : `Tested ${setup.testCount}x`}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{setup.volumeRatio}x Vol Surge</span>
                      </div>

                      <button className="flex items-center space-x-1 text-slate-400 group-hover:text-emerald-400 transition-colors font-medium">
                        <span>View Chart</span>
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= BEARISH BOARD ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-rose-900/40 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800/50">
                <TrendingDown className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                Bearish Order Blocks ({filteredBearish.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Institutional Supply Zones</span>
          </div>

          <div className="space-y-3">
            {filteredBearish.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                No bearish setups matching the current filters.
              </div>
            ) : (
              filteredBearish.map((setup) => {
                const isTick = liveUpdatedSymbols.has(setup.symbol);
                return (
                  <div
                    key={setup.symbol}
                    onClick={() => onSelectStock(setup.symbol)}
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl ${
                      isTick
                        ? 'border-rose-500/80 bg-rose-950/20 shadow-lg shadow-rose-500/10'
                        : 'border-slate-800/80 bg-slate-900/70 hover:border-rose-500/40'
                    }`}
                  >
                    {/* Top Row: Symbol, Price, Score */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-base font-extrabold text-white group-hover:text-rose-400 transition-colors">
                              {setup.symbol}
                            </span>
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/50">
                              {setup.sector}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{setup.name}</span>
                        </div>
                      </div>

                      {/* Quality Score & Price */}
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-mono text-sm font-bold text-white">
                            ₹{setup.currentPrice.toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`font-mono text-xs font-semibold ${
                              setup.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {setup.change >= 0 ? `+${setup.change}%` : `${setup.change}%`}
                          </span>
                        </div>
                        {/* Score Pill */}
                        <div className="mt-1 flex items-center justify-end space-x-1">
                          <span className="rounded-md bg-rose-950/80 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-800/50 shadow-sm">
                            ★ {setup.score}/100 Quality
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Zone Box Metrics */}
                    <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/70 p-2.5 border border-slate-800/60 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Order Block Zone</div>
                        <div className="font-mono font-semibold text-rose-300">
                          ₹{setup.zoneBottom} - ₹{setup.zoneTop}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400">Distance to Zone</div>
                        <div className="font-mono font-semibold text-slate-200">
                          {setup.distancePercent}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400">Liquidity Target</div>
                        <div className="font-mono font-semibold text-cyan-400">
                          ₹{setup.liquidityTarget}
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Structure status & View Chart */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center text-rose-400 font-medium">
                          <Sparkles className="mr-1 h-3 w-3" />
                          {setup.testCount === 0 ? 'Fresh Untouched Zone' : `Tested ${setup.testCount}x`}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{setup.volumeRatio}x Vol Surge</span>
                      </div>

                      <button className="flex items-center space-x-1 text-slate-400 group-hover:text-rose-400 transition-colors font-medium">
                        <span>View Chart</span>
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
