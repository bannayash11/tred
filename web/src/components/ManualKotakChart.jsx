import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const IST_TZ = 'Asia/Kolkata';
const NSE_OPEN_MINS = 9 * 60 + 15;
const NSE_CLOSE_MINS = 15 * 60 + 30;
const TF_SECONDS = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900
};

function chartTimeToDate(time) {
  if (typeof time === 'string') {
    return new Date(`${time}T00:00:00+05:30`);
  }
  if (time && typeof time === 'object' && time.year) {
    return new Date(
      `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}T00:00:00+05:30`
    );
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

function isNseSessionCandle(unixSec) {
  const { isWeekend, mins } = getIstParts(unixSec);
  if (isWeekend) return false;
  return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
}

function sanitizeCandle(c) {
  const open = Number(c.open);
  const close = Number(c.close);
  let high = Number(c.high);
  let low = Number(c.low);
  if (![open, close, high, low].every(Number.isFinite)) return null;
  high = Math.max(high, open, close);
  low = Math.min(low, open, close);
  return { time: c.time, open, high, low, close };
}

function getIstBucketStart(unixSec, timeframe) {
  const step = TF_SECONDS[timeframe] || 300;
  const parts = getIstParts(unixSec);
  const dayStartUtc = Math.floor(new Date(`${parts.ymd}T00:00:00+05:30`).getTime() / 1000);
  const secsFromMidnight = unixSec - dayStartUtc;
  const bucket = Math.floor(secsFromMidnight / step) * step;
  return dayStartUtc + bucket;
}

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

function applyDefaultTodayView(chart, formattedData) {
  if (!formattedData.length) return;

  const todayYmd = getIstParts(Math.floor(Date.now() / 1000)).ymd;
  let sessionYmd = null;
  for (let i = formattedData.length - 1; i >= 0; i--) {
    const ymd = getIstParts(formattedData[i].time).ymd;
    if (ymd === todayYmd || sessionYmd == null) {
      sessionYmd = ymd;
      if (ymd === todayYmd) break;
    }
  }

  let fromIdx = -1;
  let toIdx = -1;
  for (let i = 0; i < formattedData.length; i++) {
    if (getIstParts(formattedData[i].time).ymd !== sessionYmd) continue;
    if (fromIdx < 0) fromIdx = i;
    toIdx = i;
  }

  if (fromIdx < 0 || toIdx < fromIdx) {
    chart.timeScale().fitContent();
    return;
  }

  try {
    chart.timeScale().setVisibleLogicalRange({
      from: fromIdx - 0.5,
      to: toIdx + 8
    });
  } catch {
    chart.timeScale().fitContent();
  }
}

/** Previous completed IST session high / low from candle list */
function computePrevDayHL(formattedData) {
  if (!formattedData.length) return null;
  const byDay = new Map();
  for (const c of formattedData) {
    const ymd = getIstParts(c.time).ymd;
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd).push(c);
  }
  const days = [...byDay.keys()].sort();
  if (days.length < 2) return null;
  const prev = byDay.get(days[days.length - 2]);
  if (!prev?.length) return null;
  return {
    high: Math.max(...prev.map((c) => c.high)),
    low: Math.min(...prev.map((c) => c.low)),
    ymd: days[days.length - 2]
  };
}

function sessionOpenMarkers(formattedData) {
  const seen = new Set();
  const markers = [];
  for (const c of formattedData) {
    const ymd = getIstParts(c.time).ymd;
    if (seen.has(ymd)) continue;
    seen.add(ymd);
    markers.push({
      time: c.time,
      position: 'belowBar',
      color: '#64748b',
      shape: 'arrowUp',
      text: 'Open'
    });
  }
  return markers;
}

export const DEFAULT_CHART_OVERLAYS = {
  orderBlocks: true,
  liquidity: true,
  fvg: false,
  sessionMarks: false,
  prevDayHL: false,
  equalHL: false
};

const OVERLAY_STORAGE_KEY = 'tred_manual_chart_overlays_v1';

export function loadSavedOverlays() {
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHART_OVERLAYS };
    return { ...DEFAULT_CHART_OVERLAYS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CHART_OVERLAYS };
  }
}

