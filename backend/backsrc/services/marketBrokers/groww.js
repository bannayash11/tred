/**
 * Groww BYOK market adapter — quotes via Live Data API when token present.
 * Docs: https://groww.in/trade-api/docs
 */
const API = 'https://api.groww.in';

export function createGrowwAdapter({ session, secrets } = {}) {
  const accessToken = String(
    session?.accessToken || secrets?.accessToken || session?.token || ''
  ).trim();

  async function get(path) {
    if (!accessToken) throw new Error('Groww access token required. Reconnect Groww in BYOK.');
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-API-VERSION': '1.0'
      },
      signal: AbortSignal.timeout(20_000)
    });
    if (!res.ok) {
      const err = new Error(`Groww ${res.status}: ${(await res.text()).slice(0, 180)}`);
      err.statusCode = res.status;
      throw err;
    }
    return res.json();
  }

  return {
    id: 'groww',
    label: 'Groww',

    async init() {
      if (!accessToken) throw new Error('Groww BYOK session missing access token.');
    },

    async getQuotes(symbols = []) {
      // Groww live quote batch — exchange NSE, segment CASH
      const ticks = [];
      for (const symbol of symbols.slice(0, 40)) {
        const sym = String(symbol).toUpperCase().replace(/\s+/g, '');
        if (sym === 'NIFTY50' || sym === 'NIFTY') continue;
        try {
          const body = await get(
            `/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${encodeURIComponent(sym)}`
          );
          const q = body?.payload || body?.data || body;
          const ltp = Number(q?.ltp || q?.last_price || q?.ohlc?.close || 0);
          if (!ltp) continue;
          const open = Number(q?.open || q?.ohlc?.open || ltp);
          ticks.push({
            symbol: String(symbol).toUpperCase() === 'NIFTY 50' ? 'NIFTY 50' : String(symbol).toUpperCase(),
            currentPrice: ltp,
            open,
            high: Number(q?.high || q?.ohlc?.high || ltp),
            low: Number(q?.low || q?.ohlc?.low || ltp),
            close: ltp,
            change: Number(q?.day_change_perc || (((ltp - open) / open) * 100).toFixed(2)),
            volume: Number(q?.volume || 0),
            source: 'groww'
          });
        } catch {
          /* skip symbol */
        }
      }
      return ticks;
    },

    async fetchHistoricalCandles(symbol, { timeframe = '5m', rangeDays = 5 } = {}) {
      const sym = String(symbol).toUpperCase().replace(/\s+/g, '');
      const intervalMap = { '1m': 1, '3m': 3, '5m': 5, '15m': 15, '1d': '1d' };
      const interval = intervalMap[String(timeframe).toLowerCase()] || 5;
      try {
        const body = await get(
          `/v1/historical/candle/range?exchange=NSE&segment=CASH&trading_symbol=${encodeURIComponent(sym)}&start_time=${Date.now() - rangeDays * 86_400_000}&end_time=${Date.now()}&interval_in_minutes=${interval === '1d' ? 1440 : interval}`
        );
        const rows = body?.payload?.candles || body?.data?.candles || body?.candles || [];
        return (rows || [])
          .map((c) => {
            const arr = Array.isArray(c) ? c : [c.timestamp, c.open, c.high, c.low, c.close, c.volume];
            const t = Math.floor(Number(arr[0]) > 1e12 ? Number(arr[0]) / 1000 : Number(arr[0]));
            return {
              time: t,
              open: Number(arr[1]),
              high: Number(arr[2]),
              low: Number(arr[3]),
              close: Number(arr[4]),
              volume: Number(arr[5]) || 0
            };
          })
          .filter((c) => Number.isFinite(c.time) && c.close > 0)
          .sort((a, b) => a.time - b.time);
      } catch (err) {
        console.warn('[Groww] history failed:', err.message);
        return [];
      }
    }
  };
}
