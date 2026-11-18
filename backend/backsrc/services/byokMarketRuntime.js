/**
 * Per-user BYOK market runtime: screener / X-Ray / opening momentum / charts
 * driven by the user's connected broker (never platform keys).
 */
import { smcEngine } from '../algorithms/smcEngine.js';
import {
  analyzeInstrument,
  analyzeFnoUniverseFromStocks,
  buildMarketAnalysisReport
} from '../algorithms/marketAnalysisEngine.js';
import { openingMomentumService } from './openingMomentumService.js';
import { FNO_UNIVERSE, marketDataService } from './marketDataService.js';
import { createByokMarketAdapter } from './marketBrokers/index.js';
import { resolveUserMarketFeed } from './byokSessionService.js';

const IDLE_TTL_MS = 15 * 60 * 1000;
const POLL_MS = 5000;
const CHART_CACHE_TTL_MS = 8 * 60 * 1000;

const IST_TZ = 'Asia/Kolkata';
const NSE_OPEN_MINS = 9 * 60 + 15;
const NSE_CLOSE_MINS = 15 * 60 + 30;

function getIstParts(unixSec = Math.floor(Date.now() / 1000)) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(unixSec * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const wd = get('weekday');
  const hour = Number(get('hour') === '24' ? 0 : get('hour'));
  const minute = Number(get('minute'));
  return {
    isWeekend: wd === 'Sat' || wd === 'Sun',
    mins: hour * 60 + minute
  };
}

function filterNseSessionCandles(candles, timeframe = '5m') {
  return (candles || []).filter((c) => {
    const { isWeekend, mins } = getIstParts(c.time);
    if (isWeekend) return false;
    if (timeframe === '1d') return true;
    return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
  });
}

function capRangeDays(timeframe, rangeDays) {
  const tf = String(timeframe || '5m').toLowerCase();
  let max = 365;
  if (tf === '1m' || tf === '3m') max = 7;
  else if (tf === '5m') max = 29;
  else if (tf === '15m') max = 55;
  return Math.min(Math.max(Number(rangeDays) || 30, 1), max);
}

class ByokUserSession {
  constructor(userId, feedMeta, adapter, io) {
    this.userId = String(userId);
    this.feed = feedMeta;
    this.adapter = adapter;
    this.io = io;
    this.stocks = new Map();
    this.lastTouch = Date.now();
    this.pollTimer = null;
    this.warming = false;
    this.room = `byok:${this.userId}`;
    this._historyInflight = new Map();

    for (const stock of FNO_UNIVERSE) {
      this.stocks.set(stock.symbol, {
        ...stock,
        currentPrice: 0,
        dayOpen: 0,
        high: 0,
        low: 0,
        change: 0,
        volume: 0,
        candles: [],
        smcData: null,
        hasRealCandles: false,
        chartCache: null
      });
    }
  }

  touch() {
    this.lastTouch = Date.now();
  }

  applyTicks(ticks = []) {
    for (const tick of ticks) {
      const stock = this.stocks.get(tick.symbol);
      if (!stock) continue;
      stock.currentPrice = tick.currentPrice;
      stock.dayOpen = tick.open || stock.dayOpen || tick.currentPrice;
      stock.high = Math.max(stock.high || 0, tick.high || tick.currentPrice);
      stock.low =
        stock.low > 0
          ? Math.min(stock.low, tick.low || tick.currentPrice)
          : tick.low || tick.currentPrice;
      stock.change = tick.change;
      stock.volume = tick.volume || stock.volume;
    }
  }

  getScreenerData() {
    // Reuse platform shaping by temporarily swapping stocks is unsafe;
    // call the same logic via a disposable helper on marketDataService pattern.
    return buildScreenerPayload(this.stocks);
  }

  getMarketXRay() {
    return buildMarketXRayPayload(this.stocks);
  }

  getOpeningMomentumData() {
    return openingMomentumService.getLiveRankings(this.stocks);
  }

