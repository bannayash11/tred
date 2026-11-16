/**
 * Upstox equity/index quotes + historical candles for Terminal / BYOK feed.
 */
import { gunzipSync } from 'zlib';

const API = 'https://api.upstox.com';
const NSE_INSTRUMENTS = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
const MAX_PER_SECOND = 8;

const INDEX_ALIASES = {
  'NIFTY 50': ['Nifty 50', 'NIFTY'],
  NIFTY50: ['Nifty 50', 'NIFTY'],
  NIFTY: ['Nifty 50', 'NIFTY'],
  BANKNIFTY: ['Nifty Bank', 'BANKNIFTY'],
  'BANK NIFTY': ['Nifty Bank', 'BANKNIFTY']
};

function ymdIst(ms) {
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
}

function mapInterval(tf) {
  const t = String(tf || '5m').toLowerCase();
  if (t === '1m') return { unit: 'minutes', interval: '1' };
  if (t === '3m') return { unit: 'minutes', interval: '3' };
  if (t === '5m') return { unit: 'minutes', interval: '5' };
  if (t === '15m') return { unit: 'minutes', interval: '15' };
  if (t === '1h' || t === '60m') return { unit: 'minutes', interval: '30' };
  if (t === '1d' || t === 'd') return { unit: 'days', interval: '1' };
  return { unit: 'minutes', interval: '5' };
}

