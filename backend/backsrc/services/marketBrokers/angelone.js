/**
 * Angel One SmartAPI BYOK adapter — market quote + candle.
 */
const QUOTE_API = 'https://apiconnect.angelone.in';

export function createAngelOneAdapter({ session, secrets } = {}) {
  const jwtToken = String(session?.jwtToken || session?.accessToken || '').trim();
  const apiKey = String(secrets?.apiKey || session?.apiKey || '').trim();
  /** symbol → token (populated lazily / from search) */
  const tokenCache = new Map();

  async function post(path, body) {
    if (!jwtToken || !apiKey) {
      throw new Error('Angel One session incomplete. Reconnect Angel One in BYOK.');
    }
    const res = await fetch(`${QUOTE_API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00:00:00:00:00:00',
        'X-PrivateKey': apiKey,
        Authorization: `Bearer ${jwtToken}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      throw new Error(data.message || `Angel One ${res.status}`);
    }
    return data.data;
  }

  return {
    id: 'angelone',
    label: 'Angel One',

    async init() {
      if (!jwtToken || !apiKey) {
        throw new Error('Angel One BYOK session missing jwtToken/apiKey.');
      }
    },

    async getQuotes(symbols = []) {
      const ticks = [];
      // LTP API expects exchange tokens — use searchScrip when cache miss
      for (const symbol of symbols.slice(0, 30)) {
        const sym = String(symbol).toUpperCase();
        try {
          let token = tokenCache.get(sym);
          if (!token) {
            const found = await post('/rest/secure/angelbroking/order/v1/searchScrip', {
              exchange: 'NSE',
              searchscrip: sym.replace(/\s+/g, '')
            });
            const row = Array.isArray(found)
              ? found.find((r) => String(r.tradingsymbol || '').replace(/-EQ$/, '') === sym.replace(/\s+/g, ''))
              : null;
            token = row?.symboltoken;
            if (token) tokenCache.set(sym, token);
          }
          if (!token) continue;
          const q = await post('/rest/secure/angelbroking/market/v1/quote/', {
            mode: 'FULL',
            exchangeTokens: { NSE: [String(token)] }
          });
          const list = q?.fetched || q || [];
          const row = Array.isArray(list) ? list[0] : null;
          if (!row) continue;
          const ltp = Number(row.ltp || 0);
          if (!ltp) continue;
          const open = Number(row.open || ltp);
          ticks.push({
            symbol: sym,
            currentPrice: ltp,
            open,
            high: Number(row.high || ltp),
            low: Number(row.low || ltp),
            close: ltp,
            change: Number((((ltp - open) / open) * 100).toFixed(2)),
            volume: Number(row.tradeVolume || row.volume || 0),
            source: 'angelone'
          });
        } catch {
          /* skip */
        }
      }
      return ticks;
    },

    async fetchHistoricalCandles(symbol, { timeframe = '5m', rangeDays = 5 } = {}) {
      const sym = String(symbol).toUpperCase();
      let token = tokenCache.get(sym);
      if (!token) {
        try {
          const found = await post('/rest/secure/angelbroking/order/v1/searchScrip', {
            exchange: 'NSE',
            searchscrip: sym.replace(/\s+/g, '')
          });
          const row = Array.isArray(found)
            ? found.find((r) => String(r.tradingsymbol || '').replace(/-EQ$/, '') === sym.replace(/\s+/g, ''))
            : null;
          token = row?.symboltoken;
          if (token) tokenCache.set(sym, token);
        } catch {
          return [];
        }
      }
      if (!token) return [];

      const intervalMap = {
        '1m': 'ONE_MINUTE',
        '3m': 'THREE_MINUTE',
        '5m': 'FIVE_MINUTE',
        '15m': 'FIFTEEN_MINUTE',
        '1d': 'ONE_DAY'
      };
      const interval = intervalMap[String(timeframe).toLowerCase()] || 'FIVE_MINUTE';
      const to = new Date();
      const from = new Date(Date.now() - rangeDays * 86_400_000);
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

      try {
        const data = await post('/rest/secure/angelbroking/historical/v1/getCandleData', {
          exchange: 'NSE',
          symboltoken: String(token),
          interval,
          fromdate: fmt(from),
          todate: fmt(to)
        });
        const rows = Array.isArray(data) ? data : [];
        return rows
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
      } catch (err) {
        console.warn('[AngelOne] history failed:', err.message);
        return [];
      }
    }
  };
}
