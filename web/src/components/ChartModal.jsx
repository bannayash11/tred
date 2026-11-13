import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { X, TrendingUp, TrendingDown, Target, Layers, ArrowLeft } from 'lucide-react';
import { fetchStock, getSocket } from '../services/api';
import { getMembership } from '../lib/membership';
import TradingViewChart, { toTradingViewSymbol } from './TradingViewChart';
import ManualKotakChart, {
  loadSavedOverlays,
  saveOverlays,
  findNearestLevel,
  getIstBucketStart,
  sanitizeCandle,
  isNseSessionCandle
} from './ManualKotakChart';

const OVERLAY_OPTIONS = [
  { key: 'orderBlocks', label: 'Order Blocks', hint: 'Demand / supply zones' },
  { key: 'liquidity', label: 'Liquidity', hint: 'Buy & sell side levels' },
  { key: 'fvg', label: 'FVG', hint: 'Fair value gaps' },
  { key: 'sessionMarks', label: 'Session', hint: 'Day open marks' },
  { key: 'prevDayHL', label: 'Prev Day', hint: 'Previous day high / low' },
  { key: 'equalHL', label: 'Equal H/L', hint: 'Matching highs & lows' }
];


const ALL_TIMEFRAMES = ['1m', '3m', '5m', '15m'];
const RANGE_OPTIONS = [
  { key: '1D', days: 1, label: '1D' },
  { key: '5D', days: 5, label: '5D' },
  { key: '1M', days: 30, label: '1M' },
  { key: '3M', days: 90, label: '3M' },
  { key: '6M', days: 180, label: '6M' },
  { key: '1Y', days: 365, label: '1Y' }
];
const IST_TZ = 'Asia/Kolkata';
const NSE_OPEN_MINS = 9 * 60 + 15;
const NSE_CLOSE_MINS = 15 * 60 + 30;


function getIstParts(unixSec) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(unixSec * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const wd = get('weekday');
  const hour = Number(get('hour') === '24' ? 0 : get('hour'));
  const minute = Number(get('minute'));
  return {
    weekday: wd,
    isWeekend: wd === 'Sat' || wd === 'Sun',
    mins: hour * 60 + minute,
    ymd: `${get('year')}-${get('month')}-${get('day')}`
  };
}

function checkIsMarketOpen() {
  try {
    const { isWeekend, mins } = getIstParts(Math.floor(Date.now() / 1000));
    if (isWeekend) return false;
    return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
  } catch {
    return false;
  }
}