  async getMarketAnalysis(options = {}) {
    const timeframe = options.timeframe || '5m';
    const rangeDays = options.rangeDays || 10;
    const aliases = {
      'NIFTY 50': ['NIFTY 50', 'NIFTY'],
      BANKNIFTY: ['BANKNIFTY', 'BANK NIFTY']
    };

    const load = async (preferred) => {
      for (const sym of aliases[preferred] || [preferred]) {
        const detail = await this.getStockDetails(sym, { timeframe, rangeDays });
        if (detail?.candles?.length || detail?.currentPrice) return detail;
      }
      // Fall back to in-memory quote even without candles
      const stock = this.stocks.get(preferred) || this.stocks.get(aliases[preferred]?.[1]);
      if (!stock) return null;
      return {
        symbol: stock.symbol,
        name: stock.name,
        candles: stock.candles || [],
        currentPrice: stock.currentPrice,
        dayOpen: stock.dayOpen,
        high: stock.high,
        low: stock.low,
        change: stock.change,
        smcData: stock.smcData
      };
    };

    const [niftyDetail, bankDetail] = await Promise.all([
      load('NIFTY 50'),
      load('BANKNIFTY')
    ]);

    const nifty = niftyDetail
      ? analyzeInstrument({
          symbol: niftyDetail.symbol,
          name: niftyDetail.name,
          candles: niftyDetail.candles || [],
          currentPrice: niftyDetail.currentPrice,
          dayOpen: niftyDetail.dayOpen,
          high: niftyDetail.high,
          low: niftyDetail.low,
          change: niftyDetail.change,
          smcData: niftyDetail.smcData
        })
      : null;

    const bankNifty = bankDetail
      ? analyzeInstrument({
          symbol: bankDetail.symbol,
          name: bankDetail.name,
          candles: bankDetail.candles || [],
          currentPrice: bankDetail.currentPrice,
          dayOpen: bankDetail.dayOpen,
          high: bankDetail.high,
          low: bankDetail.low,
          change: bankDetail.change,
          smcData: bankDetail.smcData
        })
      : null;

    const xray = this.getMarketXRay();
    const fnoUniverse = analyzeFnoUniverseFromStocks(this.stocks);
    return {
      ...buildMarketAnalysisReport({
        nifty,
        bankNifty,
        breadth: {
          advancing: xray.advancing,
          declining: xray.declining,
          neutral: xray.neutral,
          advanceDeclineRatio: xray.advanceDeclineRatio,
          bullishSetupsCount: xray.bullishSetupsCount,
          bearishSetupsCount: xray.bearishSetupsCount
        },
        fnoUniverse
      }),
      timeframe,
      rangeDays,
      isLive: true
    };
  }

  async refreshQuotes() {
    this.touch();
    const symbols = Array.from(this.stocks.keys());
    const ticks = await this.adapter.getQuotes(symbols);
    if (ticks?.length) {
      this.applyTicks(ticks);
      this.emitTicks(ticks);
      this.emitSnapshots();
    }
    return ticks;
  }

  emitTicks(ticks) {
    if (!this.io) return;
    this.io.to(this.room).emit('MARKET_TICK', ticks);
  }

