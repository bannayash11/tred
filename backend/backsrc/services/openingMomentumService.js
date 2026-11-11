import { Settings } from '../models/Settings.js';
import { marketParts, isTradingDay } from './orderFlow/marketSession.js';

/**
 * Opening 5-Minute Momentum Scanner Engine
 *
 * Captures the first 5-minute candle (09:15 - 09:20 AM IST) for the F&O stock universe,
 * freezes the 09:20 AM closing price as the static reference price,
 * and continuously ranks Top 10 Bullish Gainers & Top 10 Bearish Losers based on:
 *   1. Movement % from 09:20 Close: ((LTP - RefClose) / RefClose) * 100
 *   2. ORB Breakout Confirmation: LTP > 5m High (BREAKOUT) or LTP < 5m Low (BREAKDOWN)
 *   3. Relative Volume (RVOL) Institutional Multiplier
 *
 * Freeze rules:
 *   - Never freeze at cold boot with zero prices
 *   - Auto-freeze at configured freezeTime (default 09:20 IST) on trading days
 *   - If server starts after freezeTime, freeze once valid LTPs / opening candles exist
 *   - Skip any symbol whose resolved refClose <= 0
 */
const DEFAULT_FREEZE_HHMM = '09:20';
const OPENING_CANDLE_MINS = 9 * 60 + 15; // 09:15 bar → closes at 09:20
const ENSURE_POLL_MS = 15_000;

function parseFreezeMinutes(freezeTime = DEFAULT_FREEZE_HHMM) {
  const match = String(freezeTime || DEFAULT_FREEZE_HHMM).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 9 * 60 + 20;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return hours * 60 + minutes;
}

function candleUnixSec(candle) {
  const t = Number(candle?.time);
  if (!Number.isFinite(t) || t <= 0) return null;
  // Support both seconds and milliseconds
  return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
}

export class OpeningMomentumService {
  constructor() {
    this.settings = {
      enabled: true,
      freezeTime: DEFAULT_FREEZE_HHMM,
      timeframe: '5m',
      minRvol: 1.0,
      topCount: 10,
      breakoutOnly: false,
      autoFreeze: true,
      lastFrozenAt: null
    };

    // Symbol -> { refClose, high5m, low5m, open5m, volume5m, timestamp, isFrozen }
    this.referenceData = new Map();
    this.isFrozen = false;
    this.frozenAt = null;
    this.frozenSessionDate = null;
    this.io = null;
    this.cachedPayload = null;
    this.lastBroadcast = 0;

    this._getStocksMap = null;
    this._freezeTimer = null;
    this._ensureInterval = null;
  }

  async initialize(ioInstance = null) {
    this.io = ioInstance;
    await this.loadSettingsFromDb();
    console.log('[OpeningMomentumService] Engine initialized. Enabled:', this.settings.enabled);
  }

  async loadSettingsFromDb() {
    try {
      const doc = await Settings.findOne({ key: 'opening_momentum_config' });
      if (doc && doc.value) {
        this.settings = { ...this.settings, ...doc.value };
      }
    } catch (err) {
      // Running in in-memory mode if Mongo is unavailable
    }
  }