export function saveOverlays(overlays) {
  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlays));
  } catch {
    /* ignore quota / private mode */
  }
}

function findPivotEquals(formattedData, left = 2, right = 2, tolPct = 0.08) {
  const highs = [];
  const lows = [];
  for (let i = left; i < formattedData.length - right; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (formattedData[j].high >= formattedData[i].high) isH = false;
      if (formattedData[j].low <= formattedData[i].low) isL = false;
    }
    if (isH) highs.push(formattedData[i].high);
    if (isL) lows.push(formattedData[i].low);
  }

  const cluster = (vals) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const used = new Set();
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      const group = [sorted[i]];
      used.add(i);
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        const mid = group.reduce((s, v) => s + v, 0) / group.length;
        if ((Math.abs(sorted[j] - mid) / mid) * 100 <= tolPct) {
          group.push(sorted[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) {
        out.push({
          price: group.reduce((s, v) => s + v, 0) / group.length,
          count: group.length
        });
      }
    }
    return out.slice(0, 3);
  };

  return { equalHighs: cluster(highs), equalLows: cluster(lows) };
}

/** Build flat list of structure prices for nearest-level distance */
export function collectStructureLevels(stockData, overlays = DEFAULT_CHART_OVERLAYS) {
  const levels = [];
  const smc = stockData?.smcData;
  if (!smc) return levels;

  if (overlays.orderBlocks !== false) {
    if (smc.activeBullishOB) {
      levels.push({ label: 'Bullish OB Top', price: Number(smc.activeBullishOB.top) });
      levels.push({ label: 'Bullish OB Base', price: Number(smc.activeBullishOB.bottom) });
    }
    if (smc.activeBearishOB) {
      levels.push({ label: 'Bearish OB Base', price: Number(smc.activeBearishOB.bottom) });
      levels.push({ label: 'Bearish OB Top', price: Number(smc.activeBearishOB.top) });
    }
  }
  if (overlays.liquidity !== false) {
    if (smc.liquidity?.buySide?.price) {
      levels.push({ label: 'Buy-Side Liquidity', price: Number(smc.liquidity.buySide.price) });
    }
    if (smc.liquidity?.sellSide?.price) {
      levels.push({ label: 'Sell-Side Liquidity', price: Number(smc.liquidity.sellSide.price) });
    }
  }
  if (overlays.fvg && Array.isArray(smc.fvgs)) {
    smc.fvgs.slice(-3).forEach((fvg, idx) => {
      levels.push({ label: `FVG${idx + 1} Top`, price: Number(fvg.top) });
      levels.push({ label: `FVG${idx + 1} Base`, price: Number(fvg.bottom) });
    });
  }
  return levels.filter((l) => Number.isFinite(l.price));
}

export function findNearestLevel(price, stockData, overlays) {
  const px = Number(price);
  if (!Number.isFinite(px)) return null;
  const levels = collectStructureLevels(stockData, overlays);
  if (!levels.length) return null;
  let best = null;
  for (const level of levels) {
    const diff = level.price - px;
    const abs = Math.abs(diff);
    if (!best || abs < best.abs) {
      best = {
        label: level.label,
        level: level.price,
        diff,
        abs,
        pct: (abs / px) * 100
      };
    }
  }
  return best;
}

/**
 * Kotak / manual Lightweight Charts — last N days + OB / liquidity lines.
 * Live candle updates via seriesRef for parent socket ticks.
 */
