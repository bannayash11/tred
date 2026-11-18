import { smcEngine } from '../algorithms/smcEngine.js';
import {
  analyzeInstrument,
  analyzeFnoUniverseFromStocks,
  buildMarketAnalysisReport
} from '../algorithms/marketAnalysisEngine.js';
import { openingMomentumService } from './openingMomentumService.js';
import { kotakNeoService } from './kotakNeoService.js';
import { fyersService } from './fyersService.js';
import { orderFlowService } from './orderFlowService.js';

const IST_TZ = 'Asia/Kolkata';
const NSE_OPEN_MINS = 9 * 60 + 15; // 09:15
const NSE_CLOSE_MINS = 15 * 60 + 30; // 15:30

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

export function isIndianMarketOpen() {
  try {
    const { isWeekend, mins } = getIstParts();
    if (isWeekend) return false;
    // NSE F&O / cash regular session: 09:15 → 15:30 IST
    return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
  } catch {
    return false;
  }
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

/** Filter to NSE session hours for intraday TFs; daily keeps weekdays only */
function filterNseSessionCandles(candles, timeframe = '5m') {
  return (candles || [])
    .map(sanitizeCandle)
    .filter(Boolean)
    .filter((c) => {
      const { isWeekend, mins } = getIstParts(c.time);
      if (isWeekend) return false;
      if (timeframe === '1d') return true;
      return mins >= NSE_OPEN_MINS && mins <= NSE_CLOSE_MINS;
    });
}

// Comprehensive Indian NSE F&O Stock Universe with REAL base price & sector mapping
export const FNO_UNIVERSE = [
  // Indices
  { symbol: 'NIFTY 50', name: 'Nifty 50 Index', sector: 'Indices', basePrice: 24270.0 },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', sector: 'Indices', basePrice: 58950.0 },
  
  // Banking
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', basePrice: 780.0 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', basePrice: 1560.0 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', basePrice: 1015.0 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Banking', basePrice: 475.0 },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Banking', basePrice: 1311.0 },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank', sector: 'Banking', basePrice: 914.0 },

  // IT & Tech
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', basePrice: 1170.0 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', basePrice: 2494.0 },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'IT', basePrice: 197.8 },
  { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'IT', basePrice: 1429.0 },
  { symbol: 'TECHM', name: 'Tech Mahindra', sector: 'IT', basePrice: 1823.0 },
  { symbol: 'COFORGE', name: 'Coforge Ltd', sector: 'IT', basePrice: 2068.0 },

  // Auto
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto', basePrice: 291.5 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', basePrice: 12808.0 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'Auto', basePrice: 3250.0 },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', sector: 'Auto', basePrice: 10905.0 },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', sector: 'Auto', basePrice: 5471.0 },

  // Energy, Oil & Utilities
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', basePrice: 1315.0 },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', basePrice: 230.0 },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corp', sector: 'Energy', basePrice: 315.6 },
  { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Utilities', basePrice: 322.0 },
  { symbol: 'POWERGRID', name: 'Power Grid Corp', sector: 'Utilities', basePrice: 258.5 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'Conglomerate', basePrice: 2721.0 },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', sector: 'Infrastructure', basePrice: 1938.0 },

  // Metals & Mining
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Metals', basePrice: 184.2 },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Metals', basePrice: 1352.0 },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'Metals', basePrice: 941.0 },
  { symbol: 'VEDL', name: 'Vedanta Ltd', sector: 'Metals', basePrice: 260.0 },

  // Pharma & Healthcare
  { symbol: 'SUNPHARMA', name: 'Sun Pharma Ind', sector: 'Pharma', basePrice: 1860.0 },
  { symbol: 'DRREDDY', name: 'Dr. Reddy Laboratories', sector: 'Pharma', basePrice: 1366.0 },
  { symbol: 'CIPLA', name: 'Cipla Ltd', sector: 'Pharma', basePrice: 1406.0 },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'Healthcare', basePrice: 8418.0 },

  // FMCG & Consumer
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', basePrice: 465.0 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', basePrice: 1989.0 },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', basePrice: 4988.0 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Consumer', basePrice: 2531.0 },

  // Financial Services
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Financials', basePrice: 7150.0 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', sector: 'Financials', basePrice: 1850.0 },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Inv', sector: 'Financials', basePrice: 1768.0 }
];

const CHART_CACHE_TTL_MS = 8 * 60 * 1000; // multi-user: share history ~8 min

function capRangeDaysForTimeframe(timeframe, rangeDays) {
  const tf = String(timeframe || '5m').toLowerCase();
  let max = 365;
  if (tf === '1m' || tf === '3m') max = 7;
  else if (tf === '5m') max = 29;
  else if (tf === '10m' || tf === '15m') max = 55;
  else if (tf === '30m' || tf === '1h') max = 85;
  return Math.min(Math.max(Number(rangeDays) || 30, 1), max);
}

export class MarketDataService {
  constructor() {
    this.stocks = new Map();
    this.subscribers = new Set();
    this.priorityStocks = new Set();
    this.io = null;
    this.initialized = false;
    this.updateInterval = null;
    /** symbol|tf|range → Promise — coalesce concurrent chart fetches */
    this._historyInflight = new Map();
    /** Platform Upstox adapter — live + chart fallback after Fyers */
    this._upstoxAdapter = null;
    this._upstoxToken = '';
    this._upstoxInit = null;
    this._upstoxPollInterval = null;
    this.activeFeedProvider = null;
    this.isRealData = false;
    this._leanPump = null;
    this._leanPumpBusy = false;
  }

  stopAllPlatformFeeds() {
    try {
      fyersService.stopLiveFeed();
    } catch {
      /* ignore */
    }
    try {
      kotakNeoService.stopLiveFeed();
    } catch {
      /* ignore */
    }
    if (this._upstoxPollInterval) {
      clearInterval(this._upstoxPollInterval);
      this._upstoxPollInterval = null;
    }
    if (this.kotakRetryInterval) {
      clearInterval(this.kotakRetryInterval);
      this.kotakRetryInterval = null;
    }
    this.stopLeanLivePump();
  }

