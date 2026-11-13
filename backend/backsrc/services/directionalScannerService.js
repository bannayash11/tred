/**
 * Directional F&O Scanner (new page only)
 *
 * Step B — stock behaviour baseline (ATR, body, range, volume, RVOL)
 * Step C — chop filters (efficiency, overlap, range ratio, ADX)
 * Step D — weighted ranking → Top bullish / bearish + compression / rejected
 *
 * Does not modify the existing Order Block screener or Opening Momentum engine.
 */

const DEFAULT_SETTINGS = {
  atrPeriod: 20,
  avgPeriod: 20,
  efficiencyLookback: 10,
  overlapLookback: 10,
  adxPeriod: 14,
  rejectEfficiencyBelow: 0.2,
  strongEfficiencyAbove: 0.45,
  lowActivityBelow: 0.5,
  topCount: 10,
  weights: {
    efficiency: 0.3,
    rvol: 0.25,
    expansion: 0.2,
    adx: 0.15,
    body: 0.1
  }
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function round(v, digits = 2) {
  const f = 10 ** digits;
  return Math.round(num(v) * f) / f;
}

function trueRange(candle, prevClose) {
  const high = num(candle.high);
  const low = num(candle.low);
  const closePrev = num(prevClose, high);
  return Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
}

function sma(values, period) {
  if (!values.length) return 0;
  const slice = values.slice(-period);
  if (!slice.length) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function normalizeScore(value, softMax) {
  if (!(softMax > 0)) return 0;
  return clamp((num(value) / softMax) * 100, 0, 100);
}

function efficiencyRatio(candles, lookback) {
  if (candles.length < lookback + 1) return null;
  const window = candles.slice(-(lookback + 1));
  const net = Math.abs(num(window[window.length - 1].close) - num(window[0].close));
  let path = 0;
  for (let i = 1; i < window.length; i += 1) {
    path += Math.abs(num(window[i].close) - num(window[i - 1].close));
  }
  if (path <= 0) return 0;
  return net / path;
}

function averageOverlap(candles, lookback) {
  if (candles.length < 2) return null;
  const n = Math.min(lookback, candles.length - 1);
  let sum = 0;
  let count = 0;
  for (let i = candles.length - n; i < candles.length; i += 1) {
    const a = candles[i];
    const b = candles[i - 1];
    const overlap = Math.max(0, Math.min(num(a.high), num(b.high)) - Math.max(num(a.low), num(b.low)));
    const union = Math.max(num(a.high), num(b.high)) - Math.min(num(a.low), num(b.low));
    if (union > 0) {
      sum += overlap / union;
      count += 1;
    }
  }
  return count ? sum / count : null;
}

function computeAdx(candles, period = 14) {
  if (candles.length < period + 2) return null;

  const plusDm = [];
  const minusDm = [];
  const trs = [];

  for (let i = 1; i < candles.length; i += 1) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const upMove = num(cur.high) - num(prev.high);
    const downMove = num(prev.low) - num(cur.low);
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(trueRange(cur, prev.close));
  }

  if (trs.length < period) return null;

  let atr = sma(trs.slice(0, period), period);
  let smPlus = sma(plusDm.slice(0, period), period);
  let smMinus = sma(minusDm.slice(0, period), period);
  const dxValues = [];

  const pushDx = () => {
    const plusDi = atr > 0 ? (100 * smPlus) / atr : 0;
    const minusDi = atr > 0 ? (100 * smMinus) / atr : 0;
    const diSum = plusDi + minusDi;
    const dx = diSum > 0 ? (100 * Math.abs(plusDi - minusDi)) / diSum : 0;
    dxValues.push(dx);
  };

  pushDx();

  for (let i = period; i < trs.length; i += 1) {
    atr = (atr * (period - 1) + trs[i]) / period;
    smPlus = (smPlus * (period - 1) + plusDm[i]) / period;
    smMinus = (smMinus * (period - 1) + minusDm[i]) / period;
    pushDx();
  }

  if (!dxValues.length) return null;
  const adx = sma(dxValues.slice(-period), Math.min(period, dxValues.length));
  return round(adx, 1);
}

function mergeSettings(overrides = {}) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...overrides,
    weights: { ...DEFAULT_SETTINGS.weights, ...(overrides.weights || {}) }
  };
  next.atrPeriod = clamp(Math.round(num(next.atrPeriod, 20)), 5, 50);
  next.avgPeriod = clamp(Math.round(num(next.avgPeriod, 20)), 5, 50);
  next.efficiencyLookback = clamp(Math.round(num(next.efficiencyLookback, 10)), 3, 30);
  next.overlapLookback = clamp(Math.round(num(next.overlapLookback, 10)), 3, 30);
  next.adxPeriod = clamp(Math.round(num(next.adxPeriod, 14)), 7, 30);
  next.rejectEfficiencyBelow = clamp(num(next.rejectEfficiencyBelow, 0.2), 0.05, 0.5);
  next.strongEfficiencyAbove = clamp(num(next.strongEfficiencyAbove, 0.45), 0.2, 0.9);
  next.lowActivityBelow = clamp(num(next.lowActivityBelow, 0.5), 0.1, 1);
  next.topCount = clamp(Math.round(num(next.topCount, 10)), 3, 30);
  return next;
}

