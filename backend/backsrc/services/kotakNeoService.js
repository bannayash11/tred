import crypto from 'crypto';
import https from 'https';
import { KotakFeedWs } from './kotakFeedWs.js';

/**
 * Kotak Neo Trade API Integration Service
 * Handles TOTP auto-generation, login/session management, and real-time live market feed.
 */
class KotakNeoService {
  constructor() {
    this.consumerKey = process.env.KOTAK_CONSUMER_KEY || '';
    this.ucc = process.env.KOTAK_UCC || '';
    this.mobileNumber = process.env.KOTAK_MOBILE_NUMBER || '';
    this.mpin = process.env.KOTAK_MPIN || '';
    this.totpSecret = process.env.KOTAK_TOTP_KEY || '';

    this.baseUrl = null;
    this.feedUrl = null;
    this.viewToken = null;
    this.sid = null;
    this.isLoggedIn = false;
    this.pollInterval = null;
    this.pollPaused = false;
    this.pollIntervalMs = Math.max(2500, Number(process.env.KOTAK_QUOTE_POLL_MS) || 6000);
    this.feedWs = null;
    this.feedWsAlive = false;
    this._tickCallback = null;
    /** Prefer WS stream; REST poll only as fallback when WS is down. */
    this.preferWsFeed = String(process.env.KOTAK_PREFER_WS || '1') !== '0';

    // Shared rate gate for ALL market-data HTTPS (multi-user safe).
    // Kotak 429s hard when we push ~3.5+ RPS; start ~2 RPS and adapt.
    this._gateQueue = Promise.resolve();
    this._gateBaseGapMs = Math.max(200, Number(process.env.KOTAK_REQUEST_GAP_MS) || 450);
    this._gateGapMs = this._gateBaseGapMs;
    this._gateGapMaxMs = Math.max(this._gateBaseGapMs, Number(process.env.KOTAK_REQUEST_GAP_MAX_MS) || 1400);
    this._gateLastAt = 0;
    this._globalBackoffUntil = 0;
    this._gateSuccessStreak = 0;
    this._gateDepth = 0;

    // F&O NSE CM and FO token mapping for high-liquidity universe
    this.tokenMap = [
      { symbol: 'NIFTY 50', token: '61471', segment: 'nse_fo' },
      { symbol: 'BANKNIFTY', token: '61466', segment: 'nse_fo' },
      { symbol: 'RELIANCE', token: '2885', segment: 'nse_cm' },
      { symbol: 'TCS', token: '11536', segment: 'nse_cm' },
      { symbol: 'INFY', token: '1594', segment: 'nse_cm' },
      { symbol: 'HDFCBANK', token: '1333', segment: 'nse_cm' },
      { symbol: 'ICICIBANK', token: '4963', segment: 'nse_cm' },
      { symbol: 'SBIN', token: '3045', segment: 'nse_cm' },
      { symbol: 'KOTAKBANK', token: '1922', segment: 'nse_cm' },
      { symbol: 'AXISBANK', token: '5900', segment: 'nse_cm' },
      { symbol: 'INDUSINDBK', token: '5258', segment: 'nse_cm' },
      { symbol: 'TATAMOTORS', token: '3456', segment: 'nse_cm' },
      { symbol: 'MARUTI', token: '10999', segment: 'nse_cm' },
      { symbol: 'M&M', token: '2031', segment: 'nse_cm' },
      { symbol: 'BAJAJ-AUTO', token: '16669', segment: 'nse_cm' },
      { symbol: 'HEROMOTOCO', token: '1348', segment: 'nse_cm' },
      { symbol: 'ITC', token: '1660', segment: 'nse_cm' },
      { symbol: 'HINDUNILVR', token: '1394', segment: 'nse_cm' },
      { symbol: 'TITAN', token: '3506', segment: 'nse_cm' },
      { symbol: 'ASIANPAINT', token: '236', segment: 'nse_cm' },
      { symbol: 'BAJFINANCE', token: '317', segment: 'nse_cm' },
      { symbol: 'BAJAJFINSV', token: '16675', segment: 'nse_cm' },
      { symbol: 'TATASTEEL', token: '3499', segment: 'nse_cm' },
      { symbol: 'JSWSTEEL', token: '11723', segment: 'nse_cm' },
      { symbol: 'HINDALCO', token: '1363', segment: 'nse_cm' },
      { symbol: 'VEDL', token: '3063', segment: 'nse_cm' },
      { symbol: 'SUNPHARMA', token: '3351', segment: 'nse_cm' },
      { symbol: 'DRREDDY', token: '881', segment: 'nse_cm' },
      { symbol: 'CIPLA', token: '694', segment: 'nse_cm' },
      { symbol: 'APOLLOHOSP', token: '157', segment: 'nse_cm' },
      { symbol: 'ONGC', token: '2475', segment: 'nse_cm' },
      { symbol: 'BPCL', token: '526', segment: 'nse_cm' },
      { symbol: 'NTPC', token: '11630', segment: 'nse_cm' },
      { symbol: 'POWERGRID', token: '14977', segment: 'nse_cm' },
      { symbol: 'ADANIENT', token: '25', segment: 'nse_cm' },
      { symbol: 'ADANIPORTS', token: '15083', segment: 'nse_cm' },
      { symbol: 'WIPRO', token: '3787', segment: 'nse_cm' },
      { symbol: 'HCLTECH', token: '7229', segment: 'nse_cm' },
      { symbol: 'TECHM', token: '13538', segment: 'nse_cm' },
      { symbol: 'COFORGE', token: '11543', segment: 'nse_cm' },
      { symbol: 'CHOLAFIN', token: '685', segment: 'nse_cm' }
    ];
  }

