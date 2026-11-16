/**
 * Kotak Neo market client scoped to a BYOK session (not platform env singleton).
 */
import https from 'https';
import { kotakNeoService } from '../kotakNeoService.js';

function httpsJson({ hostname, path, method = 'GET', headers = {}, body = null, timeout = 20000 }) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          ...headers,
          ...(payload
            ? {
                'Content-Length': Buffer.byteLength(payload),
                'Content-Type': headers['Content-Type'] || 'application/json'
              }
            : {})
        },
        timeout
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text;
          }
          resolve({ statusCode: res.statusCode, data, text });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Kotak BYOK request timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

export function createKotakByokAdapter({ session, secrets } = {}) {
  const consumerKey = String(secrets?.consumerKey || session?.consumerKey || '').trim();
  let baseUrl = String(session?.baseUrl || session?.assignedUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const sid = session?.sid;
  const viewToken = session?.viewToken || session?.token;
  const tokenMap = kotakNeoService.tokenMap || [];
  let gapMs = 450;
  let lastAt = 0;
  let chain = Promise.resolve();

  async function gated(fn) {
    const run = chain.then(async () => {
      const wait = Math.max(0, gapMs - (Date.now() - lastAt));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastAt = Date.now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  }

  async function marketGet(pathWithQuery) {
    if (!baseUrl || !consumerKey) throw new Error('Kotak BYOK session incomplete (baseUrl/consumerKey).');
    const res = await gated(() =>
      httpsJson({
        hostname: baseUrl,
        path: pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`,
        method: 'GET',
        headers: {
          Authorization: consumerKey,
          Accept: 'application/json',
          sid: sid || '',
          Auth: viewToken || '',
          'neo-fin-key': 'neotradeapi'
        }
      })
    );
    if (res.statusCode === 429) {
      gapMs = Math.min(1400, gapMs + 200);
      throw new Error('Kotak rate limited (429)');
    }
    if (res.statusCode !== 200) {
      throw new Error(`Kotak ${pathWithQuery}: HTTP ${res.statusCode}`);
    }
    return res.data;
  }

  return {
    id: 'kotak',
    label: 'Kotak Neo',

    async init() {
      if (!consumerKey || !baseUrl) {
        throw new Error('Kotak BYOK session missing. Reconnect Kotak Neo in BYOK settings.');
      }
      // sid/viewToken help some endpoints; quotes use consumer key + baseUrl like platform
      if (!sid || !viewToken) {
        console.warn('[KotakByok] sid/viewToken missing — quotes may still work with baseUrl');
      }
    },

    async getQuotes(symbols = []) {
      const wanted = new Set(symbols.map((s) => String(s).toUpperCase()));
      const map = tokenMap.filter((m) => wanted.has(String(m.symbol).toUpperCase()));
      if (!map.length) return [];

      const quotesList = [];
      const batchSize = 15;
      for (let i = 0; i < map.length; i += batchSize) {
        const batch = map.slice(i, i + batchSize);
        const neoSymbols = batch.map((item) => `${item.segment}|${item.token}`).join(',');
        const encoded = encodeURIComponent(neoSymbols).replace(/%7C/g, '|').replace(/%2C/g, ',');
        try {
          const data = await marketGet(`/script-details/1.0/quotes/neosymbol/${encoded}/all`);
          if (Array.isArray(data)) quotesList.push(...data);
        } catch (err) {
          console.warn('[KotakByok] quote batch failed:', err.message);
        }
      }
      return kotakNeoService.quotesToTicks(quotesList);
    },

    async fetchHistoricalCandles(symbol, options = {}) {
      const mapping = tokenMap.find((m) => String(m.symbol).toUpperCase() === String(symbol).toUpperCase());
      if (!mapping) return [];
      const timeframe = options.timeframe || '5m';
      const rangeDays = Math.min(Math.max(Number(options.rangeDays) || 5, 1), 30);
      const interval = kotakNeoService.mapTimeframeToInterval(timeframe);
      const end = new Date();
      const start = new Date(Date.now() - rangeDays * 86_400_000);
      const all = [];
      let cursorEnd = new Date(end);
      const chunkDays = Math.min(7, rangeDays);

      while (cursorEnd > start) {
        const cursorStart = new Date(
          Math.max(start.getTime(), cursorEnd.getTime() - chunkDays * 86_400_000)
        );
        const fromDate = kotakNeoService.formatISTDate(cursorStart);
        const toDate = kotakNeoService.formatISTDate(cursorEnd);
        const neosymbol = `${mapping.segment}|${mapping.token}`;
        const query =
          `neosymbol=${encodeURIComponent(neosymbol)}` +
          `&interval=${encodeURIComponent(interval)}` +
          `&from_date=${fromDate}&to_date=${toDate}` +
          `&fromdate=${fromDate}&todate=${toDate}`;
        try {
          const data = await marketGet(`/market-data/1.0/historical/details?${query}`);
          const raw = data?.data || data?.candles || data || [];
          const list = Array.isArray(raw) ? raw : raw?.candles || [];
          all.push(...kotakNeoService.normalizeCandles(list));
        } catch (err) {
          console.warn('[KotakByok] history window failed:', err.message);
        }
        cursorEnd = new Date(cursorStart.getTime() - 86_400_000);
      }

      const merged = new Map();
      for (const c of all) merged.set(c.time, c);
      return Array.from(merged.values()).sort((a, b) => a.time - b.time);
    }
  };
}
