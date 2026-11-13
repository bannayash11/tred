import React, { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Search,
  ExternalLink,
  Shrink,
  Ban,
  RefreshCw
} from 'lucide-react';
import { fetchDirectionalScanner } from '../services/api';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';

const EMPTY = {
  bullish: [],
  bearish: [],
  compressed: [],
  rejected: [],
  stats: {},
  settings: {},
  timestamp: null
};

function ScorePill({ score }) {
  const n = Number(score) || 0;
  const tone =
    n >= 75
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : n >= 55
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700';
  return (
    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold font-mono ${tone}`}>
      {n.toFixed(0)}
    </span>
  );
}

function Metric({ label, value, tone = 'text-slate-200' }) {
  return (
    <span className="text-[10px] text-slate-500 font-mono">
      {label} <span className={`font-semibold ${tone}`}>{value}</span>
    </span>
  );
}

function StockTable({
  rows,
  emptyText,
  accent = 'emerald',
  onSelectStock,
  liveUpdatedSymbols,
  showDirection = false
}) {
  const rankTone =
    accent === 'rose'
      ? 'bg-rose-500/20 text-rose-300'
      : accent === 'amber'
        ? 'bg-amber-500/20 text-amber-300'
        : accent === 'slate'
          ? 'bg-slate-700 text-slate-200'
          : 'bg-emerald-500/20 text-emerald-300';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-2 px-2">#</th>
            <th className="py-2 px-2">Stock</th>
            <th className="py-2 px-2 text-right">LTP</th>
            <th className="py-2 px-2 text-right">Score</th>
            <th className="py-2 px-2 text-right">ER</th>
            <th className="py-2 px-2 text-right">RVOL</th>
            <th className="py-2 px-2 text-right">ATR×</th>
            <th className="py-2 px-2 text-right">ADX</th>
            <th className="py-2 px-2 text-center">Chart</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40 font-mono">
          {rows.length === 0 ? (
            <tr>
              <td colSpan="9" className="py-8 text-center text-slate-500 font-sans">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((stock) => {
              const live = liveUpdatedSymbols?.has?.(stock.symbol);
              return (
                <tr
                  key={`${stock.status}-${stock.symbol}`}
                  onClick={() => onSelectStock?.(stock.symbol)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${live ? 'bg-cyan-500/5' : ''}`}
                >
                  <td className="py-2.5 px-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${rankTone}`}>
                      {stock.rank}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-sans">
                    <div className="font-bold text-white flex items-center gap-1">
                      <span>{stock.symbol}</span>
                      {showDirection && (
                        <span className={`text-[9px] ${stock.direction === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stock.direction === 'BULLISH' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{stock.name}</div>
                    {stock.reason && (
                      <div className="text-[9px] text-slate-600 truncate max-w-[180px] mt-0.5">{stock.reason}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold text-white">
                    ₹{Number(stock.ltp || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <ScorePill score={stock.score} />
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-200">{Number(stock.efficiency || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={Number(stock.rvol) >= 1.5 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                      {Number(stock.rvol || 0).toFixed(2)}x
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-300">{Number(stock.rangeRatio || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-slate-300">
                    {stock.adx == null ? '—' : Number(stock.adx).toFixed(0)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock?.(stock.symbol);
                      }}
                      className="rounded-lg bg-slate-800/80 p-1.5 text-slate-300 hover:text-white hover:bg-slate-700"
                      title="Open chart"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DirectionalScannerBoard({
  onSelectStock,
  liveUpdatedSymbols = new Set(),
  user,
  onOpenPricing,
  brand = 'AlphaMove',
  subtitle = 'ATR baseline · chop filter · ranked F&O edge',
  accentIcon: AccentIcon = Crosshair
}) {
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [panel, setPanel] = useState('MAIN'); // MAIN | COMPRESSED | REJECTED
  const [topCount, setTopCount] = useState(10);
  const [rejectEr, setRejectEr] = useState(0.2);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetchDirectionalScanner({
        topCount,
        rejectEfficiencyBelow: rejectEr
      });
      if (res?.success && res.data) {
        setData(res.data);
        setError('');
      } else {
        setError(res?.message || 'Failed to load scanner');
      }
    } catch (err) {
      setError(err?.userMessage || err?.response?.data?.message || 'Failed to load scanner');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      await load({ silent: true });
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topCount, rejectEr]);

  const sectors = useMemo(() => {
    const set = new Set(['ALL']);
    [...(data.bullish || []), ...(data.bearish || []), ...(data.compressed || [])].forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return Array.from(set);
  }, [data]);

  const filterRows = (list = []) =>
    list.filter((item) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.symbol.toLowerCase().includes(q) ||
        String(item.name || '')
          .toLowerCase()
          .includes(q);
      const matchSector = selectedSector === 'ALL' || item.sector === selectedSector;
      return matchSearch && matchSector;
    });

  const bullish = filterRows(data.bullish);
  const bearish = filterRows(data.bearish);
  const compressed = filterRows(data.compressed);
  const rejected = filterRows(data.rejected);
  const stats = data.stats || {};

  const maxVisible = membership.maxStocksVisible || 200;
  const displayBullish = bullish.slice(0, Math.min(topCount, maxVisible));
  const displayBearish = bearish.slice(0, Math.min(topCount, maxVisible));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <AccentIcon className="h-4 w-4 text-cyan-400 shrink-0" />
            <div>
              <h2 className="text-[13px] font-semibold text-white leading-tight">{brand}</h2>
              <p className="text-[10px] text-slate-500">{subtitle}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
            <Metric label="Scanned" value={stats.totalScanned || 0} />
            <Metric label="Passed" value={stats.passed || 0} tone="text-emerald-400" />
            <Metric label="Rejected" value={stats.rejected || 0} tone="text-rose-400" />
            <Metric label="Compressed" value={stats.compressed || 0} tone="text-amber-300" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-slate-500">
              Top
              <select
                value={topCount}
                onChange={(e) => setTopCount(Number(e.target.value))}
                className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[10px] text-slate-500">
              Min ER
              <select
                value={rejectEr}
                onChange={(e) => setRejectEr(Number(e.target.value))}
                className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
              >
                {[0.15, 0.2, 0.25, 0.3].map((n) => (
                  <option key={n} value={n}>
                    {n.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search symbol or name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-slate-950/80 py-2 pl-9 pr-3 text-[12px] font-medium text-slate-100 placeholder-slate-500 border border-slate-800 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>

        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
          {[
            { id: 'MAIN', label: 'Bull / Bear' },
            { id: 'COMPRESSED', label: 'Compressed' },
            { id: 'REJECTED', label: 'Rejected' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPanel(tab.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                panel === tab.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {sectors.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSector(sec)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                selectedSector === sec
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                  : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-[12px] text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-slate-500 text-sm">
          Building {brand} rankings from live 5m candles…
        </div>
      ) : panel === 'MAIN' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-950/70 bg-gradient-to-b from-[#0a1512] to-slate-950/90 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-emerald-400">Bullish opportunities</h3>
                  <p className="text-[10px] text-slate-500">Ranked by directional score</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-800/60">
                {displayBullish.length}
              </span>
            </div>
            <StockTable
              rows={displayBullish}
              emptyText="No bullish directional setups right now."
              accent="emerald"
              onSelectStock={onSelectStock}
              liveUpdatedSymbols={liveUpdatedSymbols}
            />
          </div>

          <div className="rounded-2xl border border-rose-950/70 bg-gradient-to-b from-[#180b0e] to-slate-950/90 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-rose-400">Bearish opportunities</h3>
                  <p className="text-[10px] text-slate-500">Ranked by directional score</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-950/80 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-800/60">
                {displayBearish.length}
              </span>
            </div>
            <StockTable
              rows={displayBearish}
              emptyText="No bearish directional setups right now."
              accent="rose"
              onSelectStock={onSelectStock}
              liveUpdatedSymbols={liveUpdatedSymbols}
            />
          </div>
        </div>
      ) : panel === 'COMPRESSED' ? (
        <div className="rounded-2xl border border-amber-950/60 bg-gradient-to-b from-[#17120a] to-slate-950/90 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-amber-900/30 pb-2">
            <Shrink className="h-4 w-4 text-amber-300" />
            <div>
              <h3 className="text-sm font-bold text-amber-300">Compression watchlist</h3>
              <p className="text-[10px] text-slate-500">Low activity / tight range — possible expansion later</p>
            </div>
          </div>
          <StockTable
            rows={compressed}
            emptyText="No compressed names matching filters."
            accent="amber"
            onSelectStock={onSelectStock}
            liveUpdatedSymbols={liveUpdatedSymbols}
            showDirection
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Ban className="h-4 w-4 text-slate-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-200">Rejected (choppy)</h3>
              <p className="text-[10px] text-slate-500">Failed primary efficiency filter</p>
            </div>
          </div>
          <StockTable
            rows={rejected}
            emptyText="No rejected names matching filters."
            accent="slate"
            onSelectStock={onSelectStock}
            liveUpdatedSymbols={liveUpdatedSymbols}
            showDirection
          />
        </div>
      )}

      {!membership.allowTerminal && (
        <button
          type="button"
          onClick={() => onOpenPricing?.()}
          className="text-[11px] text-cyan-400 hover:underline"
        >
          Upgrade for full live access
        </button>
      )}
    </div>
  );
}