function analyzeStock(stock, settings) {
  if (!stock || stock.sector === 'Indices') return null;

  const rawCandles = Array.isArray(stock.candles) ? stock.candles : [];
  if (rawCandles.length < settings.atrPeriod + 2) return null;

  // Baseline uses completed candles only; keep last candle for "current" activity.
  const completed = rawCandles.slice(0, -1);
  const current = rawCandles[rawCandles.length - 1];
  if (completed.length < settings.atrPeriod + 1) return null;

  const trs = [];
  const bodies = [];
  const ranges = [];
  const volumes = [];

  for (let i = 1; i < completed.length; i += 1) {
    const c = completed[i];
    const prev = completed[i - 1];
    trs.push(trueRange(c, prev.close));
    bodies.push(Math.abs(num(c.close) - num(c.open)));
    ranges.push(Math.max(0, num(c.high) - num(c.low)));
    volumes.push(Math.max(0, num(c.volume, 0)));
  }

  const atr = sma(trs, settings.atrPeriod);
  const avgBody = sma(bodies, settings.avgPeriod);
  const avgRange = sma(ranges, settings.avgPeriod);
  const avgVolume = sma(volumes, settings.avgPeriod);

  const currentTr = trueRange(current, completed[completed.length - 1].close);
  const currentBody = Math.abs(num(current.close) - num(current.open));
  const currentVolume = Math.max(num(current.volume, 0), num(stock.volume, 0));
  const rvol = avgVolume > 0 ? currentVolume / avgVolume : 0;
  const rangeRatio = atr > 0 ? currentTr / atr : 0;
  const bodyStrength = avgBody > 0 ? currentBody / avgBody : 0;

  const er = efficiencyRatio(completed, settings.efficiencyLookback);
  const overlap = averageOverlap(completed, settings.overlapLookback);
  const adx = computeAdx(completed, settings.adxPeriod);

  if (er == null) return null;

  const lookback = Math.min(settings.efficiencyLookback, completed.length - 1);
  const netMove = num(completed[completed.length - 1].close) - num(completed[completed.length - 1 - lookback].close);
  const direction = netMove >= 0 ? 'BULLISH' : 'BEARISH';

  let status = 'PASSED';
  let reason = 'Directional move vs own baseline';

  if (er < settings.rejectEfficiencyBelow) {
    status = 'REJECTED';
    reason = `Efficiency ${round(er, 2)} below ${settings.rejectEfficiencyBelow} (choppy)`;
  } else if (rangeRatio < settings.lowActivityBelow && er < settings.strongEfficiencyAbove) {
    status = 'COMPRESSED';
    reason = `Low activity (range ratio ${round(rangeRatio, 2)}) — consolidation watch`;
  }

  const erScore = normalizeScore(er, 1);
  const rvolScore = normalizeScore(Math.min(rvol, 3), 3);
  const expansionScore = normalizeScore(Math.min(rangeRatio, 2.5), 2.5);
  const adxScore = normalizeScore(adx ?? 0, 40);
  const bodyScore = normalizeScore(Math.min(bodyStrength, 2.5), 2.5);

  const w = settings.weights;
  const score = round(
    erScore * w.efficiency +
      rvolScore * w.rvol +
      expansionScore * w.expansion +
      adxScore * w.adx +
      bodyScore * w.body,
    1
  );

  const ltp = num(stock.currentPrice) || num(current.close);

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    ltp: round(ltp, 2),
    change: round(stock.change, 2),
    direction,
    status,
    reason,
    score,
    atr: round(atr, 2),
    avgBody: round(avgBody, 2),
    avgRange: round(avgRange, 2),
    avgVolume: Math.round(avgVolume),
    currentVolume: Math.round(currentVolume),
    rvol: round(rvol, 2),
    efficiency: round(er, 2),
    overlap: overlap == null ? null : round(overlap, 2),
    rangeRatio: round(rangeRatio, 2),
    bodyStrength: round(bodyStrength, 2),
    adx: adx == null ? null : adx,
    netMovePercent: round((netMove / Math.max(1e-9, num(completed[completed.length - 1 - lookback].close))) * 100, 2),
    components: {
      efficiency: round(erScore, 1),
      rvol: round(rvolScore, 1),
      expansion: round(expansionScore, 1),
      adx: round(adxScore, 1),
      body: round(bodyScore, 1)
    }
  };
}

