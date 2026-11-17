/**
 * Fyers API v3 — platform primary market data (quotes + historical candles).
 * Priority: Fyers → Upstox → Kotak (see marketDataService).
 */
import crypto from 'crypto';
import https from 'https';

const AUTH_HOST = 'api-t1.fyers.in';
const DATA_HOST = 'api-t1.fyers.in';

const INDEX_FYERS = {
  'NIFTY 50': 'NSE:NIFTY50-INDEX',
  NIFTY50: 'NSE:NIFTY50-INDEX',
  NIFTY: 'NSE:NIFTY50-INDEX',
  BANKNIFTY: 'NSE:NIFTYBANK-INDEX',
  'BANK NIFTY': 'NSE:NIFTYBANK-INDEX'
};

function appIdHash(appId, secret) {
  return crypto.createHash('sha256').update(`${appId}:${secret}`).digest('hex');
}

function toFyersSymbol(appSymbol) {
  const s = String(appSymbol || '').trim().toUpperCase();
  if (INDEX_FYERS[s]) return INDEX_FYERS[s];
  // Equities: NSE:RELIANCE-EQ, NSE:M&M-EQ, NSE:BAJAJ-AUTO-EQ
  return `NSE:${s}-EQ`;
}

function fromFyersSymbol(fySymbol) {
  const n = String(fySymbol || '').toUpperCase();
  for (const [app, fy] of Object.entries(INDEX_FYERS)) {
    if (fy === n && (app === 'NIFTY 50' || app === 'BANKNIFTY')) return app;
  }
  const m = n.match(/^NSE:(.+)-EQ$/);
  return m ? m[1] : n;
}

function mapResolution(timeframe = '5m') {
  const t = String(timeframe || '5m').toLowerCase();
  if (t === '1m') return '1';
  if (t === '3m') return '3';
  if (t === '5m') return '5';
  if (t === '10m') return '10';
  if (t === '15m') return '15';
  if (t === '30m') return '30';
  if (t === '1h' || t === '60m') return '60';
  if (t === '1d' || t === 'd') return 'D';
  return '5';
}

