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
  return {
    time: c.time,
    open,
    high,
    low,
    close,
    volume: Number(c.volume) || 0
  };
}

/** Fyers / TradingView-style dark chart palette */
const FYERS_CHART = {
  bg: '#131722',
  text: '#d1d4dc',
  grid: '#1e222d',
  border: '#2a2e39',
  crosshair: '#758696',
  up: '#26a69a',
  down: '#ef5350',
  volumeUp: 'rgba(38, 166, 154, 0.45)',
  volumeDown: 'rgba(239, 83, 80, 0.45)'
};

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

function measureChartBox(el, { fillContainer, asPage }) {
  let width = el?.clientWidth || 0;
  let height = el?.clientHeight || 0;
  const parent = el?.parentElement;
  if (width < 40 && parent) width = parent.clientWidth || width;
  if (height < 80 && parent) height = parent.clientHeight || height;
  if (fillContainer) {
    if (height < 80) {
      height = Math.round(Math.min(448, Math.max(260, (window.innerHeight || 700) * 0.42)));
    }
    return { width: Math.max(width, 280), height: Math.max(height, 220) };
  }
  return {
    width: Math.max(width, 280),
    height: Math.max(asPage ? 560 : 480, height)
  };
}

function rightPadBars(span, width) {
  const narrow = width < 720;
  const ratio = narrow ? 0.02 : 0.04;
  const capped = narrow ? 2 : 5;
  return Math.min(capped, Math.max(1, Math.round(span * ratio)));
}

function applyDefaultTodayView(chart, formattedData, width = 0) {
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

  const span = Math.max(1, toIdx - fromIdx + 1);
  const pad = rightPadBars(span, width || 0);

  try {
    chart.timeScale().setVisibleLogicalRange({
      from: fromIdx - 0.5,
      to: toIdx + pad
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
  // Your SMC / structure logic
  orderBlocks: true,
  liquidity: true,
  fvg: false,
  sessionMarks: false,
  prevDayHL: false,
  equalHL: false,
  // Classic indicators (from Fyers / broker candles)
  ema9: false,
  ema21: false,
  sma20: false,
  sma50: false,
  bbands: false,
  vwap: false,
  supertrend: false,
  macd: false,
  rsi: false
};

const OVERLAY_STORAGE_KEY = 'tred_manual_chart_overlays_v3';

/** EMA from close prices */
export function computeEmaSeries(candles, period) {
  const out = [];
  if (!candles?.length || period < 1) return out;
  const k = 2 / (period + 1);
  let ema = null;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const close = Number(candles[i].close);
    if (!Number.isFinite(close)) continue;
    if (i < period) {
      sum += close;
      if (i === period - 1) {
        ema = sum / period;
        out.push({ time: candles[i].time, value: ema });
      }
      continue;
    }
    ema = close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: ema });
  }
  return out;
}

/** Simple moving average */
export function computeSmaSeries(candles, period) {
  const out = [];
  if (!candles?.length || period < 1) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += Number(candles[i].close);
    if (i >= period) sum -= Number(candles[i - period].close);
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

/** Bollinger Bands (SMA mid ± stdev * mult) */
export function computeBollinger(candles, period = 20, mult = 2) {
  const mid = [];
  const upper = [];
  const lower = [];
  if (!candles?.length || candles.length < period) return { mid, upper, lower };
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += Number(candles[j].close);
    const mean = sum / period;
    let varSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = Number(candles[j].close) - mean;
      varSum += d * d;
    }
    const sd = Math.sqrt(varSum / period);
    const t = candles[i].time;
    mid.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + mult * sd });
    lower.push({ time: t, value: mean - mult * sd });
  }
  return { mid, upper, lower };
}

/** Session VWAP (resets each IST day) */
export function computeVwapSeries(candles) {
  const out = [];
  if (!candles?.length) return out;
  let day = null;
  let cumPv = 0;
  let cumVol = 0;
  for (const c of candles) {
    const ymd = getIstParts(c.time).ymd;
    if (ymd !== day) {
      day = ymd;
      cumPv = 0;
      cumVol = 0;
    }
    const typical = (Number(c.high) + Number(c.low) + Number(c.close)) / 3;
    const vol = Math.max(Number(c.volume) || 0, 1);
    cumPv += typical * vol;
    cumVol += vol;
    out.push({ time: c.time, value: cumPv / cumVol });
  }
  return out;
}