  emitSnapshots() {
    if (!this.io) return;
    this.io.to(this.room).emit('SCREENER_UPDATE', this.getScreenerData());
    this.io.to(this.room).emit('MARKET_XRAY', this.getMarketXRay());
    this.io.to(this.room).emit('OPENING_MOMENTUM', this.getOpeningMomentumData());
  }

  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.refreshQuotes().catch((err) => {
        console.warn(`[BYOK ${this.userId}] quote poll:`, err.message);
      });
    }, POLL_MS);
    // kick once
    this.refreshQuotes().catch(() => {});
    this.warmCandles().catch(() => {});
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async warmCandles() {
    if (this.warming) return;
    this.warming = true;
    try {
      const equities = Array.from(this.stocks.values()).filter((s) => s.sector !== 'Indices');
      for (const stock of equities.slice(0, 12)) {
        try {
          const candles = await this.adapter.fetchHistoricalCandles(stock.symbol, {
            timeframe: '5m',
            rangeDays: 5
          });
          const filtered = filterNseSessionCandles(candles, '5m');
          if (!filtered.length) continue;
          stock.candles = filtered;
          stock.hasRealCandles = true;
          stock.smcData = smcEngine.analyze(filtered, stock.symbol, '5m');
          stock.high = Math.max(...filtered.map((c) => c.high));
          stock.low = Math.min(...filtered.map((c) => c.low));
          stock.chartCache = {
            key: '5m:5',
            candles: filtered,
            smcData: stock.smcData,
            fetchedAt: Date.now()
          };
        } catch {
          /* continue */
        }
      }
      this.emitSnapshots();
    } finally {
      this.warming = false;
    }
  }

  async getStockDetails(symbol, options = {}) {
    this.touch();
    const stock = this.stocks.get(String(symbol || '').toUpperCase());
    if (!stock) return null;

    const timeframe = options.timeframe || '5m';
    const rangeDays = capRangeDays(timeframe, options.rangeDays || 30);
    const cacheKey = `${timeframe}:${rangeDays}`;

    let candles = [];
    let smcData = null;
    let dataSource = 'unavailable';

    const cacheFresh =
      stock.chartCache?.candles?.length &&
      Date.now() - (stock.chartCache.fetchedAt || 0) < CHART_CACHE_TTL_MS;
    const cacheHit = cacheFresh && stock.chartCache.key === cacheKey;
    const softCacheHit =
      !cacheHit &&
      cacheFresh &&
      String(stock.chartCache.key || '').startsWith(`${timeframe}:`);

    if (cacheHit || softCacheHit) {
      candles = stock.chartCache.candles;
      smcData = stock.chartCache.smcData;
      dataSource = 'live';
    } else if (
      timeframe === '5m' &&
      Array.isArray(stock.candles) &&
      stock.candles.length > 0
    ) {
      candles = stock.candles;
      smcData = stock.smcData || smcEngine.analyze(candles, stock.symbol, timeframe);
      dataSource = 'live';
      stock.chartCache = {
        key: cacheKey,
        candles,
        smcData,
        fetchedAt: Date.now()
      };
    }

    if (!candles.length) {
      const inflightKey = `${stock.symbol}|${cacheKey}`;
      let p = this._historyInflight.get(inflightKey);
      if (!p) {
        p = (async () => {
          const raw = await this.adapter.fetchHistoricalCandles(stock.symbol, {
            timeframe,
            rangeDays
          });
          const filtered = filterNseSessionCandles(raw, timeframe);
          if (!filtered.length) return null;
          const analyzed = smcEngine.analyze(filtered, stock.symbol, timeframe);
          stock.chartCache = {
            key: cacheKey,
            candles: filtered,
            smcData: analyzed,
            fetchedAt: Date.now()
          };
          if (timeframe === '5m') {
            stock.candles = filtered;
            stock.hasRealCandles = true;
            stock.smcData = analyzed;
          }
          return stock.chartCache;
        })().finally(() => this._historyInflight.delete(inflightKey));
        this._historyInflight.set(inflightKey, p);
      }
      try {
        const result = await p;
        if (result?.candles?.length) {
          candles = result.candles;
          smcData = result.smcData;
          dataSource = 'live';
        }
      } catch (e) {
        console.warn(`[BYOK chart] ${stock.symbol}:`, e.message);
      }
    }

    const high = candles.length ? Math.max(...candles.map((c) => c.high)) : stock.high;
    const low = candles.length ? Math.min(...candles.map((c) => c.low)) : stock.low;

    return {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      currentPrice: stock.currentPrice,
      dayOpen: stock.dayOpen,
      high,
      low,
      change: stock.change,
      volume: stock.volume,
      timeframe,
      rangeDays,
      dataSource,
      isLive: dataSource === 'live',
      candles,
      smcData,
      feed: this.feed
    };
  }

  getInitialState() {
    return {
      screener: this.getScreenerData(),
      marketXRay: this.getMarketXRay(),
      openingMomentum: this.getOpeningMomentumData(),
      feed: this.feed
    };
  }
}

/** Local copies of screener/xray builders (avoid mutating platform singleton). */
function buildScreenerPayload(stocksMap) {
  const bullishSetups = [];
  const bearishSetups = [];
  for (const stock of stocksMap.values()) {
    const smc = stock.smcData;
    if (!smc) continue;
    if (smc.activeBullishOB) {
      const ob = smc.activeBullishOB;
      bullishSetups.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        currentPrice: stock.currentPrice,
        change: stock.change,
        zoneTop: ob.top,
        zoneBottom: ob.bottom,
        distancePercent: parseFloat(
          (((stock.currentPrice - ob.top) / stock.currentPrice) * 100).toFixed(2)
        ),
        score: ob.score,
        volumeRatio: ob.volumeRatio,
        testCount: ob.testCount,
        timeFormed: ob.time,
        type: 'BULLISH',
        liquidityTarget: smc.liquidity?.buySide?.price || stock.high
      });
    }
    if (smc.activeBearishOB) {
      const ob = smc.activeBearishOB;
      bearishSetups.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        currentPrice: stock.currentPrice,
        change: stock.change,
        zoneTop: ob.top,
        zoneBottom: ob.bottom,
        distancePercent: parseFloat(
          (((ob.bottom - stock.currentPrice) / stock.currentPrice) * 100).toFixed(2)
        ),
        score: ob.score,
        volumeRatio: ob.volumeRatio,
        testCount: ob.testCount,
        timeFormed: ob.time,
        type: 'BEARISH',
        liquidityTarget: smc.liquidity?.sellSide?.price || stock.low
      });
    }
  }
  bullishSetups.sort((a, b) => b.score - a.score);
  bearishSetups.sort((a, b) => b.score - a.score);
  return {
    allStocks: Array.from(stocksMap.values()).map((s) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      currentPrice: s.currentPrice,
      change: s.change,
      volume: s.volume,
      high: s.high,
      low: s.low
    })),
    bullishSetups,
    bearishSetups,
    totalBullish: bullishSetups.length,
    totalBearish: bearishSetups.length,
    timestamp: Date.now()
  };
}

