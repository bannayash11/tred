import { useEffect, useMemo, useRef, useState } from 'react';
import { getLatestTradingSessionDate, isMarketSessionTime } from '@/lib/marketSession';
import type { Underlying } from '@/lib/underlyings';
import { combineMonths, type FuturesMonth, type FuturesSeries } from '../options-scanner/futuresModel';
import { parseMarketFile, type ContractMarket } from '../options-scanner/contractScanModel';

/**
 * Order Flow feed — talks to tred backend `/api/order-flow/*` with JWT.
 */

const TOKEN_KEY = 'tred_auth_token';

function apiRoot(): string {
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const envBackend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const backend = isLocalHost
    ? envBackend && !envBackend.includes('hostingersite.com')
      ? envBackend
      : 'http://localhost:5001'
    : envBackend || 'https://violet-lark-104376.hostingersite.com';
  return `${backend}/api/order-flow`;
}

function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ofFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiRoot()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
}

export interface FeedStatus {
  provider: { id: string; label: string; alwaysLive: boolean };
  ready: boolean;
  session?: string;
  lastError: { message: string } | null;
}

let statusPromise: Promise<FeedStatus | null> | null = null;

export function feedStatus(): Promise<FeedStatus | null> {
  statusPromise ??= ofFetch('/status', { cache: 'no-store' })
    .then((r) => (r.ok || r.status === 503 ? r.json() : null))
    .catch(() => null);
  return statusPromise;
}