  /** Symbols that must tick like a broker app (open charts + indices + liquid names). */
  _leanSymbolList() {
    const set = new Set([
      'NIFTY 50',
      'BANKNIFTY',
      'RELIANCE',
      'HDFCBANK',
      'ICICIBANK',
      'SBIN',
      'INFY',
      'TCS'
    ]);
    for (const raw of this.priorityStocks) {
      const s = String(raw || '')
        .trim()
        .toUpperCase();
      if (!s) continue;
      if (s === 'NIFTY' || s === 'NIFTY50') set.add('NIFTY 50');
      else if (s === 'BANK NIFTY' || s === 'BNF') set.add('BANKNIFTY');
      else set.add(s);
    }
    return [...set].filter((s) => this.stocks.has(s));
  }

  /**
   * Fast LTP pump for open charts / ticker — small symbol set every ~2.5s.
   * Uses Upstox first (when available), then Kotak lean batch. Keeps candles moving
   * even when full-universe Kotak REST is 429 or SFeed Matrix auth is down.
   */
  startLeanLivePump() {
    if (this._leanPump) return;
    const pollMs = Math.max(2000, Number(process.env.LEAN_QUOTE_POLL_MS) || 2500);
    console.log(`[MarketDataService] Lean live LTP pump every ${pollMs}ms (charts/ticker)`);

    const tick = async () => {
      if (this._leanPumpBusy) return;
      this._leanPumpBusy = true;
      try {
        const symbols = this._leanSymbolList();
        if (!symbols.length) return;
        let ticks = [];

        // Kotak first for live LTP — priority lane bypasses history/OF gate stalls
        try {
          const quotes = await kotakNeoService.fetchLiveQuotesForSymbols(symbols, {
            priority: true
          });
          ticks = kotakNeoService.quotesToTicks(quotes || []);
        } catch (err) {
          if (!/429|rate limit/i.test(String(err.message || ''))) {
            console.warn('[MarketDataService] Lean Kotak quotes:', err.message);
          }
        }

        if (!ticks?.length && Date.now() > (this._upstoxLeanCooldownUntil || 0)) {
          try {
            const adapter = await this._ensureUpstoxAdapter();
            if (adapter) {
              ticks = await adapter.getQuotes(symbols);
            }
          } catch (err) {
            if (/429|too many/i.test(String(err.message || ''))) {
              this._upstoxLeanCooldownUntil = Date.now() + 30_000;
            } else {
              console.warn('[MarketDataService] Lean Upstox quotes:', err.message);
            }
          }
        }

        if (ticks?.length) {
          this.isRealData = true;
          this.handleRealTicks(ticks);
          this._leanPumpOk = (this._leanPumpOk || 0) + 1;
          if (this._leanPumpOk === 1 || this._leanPumpOk % 40 === 0) {
            console.log(
              `[MarketDataService] Lean LTP ok ×${this._leanPumpOk} · ${ticks
                .slice(0, 4)
                .map((t) => `${t.symbol}=${t.currentPrice}`)
                .join(' ')}`
            );
          }
        }
      } finally {
        this._leanPumpBusy = false;
      }
    };

    void tick();
    this._leanPump = setInterval(tick, pollMs);
  }

  stopLeanLivePump() {
    if (this._leanPump) {
      clearInterval(this._leanPump);
      this._leanPump = null;
    }
    this._leanPumpBusy = false;
  }

  /**
   * Start live feed using admin defaultProvider, then remaining fallbacks.
   * Priority example (default=kotak): kotak → fyers → upstox
   */
  async startPlatformLiveFeed() {
    const { getPlatformFeedPriority } = await import('./platformBrokerService.js');
    const order = getPlatformFeedPriority();
    console.log(`[MarketDataService] Platform feed priority: ${order.join(' → ')}`);

    for (const provider of order) {
      let ok = false;
      if (provider === 'kotak') ok = await this.initKotakLiveFeed();
      else if (provider === 'fyers') ok = await this.initFyersLiveFeed();
      else if (provider === 'upstox') ok = await this.initUpstoxLiveFeed();
      if (ok) {
        console.log(`[MarketDataService] Live feed active: ${provider}`);
        this.startLeanLivePump();
        return provider;
      }
    }

    console.warn('[MarketDataService] All platform brokers failed — no live ticks.');
    this.isRealData = false;
    this.activeFeedProvider = null;
    return null;
  }

  async restartPlatformLiveFeed() {
    this.stopAllPlatformFeeds();
    this.activeFeedProvider = null;
    this.isRealData = false;
    return this.startPlatformLiveFeed();
  }

  /** Fail over from a dead provider to the next ones in admin priority. */
  async failoverLiveFeed(fromProvider, reason = '') {
    const dead = String(fromProvider || this.activeFeedProvider || '').toLowerCase();
    if (this.activeFeedProvider && dead && this.activeFeedProvider !== dead) return;

    console.warn(
      `[MarketDataService] ${dead || 'feed'} dead → failover (${reason || 'error'}).`
    );
    this.stopAllPlatformFeeds();
    this.activeFeedProvider = null;

    const { getPlatformFeedPriority } = await import('./platformBrokerService.js');
    const remaining = getPlatformFeedPriority().filter((p) => p !== dead);

    for (const provider of remaining) {
      let ok = false;
      if (provider === 'kotak') ok = await this.initKotakLiveFeed();
      else if (provider === 'fyers') ok = await this.initFyersLiveFeed();
      else if (provider === 'upstox') ok = await this.initUpstoxLiveFeed();
      if (ok) {
        console.log(`[MarketDataService] Failover live feed → ${provider}`);
        return provider;
      }
    }

    console.warn('[MarketDataService] Failover exhausted — no live broker left.');
    this.isRealData = false;
    return null;
  }

  async _ensureUpstoxAdapter() {
    const { getPlatformBrokerRuntime } = await import('./platformBrokerService.js');
    const token =
      getPlatformBrokerRuntime().upstox?.accessToken || process.env.UPSTOX_ACCESS_TOKEN || '';
    if (!token) return null;

    if (this._upstoxAdapter && this._upstoxToken === token) {
      await this._upstoxInit;
      return this._upstoxAdapter;
    }

    const { createUpstoxEquityAdapter } = await import('./marketBrokers/upstoxEquity.js');
    this._upstoxAdapter = createUpstoxEquityAdapter({ accessToken: token });
    this._upstoxToken = token;
    this._upstoxInit = this._upstoxAdapter.init(FNO_UNIVERSE.map((s) => s.symbol));
    await this._upstoxInit;
    return this._upstoxAdapter;
  }

  async _fetchUpstoxCandles(symbol, { timeframe, rangeDays }) {
    try {
      const adapter = await this._ensureUpstoxAdapter();
      if (!adapter) return [];
      const rows = await adapter.fetchHistoricalCandles(symbol, { timeframe, rangeDays });
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn(`[MarketDataService] Upstox chart fallback ${symbol}:`, e.message);
      return [];
    }
  }

