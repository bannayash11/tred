/**
 * AlphaMove 2 — Maximum Movement Scanner (F&O)
 *
 * Objective: find stocks most likely to produce the largest directional move
 * after the first 5-minute candle (09:20 IST). Opening candle size is NOT a gate.
 *
 * Score weights (0–100 potential score):
 *   Historical post-9:20 movement …… 30%
 *   Historical directional efficiency … 25%
 *   Today's relative opening volume … 20%
 *   Today's opening directional conviction … 25%
 */

import { marketParts } from './orderFlow/marketSession.js';

const OPENING_CANDLE_MINS = 9 * 60 + 15; // 09:15 bar closes at 09:20
const POST_OPEN_MINS = 9 * 60 + 20;

const DEFAULT_SETTINGS = {
  topCount: 10,
  histSessions: 20,
  softMaxHistMove: 5, // % used to normalize historical move to 0–100
  weights: {
    histMove: 0.3,
    histEfficiency: 0.25,
    openRvol: 0.2,
    openConviction: 0.25
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

function candleUnixSec(candle) {
  const t = Number(candle?.time);
  if (!Number.isFinite(t) || t <= 0) return null;
  return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
}

function normalizeScore(value, softMax) {
  if (!(softMax > 0)) return 0;
  return clamp((num(value) / softMax) * 100, 0, 100);
}

function mergeSettings(overrides = {}) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...overrides,
    weights: { ...DEFAULT_SETTINGS.weights, ...(overrides.weights || {}) }
  };
  next.topCount = clamp(Math.round(num(next.topCount, 10)), 3, 30);
  next.histSessions = clamp(Math.round(num(next.histSessions, 20)), 1, 40);
  next.softMaxHistMove = clamp(num(next.softMaxHistMove, 5), 1, 15);
  return next;
}

function groupCandlesBySession(candles = []) {
  const sessions = new Map();
  for (const candle of candles) {
    const unix = candleUnixSec(candle);
    if (unix == null) continue;
    const parts = marketParts(unix * 1000);
    if (parts.weekday === 0 || parts.weekday === 6) continue;
    if (parts.minuteOfDay < OPENING_CANDLE_MINS || parts.minuteOfDay > 15 * 60 + 40) continue;
    if (!sessions.has(parts.dateKey)) sessions.set(parts.dateKey, []);
    sessions.get(parts.dateKey).push({ candle, minuteOfDay: parts.minuteOfDay, unix });
  }
  for (const list of sessions.values()) {
    list.sort((a, b) => a.unix - b.unix);
  }
  return sessions;
}

function pickOpeningBar(sessionBars = []) {
  let exact = null;
  let first = null;
  for (const bar of sessionBars) {
    if (bar.minuteOfDay === OPENING_CANDLE_MINS) {
      exact = bar;
      break;
    }
    if (!first && bar.minuteOfDay >= OPENING_CANDLE_MINS && bar.minuteOfDay < OPENING_CANDLE_MINS + 5) {
      first = bar;
    }
  }
  return exact || first || null;
}

/**
 * Session stats after 09:20:
 * Movement = (high - low) / prevClose * 100  (post-open range)
 * Efficiency = |close_end - close_920| / sum |Δclose|
 */
function analyzeSession(sessionBars, prevCloseHint = null) {
  if (!sessionBars?.length) return null;
  const opening = pickOpeningBar(sessionBars);
  if (!opening) return null;

  const openClose = num(opening.candle.close);
  const openOpen = num(opening.candle.open);
  const openHigh = num(opening.candle.high);
  const openLow = num(opening.candle.low);
  const openVol = Math.max(0, num(opening.candle.volume, 0));
  if (!(openClose > 0)) return null;

  const postBars = sessionBars.filter((b) => b.unix > opening.unix || b.minuteOfDay >= POST_OPEN_MINS);
  const trail = postBars.length ? postBars : sessionBars.slice(sessionBars.indexOf(opening));

  let high = openHigh;
  let low = openLow;
  for (const bar of trail) {
    high = Math.max(high, num(bar.candle.high));
    low = Math.min(low, num(bar.candle.low));
  }

  const endClose = num(trail[trail.length - 1]?.candle?.close, openClose);
  const prevClose = num(prevCloseHint, openOpen) || openOpen;
  const movement = prevClose > 0 ? ((high - low) / prevClose) * 100 : 0;

  let path = 0;
  let prev = openClose;
  for (const bar of trail) {
    const c = num(bar.candle.close);
    path += Math.abs(c - prev);
    prev = c;
  }
  const net = Math.abs(endClose - openClose);
  const efficiency = path > 0 ? net / path : 0;

  const body = Math.abs(openClose - openOpen);
  const range = Math.max(openHigh - openLow, 1e-9);
  const bodyStrength = body / range;
  const closePos = (openClose - openLow) / range; // 1 = closed at high
  const gapPct = prevClose > 0 ? ((openOpen - prevClose) / prevClose) * 100 : 0;
  const openDirPct = prevClose > 0 ? ((openClose - prevClose) / prevClose) * 100 : 0;

  return {
    dateKey: marketParts(opening.unix * 1000).dateKey,
    openClose,
    openVol,
    movement: round(movement, 3),
    efficiency: round(efficiency, 3),
    bodyStrength: round(bodyStrength, 3),
    closePos: round(closePos, 3),
    gapPct: round(gapPct, 3),
    openDirPct: round(openDirPct, 3),
    endClose,
    barCount: trail.length
  };
}

