import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { kotakNeoService } from './kotakNeoService.js';
import { createUpstoxOrderFlowProvider } from './upstoxOrderFlowProvider.js';
import { encodeSeries, marketFile } from './orderFlow/marketFile.js';
import {
  filterLiveExpiries,
  getLatestTradingSessionDate,
  isMarketSessionTime,
  marketParts
} from './orderFlow/marketSession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/order-flow');
const WORKERS = 2;
/** Match order-flow-main: futures cache ~60s while the session is live. */
const FUTURES_KEEP_MS = 60_000;
const CHAIN_COUNT = 40;
const CHAIN_CACHE_MS = 90_000;
/** Kotak market rebuilds are expensive; leave room for /futures. */
const MARKET_LIVE_MS = Math.max(90_000, Number(process.env.ORDER_FLOW_LIVE_MS) || 120_000);

/** Nifty 50 + NIFTY — build these first so the default board fills like order-flow-main. */
const NIFTY_50_PRIORITY = new Set([
  'NIFTY', 'ADANIENT', 'ADANIPORTS', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO',
  'BAJFINANCE', 'BAJAJFINSV', 'BEL', 'BHARTIARTL', 'CIPLA', 'COALINDIA', 'DRREDDY', 'EICHERMOT',
  'ETERNAL', 'GRASIM', 'HCLTECH', 'HDFCBANK', 'HDFCLIFE', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK',
  'INDIGO', 'INFY', 'ITC', 'JIOFIN', 'JSWSTEEL', 'KOTAKBANK', 'LT', 'M&M', 'MARUTI', 'MAXHEALTH',
  'NESTLEIND', 'NTPC', 'ONGC', 'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SHRIRAMFIN',
  'SUNPHARMA', 'TATACONSUM', 'TMPV', 'TATASTEEL', 'TCS', 'TECHM', 'TITAN', 'TRENT', 'ULTRACEMCO',
  'WIPRO'
]);

/** Index symbol aliases: our symbol → Kotak underlying / quote mapping */
const INDEX_META = {
  NIFTY: { kotak: 'NIFTY', quote: { symbol: 'NIFTY 50', token: '61471', segment: 'nse_fo' }, exch: 'NSE' },
  BANKNIFTY: { kotak: 'BANKNIFTY', quote: { symbol: 'BANKNIFTY', token: '61466', segment: 'nse_fo' }, exch: 'NSE' },
  FINNIFTY: { kotak: 'FINNIFTY', quote: null, exch: 'NSE' },
  MIDCPNIFTY: { kotak: 'MIDCPNIFTY', quote: null, exch: 'NSE' }
};

/**
 * Equity CM symbol → Kotak F&O underlying name (when different).
 * Tata Motors FO lists as TMPV after demerger.
 */
const FO_UNDERLYING_ALIASES = {
  TATAMOTORS: 'TMPV'
};

/** Never call Kotak FO expiries/chains for these (known dead FO names). */
const FO_SKIP_SYMBOLS = new Set(['TATAMOTORS']);

const STOCK_LOTS = {
  RELIANCE: 500, TCS: 175, INFY: 400, HDFCBANK: 550, ICICIBANK: 700, SBIN: 750,
  KOTAKBANK: 400, AXISBANK: 625, INDUSINDBK: 500, TATAMOTORS: 550, MARUTI: 50,
  'M&M': 200, 'BAJAJ-AUTO': 75, HEROMOTOCO: 150, ITC: 1600, HINDUNILVR: 300,
  TITAN: 175, ASIANPAINT: 200, BAJFINANCE: 125, BAJAJFINSV: 100, TATASTEEL: 5500,
  JSWSTEEL: 250, HINDALCO: 1400, VEDL: 2300, SUNPHARMA: 350, DRREDDY: 125,
  CIPLA: 325, APOLLOHOSP: 125, ONGC: 1125, BPCL: 1800, NTPC: 1500, POWERGRID: 1900,
  ADANIENT: 300, ADANIPORTS: 500, WIPRO: 1500, HCLTECH: 350, TECHM: 600,
  COFORGE: 75, CHOLAFIN: 625
};