export default function ManualKotakChart({
  stockData,
  timeframe = '5m',
  loading = false,
  error = '',
  seriesRef,
  currentCandleRef,
  asPage = false,
  overlays = DEFAULT_CHART_OVERLAYS
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const overlayKey = [
    overlays.orderBlocks,
    overlays.liquidity,
    overlays.fvg,
    overlays.sessionMarks,
    overlays.prevDayHL,
    overlays.equalHL
  ].join('|');

  useEffect(() => {
    if (!stockData?.candles?.length || !containerRef.current) return undefined;
    if (stockData.dataSource !== 'live') return undefined;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      if (seriesRef) seriesRef.current = null;
      if (currentCandleRef) currentCandleRef.current = null;
    }

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: Math.max(asPage ? 560 : 480, container.clientHeight || 0),
      layout: {
        background: { color: '#090d16' },
        textColor: '#94a3b8'
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: formatIstCrosshairTime
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#06b6d4', width: 1, style: 2 },
        horzLine: { color: '#06b6d4', width: 1, style: 2 }
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: formatIstTickMark,
        rightOffset: 4,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false
      },
      rightPriceScale: {
        borderColor: '#1e293b'
      }
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444'
    });

    const formattedData = (stockData.candles || [])
      .filter((c) => isNseSessionCandle(c.time))
      .map((c) => sanitizeCandle(c))
      .filter(Boolean);

    if (!formattedData.length) {
      chart.remove();
      chartRef.current = null;
      return undefined;
    }

    candleSeries.setData(formattedData);
    if (seriesRef) seriesRef.current = candleSeries;
    if (currentCandleRef) {
      currentCandleRef.current = { ...formattedData[formattedData.length - 1] };
    }
    applyDefaultTodayView(chart, formattedData);

    const smc = stockData.smcData;
    const markers = [];

    if (overlays.orderBlocks) {
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
          title: 'Bullish OB Base'
        });
      }
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
          title: 'Bearish OB Top'
        });
      }
    }

    if (overlays.liquidity) {
      if (smc?.liquidity?.buySide?.price) {
        candleSeries.createPriceLine({
          price: smc.liquidity.buySide.price,
          color: '#06b6d4',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'Buy-Side Liquidity'
        });
      }
      if (smc?.liquidity?.sellSide?.price) {
        candleSeries.createPriceLine({
          price: smc.liquidity.sellSide.price,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'Sell-Side Liquidity'
        });
      }
    }

    if (overlays.fvg && Array.isArray(smc?.fvgs)) {
      smc.fvgs.slice(-3).forEach((fvg, idx) => {
        const bull = String(fvg.type).toUpperCase().includes('BULL');
        const color = bull ? '#34d399' : '#fb7185';
        candleSeries.createPriceLine({
          price: Number(fvg.top),
          color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `FVG${idx + 1} Top`
        });
        candleSeries.createPriceLine({
          price: Number(fvg.bottom),
          color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `FVG${idx + 1} Base`
        });
      });
    }

    if (overlays.prevDayHL) {
      const pd = computePrevDayHL(formattedData);
      if (pd) {
        candleSeries.createPriceLine({
          price: pd.high,
          color: '#a78bfa',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'Prev Day High'
        });
        candleSeries.createPriceLine({
          price: pd.low,
          color: '#c084fc',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'Prev Day Low'
        });
      }
    }

    if (overlays.equalHL) {
      const { equalHighs, equalLows } = findPivotEquals(formattedData);
      equalHighs.forEach((eq, idx) => {
        candleSeries.createPriceLine({
          price: eq.price,
          color: '#38bdf8',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Eq High ${idx + 1} (${eq.count}x)`
        });
      });
      equalLows.forEach((eq, idx) => {
        candleSeries.createPriceLine({
          price: eq.price,
          color: '#fbbf24',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Eq Low ${idx + 1} (${eq.count}x)`
        });
      });
    }

    if (overlays.sessionMarks) {
      markers.push(...sessionOpenMarkers(formattedData));
    }

    candleSeries.setMarkers(markers);

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (seriesRef) seriesRef.current = null;
      if (currentCandleRef) currentCandleRef.current = null;
    };
  }, [stockData, timeframe, asPage, seriesRef, currentCandleRef, overlayKey]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        <p className="text-xs text-slate-400">Loading Kotak {timeframe} candles…</p>
      </div>
    );
  }

  if (error || !stockData?.candles?.length) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-sm font-semibold text-slate-300">No Kotak chart data</span>
        <span className="max-w-md text-xs text-slate-500">
          {error || 'Switch to TradingView for full history, or wait for Kotak feed.'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[24rem] w-full flex-col">
      <div ref={containerRef} className="min-h-[24rem] w-full flex-1 rounded-lg border border-slate-800/50" />
    </div>
  );
}

export { getIstBucketStart, sanitizeCandle, isNseSessionCandle };