function avg(values = []) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function analyzeStock(stock, settings, marketBias = 0) {
  if (!stock || stock.sector === 'Indices') return null;

  const sessions = groupCandlesBySession(stock.candles || []);
  const dateKeys = Array.from(sessions.keys()).sort();
  if (!dateKeys.length) return null;

  const todayKey = marketParts(Date.now()).dateKey;
  const sessionStats = [];
  let prevCloseHint = num(stock.prevClose) || null;

  for (const dateKey of dateKeys) {
    const stats = analyzeSession(sessions.get(dateKey), prevCloseHint);
    if (stats) {
      sessionStats.push(stats);
      prevCloseHint = stats.endClose;
    }
  }

  if (!sessionStats.length) return null;

  const todayStats = sessionStats.find((s) => s.dateKey === todayKey) || sessionStats[sessionStats.length - 1];
  const histStats = sessionStats.filter((s) => s.dateKey !== todayStats.dateKey).slice(-settings.histSessions);
  // If only today exists, use today as weak historical baseline (still ranks relative to peers)
  const histPool = histStats.length ? histStats : [todayStats];

  const histMove = avg(histPool.map((s) => s.movement));
  const histEfficiency = avg(histPool.map((s) => s.efficiency));
  const avgOpenVol = avg(histPool.map((s) => s.openVol).filter((v) => v > 0));

  const openRvol = avgOpenVol > 0 ? todayStats.openVol / avgOpenVol : todayStats.openVol > 0 ? 1 : 0;

  // Opening conviction: body + close position + gap/dir alignment (no size gate)
  const dirSign = todayStats.openDirPct >= 0 ? 1 : -1;
  const gapAlign = todayStats.gapPct === 0 ? 0.5 : Math.sign(todayStats.gapPct) === dirSign ? 1 : 0.25;
  const closeBias = dirSign >= 0 ? todayStats.closePos : 1 - todayStats.closePos;
  const openConvictionRaw =
    todayStats.bodyStrength * 40 + closeBias * 35 + gapAlign * 15 + Math.min(Math.abs(todayStats.openDirPct) * 8, 10);

  const marketAlign =
    marketBias === 0
      ? 0.5
      : Math.sign(marketBias) === dirSign
        ? 1
        : Math.sign(marketBias) === -dirSign
          ? 0
          : 0.5;

  const histMoveScore = normalizeScore(histMove, settings.softMaxHistMove);
  const histEffScore = normalizeScore(histEfficiency, 1);
  const openRvolScore = normalizeScore(Math.min(openRvol, 3), 3);
  const openConvScore = clamp(openConvictionRaw, 0, 100);
  // Fold a light market-alignment nudge into conviction (keeps 4-factor model, uses index bias)
  const convictionWithMarket = clamp(openConvScore * 0.9 + marketAlign * 10, 0, 100);

  const w = settings.weights;
  const score = round(
    histMoveScore * w.histMove +
      histEffScore * w.histEfficiency +
      openRvolScore * w.openRvol +
      convictionWithMarket * w.openConviction,
    1
  );

  const direction = todayStats.openDirPct >= 0 ? 'BULLISH' : 'BEARISH';
  const ltp = num(stock.currentPrice) || num(todayStats.endClose) || num(todayStats.openClose);

  const reasonParts = [
    `Hist move ${round(histMove, 2)}%`,
    `Eff ${round(histEfficiency, 2)}`,
    `ORVOL ${round(openRvol, 2)}x`
  ];

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    ltp: round(ltp, 2),
    change: round(stock.change, 2),
    direction,
    status: 'PASSED',
    reason: reasonParts.join(' · '),
    score,
    histMove: round(histMove, 2),
    efficiency: round(histEfficiency, 2),
    openRvol: round(openRvol, 2),
    openConviction: round(convictionWithMarket, 1),
    openDirPct: round(todayStats.openDirPct, 2),
    gapPct: round(todayStats.gapPct, 2),
    bodyStrength: round(todayStats.bodyStrength, 2),
    sessionsUsed: histPool.length,
    components: {
      histMove: round(histMoveScore, 1),
      histEfficiency: round(histEffScore, 1),
      openRvol: round(openRvolScore, 1),
      openConviction: round(convictionWithMarket, 1)
    }
  };
}

function indexBias(stocksMap) {
  const nifty = stocksMap.get('NIFTY 50') || stocksMap.get('NIFTY');
  const bank = stocksMap.get('BANKNIFTY') || stocksMap.get('NIFTY BANK');
  const changes = [num(nifty?.change), num(bank?.change)].filter((v) => Number.isFinite(v) && v !== 0);
  if (!changes.length) return 0;
  return avg(changes);
}

export class AlphaMove2Service {
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
    const bias = indexBias(stocksMap);
    const rows = [];

    for (const stock of stocksMap.values()) {
      const row = analyzeStock(stock, settings, bias);
      if (row) rows.push(row);
    }

    const sorted = rows.sort((a, b) => b.score - a.score);
    const bullish = sorted
      .filter((r) => r.direction === 'BULLISH')
      .slice(0, settings.topCount)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const bearish = sorted
      .filter((r) => r.direction === 'BEARISH')
      .slice(0, settings.topCount)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return {
      bullish,
      bearish,
      compressed: [],
      rejected: [],
      stats: {
        totalScanned: rows.length,
        passed: rows.length,
        rejected: 0,
        compressed: 0,
        bullishCount: sorted.filter((r) => r.direction === 'BULLISH').length,
        bearishCount: sorted.filter((r) => r.direction === 'BEARISH').length,
        avgScore: rows.length ? round(rows.reduce((s, r) => s + r.score, 0) / rows.length, 1) : 0,
        avgHistMove: rows.length ? round(rows.reduce((s, r) => s + r.histMove, 0) / rows.length, 2) : 0,
        marketBias: round(bias, 2)
      },
      settings,
      timestamp: Date.now()
    };
  }
}

export const alphaMove2Service = new AlphaMove2Service();