/** ATR helper */
function computeAtr(candles, period) {
  const atr = new Array(candles.length).fill(null);
  if (candles.length < 2) return atr;
  const trs = [];
  for (let i = 0; i < candles.length; i++) {
    const h = Number(candles[i].high);
    const l = Number(candles[i].low);
    const prevC = i > 0 ? Number(candles[i - 1].close) : h;
    trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += trs[i];
    if (i === period - 1) atr[i] = sum / period;
    else if (i >= period) atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;
  }
  return atr;
}

/** Supertrend (period, multiplier) */
export function computeSupertrend(candles, period = 10, mult = 3) {
  const out = [];
  if (!candles?.length) return out;
  const atr = computeAtr(candles, period);
  let finalUpper = null;
  let finalLower = null;
  let trendUp = true;
  for (let i = 0; i < candles.length; i++) {
    if (atr[i] == null) continue;
    const hl2 = (Number(candles[i].high) + Number(candles[i].low)) / 2;
    const basicUpper = hl2 + mult * atr[i];
    const basicLower = hl2 - mult * atr[i];
    const close = Number(candles[i].close);
    if (finalUpper == null) {
      finalUpper = basicUpper;
      finalLower = basicLower;
    } else {
      finalUpper =
        basicUpper < finalUpper || Number(candles[i - 1].close) > finalUpper
          ? basicUpper
          : finalUpper;
      finalLower =
        basicLower > finalLower || Number(candles[i - 1].close) < finalLower
          ? basicLower
          : finalLower;
    }
    if (trendUp) {
      trendUp = close >= finalLower;
    } else {
      trendUp = close > finalUpper;
    }
    out.push({
      time: candles[i].time,
      value: trendUp ? finalLower : finalUpper,
      up: trendUp
    });
  }
  return out;
}

/** MACD (12, 26, 9) */
export function computeMacd(candles, fast = 12, slow = 26, signal = 9) {
  const macdLine = [];
  const signalLine = [];
  const hist = [];
  const emaFast = computeEmaSeries(candles, fast);
  const emaSlow = computeEmaSeries(candles, slow);
  if (!emaFast.length || !emaSlow.length) return { macdLine, signalLine, hist };

  const slowMap = new Map(emaSlow.map((p) => [p.time, p.value]));
  const raw = [];
  for (const p of emaFast) {
    if (!slowMap.has(p.time)) continue;
    raw.push({ time: p.time, value: p.value - slowMap.get(p.time) });
  }
  const sig = computeEmaSeries(
    raw.map((r) => ({ time: r.time, close: r.value })),
    signal
  );
  const sigMap = new Map(sig.map((p) => [p.time, p.value]));
  for (const r of raw) {
    macdLine.push({ time: r.time, value: r.value });
    if (sigMap.has(r.time)) {
      const s = sigMap.get(r.time);
      signalLine.push({ time: r.time, value: s });
      hist.push({
        time: r.time,
        value: r.value - s,
        color: r.value - s >= 0 ? 'rgba(38, 166, 154, 0.55)' : 'rgba(239, 83, 80, 0.55)'
      });
    }
  }
  return { macdLine, signalLine, hist };
}

