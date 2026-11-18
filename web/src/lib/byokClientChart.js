/**
 * BYOK charts: load candles from the user's broker in the browser
 * (thin CORS proxy only if the broker blocks browser Origin).
 * Platform / server-plan charts use the backend active feed (Kotak / Fyers / Upstox).
 */
import {
  fetchByokMarketClientApi,
  fetchByokSymbolMapApi,
  byokBrokerProxyApi
} from '../services/api';

let cachedClient = null;
let cachedClientAt = 0;
let instrumentMap = null; // symbol → instrument_key

function ymd(ms) {
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
}

function mapTf(tf) {
  const t = String(tf || '5m').toLowerCase();
  if (t === '1m') return { unit: 'minutes', interval: '1' };
  if (t === '3m') return { unit: 'minutes', interval: '3' };
  if (t === '5m') return { unit: 'minutes', interval: '5' };
  if (t === '15m') return { unit: 'minutes', interval: '15' };
  if (t === '1d') return { unit: 'days', interval: '1' };
  return { unit: 'minutes', interval: '5' };
}

async function getMarketClient() {
  if (cachedClient && Date.now() - cachedClientAt < 10 * 60_000) return cachedClient;
  const res = await fetchByokMarketClientApi();
  if (!res?.success || !res.client) {
    throw new Error(res?.message || 'BYOK market client unavailable. Reconnect broker.');
  }
  cachedClient = res;
  cachedClientAt = Date.now();
  return res;
}

async function brokerGet(url, accessToken) {
  // 1) Try direct from browser
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });
    if (res.ok) return res.json();
    // Non-CORS HTTP errors still return
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || `Broker HTTP ${res.status}`), {
      status: res.status,
      cors: false
    });
  } catch (err) {
    // 2) CORS / network → thin server proxy (forward only)
    if (err?.cors === false && err.status) throw err;
    const proxied = await byokBrokerProxyApi({ url, method: 'GET' });
    if (!proxied?.success && proxied?.status >= 400) {
      throw new Error(proxied?.message || `Broker proxy ${proxied?.status || 'failed'}`);
    }
    return proxied?.data?.data != null && proxied.data.status
      ? proxied.data
      : proxied?.data;
  }
}

async function ensureInstrumentMap() {
  if (instrumentMap) return instrumentMap;
  const res = await fetchByokSymbolMapApi();
  const map = res?.map || {};
  instrumentMap = new Map(Object.entries(map));
  return instrumentMap;
}

function parseCandles(payload) {
  const rows = payload?.data?.candles || payload?.candles || [];
  return (rows || [])
    .map((c) => ({
      time: Math.floor(Date.parse(c[0]) / 1000),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]) || 0
    }))
    .filter((c) => Number.isFinite(c.time) && c.close > 0)
    .sort((a, b) => a.time - b.time);
}

async function fetchUpstoxStock(symbol, { timeframe, rangeDays }, client) {
  const token = client.accessToken;
  if (!token) throw new Error('Upstox access token missing. Reconnect BYOK.');

  const map = await ensureInstrumentMap();
  const sym = String(symbol || '').toUpperCase();
  const instrumentKey = map.get(sym);
  if (!instrumentKey) {
    throw new Error(`No Upstox instrument for ${sym}. Try another symbol.`);
  }

  const { unit, interval } = mapTf(timeframe);
  const to = ymd(Date.now());
  const from = ymd(Date.now() - Math.max(1, rangeDays) * 86_400_000);
  const q = encodeURIComponent(instrumentKey);

  let histUrl =
    unit === 'days'
      ? `https://api.upstox.com/v3/historical-candle/${q}/days/${interval}/${to}/${from}`
      : `https://api.upstox.com/v3/historical-candle/${q}/minutes/${interval}/${to}/${from}`;

  let hist;
  try {
    hist = await brokerGet(histUrl, token);
  } catch {
    histUrl = `https://api.upstox.com/v3/historical-candle/intraday/${q}/minutes/${interval}`;
    hist = await brokerGet(histUrl, token);
  }

  const candles = parseCandles(hist);

  let quote = null;
  try {
    const qRes = await brokerGet(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${q}`,
      token
    );
    const data = qRes?.data || qRes;
    quote = data ? Object.values(data)[0] : null;
  } catch {
    /* optional */
  }

  const ltp = Number(quote?.last_price || candles.at(-1)?.close || 0);
  const ohlc = quote?.ohlc || {};
  const open = Number(ohlc.open || candles[0]?.open || ltp);
  const net = Number(quote?.net_change);
  const base = Number.isFinite(net) ? ltp - net : open;
  const change = ltp && base ? Number((((ltp - base) / base) * 100).toFixed(2)) : 0;

  return {
    symbol: sym,
    name: sym,
    sector: 'NSE',
    currentPrice: ltp,
    dayOpen: open,
    high: Number(ohlc.high || Math.max(...candles.map((c) => c.high), ltp)),
    low: Number(ohlc.low || Math.min(...candles.map((c) => c.low), ltp)),
    change,
    volume: Number(quote?.volume || 0),
    timeframe,
    rangeDays,
    dataSource: candles.length ? 'live' : 'unavailable',
    isLive: true,
    candles,
    smcData: null,
    feed: { mode: 'byok', provider: 'upstox', label: 'BYOK · Upstox (client)' }
  };
}

/**
 * Load one stock chart for a BYOK user from their broker (frontend).
 */
export async function fetchByokClientStock(symbol, { timeframe = '5m', rangeDays = 5 } = {}) {
  const session = await getMarketClient();
  const provider = session.client?.provider;
  const feed = session.feed;

  if (provider === 'upstox') {
    const stock = await fetchUpstoxStock(symbol, { timeframe, rangeDays }, session.client);
    stock.feed = feed || stock.feed;
    return { success: true, stock, feed: stock.feed };
  }

  throw new Error(
    `Client-side charts for ${provider || 'this broker'} are not ready yet. Use Upstox BYOK, or a Platform plan for server charts.`
  );
}

export function clearByokClientCache() {
  cachedClient = null;
  cachedClientAt = 0;
  instrumentMap = null;
}

export function isByokChartUser(user) {
  const sub = user?.subscription;
  if (!sub) return false;
  return sub.mode === 'byok' || !!sub.byokGranted;
}