export class DirectionalScannerService {
  constructor() {
    this.settings = mergeSettings();
  }

  getSettings() {
    return { ...this.settings, weights: { ...this.settings.weights } };
  }

  updateSettings(partial = {}) {
    this.settings = mergeSettings({ ...this.settings, ...partial });
    return this.getSettings();
  }

  scan(stocksMap, overrides = {}) {
    const settings = mergeSettings({ ...this.settings, ...overrides });
    const rows = [];

    for (const stock of stocksMap.values()) {
      const row = analyzeStock(stock, settings);
      if (row) rows.push(row);
    }

    const rejected = rows
      .filter((r) => r.status === 'REJECTED')
      .sort((a, b) => a.efficiency - b.efficiency);

    const compressed = rows
      .filter((r) => r.status === 'COMPRESSED')
      .sort((a, b) => a.rangeRatio - b.rangeRatio);

    const passed = rows.filter((r) => r.status === 'PASSED').sort((a, b) => b.score - a.score);

    const bullish = passed
      .filter((r) => r.direction === 'BULLISH')
      .slice(0, settings.topCount)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const bearish = passed
      .filter((r) => r.direction === 'BEARISH')
      .slice(0, settings.topCount)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return {
      bullish,
      bearish,
      compressed: compressed.slice(0, settings.topCount).map((r, i) => ({ ...r, rank: i + 1 })),
      rejected: rejected.slice(0, settings.topCount).map((r, i) => ({ ...r, rank: i + 1 })),
      stats: {
        totalScanned: rows.length,
        passed: passed.length,
        rejected: rejected.length,
        compressed: compressed.length,
        bullishCount: passed.filter((r) => r.direction === 'BULLISH').length,
        bearishCount: passed.filter((r) => r.direction === 'BEARISH').length,
        avgScore: passed.length ? round(passed.reduce((s, r) => s + r.score, 0) / passed.length, 1) : 0
      },
      settings,
      timestamp: Date.now()
    };
  }
}

export const directionalScannerService = new DirectionalScannerService();