function buildMarketXRayPayload(stocksMap) {
  // Delegate to platform method shape by cloning into a temp MarketDataService-like call:
  // simplest: use marketDataService.getMarketXRay after swapping is dangerous.
  // Inline a reduced X-Ray from stocks (adv/dec + sectors + indices).
  const all = Array.from(stocksMap.values());
  const nonIndices = all.filter((s) => s.sector !== 'Indices');
  const advancing = nonIndices.filter((s) => s.change > 0).length;
  const declining = nonIndices.filter((s) => s.change < 0).length;
  const neutral = nonIndices.filter((s) => s.change === 0).length;

  const sectorStats = {};
  for (const stock of nonIndices) {
    if (!sectorStats[stock.sector]) {
      sectorStats[stock.sector] = {
        totalChange: 0,
        count: 0,
        advancing: 0,
        declining: 0,
        stocks: []
      };
    }
    const bucket = sectorStats[stock.sector];
    bucket.totalChange += stock.change;
    bucket.count += 1;
    if (stock.change > 0) bucket.advancing += 1;
    else if (stock.change < 0) bucket.declining += 1;
    bucket.stocks.push({
      symbol: stock.symbol,
      name: stock.name,
      currentPrice: stock.currentPrice,
      change: stock.change,
      volume: stock.volume,
      high: stock.high,
      low: stock.low,
      smcBias: stock.smcData?.activeBullishOB
        ? 'BULLISH_OB'
        : stock.smcData?.activeBearishOB
          ? 'BEARISH_OB'
          : 'NEUTRAL',
      obZone: null,
      score: null
    });
  }

  const sectors = Object.entries(sectorStats)
    .map(([sector, data]) => {
      const sorted = [...data.stocks].sort((a, b) => b.change - a.change);
      const avgChange = parseFloat((data.totalChange / data.count).toFixed(2));
      return {
        name: sector,
        avgChange,
        count: data.count,
        advancingCount: data.advancing,
        decliningCount: data.declining,
        status: avgChange > 0.35 ? 'BULLISH' : avgChange < -0.35 ? 'BEARISH' : 'NEUTRAL',
        topGainer: sorted[0] || null,
        topDragger: sorted[sorted.length - 1] || null,
        stocks: sorted
      };
    })
    .sort((a, b) => b.avgChange - a.avgChange);

  const nifty = stocksMap.get('NIFTY 50') || { currentPrice: 0, change: 0 };
  const bnf = stocksMap.get('BANKNIFTY') || { currentPrice: 0, change: 0 };
  const screener = buildScreenerPayload(stocksMap);

  return {
    advancing,
    declining,
    neutral,
    totalStocks: nonIndices.length,
    advanceDeclineRatio: declining > 0 ? parseFloat((advancing / declining).toFixed(2)) : advancing,
    advancingVolume: 0,
    decliningVolume: 0,
    advanceVolumeRatio: 0,
    sectors,
    bullishSetupsCount: screener.totalBullish,
    bearishSetupsCount: screener.totalBearish,
    fiiDiiFlow: { available: false, insight: 'FII/DII not available on BYOK feed.' },
    vixRegime: {
      available: false,
      regime: 'UNAVAILABLE',
      description: 'India VIX not wired on BYOK feed.',
      niftyPrice: nifty.currentPrice || null,
      bankNiftyPrice: bnf.currentPrice || null
    },
    optionsMacro: {
      available: false,
      summary: 'Option PCR comes from Order Flow using your BYOK broker.'
    },
    smtDivergence: {
      status: nifty.currentPrice > 0 ? 'MACRO CONFLUENCE' : 'AWAITING LIVE INDEX QUOTES',
      type:
        nifty.change >= 0 && bnf.change >= 0
          ? 'BULLISH'
          : nifty.change < 0 && bnf.change < 0
            ? 'BEARISH'
            : 'MIXED',
      details: 'BYOK live quotes',
      confluenceScore: null,
      niftyChange: nifty.change,
      bankNiftyChange: bnf.change
    },
    volumeSurgeStocks: [...nonIndices]
      .filter((s) => (s.volume || 0) > 0)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        volume: s.volume,
        change: s.change,
        currentPrice: s.currentPrice,
        actionTag: 'ACTIVE'
      })),
    isLive: true,
    timestamp: Date.now()
  };
}