export function useFeedStatus(): FeedStatus | null {
  const [status, setStatus] = useState<FeedStatus | null>(null);
  useEffect(() => {
    let live = true;
    statusPromise = null;
    void feedStatus().then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return status;
}

const moving = (status: FeedStatus | null) =>
  Boolean(status?.provider.alwaysLive) || isMarketSessionTime(Date.now());
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

export async function fetchMarket(signal?: AbortSignal): Promise<ContractMarket | null> {
  const res = await ofFetch('/market', { cache: 'no-store', signal });
  if (!res.ok) {
    throw new Error(
      res.status === 503
        ? ((await res.json().catch(() => null))?.error ?? 'The market is still loading.')
        : `Market ${res.status}`,
    );
  }
  return parseMarketFile(await res.json());
}

export async function fetchMarketMinute(date: string, minute: string): Promise<ContractMarket | null> {
  const res = await ofFetch(`/market/${date}/${minute}`);
  return res.ok ? parseMarketFile(await res.json()) : null;
}

export interface FuturesBundleResponse {
  session: string;
  count: number;
  items: Record<string, { months: FuturesMonth[] }>;
}

export async function fetchFuturesBundle(session: string): Promise<FuturesBundleResponse | null> {
  try {
    const res = await ofFetch(`/futures-bundle?session=${session}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as FuturesBundleResponse;
  } catch {
    return null;
  }
}

export async function fetchFutures(symbol: string, session: string): Promise<FuturesSeries | null> {
  const res = await ofFetch(`/futures/${encodeURIComponent(symbol)}?session=${session}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Futures ${symbol}: ${res.status}`);
  const body = (await res.json()) as { months: FuturesMonth[] };
  return combineMonths(symbol, body.months ?? []);
}

export function useMarketFeed() {
  const status = useFeedStatus();
  const [market, setMarket] = useState<ContractMarket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const controller = new AbortController();
    fetchMarket(controller.signal)
      .then((next) => {
        if (!next) return;
        setError(null);
        const session = statusRef.current?.session ?? getLatestTradingSessionDate(new Date());
        // Keep an older session on screen while today's file is still building
        // (otherwise the board stays empty on "Loading the market…").
        if (next.date < session) {
          setMarket((current) => current ?? next);
          return;
        }
        setMarket((current) => (current && next.at <= current.at ? current : next));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(String(err?.message ?? err));
      });
    return () => controller.abort();
  }, [tick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!visible()) return;
      if (!market || moving(statusRef.current)) setTick((value) => value + 1);
    }, market ? 60_000 : 2_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((value) => value + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [market]);

  return { market, loading: !market, error, status, rescan: () => setTick((value) => value + 1) };
}

/** Keep live concurrency low — Kotak 429s when board + build + quotes compete. */
/** Keep live concurrency sensible so requests finish smoothly. */
const WORKERS_LIVE = 4;
const WORKERS_AFTER = 2;

/** Each underlying's futures: fill missing ones automatically; never wipe a good chart with an empty reply. */
export function useFuturesFeed(symbols: readonly string[], enabled: boolean, status: FeedStatus | null) {
  const [series, setSeries] = useState<ReadonlyMap<string, FuturesSeries | null>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState(0);
  const [tick, setTick] = useState(0);
  const session = status?.session ?? getLatestTradingSessionDate(new Date());
  const key = symbols.join(',');
  const statusRef = useRef(status);
  const seriesRef = useRef(series);
  statusRef.current = status;
  seriesRef.current = series;

  const loaded = useMemo(() => {
    let n = 0;
    for (const value of series.values()) if (value != null) n += 1;
    return n;
  }, [series]);

  useEffect(() => {
    if (!enabled) return undefined;
    const incomplete = loaded < symbols.length;
    // Auto-retry missing futures; ease off once the board is warm — avoid aggressive cancellation storms.
    const every = incomplete
      ? 20_000
      : statusRef.current?.provider.alwaysLive
        ? 60_000
        : 90_000;
    const timer = window.setInterval(() => {
      if (!visible()) return;
      if (moving(statusRef.current) || loaded < symbols.length) setTick((value) => value + 1);
    }, every);
    return () => window.clearInterval(timer);
  }, [enabled, status, loaded, symbols.length]);

  useEffect(() => {
    if (!enabled || !symbols.length) return undefined;
    let cancelled = false;
    const firstPass = tick === 0;

    const execute = async () => {
      // 1. Instant Bundle Hydration: Load all available futures in a single HTTP call
      if (firstPass) {
        setDone(0);
        try {
          const bundle = await fetchFuturesBundle(session);
          if (bundle?.items && !cancelled) {
            const next = new Map(seriesRef.current);
            let hydrated = 0;
            for (const sym of symbols) {
              const item = bundle.items[sym];
              if (item?.months?.length) {
                const s = combineMonths(sym, item.months);
                if (s?.candles?.length) {
                  next.set(sym, s);
                  hydrated += 1;
                }
              }
            }
            if (hydrated > 0 && !cancelled) {
              seriesRef.current = next;
              setSeries(next);
              setDone(hydrated);
            }
          }
        } catch {
          // Fall back gracefully to per-symbol requests
        }
      }

      if (cancelled) return;

      // 2. Queue only symbols that still have missing candles
      const queue = symbols.filter((symbol) => {
        const have = seriesRef.current.get(symbol);
        return !have || !have.candles?.length;
      });

      if (!queue.length) return;

      let cursor = 0;
      const read = async (symbol: string) => {
        let result: FuturesSeries | null = null;
        let ok = true;
        try {
          result = await fetchFutures(symbol, session);
        } catch {
          ok = false;
        }
        if (cancelled) return;
        const hasCandles = Boolean(result?.candles?.length);
        setSeries((current) => {
          const prev = current.get(symbol);
          if (!hasCandles && prev?.candles?.length) return current;
          if (!ok && prev?.candles?.length) return current;
          if (ok || firstPass) {
            const next = new Map(current);
            next.set(symbol, hasCandles ? result : prev ?? null);
            seriesRef.current = next;
            return next;
          }
          return current;
        });
        setFailed((current) => {
          const isFail = !ok || !hasCandles;
          if (isFail ? current.has(symbol) : !current.has(symbol)) return current;
          const next = new Set(current);
          if (isFail) next.add(symbol);
          else next.delete(symbol);
          return next;
        });
        if (firstPass) setDone((value) => value + 1);
      };

      const worker = async () => {
        while (cursor < queue.length && !cancelled) await read(queue[cursor++]);
      };
      const workers = moving(statusRef.current) ? WORKERS_LIVE : WORKERS_AFTER;
      await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, worker));
    };

    void execute();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, session, tick]);

  return {
    series,
    failed,
    read: Math.min(Math.max(done, loaded), symbols.length),
    total: symbols.length,
    session,
  };
}

export type { Underlying };