/** Stock chart + SMC anatomy. Use asPage for full-page layout instead of modal. */
export default function ChartModal({ symbol, onClose, asPage = false }) {
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(authUser, plans);
  const allowedTfs = useMemo(() => {
    const fromPlan = (membership.timeframesAllowed || []).filter((tf) => ALL_TIMEFRAMES.includes(tf));
    return fromPlan.length ? fromPlan : ['5m', '15m'];
  }, [membership.timeframesAllowed]);

  const [timeframe, setTimeframe] = useState(() =>
    allowedTfs.includes('5m') ? '5m' : allowedTfs[0] || '5m'
  );
  // Manual = Kotak LW chart (~5D + lines); TradingView = full history embed
  const [chartMode, setChartMode] = useState('tradingview'); // 'manual' | 'tradingview'
  const [overlays, setOverlays] = useState(() => loadSavedOverlays());
  const [rangeKey, setRangeKey] = useState('5D');

  const toggleOverlay = (key) => {
    setOverlays((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveOverlays(next);
      return next;
    });
  };

  const setAllOverlays = (on) => {
    const next = OVERLAY_OPTIONS.reduce((acc, opt) => {
      acc[opt.key] = on;
      return acc;
    }, {});
    setOverlays(next);
    saveOverlays(next);
  };

  const activeOverlayCount = OVERLAY_OPTIONS.filter((opt) => overlays[opt.key]).length;

  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [livePrice, setLivePrice] = useState(null);
  const [liveChange, setLiveChange] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null); // 'up' | 'down' | null
  const [isMarketOpen, setIsMarketOpen] = useState(checkIsMarketOpen());
  const seriesRef = useRef(null);
  const currentCandleRef = useRef(null);
  const rangeDays = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.days || 5;

  const nearestLevel = useMemo(() => {
    const px = livePrice ?? stockData?.currentPrice;
    return findNearestLevel(px, stockData, overlays);
  }, [livePrice, stockData, overlays]);

  useEffect(() => {
    if (!allowedTfs.includes(timeframe)) {
      setTimeframe(allowedTfs.includes('5m') ? '5m' : allowedTfs[0] || '5m');
    }
  }, [allowedTfs, timeframe]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsMarketOpen(checkIsMarketOpen());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 1. Live historical candles for selected TF + range (no fake fallback)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setFetchError('');
    setStockData(null);

    fetchStock(symbol, { timeframe, rangeDays })
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.stock) {
          setStockData(res.stock);
          setLivePrice(res.stock.currentPrice);
          setLiveChange(res.stock.change);
          if (!res.stock.candles?.length || res.stock.dataSource !== 'live') {
            setFetchError('Live candle data unavailable. Waiting for Kotak Neo market feed…');
          }
        } else {
          setFetchError('Unable to load live chart data.');
        }
      })
      .catch((err) => {
        console.error('Error fetching stock details:', err);
        if (isMounted) {
          setFetchError(err.userMessage || err.response?.data?.message || 'Failed to load live chart.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe, rangeDays]);

  // 2. Real-time Socket.io — live LTP only in NSE session; proper green/red OHLC
  useEffect(() => {
    const socket = getSocket();
    socket.emit('SUBSCRIBE_STOCK', symbol);

    const handleTick = (ticks) => {
      if (!Array.isArray(ticks)) return;
      const tick = ticks.find((t) => t.symbol === symbol);
      if (!tick) return;

      const newPrice = Number(tick.currentPrice);
      if (!Number.isFinite(newPrice)) return;
      const newChange = tick.change;

      setLivePrice((prev) => {
        if (prev !== null) {
          if (newPrice > prev) {
            setPriceFlash('up');
            setTimeout(() => setPriceFlash(null), 400);
          } else if (newPrice < prev) {
            setPriceFlash('down');
            setTimeout(() => setPriceFlash(null), 400);
          }
        }
        return newPrice;
      });
      setLiveChange(newChange);

      // Live candle updates only on Manual (Kotak) chart
      if (chartMode !== 'manual') return;
      const nowSec = Math.floor(Date.now() / 1000);
      if (!isNseSessionCandle(nowSec) || !seriesRef.current) return;

      const bucket = getIstBucketStart(nowSec, timeframe);
      const cur = currentCandleRef.current;

      if (!cur || cur.time !== bucket) {
        const fresh = sanitizeCandle({
          time: bucket,
          open: newPrice,
          high: newPrice,
          low: newPrice,
          close: newPrice
        });
        if (!fresh) return;
        currentCandleRef.current = fresh;
        seriesRef.current.update(fresh);
        return;
      }

      const updated = sanitizeCandle({
        time: cur.time,
        open: cur.open,
        high: Math.max(cur.high, newPrice),
        low: Math.min(cur.low, newPrice),
        close: newPrice
      });
      if (!updated) return;
      currentCandleRef.current = updated;
      seriesRef.current.update(updated);
    };

    socket.on('MARKET_TICK', handleTick);

    return () => {
      socket.off('MARKET_TICK', handleTick);
      socket.emit('UNSUBSCRIBE_STOCK', symbol);
    };
  }, [symbol, timeframe, chartMode]);


  const currentDisplayPrice = livePrice ?? stockData?.currentPrice;
  const currentDisplayChange = liveChange ?? stockData?.change;

  const shellClass = asPage
    ? 'relative flex min-h-[calc(100vh-11rem)] w-full flex-col rounded-2xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-xl overflow-hidden'
    : 'relative flex h-[100dvh] sm:h-[90vh] w-full max-w-6xl flex-col rounded-none sm:rounded-3xl border-0 sm:border border-slate-800 bg-[#0a0f1d] shadow-2xl overflow-hidden';

  const content = (
      <div className={shellClass}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 sm:px-6 py-4 bg-slate-900/50">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {asPage && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{symbol}</h2>
                <span
                  className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300 border border-slate-700/80"
                  title="TradingView symbol"
                >
                  {toTradingViewSymbol(symbol)}
                </span>
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800/50">
                  {stockData?.sector || 'NSE F&O'}
                </span>
                <span className="text-xs text-slate-400">{timeframe.toUpperCase()} · {rangeKey}</span>
                {stockData?.dataSource === 'live' && (
                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/50">
                    LIVE DATA
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{stockData?.name}</p>
            </div>

            {stockData && currentDisplayPrice !== undefined && (
              <div className="hidden md:flex items-center space-x-3 border-l border-slate-800 pl-4">
                <div
                  className={`flex items-baseline space-x-2 rounded-xl px-3 py-1 transition-colors duration-300 ${
                    priceFlash === 'up'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : priceFlash === 'down'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-900/60'
                  }`}
                >
                  <span className="font-mono text-xl font-extrabold text-white">
                    ₹{Number(currentDisplayPrice).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      currentDisplayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {currentDisplayChange >= 0
                      ? `+${Number(currentDisplayChange).toFixed(2)}%`
                      : `${Number(currentDisplayChange).toFixed(2)}%`}
                  </span>
                </div>

                {isMarketOpen ? (
                  <div className="flex items-center space-x-1.5 rounded-full bg-emerald-950/80 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-800/60 shadow-sm shadow-emerald-500/10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono uppercase tracking-wider">LIVE STREAM</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-bold text-slate-300 border border-slate-700/60 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-amber-400/80"></span>
                    <span className="font-mono uppercase tracking-wider text-slate-300">MARKET CLOSED</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile price */}
            {stockData && currentDisplayPrice !== undefined && (
              <div className="flex md:hidden items-baseline gap-1.5 font-mono">
                <span className="text-sm font-bold text-white">
                  ₹{Number(currentDisplayPrice).toLocaleString('en-IN', {
                    maximumFractionDigits: 2
                  })}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    currentDisplayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {currentDisplayChange >= 0 ? '+' : ''}
                  {Number(currentDisplayChange || 0).toFixed(2)}%
                </span>
              </div>
            )}
            {!asPage && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chart"
                className="rounded-lg bg-slate-800/80 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="space-y-2 border-b border-slate-800/80 px-4 sm:px-5 py-2.5 bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-900/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setChartMode('manual')}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    chartMode === 'manual'
                      ? 'bg-cyan-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('tradingview')}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    chartMode === 'tradingview'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  TradingView
                </button>
              </div>
              <span className="hidden sm:inline text-[10px] text-slate-500">
                {chartMode === 'manual'
                  ? 'Kotak data · structure lines'
                  : 'Full history · zoom freely'}
              </span>
            </div>
            <span className="rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-[10px] font-medium text-slate-400">
              IST · 09:15–15:30
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] font-medium text-slate-500">Timeframe</span>
              {ALL_TIMEFRAMES.map((tf) => {
                const locked = !allowedTfs.includes(tf);
                const active = timeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    disabled={locked || loading}
                    onClick={() => setTimeframe(tf)}
                    title={locked ? 'Not in your plan' : `${tf} candles`}
                    className={`min-w-[2.25rem] rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-cyan-500 text-black'
                        : locked
                          ? 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>

            {chartMode === 'manual' ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-medium text-slate-500">Range</span>
                {RANGE_OPTIONS.map((opt) => {
                  const active = rangeKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={loading}
                      onClick={() => setRangeKey(opt.key)}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500">Range is built into TradingView</span>
            )}
          </div>
        </div>

        <div
          className={`flex flex-1 flex-col lg:flex-row overflow-hidden ${
            chartMode === 'tradingview' ? 'min-h-0' : 'min-h-[28rem]'
          }`}
        >
          <div
            className={`relative flex-1 bg-[#090d16] p-2 sm:p-4 flex flex-col ${
              chartMode === 'tradingview'
                ? 'min-h-[min(68dvh,560px)] lg:min-h-[32rem] justify-stretch'
                : `justify-center ${asPage ? 'min-h-[28rem] lg:min-h-[32rem]' : ''}`
            }`}
          >
            {chartMode === 'tradingview' ? (
              <TradingViewChart symbol={symbol} timeframe={timeframe} className="flex-1" />
            ) : (
              <ManualKotakChart
                stockData={stockData}
                timeframe={timeframe}
                loading={loading}
                error={fetchError}
                seriesRef={seriesRef}
                currentCandleRef={currentCandleRef}
                asPage={asPage}
                overlays={overlays}
              />
            )}
          </div>

          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800/70 bg-[#0a0f18] px-3.5 py-3.5 overflow-y-auto space-y-3">
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2">
              <h3 className="text-[11px] font-semibold text-slate-200">Structure &amp; Levels</h3>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                Educational chart studies only — not investment advice.
              </p>
            </div>

            {chartMode === 'manual' && (
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-200">Show on chart</div>
                    <div className="text-[10px] text-slate-500">
                      {activeOverlayCount} selected · saved automatically
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAllOverlays(true)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/10"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllOverlays(false)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-slate-800"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {OVERLAY_OPTIONS.map((opt) => {
                    const on = Boolean(overlays[opt.key]);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        title={opt.hint}
                        onClick={() => toggleOverlay(opt.key)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                          on
                            ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                            : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {chartMode === 'tradingview' && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                TradingView shows full history. Switch to <span className="text-cyan-300">Manual</span> for Order Blocks, Liquidity and other structure overlays.
              </div>
            )}

            {nearestLevel && (
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">Nearest level</span>
                  <span className="text-[10px] text-slate-500">from LTP</span>
                </div>
                <div className="text-[12px] font-medium text-slate-100 truncate">{nearestLevel.label}</div>
                <div className="flex items-end justify-between gap-2">
                  <div className="font-mono text-sm text-slate-200">
                    ₹{nearestLevel.level.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`font-mono text-[11px] font-semibold ${
                      nearestLevel.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {nearestLevel.diff >= 0 ? '+' : ''}
                    ₹{nearestLevel.diff.toFixed(2)}
                    <span className="text-slate-500"> · {nearestLevel.pct.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {stockData?.smcData?.activeBullishOB && (
              <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center text-[11px] font-semibold text-emerald-400/90">
                    <TrendingUp className="mr-1.5 h-3 w-3 opacity-80" /> Bullish Order Block
                  </span>
                  <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400/80">
                    {stockData.smcData.activeBullishOB.score}/100
                  </span>
                </div>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Top</span>
                    <span>₹{stockData.smcData.activeBullishOB.top}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Base</span>
                    <span>₹{stockData.smcData.activeBullishOB.bottom}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Vol Surge</span>
                    <span>{stockData.smcData.activeBullishOB.volumeRatio}x</span>
                  </div>
                </div>
              </div>
            )}

            {stockData?.smcData?.activeBearishOB && (
              <div className="rounded-lg border border-rose-900/30 bg-rose-950/15 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center text-[11px] font-semibold text-rose-400/90">
                    <TrendingDown className="mr-1.5 h-3 w-3 opacity-80" /> Bearish Order Block
                  </span>
                  <span className="rounded bg-rose-950/50 px-1.5 py-0.5 font-mono text-[9px] text-rose-400/80">
                    {stockData.smcData.activeBearishOB.score}/100
                  </span>
                </div>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Base</span>
                    <span>₹{stockData.smcData.activeBearishOB.bottom}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Top</span>
                    <span>₹{stockData.smcData.activeBearishOB.top}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Vol Surge</span>
                    <span>{stockData.smcData.activeBearishOB.volumeRatio}x</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 space-y-2">
              <span className="flex items-center text-[11px] font-semibold text-cyan-400/90">
                <Target className="mr-1.5 h-3 w-3 opacity-80" /> Liquidity Levels
              </span>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Buy-Side</span>
                  <span className="text-cyan-300/90">₹{stockData?.smcData?.liquidity?.buySide?.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sell-Side</span>
                  <span className="text-amber-400/90">₹{stockData?.smcData?.liquidity?.sellSide?.price}</span>
                </div>
              </div>
            </div>

            {stockData?.smcData?.fvgs?.length > 0 && (
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 space-y-2">
                <span className="flex items-center text-[11px] font-semibold text-slate-300">
                  <Layers className="mr-1.5 h-3 w-3 opacity-80" /> Fair Value Gaps (FVG)
                </span>
                <div className="space-y-1 text-[11px] font-mono">
                  {stockData.smcData.fvgs.slice(0, 2).map((fvg, idx) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span className="text-slate-500">{fvg.type} FVG</span>
                      <span className="text-slate-200">₹{fvg.bottom} - ₹{fvg.top}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );

  if (asPage) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
      {content}
    </div>
  );
}