export function createUpstoxEquityAdapter({ accessToken } = {}) {
  const token = String(accessToken || '').trim();
  /** appSymbol → instrument_key */
  const keyBySymbol = new Map();
  let slots = [];
  let ready = false;

  async function get(path) {
    const now = Date.now();
    slots = slots.filter((t) => now - t < 1000);
    if (slots.length >= MAX_PER_SECOND) {
      await new Promise((r) => setTimeout(r, 1000 - (now - slots[0])));
    }
    slots.push(Date.now());
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000)
    });
    if (!res.ok) {
      const err = new Error(`Upstox ${res.status}: ${(await res.text()).slice(0, 180)}`);
      err.statusCode = res.status;
      throw err;
    }
    const body = await res.json();
    if (body.status && body.status !== 'success') {
      throw new Error(`Upstox: ${JSON.stringify(body.errors ?? body).slice(0, 180)}`);
    }
    return body.data;
  }

  return {
    id: 'upstox',
    label: 'Upstox',

    async init(symbols = []) {
      if (!token) throw new Error('Upstox access token required.');
      const wanted = new Set(symbols.map((s) => String(s).toUpperCase()));
      const res = await fetch(NSE_INSTRUMENTS, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`Upstox instruments ${res.status}`);
      const rows = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));

      for (const row of rows) {
        const name = String(row.trading_symbol || row.name || '').toUpperCase();
        const und = String(row.underlying_symbol || '').toUpperCase();
        const key = row.instrument_key;
        if (!key) continue;

        // Equity cash
        if (row.segment === 'NSE_EQ' && row.instrument_type === 'EQ') {
          const sym = und || name.replace(/-EQ$/, '');
          if (wanted.has(sym) && !keyBySymbol.has(sym)) keyBySymbol.set(sym, key);
        }

        // Indices (NSE_INDEX)
        if (row.segment === 'NSE_INDEX' || row.instrument_type === 'INDEX') {
          for (const [appSym, aliases] of Object.entries(INDEX_ALIASES)) {
            if (!wanted.has(appSym) && !wanted.has(appSym.replace(/\s+/g, ''))) continue;
            if (aliases.some((a) => a.toUpperCase() === name || a.toUpperCase() === und)) {
              keyBySymbol.set(appSym.includes('NIFTY') && appSym.includes('50') ? 'NIFTY 50' : appSym, key);
            }
          }
          if (name === 'NIFTY 50' || name === 'NIFTY50' || und === 'NIFTY') {
            if (wanted.has('NIFTY 50')) keyBySymbol.set('NIFTY 50', key);
          }
          if (name === 'NIFTY BANK' || und === 'BANKNIFTY') {
            if (wanted.has('BANKNIFTY')) keyBySymbol.set('BANKNIFTY', key);
          }
        }
      }

      // Special tickers
      for (const sym of wanted) {
        if (keyBySymbol.has(sym)) continue;
        const row = rows.find(
          (r) =>
            r.segment === 'NSE_EQ' &&
            r.instrument_type === 'EQ' &&
            (String(r.trading_symbol || '').toUpperCase() === sym ||
              String(r.underlying_symbol || '').toUpperCase() === sym)
        );
        if (row?.instrument_key) keyBySymbol.set(sym, row.instrument_key);
      }

      ready = true;
      console.log(`[UpstoxEquity] mapped ${keyBySymbol.size}/${wanted.size} symbols`);
    },

    async getQuotes(symbols = []) {
      if (!ready) throw new Error('Upstox equity adapter not initialized');
      const keys = [];
      const reverse = new Map();
      for (const sym of symbols) {
        const s = String(sym).toUpperCase();
        const key = keyBySymbol.get(s);
        if (!key) continue;
        keys.push(key);
        reverse.set(key, s);
      }
      if (!keys.length) return [];

      const ticks = [];
      const chunk = 50;
      const keyToSym = new Map([...keyBySymbol.entries()].map(([s, k]) => [k, s]));
      for (let i = 0; i < keys.length; i += chunk) {
        const batch = keys.slice(i, i + chunk);
        const q = batch.map(encodeURIComponent).join(',');
        const data = await get(`/v2/market-quote/quotes?instrument_key=${q}`);
        for (const [ik, quote] of Object.entries(data || {})) {
          const instrumentKey = quote?.instrument_key || ik;
          let sym =
            reverse.get(instrumentKey) ||
            keyToSym.get(instrumentKey) ||
            reverse.get(ik) ||
            keyToSym.get(ik);
          if (!sym) {
            for (const [s, k] of keyBySymbol) {
              if (ik === k || instrumentKey === k || String(ik).includes(k)) {
                sym = s;
                break;
              }
            }
          }
          if (!sym) continue;
          const ltp = Number(quote.last_price || quote.ltp || 0);
          if (!ltp) continue;
          const ohlc = quote.ohlc || {};
          const open = Number(ohlc.open || ltp);
          const high = Number(ohlc.high || quote.high || ltp);
          const low = Number(ohlc.low || quote.low || ltp);
          const net = Number(quote.net_change);
          const base = Number.isFinite(net) ? ltp - net : open;
          const change = Number((((ltp - (base || open || ltp)) / (base || open || ltp)) * 100).toFixed(2));
          ticks.push({
            symbol: sym,
            currentPrice: ltp,
            open,
            high,
            low,
            close: ltp,
            change: Number.isFinite(change) ? change : 0,
            volume: Number(quote.volume || 0),
            source: 'upstox'
          });
        }
      }
      return ticks;
    },

    async fetchHistoricalCandles(symbol, { timeframe = '5m', rangeDays = 5 } = {}) {
      const sym = String(symbol).toUpperCase();
      const key = keyBySymbol.get(sym);
      if (!key) return [];
      const { unit, interval } = mapInterval(timeframe);
      const to = ymdIst(Date.now());
      const from = ymdIst(Date.now() - Math.max(1, rangeDays) * 86_400_000);
      const q = encodeURIComponent(key);
      let data;
      if (unit === 'days') {
        data = await get(`/v3/historical-candle/${q}/days/${interval}/${to}/${from}`);
      } else {
        // Prefer dated history; fall back to intraday for today
        try {
          data = await get(`/v3/historical-candle/${q}/minutes/${interval}/${to}/${from}`);
        } catch {
          data = await get(`/v3/historical-candle/intraday/${q}/minutes/${interval}`);
        }
      }
      const rows = data?.candles || [];
      return rows
        .map((c) => {
          const t = Math.floor(Date.parse(c[0]) / 1000);
          return {
            time: t,
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]) || 0
          };
        })
        .filter((c) => Number.isFinite(c.time) && c.close > 0)
        .sort((a, b) => a.time - b.time);
    }
  };
}
