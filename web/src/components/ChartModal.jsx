import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useSelector } from 'react-redux';
import { X, TrendingUp, TrendingDown, Target, BookOpen, Layers, Check, ArrowLeft, Crosshair } from 'lucide-react';
import { fetchStock, getSocket } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { getMembership } from '../lib/membership';
import {
  MECHANICAL_PRESETS,
  runMechanicalSystem
} from '../lib/mechanicalTradingEngine';

const ALL_TIMEFRAMES = ['1m', '3m', '5m', '15m', '1h', '1d'];
const RANGE_OPTIONS = [
  { key: '1D', days: 1, label: '1D' },
  { key: '5D', days: 5, label: '5D' },
  { key: '1M', days: 30, label: '1M' },
  { key: '3M', days: 90, label: '3M' },
  { key: '6M', days: 180, label: '6M' },
  { key: '1Y', days: 365, label: '1Y' }
];
const IST_TZ = 'Asia/Kolkata';
// NSE cash/F&O regular session: 09:15 → 15:30 IST
const NSE_OPEN_MINS = 9 * 60 + 15;
const NSE_CLOSE_MINS = 15 * 60 + 30;

const TF_SECONDS = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400
};

function chartTimeToDate(time) {
  if (typeof time === 'string') {
    return new Date(`${time}T00:00:00+05:30`);
  }
  if (time && typeof time === 'object' && time.year) {
    return new Date(`${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}T00:00:00+05:30`);
  }
  return new Date(Number(time) * 1000);
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

/** Keep only NSE session candles (09:15–15:30 IST). Daily TF keeps full days. */
function isNseSessionCandle(unixSec, timeframe) {
  if (timeframe === '1d') {
    const { isWeekend } = getIstParts(unixSec);
    return !isWeekend;
  }
  const { isWeekend, mins } = getIstParts(unixSec);
  if (isWeekend) return false;
  return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
}

/** Fix OHLC so wicks/body are valid → green (close>=open) / red (close<open) correct */
function sanitizeCandle(c) {
  const open = Number(c.open);
  const close = Number(c.close);
  let high = Number(c.high);
  let low = Number(c.low);
  if (![open, close, high, low].every(Number.isFinite)) return null;
  high = Math.max(high, open, close);
  low = Math.min(low, open, close);
  return { ...c, open, high, low, close };
}

function getIstBucketStart(unixSec, timeframe) {
  if (timeframe === '1d') {
    return getIstParts(unixSec).ymd;
  }
  const step = TF_SECONDS[timeframe] || 300;
  // Align buckets using IST wall-clock from midnight
  const parts = getIstParts(unixSec);
  const dayStartUtc = Math.floor(new Date(`${parts.ymd}T00:00:00+05:30`).getTime() / 1000);
  const secsFromMidnight = unixSec - dayStartUtc;
  const bucket = Math.floor(secsFromMidnight / step) * step;
  return dayStartUtc + bucket;
}

/** Axis tick labels in Indian market time (IST) */
function formatIstTickMark(time, tickMarkType) {
  const d = chartTimeToDate(time);
  if (tickMarkType <= 0) {
    return d.toLocaleDateString('en-IN', { timeZone: IST_TZ, year: 'numeric' });
  }
  if (tickMarkType === 1) {
    return d.toLocaleDateString('en-IN', { timeZone: IST_TZ, month: 'short', year: '2-digit' });
  }
  if (tickMarkType === 2) {
    return d.toLocaleDateString('en-IN', { timeZone: IST_TZ, day: 'numeric', month: 'short' });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/** Crosshair / tooltip time in IST */
function formatIstCrosshairTime(time) {
  const d = chartTimeToDate(time);
  const datePart = d.toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return `${datePart}, ${timePart} IST`;
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

/**
 * Default viewport = today's NSE session (or last session in data).
 * Preview range stays loaded so zooming out reveals previous days.
 */
function applyDefaultTodayView(chart, formattedData, isDaily) {
  if (!formattedData.length) return;

  if (isDaily) {
    // Daily: start on a short recent window; zoom out for full preview.
    const slice = formattedData.slice(-Math.min(formattedData.length, 40));
    try {
      chart.timeScale().setVisibleRange({
        from: slice[0].time,
        to: slice[slice.length - 1].time
      });
    } catch {
      chart.timeScale().fitContent();
    }
    return;
  }

  const todayYmd = getIstParts(Math.floor(Date.now() / 1000)).ymd;
  let sessionYmd = null;
  for (let i = formattedData.length - 1; i >= 0; i--) {
    const ymd = getIstParts(formattedData[i].time).ymd;
    if (ymd === todayYmd || sessionYmd == null) {
      sessionYmd = ymd;
      if (ymd === todayYmd) break;
    }
  }

  const openSec = Math.floor(new Date(`${sessionYmd}T09:15:00+05:30`).getTime() / 1000);
  const closeSec = Math.floor(new Date(`${sessionYmd}T15:30:00+05:30`).getTime() / 1000);

  try {
    chart.timeScale().setVisibleRange({ from: openSec, to: closeSec });
  } catch {
    // Fallback: logical indices for that session's candles
    let fromIdx = -1;
    let toIdx = -1;
    for (let i = 0; i < formattedData.length; i++) {
      if (getIstParts(formattedData[i].time).ymd !== sessionYmd) continue;
      if (fromIdx < 0) fromIdx = i;
      toIdx = i;
    }
    if (fromIdx >= 0 && toIdx >= fromIdx) {
      chart.timeScale().setVisibleLogicalRange({ from: fromIdx - 0.5, to: toIdx + 0.5 });
    } else {
      chart.timeScale().fitContent();
    }
  }
}

/** Stock chart + SMC anatomy. Use asPage for full-page layout instead of modal. */
export default function ChartModal({ symbol, onClose, onLogTrade, asPage = false }) {
  const { isDark } = useTheme();
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(authUser, plans);
  const allowedTfs = useMemo(() => {
    const fromPlan = (membership.timeframesAllowed || []).filter((tf) => ALL_TIMEFRAMES.includes(tf));
    return fromPlan.length ? fromPlan : ['5m', '15m'];
  }, [membership.timeframesAllowed]);

  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeriesRef = useRef(null);
  const currentCandleRef = useRef(null);

  const [timeframe, setTimeframe] = useState(allowedTfs[0] || '5m');
  const [rangeKey, setRangeKey] = useState('1M');
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [loggedNotice, setLoggedNotice] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [liveChange, setLiveChange] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null); // 'up' | 'down' | null
  const [isMarketOpen, setIsMarketOpen] = useState(checkIsMarketOpen());
  /** Mechanical system ON/OFF — floating control on chart */
  const [mechEnabled, setMechEnabled] = useState(true);
  /** nifty | universal — both logics from Pine scripts */
  const [mechPreset, setMechPreset] = useState('universal');
  const [mechResult, setMechResult] = useState(null);
  const overlayMode = mechEnabled ? 'mechanical' : 'smc';

  const rangeDays = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.days || 30;

  useEffect(() => {
    if (!allowedTfs.includes(timeframe)) {
      setTimeframe(allowedTfs[0] || '5m');
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
        if (isMounted) setFetchError(err.response?.data?.message || 'Failed to load live chart.');
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
      const nowSec = Math.floor(Date.now() / 1000);
      const inSession = isNseSessionCandle(nowSec, timeframe === '1d' ? '5m' : timeframe);

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

      // Outside market hours: price label only, no candle mutation
      if (!inSession || !candleSeriesRef.current) return;

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
        candleSeriesRef.current.update(fresh);
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
      candleSeriesRef.current.update(updated);
    };

    socket.on('MARKET_TICK', handleTick);

    return () => {
      socket.off('MARKET_TICK', handleTick);
      socket.emit('UNSUBSCRIBE_STOCK', symbol);
    };
  }, [symbol, timeframe]);

  // 3. Initialize and render Lightweight Chart (live candles only)
  useEffect(() => {
    if (!stockData || !chartContainerRef.current) return;
    if (!stockData.candles?.length || stockData.dataSource !== 'live') return;

    // Clean previous chart instance if any
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
      candleSeriesRef.current = null;
      currentCandleRef.current = null;
    }

    const container = chartContainerRef.current;
    const isDaily = timeframe === '1d';
    const chart = createChart(container, {
      width: container.clientWidth,
      height: Math.max(asPage ? 560 : 480, container.clientHeight || 0),
      layout: {
        background: { color: isDark ? '#090d16' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569'
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: formatIstCrosshairTime
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.8)' },
        horzLines: { color: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.8)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#06b6d4', width: 1, style: 2 },
        horzLine: { color: '#06b6d4', width: 1, style: 2 }
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: !isDaily,
        secondsVisible: false,
        tickMarkFormatter: formatIstTickMark,
        // Keep preview history loaded; user zooms out to see previous days.
        rightOffset: 4,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false
      },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1'
      }
    });

    chartInstance.current = chart;

    // Green = bullish (close >= open), Red = bearish (close < open)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444'
    });

    // NSE session filter + sanitize OHLC for correct green/red bodies
    const formattedData = (stockData.candles || [])
      .filter((c) => isNseSessionCandle(c.time, timeframe))
      .map((c) => {
        const clean = sanitizeCandle(c);
        if (!clean) return null;
        if (isDaily) {
          return {
            time: getIstParts(clean.time).ymd,
            open: clean.open,
            high: clean.high,
            low: clean.low,
            close: clean.close
          };
        }
        return {
          time: clean.time,
          open: clean.open,
          high: clean.high,
          low: clean.low,
          close: clean.close
        };
      })
      .filter(Boolean);

    if (formattedData.length === 0) {
      chart.remove();
      chartInstance.current = null;
      setFetchError('No NSE session candles (09:15–15:30 IST) for this range.');
      return;
    }

    // Mechanical MTF system (Nifty Classic + Universal) — same bars as chart series
    const engineCandles = formattedData.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      _unix:
        typeof c.time === 'number'
          ? c.time
          : Math.floor(new Date(`${c.time}T00:00:00+05:30`).getTime() / 1000)
    }));

    const mech = runMechanicalSystem(engineCandles, {
      preset: mechPreset,
      chartTimeframe: timeframe,
      rr: 2,
      expiry: 5,
      oneTrade: true,
      exitOpposite: true,
      requireAll: true
    });
    setMechResult(mech);

    // Keep classic green/red candle UI (no trend/setup recolor)
    candleSeries.setData(formattedData);
    candleSeriesRef.current = candleSeries;
    currentCandleRef.current = { ...formattedData[formattedData.length - 1] };
    // Show today by default; Preview range (5D/1M/…) stays in data for zoom-out.
    applyDefaultTodayView(chart, formattedData, isDaily);

    if (overlayMode === 'mechanical') {
      const markerMap = new Map();
      for (const m of mech.markers || []) {
        const prev = markerMap.get(m.time);
        const rank = (t) =>
          t === 'BUY' || t === 'SELL' ? 3 : t === 'SL' || t === 'TP' || t === 'EXIT' ? 2 : 1;
        if (!prev || rank(m.text) >= rank(prev.text)) markerMap.set(m.time, m);
      }
      const markers = [...markerMap.values()].sort((a, b) => {
        const ta = typeof a.time === 'number' ? a.time : 0;
        const tb = typeof b.time === 'number' ? b.time : 0;
        return ta - tb || String(a.time).localeCompare(String(b.time));
      });
      candleSeries.setMarkers(markers);

      if (mech.activeTrade) {
        const t = mech.activeTrade;
        candleSeries.createPriceLine({
          price: t.entry,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: t.dir === 1 ? 'MECH Entry' : 'MECH Entry (Short)'
        });
        candleSeries.createPriceLine({
          price: t.sl,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'MECH SL'
        });
        candleSeries.createPriceLine({
          price: t.target,
          color: '#22c55e',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'MECH Target'
        });
      } else if (mech.pending) {
        candleSeries.createPriceLine({
          price: mech.pending.entry,
          color: '#22d3ee',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Pending Entry'
        });
        candleSeries.createPriceLine({
          price: mech.pending.sl,
          color: '#f97316',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Pending SL'
        });
      }
    } else {
      const smc = stockData.smcData;

      // Draw Price Lines for Bullish Order Block (Demand Zone)
      if (smc?.activeBullishOB) {
        const ob = smc.activeBullishOB;
        candleSeries.createPriceLine({
          price: ob.top,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Bullish OB Top'
        });
        candleSeries.createPriceLine({
          price: ob.bottom,
          color: '#059669',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Bullish OB Base (SL)'
        });
      }

      // Draw Price Lines for Bearish Order Block (Supply Zone)
      if (smc?.activeBearishOB) {
        const ob = smc.activeBearishOB;
        candleSeries.createPriceLine({
          price: ob.bottom,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Bearish OB Base'
        });
        candleSeries.createPriceLine({
          price: ob.top,
          color: '#e11d48',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Bearish OB Top (SL)'
        });
      }

      // Draw Liquidity Targets
      if (smc?.liquidity?.buySide?.price) {
        candleSeries.createPriceLine({
          price: smc.liquidity.buySide.price,
          color: '#06b6d4',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'Buy-Side Liquidity (BSL)'
        });
      }

      if (smc?.liquidity?.sellSide?.price) {
        candleSeries.createPriceLine({
          price: smc.liquidity.sellSide.price,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'Sell-Side Liquidity (SSL)'
        });
      }
    }

    // Responsive resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
        candleSeriesRef.current = null;
        currentCandleRef.current = null;
      }
    };
  }, [stockData, asPage, isDark, timeframe, mechEnabled, mechPreset]);

  const handleQuickJournal = () => {
    if (!stockData) return;
    const effectivePrice = livePrice ?? stockData.currentPrice;

    let entry;
    if (overlayMode === 'mechanical' && mechResult?.activeTrade) {
      const t = mechResult.activeTrade;
      entry = {
        symbol: stockData.symbol,
        direction: t.dir === 1 ? 'BUY' : 'SELL',
        setupType: 'MECHANICAL_MTF',
        timeframe,
        entryPrice: t.entry,
        stopLoss: t.sl,
        targetPrice: t.target,
        quantity: 50,
        notes: `${MECHANICAL_PRESETS[mechPreset]?.label || 'Mechanical'} trade · R:R 2.0 · MTF aligned`
      };
    } else {
      const isBullish = Boolean(stockData.smcData?.activeBullishOB);
      const ob = isBullish ? stockData.smcData.activeBullishOB : stockData.smcData.activeBearishOB;
      entry = {
        symbol: stockData.symbol,
        direction: isBullish ? 'BUY' : 'SELL',
        setupType: 'ORDER_BLOCK',
        timeframe,
        entryPrice: effectivePrice,
        stopLoss: ob ? (isBullish ? ob.bottom : ob.top) : effectivePrice * 0.99,
        targetPrice: isBullish
          ? stockData.smcData?.liquidity?.buySide?.price || effectivePrice * 1.02
          : stockData.smcData?.liquidity?.sellSide?.price || effectivePrice * 0.98,
        quantity: 50,
        notes: `Institutional ${isBullish ? 'Bullish' : 'Bearish'} Order Block setup with score ${ob?.score || 80}/100`
      };
    }

    if (onLogTrade) {
      onLogTrade(entry);
      setLoggedNotice(true);
      setTimeout(() => setLoggedNotice(false), 2500);
    }
  };

  const currentDisplayPrice = livePrice ?? stockData?.currentPrice;
  const currentDisplayChange = liveChange ?? stockData?.change;

  const shellClass = asPage
    ? 'relative flex min-h-[calc(100vh-11rem)] w-full flex-col rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-xl overflow-hidden'
    : 'relative flex h-[90vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl overflow-hidden';

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

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleQuickJournal}
              className="flex items-center space-x-1.5 rounded-xl bg-cyan-500/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors"
            >
              {loggedNotice ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Logged to Trade Log!</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  <span>Log to Trade Log</span>
                </>
              )}
            </button>

            {!asPage && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-800/80 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Timeframe + Range controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 bg-slate-950/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-amber-300 tracking-wider">
              IST · NSE 09:15–15:30
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">TF</span>
            {ALL_TIMEFRAMES.map((tf) => {
              const locked = !allowedTfs.includes(tf);
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  disabled={locked || loading}
                  onClick={() => setTimeframe(tf)}
                  title={locked ? 'Not included in your plan' : `Show ${tf} candles`}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-cyan-500 text-black'
                      : locked
                        ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">Preview</span>
            {RANGE_OPTIONS.map((opt) => {
              const active = rangeKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={loading}
                  onClick={() => setRangeKey(opt.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-500/40 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-[28rem]">
          <div className={`relative flex-1 bg-[#090d16] p-4 flex flex-col justify-center ${asPage ? 'min-h-[28rem] lg:min-h-[32rem]' : ''}`}>
            {/* Floating Mechanical Enable / Disable — always visible on chart */}
            <div
              className={`absolute top-3 left-3 z-20 w-[11.5rem] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl transition-colors ${
                mechEnabled
                  ? 'border-cyan-500/35 bg-[#0a121c]/95 shadow-cyan-950/40'
                  : 'border-slate-700/70 bg-[#0b1018]/92 shadow-black/40'
              }`}
            >
              <div
                className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
                  mechEnabled ? 'border-cyan-500/20 bg-cyan-950/25' : 'border-slate-800/80 bg-slate-950/40'
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      mechEnabled ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                    Mechanical
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mechEnabled}
                  onClick={() => setMechEnabled((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    mechEnabled ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                  title={mechEnabled ? 'Disable mechanical system' : 'Enable mechanical system'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[8px] font-extrabold shadow transition-transform ${
                      mechEnabled ? 'translate-x-5 text-cyan-700' : 'translate-x-0 text-slate-500'
                    }`}
                  >
                    {mechEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {mechEnabled ? (
                <div className="space-y-2.5 p-2.5">
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950/70 p-0.5 ring-1 ring-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setMechPreset('universal')}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                        mechPreset === 'universal'
                          ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                      }`}
                    >
                      Universal
                    </button>
                    <button
                      type="button"
                      onClick={() => setMechPreset('nifty')}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                        mechPreset === 'nifty'
                          ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                      }`}
                    >
                      Nifty
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 px-0.5 text-[9px] font-semibold tracking-wide">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="text-[8px] leading-none">▲</span> BUY
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-400">
                      <span className="text-[8px] leading-none">▼</span> SELL
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> SETUP
                    </span>
                  </div>
                </div>
              ) : (
                <p className="px-3 py-2.5 text-[10px] leading-snug text-slate-500">
                  Off · SMC order blocks &amp; levels on chart
                </p>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/20" />
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-300">
                    Loading live {timeframe} candles
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-wide text-slate-500">
                    Range {rangeKey} · NSE session
                  </p>
                </div>
              </div>
            ) : fetchError || !stockData?.candles?.length ? (
              <div className="flex flex-col items-center justify-center space-y-2 px-6 text-center">
                <span className="text-sm font-semibold text-slate-300">No live chart data</span>
                <span className="text-xs text-slate-500 max-w-md">
                  {fetchError || 'Kotak Neo live candles are not available for this symbol/timeframe yet.'}
                </span>
              </div>
            ) : (
              <div ref={chartContainerRef} className="h-full w-full min-h-[24rem]" />
            )}
          </div>

          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-[#0a0f18] p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {overlayMode === 'mechanical' ? 'Mechanical System' : 'Setup Anatomy & Levels'}
              </h3>
              {overlayMode === 'mechanical' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            {overlayMode === 'mechanical' && !mechResult && (
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 space-y-3">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-800" />
                <div className="h-16 animate-pulse rounded-lg bg-slate-900/80" />
                <div className="space-y-1.5">
                  <div className="h-8 animate-pulse rounded-lg bg-slate-900/60" />
                  <div className="h-8 animate-pulse rounded-lg bg-slate-900/60" />
                  <div className="h-8 animate-pulse rounded-lg bg-slate-900/60" />
                </div>
                <p className="text-[10px] text-slate-500">Computing MTF bias &amp; setups…</p>
              </div>
            )}

            {overlayMode === 'mechanical' && mechResult && (
              <>
                <div
                  className={`rounded-xl border p-3.5 space-y-2.5 ${
                    mechResult.direction === 1
                      ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 to-slate-950/80'
                      : mechResult.direction === -1
                        ? 'border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-slate-950/80'
                        : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="flex items-center text-slate-100">
                      <Crosshair className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                      {MECHANICAL_PRESETS[mechPreset]?.label || 'Mechanical'}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                        mechResult.direction === 1
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : mechResult.direction === -1
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {mechResult.direction === 1
                        ? 'BULL BIAS'
                        : mechResult.direction === -1
                          ? 'BEAR BIAS'
                          : 'NO ALIGNMENT'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    MTF HH/HL trend · 2-candle confirmation · breakout entry · R:R 2.0
                  </p>
                  {mechResult.warning && (
                    <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-300 leading-relaxed ring-1 ring-amber-500/20">
                      {mechResult.warning}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-semibold text-cyan-300">MTF Dashboard</span>
                  <div className="space-y-1">
                    {(mechResult.dashboard || []).map((row) => (
                      <div
                        key={row.tf}
                        className="flex items-center justify-between rounded-lg bg-slate-900/60 px-2.5 py-1.5 text-xs font-mono"
                      >
                        <span className="text-slate-500 uppercase tracking-wide">{row.tf}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            row.trend === 1
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : row.trend === -1
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {row.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {mechResult.activeTrade && (
                  <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/35 to-slate-950/80 p-3.5 space-y-2.5">
                    <span className="text-[11px] font-semibold text-cyan-300 flex items-center">
                      <Target className="mr-1.5 h-3.5 w-3.5" />
                      Active Trade ({mechResult.activeTrade.dir === 1 ? 'LONG' : 'SHORT'})
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Entry</span>
                        <span>₹{Number(mechResult.activeTrade.entry).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Stop</span>
                        <span className="text-rose-400">₹{Number(mechResult.activeTrade.sl).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Target</span>
                        <span className="text-emerald-400">
                          ₹{Number(mechResult.activeTrade.target).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {mechResult.pending && !mechResult.activeTrade && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 space-y-2.5">
                    <span className="text-[11px] font-semibold text-cyan-300">Pending Setup</span>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Side</span>
                        <span>{mechResult.pending.dir === 1 ? 'BUY break' : 'SELL break'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Trigger</span>
                        <span>₹{Number(mechResult.pending.entry).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Invalid if</span>
                        <span>₹{Number(mechResult.pending.sl).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                  <span className="text-[11px] font-semibold text-slate-300">Session Stats</span>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">Setups</div>
                      <div className="mt-0.5 text-white font-bold">{mechResult.stats?.setups ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">Buys</div>
                      <div className="mt-0.5 text-emerald-400 font-bold">{mechResult.stats?.buys ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">Sells</div>
                      <div className="mt-0.5 text-rose-400 font-bold">{mechResult.stats?.sells ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">SL</div>
                      <div className="mt-0.5 text-rose-300 font-bold">{mechResult.stats?.stops ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">TP</div>
                      <div className="mt-0.5 text-emerald-400 font-bold">{mechResult.stats?.targets ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 px-1.5 py-2 ring-1 ring-slate-800/80">
                      <div className="text-slate-500">Opp Exit</div>
                      <div className="mt-0.5 text-amber-400 font-bold">{mechResult.stats?.oppositeExits ?? 0}</div>
                    </div>
                  </div>
                </div>

                {/* Recent BUY / SELL signals — same as Pine labels */}
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-semibold text-slate-300">Recent BUY / SELL</span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(mechResult.events || [])
                      .filter((e) => e.type === 'BUY' || e.type === 'SELL')
                      .slice(-8)
                      .reverse()
                      .map((e, idx) => (
                        <div
                          key={`${e.time}-${idx}`}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-mono ring-1 ${
                            e.type === 'BUY'
                              ? 'bg-emerald-950/30 ring-emerald-500/15'
                              : 'bg-rose-950/30 ring-rose-500/15'
                          }`}
                        >
                          <span
                            className={`font-bold ${e.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {e.type === 'BUY' ? '▲ BUY' : '▼ SELL'}
                          </span>
                          <span className="text-slate-300">₹{Number(e.price).toFixed(2)}</span>
                        </div>
                      ))}
                    {!(mechResult.events || []).some((e) => e.type === 'BUY' || e.type === 'SELL') && (
                      <p className="rounded-lg bg-slate-900/50 px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">
                        No entry yet · wait for MTF align + 2-candle setup breakout
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {overlayMode === 'smc' && stockData?.smcData?.activeBullishOB && (
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center">
                    <TrendingUp className="mr-1 h-3.5 w-3.5" /> Bullish Order Block
                  </span>
                  <span className="font-mono">{stockData.smcData.activeBullishOB.score}/100</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Entry:</span>
                    <span>₹{stockData.smcData.activeBullishOB.top}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Base (SL):</span>
                    <span>₹{stockData.smcData.activeBullishOB.bottom}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Vol Surge:</span>
                    <span>{stockData.smcData.activeBullishOB.volumeRatio}x</span>
                  </div>
                </div>
              </div>
            )}

            {overlayMode === 'smc' && stockData?.smcData?.activeBearishOB && (
              <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                  <span className="flex items-center">
                    <TrendingDown className="mr-1 h-3.5 w-3.5" /> Bearish Order Block
                  </span>
                  <span className="font-mono">{stockData.smcData.activeBearishOB.score}/100</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Entry:</span>
                    <span>₹{stockData.smcData.activeBearishOB.bottom}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Zone Top (SL):</span>
                    <span>₹{stockData.smcData.activeBearishOB.top}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Vol Surge:</span>
                    <span>{stockData.smcData.activeBearishOB.volumeRatio}x</span>
                  </div>
                </div>
              </div>
            )}

            {overlayMode === 'smc' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-cyan-400 flex items-center">
                  <Target className="mr-1.5 h-3.5 w-3.5" /> Liquidity Targets
                </span>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Buy-Side (BSL):</span>
                    <span className="text-cyan-300">₹{stockData?.smcData?.liquidity?.buySide?.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sell-Side (SSL):</span>
                    <span className="text-amber-400">₹{stockData?.smcData?.liquidity?.sellSide?.price}</span>
                  </div>
                </div>
              </div>
            )}

            {overlayMode === 'smc' && stockData?.smcData?.fvgs?.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center">
                  <Layers className="mr-1.5 h-3.5 w-3.5" /> Fair Value Gaps (FVG)
                </span>
                <div className="space-y-1 text-xs font-mono">
                  {stockData.smcData.fvgs.slice(0, 2).map((fvg, idx) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span>{fvg.type} FVG:</span>
                      <span className="text-white">₹{fvg.bottom} - ₹{fvg.top}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      {content}
    </div>
  );
}