  /**
   * RFC 6238 Base32-based TOTP generator
   */
  generateTOTP(secret) {
    if (!secret) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let cleaned = secret.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = alphabet.indexOf(cleaned[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    const key = Buffer.from(bytes);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
  }

  /**
   * Helper HTTPS request wrapper
   */
  async makeRequest({ hostname, path, method, headers, body, timeout = 10000 }) {
    return new Promise((resolve, reject) => {
      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (postData) {
        reqHeaders['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(
        {
          hostname,
          path,
          method,
          headers: reqHeaders,
          timeout
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve({ statusCode: res.statusCode, data: json });
            } catch (e) {
              resolve({ statusCode: res.statusCode, text: data });
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Kotak API request timeout'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Central Kotak request gate — serializes + paces outbound calls so many web
   * users share one pipe instead of stampeding the broker (429s).
   * On 429: widen the gap (adaptive) and back off once before a single retry.
   */
  runThroughGate(fn) {
    this._gateDepth += 1;
    const run = this._gateQueue.then(async () => {
      try {
        const now = Date.now();
        if (now < this._globalBackoffUntil) {
          await this.sleep(this._globalBackoffUntil - now);
        }
        const wait = this._gateGapMs - (Date.now() - this._gateLastAt);
        if (wait > 0) await this.sleep(wait);
        this._gateLastAt = Date.now();
        try {
          const result = await fn();
          this._gateSuccessStreak += 1;
          // Ease gap back toward base after a clean stretch
          if (this._gateSuccessStreak >= 12 && this._gateGapMs > this._gateBaseGapMs) {
            this._gateGapMs = Math.max(this._gateBaseGapMs, Math.round(this._gateGapMs * 0.92));
            this._gateSuccessStreak = 0;
          }
          return result;
        } catch (err) {
          if (err?.statusCode === 429) {
            this._gateSuccessStreak = 0;
            this._gateGapMs = Math.min(this._gateGapMaxMs, Math.round(this._gateGapMs * 1.45) + 50);
            // Cap backoff — Kotak often omits Retry-After; long stalls freeze Order Flow
            const waitMs = Math.min(Math.max(Number(err.retryAfter) || 8, 5) * 1000, 20_000);
            this._globalBackoffUntil = Date.now() + waitMs;
            console.warn(
              `[KotakNeoService] 429 — backoff ${waitMs}ms · gap now ${this._gateGapMs}ms`
            );
            await this.sleep(waitMs);
            this._gateLastAt = Date.now();
            return fn();
          }
          throw err;
        }
      } finally {
        this._gateDepth = Math.max(0, this._gateDepth - 1);
      }
    });
    this._gateQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  /** True when Order Flow / historical work should keep quote polling quiet. */
  isGateBusy() {
    return this._gateDepth > 2 || Date.now() < this._globalBackoffUntil;
  }

  /** Gated HTTPS helper — treats 429 as a throw so the gate can backoff+retry. */
  async gatedRequest(opts) {
    return this.runThroughGate(async () => {
      const res = await this.makeRequest(opts);
      if (res.statusCode === 429) {
        const err = new Error('Kotak rate limit (429)');
        err.statusCode = 429;
        err.retryAfter = Math.min(Number(res.data?.rateLimit?.['Retry-After'] || 15), 30);
        throw err;
      }
      return res;
    });
  }

  pauseLiveFeed() {
    this.pollPaused = true;
    // Stop SFeed during Order Flow build — Matrix auth flaps + WS traffic steal RPS.
    try {
      this.feedWs?.stop();
    } catch {
      /* ignore */
    }
    this.feedWsAlive = false;
  }

  resumeLiveFeed() {
    this.pollPaused = false;
    // Restart SFeed only in-session; otherwise REST poll stays as fallback.
    if (this._tickCallback && this.preferWsFeed && !this.feedWsAlive) {
      void import('./orderFlow/marketSession.js').then(({ isMarketSessionTime }) => {
        if (!isMarketSessionTime(Date.now())) return;
        if (this.pollPaused) return;
        try {
          this.startFeedWebSocket(this._tickCallback);
        } catch {
          /* ignore */
        }
      });
    }
  }

  /**
   * Authenticate with Kotak Neo Trade API (tradeApiLogin -> tradeApiValidate)
   */
  async login() {
    this.consumerKey = process.env.KOTAK_CONSUMER_KEY || this.consumerKey;
    this.ucc = process.env.KOTAK_UCC || this.ucc;
    this.mobileNumber = process.env.KOTAK_MOBILE_NUMBER || this.mobileNumber;
    this.mpin = process.env.KOTAK_MPIN || this.mpin;
    this.totpSecret = process.env.KOTAK_TOTP_KEY || this.totpSecret;

    if (!this.consumerKey || !this.ucc || !this.totpSecret) {
      console.warn('[KotakNeoService] Missing required Kotak credentials in .env');
      return false;
    }

    const currentTotp = this.generateTOTP(this.totpSecret);
    console.log(`[KotakNeoService] Authenticating UCC ${this.ucc} with dynamic TOTP...`);

    try {
      // Step 1: tradeApiLogin
      const loginRes = await this.makeRequest({
        hostname: 'mis.kotaksecurities.com',
        path: '/login/1.0/tradeApiLogin',
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.consumerKey,
          'neo-fin-key': 'neotradeapi'
        },
        body: {
          ucc: this.ucc,
          mobileNumber: this.mobileNumber,
          totp: currentTotp
        }
      });

      if (loginRes.statusCode !== 200 || !loginRes.data?.data?.token) {
        console.warn('[KotakNeoService] tradeApiLogin response:', loginRes.data || loginRes.text);
        return false;
      }

      this.viewToken = loginRes.data.data.token;
      this.sid = loginRes.data.data.sid;

      // Step 2: tradeApiValidate
      const validateRes = await this.makeRequest({
        hostname: 'mis.kotaksecurities.com',
        path: '/login/1.0/tradeApiValidate',
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.consumerKey,
          sid: this.sid,
          Auth: this.viewToken,
          'neo-fin-key': 'neotradeapi'
        },
        body: {
          mpin: this.mpin
        }
      });

      if (validateRes.statusCode !== 200 || !validateRes.data?.data?.baseUrl) {
        console.warn('[KotakNeoService] tradeApiValidate failed:', validateRes.data || validateRes.text);
        return false;
      }

      const assignedUrl = validateRes.data.data.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      this.baseUrl = assignedUrl;
      const rawFeed = validateRes.data.data.feedUrl || validateRes.data.data.ftUrl || null;
      this.feedUrl = rawFeed
        ? String(rawFeed).replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
        : `wss://sfeed.kotaksecurities.com/apifeed`;
      this.isLoggedIn = true;
      console.log(
        `[KotakNeoService] ✅ Kotak Neo LIVE session active on ${this.baseUrl} · feed ${this.feedUrl}`
      );
      return true;
    } catch (err) {
      console.error('[KotakNeoService] Login error:', err.message || err);
      return false;
    }
  }

  /**
   * Fetch live quotes from Kotak Neo for all mapped stocks
   */
  async fetchLiveQuotes() {
    if (!this.isLoggedIn || !this.baseUrl) {
      const logged = await this.login();
      if (!logged) return null;
    }

    try {
      // Build neo_symbols query (batch chunks of 15)
      const batches = [];
      const batchSize = 15;
      for (let i = 0; i < this.tokenMap.length; i += batchSize) {
        batches.push(this.tokenMap.slice(i, i + batchSize));
      }

      const quotesList = [];

      for (const batch of batches) {
        const neoSymbols = batch.map((item) => `${item.segment}|${item.token}`).join(',');
        const encodedSymbols = encodeURIComponent(neoSymbols).replace(/%7C/g, '|').replace(/%2C/g, ',');

        const res = await this.gatedRequest({
          hostname: this.baseUrl,
          path: `/script-details/1.0/quotes/neosymbol/${encodedSymbols}/all`,
          method: 'GET',
          headers: {
            Authorization: this.consumerKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (res.statusCode === 200 && Array.isArray(res.data)) {
          quotesList.push(...res.data);
        }
      }

      return quotesList;
    } catch (err) {
      console.error('[KotakNeoService] Quotes fetch error:', err.message);
      return null;
    }
  }

  quotesToTicks(quotes) {
    const ticks = [];
    for (const q of quotes || []) {
      const ltp = parseFloat(q.ltp || q.last_price || q.ohlc?.close || 0);
      if (!ltp || isNaN(ltp)) continue;

      const tokenStr = String(q.exchange_token || q.instrument_token || q.token || '');
      const cleanDisplay = String(q.display_symbol || q.trading_symbol || '').replace(/-EQ$/, '').trim();

      const mapping = this.tokenMap.find(
        (m) => m.token === tokenStr || m.symbol === cleanDisplay || m.symbol === q.trading_symbol
      );
      if (!mapping) continue;

      const openPrice = parseFloat(q.ohlc?.open || ltp);
      const highPrice = parseFloat(q.ohlc?.high || q.high || ltp);
      const lowPrice = parseFloat(q.ohlc?.low || q.low || ltp);
      const perChange = parseFloat(
        q.per_change || q.change || (((ltp - openPrice) / openPrice) * 100).toFixed(2)
      );
      const totalVol = parseInt(q.last_volume || q.total_traded_volume || 0, 10);

      ticks.push({
        symbol: mapping.symbol,
        currentPrice: ltp,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: ltp,
        change: perChange,
        volume: totalVol,
        source: 'rest'
      });
    }
    return ticks;
  }

  startFeedWebSocket(onTickCallback) {
    if (!this.preferWsFeed) return false;
    if (!this.feedUrl || !this.sid) return false;

    try {
      this.feedWs?.stop();
    } catch {
      /* ignore */
    }

    const tokens = this.tokenMap.map((t) => ({
      segment: t.segment,
      token: t.token,
      symbol: t.symbol,
      kind: t.segment === 'nse_fo' && /NIFTY|BANKNIFTY/i.test(t.symbol) ? 'index' : 'equity'
    }));

    this.feedWs = new KotakFeedWs({
      ucc: this.ucc,
      // Protocol guide: auth = session sid from login
      authToken: this.sid || this.viewToken,
      feedUrl: this.feedUrl,
      tokens,
      onTicks: (ticks) => {
        if (this.pollPaused) return;
        if (ticks?.length && typeof onTickCallback === 'function') onTickCallback(ticks);
      },
      onStatus: (st) => {
        this.feedWsAlive = Boolean(st?.ok);
        console.log(`[KotakNeoService] SFeed: ${st?.message || ''}`);
      }
    });
    this.feedWs.start();
    return true;
  }

  /**
   * Live ticks: Kotak SFeed WebSocket (market-speed) with REST poll fallback.
   * Pauses while Order Flow build holds the gate (pauseLiveFeed).
   */
  startLiveFeed(onTickCallback) {
    this._tickCallback = onTickCallback;
    if (this.pollInterval) clearInterval(this.pollInterval);

    const boot = async () => {
      await this.ensureSession();
      // SFeed Matrix auth flaps burn rate limits — defer until Order Flow futures are warm.
      const { isMarketSessionTime } = await import('./orderFlow/marketSession.js');
      if (!isMarketSessionTime(Date.now())) {
        console.log('[KotakNeoService] Outside session — SFeed deferred; REST poll only for bootstrap.');
        return;
      }
      // Give Order Flow ~2 minutes to fill near-month candle cache before WS auth storms.
      await new Promise((r) => setTimeout(r, 120_000));
      if (this.pollPaused) return;
      const startedWs = this.startFeedWebSocket(onTickCallback);
      if (startedWs) {
        console.log('[KotakNeoService] Starting Kotak SFeed WebSocket (live ticks)…');
      } else {
        console.log(
          `[KotakNeoService] Starting REST quote poll (${this.pollIntervalMs}ms) — WS unavailable`
        );
      }
    };
    void boot();

    // REST fallback / bootstrap: skips when WS is healthy (avoids 429s)
    this.pollInterval = setInterval(async () => {
      if (this.pollPaused) return;
      if (this.feedWsAlive) return;
      if (this.isGateBusy()) return;
      const quotes = await this.fetchLiveQuotes();
      const ticks = this.quotesToTicks(quotes);
      if (ticks.length > 0 && typeof onTickCallback === 'function') onTickCallback(ticks);
    }, this.pollIntervalMs);
  }

  stopLiveFeed() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    try {
      this.feedWs?.stop();
    } catch {
      /* ignore */
    }
    this.feedWs = null;
    this.feedWsAlive = false;
  }

  /**
   * UI timeframe → Kotak Neo interval
   */
  mapTimeframeToInterval(timeframe = '5m') {
    const map = {
      '1m': '1min',
      '3m': '3min',
      '5m': '5min',
      '10m': '10min',
      '15m': '15min',
      '30m': '30min',
      '1h': '60min',
      '1d': 'D',
      '1w': 'W'
    };
    return map[String(timeframe).toLowerCase()] || '5min';
  }

  /**
   * Max days Kotak allows per historical request for an interval
   */
  maxDaysForInterval(interval) {
    // Inclusive calendar windows: use 29 (not 30) so Kotak never sees 422 ">30 days".
    const limits = {
      '1min': 29,
      '3min': 29,
      '5min': 29,
      '10min': 55,
      '15min': 55,
      '30min': 85,
      '60min': 85,
      D: 180,
      W: 180
    };
    return limits[interval] || 29;
  }

  formatISTDate(date) {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  normalizeCandles(rawCandles = []) {
    const mapped = rawCandles
      .map((c) => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseInt(c[5] || 0, 10)
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close));

    const byTime = new Map();
    for (const candle of mapped) {
      byTime.set(candle.time, candle);
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Fetch one Kotak historical window
   */
  async fetchHistoricalWindow(segment, token, interval, fromDate, toDate) {
    if (!this.isLoggedIn || !this.baseUrl) {
      await this.login();
    }
    if (!this.baseUrl) return [];

    const neosymbol = `${segment}|${token}`;
    const query =
      `neosymbol=${encodeURIComponent(neosymbol)}` +
      `&interval=${encodeURIComponent(interval)}` +
      `&from_date=${fromDate}&to_date=${toDate}` +
      `&fromdate=${fromDate}&todate=${toDate}`;

    const res = await this.gatedRequest({
      hostname: this.baseUrl,
      path: `/market-data/1.0/historical/details?${query}`,
      method: 'GET',
      headers: {
        Authorization: this.consumerKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (res.statusCode === 200 && res.data?.data?.candles) {
      return this.normalizeCandles(res.data.data.candles);
    }

    if (res.statusCode !== 200) {
      console.warn(
        `[KotakNeoService] Historical ${interval} ${fromDate}→${toDate} failed:`,
        res.statusCode,
        res.data?.fault?.message || res.data?.message || ''
      );
    }
    return [];
  }

  /**
   * Fetch live historical candles for a timeframe + lookback (up to ~1 year via chunking)
   */
  async fetchHistoricalCandles(segment, token, options = {}) {
    const timeframe = options.timeframe || '5m';
    const rangeDays = Math.min(Math.max(Number(options.rangeDays) || 3, 1), 365);
    const interval = this.mapTimeframeToInterval(timeframe);
    const chunkDays = this.maxDaysForInterval(interval);

    if (!this.isLoggedIn || !this.baseUrl) {
      await this.login();
    }
    if (!this.baseUrl) return null;

    try {
      const end = new Date();
      const start = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
      const all = [];

      let cursorEnd = new Date(end);
      while (cursorEnd > start) {
        const cursorStart = new Date(
          Math.max(start.getTime(), cursorEnd.getTime() - chunkDays * 24 * 60 * 60 * 1000)
        );
        const fromDate = this.formatISTDate(cursorStart);
        const toDate = this.formatISTDate(cursorEnd);

        const chunk = await this.fetchHistoricalWindow(segment, token, interval, fromDate, toDate);
        if (chunk.length) {
          all.push(...chunk);
        }

        // Step back 1 day to avoid missing boundary candle; dedupe later
        cursorEnd = new Date(cursorStart.getTime() - 24 * 60 * 60 * 1000);
        if (cursorEnd > start) {
          await this.sleep(120);
        }
      }

      const merged = new Map();
      for (const c of all) merged.set(c.time, c);
      const sorted = Array.from(merged.values()).sort((a, b) => a.time - b.time);
      return sorted.length ? sorted : null;
    } catch (e) {
      console.error('[KotakNeoService] Historical fetch error:', e.message);
      return null;
    }
  }

  /**
   * Ensure login so market-data calls have a dynamic baseUrl.
   */
  async ensureSession() {
    if (this.isLoggedIn && this.baseUrl) return true;
    return this.login();
  }

  /**
   * Market-data GET against the session baseUrl (Authorization = consumer key).
   */
  async marketDataGet(pathWithQuery) {
    const ok = await this.ensureSession();
    if (!ok || !this.baseUrl) {
      throw new Error('Kotak Neo session unavailable. Check KOTAK_* credentials.');
    }

    const res = await this.gatedRequest({
      hostname: this.baseUrl,
      path: pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`,
      method: 'GET',
      headers: {
        Authorization: this.consumerKey,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    if (res.statusCode !== 200) {
      const msg =
        res.data?.fault?.message ||
        res.data?.errMsg ||
        res.data?.message ||
        res.text ||
        `HTTP ${res.statusCode}`;
      const err = new Error(`Kotak ${pathWithQuery}: ${msg}`);
      err.statusCode = res.statusCode;
      err.body = res.data;
      throw err;
    }

    return res.data;
  }

  /**
   * Available option/futures expiries (YYYY-MM-DD), ascending.
   */
  async fetchExpiries(exchange, underlying, instrumentType = 'option') {
    const qs = new URLSearchParams({
      exchange: String(exchange),
      underlying: String(underlying),
      instrument_type: instrumentType
    });
    const body = await this.marketDataGet(`/market-data/1.0/watchlist/expiries?${qs}`);
    const list = body?.expiries || body?.data?.expiries || [];
    return Array.from(new Set(list.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  }

  /**
   * Option chain for an underlying + expiry.
   */
  async fetchOptionChain(exchange, underlying, expiry = null, count = 40) {
    const qs = new URLSearchParams({
      exchange: String(exchange),
      underlying: String(underlying),
      instrument_type: 'option',
      count: String(Math.max(10, Math.min(80, Number(count) || 40)))
    });
    if (expiry) qs.set('expiry', expiry);
    const body = await this.marketDataGet(`/market-data/1.0/watchlist/option-chain?${qs}`);
    return body?.data || body;
  }

  /**
   * Futures chain (all months when expiry omitted).
   */
  async fetchFuturesChain(exchange, underlying, expiry = null) {
    const qs = new URLSearchParams({
      exchange: String(exchange),
      underlying: String(underlying),
      instrument_type: 'fut'
    });
    if (expiry) qs.set('expiry', expiry);
    const body = await this.marketDataGet(`/market-data/1.0/watchlist/option-chain?${qs}`);
    return body?.data || body;
  }

  /**
   * Quote one neo symbol (e.g. nse_cm|2885 or nse_fo|61471).
   */
  async fetchQuote(neosymbol) {
    const ok = await this.ensureSession();
    if (!ok || !this.baseUrl) return null;
    const encoded = encodeURIComponent(neosymbol).replace(/%7C/g, '|');
    const res = await this.gatedRequest({
      hostname: this.baseUrl,
      path: `/script-details/1.0/quotes/neosymbol/${encoded}/all`,
      method: 'GET',
      headers: {
        Authorization: this.consumerKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    if (res.statusCode === 200 && Array.isArray(res.data) && res.data[0]) return res.data[0];
    if (res.statusCode === 200 && res.data?.data?.[0]) return res.data.data[0];
    return null;
  }

  /**
   * 1-minute futures candles as { at, close, oi } (epoch ms).
   */
  async fetchFuturesMinuteCandles(neosymbol, sessionDate) {
    const [segment] = String(neosymbol).split('|');
    if (!segment || !String(neosymbol).includes('|')) return [];

    const ok = await this.ensureSession();
    if (!ok || !this.baseUrl) return [];

    const query =
      `neosymbol=${encodeURIComponent(neosymbol)}` +
      `&interval=1min` +
      `&from_date=${sessionDate}&to_date=${sessionDate}` +
      `&fromdate=${sessionDate}&todate=${sessionDate}`;

    const res = await this.gatedRequest({
      hostname: this.baseUrl,
      path: `/market-data/1.0/historical/details?${query}`,
      method: 'GET',
      headers: {
        Authorization: this.consumerKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const candles = res.data?.data?.candles || [];
    const mapped = candles
      .map((c) => ({
        at: new Date(c[0]).getTime(),
        close: parseFloat(c[4]),
        oi: parseInt(c[6] ?? 0, 10) || 0
      }))
      .filter((c) => Number.isFinite(c.at) && Number.isFinite(c.close));

    const byAt = new Map();
    for (const candle of mapped) byAt.set(candle.at, candle);
    return Array.from(byAt.values()).sort((a, b) => a.at - b.at);
  }

  parseNeoSymbol(neoSymbol) {
    const [segment, token] = String(neoSymbol || '').split('|');
    return { segment, token };
  }
}

export const kotakNeoService = new KotakNeoService();

