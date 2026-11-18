import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useOutletContext } from 'react-router-dom';
import {
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Layers,
  ArrowLeft,
  Smartphone,
  Monitor,
  ChevronDown
} from 'lucide-react';
import { fetchStock, getSocket } from '../services/api';
import { getMembership } from '../lib/membership';
import { fetchByokClientStock, isByokChartUser } from '../lib/byokClientChart';
import { pickChartFeed } from '../lib/feedProvider';
import ManualKotakChart, {
  loadSavedOverlays,
  saveOverlays,
  findNearestLevel,
  getIstBucketStart,
  sanitizeCandle,
  isNseSessionCandle
} from './ManualKotakChart';
import ChartFullLoader from './ChartFullLoader';

/** Your SMC / structure logic — always listed as chart options */
const LOGIC_OPTIONS = [
  { key: 'orderBlocks', label: 'Order Blocks', hint: 'Your demand / supply zone logic' },
  { key: 'liquidity', label: 'Liquidity', hint: 'Your buy & sell side liquidity levels' },
  { key: 'fvg', label: 'FVG', hint: 'Your fair value gap logic' },
  { key: 'sessionMarks', label: 'Session', hint: 'Day open marks' },
  { key: 'prevDayHL', label: 'Prev Day', hint: 'Previous day high / low' },
  { key: 'equalHL', label: 'Equal H/L', hint: 'Matching highs & lows' }
];

/** Classic indicators from candle data (Fyers / broker) */
const INDICATOR_OPTIONS = [
  { key: 'ema9', label: 'EMA 9', hint: '9-period exponential moving average' },
  { key: 'ema21', label: 'EMA 21', hint: '21-period exponential moving average' },
  { key: 'sma20', label: 'SMA 20', hint: '20-period simple moving average' },
  { key: 'sma50', label: 'SMA 50', hint: '50-period simple moving average' },
  { key: 'bbands', label: 'Bollinger', hint: 'Bollinger Bands (20, 2)' },
  { key: 'vwap', label: 'VWAP', hint: 'Session volume-weighted average price' },
  { key: 'supertrend', label: 'Supertrend', hint: 'Supertrend (10, 3)' },
  { key: 'macd', label: 'MACD', hint: 'MACD (12, 26, 9) — bottom pane' },
  { key: 'rsi', label: 'RSI 14', hint: 'RSI (14) — bottom pane (hides MACD pane)' }
];

const OVERLAY_OPTIONS = [...LOGIC_OPTIONS, ...INDICATOR_OPTIONS];


const ALL_TIMEFRAMES = ['1m', '3m', '5m', '15m'];
const RANGE_OPTIONS = [
  { key: '1D', days: 1, label: '1D' },
  { key: '5D', days: 5, label: '5D' }
];
const IST_TZ = 'Asia/Kolkata';
const NSE_OPEN_MINS = 9 * 60 + 15;
const NSE_CLOSE_MINS = 15 * 60 + 30;
const CHART_LAYOUT_KEY = 'tred_chart_layout_mode';

/** auto = portrait mobile / landscape desktop; or force mobile|desktop */
function readLayoutMode() {
  try {
    const v = sessionStorage.getItem(CHART_LAYOUT_KEY);
    if (v === 'mobile' || v === 'desktop' || v === 'auto') return v;
  } catch {
    /* ignore */
  }
  return 'auto';
}

