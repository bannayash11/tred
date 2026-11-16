import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Sparkles,
  Maximize2,
  Lock
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';

/** Extra tokens so casual queries like "nifty fifty" / "bank nifty" hit universe symbols. */
const SYMBOL_ALIASES = {
  'NIFTY 50': ['nifty', 'nifty 50', 'nifty50', 'nifty fifty', 'niftyfifty'],
  BANKNIFTY: ['bank nifty', 'banknifty', 'bank-nifty', 'bnf', 'bank nifty index']
};

function normalizeQuery(q) {
  return String(q || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchesStockSearch(item, rawQuery) {
  const q = normalizeQuery(rawQuery);
  if (!q) return true;
  const symbol = String(item.symbol || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  if (symbol.includes(q) || name.includes(q)) return true;
  const aliases = SYMBOL_ALIASES[item.symbol] || [];
  return aliases.some((a) => a.includes(q) || q.includes(a));
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n >= 0 ? `+${n}%` : `${n}%`;
}

export default function ScreenerBoard({
  screenerData,
  onSelectStock,
  liveUpdatedSymbols = new Set(),
  user,
  onOpenPricing
}) {
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);
  const allowedTfs = membership.timeframesAllowed.length
    ? membership.timeframesAllowed
    : ['15m'];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [minScore, setMinScore] = useState(60);
  const [timeframe, setTimeframe] = useState(allowedTfs[0] || '15m');

  useEffect(() => {
    if (!allowedTfs.includes(timeframe)) {
      setTimeframe(allowedTfs[0] || '15m');
    }
  }, [allowedTfs.join(','), timeframe]);

  const bullishList = screenerData?.bullishSetups || [];
  const bearishList = screenerData?.bearishSetups || [];
  const allStocks = screenerData?.allStocks || [];
  const hasSearch = Boolean(normalizeQuery(searchTerm));

  const filterSetups = (list) => {
    return list.filter((item) => {
      const matchSearch = matchesStockSearch(item, searchTerm);
      const matchSector = selectedSector === 'ALL' || item.sector === selectedSector;
      const matchScore = item.score >= minScore;
      return matchSearch && matchSector && matchScore;
    });
  };

  const filteredBullish = filterSetups(bullishList);
  const filteredBearish = filterSetups(bearishList);

  const symbolMatches = useMemo(() => {
    if (!hasSearch) return [];
    return allStocks
      .filter((item) => {
        const matchSearch = matchesStockSearch(item, searchTerm);
        const matchSector = selectedSector === 'ALL' || item.sector === selectedSector;
        return matchSearch && matchSector;
      })
      .slice(0, 40);
  }, [allStocks, hasSearch, searchTerm, selectedSector]);

  const indexShortcuts = useMemo(() => {
    const wanted = ['NIFTY 50', 'BANKNIFTY'];
    return wanted
      .map((sym) => allStocks.find((s) => s.symbol === sym))
      .filter(Boolean);
  }, [allStocks]);

  const maxVisible = membership.maxStocksVisible || 200;
  const bullishCap = Math.max(0, Math.ceil(maxVisible / 2));
  const bearishCap = Math.max(0, Math.floor(maxVisible / 2));
  const displayBullish = filteredBullish.slice(0, bullishCap);
  const displayBearish = filteredBearish.slice(0, bearishCap);
  const hiddenCount = Math.max(
    0,
    filteredBullish.length + filteredBearish.length - displayBullish.length - displayBearish.length
  );

  const sectors = [
    'ALL',
    'Indices',
    'Banking',
    'IT',
    'Auto',
    'Energy',
    'Metals',
    'Pharma',
    'Financials'
  ];

  const setupCount = filteredBullish.length + filteredBearish.length;
  const resultCount = hasSearch ? symbolMatches.length : setupCount;

  const emptySetupMessage = hasSearch
    ? 'No active OB setups for this search — try the symbol matches above to open a chart.'
    : selectedSector === 'Indices'
      ? 'No active OB setups for Indices. Use the index shortcuts or search to open a chart.'
      : 'No active OB setups for these filters.';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-2.5 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search symbol or name… (e.g. bank nifty, nifty fifty)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-slate-950/80 py-2 pl-9 pr-3 text-[12px] font-medium text-slate-100 placeholder-slate-500 border border-slate-800 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sectors.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSector(sec)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0 ${
                selectedSector === sec
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                  : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-slate-500">TF</span>
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              {['1m', '5m', '15m'].map((tf) => {
                const allowed = membership.canUseTimeframe(tf);
                return (
                  <button
                    key={tf}
                    type="button"
                    disabled={!allowed}
                    title={allowed ? tf : `Upgrade to unlock ${tf}`}
                    onClick={() => {
                      if (!allowed) {
                        onOpenPricing?.();
                        return;
                      }
                      setTimeframe(tf);
                    }}
                    className={`min-w-[2.25rem] rounded-md px-2 py-1 text-[11px] font-semibold inline-flex items-center justify-center gap-1 ${
                      timeframe === tf
                        ? 'bg-cyan-500 text-black'
                        : allowed
                          ? 'text-slate-400 hover:text-white'
                          : 'text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {!allowed && <Lock className="h-2.5 w-2.5" />}
                    {tf}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
              Min score
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="rounded-md bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-200 border border-slate-800 focus:outline-none"
              >
                <option value={60}>60+</option>
                <option value={75}>75+</option>
                <option value={85}>85+</option>
              </select>
            </label>
            <span className="text-[10px] text-slate-500">
              {resultCount} result{resultCount === 1 ? '' : 's'}
              {hasSearch ? ' · symbols' : ' · setups'}
            </span>
          </div>
        </div>
      </div>

      {/* Index quick-open when not searching */}
      {!hasSearch && indexShortcuts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Indices
          </span>
          {indexShortcuts.map((stock) => {
            const isTick = liveUpdatedSymbols.has(stock.symbol);
            const up = Number(stock.change) >= 0;
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => onSelectStock?.(stock.symbol)}
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  isTick
                    ? 'border-cyan-500/50 bg-cyan-950/30'
                    : 'border-slate-800 bg-slate-900/70 hover:border-cyan-500/40'
                }`}
              >
                <span className="text-[12px] font-bold text-white">{stock.symbol}</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {formatPrice(stock.currentPrice)}
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    up ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatChange(stock.change)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Universe symbol matches while searching */}
      {hasSearch && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[12px] font-semibold text-cyan-300">
              Symbols · {symbolMatches.length}
            </h2>
            <span className="text-[10px] text-slate-500">Open chart (no OB required)</span>
          </div>
          {symbolMatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 px-4 py-5 text-center text-[11px] text-slate-500">
              No symbol match for “{searchTerm.trim()}”. Try nifty, bank nifty, or a ticker.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {symbolMatches.map((stock) => {
                const isTick = liveUpdatedSymbols.has(stock.symbol);
                const up = Number(stock.change) >= 0;
                return (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => onSelectStock?.(stock.symbol)}
                    className={`group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isTick
                        ? 'border-cyan-500/70 bg-cyan-950/20'
                        : 'border-slate-800/80 bg-slate-900/70 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white group-hover:text-cyan-300">
                          {stock.symbol}
                        </span>
                        <span className="rounded-md bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                          {stock.sector}
                        </span>
                      </div>
                      <span className="block truncate text-[10px] text-slate-500">{stock.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-semibold text-white">
                        {formatPrice(stock.currentPrice)}
                      </div>
                      <div
                        className={`font-mono text-[10px] font-semibold ${
                          up ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatChange(stock.change)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Boards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-[12px] font-semibold text-emerald-400">
                Bullish · {filteredBullish.length}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">Demand zones</span>
          </div>

          <div className="space-y-2">
            {filteredBullish.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-[11px] text-slate-500">
                {emptySetupMessage}
              </div>
            ) : (
              displayBullish.map((setup) => {
                const isTick = liveUpdatedSymbols.has(setup.symbol);
                return (
                  <div
                    key={setup.symbol}
                    onClick={() => onSelectStock(setup.symbol)}
                    className={`group relative cursor-pointer rounded-xl border px-3 py-2.5 transition-all duration-200 hover:shadow-md ${isTick
                        ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                        : 'border-slate-800/80 bg-slate-900/70 hover:border-emerald-500/40'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {setup.symbol}
                          </span>
                          <span className="rounded-md bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                            {setup.sector}
                          </span>
                        </div>
                        <span className="block truncate text-[10px] text-slate-500">{setup.name}</span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-xs font-semibold text-white">
                            {formatPrice(setup.currentPrice)}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              setup.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatChange(setup.change)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-end">
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-emerald-400">
                            {setup.score}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/50 px-2.5 py-2 border border-slate-800/50">
                      <div>
                        <div className="text-[10px] text-slate-500">Zone</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-300 truncate">
                          ₹{setup.zoneBottom}–{setup.zoneTop}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Distance</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-200">
                          {setup.distancePercent}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Target</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-cyan-400 truncate">
                          ₹{setup.liquidityTarget}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-emerald-400/90">
                          {setup.testCount === 0 ? 'Fresh' : `Tested ${setup.testCount}×`}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono shrink-0">{setup.volumeRatio}× vol</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0">
                        Chart <Maximize2 className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-[12px] font-semibold text-rose-400">
                Bearish · {filteredBearish.length}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">Supply zones</span>
          </div>

          <div className="space-y-2">
            {filteredBearish.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-[11px] text-slate-500">
                {emptySetupMessage}
              </div>
            ) : (
              displayBearish.map((setup) => {
                const isTick = liveUpdatedSymbols.has(setup.symbol);
                return (
                  <div
                    key={setup.symbol}
                    onClick={() => onSelectStock(setup.symbol)}
                    className={`group relative cursor-pointer rounded-xl border px-3 py-2.5 transition-all duration-200 hover:shadow-md ${isTick
                        ? 'border-rose-500/80 bg-rose-950/20 shadow-md shadow-rose-500/10'
                        : 'border-slate-800/80 bg-slate-900/70 hover:border-rose-500/40'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                            {setup.symbol}
                          </span>
                          <span className="rounded-md bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                            {setup.sector}
                          </span>
                        </div>
                        <span className="block truncate text-[10px] text-slate-500">{setup.name}</span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-xs font-semibold text-white">
                            {formatPrice(setup.currentPrice)}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              setup.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatChange(setup.change)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-end">
                          <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-rose-400">
                            {setup.score}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/50 px-2.5 py-2 border border-slate-800/50">
                      <div>
                        <div className="text-[10px] text-slate-500">Zone</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-rose-300 truncate">
                          ₹{setup.zoneBottom}–{setup.zoneTop}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Distance</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-200">
                          {setup.distancePercent}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Target</div>
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-cyan-400 truncate">
                          ₹{setup.liquidityTarget}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-rose-400/90">
                          {setup.testCount === 0 ? 'Fresh' : `Tested ${setup.testCount}×`}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono shrink-0">{setup.volumeRatio}× vol</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-slate-500 group-hover:text-rose-400 transition-colors shrink-0">
                        Chart <Maximize2 className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {!membership.isPro && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white">
                Showing {displayBullish.length + displayBearish.length} of{' '}
                {filteredBullish.length + filteredBearish.length}
                {hiddenCount > 0 ? ` · ${hiddenCount} locked` : ''}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {membership.label} · TF {membership.timeframesAllowed.join(', ') || '—'} · max{' '}
                {membership.maxStocksVisible}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPricing}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-[11px] font-bold text-black hover:bg-amber-400 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