/** Wilder RSI */
export function computeRsiSeries(candles, period = 14) {
  const out = [];
  if (!candles?.length || candles.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = Number(candles[i].close) - Number(candles[i - 1].close);
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;
  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  out.push({ time: candles[period].time, value: firstRsi });

  for (let i = period + 1; i < candles.length; i++) {
    const ch = Number(candles[i].close) - Number(candles[i - 1].close);
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    out.push({ time: candles[i].time, value: rsi });
  }
  return out;
}

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
  /** Optional: { ema9, ema21, rsi, ema9Period, ema21Period } for live tip updates */
  indicatorSeriesRef,
  asPage = false,
  fillContainer = false,
  overlays = DEFAULT_CHART_OVERLAYS,
  layoutKey = 'auto'
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const overlayKey = [
    overlays.orderBlocks,
    overlays.liquidity,
    overlays.fvg,
    overlays.sessionMarks,
    overlays.prevDayHL,
    overlays.equalHL,
    overlays.ema9,
    overlays.ema21,
    overlays.sma20,
    overlays.sma50,
    overlays.bbands,
    overlays.vwap,
    overlays.supertrend,
    overlays.macd,
    overlays.rsi
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
    const initialBox = measureChartBox(container, { fillContainer, asPage });
    const chart = createChart(container, {
      width: initialBox.width,
      height: initialBox.height,
      layout: {
        background: { color: FYERS_CHART.bg },
        textColor: FYERS_CHART.text,
        fontSize: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif"
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: formatIstCrosshairTime
      },
      grid: {
        vertLines: { color: FYERS_CHART.grid },
        horzLines: { color: FYERS_CHART.grid }
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: FYERS_CHART.crosshair,
          width: 1,
          style: 2,
          labelBackgroundColor: FYERS_CHART.border
        },
        horzLine: {
          color: FYERS_CHART.crosshair,
          width: 1,
          style: 2,
          labelBackgroundColor: FYERS_CHART.border
        }
      },
      timeScale: {
        borderColor: FYERS_CHART.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: formatIstTickMark,
        rightOffset: initialBox.width < 720 ? 4 : 8,
        minBarSpacing: 3,
        barSpacing: 7,
        fixLeftEdge: false,
        fixRightEdge: false
      },
      rightPriceScale: {
        borderColor: FYERS_CHART.border,
        scaleMargins: { top: 0.08, bottom: 0.22 }
      }
    });

    chartRef.current = chart;

    // Fyers-style solid candles (open/close based colors)
    const candleSeries = chart.addCandlestickSeries({
      upColor: FYERS_CHART.up,
      downColor: FYERS_CHART.down,
      borderVisible: false,
      wickUpColor: FYERS_CHART.up,
      wickDownColor: FYERS_CHART.down,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineWidth: 1,
      priceLineColor: 'rgba(117, 134, 150, 0.5)',
      priceLineStyle: 2
    });

    const paneStudy = overlays.rsi || overlays.macd;
    let volumeSeries = null;
    if (!paneStudy) {
      volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        borderVisible: false
      });
    } else {
      candleSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.28 }
      });
    }

    const formattedData = (stockData.candles || [])
      .filter((c) => isNseSessionCandle(c.time))
      .map((c) => sanitizeCandle(c))
      .filter(Boolean);

    if (!formattedData.length) {
      chart.remove();
      chartRef.current = null;
      return undefined;
    }

    const ohlcOnly = formattedData.map(({ time, open, high, low, close }) => ({
      time,
      open,
      high,
      low,
      close
    }));

    candleSeries.setData(ohlcOnly);
    if (volumeSeries) {
      volumeSeries.setData(
        formattedData.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? FYERS_CHART.volumeUp : FYERS_CHART.volumeDown
        }))
      );
    }
    if (seriesRef) seriesRef.current = candleSeries;
    if (currentCandleRef) {
      currentCandleRef.current = { ...ohlcOnly[ohlcOnly.length - 1] };
    }
    applyDefaultTodayView(chart, ohlcOnly, initialBox.width);

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

    // Classic indicators (computed from broker/Fyers candles)
    if (indicatorSeriesRef) {
      indicatorSeriesRef.current = {
        ema9: null,
        ema21: null,
        rsi: null,
        lastEma9: null,
        lastEma21: null,
        baseEma9: null,
        baseEma21: null
      };
    }

    const addLine = (data, color, title, width = 2) => {
      if (!data?.length) return null;
      const s = chart.addLineSeries({
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: true,
        title
      });
      s.setData(data);
      return s;
    };

    if (overlays.ema9) {
      const ema9 = computeEmaSeries(ohlcOnly, 9);
      const s = addLine(ema9, '#38bdf8', 'EMA 9');
      if (s && indicatorSeriesRef) {
        indicatorSeriesRef.current.ema9 = s;
        indicatorSeriesRef.current.lastEma9 = ema9[ema9.length - 1]?.value ?? null;
        indicatorSeriesRef.current.baseEma9 =
          ema9[ema9.length - 2]?.value ?? ema9[ema9.length - 1]?.value ?? null;
      }
    }
    if (overlays.ema21) {
      const ema21 = computeEmaSeries(ohlcOnly, 21);
      const s = addLine(ema21, '#fbbf24', 'EMA 21');
      if (s && indicatorSeriesRef) {
        indicatorSeriesRef.current.ema21 = s;
        indicatorSeriesRef.current.lastEma21 = ema21[ema21.length - 1]?.value ?? null;
        indicatorSeriesRef.current.baseEma21 =
          ema21[ema21.length - 2]?.value ?? ema21[ema21.length - 1]?.value ?? null;
      }
    }
    if (overlays.sma20) addLine(computeSmaSeries(ohlcOnly, 20), '#818cf8', 'SMA 20');
    if (overlays.sma50) addLine(computeSmaSeries(ohlcOnly, 50), '#f472b6', 'SMA 50', 2);

    if (overlays.bbands) {
      const bb = computeBollinger(ohlcOnly, 20, 2);
      addLine(bb.mid, '#94a3b8', 'BB Mid', 1);
      addLine(bb.upper, '#64748b', 'BB Upper', 1);
      addLine(bb.lower, '#64748b', 'BB Lower', 1);
    }

    if (overlays.vwap) {
      addLine(computeVwapSeries(formattedData), '#22d3ee', 'VWAP', 2);
    }

    if (overlays.supertrend) {
      const st = computeSupertrend(ohlcOnly, 10, 3);
      if (st.length) {
        // Split into up/down segments for color
        let buf = [];
        let mode = st[0].up;
        const flush = () => {
          if (buf.length < 2) {
            buf = [];
            return;
          }
          addLine(
            buf.map((p) => ({ time: p.time, value: p.value })),
            mode ? FYERS_CHART.up : FYERS_CHART.down,
            mode ? 'ST Up' : 'ST Down',
            2
          );
          buf = [];
        };
        for (const p of st) {
          if (p.up !== mode) {
            flush();
            mode = p.up;
          }
          buf.push(p);
        }
        flush();
      }
    }

    if (overlays.macd && !overlays.rsi) {
      const { macdLine, signalLine, hist } = computeMacd(ohlcOnly);
      if (macdLine.length) {
        const macdS = chart.addLineSeries({
          color: '#60a5fa',
          lineWidth: 2,
          priceScaleId: 'macd',
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'MACD'
        });
        const sigS = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          priceScaleId: 'macd',
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'Signal'
        });
        const histS = chart.addHistogramSeries({
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false
        });
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.78, bottom: 0 },
          borderVisible: false
        });
        macdS.setData(macdLine);
        sigS.setData(signalLine);
        histS.setData(hist);
      }
    }

    if (overlays.rsi) {
      const rsiData = computeRsiSeries(ohlcOnly, 14);
      if (rsiData.length) {
        const rsiSeries = chart.addLineSeries({
          color: '#a78bfa',
          lineWidth: 2,
          priceScaleId: 'rsi',
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'RSI 14'
        });
        chart.priceScale('rsi').applyOptions({
          scaleMargins: { top: 0.78, bottom: 0 },
          borderVisible: false
        });
        rsiSeries.setData(rsiData);
        rsiSeries.createPriceLine({
          price: 70,
          color: 'rgba(244, 63, 94, 0.45)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: ''
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: 'rgba(16, 185, 129, 0.45)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: ''
        });
        if (indicatorSeriesRef) indicatorSeriesRef.current.rsi = rsiSeries;
      }
    }

    let fittedOnce = false;
    const syncSize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const box = measureChartBox(containerRef.current, { fillContainer, asPage });
      chartRef.current.applyOptions({
        width: box.width,
        height: box.height,
        timeScale: {
          rightOffset: box.width < 720 ? 2 : 4
        }
      });
      if (!fittedOnce && box.width > 120 && box.height > 120) {
        fittedOnce = true;
        applyDefaultTodayView(chartRef.current, formattedData, box.width);
      }
    };
    syncSize();
    window.addEventListener('resize', syncSize);
    window.addEventListener('orientationchange', syncSize);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => syncSize());
      ro.observe(container);
      if (container.parentElement) ro.observe(container.parentElement);
    }

    return () => {
      window.removeEventListener('resize', syncSize);
      window.removeEventListener('orientationchange', syncSize);
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (seriesRef) seriesRef.current = null;
      if (currentCandleRef) currentCandleRef.current = null;
      if (indicatorSeriesRef) indicatorSeriesRef.current = null;
    };
  }, [
    stockData,
    timeframe,
    asPage,
    fillContainer,
    seriesRef,
    currentCandleRef,
    indicatorSeriesRef,
    overlayKey,
    layoutKey
  ]);

  // Full-page ChartFullLoader covers the site; keep a quiet placeholder here.
  if (loading) {
    return (
      <div
        className={`w-full flex-1 bg-[#131722] ${fillContainer ? 'h-full min-h-0' : 'min-h-[24rem]'}`}
        aria-hidden
      />
    );
  }

  // Prefer rendering candles even if a soft warning was set (list already had data).
  if (!stockData?.candles?.length) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-2 px-6 text-center ${
          fillContainer ? 'h-full min-h-0' : 'h-full min-h-[24rem]'
        }`}
      >
        <span className="text-sm font-semibold text-slate-300">No chart data</span>
        <span className="max-w-md text-xs text-slate-500">
          {error || 'Chart data unavailable — wait for your broker feed or try again.'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex w-full flex-col ${fillContainer ? 'h-full min-h-0' : 'h-full min-h-[24rem]'}`}
    >
      <div
        ref={containerRef}
        className={`w-full flex-1 rounded-md border border-[#2a2e39] bg-[#131722] ${
          fillContainer ? 'h-full min-h-0' : 'min-h-[24rem]'
        }`}
      />
    </div>
  );
}

export { getIstBucketStart, sanitizeCandle, isNseSessionCandle };