function useViewportLayout(layoutMode) {
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: landscape)').matches
      : false
  );
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const land = window.matchMedia('(orientation: landscape)');
    const wide = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setIsLandscape(land.matches);
      setIsWide(wide.matches);
    };
    sync();
    land.addEventListener('change', sync);
    wide.addEventListener('change', sync);
    return () => {
      land.removeEventListener('change', sync);
      wide.removeEventListener('change', sync);
    };
  }, []);

  const useDesktopLayout =
    layoutMode === 'desktop' || (layoutMode === 'auto' && (isWide || isLandscape));

  /** Phone / narrow: desktop toggle still on, but physical width is small */
  const isNarrow = !isWide;

  return { isLandscape, isWide, isNarrow, useDesktopLayout };
}


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
  const layoutCtx = useOutletContext() || {};
  const layoutFeed = layoutCtx.feedMeta || null;
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
  const [overlays, setOverlays] = useState(() => loadSavedOverlays());
  const [rangeKey, setRangeKey] = useState('5D');
  const [layoutMode, setLayoutMode] = useState(readLayoutMode);
  const { useDesktopLayout, isNarrow } = useViewportLayout(layoutMode);

  const setLayoutModePersist = (mode) => {
    setLayoutMode(mode);
    try {
      sessionStorage.setItem(CHART_LAYOUT_KEY, mode);
    } catch {
      /* ignore */
    }
  };

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
  const [chartFeed, setChartFeed] = useState(() => pickChartFeed({ layoutFeed }));
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [livePrice, setLivePrice] = useState(null);
  const [liveChange, setLiveChange] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null); // 'up' | 'down' | null
  const [tickAlive, setTickAlive] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(checkIsMarketOpen());
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const seriesRef = useRef(null);
  const currentCandleRef = useRef(null);
  const indicatorSeriesRef = useRef(null);
  const indicatorMenuRef = useRef(null);
  const tickAliveRef = useRef(false);
  const rangeDays = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.days || 5;
  const activeIndicators = INDICATOR_OPTIONS.filter((opt) => overlays[opt.key]);

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

  useEffect(() => {
    if (!indicatorMenuOpen) return undefined;
    const onDoc = (e) => {
      if (indicatorMenuRef.current && !indicatorMenuRef.current.contains(e.target)) {
        setIndicatorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [indicatorMenuOpen]);

  const useClientBrokerChart = isByokChartUser(authUser);

  useEffect(() => {
    if (!layoutFeed) return;
    setChartFeed((prev) => pickChartFeed({ layoutFeed, stockFeed: prev }) || prev);
  }, [layoutFeed]);

  // 1. Candles: keep full-screen loader until API returns real candles (no empty chart flash)
  useEffect(() => {
    let isMounted = true;
    let cancelled = false;
    setLoading(true);
    setFetchError('');
    setStockData(null);
    setTickAlive(false);
    tickAliveRef.current = false;

    const loadOnce = () =>
      useClientBrokerChart
        ? fetchByokClientStock(symbol, { timeframe, rangeDays })
        : fetchStock(symbol, { timeframe, rangeDays });

    const applyStock = (stock, res = {}) => {
      setStockData(stock);
      setLivePrice(stock.currentPrice);
      setLiveChange(stock.change);
      setChartFeed(
        pickChartFeed({
          responseFeed: res.feed,
          stockFeed: stock.feed,
          layoutFeed,
          chartProvider: stock.chartProvider
        })
      );
    };

    const emptyMsg = useClientBrokerChart
      ? 'No candles from your broker yet. Check token / market hours.'
      : 'Live candle data unavailable. Try again shortly…';

    (async () => {
      let lastErr = null;
      // Broker warm / 429: keep loader and retry until candles arrive
      const maxAttempts = 12;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const res = await loadOnce();
          if (cancelled || !isMounted) return;
          if (res.feed) {
            setChartFeed(
              pickChartFeed({
                responseFeed: res.feed,
                layoutFeed,
                chartProvider: res.stock?.chartProvider
              })
            );
          }
          const candles = res.stock?.candles;
          if (res.success && Array.isArray(candles) && candles.length > 0) {
            applyStock(res.stock, res);
            setFetchError('');
            if (isMounted) setLoading(false);
            return;
          }
          lastErr = emptyMsg;
        } catch (err) {
          console.error('Error fetching stock details:', err);
          if (err.response?.data?.feed) {
            setChartFeed(
              pickChartFeed({
                responseFeed: err.response.data.feed,
                layoutFeed
              })
            );
          }
          lastErr =
            err.message ||
            err.userMessage ||
            err.response?.data?.message ||
            'Failed to load live chart.';
        }
        // Stay on loader while waiting for broker response / warm
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, Math.min(4000, 800 + attempt * 350)));
        }
      }
      if (!cancelled && isMounted) {
        setFetchError(lastErr || emptyMsg);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      cancelled = true;
    };
    // layoutFeed is applied in a separate effect — do not refetch candles when feed meta updates
  }, [symbol, timeframe, rangeDays, useClientBrokerChart]);

  // 2. Real-time Socket.io — price + forming candle (tolerant of WS/REST gaps)
  useEffect(() => {
    const socket = getSocket();
    const norm = (s) =>
      String(s || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
    const sym = norm(symbol);
    const aliases = new Set(
      [sym, sym.replace(/\s/g, ''), sym === 'NIFTY 50' ? 'NIFTY' : '', sym === 'NIFTY' ? 'NIFTY 50' : ''].filter(
        Boolean
      )
    );

    socket.emit('SUBSCRIBE_STOCK', symbol);

    const applyLiveCandle = (newPrice, serverCandle = null) => {
      if (!seriesRef.current || !Number.isFinite(newPrice)) return;
      const nowSec = Math.floor(Date.now() / 1000);
      if (!isNseSessionCandle(nowSec)) return;

      const bucket =
        serverCandle?.time && Number.isFinite(Number(serverCandle.time))
          ? Number(serverCandle.time)
          : getIstBucketStart(nowSec, timeframe);
      const cur = currentCandleRef.current;
      const ind = indicatorSeriesRef.current;

      // If history last bar is ahead of "now" bucket, still paint LTP on that last bar
      const useTime = cur && cur.time > bucket ? cur.time : bucket;
      const newBar = !cur || cur.time < useTime;

      let bar = null;
      if (newBar) {
        bar = sanitizeCandle({
          time: useTime,
          open: Number(serverCandle?.open) || newPrice,
          high: Number(serverCandle?.high) || newPrice,
          low: Number(serverCandle?.low) || newPrice,
          close: Number(serverCandle?.close) || newPrice
        });
      } else {
        bar = sanitizeCandle({
          time: cur.time,
          open: cur.open,
          high: Math.max(cur.high, newPrice, Number(serverCandle?.high) || newPrice),
          low: Math.min(cur.low, newPrice, Number(serverCandle?.low) || newPrice),
          close: Number(serverCandle?.close) || newPrice
        });
      }
      if (!bar) return;

      try {
        seriesRef.current.update(bar);
        currentCandleRef.current = bar;
      } catch {
        // Lightweight Charts rejects out-of-order times — keep last bar close in sync
        try {
          if (cur) {
            const fallback = sanitizeCandle({
              time: cur.time,
              open: cur.open,
              high: Math.max(cur.high, newPrice),
              low: Math.min(cur.low, newPrice),
              close: newPrice
            });
            if (fallback) {
              seriesRef.current.update(fallback);
              currentCandleRef.current = fallback;
            }
          }
        } catch {
          /* ignore */
        }
        return;
      }

      if (ind?.ema9 && Number.isFinite(ind.baseEma9)) {
        if (newBar && Number.isFinite(ind.lastEma9)) ind.baseEma9 = ind.lastEma9;
        const k9 = 2 / (9 + 1);
        const next9 = newPrice * k9 + ind.baseEma9 * (1 - k9);
        ind.lastEma9 = next9;
        try {
          ind.ema9.update({ time: bar.time, value: next9 });
        } catch {
          /* ignore */
        }
      }
      if (ind?.ema21 && Number.isFinite(ind.baseEma21)) {
        if (newBar && Number.isFinite(ind.lastEma21)) ind.baseEma21 = ind.lastEma21;
        const k21 = 2 / (21 + 1);
        const next21 = newPrice * k21 + ind.baseEma21 * (1 - k21);
        ind.lastEma21 = next21;
        try {
          ind.ema21.update({ time: bar.time, value: next21 });
        } catch {
          /* ignore */
        }
      }
    };

    const handleTick = (ticks) => {
      if (!Array.isArray(ticks)) return;
      const tick = ticks.find((t) => aliases.has(norm(t.symbol)));
      if (!tick) return;

      const newPrice = Number(tick.currentPrice);
      if (!Number.isFinite(newPrice) || newPrice <= 0) return;
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
      if (newChange != null) setLiveChange(newChange);
      tickAliveRef.current = true;
      setTickAlive(true);

      applyLiveCandle(newPrice, tick.candle || null);
    };

    socket.on('MARKET_TICK', handleTick);

    const onFeed = (payload) => {
      if (payload?.feed) {
        setChartFeed((prev) =>
          pickChartFeed({
            responseFeed: payload.feed,
            stockFeed: prev,
            layoutFeed: payload.feed
          })
        );
      }
    };
    socket.on('INITIAL_STATE', onFeed);

    // Soft refresh only when ticks are missing — avoid hammering brokers (429)
    const softRefresh = window.setInterval(() => {
      if (useClientBrokerChart) return;
      if (!checkIsMarketOpen()) return;
      if (tickAliveRef.current) return;
      fetchStock(symbol, { timeframe, rangeDays })
        .then((res) => {
          if (!res?.success || !res.stock) return;
          const px = Number(res.stock.currentPrice);
          if (Number.isFinite(px) && px > 0) {
            setLivePrice(px);
            setLiveChange(res.stock.change);
            tickAliveRef.current = true;
            setTickAlive(true);
            const candles = res.stock.candles;
            const last = Array.isArray(candles) && candles.length ? candles[candles.length - 1] : null;
            applyLiveCandle(px, last);
          }
        })
        .catch(() => {});
    }, 25_000);

    return () => {
      socket.off('MARKET_TICK', handleTick);
      socket.off('INITIAL_STATE', onFeed);
      socket.emit('UNSUBSCRIBE_STOCK', symbol);
      window.clearInterval(softRefresh);
    };
  }, [symbol, timeframe, rangeDays, useClientBrokerChart]);

  const activeProvider =
    chartFeed?.chartProvider || chartFeed?.provider || stockData?.chartProvider || null;
  const activeFeedLabel = chartFeed?.label || null;

  const currentDisplayPrice = livePrice ?? stockData?.currentPrice;
  const currentDisplayChange = liveChange ?? stockData?.change;

  // Desktop-on-phone: taller plot (≈ green target); allow page scroll for options below
  const desktopPageShell =
    isNarrow
      ? 'min-h-[calc(100dvh-5.5rem)] overflow-x-hidden overflow-y-auto'
      : 'h-[calc(100dvh-10.5rem)] max-h-[calc(100dvh-10.5rem)] overflow-hidden';

  const shellClass = asPage
    ? `relative flex w-full flex-col rounded-2xl sm:rounded-3xl border border-[#2a2e39] bg-[#131722] shadow-xl ${
        useDesktopLayout
          ? desktopPageShell
          : 'min-h-0 overflow-x-hidden overflow-y-auto'
      }`
    : `relative flex w-full max-w-5xl flex-col border-[#2a2e39] bg-[#131722] shadow-2xl overflow-hidden ${
        useDesktopLayout
          ? 'h-[100dvh] sm:h-[90vh] rounded-none sm:rounded-3xl border-0 sm:border'
          : 'h-[100dvh] max-h-[100dvh] rounded-none border-0'
      }`;

  const content = (
      <div className={shellClass}>
        {loading ? (
          <ChartFullLoader
            symbol={symbol}
            timeframe={timeframe}
            rangeKey={rangeKey}
            feedLabel={
              chartFeed?.mode === 'byok'
                ? activeFeedLabel
                : 'Loading live chart'
            }
          />
        ) : null}
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#2a2e39] px-3 sm:px-6 py-3 sm:py-4 bg-[#1e222d]">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
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
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white truncate max-w-[9rem] sm:max-w-none">
                  {symbol}
                </h2>
                <span
                  className="hidden sm:inline rounded bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300 border border-slate-700/80"
                  title="NSE symbol"
                >
                  {`NSE:${String(symbol || '').replace(/\s+/g, '')}`}
                </span>
                {useDesktopLayout && (
                  <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800/50">
                    {stockData?.sector || 'NSE F&O'}
                  </span>
                )}
                <span className="text-[10px] sm:text-xs text-slate-400">
                  {timeframe.toUpperCase()} · {rangeKey}
                </span>
                {stockData?.dataSource === 'live' && (
                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/50">
                    LIVE
                  </span>
                )}
                {/* Platform plans: never show Kotak/Fyers/Upstox — broker stays backend-only */}
                {chartFeed?.mode === 'byok' && activeProvider && (
                  <span className="rounded bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800/40">
                    Your broker
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{stockData?.name}</p>
            </div>

            {stockData && currentDisplayPrice !== undefined && useDesktopLayout && (
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
                  <div
                    className={`flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border shadow-sm ${
                      tickAlive
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 shadow-emerald-500/10'
                        : 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      {tickAlive && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          tickAlive ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      ></span>
                    </span>
                    <span className="font-mono uppercase tracking-wider">
                      {tickAlive ? 'LIVE STREAM' : 'WAITING TICKS'}
                    </span>
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {stockData && currentDisplayPrice !== undefined && !useDesktopLayout && (
              <div className="flex items-baseline gap-1.5 font-mono">
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
            {/* Mobile layout picker: portrait=mobile UI, landscape=desktop UI (or force) */}
            <div
              className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900/80 p-0.5 lg:hidden"
              title="Layout: Auto follows orientation"
            >
              <button
                type="button"
                onClick={() => setLayoutModePersist('mobile')}
                className={`rounded-md p-1.5 ${
                  layoutMode === 'mobile' ? 'bg-cyan-500 text-black' : 'text-slate-400'
                }`}
                aria-label="Mobile layout"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLayoutModePersist('auto')}
                className={`rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                  layoutMode === 'auto' ? 'bg-amber-500 text-black' : 'text-slate-500'
                }`}
                aria-label="Auto layout"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setLayoutModePersist('desktop')}
                className={`rounded-md p-1.5 ${
                  layoutMode === 'desktop' ? 'bg-cyan-500 text-black' : 'text-slate-400'
                }`}
                aria-label="Desktop layout"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>
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
        <div className="shrink-0 space-y-2 border-b border-[#2a2e39] px-3 sm:px-5 py-2 sm:py-2.5 bg-[#131722]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-800/40 bg-cyan-950/40 px-2 py-1 text-[10px] font-semibold text-cyan-200">
                {useClientBrokerChart ? 'Your broker' : 'Live chart'}
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-500">
                SMC logic + Indicators · real-time candles
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Indicators dropdown — NOT "Indices" (Nifty/BankNifty). Select EMA/RSI etc. */}
              <div className="relative" ref={indicatorMenuRef}>
                <button
                  type="button"
                  onClick={() => setIndicatorMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeIndicators.length
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Technical indicators (EMA, RSI) — not market indices"
                >
                  Indicators
                  {activeIndicators.length > 0 && (
                    <span className="rounded bg-cyan-500/30 px-1 text-[10px] text-cyan-100">
                      {activeIndicators.length}
                    </span>
                  )}
                  <ChevronDown className={`h-3 w-3 opacity-70 ${indicatorMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {indicatorMenuOpen && (
                  <div className="absolute right-0 z-40 mt-1.5 w-56 max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-[#0c1220] p-2 shadow-xl shadow-black/40">
                    <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400/90">
                      Select indicators
                    </div>
                    <p className="px-1.5 pb-2 text-[10px] leading-snug text-slate-500">
                      These are chart studies (EMA / RSI), not Indices like Nifty.
                    </p>
                    <div className="space-y-0.5">
                      {INDICATOR_OPTIONS.map((opt) => {
                        const on = Boolean(overlays[opt.key]);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            title={opt.hint}
                            onClick={() => toggleOverlay(opt.key)}
                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
                              on
                                ? 'bg-cyan-500/15 text-cyan-100'
                                : 'text-slate-300 hover:bg-slate-800/80'
                            }`}
                          >
                            <span>
                              <span className="font-semibold">{opt.label}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">{opt.hint}</span>
                            </span>
                            <span
                              className={`ml-2 h-4 w-4 shrink-0 rounded border ${
                                on
                                  ? 'border-cyan-400 bg-cyan-400'
                                  : 'border-slate-600 bg-transparent'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

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
            </div>
          </div>
        </div>

        <div
          className={`flex flex-1 min-h-0 ${
            useDesktopLayout && !isNarrow
              ? 'flex-row overflow-hidden'
              : 'flex-col overflow-y-auto overflow-x-hidden'
          }`}
        >
          <div
            className={`relative flex-1 min-w-0 min-h-0 bg-[#131722] p-1 sm:p-2 flex flex-col ${
              useDesktopLayout && !isNarrow
                ? 'h-full'
                : useDesktopLayout && isNarrow
                  ? 'h-[min(72dvh,42rem)] shrink-0'
                  : asPage
                    ? 'h-[min(68dvh,38rem)] shrink-0'
                    : 'h-[min(42dvh,24rem)] shrink-0'
            }`}
          >
            <ManualKotakChart
              stockData={stockData}
              timeframe={timeframe}
              loading={loading}
              error={fetchError}
              seriesRef={seriesRef}
              currentCandleRef={currentCandleRef}
              indicatorSeriesRef={indicatorSeriesRef}
              asPage={asPage || useDesktopLayout}
              overlays={overlays}
              fillContainer
              layoutKey={useDesktopLayout ? 'desktop' : 'mobile'}
            />
          </div>

          <div
            className={`border-[#2a2e39] bg-[#1e222d] px-3.5 py-3.5 space-y-3 ${
              useDesktopLayout && !isNarrow
                ? 'w-56 xl:w-64 shrink-0 border-l overflow-y-auto h-full'
                : 'w-full border-t overflow-visible'
            }`}
          >
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2">
              <h3 className="text-[11px] font-semibold text-slate-200">Chart options</h3>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                Your SMC logic + indicators · educational only — not investment advice.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5 space-y-3">
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

                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
                    My logic (SMC)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LOGIC_OPTIONS.map((opt) => {
                      const on = Boolean(overlays[opt.key]);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          title={opt.hint}
                          onClick={() => toggleOverlay(opt.key)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                            on
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                              : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-800/60 pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/80">
                      Indicators
                    </div>
                    <button
                      type="button"
                      onClick={() => setIndicatorMenuOpen(true)}
                      className="text-[10px] font-medium text-cyan-300/90 hover:text-cyan-200"
                    >
                      Open dropdown ↑
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Not Indices (Nifty/BankNifty). Use toolbar <span className="text-cyan-300/80">Indicators</span> to select EMA / RSI.
                  </p>
                  {activeIndicators.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeIndicators.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          title={`Remove ${opt.label}`}
                          onClick={() => toggleOverlay(opt.key)}
                          className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-medium text-cyan-200"
                        >
                          {opt.label} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600">No indicator selected yet.</p>
                  )}
                </div>
              </div>

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
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-md ${
        useDesktopLayout ? 'items-stretch sm:items-center p-0 sm:p-4' : 'items-stretch p-0'
      }`}
    >
      {content}
    </div>
  );
}
