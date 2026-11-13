import React, { useState, useEffect } from 'react';
import {
  Zap,
  Lock,
  TrendingUp,
  TrendingDown,
  Flame,
  Search,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Scale
} from 'lucide-react';
import { fetchOpeningMomentum, getSocket } from '../services/api';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';

export default function OpeningMomentumScanner({
  onSelectStock,
  liveUpdatedSymbols = new Set(),
  user,
  onOpenPricing
}) {
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState({
    gainers: [],
    losers: [],
    stats: {},
    isFrozen: false,
    frozenAt: null,
    freezeTime: '09:20'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [viewMode, setViewMode] = useState('ALL'); // 'ALL' | 'BREAKOUTS' | 'HIGH_RVOL'
  const [activeTab, setActiveTab] = useState('DUAL'); // 'DUAL' | 'GAINERS' | 'LOSERS'

  useEffect(() => {
    let isMounted = true;

    // Fetch initial REST snapshot
    fetchOpeningMomentum()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setData(res.data);
          setLoadError('');
          setLoading(false);
        } else if (isMounted) {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching opening momentum:', err);
        if (isMounted) {
          setLoadError(err.userMessage || 'Could not load opening momentum.');
          setLoading(false);
        }
      });

    // Listen to real-time socket ticks
    const socket = getSocket();
    const handleMomentumTick = (payload) => {
      if (isMounted && payload) {
        setData(payload);
        setLoadError('');
        setLoading(false);
      }
    };

    socket.on('OPENING_MOMENTUM', handleMomentumTick);

    return () => {
      isMounted = false;
      socket.off('OPENING_MOMENTUM', handleMomentumTick);
    };
  }, []);

  const sectors = ['ALL', 'Banking', 'IT', 'Auto', 'Energy', 'Metals', 'Pharma', 'Financials'];

  const filterList = (list = []) => {
    return list.filter((item) => {
      const matchSearch =
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSector = selectedSector === 'ALL' || item.sector === selectedSector;

      let matchMode = true;
      if (viewMode === 'BREAKOUTS') {
        matchMode = item.status === 'BREAKOUT' || item.status === 'BREAKDOWN';
      } else if (viewMode === 'HIGH_RVOL') {
        matchMode = item.rvol >= 1.5;
      }

      return matchSearch && matchSector && matchMode;
    });
  };

  const filteredGainers = filterList(data.gainers || []);
  const filteredLosers = filterList(data.losers || []);

  // Display complete Top 10 rankings without clipping
  const displayGainers = filteredGainers;
  const displayLosers = filteredLosers;

  const formatFreezeTime = (iso) => {
    if (!iso) return '09:20:00 AM IST';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' IST';
    } catch {
      return '09:20:00 AM IST';
    }
  };

  // 5-Minute F&O Market Breadth calculated against 09:20 Reference Close
  const breadth = data.breadth || data.stats?.breadth || (() => {
    const gainers = data.gainers || [];
    const losers = data.losers || [];
    const adv = gainers.length;
    const dec = losers.length;
    const total = data.stats?.totalTracked || (adv + dec) || 35;
    const unc = Math.max(0, total - (adv + dec));
    const diff = adv - dec;
    const ratio = dec > 0 ? parseFloat((adv / dec).toFixed(2)) : (adv > 0 ? adv : 1.0);
    return {
      advances: adv,
      declines: dec,
      unchanged: unc,
      total,
      adDifference: diff,
      adRatio: ratio,
      advancePercent: total > 0 ? Math.round((adv / total) * 100) : 50,
      declinePercent: total > 0 ? Math.round((dec / total) * 100) : 50,
      unchangedPercent: total > 0 ? Math.round((unc / total) * 100) : 0,
      sentiment: ratio >= 1.25 ? 'STRONG_BULLISH' : ratio <= 0.75 ? 'STRONG_BEARISH' : 'NEUTRAL',
      sentimentLabel: ratio >= 1.25 ? 'Bullish Expansion' : ratio <= 0.75 ? 'Bearish Distribution' : 'Balanced Breadth',
      advanceVolumeRatio: 1.0
    };
  })();

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-rose-800/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          {loadError}
        </div>
      )}
      {/* Compact scanner summary — single dense strip */}
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <h2 className="text-[12px] font-semibold text-white">5m Momentum</h2>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono ml-auto sm:ml-0">
            <span className="text-slate-500">Universe <span className="text-white font-semibold">{data.stats?.totalTracked || 35}</span></span>
            <span className="text-slate-500">Avg up <span className="text-emerald-400 font-semibold">{data.stats?.avgGainerMove || '+0.00%'}</span></span>
            <span className="text-slate-500">Avg down <span className="text-rose-400 font-semibold">{data.stats?.avgLoserMove || '-0.00%'}</span></span>
          </div>
          <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
            <Lock className="h-3 w-3 text-cyan-400" />
            <span className="font-mono text-cyan-300">
              {data.isFrozen ? formatFreezeTime(data.frozenAt) : '09:20'}
            </span>
          </div>
        </div>
      </div>

      {/* Compact breadth — single dense strip */}
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-cyan-400" />
            <h3 className="text-[12px] font-semibold text-white">Market breadth</h3>
            <span className="text-[10px] text-slate-500 font-mono">vs 09:20</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
            <span className="text-slate-500">
              A/D <span className="text-white font-semibold">{breadth.adRatio}</span>
              <span className={`ml-1 ${breadth.adDifference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {breadth.adDifference >= 0 ? `+${breadth.adDifference}` : breadth.adDifference}
              </span>
            </span>
            <span className="text-slate-500">
              Adv <span className="text-emerald-400 font-semibold">{breadth.advances}</span>
              <span className="text-emerald-400/70 ml-0.5">{breadth.advancePercent}%</span>
            </span>
            <span className="text-slate-500">
              Dec <span className="text-rose-400 font-semibold">{breadth.declines}</span>
              <span className="text-rose-400/70 ml-0.5">{breadth.declinePercent}%</span>
            </span>
          </div>
          <span
            className={`ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold border ${
              breadth.sentiment === 'STRONG_BULLISH' || breadth.sentiment === 'MILD_BULLISH'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                : breadth.sentiment === 'STRONG_BEARISH' || breadth.sentiment === 'MILD_BEARISH'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700'
            }`}
          >
            {breadth.sentimentLabel || 'Balanced'}
          </span>
        </div>
        <div className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div style={{ width: `${breadth.advancePercent}%` }} className="bg-emerald-500 transition-all" />
          {breadth.unchanged > 0 && (
            <div style={{ width: `${breadth.unchangedPercent}%` }} className="bg-slate-600 transition-all" />
          )}
          <div style={{ width: `${breadth.declinePercent}%` }} className="bg-rose-500 transition-all" />
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-md">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search F&O stocks (e.g. RELIANCE, HDFCBANK)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-slate-950/80 py-2 pl-10 pr-4 text-xs font-medium text-slate-100 placeholder-slate-500 border border-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('ALL')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${viewMode === 'ALL'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            All Movers
          </button>
          <button
            type="button"
            onClick={() => setViewMode('BREAKOUTS')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${viewMode === 'BREAKOUTS'
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Breakouts Only
          </button>
          <button
            type="button"
            onClick={() => setViewMode('HIGH_RVOL')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${viewMode === 'HIGH_RVOL'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            High RVOL (&ge;1.5x)
          </button>
        </div>

        {/* Sector Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-1">
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0 ${selectedSector === sec
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-950'
                }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Board: Top Gainers & Top Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Bullish Gainers Board */}
        <div className="rounded-3xl border border-emerald-950/70 bg-gradient-to-b from-[#0a1512] to-slate-950/90 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-1.5">
                  <span className="text-emerald-400">TOP 10 GAINERS</span>
                  <span className="text-xs text-slate-400 font-normal">· Bullish Velocity</span>
                </h3>
                <div className="text-[10px] text-slate-400">
                  Ranked by % move from 09:20 Reference Close
                </div>
              </div>
            </div>

            <span className="rounded-full bg-emerald-950/80 px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 border border-emerald-800/60">
              {displayGainers.length} Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Stock</th>
                  <th className="py-2.5 px-2 text-right">LTP</th>
                  <th className="py-2.5 px-2 text-right">09:20 Close</th>
                  <th className="py-2.5 px-2 text-right">From 9:20</th>
                  <th className="py-2.5 px-2 text-center">RVOL</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {displayGainers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                      No bullish momentum stocks matching the current filter.
                    </td>
                  </tr>
                ) : (
                  displayGainers.map((stock) => {
                    const isTickActive = liveUpdatedSymbols.has(stock.symbol);
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${isTickActive ? 'bg-emerald-500/10' : ''
                          }`}
                      >
                        <td className="py-3 px-2 font-bold">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${stock.rank === 1
                                ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/30'
                                : stock.rank <= 3
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                          >
                            {stock.rank}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-sans">
                          <div className="font-extrabold text-white flex items-center space-x-1">
                            <span>{stock.symbol}</span>
                            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {stock.name}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-white">
                          ₹{stock.ltp?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-400 text-[11px]">
                          ₹{stock.refClose?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-extrabold text-emerald-400 text-xs sm:text-sm">
                            +{stock.movementPercent?.toFixed(2)}%
                          </div>
                          <div className="text-[10px] text-emerald-500/80">
                            +₹{stock.pointsChange?.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${stock.rvol >= 1.5
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'text-slate-400 bg-slate-900'
                              }`}
                          >
                            {stock.rvol}x
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-sans">
                          <span
                            className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${stock.status === 'BREAKOUT'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                          >
                            {stock.status === 'BREAKOUT' ? (
                              <>
                                <Flame className="h-2.5 w-2.5 text-emerald-400" />
                                <span>5M BREAKOUT</span>
                              </>
                            ) : (
                              <span>INSIDE 5M</span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectStock) onSelectStock(stock.symbol);
                            }}
                            className="rounded-lg bg-slate-800/80 p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Open TradingView Chart"
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
        </div>

        {/* Top Bearish Losers Board */}
        <div className="rounded-3xl border border-rose-950/70 bg-gradient-to-b from-[#180b0e] to-slate-950/90 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <TrendingDown className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-1.5">
                  <span className="text-rose-400">TOP 10 LOSERS</span>
                  <span className="text-xs text-slate-400 font-normal">· Bearish Velocity</span>
                </h3>
                <div className="text-[10px] text-slate-400">
                  Ranked by negative % move from 09:20 Reference Close
                </div>
              </div>
            </div>

            <span className="rounded-full bg-rose-950/80 px-2.5 py-1 text-xs font-mono font-bold text-rose-400 border border-rose-800/60">
              {displayLosers.length} Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Stock</th>
                  <th className="py-2.5 px-2 text-right">LTP</th>
                  <th className="py-2.5 px-2 text-right">09:20 Close</th>
                  <th className="py-2.5 px-2 text-right">From 9:20</th>
                  <th className="py-2.5 px-2 text-center">RVOL</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {displayLosers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                      No bearish momentum stocks matching the current filter.
                    </td>
                  </tr>
                ) : (
                  displayLosers.map((stock) => {
                    const isTickActive = liveUpdatedSymbols.has(stock.symbol);
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${isTickActive ? 'bg-rose-500/10' : ''
                          }`}
                      >
                        <td className="py-3 px-2 font-bold">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${stock.rank === 1
                                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                                : stock.rank <= 3
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'text-slate-500'
                              }`}
                          >
                            {stock.rank}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-sans">
                          <div className="font-extrabold text-white flex items-center space-x-1">
                            <span>{stock.symbol}</span>
                            <ArrowDownRight className="h-3 w-3 text-rose-400" />
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {stock.name}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-white">
                          ₹{stock.ltp?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-400 text-[11px]">
                          ₹{stock.refClose?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-extrabold text-rose-400 text-xs sm:text-sm">
                            {stock.movementPercent?.toFixed(2)}%
                          </div>
                          <div className="text-[10px] text-rose-500/80">
                            ₹{stock.pointsChange?.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${stock.rvol >= 1.5
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'text-slate-400 bg-slate-900'
                              }`}
                          >
                            {stock.rvol}x
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-sans">
                          <span
                            className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${stock.status === 'BREAKDOWN'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800/80'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                          >
                            {stock.status === 'BREAKDOWN' ? (
                              <>
                                <ArrowDownRight className="h-2.5 w-2.5 text-rose-400" />
                                <span>5M BREAKDOWN</span>
                              </>
                            ) : (
                              <span>INSIDE 5M</span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectStock) onSelectStock(stock.symbol);
                            }}
                            className="rounded-lg bg-slate-800/80 p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Open TradingView Chart"
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
        </div>
      </div>
    </div>
  );
}