  addPriorityStock(symbol) {
    if (symbol) {
      this.priorityStocks.add(symbol.toUpperCase());
      // Ensure lean pump is running when someone opens a chart
      this.startLeanLivePump();
    }
  }

  removePriorityStock(symbol) {
    if (symbol) {
      this.priorityStocks.delete(symbol.toUpperCase());
    }
  }

  /**
   * Initialize historical data and starting states for all stocks
   */
  async initialize(ioInstance = null) {
    if (this.initialized) return;
    this.io = ioInstance;

    console.log('[MarketDataService] Initializing F&O universe (admin default → fallbacks — no dummy candles)...');

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
        hasRealCandles: false
      });
    }

    this.initialized = true;
    console.log(`[MarketDataService] Initialized ${this.stocks.size} F&O symbols (awaiting live quotes).`);

    // Init Opening Momentum engine — do NOT freeze here (prices are still 0).
    // Auto-freeze runs after live quotes calibrate / at 09:20 IST.
    await openingMomentumService.initialize(this.io);

    await this.startPlatformLiveFeed();
  }

  /**
   * Platform default: Fyers live quotes + candle warm.
   * @returns {Promise<boolean>} true when Fyers feed is active
   */
  async initFyersLiveFeed() {
    const appId = process.env.FYERS_APP_ID || fyersService.appId;
    const token = process.env.FYERS_ACCESS_TOKEN || fyersService.accessToken;
    if (!appId || !token) {
      console.warn('[MarketDataService] No Fyers credentials — trying Upstox fallback.');
      return false;
    }

    fyersService.applyCredentials({
      appId,
      appSecret: process.env.FYERS_APP_SECRET || fyersService.appSecret,
      accessToken: token,
      refreshToken: process.env.FYERS_REFRESH_TOKEN || fyersService.refreshToken,
      pin: process.env.FYERS_PIN || fyersService.pin
    });

    const ok = await fyersService.ensureSession();
    if (!ok || !fyersService.configured) {
      console.warn('[MarketDataService] Fyers session not ready — trying Upstox fallback.');
      return false;
    }

    // Probe real quotes — expired/invalid token must not stay primary
    fyersService.setUniverse(['RELIANCE', 'SBIN', 'TCS']);
    try {
      const probe = await fyersService.fetchLiveQuotes(['RELIANCE', 'SBIN', 'TCS']);
      if (!probe?.length) {
        fyersService.markAuthUnhealthy('probe returned no quotes');
        console.warn('[MarketDataService] Fyers token invalid/empty — trying Upstox fallback.');
        return false;
      }
    } catch (err) {
      fyersService.markAuthUnhealthy(err.message);
      console.warn('[MarketDataService] Fyers probe failed — trying Upstox fallback:', err.message);
      return false;
    }

    await this.activateFyersLiveFeed();
    return true;
  }

  /** When Fyers dies mid-session, move live feed along admin priority. */
  async failoverLiveFeedFromFyers(reason = '') {
    return this.failoverLiveFeed('fyers', reason);
  }

  /**
   * Upstox live quotes (after Fyers fails / missing).
   * @returns {Promise<boolean>}
   */
  async initUpstoxLiveFeed() {
    try {
      const adapter = await this._ensureUpstoxAdapter();
      if (!adapter) {
        console.warn('[MarketDataService] No Upstox token — trying Kotak fallback.');
        return false;
      }
      // Probe quotes — throw = bad/expired token; empty array OK (off-hours)
      await adapter.getQuotes(['RELIANCE', 'SBIN']);
      await this.activateUpstoxLiveFeed(adapter);
      return true;
    } catch (err) {
      console.warn('[MarketDataService] Upstox live feed unavailable:', err.message);
      return false;
    }
  }

  async activateUpstoxLiveFeed(adapter) {
    if (this.activeFeedProvider && this.activeFeedProvider !== 'upstox') {
      console.log(
        `[MarketDataService] Upstox ready but ${this.activeFeedProvider} remains primary feed.`
      );
      return;
    }
    this.stopAllPlatformFeeds();
    console.log('🔥 [MarketDataService] UPSTOX LIVE NSE DATA CONNECTED!');
    this.isRealData = true;
    this.activeFeedProvider = 'upstox';

    if (this._upstoxPollInterval) {
      clearInterval(this._upstoxPollInterval);
      this._upstoxPollInterval = null;
    }

    try {
      const ticks = await adapter.getQuotes(Array.from(this.stocks.keys()));
      if (ticks?.length) {
        for (const t of ticks) {
          const stock = this.stocks.get(t.symbol);
          if (!stock) continue;
          stock.currentPrice = t.currentPrice;
          stock.high = t.high || t.currentPrice;
          stock.low = t.low || t.currentPrice;
          stock.dayOpen = t.open || t.currentPrice;
          stock.change = t.change;
          stock.volume = t.volume || 0;
        }
        console.log(`[MarketDataService] Calibrated Upstox quotes for ${ticks.length} symbols.`);
        this.broadcastScreener();
      }
    } catch (calibErr) {
      console.error('[MarketDataService] Upstox calibration error:', calibErr.message);
    }

    openingMomentumService.startScheduler(() => this.stocks);

    const pollMs = Math.max(2500, Number(process.env.UPSTOX_QUOTE_POLL_MS) || 4000);
    const poll = async () => {
      try {
        const ticks = await adapter.getQuotes(Array.from(this.stocks.keys()));
        if (ticks?.length) this.handleRealTicks(ticks);
      } catch (err) {
        console.warn('[MarketDataService] Upstox poll error:', err.message);
      }
    };
    void poll();
    this._upstoxPollInterval = setInterval(poll, pollMs);
    console.log(`[MarketDataService] Upstox quote poll started (${pollMs}ms)`);
    this.startLeanLivePump();
    void this.warmRealCandles();
  }

  async activateFyersLiveFeed() {
    this.stopAllPlatformFeeds();
    console.log('🔥 [MarketDataService] FYERS LIVE NSE DATA CONNECTED!');
    this.isRealData = true;
    this.activeFeedProvider = 'fyers';

    fyersService.setUniverse(Array.from(this.stocks.keys()));
    fyersService.onAuthDead((reason) => {
      void this.failoverLiveFeed('fyers', reason);
    });

    try {
      const ticks = await fyersService.fetchLiveQuotes();
      if (ticks?.length) {
        for (const t of ticks) {
          const stock = this.stocks.get(t.symbol);
          if (!stock) continue;
          stock.currentPrice = t.currentPrice;
          stock.high = t.high || t.currentPrice;
          stock.low = t.low || t.currentPrice;
          stock.dayOpen = t.open || t.currentPrice;
          stock.change = t.change;
          stock.volume = t.volume || 0;
        }
        console.log(`[MarketDataService] Calibrated Fyers quotes for ${ticks.length} symbols.`);
        this.broadcastScreener();
      }
    } catch (calibErr) {
      console.error('[MarketDataService] Fyers calibration error:', calibErr.message);
    }

    openingMomentumService.startScheduler(() => this.stocks);
    fyersService.startLiveFeed((ticks) => this.handleRealTicks(ticks));
    this.startLeanLivePump();
    void this.warmRealCandles();
  }

  /**
   * Connect to Kotak Neo live market feed
   * @returns {Promise<boolean>}
   */
  async initKotakLiveFeed() {
    const hasCredentials =
      process.env.KOTAK_CONSUMER_KEY &&
      process.env.KOTAK_UCC &&
      process.env.KOTAK_TOTP_KEY;

    if (!hasCredentials) {
      console.warn('[MarketDataService] No Kotak Neo credentials found.');
      return false;
    }

    console.log('[MarketDataService] Kotak Neo credentials detected. Attempting live connection...');
    const loggedIn = await kotakNeoService.login();

    if (loggedIn) {
      await this.activateKotakLiveFeed();
      return this.activeFeedProvider === 'kotak';
    }

    console.warn('[MarketDataService] Kotak Neo login pending/failed — will retry in background.');
    if (!this.kotakRetryInterval) {
      this.kotakRetryInterval = setInterval(async () => {
        if (this.activeFeedProvider) {
          clearInterval(this.kotakRetryInterval);
          this.kotakRetryInterval = null;
          return;
        }
        const retryLogin = await kotakNeoService.login();
        if (retryLogin) {
          clearInterval(this.kotakRetryInterval);
          this.kotakRetryInterval = null;
          await this.activateKotakLiveFeed();
        }
      }, 10000);
    }
    return false;
  }

  async activateKotakLiveFeed() {
    if (this.activeFeedProvider && this.activeFeedProvider !== 'kotak') {
      console.log(
        `[MarketDataService] Kotak ready but ${this.activeFeedProvider} remains primary feed.`
      );
      return;
    }
    this.stopAllPlatformFeeds();
    console.log('🔥 [MarketDataService] KOTAK LIVE NSE DATA CONNECTED!');
    this.isRealData = true;
    this.activeFeedProvider = 'kotak';

    try {
      const initialQuotes = await kotakNeoService.fetchLiveQuotes();
      if (initialQuotes && initialQuotes.length > 0) {
        for (const q of initialQuotes) {
          const ltp = parseFloat(q.ltp || q.last_price || q.ohlc?.close || 0);
          if (!ltp) continue;
          const tokenStr = String(q.exchange_token || q.instrument_token || q.token || '');
          const cleanDisplay = String(q.display_symbol || q.trading_symbol || '').replace(/-EQ$/, '').trim();
          const mapping = kotakNeoService.tokenMap.find(
            (m) => m.token === tokenStr || m.symbol === cleanDisplay || m.symbol === q.trading_symbol
          );
          if (!mapping) continue;
          const stock = this.stocks.get(mapping.symbol);
          if (stock) {
            stock.currentPrice = ltp;
            stock.high = parseFloat(q.ohlc?.high || q.high || ltp);
            stock.low = parseFloat(q.ohlc?.low || q.low || ltp);
            stock.dayOpen = parseFloat(q.ohlc?.open || ltp);
            stock.change = parseFloat(
              q.per_change || q.change || (((ltp - stock.dayOpen) / stock.dayOpen) * 100).toFixed(2)
            );
            stock.volume = parseInt(q.last_volume || q.total_traded_volume || stock.volume || 0, 10);
          }
        }
        console.log(`[MarketDataService] Calibrated live NSE quotes for ${this.stocks.size} symbols.`);
        // Push prices to Terminal/ticker immediately (don't wait for WS / candle warm)
        this.broadcastScreener();
      }
    } catch (calibErr) {
      console.error('[MarketDataService] Calibration error:', calibErr.message);
    }

    // Start 09:20 IST scheduler + catch-up freeze once LTPs exist
    openingMomentumService.startScheduler(() => this.stocks);

    kotakNeoService.startLiveFeed((ticks) => this.handleRealTicks(ticks));
    this.startLeanLivePump();
    // Warm real 5m history
    void this.warmRealCandles();
  }

  /** Active platform broker for APIs / socket / charts */
  getActiveFeedMeta() {
    const provider =
      this.activeFeedProvider ||
      process.env.PLATFORM_FEED_DEFAULT ||
      'kotak';
    const labels = {
      kotak: 'Platform · Kotak',
      fyers: 'Platform · Fyers',
      upstox: 'Platform · Upstox'
    };
    return {
      mode: 'server',
      provider,
      label: labels[provider] || `Platform · ${provider}`,
      live: this.isRealData === true
    };
  }

  broadcastScreener() {
    if (!this.io) return;
    const screener = this.getScreenerData();
    const feed = this.getActiveFeedMeta();
    this.io.emit('SCREENER_UPDATE', screener);
    // Keep INITIAL_STATE consumers in sync without a page refresh.
    this.io.emit('INITIAL_STATE', {
      screener,
      marketXRay: this.getMarketXRay(),
      openingMomentum: this.getOpeningMomentumData(),
      feed
    });
  }

  async warmRealCandles() {
    if (this._warmingCandles) return;
    this._warmingCandles = true;
    try {
      const { isMarketSessionTime } = await import('./orderFlow/marketSession.js');
      const live = isMarketSessionTime(Date.now());
      // Live session: Terminal screener needs candles now — don't wait on Order Flow forever.
      // After hours: brief wait so Order Flow futures can claim RPS first.
      const maxWait = live ? 20 : 120;
      for (let i = 0; i < maxWait; i++) {
        if (!orderFlowService._prefetching) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      // History: prefer Fyers/Upstox REST so Kotak gate stays free for live WS ticks.
      // Live quotes still follow admin default (kotak → …).
      const candleOrder = ['fyers', 'upstox', 'kotak'].filter((p) => {
        if (p === 'fyers') return fyersService.isUsable || process.env.FYERS_ACCESS_TOKEN;
        if (p === 'upstox') return Boolean(process.env.UPSTOX_ACCESS_TOKEN);
        if (p === 'kotak') return Boolean(process.env.KOTAK_CONSUMER_KEY);
        return false;
      });
      console.log(
        `[MarketDataService] Warming real 5m candles · ${candleOrder.join(' → ')} (throttled)…`
      );
      let consecutive429 = 0;
      const symbols = Array.from(this.stocks.values()).filter((s) => s.sector !== 'Indices');
      const priority = ['NIFTY 50', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS', 'SBIN'];
      const ordered = [
        ...priority.map((sym) => this.stocks.get(sym)).filter(Boolean),
        ...symbols.filter((s) => !priority.includes(s.symbol))
      ];
      // Warm the full Terminal universe so Order Block screener can fill.
      let warmed = 0;

      for (const stock of ordered) {
        if (stock.hasRealCandles && stock.smcData) continue;
        if (consecutive429 >= 4) {
          console.warn('[MarketDataService] Pausing candle warm after repeated 429s — will retry shortly.');
          break;
        }
        try {
          let realCandles = [];
          let warmProvider = null;
          for (const provider of candleOrder) {
            if (realCandles?.length) break;
            if (provider === 'fyers') {
              if (!fyersService.isUsable) continue;
              try {
                realCandles = await fyersService.fetchHistoricalCandles(stock.symbol, {
                  timeframe: '5m',
                  rangeDays: 2
                });
                if (realCandles?.length) warmProvider = 'fyers';
              } catch (fyErr) {
                if (fyersService.isAuthErrorMessage(fyErr.message)) {
                  fyersService.markAuthUnhealthy(fyErr.message);
                }
                console.warn(`[MarketDataService] Fyers warm ${stock.symbol}:`, fyErr.message);
              }
            } else if (provider === 'upstox') {
              realCandles = await this._fetchUpstoxCandles(stock.symbol, {
                timeframe: '5m',
                rangeDays: 2
              });
              if (realCandles?.length) warmProvider = 'upstox';
            } else if (provider === 'kotak') {
              // Live session: keep Kotak REST free for LTP — history comes from Upstox/Fyers.
              if (live) continue;
              if (kotakNeoService.isGateBusy?.()) continue;
              const mapping = kotakNeoService.tokenMap.find((m) => m.symbol === stock.symbol);
              if (mapping && (kotakNeoService.isLoggedIn || process.env.KOTAK_CONSUMER_KEY)) {
                realCandles = await kotakNeoService.fetchHistoricalCandles(mapping.segment, mapping.token, {
                  timeframe: '5m',
                  rangeDays: 2
                });
                if (realCandles?.length) warmProvider = 'kotak';
              }
            }
          }
          consecutive429 = 0;
          if (realCandles?.length) {
            const candles = filterNseSessionCandles(realCandles, '5m');
            if (candles.length) {
              stock.candles = candles;
              stock.hasRealCandles = true;
              stock.high = Math.max(...candles.map((c) => c.high));
              stock.low = Math.min(...candles.map((c) => c.low));
              stock.smcData = smcEngine.analyze(candles, stock.symbol, '5m');
              // Seed chart cache so opening chart doesn't re-hit broker on first load.
              stock.chartCache = {
                key: '5m:2',
                candles,
                smcData: stock.smcData,
                fetchedAt: Date.now(),
                provider: warmProvider || 'unknown'
              };
              warmed += 1;
              // Push setups to Terminal as soon as a few names have SMC.
              if (warmed === 3 || warmed % 8 === 0) this.broadcastScreener();
            }
          }
        } catch (err) {
          if (String(err.message || '').includes('429') || String(err.message || '').toLowerCase().includes('too many')) {
            consecutive429 += 1;
            await new Promise((r) => setTimeout(r, 5000));
          }
          console.warn(`[MarketDataService] Candle warm failed for ${stock.symbol}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, live ? 600 : 900));
      }
      console.log(`[MarketDataService] Real candle warm complete · ${warmed} stocks with SMC.`);
      this.broadcastScreener();
      openingMomentumService.ensureFrozen(this.stocks);
      openingMomentumService.refineFreezeFromOpeningCandles(this.stocks);

      // If 429 cut us short, retry the rest after a cool-down (no page refresh needed).
      const missing = ordered.filter((s) => !s.smcData).length;
      if (missing > 0 && !this._warmRetryTimer) {
        console.log(`[MarketDataService] ${missing} stocks still need candles — retry in 45s`);
        this._warmRetryTimer = setTimeout(() => {
          this._warmRetryTimer = null;
          void this.warmRealCandles();
        }, 45_000);
      }
    } finally {
      this._warmingCandles = false;
    }
  }

  /**
   * Process and broadcast real-time market ticks from Kotak Neo
   */
  handleRealTicks(ticks) {
    if (!ticks || ticks.length === 0) return;
    const updatedList = [];
    const inSession = isIndianMarketOpen();
    const nowSec = Math.floor(Date.now() / 1000);
    const bucketSec = 300; // default in-memory book is 5m
    const dayStartIst = (() => {
      const ymd = new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ });
      return Math.floor(new Date(`${ymd}T00:00:00+05:30`).getTime() / 1000);
    })();
    const bucketStart = dayStartIst + Math.floor((nowSec - dayStartIst) / bucketSec) * bucketSec;

    for (const tick of ticks) {
      const stock = this.stocks.get(tick.symbol);
      if (!stock) continue;

      const ltp = Number(tick.currentPrice);
      if (!Number.isFinite(ltp)) continue;

      stock.currentPrice = ltp;
      stock.change = tick.change;
      stock.high = Math.max(stock.high || ltp, Number(tick.high) || ltp, ltp);
      stock.low = Math.min(stock.low || ltp, Number(tick.low) || ltp, ltp);
      stock.volume = tick.volume || stock.volume;

      // Live candle updates only during NSE 09:15–15:30; use LTP (not day high/low)
      const candles = stock.candles;
      if (inSession && Array.isArray(candles)) {
        let lastCandle = candles.length ? candles[candles.length - 1] : null;
        if (!lastCandle || lastCandle.time < bucketStart) {
          lastCandle = {
            time: bucketStart,
            open: ltp,
            high: ltp,
            low: ltp,
            close: ltp,
            volume: stock.volume || 0
          };
          candles.push(lastCandle);
        } else {
          lastCandle.close = ltp;
          lastCandle.high = Math.max(lastCandle.high, ltp);
          lastCandle.low = Math.min(lastCandle.low, ltp);
          lastCandle.volume = stock.volume;
        }
      }

      if (inSession && candles?.length && candles.length % 3 === 0) {
        stock.smcData = smcEngine.analyze(candles, stock.symbol, '5m');
      }

      const lastCandle = candles?.[candles.length - 1];
      updatedList.push({
        symbol: stock.symbol,
        currentPrice: stock.currentPrice,
        change: stock.change,
        high: stock.high,
        low: stock.low,
        volume: stock.volume,
        candle: lastCandle
          ? {
              time: lastCandle.time,
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close
            }
          : null,
        smcData: stock.smcData
      });
    }

    // Broadcast to connected WebSocket clients
    if (this.io && updatedList.length > 0) {
      this.io.emit('MARKET_TICK', updatedList);
    }

    // Periodically broadcast Market X-Ray macro statistics (every ~3 ticks)
    this.tickCount = (this.tickCount || 0) + 1;
    if (this.io && this.tickCount % 3 === 0) {
      this.io.emit('MARKET_XRAY', this.getMarketXRay());
    }

    // Periodically broadcast Opening 5-Minute Momentum Scanner rankings
    if (this.io && this.tickCount % 2 === 0) {
      this.io.emit('OPENING_MOMENTUM', openingMomentumService.getLiveRankings(this.stocks));
    }
  }

  /**
   * Get filtered & ranked Order Block Screener results
   */
  getScreenerData(filter = 'ALL') {
    const bullishSetups = [];
    const bearishSetups = [];

    for (const [symbol, stock] of this.stocks.entries()) {
      const smc = stock.smcData;
      if (!smc) continue;

      // Bullish OB
      if (smc.activeBullishOB) {
        const ob = smc.activeBullishOB;
        const distPercent = parseFloat((((stock.currentPrice - ob.top) / stock.currentPrice) * 100).toFixed(2));
        bullishSetups.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          currentPrice: stock.currentPrice,
          change: stock.change,
          zoneTop: ob.top,
          zoneBottom: ob.bottom,
          distancePercent: distPercent,
          score: ob.score,
          volumeRatio: ob.volumeRatio,
          testCount: ob.testCount,
          timeFormed: ob.time,
          type: 'BULLISH',
          liquidityTarget: smc.liquidity?.buySide?.price || stock.high
        });
      }

      // Bearish OB
      if (smc.activeBearishOB) {
        const ob = smc.activeBearishOB;
        const distPercent = parseFloat((((ob.bottom - stock.currentPrice) / stock.currentPrice) * 100).toFixed(2));
        bearishSetups.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          currentPrice: stock.currentPrice,
          change: stock.change,
          zoneTop: ob.top,
          zoneBottom: ob.bottom,
          distancePercent: distPercent,
          score: ob.score,
          volumeRatio: ob.volumeRatio,
          testCount: ob.testCount,
          timeFormed: ob.time,
          type: 'BEARISH',
          liquidityTarget: smc.liquidity?.sellSide?.price || stock.low
        });
      }
    }

    // Sort by setup score descending
    bullishSetups.sort((a, b) => b.score - a.score);
    bearishSetups.sort((a, b) => b.score - a.score);

    const allStocks = Array.from(this.stocks.values()).map((s) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      currentPrice: s.currentPrice,
      change: s.change,
      volume: s.volume,
      high: s.high,
      low: s.low
    }));

    return {
      allStocks,
      bullishSetups,
      bearishSetups,
      totalBullish: bullishSetups.length,
      totalBearish: bearishSetups.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get Market X-Ray macro statistics & Institutional Macro Flow
   */
  getMarketXRay() {
    const all = Array.from(this.stocks.values());
    const nonIndices = all.filter((s) => s.sector !== 'Indices');

    const advancing = nonIndices.filter((s) => s.change > 0).length;
    const declining = nonIndices.filter((s) => s.change < 0).length;
    const neutral = nonIndices.filter((s) => s.change === 0).length;

    const advancingVolume = nonIndices
      .filter((s) => s.change > 0)
      .reduce((acc, s) => acc + (s.volume || 0), 0);
    const decliningVolume = nonIndices
      .filter((s) => s.change < 0)
      .reduce((acc, s) => acc + (s.volume || 0), 0);

    const advanceVolumeRatio = decliningVolume > 0
      ? parseFloat((advancingVolume / decliningVolume).toFixed(2))
      : advancingVolume > 0
        ? advancing
        : 0;

    // Sector breakdown with full constituent details for interactive drilldown
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
      sectorStats[stock.sector].totalChange += stock.change;
      sectorStats[stock.sector].count += 1;
      if (stock.change > 0) sectorStats[stock.sector].advancing += 1;
      else if (stock.change < 0) sectorStats[stock.sector].declining += 1;

      // Determine SMC status
      let smcBias = 'NEUTRAL';
      let obZone = null;
      if (stock.smcData?.activeBullishOB) {
        smcBias = 'BULLISH_OB';
        obZone = `₹${stock.smcData.activeBullishOB.bottom} - ₹${stock.smcData.activeBullishOB.top}`;
      } else if (stock.smcData?.activeBearishOB) {
        smcBias = 'BEARISH_OB';
        obZone = `₹${stock.smcData.activeBearishOB.bottom} - ₹${stock.smcData.activeBearishOB.top}`;
      } else if (stock.change >= 1.0) {
        smcBias = 'BOS_EXPANSION';
      } else if (stock.change <= -1.0) {
        smcBias = 'BEARISH_DISPLACEMENT';
      }

      sectorStats[stock.sector].stocks.push({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice,
        change: stock.change,
        volume: stock.volume,
        high: stock.high,
        low: stock.low,
        smcBias,
        obZone,
        score: stock.smcData?.bullishScore || stock.smcData?.bearishScore || null
      });
    }

    const sectors = Object.entries(sectorStats).map(([sector, data]) => {
      const sortedStocks = [...data.stocks].sort((a, b) => b.change - a.change);
      const avgChange = parseFloat((data.totalChange / data.count).toFixed(2));
      return {
        name: sector,
        avgChange,
        count: data.count,
        advancingCount: data.advancing,
        decliningCount: data.declining,
        status: avgChange > 0.35 ? 'BULLISH' : (avgChange < -0.35 ? 'BEARISH' : 'NEUTRAL'),
        topGainer: sortedStocks[0] || null,
        topDragger: sortedStocks[sortedStocks.length - 1] || null,
        stocks: sortedStocks
      };
    }).sort((a, b) => b.avgChange - a.avgChange);

    const screener = this.getScreenerData();

    // Live Nifty & BankNifty only — no hardcoded fallbacks
    const niftyStock = this.stocks.get('NIFTY 50') || { currentPrice: 0, change: 0 };
    const bankNiftyStock = this.stocks.get('BANKNIFTY') || { currentPrice: 0, change: 0 };

    // SMT from live index % changes only
    let smtStatus = 'AWAITING LIVE INDEX QUOTES';
    let smtType = 'NEUTRAL';
    let smtDetails = 'Waiting for live Nifty / BankNifty quotes from Kotak.';
    let confluenceScore = null;

    if (niftyStock.currentPrice > 0 && bankNiftyStock.currentPrice > 0) {
      smtStatus = 'MACRO CONFLUENCE';
      smtType = niftyStock.change >= 0 && bankNiftyStock.change >= 0 ? 'BULLISH' : niftyStock.change < 0 && bankNiftyStock.change < 0 ? 'BEARISH' : 'MIXED';
      smtDetails = `Nifty ${niftyStock.change >= 0 ? '+' : ''}${niftyStock.change}% · BankNifty ${bankNiftyStock.change >= 0 ? '+' : ''}${bankNiftyStock.change}% (live).`;
      confluenceScore = Math.round(50 + Math.max(-40, Math.min(40, (niftyStock.change + bankNiftyStock.change) * 8)));

      if (niftyStock.change > 0.4 && bankNiftyStock.change < -0.1) {
        smtStatus = 'BEARISH SMT DIVERGENCE';
        smtType = 'BEARISH';
        smtDetails = 'Nifty higher while BankNifty lags (live quotes).';
        confluenceScore = 48;
      } else if (niftyStock.change < -0.4 && bankNiftyStock.change > 0.1) {
        smtStatus = 'BULLISH SMT DIVERGENCE';
        smtType = 'BULLISH';
        smtDetails = 'BankNifty holding while Nifty dips (live quotes).';
        confluenceScore = 74;
      }
    }

    // Volume leaders from live quote volume only
    const volumeSurgeStocks = [...nonIndices]
      .filter((s) => (s.volume || 0) > 0 && s.currentPrice > 0)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        currentPrice: s.currentPrice,
        change: s.change,
        volume: s.volume,
        actionTag: s.smcData?.activeBullishOB
          ? 'ORDER BLOCK RETEST'
          : s.smcData?.activeBearishOB
            ? 'BEARISH ORDER BLOCK'
            : s.change > 1.2
              ? 'STRONG ADVANCE'
              : s.change < -1.2
                ? 'STRONG DECLINE'
                : 'ACTIVE'
      }));

    return {
      advancing,
      declining,
      neutral,
      totalStocks: nonIndices.length,
      advanceDeclineRatio: declining > 0 ? parseFloat((advancing / declining).toFixed(2)) : advancing,
      advancingVolume,
      decliningVolume,
      advanceVolumeRatio,
      sectors,
      bullishSetupsCount: screener.totalBullish,
      bearishSetupsCount: screener.totalBearish,
      // Fabricated FII/DII / VIX / PCR removed — only real feeds when wired
      fiiDiiFlow: {
        available: false,
        fiiNetCash: null,
        diiNetCash: null,
        netInstitutionalFlow: null,
        fiiLongRatio: null,
        fiiShortRatio: null,
        participantBreakdown: [],
        insight: 'FII/DII positioning is not fabricated. Connect an exchange/official flow feed to show this block.'
      },
      vixRegime: {
        available: false,
        indiaVix: null,
        vixChange: null,
        regime: 'UNAVAILABLE',
        description: 'India VIX is not simulated. Wire a live VIX quote to enable this block.',
        niftyPrice: niftyStock.currentPrice || null,
        bankNiftyPrice: bankNiftyStock.currentPrice || null,
        niftyDailyRange: { low: null, high: null, points: null },
        bankNiftyDailyRange: { low: null, high: null, points: null },
        niftyWeeklyRange: { low: null, high: null, points: null }
      },
      optionsMacro: {
        available: false,
        niftyPcr: null,
        bankNiftyPcr: null,
        niftyMaxPain: null,
        bankNiftyMaxPain: null,
        niftyCallWall: null,
        niftyPutWall: null,
        summary: 'Option PCR / max-pain walls come from Order Flow (Kotak option chain), not dummy numbers.'
      },
      smtDivergence: {
        status: smtStatus,
        type: smtType,
        details: smtDetails,
        confluenceScore,
        niftyChange: niftyStock.change,
        bankNiftyChange: bankNiftyStock.change
      },
      volumeSurgeStocks,
      isLive: this.isRealData === true,
      timestamp: Date.now()
    };
  }

  /**
   * Resolve chart/screener symbol aliases (NIFTY → NIFTY 50, etc.).
   */
  _resolveStock(symbol) {
    const raw = String(symbol || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    if (!raw) return null;

    const aliases = {
      NIFTY: 'NIFTY 50',
      NIFTY50: 'NIFTY 50',
      'NIFTY FIFTY': 'NIFTY 50',
      'BANK NIFTY': 'BANKNIFTY',
      BNF: 'BANKNIFTY'
    };
    const key = aliases[raw] || raw;
    return this.stocks.get(key) || this.stocks.get(raw) || null;
  }

  /**
   * Get individual stock detail including LIVE candles for chart rendering.
   * Fake/generated candles are never returned for charts.
   */
  async getStockDetails(symbol, options = {}) {
    const stock = this._resolveStock(symbol);
    if (!stock) return null;

    const timeframe = options.timeframe || '5m';
    const rangeDays = capRangeDaysForTimeframe(timeframe, options.rangeDays || 30);
    const cacheKey = `${timeframe}:${rangeDays}`;

    let candles = [];
    let smcData = null;
    let dataSource = 'unavailable';
    let high = stock.high;
    let low = stock.low;

    const cacheFresh =
      stock.chartCache?.candles?.length > 0 &&
      Date.now() - (stock.chartCache.fetchedAt || 0) < CHART_CACHE_TTL_MS;
    const cacheHit = cacheFresh && stock.chartCache.key === cacheKey;
    // Same TF warm (e.g. screener 5m:2) while UI asks 5m:5 — show immediately, refresh below.
    const softCacheHit =
      !cacheHit &&
      cacheFresh &&
      String(stock.chartCache.key || '').startsWith(`${timeframe}:`);

    if (cacheHit || softCacheHit) {
      candles = stock.chartCache.candles;
      smcData = stock.chartCache.smcData;
      dataSource = 'live';
      high = Math.max(...candles.map((c) => c.high));
      low = Math.min(...candles.map((c) => c.low));
    } else if (
      timeframe === '5m' &&
      Array.isArray(stock.candles) &&
      stock.candles.length > 0
    ) {
      // List already warmed this symbol — serve it on first chart open (no Kotak re-hit).
      candles = stock.candles;
      smcData = stock.smcData || smcEngine.analyze(candles, stock.symbol, timeframe);
      dataSource = 'live';
      high = Math.max(...candles.map((c) => c.high));
      low = Math.min(...candles.map((c) => c.low));
      stock.chartCache = {
        key: cacheKey,
        candles,
        smcData,
        fetchedAt: Date.now()
      };
    }

    // Only hit Kotak when we still have nothing (or need a different TF than warm).
    if (!candles.length) {
      const inflightKey = `${stock.symbol}|${cacheKey}`;
      let fetchPromise = this._historyInflight.get(inflightKey);

      if (!fetchPromise) {
        fetchPromise = (async () => {
          let filtered = [];
          let provider = null;

          // Chart history: Fyers → Upstox → Kotak (spare Kotak REST for live WS)
          const historyOrder = ['fyers', 'upstox', 'kotak'];
          for (const p of historyOrder) {
            if (filtered.length) break;
            if (p === 'fyers') {
              if (!(fyersService.isUsable || process.env.FYERS_ACCESS_TOKEN)) continue;
              try {
                if (!fyersService.configured) {
                  fyersService.applyCredentials({
                    appId: process.env.FYERS_APP_ID || '',
                    appSecret: process.env.FYERS_APP_SECRET || '',
                    accessToken: process.env.FYERS_ACCESS_TOKEN || '',
                    refreshToken: process.env.FYERS_REFRESH_TOKEN || '',
                    pin: process.env.FYERS_PIN || ''
                  });
                }
                if (!fyersService.isUsable) continue;
                const fyCandles = await fyersService.fetchHistoricalCandles(stock.symbol, {
                  timeframe,
                  rangeDays
                });
                filtered = filterNseSessionCandles(fyCandles || [], timeframe);
                if (filtered.length) provider = 'fyers';
              } catch (e) {
                if (fyersService.isAuthErrorMessage?.(e.message)) {
                  fyersService.markAuthUnhealthy(e.message);
                }
                console.warn(`[MarketDataService] Fyers chart ${stock.symbol}:`, e.message);
              }
            } else if (p === 'upstox') {
              if (!process.env.UPSTOX_ACCESS_TOKEN) continue;
              const upCandles = await this._fetchUpstoxCandles(stock.symbol, {
                timeframe,
                rangeDays
              });
              filtered = filterNseSessionCandles(upCandles, timeframe);
              if (filtered.length) {
                provider = 'upstox';
                console.log(
                  `[MarketDataService] Chart ${stock.symbol} ${timeframe}/${rangeDays}d via Upstox`
                );
              }
            } else if (p === 'kotak') {
              if (kotakNeoService.isGateBusy?.()) {
                console.warn(
                  `[MarketDataService] Kotak gate busy — skip chart history for ${stock.symbol}`
                );
                continue;
              }
              const mapping = kotakNeoService.tokenMap.find((m) => m.symbol === stock.symbol);
              if (mapping && (kotakNeoService.isLoggedIn || process.env.KOTAK_CONSUMER_KEY)) {
                try {
                  const realCandles = await kotakNeoService.fetchHistoricalCandles(
                    mapping.segment,
                    mapping.token,
                    { timeframe, rangeDays }
                  );
                  filtered = filterNseSessionCandles(realCandles || [], timeframe);
                  if (filtered.length) provider = 'kotak';
                } catch (e) {
                  console.warn(`[MarketDataService] Kotak chart ${stock.symbol}:`, e.message);
                }
              }
            }
          }

          if (!filtered.length) return null;
          const analyzed = smcEngine.analyze(filtered, stock.symbol, timeframe);
          stock.chartCache = {
            key: cacheKey,
            candles: filtered,
            smcData: analyzed,
            fetchedAt: Date.now(),
            provider
          };
          if (timeframe === '5m' && rangeDays <= 29) {
            stock.candles = filtered;
            stock.hasRealCandles = true;
            stock.smcData = analyzed;
            stock.high = Math.max(...filtered.map((c) => c.high));
            stock.low = Math.min(...filtered.map((c) => c.low));
          }
          return stock.chartCache;
        })().finally(() => {
          this._historyInflight.delete(inflightKey);
        });
        this._historyInflight.set(inflightKey, fetchPromise);
      }

      try {
        const result = await fetchPromise;
        if (result?.candles?.length) {
          candles = result.candles;
          smcData = result.smcData;
          dataSource = 'live';
          high = Math.max(...candles.map((c) => c.high));
          low = Math.min(...candles.map((c) => c.low));
        }
      } catch (e) {
        console.error(`[MarketDataService] Failed to fetch live candles for ${stock.symbol}:`, e.message);
      }
    }

    const feed = this.getActiveFeedMeta();
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
      chartProvider: stock.chartCache?.provider || feed.provider || null,
      feed,
      isLive: dataSource === 'live' && this.isRealData === true,
      candles,
      smcData
    };
  }

  /**
   * Get Opening 5-Minute Momentum Scanner rankings & stats
   */
  getOpeningMomentumData() {
    return openingMomentumService.getLiveRankings(this.stocks);
  }

  /**
   * Market analyse report: Nifty + BankNifty bias, pivots, up/down scenarios.
   */
  async getMarketAnalysis(options = {}) {
    const timeframe = options.timeframe || '5m';
    const rangeDays = options.rangeDays || 10;

    const [niftyDetail, bankDetail] = await Promise.all([
      this.getStockDetails('NIFTY 50', { timeframe, rangeDays }),
      this.getStockDetails('BANKNIFTY', { timeframe, rangeDays })
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
    const report = buildMarketAnalysisReport({
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
    });

    return {
      ...report,
      timeframe,
      rangeDays,
      isLive: this.isRealData === true
    };
  }
}

export const marketDataService = new MarketDataService();