function ymdIst(ms = Date.now()) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function httpsJson({ hostname, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = { raw };
          }
          resolve({ statusCode: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(25_000, () => {
      req.destroy(new Error('Fyers request timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

class FyersService {
  constructor() {
    this.appId = process.env.FYERS_APP_ID || '';
    this.appSecret = process.env.FYERS_APP_SECRET || '';
    this.accessToken = process.env.FYERS_ACCESS_TOKEN || '';
    this.refreshToken = process.env.FYERS_REFRESH_TOKEN || '';
    this.pin = process.env.FYERS_PIN || '';
    this.redirectUri =
      process.env.FYERS_REDIRECT_URI || 'https://trade.fyers.in/api-login/redirect-uri/index.html';

    this.pollInterval = null;
    this.pollPaused = false;
    this.pollIntervalMs = Math.max(2500, Number(process.env.FYERS_QUOTE_POLL_MS) || 4000);
    this._tickCallback = null;
    this._refreshTimer = null;
    this._refreshInflight = null;
    this.symbolList = [];
  }

  applyCredentials({
    appId,
    appSecret,
    accessToken,
    refreshToken,
    pin,
    redirectUri
  } = {}) {
    if (appId !== undefined) this.appId = String(appId || '').trim();
    if (appSecret !== undefined) this.appSecret = String(appSecret || '').trim();
    if (accessToken !== undefined) this.accessToken = String(accessToken || '').trim();
    if (refreshToken !== undefined) this.refreshToken = String(refreshToken || '').trim();
    if (pin !== undefined) this.pin = String(pin || '').trim();
    if (redirectUri !== undefined) this.redirectUri = String(redirectUri || '').trim();
  }

  get configured() {
    return Boolean(this.appId && this.accessToken);
  }

  get canAutoRefresh() {
    return Boolean(this.appId && this.appSecret && this.refreshToken && this.pin);
  }

  authHeader() {
    return `${this.appId}:${this.accessToken}`;
  }

  toFyersSymbol(symbol) {
    return toFyersSymbol(symbol);
  }

  setUniverse(symbols = []) {
    this.symbolList = [...new Set(symbols.map((s) => String(s).trim()).filter(Boolean))];
  }

  async ensureSession() {
    if (!this.appId) return false;
    if (this.accessToken) return true;
    if (this.canAutoRefresh) {
      return this.refreshAccessToken();
    }
    return false;
  }

  async refreshAccessToken() {
    if (!this.canAutoRefresh) return false;
    if (this._refreshInflight) return this._refreshInflight;

    this._refreshInflight = (async () => {
      try {
        const hash = appIdHash(this.appId, this.appSecret);
        const res = await httpsJson({
          hostname: AUTH_HOST,
          path: '/api/v3/validate-refresh-token',
          method: 'POST',
          body: {
            grant_type: 'refresh_token',
            appIdHash: hash,
            refresh_token: this.refreshToken,
            pin: this.pin
          }
        });
        const token = res.data?.access_token;
        if (res.data?.s === 'ok' && token) {
          this.accessToken = token;
          process.env.FYERS_ACCESS_TOKEN = token;
          console.log('[FyersService] Access token refreshed via refresh_token');
          return true;
        }
        console.warn(
          '[FyersService] Refresh failed:',
          res.data?.message || res.data?.code || res.statusCode
        );
        return false;
      } catch (err) {
        console.warn('[FyersService] Refresh error:', err.message);
        return false;
      } finally {
        this._refreshInflight = null;
      }
    })();

    return this._refreshInflight;
  }

  scheduleDailyRefresh() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    // Check every 30 min; refresh if token likely stale after 06:30 IST
    this._refreshTimer = setInterval(() => {
      if (!this.canAutoRefresh) return;
      try {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(new Date());
        const hour = Number(parts.find((p) => p.type === 'hour')?.value === '24' ? 0 : parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);
        const mins = hour * 60 + minute;
        // After 06:35 IST attempt refresh once per morning window
        if (mins >= 6 * 60 + 35 && mins <= 7 * 60 + 30) {
          void this.refreshAccessToken();
        }
      } catch {
        /* ignore */
      }
    }, 30 * 60_000);
  }

  async dataGet(path) {
    await this.ensureSession();
    if (!this.configured) throw new Error('Fyers not configured (need App ID + access token)');

    let res = await httpsJson({
      hostname: DATA_HOST,
      path,
      method: 'GET',
      headers: { Authorization: this.authHeader() }
    });

    // Token expired → refresh once and retry
    const code = res.data?.code;
    const msg = String(res.data?.message || '').toLowerCase();
    const authFail =
      res.statusCode === 401 ||
      code === -8 ||
      code === -15 ||
      code === -16 ||
      code === -17 ||
      msg.includes('token') ||
      msg.includes('unauthorized');

    if (authFail && this.canAutoRefresh) {
      const ok = await this.refreshAccessToken();
      if (ok) {
        res = await httpsJson({
          hostname: DATA_HOST,
          path,
          method: 'GET',
          headers: { Authorization: this.authHeader() }
        });
      }
    }

    if (res.data?.s && res.data.s !== 'ok') {
      throw new Error(`Fyers: ${res.data.message || res.data.code || 'error'}`);
    }
    return res.data;
  }

  /**
   * Live quotes for app symbols → ticks compatible with handleRealTicks
   */
  async fetchLiveQuotes(symbols = null) {
    const list = symbols?.length ? symbols : this.symbolList;
    if (!list.length) return [];

    const ticks = [];
    const chunk = 50;
    for (let i = 0; i < list.length; i += chunk) {
      const batch = list.slice(i, i + chunk);
      const fySymbols = batch.map((s) => toFyersSymbol(s));
      const qs = encodeURIComponent(fySymbols.join(','));
      let data;
      try {
        data = await this.dataGet(`/data/quotes?symbols=${qs}`);
      } catch (err) {
        console.warn('[FyersService] quotes batch failed:', err.message);
        continue;
      }
      for (const row of data?.d || []) {
        if (row.s !== 'ok' || !row.v) continue;
        const v = row.v;
        const ltp = Number(v.lp || 0);
        if (!ltp) continue;
        const appSym = fromFyersSymbol(v.symbol || row.n);
        // Prefer original app symbol from batch when possible
        const matched =
          batch.find((s) => toFyersSymbol(s) === String(v.symbol || row.n).toUpperCase()) || appSym;
        const open = Number(v.open_price || ltp);
        ticks.push({
          symbol: matched,
          currentPrice: ltp,
          open,
          high: Number(v.high_price || ltp),
          low: Number(v.low_price || ltp),
          close: ltp,
          change: Number(v.chp != null ? v.chp : (((ltp - open) / open) * 100).toFixed(2)),
          volume: Number(v.volume || 0),
          source: 'fyers'
        });
      }
      if (i + chunk < list.length) {
        await new Promise((r) => setTimeout(r, 220));
      }
    }
    return ticks;
  }

  async fetchHistoricalCandles(symbol, { timeframe = '5m', rangeDays = 5 } = {}) {
    const fy = toFyersSymbol(symbol);
    const resolution = mapResolution(timeframe);
    const to = ymdIst(Date.now());
    const from = ymdIst(Date.now() - Math.max(1, rangeDays) * 86_400_000);
    const path =
      `/data/history?symbol=${encodeURIComponent(fy)}` +
      `&resolution=${encodeURIComponent(resolution)}` +
      `&date_format=1&range_from=${from}&range_to=${to}&cont_flag=1`;

    const data = await this.dataGet(path);
    const rows = data?.candles || [];
    return rows
      .map((c) => ({
        time: Number(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]) || 0
      }))
      .filter((c) => Number.isFinite(c.time) && c.close > 0)
      .sort((a, b) => a.time - b.time);
  }

  startLiveFeed(onTickCallback) {
    this._tickCallback = onTickCallback;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.scheduleDailyRefresh();

    const poll = async () => {
      if (this.pollPaused) return;
      try {
        const ticks = await this.fetchLiveQuotes();
        if (ticks.length && typeof this._tickCallback === 'function') {
          this._tickCallback(ticks);
        }
      } catch (err) {
        console.warn('[FyersService] poll error:', err.message);
      }
    };

    void poll();
    this.pollInterval = setInterval(poll, this.pollIntervalMs);
    console.log(`[FyersService] Live quote poll started (${this.pollIntervalMs}ms)`);
  }

  stopLiveFeed() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  pauseLiveFeed(paused = true) {
    this.pollPaused = Boolean(paused);
  }
}

export const fyersService = new FyersService();
export { toFyersSymbol, fromFyersSymbol, appIdHash };
