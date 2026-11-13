import { smcEngine } from '../algorithms/smcEngine.js';
import { openingMomentumService } from './openingMomentumService.js';
import { kotakNeoService } from './kotakNeoService.js';
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
const FNO_UNIVERSE = [
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
  }

  addPriorityStock(symbol) {
    if (symbol) {
      this.priorityStocks.add(symbol.toUpperCase());
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

    console.log('[MarketDataService] Initializing F&O universe (live Kotak only — no dummy candles)...');

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
    console.log(`[MarketDataService] Initialized ${this.stocks.size} F&O symbols (awaiting Kotak live quotes).`);

    // Init Opening Momentum engine — do NOT freeze here (prices are still 0).
    // Auto-freeze runs after Kotak quotes calibrate / at 09:20 IST.
    await openingMomentumService.initialize(this.io);

    // Initialize Kotak Neo Live Market Feed
    this.initKotakLiveFeed();
  }

  /**
   * Connect to real Kotak Neo live market feed and disable simulation
   */
  async initKotakLiveFeed() {
    const hasCredentials =
      process.env.KOTAK_CONSUMER_KEY &&
      process.env.KOTAK_UCC &&
      process.env.KOTAK_TOTP_KEY;

    if (!hasCredentials) {
      console.warn('[MarketDataService] No Kotak Neo credentials found. Live ticks disabled (no simulation).');
      this.isRealData = false;
      return;
    }

    console.log('[MarketDataService] Kotak Neo credentials detected. Attempting live connection...');
    const loggedIn = await kotakNeoService.login();

    if (loggedIn) {
      await this.activateKotakLiveFeed();
    } else {
      console.warn('[MarketDataService] Kotak Neo login pending/failed. Waiting for live session (no simulation).');
      this.isRealData = false;

      // Retry every 10 seconds until live session is available
      this.kotakRetryInterval = setInterval(async () => {
        const retryLogin = await kotakNeoService.login();
        if (retryLogin) {
          clearInterval(this.kotakRetryInterval);
          this.kotakRetryInterval = null;
          await this.activateKotakLiveFeed();
        }
      }, 10000);
    }
  }

  async activateKotakLiveFeed() {
    console.log('🔥 [MarketDataService] REAL LIVE NSE DATA CONNECTED!');
    this.isRealData = true;

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
      }
    } catch (calibErr) {
      console.error('[MarketDataService] Calibration error:', calibErr.message);
    }

    // Start 09:20 IST scheduler + catch-up freeze once LTPs exist
    openingMomentumService.startScheduler(() => this.stocks);

    kotakNeoService.startLiveFeed((ticks) => this.handleRealTicks(ticks));
    // Warm real 5m history from Kotak (not generated)
    void this.warmRealCandles();
  }

  broadcastScreener() {
    if (!this.io) return;
    const screener = this.getScreenerData();
    this.io.emit('SCREENER_UPDATE', screener);
    // Keep INITIAL_STATE consumers in sync without a page refresh.
    this.io.emit('INITIAL_STATE', {
      screener,
      marketXRay: this.getMarketXRay(),
      openingMomentum: this.getOpeningMomentumData()
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
      console.log('[MarketDataService] Warming real 5m candles from Kotak (throttled)…');
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
        const mapping = kotakNeoService.tokenMap.find((m) => m.symbol === stock.symbol);
        if (!mapping) continue;
        try {
          const realCandles = await kotakNeoService.fetchHistoricalCandles(mapping.segment, mapping.token, {
            timeframe: '5m',
            rangeDays: 2
          });
          consecutive429 = 0;
          if (realCandles?.length) {
            const candles = filterNseSessionCandles(realCandles, '5m');
            if (candles.length) {
              stock.candles = candles;
              stock.hasRealCandles = true;
              stock.high = Math.max(...candles.map((c) => c.high));
              stock.low = Math.min(...candles.map((c) => c.low));
              stock.smcData = smcEngine.analyze(candles, stock.symbol, '5m');
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
   * Get individual stock detail including LIVE candles for chart rendering.
   * Fake/generated candles are never returned for charts.
   */
  async getStockDetails(symbol, options = {}) {
    const stock = this.stocks.get(String(symbol || '').toUpperCase());
    if (!stock) return null;

    const timeframe = options.timeframe || '5m';
    const rangeDays = capRangeDaysForTimeframe(timeframe, options.rangeDays || 30);
    const cacheKey = `${timeframe}:${rangeDays}`;

    let candles = [];
    let smcData = null;
    let dataSource = 'unavailable';
    let high = stock.high;
    let low = stock.low;

    const cacheHit =
      stock.chartCache?.key === cacheKey &&
      Array.isArray(stock.chartCache.candles) &&
      stock.chartCache.candles.length > 0 &&
      Date.now() - (stock.chartCache.fetchedAt || 0) < CHART_CACHE_TTL_MS;

    if (cacheHit) {
      candles = stock.chartCache.candles;
      smcData = stock.chartCache.smcData;
      dataSource = 'live';
      high = Math.max(...candles.map((c) => c.high));
      low = Math.min(...candles.map((c) => c.low));
    } else {
      const inflightKey = `${stock.symbol}|${cacheKey}`;
      let fetchPromise = this._historyInflight.get(inflightKey);

      if (!fetchPromise) {
        fetchPromise = (async () => {
          const mapping = kotakNeoService.tokenMap.find((m) => m.symbol === stock.symbol);
          if (!mapping || !(kotakNeoService.isLoggedIn || process.env.KOTAK_CONSUMER_KEY)) {
            return null;
          }
          const realCandles = await kotakNeoService.fetchHistoricalCandles(mapping.segment, mapping.token, {
            timeframe,
            rangeDays
          });
          if (!realCandles?.length) return null;
          const filtered = filterNseSessionCandles(realCandles, timeframe);
          if (!filtered.length) return null;
          const analyzed = smcEngine.analyze(filtered, stock.symbol, timeframe);
          stock.chartCache = {
            key: cacheKey,
            candles: filtered,
            smcData: analyzed,
            fetchedAt: Date.now()
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
}

export const marketDataService = new MarketDataService();