class ByokMarketRuntime {
  constructor() {
    this.sessions = new Map();
    this.io = null;
    this.gcTimer = null;
  }

  attachIo(io) {
    this.io = io;
    if (!this.gcTimer) {
      this.gcTimer = setInterval(() => this.gc(), 60_000);
    }
  }

  gc() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastTouch > IDLE_TTL_MS) {
        session.stopPolling();
        this.sessions.delete(id);
        console.log(`[BYOK] released idle session ${id}`);
      }
    }
  }

  dropSession(userId) {
    const id = String(userId || '');
    if (!id) return;
    const session = this.sessions.get(id);
    if (!session) return;
    session.stopPolling();
    this.sessions.delete(id);
  }

  async getSessionForUser(user) {
    const resolved = await resolveUserMarketFeed(user);
    if (resolved.mode !== 'byok') {
      return { mode: 'server', feed: resolved.feed, session: null, error: null };
    }
    if (!resolved.connected) {
      return {
        mode: 'byok',
        feed: resolved.feed,
        session: null,
        error: resolved.error || 'Connect your broker to load market data.',
        needsReconnect: !!resolved.needsReconnect
      };
    }

    const userId = String(user._id || user.id);
    let session = this.sessions.get(userId);
    if (session && session.feed?.provider === resolved.provider) {
      session.touch();
      return { mode: 'byok', feed: resolved.feed, session, error: null };
    }

    if (session) session.stopPolling();

    const symbols = FNO_UNIVERSE.map((s) => s.symbol);
    const adapter = await createByokMarketAdapter({
      provider: resolved.provider,
      session: resolved.session,
      secrets: resolved.secrets,
      symbols
    });

    session = new ByokUserSession(userId, resolved.feed, adapter, this.io);
    this.sessions.set(userId, session);
    session.startPolling();
    return { mode: 'byok', feed: resolved.feed, session, error: null };
  }

  /** HTTP helpers */
  async getScreenerForUser(user) {
    const { mode, feed, session, error } = await this.getSessionForUser(user);
    if (mode === 'server') {
      return { data: marketDataService.getScreenerData(), feed };
    }
    if (error || !session) {
      const err = new Error(error || 'BYOK broker not connected');
      err.statusCode = 403;
      err.feed = feed;
      err.needsReconnect = true;
      throw err;
    }
    return { data: session.getScreenerData(), feed };
  }

  async getMarketXRayForUser(user) {
    const { mode, feed, session, error } = await this.getSessionForUser(user);
    if (mode === 'server') {
      return { data: marketDataService.getMarketXRay(), feed };
    }
    if (error || !session) {
      const err = new Error(error || 'BYOK broker not connected');
      err.statusCode = 403;
      err.feed = feed;
      err.needsReconnect = true;
      throw err;
    }
    return { data: session.getMarketXRay(), feed };
  }

  async getOpeningMomentumForUser(user) {
    const { mode, feed, session, error } = await this.getSessionForUser(user);
    if (mode === 'server') {
      return { data: marketDataService.getOpeningMomentumData(), feed };
    }
    if (error || !session) {
      const err = new Error(error || 'BYOK broker not connected');
      err.statusCode = 403;
      err.feed = feed;
      err.needsReconnect = true;
      throw err;
    }
    return { data: session.getOpeningMomentumData(), feed };
  }

  async getStockDetailsForUser(user, symbol, options) {
    const { mode, feed, session, error } = await this.getSessionForUser(user);
    if (mode === 'server') {
      const stock = await marketDataService.getStockDetails(symbol, options);
      return stock ? { ...stock, feed } : null;
    }
    if (error || !session) {
      const err = new Error(error || 'BYOK broker not connected');
      err.statusCode = 403;
      err.feed = feed;
      err.needsReconnect = true;
      throw err;
    }
    return session.getStockDetails(symbol, options);
  }

  async getMarketAnalysisForUser(user, options = {}) {
    const { mode, feed, session, error } = await this.getSessionForUser(user);
    if (mode === 'server') {
      const data = await marketDataService.getMarketAnalysis(options);
      return { data, feed };
    }
    if (error || !session) {
      const err = new Error(error || 'BYOK broker not connected');
      err.statusCode = 403;
      err.feed = feed;
      err.needsReconnect = true;
      throw err;
    }
    const data = await session.getMarketAnalysis(options);
    return { data, feed };
  }
}

export const byokMarketRuntime = new ByokMarketRuntime();