function parseFutExpiry(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // e.g. 31-JUL-2026
  const m = String(raw).match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
  if (!m) return null;
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  const mm = months[m[2].toUpperCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${String(m[1]).padStart(2, '0')}`;
}

function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function loadUnderlyingsCatalogue() {
  const candidates = [
    path.resolve(__dirname, '../../../web/public/underlyings.json'),
    path.resolve(__dirname, '../../data/order-flow/underlyings.json'),
    path.resolve(process.cwd(), 'public/underlyings.json'),
    path.resolve(process.cwd(), 'web/public/underlyings.json')
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(raw?.underlyings) && raw.underlyings.length) {
        return { file, underlyings: raw.underlyings };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Full F&O catalogue (same as order-flow-main underlyings.json).
 * Kotak quote tokens attached when present; FO calls use underlying name (no token needed).
 */
function buildUniverse() {
  const catalogue = loadUnderlyingsCatalogue();
  const tokenBySymbol = new Map(
    (kotakNeoService.tokenMap || [])
      .filter((t) => t.segment === 'nse_cm')
      .map((t) => [t.symbol, t])
  );

  if (!catalogue?.underlyings?.length) {
    // Fallback: Kotak tokenMap only
    const stocks = [...tokenBySymbol.values()]
      .filter((t) => !FO_SKIP_SYMBOLS.has(t.symbol))
      .map((t) => ({
        symbol: t.symbol,
        name: t.symbol,
        kind: 'stock',
        exch: 'NSE',
        lot: STOCK_LOTS[t.symbol] || 1,
        sector: 'Equity',
        kotakUnderlying: FO_UNDERLYING_ALIASES[t.symbol] || t.symbol,
        quoteToken: t
      }));
    const indices = Object.entries(INDEX_META).map(([symbol, meta]) => ({
      symbol,
      name: symbol,
      kind: 'index',
      exch: meta.exch,
      lot: symbol === 'BANKNIFTY' ? 15 : symbol === 'NIFTY' ? 65 : 25,
      sector: 'Index',
      kotakUnderlying: meta.kotak,
      quoteToken: meta.quote
    }));
    const universe = [...indices, ...stocks];
    console.warn(`[OrderFlow] No underlyings.json — Kotak tokenMap fallback · ${universe.length}`);
    return universe;
  }

  const universe = catalogue.underlyings
    .filter((u) => u?.symbol && (u.kind === 'stock' || u.kind === 'index'))
    .filter((u) => !FO_SKIP_SYMBOLS.has(u.symbol))
    .map((u) => {
      const symbol = String(u.symbol);
      const indexMeta = INDEX_META[symbol];
      return {
        symbol,
        name: u.name || symbol,
        kind: u.kind,
        exch: u.exch || indexMeta?.exch || 'NSE',
        lot: Number(u.lot) || STOCK_LOTS[symbol] || (symbol === 'BANKNIFTY' ? 15 : symbol === 'NIFTY' ? 65 : 1),
        sector: u.sector || (u.kind === 'index' ? 'Index' : 'Equity'),
        baskets: Array.isArray(u.baskets) ? u.baskets : undefined,
        kotakUnderlying: FO_UNDERLYING_ALIASES[symbol] || indexMeta?.kotak || symbol,
        quoteToken: tokenBySymbol.get(symbol) || indexMeta?.quote || null
      };
    });

  // Nifty 50 / index first — market file fills the board before the long tail.
  universe.sort((a, b) => {
    const ap = NIFTY_50_PRIORITY.has(a.symbol) ? 0 : 1;
    const bp = NIFTY_50_PRIORITY.has(b.symbol) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.symbol.localeCompare(b.symbol);
  });

  console.log(
    `[OrderFlow] Universe from underlyings.json · ${universe.length} underlyings (Nifty50-first)`
  );
  return universe;
}

function legStrike(row) {
  const inst = row?.inst || row?.instrument || {};
  return num(inst.strkPrc ?? inst.strikePrice ?? row?.strikePrice);
}

function mapLeg(row) {
  if (!row) return null;
  const q = row.quote || {};
  const oi = row.oi || row.openInterest || {};
  const prevClose = q.pc != null ? num(q.pc) : q.prevClose != null ? num(q.prevClose) : null;
  return {
    ltp: num(q.ltp),
    prevClose,
    oi: num(oi.cur ?? oi.current),
    prevOi: oi.prev != null || oi.previous != null ? num(oi.prev ?? oi.previous) : null,
    volume: num(q.vol ?? q.volume),
    prevVolume: null,
    avgPrice: num(q.ltp),
    iv: null,
    bid: num(q.bid),
    ask: num(q.ask),
    bidQty: num(q.bidQty),
    askQty: num(q.askQty),
    dayHigh: q.h != null ? num(q.h) : q.high != null ? num(q.high) : null,
    dayLow: q.l != null ? num(q.l) : q.low != null ? num(q.low) : null,
    lastTradeAt: null,
    delta: null
  };
}

class OrderFlowService {
  constructor() {
    this.provider = { id: 'kotak', label: 'Kotak Neo', alwaysLive: false };
    this.feed = 'kotak'; // kotak | upstox
    this.upstox = null;
    this.universe = [];
    this.bySymbol = new Map();
    this.state = {
      ready: false,
      building: false,
      latest: null,
      latestJson: null,
      lastBuild: null,
      lastError: null
    };
    this.ladderCache = { session: '', bySymbol: new Map() };
    this.futuresCache = new Map();
    this.chainCache = new Map(); // key → { at, value }
    this.disabledFo = new Set(); // symbols that returned FO 400 — skip for session
    this._scheduled = false;
    this._failStreak = 0;
    this._prefetching = false;
    this._prefetchQueue = [];
    this._expanding = false;
  }

  async tryStartKotak() {
    if (!process.env.KOTAK_CONSUMER_KEY) {
      throw new Error('Kotak credentials missing (KOTAK_CONSUMER_KEY).');
    }
    const logged = await kotakNeoService.ensureSession();
    if (!logged) throw new Error('Kotak Neo login failed.');
    this.feed = 'kotak';
    this.provider = { id: 'kotak', label: 'Kotak Neo', alwaysLive: false };
    this.upstox = null;
  }

  async tryStartUpstox() {
    if (!process.env.UPSTOX_ACCESS_TOKEN) {
      throw new Error('UPSTOX_ACCESS_TOKEN missing — cannot fall back to Upstox.');
    }
    const upstox = createUpstoxOrderFlowProvider(this.universe);
    await upstox.init();
    this.upstox = upstox;
    this.feed = 'upstox';
    this.provider = { id: 'upstox', label: 'Upstox', alwaysLive: false };
  }

  async initialize() {
    this.universe = buildUniverse();
    this.bySymbol = new Map(this.universe.map((u) => [u.symbol, u]));
    fs.mkdirSync(DATA_DIR, { recursive: true });

    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, 'latest.json'), 'utf8');
      this.state.latestJson = raw;
      this.state.latest = JSON.parse(raw);
    } catch {
      /* first run */
    }

    // auto (default): Kotak first, Upstox fallback | kotak | upstox
    const mode = String(process.env.ORDER_FLOW_PROVIDER || 'auto').toLowerCase();
    let started = false;
    let lastErr = null;

    const tryKotak = mode === 'auto' || mode === 'kotak';
    const tryUpstox = mode === 'auto' || mode === 'upstox';

    if (tryKotak) {
      try {
        await this.tryStartKotak();
        started = true;
        console.log(`[OrderFlow] Using Kotak Neo · ${this.universe.length} underlyings`);
      } catch (err) {
        lastErr = err;
        console.warn(`[OrderFlow] Kotak unavailable: ${err.message}`);
        if (mode === 'kotak') {
          this.state.lastError = { at: Date.now(), message: err.message };
          return;
        }
      }
    }

    if (!started && tryUpstox) {
      try {
        await this.tryStartUpstox();
        started = true;
        console.log(`[OrderFlow] Fallback → Upstox · ${this.universe.length} underlyings`);
      } catch (err) {
        lastErr = err;
        console.warn(`[OrderFlow] Upstox unavailable: ${err.message}`);
      }
    }

    if (!started) {
      this.state.lastError = {
        at: Date.now(),
        message:
          lastErr?.message ||
          'No Order Flow provider ready. Set Kotak KOTAK_* or UPSTOX_ACCESS_TOKEN (ORDER_FLOW_PROVIDER=auto|kotak|upstox).'
      };
      console.warn('[OrderFlow]', this.state.lastError.message);
      return;
    }

    this.state.ready = true;
    this.state.lastError = null;

    const session = getLatestTradingSessionDate(new Date());
    const covered = this.state.latest?.series?.length || 0;
    const sameSession = this.state.latest?.date === session;
    // After hours with a usable today's file: warm futures for the dense chart first,
    // then expand missing All F&O series in the background (image-like sector rail).
    if (!isMarketSessionTime(Date.now()) && sameSession && covered >= 40) {
      console.log(
        `[OrderFlow] After hours — keeping today's market (${covered} series), warming futures + expanding F&O`
      );
      const symbols = this.state.latest.series
        .map((row) => row.s)
        .sort((a, b) => {
          const ap = NIFTY_50_PRIORITY.has(a) ? 0 : 1;
          const bp = NIFTY_50_PRIORITY.has(b) ? 0 : 1;
          return ap - bp || a.localeCompare(b);
        });
      this.prefetchFutures(symbols, session);
      void this.expandMissingSeries(session);
    } else {
      await this.build();
    }
    this.schedule();
  }

  /**
   * After hours: add underlyings missing from today's market file (Nifty50 → All F&O),
   * without wiping the existing series. Commits every 15 new names so the UI densifies live.
   */
  async expandMissingSeries(session) {
    if (this.state.building || this._expanding) return;
    const have = new Set((this.state.latest?.series || []).map((row) => row.s));
    const missing = this.universe.filter((u) => !have.has(u.symbol) && !this.disabledFo.has(u.symbol));
    if (!missing.length) {
      console.log('[OrderFlow] All F&O already in market file');
      return;
    }
    this._expanding = true;
    kotakNeoService.pauseLiveFeed();
    console.log(`[OrderFlow] Expanding All F&O · ${missing.length} missing`);
    const series = [...(this.state.latest?.series || [])];
    const ladders = { ...(this.state.latest?.ladders || {}) };
    const failed = [];
    const started = Date.now();
    const clock = Date.now();
    let added = 0;
    try {
      // One worker after hours — leave RPS for futures prefetch / browser.
      let cursor = 0;
      const worker = async () => {
        while (cursor < missing.length) {
          const u = missing[cursor++];
          try {
            let ladder = this.ladderCache.bySymbol.get(u.symbol);
            if (!ladder) {
              ladder = (await this.expiriesFor(u)) || [];
              if (ladder.length) this.ladderCache.bySymbol.set(u.symbol, ladder);
            }
            const live = filterLiveExpiries(Array.isArray(ladder) ? ladder : [], clock);
            ladders[u.symbol] = live;
            if (!live[0]) continue;
            const chain = await this.optionChainFor(u, live[0]);
            const encoded = encodeSeries(u, { ...chain, expiry: chain.expiry || live[0] }, Date.now());
            if (!encoded) {
              failed.push(u.symbol);
              continue;
            }
            series.push(encoded);
            added += 1;
            if (added % 15 === 0) {
              this.commitMarketFile(session, series, ladders, started, failed, null, {
                prefetch: true
              });
              console.log(`[OrderFlow] expand progress · ${series.length} series`);
            }
          } catch (err) {
            failed.push(u.symbol);
            if (String(err.message || '').includes('429')) {
              await new Promise((r) => setTimeout(r, 15_000));
            }
          }
        }
      };
      await worker();
      if (added > 0) {
        this.commitMarketFile(session, series, ladders, started, failed, null, { prefetch: true });
      }
      console.log(
        `[OrderFlow] expand done · +${added} (now ${series.length}), failed ${failed.length}, ${Date.now() - started}ms`
      );
    } finally {
      this._expanding = false;
      kotakNeoService.resumeLiveFeed();
    }
  }

  async maybeFallbackToUpstox(reason) {
    if (this.feed !== 'kotak') return false;
    if (String(process.env.ORDER_FLOW_PROVIDER || 'auto').toLowerCase() === 'kotak') return false;
    if (!process.env.UPSTOX_ACCESS_TOKEN) return false;
    console.warn(`[OrderFlow] Switching Kotak → Upstox (${reason})`);
    try {
      await this.tryStartUpstox();
      this.ladderCache = { session: '', bySymbol: new Map() };
      this.futuresCache.clear();
      this._failStreak = 0;
      return true;
    } catch (err) {
      console.warn('[OrderFlow] Upstox fallback failed:', err.message);
      return false;
    }
  }

  /**
   * Kotak APIs already go through kotakNeoService.gatedRequest — do NOT wrap again
   * (nested gate deadlocks). Upstox has no internal Kotak gate, so serialize via runThroughGate.
   */
  async throttled(fn) {
    try {
      if (this.feed === 'kotak') return await fn();
      return await kotakNeoService.runThroughGate(fn);
    } catch (err) {
      console.warn('[OrderFlow] request error:', err.message);
      throw err;
    }
  }

  disableFoSymbol(symbol, reason) {
    if (this.disabledFo.has(symbol)) return;
    this.disabledFo.add(symbol);
    console.warn(`[OrderFlow] Disabling FO for ${symbol}: ${reason}`);
  }

  async spotQuote(u) {
    if (this.feed === 'upstox') return { spot: null, prevClose: null };
    if (!u.quoteToken) return { spot: null, prevClose: null };
    const neo = `${u.quoteToken.segment}|${u.quoteToken.token}`;
    const q = await this.throttled(() => kotakNeoService.fetchQuote(neo));
    if (!q) return { spot: null, prevClose: null };
    const ltp = num(q.ltp || q.last_price || q.ohlc?.close);
    const open = num(q.ohlc?.open || ltp);
    const change = num(q.change);
    const prevClose =
      q.ohlc?.close != null && Number(q.per_change)
        ? ltp / (1 + Number(q.per_change) / 100)
        : change
          ? ltp - change
          : open || null;
    return { spot: ltp || null, prevClose: prevClose && Number.isFinite(prevClose) ? prevClose : null };
  }

  async expiriesFor(u) {
    if (this.disabledFo.has(u.symbol)) return [];
    if (this.feed === 'upstox' && this.upstox) {
      return this.throttled(() => this.upstox.expiries(u));
    }
    try {
      return await this.throttled(() =>
        kotakNeoService.fetchExpiries(u.exch === 'BSE' ? 'bse_fo' : 'nse_fo', u.kotakUnderlying, 'option')
      );
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        this.disableFoSymbol(u.symbol, err.message);
        return [];
      }
      throw err;
    }
  }

  async optionChainFor(u, expiry) {
    if (this.disabledFo.has(u.symbol)) return { call: [], put: [], expiry };
    const cacheKey = `${u.symbol}|${expiry}|${this.feed}`;
    const cached = this.chainCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CHAIN_CACHE_MS) {
      return cached.value;
    }

    if (this.feed === 'upstox' && this.upstox) {
      const value = await this.throttled(() => this.upstox.optionChain(u, expiry));
      this.chainCache.set(cacheKey, { at: Date.now(), value });
      return value;
    }

    const exchange = u.exch === 'BSE' ? 'bse_fo' : 'nse_fo';
    let data;
    try {
      data = await this.throttled(() =>
        kotakNeoService.fetchOptionChain(exchange, u.kotakUnderlying, expiry, CHAIN_COUNT)
      );
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        this.disableFoSymbol(u.symbol, err.message);
        return { call: [], put: [], expiry };
      }
      throw err;
    }

    const calls = data?.call || [];
    const puts = data?.put || [];
    const byStrike = new Map();
    let atmFromVendor = null;

    for (const row of calls) {
      const strike = legStrike(row);
      if (!(strike > 0)) continue;
      const moneyness = String(row.inst?.moneyness || row.instrument?.moneyness || '').toLowerCase();
      if (moneyness === 'atm') atmFromVendor = strike;
      const held = byStrike.get(strike) || { strike, call: null, put: null };
      held.call = mapLeg(row);
      byStrike.set(strike, held);
    }
    for (const row of puts) {
      const strike = legStrike(row);
      if (!(strike > 0)) continue;
      const moneyness = String(row.inst?.moneyness || row.instrument?.moneyness || '').toLowerCase();
      if (moneyness === 'atm') atmFromVendor = strike;
      const held = byStrike.get(strike) || { strike, call: null, put: null };
      held.put = mapLeg(row);
      byStrike.set(strike, held);
    }

    const strikes = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);
    const lot = num(data?.common_data?.mktLot, u.lot);
    if (lot > 0) u.lot = lot;

    // Prefer chain-level spot when Kotak includes it
    let spot = num(data?.spot?.ltp ?? data?.spot?.price, 0) || null;
    let prevClose =
      data?.spot?.prevClose != null
        ? num(data.spot.prevClose)
        : data?.spot?.pc != null
          ? num(data.spot.pc)
          : null;
    if (!(spot > 0)) {
      const quoted = await this.spotQuote(u);
      spot = quoted.spot;
      prevClose = prevClose ?? quoted.prevClose;
    }
    if (!(spot > 0) && strikes.length) {
      if (atmFromVendor) spot = atmFromVendor;
      else spot = strikes[Math.floor(strikes.length / 2)]?.strike || null;
    }

    const atmStrike = atmFromVendor || (strikes.length && spot
      ? strikes.reduce((best, row) =>
          Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best
        ).strike
      : null);

    const value = {
      expiry: data?.common_data?.expiryDt || expiry,
      at: Date.now(),
      spot,
      prevClose,
      atm: atmStrike,
      strikes
    };
    this.chainCache.set(cacheKey, { at: Date.now(), value });
    if (this.chainCache.size > 200) {
      this.chainCache.delete(this.chainCache.keys().next().value);
    }
    return value;
  }

  async futuresForUnderlying(u, session, { nearOnly = false } = {}) {
    if (this.feed === 'upstox' && this.upstox) {
      return this.throttled(() => this.upstox.futures(u, session));
    }

    const exchange = u.exch === 'BSE' ? 'bse_fo' : 'nse_fo';
    const data = await this.throttled(() =>
      kotakNeoService.fetchFuturesChain(exchange, u.kotakUnderlying)
    );
    // Live Kotak payloads use `future_contracts` (array); docs sample used `fut`.
    const futRows = Array.isArray(data?.future_contracts)
      ? data.future_contracts
      : Array.isArray(data?.fut)
        ? data.fut
        : data?.future
          ? [data.future]
          : [];

    const months = [];
    const monthCap = nearOnly ? 1 : 3;

    for (const row of futRows.slice(0, monthCap)) {
      const inst = row.inst || row.instrument || {};
      const date = parseFutExpiry(inst.expiryDt || inst.exp || inst.expiry);
      if (!date || date < session) continue;
      const quote = row.quote || {};
      const oi = row.oi || row.openInterest || {};
      const neoSymbol = inst.neoSymbol || inst.neo_symbol;
      let candles = [];
      if (neoSymbol) {
        try {
          candles = await this.throttled(() =>
            kotakNeoService.fetchFuturesMinuteCandles(neoSymbol, session)
          );
        } catch (err) {
          console.warn(`[OrderFlow] futures candles ${u.symbol} ${date}:`, err.message);
        }
      }

      const prevClose = quote.pc != null ? num(quote.pc) : quote.prevClose != null ? num(quote.prevClose) : null;
      const prevOi = oi.prev != null ? num(oi.prev) : oi.previous != null ? num(oi.previous) : null;
      const curOi = oi.cur != null ? num(oi.cur) : oi.current != null ? num(oi.current) : 0;

      // If candle OI is empty (Kotak phase-1), stamp last candle with current OI
      if (candles.length && candles.every((c) => !c.oi) && curOi > 0) {
        candles = candles.map((c, i) => (i === candles.length - 1 ? { ...c, oi: curOi } : c));
      }

      months.push({
        date,
        prevClose,
        prevOi,
        candles
      });
    }

    months.sort((a, b) => a.date.localeCompare(b.date));
    return months.slice(0, monthCap);
  }

  /**
   * Warm futures cache after a market build so the board gets real lines
   * (not "Spot only") without waiting on browser waterfall.
   */
  prefetchFutures(symbols, session) {
    if (!symbols?.length) return;
    this._prefetchQueue = this._prefetchQueue || [];
    const seen = new Set(this._prefetchQueue);
    for (const symbol of symbols) {
      if (!seen.has(symbol)) {
        seen.add(symbol);
        this._prefetchQueue.push(symbol);
      }
    }
    if (this._prefetching) return;
    this._prefetching = true;
    const workers = 2;
    const drain = async () => {
      const list = this._prefetchQueue;
      this._prefetchQueue = [];
      let cursor = 0;
      const total = list.length;
      const run = async () => {
        while (cursor < list.length) {
          const symbol = list[cursor++];
          try {
            await this.getFutures(symbol, session, { nearOnly: true });
          } catch {
            /* skip — client may retry */
          }
        }
      };
      await Promise.all(Array.from({ length: workers }, run));
      console.log(`[OrderFlow] futures prefetch done · ${total} symbols`);
      if (this._prefetchQueue.length) {
        await drain();
      }
    };
    drain().finally(() => {
      this._prefetching = false;
    });
  }

  hhmmOf(at) {
    const p = marketParts(at);
    return `${String(Math.floor(p.minuteOfDay / 60)).padStart(2, '0')}${String(p.minuteOfDay % 60).padStart(2, '0')}`;
  }

  readMinutes(date) {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, date, 'index.json'), 'utf8'));
    } catch {
      return [];
    }
  }

  storeMinute(date, at, json) {
    const dir = path.join(DATA_DIR, date);
    fs.mkdirSync(dir, { recursive: true });
    const hhmm = this.hhmmOf(at);
    fs.writeFileSync(path.join(dir, `${hhmm}.json`), json);
    const minutes = this.readMinutes(date).filter((entry) => entry[0] !== hhmm);
    minutes.push([hhmm, at]);
    minutes.sort((a, b) => a[1] - b[1]);
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(minutes));
    return minutes;
  }

  pruneOldDays(today) {
    if (!fs.existsSync(DATA_DIR)) return;
    for (const entry of fs.readdirSync(DATA_DIR)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(entry) && entry < today) {
        fs.rmSync(path.join(DATA_DIR, entry), { recursive: true, force: true });
      }
    }
  }

  commitMarketFile(session, series, ladders, started, failed, firstError, { prefetch = false } = {}) {
    const at = Date.now();
    const sorted = [...series].sort((a, b) => a.s.localeCompare(b.s));
    const minutes = isMarketSessionTime(at)
      ? this.storeMinute(
          session,
          at,
          JSON.stringify(marketFile({ at, date: session, series: sorted, minutes: [], ladders }))
        )
      : this.readMinutes(session);
    const file = marketFile({ at, date: session, series: sorted, minutes, ladders });
    this.state.latest = file;
    this.state.latestJson = JSON.stringify(file);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), this.state.latestJson);
    this.pruneOldDays(session);
    this.state.lastBuild = {
      at,
      ms: Date.now() - started,
      series: series.length,
      failed: failed.length,
      failedSymbols: failed.slice(0, 20),
      firstError,
      provider: this.provider.id
    };
    this.state.lastError = null;
    this._failStreak = 0;
    console.log(
      `[OrderFlow] market file (${this.provider.id}): ${series.length} series, ${failed.length} failed, ${Date.now() - started}ms` +
        (firstError ? ` (first: ${firstError})` : '')
    );
    if (prefetch) {
      const prefetchSymbols = sorted
        .map((row) => row.s)
        .sort((a, b) => {
          const ap = NIFTY_50_PRIORITY.has(a) ? 0 : 1;
          const bp = NIFTY_50_PRIORITY.has(b) ? 0 : 1;
          return ap - bp || a.localeCompare(b);
        });
      // Prefer Nifty 50 warm-up first so the default board drops "Spot only" quickly.
      this.prefetchFutures(prefetchSymbols, session);
    }
    return sorted;
  }

  async scanUniverse(list, clock, series, ladders, failed) {
    let firstError = null;
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const u = list[cursor++];
        if (this.disabledFo.has(u.symbol)) continue;
        try {
          let ladder = this.ladderCache.bySymbol.get(u.symbol);
          if (!ladder) {
            ladder = (await this.expiriesFor(u)) || [];
            if (ladder.length) this.ladderCache.bySymbol.set(u.symbol, ladder);
            else if (this.disabledFo.has(u.symbol)) continue;
          }
          const live = filterLiveExpiries(Array.isArray(ladder) ? ladder : [], clock);
          ladders[u.symbol] = live;
          if (!live[0]) continue;
          const chain = await this.optionChainFor(u, live[0]);
          const encoded = encodeSeries(u, { ...chain, expiry: chain.expiry || live[0] }, Date.now());
          if (encoded) {
            const idx = series.findIndex((row) => row.s === encoded.s);
            if (idx >= 0) series[idx] = encoded;
            else series.push(encoded);
          } else failed.push(u.symbol);
        } catch (error) {
          failed.push(u.symbol);
          firstError ??= String(error?.message || error);
        }
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    return firstError;
  }

  async build() {
    if (this.state.building) return;
    if (!this.state.ready) return;
    this.state.building = true;
    // Let Order Flow own the Kotak pipe; quote poll resumes in finally
    kotakNeoService.pauseLiveFeed();
    const started = Date.now();
    const clock = Date.now();
    const session = getLatestTradingSessionDate(new Date(clock));
    if (this.ladderCache.session !== session) {
      this.ladderCache.session = session;
      this.ladderCache.bySymbol.clear();
      this.disabledFo.clear();
    }

    const series = [];
    const ladders = {};
    const failed = [];

    // Kotak: publish Nifty 50 first (order-flow-main board), then fill All F&O.
    // Upstox: one pass over the full catalogue.
    const priority = this.universe.filter((u) => NIFTY_50_PRIORITY.has(u.symbol));
    const rest =
      this.feed === 'kotak'
        ? this.universe.filter((u) => !NIFTY_50_PRIORITY.has(u.symbol))
        : [];
    const primary = this.feed === 'kotak' ? priority : this.universe;

    try {
      let firstError = await this.scanUniverse(primary, clock, series, ladders, failed);
      if (!series.length) {
        throw new Error(firstError ? `No underlying answered: ${firstError}` : 'No underlying answered.');
      }
      // Publish Nifty 50 early + warm its futures; then fill All F&O.
      this.commitMarketFile(session, series, ladders, started, failed, firstError, {
        prefetch: true
      });

      if (rest.length) {
        firstError = (await this.scanUniverse(rest, clock, series, ladders, failed)) || firstError;
        this.commitMarketFile(session, series, ladders, started, failed, firstError, {
          prefetch: true
        });
      }

      // If Kotak mostly fails, switch to Upstox when available
      const failRatio = failed.length / Math.max(1, series.length + failed.length);
      if (this.feed === 'kotak' && failRatio >= 0.6 && process.env.UPSTOX_ACCESS_TOKEN) {
        this._failStreak += 1;
        if (this._failStreak >= 2) {
          const switched = await this.maybeFallbackToUpstox(`high fail ratio ${(failRatio * 100).toFixed(0)}%`);
          if (switched) {
            this.state.building = false;
            await this.build();
            return;
          }
        }
      }
    } catch (error) {
      console.error('[OrderFlow] market build failed:', error.message || error);
      this.state.lastError = {
        at: Date.now(),
        message: `${this.provider.label} did not return a market file. Check credentials / rate limits in the server log.`
      };
      this._failStreak += 1;
      if (this._failStreak >= 2) {
        const switched = await this.maybeFallbackToUpstox(error.message || 'build failed');
        if (switched) {
          this.state.building = false;
          await this.build();
          return;
        }
      }
    } finally {
      this.state.building = false;
      kotakNeoService.resumeLiveFeed();
    }
  }

  schedule() {
    if (this._scheduled) return;
    this._scheduled = true;
    const tick = async () => {
      const live = isMarketSessionTime(Date.now());
      const covered = this.state.latest?.series?.length || 0;
      const incomplete = covered < Math.min(this.universe.length, 180);
      // Live: normal cadence. After hours: if today's board is still thin, keep filling
      // every few minutes (session chains/futures still answer) instead of waiting an hour.
      const wait = live ? MARKET_LIVE_MS : incomplete ? 3 * 60_000 : 60 * 60_000;
      setTimeout(async () => {
        await this.build();
        tick();
      }, wait);
    };
    tick();
  }

  getStatus() {
    return {
      provider: this.provider,
      ready: this.state.ready,
      clock: Date.now(),
      session: getLatestTradingSessionDate(new Date()),
      market: this.state.latest
        ? { at: this.state.latest.t, date: this.state.latest.date, series: this.state.latest.series.length }
        : null,
      lastBuild: this.state.lastBuild && {
        at: this.state.lastBuild.at,
        series: this.state.lastBuild.series,
        failed: this.state.lastBuild.failed
      },
      lastError: this.state.lastError && {
        at: this.state.lastError.at,
        message: this.state.lastError.message
      },
      universe: this.universe.length
    };
  }

  getMarketJson() {
    return this.state.latestJson;
  }

  getMinuteFile(date, hhmm) {
    const file = path.join(DATA_DIR, date, `${hhmm}.json`);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8');
  }

  async getFutures(symbol, session, { nearOnly = false } = {}) {
    const u = this.bySymbol.get(symbol);
    if (!u) {
      const err = new Error('Unknown underlying.');
      err.statusCode = 404;
      throw err;
    }
    const current = getLatestTradingSessionDate(new Date());
    if (session !== current) {
      const err = new Error(`Only the current session (${current}) is served.`);
      err.statusCode = 400;
      throw err;
    }

    const key = `${symbol}|${session}`;
    const held = this.futuresCache.get(key);
    const live = isMarketSessionTime(Date.now());
    if (held && (!live || Date.now() - held.at < FUTURES_KEEP_MS)) {
      const cached = await held.value;
      // Prefetch may store near-month only; upgrade when the client asks for full.
      if (nearOnly || (cached?.months?.length || 0) >= 2) return cached;
    }

    const value = this.futuresForUnderlying(u, session, { nearOnly }).then((months) => ({
      symbol,
      session,
      months
    }));
    this.futuresCache.set(key, { at: Date.now(), value });
    value.catch(() => this.futuresCache.delete(key));
    if (this.futuresCache.size > 400) this.futuresCache.delete(this.futuresCache.keys().next().value);
    return value;
  }

  getUniverse() {
    return this.universe.map(({ symbol, name, kind, exch, lot, sector }) => ({
      symbol,
      name,
      kind,
      exch,
      lot,
      sector
    }));
  }
}

export const orderFlowService = new OrderFlowService();