  async saveSettingsToDb() {
    try {
      await Settings.findOneAndUpdate(
        { key: 'opening_momentum_config' },
        { key: 'opening_momentum_config', value: this.settings, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      // In-memory fallback
    }
  }

  getSettings() {
    return {
      ...this.settings,
      isFrozen: this.isFrozen,
      frozenAt: this.frozenAt,
      frozenSessionDate: this.frozenSessionDate,
      totalTrackedSymbols: this.referenceData.size,
      validReferenceCount: this.countValidReferences()
    };
  }

  async updateSettings(newSettings = {}) {
    if (newSettings.enabled !== undefined) this.settings.enabled = !!newSettings.enabled;
    if (newSettings.minRvol !== undefined) this.settings.minRvol = Math.max(0.1, Number(newSettings.minRvol) || 1.0);
    if (newSettings.topCount !== undefined) this.settings.topCount = Math.min(50, Math.max(3, Number(newSettings.topCount) || 10));
    if (newSettings.breakoutOnly !== undefined) this.settings.breakoutOnly = !!newSettings.breakoutOnly;
    if (newSettings.freezeTime !== undefined) this.settings.freezeTime = String(newSettings.freezeTime);
    if (newSettings.autoFreeze !== undefined) this.settings.autoFreeze = !!newSettings.autoFreeze;

    await this.saveSettingsToDb();

    // Reschedule if freeze time / autoFreeze changed
    if (this._getStocksMap) {
      this.startScheduler(this._getStocksMap);
    }

    return this.getSettings();
  }

  countValidReferences() {
    let count = 0;
    for (const ref of this.referenceData.values()) {
      if (ref?.refClose > 0) count += 1;
    }
    return count;
  }

  hasValidFreeze(sessionDateKey = null) {
    if (!this.isFrozen || this.countValidReferences() === 0) return false;
    if (sessionDateKey && this.frozenSessionDate && this.frozenSessionDate !== sessionDateKey) {
      return false;
    }
    return true;
  }

  /**
   * Prefer today's 09:15 IST 5m candle (closes at 09:20). Fall back to dayOpen / LTP.
   */
  resolveReference(stock, sessionDateKey) {
    if (!stock || stock.sector === 'Indices') return null;

    const candles = stock.candles || [];
    let openingCandle = null;

    for (const candle of candles) {
      const unix = candleUnixSec(candle);
      if (unix == null) continue;
      const parts = marketParts(unix * 1000);
      if (parts.dateKey !== sessionDateKey) continue;
      if (parts.minuteOfDay === OPENING_CANDLE_MINS) {
        openingCandle = candle;
        break;
      }
      // First session bar of the day if exact 09:15 bucket missing
      if (!openingCandle && parts.minuteOfDay >= OPENING_CANDLE_MINS && parts.minuteOfDay < OPENING_CANDLE_MINS + 5) {
        openingCandle = candle;
      }
    }

    if (openingCandle && Number(openingCandle.close) > 0) {
      return {
        refClose: Number(openingCandle.close),
        high5m: Number(openingCandle.high),
        low5m: Number(openingCandle.low),
        open5m: Number(openingCandle.open),
        volume5m: Math.max(1000, Number(openingCandle.volume) || 25000),
        source: 'opening_5m_candle'
      };
    }

    const dayOpen = Number(stock.dayOpen) || 0;
    const ltp = Number(stock.currentPrice) || 0;
    const refClose = dayOpen > 0 ? dayOpen : ltp;
    if (!(refClose > 0)) return null;

    return {
      refClose,
      high5m: Math.max(Number(stock.high) || refClose, refClose),
      low5m: Math.min(Number(stock.low) || refClose, refClose),
      open5m: dayOpen > 0 ? dayOpen : refClose,
      volume5m: Math.max(1000, Math.floor((Number(stock.volume) || 0) * 0.15) || 25000),
      source: dayOpen > 0 ? 'day_open' : 'ltp'
    };
  }

  clearFreeze(reason = '') {
    this.referenceData.clear();
    this.isFrozen = false;
    this.frozenAt = null;
    this.frozenSessionDate = null;
    this.cachedPayload = null;
    if (reason) {
      console.log(`[OpeningMomentumService] Freeze cleared: ${reason}`);
    }
  }

  /**
   * Freezes reference prices from opening candle / day open / LTP.
   * Never locks in zero prices. Returns { success, count, skipped, message }.
   */
  freezeReferenceFromStocks(stocksMap, { force = false, reason = 'manual' } = {}) {
    if (!stocksMap || stocksMap.size === 0) {
      return {
        success: false,
        message: 'No F&O universe loaded yet.',
        frozenAt: null,
        count: 0,
        skipped: 0
      };
    }

    const now = Date.now();
    const parts = marketParts(now);
    const freezeMins = parseFreezeMinutes(this.settings.freezeTime);

    if (!force) {
      if (!isTradingDay(now)) {
        return {
          success: false,
          message: 'Not a trading day — freeze skipped.',
          frozenAt: this.frozenAt,
          count: this.countValidReferences(),
          skipped: 0
        };
      }
      if (parts.minuteOfDay < freezeMins) {
        return {
          success: false,
          message: `Before ${this.settings.freezeTime} IST — waiting for opening candle close.`,
          frozenAt: this.frozenAt,
          count: this.countValidReferences(),
          skipped: 0
        };
      }
    }

    const sessionDateKey = parts.dateKey;
    const nextRefs = new Map();
    let skipped = 0;

    for (const [symbol, stock] of stocksMap.entries()) {
      if (!stock || stock.sector === 'Indices') continue;

      const resolved = this.resolveReference(stock, sessionDateKey);
      if (!resolved || !(resolved.refClose > 0)) {
        skipped += 1;
        continue;
      }

      nextRefs.set(symbol, {
        symbol,
        refClose: parseFloat(Number(resolved.refClose).toFixed(2)),
        high5m: parseFloat(Number(resolved.high5m).toFixed(2)),
        low5m: parseFloat(Number(resolved.low5m).toFixed(2)),
        open5m: parseFloat(Number(resolved.open5m).toFixed(2)),
        volume5m: Math.max(1000, resolved.volume5m),
        source: resolved.source,
        frozenAt: new Date(now).toISOString(),
        sessionDate: sessionDateKey,
        isFrozen: true
      });
    }

    if (nextRefs.size === 0) {
      console.warn(
        `[OpeningMomentumService] Freeze aborted (${reason}) — 0 valid prices (skipped ${skipped}). Waiting for Kotak quotes.`
      );
      return {
        success: false,
        message: `No valid reference prices yet (${skipped} symbols without LTP/dayOpen). Live quotes required.`,
        frozenAt: this.frozenAt,
        count: 0,
        skipped
      };
    }

    this.referenceData = nextRefs;
    this.isFrozen = true;
    this.frozenAt = new Date(now).toISOString();
    this.frozenSessionDate = sessionDateKey;
    this.settings.lastFrozenAt = this.frozenAt;
    this.saveSettingsToDb();
    this.cachedPayload = null;

    console.log(
      `[OpeningMomentumService] 🔒 Frozen ${this.settings.freezeTime} IST refs for ${nextRefs.size} F&O stocks` +
        ` (skipped ${skipped}, session ${sessionDateKey}, via ${reason}).`
    );

    return {
      success: true,
      message: `Successfully frozen ${this.settings.freezeTime} reference prices for ${nextRefs.size} F&O stocks.`,
      frozenAt: this.frozenAt,
      count: nextRefs.size,
      skipped,
      sessionDate: sessionDateKey
    };
  }

  /**
   * When history warms later, upgrade dayOpen/LTP fallbacks to the real 09:15–09:20 candle.
   */
  refineFreezeFromOpeningCandles(stocksMap) {
    if (!stocksMap || !this.hasValidFreeze()) return 0;

    const sessionDateKey = this.frozenSessionDate || marketParts(Date.now()).dateKey;
    let upgraded = 0;

    for (const [symbol, stock] of stocksMap.entries()) {
      const existing = this.referenceData.get(symbol);
      if (!existing || existing.source === 'opening_5m_candle') continue;

      const resolved = this.resolveReference(stock, sessionDateKey);
      if (!resolved || resolved.source !== 'opening_5m_candle' || !(resolved.refClose > 0)) continue;

      this.referenceData.set(symbol, {
        ...existing,
        refClose: parseFloat(Number(resolved.refClose).toFixed(2)),
        high5m: parseFloat(Number(resolved.high5m).toFixed(2)),
        low5m: parseFloat(Number(resolved.low5m).toFixed(2)),
        open5m: parseFloat(Number(resolved.open5m).toFixed(2)),
        volume5m: Math.max(1000, resolved.volume5m),
        source: 'opening_5m_candle',
        refinedAt: new Date().toISOString()
      });
      upgraded += 1;
    }

    if (upgraded > 0) {
      this.cachedPayload = null;
      console.log(
        `[OpeningMomentumService] Refined ${upgraded} refs to real 09:15–09:20 candle closes.`
      );
    }
    return upgraded;
  }

  /**
   * Ensure today's freeze exists once freezeTime has passed and prices are live.
   * Also clears stale prior-day freezes before the new open.
   */
  ensureFrozen(stocksMap) {
    if (!this.settings.autoFreeze) return null;

    const now = Date.now();
    const parts = marketParts(now);
    const freezeMins = parseFreezeMinutes(this.settings.freezeTime);

    if (!isTradingDay(now)) {
      return null;
    }

    // New session before freeze time → drop yesterday's lock
    if (parts.minuteOfDay < freezeMins) {
      if (this.frozenSessionDate && this.frozenSessionDate !== parts.dateKey) {
        this.clearFreeze(`new session ${parts.dateKey} before freeze time`);
      }
      return null;
    }

    if (this.hasValidFreeze(parts.dateKey)) {
      // Still try to upgrade fallback refs once candles arrive
      this.refineFreezeFromOpeningCandles(stocksMap);
      return null;
    }

    // Stale / zero / missing freeze after freezeTime → re-freeze from live data
    if (this.isFrozen && !this.hasValidFreeze(parts.dateKey)) {
      this.clearFreeze('invalid or stale freeze (zero refs / wrong session)');
    }

    return this.freezeReferenceFromStocks(stocksMap, { reason: 'ensure' });
  }

  msUntilNextFreeze() {
    const freezeMins = parseFreezeMinutes(this.settings.freezeTime);
    const now = Date.now();
    const parts = marketParts(now);

    let target = new Date(now);
    // Walk forward to next trading day at freezeMins
    for (let i = 0; i < 10; i += 1) {
      const p = marketParts(target.getTime());
      const atOrPastToday = p.dateKey === parts.dateKey && parts.minuteOfDay >= freezeMins;
      if (isTradingDay(target) && !(i === 0 && atOrPastToday)) {
        // Build IST wall-clock → UTC ms: IST = UTC+5:30
        const istAsUtc = Date.UTC(p.year, p.month - 1, p.day, Math.floor(freezeMins / 60), freezeMins % 60, 0);
        const utcMs = istAsUtc - 330 * 60_000;
        if (utcMs > now + 1000) return utcMs - now;
      }
      target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    }
    return 60 * 60 * 1000; // fallback 1h
  }

  startScheduler(getStocksMap) {
    this.stopScheduler();
    this._getStocksMap = typeof getStocksMap === 'function' ? getStocksMap : null;

    if (!this.settings.autoFreeze || !this._getStocksMap) {
      console.log('[OpeningMomentumService] Auto-freeze scheduler idle.');
      return;
    }

    // Catch up immediately if we already passed freezeTime with live prices
    try {
      this.ensureFrozen(this._getStocksMap());
    } catch (err) {
      console.warn('[OpeningMomentumService] Initial ensure failed:', err.message);
    }

    const armTimer = () => {
      const delay = this.msUntilNextFreeze();
      console.log(
        `[OpeningMomentumService] Next auto-freeze in ${Math.round(delay / 1000)}s (target ${this.settings.freezeTime} IST).`
      );
      this._freezeTimer = setTimeout(() => {
        try {
          const stocks = this._getStocksMap?.();
          if (stocks) {
            this.freezeReferenceFromStocks(stocks, { reason: 'scheduled_0920' });
          }
        } catch (err) {
          console.warn('[OpeningMomentumService] Scheduled freeze failed:', err.message);
        }
        armTimer();
      }, delay);
    };

    armTimer();

    // Keep retrying until valid refs exist (covers late Kotak calibration / WS recovery)
    this._ensureInterval = setInterval(() => {
      try {
        const stocks = this._getStocksMap?.();
        if (stocks) this.ensureFrozen(stocks);
      } catch {
        // ignore poll errors
      }
    }, ENSURE_POLL_MS);

    if (typeof this._ensureInterval.unref === 'function') this._ensureInterval.unref();
  }

  stopScheduler() {
    if (this._freezeTimer) {
      clearTimeout(this._freezeTimer);
      this._freezeTimer = null;
    }
    if (this._ensureInterval) {
      clearInterval(this._ensureInterval);
      this._ensureInterval = null;
    }
  }

  /**
   * Admin Trigger: Force immediate re-freeze using latest stock prices
   * (allowed even before 09:20 for verification; still rejects zero prices)
   */
  forceTriggerFreeze(stocksMap) {
    return this.freezeReferenceFromStocks(stocksMap, { force: true, reason: 'admin_force' });
  }

  /**
   * Reset current session and attempt a fresh freeze when prices exist
   */
  resetSession(stocksMap) {
    this.clearFreeze('admin reset');
    if (stocksMap) {
      const result = this.freezeReferenceFromStocks(stocksMap, { force: true, reason: 'admin_reset' });
      return {
        success: result.success,
        message: result.success
          ? 'Opening Momentum session reset and re-frozen successfully.'
          : `Session cleared. ${result.message}`,
        ...result
      };
    }
    return {
      success: true,
      message: 'Opening Momentum session reset successfully.'
    };
  }

  /**
   * Generate Live Momentum Rankings
   */
  getLiveRankings(stocksMap) {
    if (!this.settings.enabled) {
      return {
        enabled: false,
        message: 'Opening Momentum Scanner is currently paused by admin.',
        gainers: [],
        losers: [],
        stats: {}
      };
    }

    // Auto-catch-up freeze once prices & freeze window allow it (never zero-lock)
    if (stocksMap && stocksMap.size > 0) {
      this.ensureFrozen(stocksMap);
    }

    const allMovers = [];
    let breakoutCount = 0;
    let breakdownCount = 0;
    let insideCount = 0;

    for (const [symbol, stock] of stocksMap.entries()) {
      if (!stock || stock.sector === 'Indices') continue;

      const ref = this.referenceData.get(symbol);
      if (!ref || !ref.refClose || ref.refClose <= 0) continue;

      const ltp = Number(stock.currentPrice) || 0;
      if (!(ltp > 0)) continue;

      const refClose = ref.refClose;
      const movementPercent = parseFloat((((ltp - refClose) / refClose) * 100).toFixed(2));
      const pointsChange = parseFloat((ltp - refClose).toFixed(2));

      // Calculate Relative Volume (RVOL)
      const currentVolume = stock.volume || 1;
      const avg5mVol = ref.volume5m || 35000;
      const rvol = parseFloat((currentVolume / (avg5mVol * 1.8)).toFixed(2));

      // ORB 5-Minute Breakout Status
      let status = 'INSIDE';
      let statusLabel = 'Inside 5M Range';
      if (ltp > ref.high5m) {
        status = 'BREAKOUT';
        statusLabel = '5M High Breakout';
        breakoutCount++;
      } else if (ltp < ref.low5m) {
        status = 'BREAKDOWN';
        statusLabel = '5M Low Breakdown';
        breakdownCount++;
      } else {
        insideCount++;
      }

      // Estimated intraday VWAP
      const vwap = parseFloat((((stock.high || ltp) + (stock.low || ltp) + ltp) / 3).toFixed(2));
      const vwapBias = ltp >= vwap ? 'ABOVE_VWAP' : 'BELOW_VWAP';

      allMovers.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        ltp,
        refClose,
        high5m: ref.high5m,
        low5m: ref.low5m,
        movementPercent,
        pointsChange,
        rvol: Math.max(0.4, rvol),
        volume: currentVolume,
        status,
        statusLabel,
        vwap,
        vwapBias,
        direction: movementPercent >= 0 ? 'BULLISH' : 'BEARISH'
      });
    }

    // Calculate 5-Minute F&O Market Breadth (evaluated against frozen 09:20 Reference Close)
    const advancingStocks = allMovers.filter((m) => m.movementPercent > 0);
    const decliningStocks = allMovers.filter((m) => m.movementPercent < 0);
    const unchangedStocks = allMovers.filter((m) => m.movementPercent === 0);

    const advances = advancingStocks.length;
    const declines = decliningStocks.length;
    const unchanged = unchangedStocks.length;
    const total = allMovers.length;

    const adDifference = advances - declines;
    const adRatio = declines > 0 ? parseFloat((advances / declines).toFixed(2)) : (advances > 0 ? advances : 1.0);

    const advancingVolume = advancingStocks.reduce((acc, m) => acc + (m.volume || 0), 0);
    const decliningVolume = decliningStocks.reduce((acc, m) => acc + (m.volume || 0), 0);
    const advanceVolumeRatio = decliningVolume > 0
      ? parseFloat((advancingVolume / decliningVolume).toFixed(2))
      : 1.0;

    let sentiment = 'NEUTRAL';
    let sentimentLabel = 'Balanced Breadth';
    if (adRatio >= 1.75) {
      sentiment = 'STRONG_BULLISH';
      sentimentLabel = 'Strong Institutional Buying';
    } else if (adRatio >= 1.15) {
      sentiment = 'MILD_BULLISH';
      sentimentLabel = 'Bullish Expansion';
    } else if (adRatio <= 0.55) {
      sentiment = 'STRONG_BEARISH';
      sentimentLabel = 'Heavy Institutional Selling';
    } else if (adRatio <= 0.85) {
      sentiment = 'MILD_BEARISH';
      sentimentLabel = 'Bearish Distribution';
    }

    const breadth = {
      advances,
      declines,
      unchanged,
      total,
      adDifference,
      adRatio,
      advancingVolume,
      decliningVolume,
      advanceVolumeRatio,
      sentiment,
      sentimentLabel,
      advancePercent: total > 0 ? Math.round((advances / total) * 100) : 0,
      declinePercent: total > 0 ? Math.round((declines / total) * 100) : 0,
      unchangedPercent: total > 0 ? Math.round((unchanged / total) * 100) : 0
    };

    // Separate Bullish Gainers and Bearish Losers
    let gainers = allMovers.filter((m) => m.movementPercent > 0);
    let losers = allMovers.filter((m) => m.movementPercent < 0);

    // Apply Admin Filter: Breakout Only if enabled
    if (this.settings.breakoutOnly) {
      gainers = gainers.filter((m) => m.status === 'BREAKOUT');
      losers = losers.filter((m) => m.status === 'BREAKDOWN');
    }

    // Apply Min RVOL filter (or score boosting)
    if (this.settings.minRvol > 1.0) {
      gainers.sort((a, b) => {
        if (a.rvol >= this.settings.minRvol && b.rvol < this.settings.minRvol) return -1;
        if (b.rvol >= this.settings.minRvol && a.rvol < this.settings.minRvol) return 1;
        return b.movementPercent - a.movementPercent || b.rvol - a.rvol;
      });
      losers.sort((a, b) => {
        if (a.rvol >= this.settings.minRvol && b.rvol < this.settings.minRvol) return -1;
        if (b.rvol >= this.settings.minRvol && a.rvol < this.settings.minRvol) return 1;
        return a.movementPercent - b.movementPercent || b.rvol - a.rvol;
      });
    } else {
      gainers.sort((a, b) => b.movementPercent - a.movementPercent || b.rvol - a.rvol);
      losers.sort((a, b) => a.movementPercent - b.movementPercent || b.rvol - a.rvol);
    }

    // Slice to topCount
    const topGainers = gainers.slice(0, this.settings.topCount).map((g, idx) => ({ ...g, rank: idx + 1 }));
    const topLosers = losers.slice(0, this.settings.topCount).map((l, idx) => ({ ...l, rank: idx + 1 }));

    // Macro Velocity Stats
    const avgGainerMove = topGainers.length
      ? (topGainers.reduce((acc, g) => acc + g.movementPercent, 0) / topGainers.length).toFixed(2)
      : '0.00';
    const avgLoserMove = topLosers.length
      ? (topLosers.reduce((acc, l) => acc + l.movementPercent, 0) / topLosers.length).toFixed(2)
      : '0.00';

    const waitingForPrices = !this.hasValidFreeze() && isTradingDay(Date.now());

    const payload = {
      enabled: this.settings.enabled,
      isFrozen: this.isFrozen && this.hasValidFreeze(),
      frozenAt: this.frozenAt,
      frozenSessionDate: this.frozenSessionDate,
      freezeTime: this.settings.freezeTime,
      topCount: this.settings.topCount,
      minRvol: this.settings.minRvol,
      breakoutOnly: this.settings.breakoutOnly,
      gainers: topGainers,
      losers: topLosers,
      breadth,
      waitingForPrices,
      message: waitingForPrices
        ? 'Waiting for live quotes to freeze opening reference prices…'
        : undefined,
      stats: {
        totalTracked: allMovers.length,
        breakoutCount,
        breakdownCount,
        insideCount,
        avgGainerMove: `+${avgGainerMove}%`,
        avgLoserMove: `${avgLoserMove}%`,
        strongestGainer: topGainers[0]?.symbol || '—',
        strongestLoser: topLosers[0]?.symbol || '—',
        breadth
      },
      timestamp: Date.now()
    };

    this.cachedPayload = payload;
    return payload;
  }
}

export const openingMomentumService = new OpeningMomentumService();
