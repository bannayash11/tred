import { useEffect, useRef, useState } from 'react';
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
        if (next.date < (statusRef.current?.session ?? getLatestTradingSessionDate(new Date()))) return;
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
    }, market ? 60_000 : 5_000);
    return () => window.clearInterval(timer);
  }, [market]);

  return { market, loading: !market, error, status, rescan: () => setTick((value) => value + 1) };
}

const WORKERS = 6;

/** Each underlying's futures: read six at a time, and again every minute or two while the numbers move. (same as order-flow-main) */
export function useFuturesFeed(symbols: readonly string[], enabled: boolean, status: FeedStatus | null) {
  const [series, setSeries] = useState<ReadonlyMap<string, FuturesSeries | null>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState(0);
  const [tick, setTick] = useState(0);
  const session = status?.session ?? getLatestTradingSessionDate(new Date());
  const key = symbols.join(',');
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!enabled) return undefined;
    const every = statusRef.current?.provider.alwaysLive ? 60_000 : 120_000;
    const timer = window.setInterval(() => {
      if (visible() && moving(statusRef.current)) setTick((value) => value + 1);
    }, every);
    return () => window.clearInterval(timer);
  }, [enabled, status]);

  useEffect(() => {
    if (!enabled || !symbols.length) return undefined;
    let cancelled = false;
    let cursor = 0;
    if (tick === 0) setDone(0);
    const read = async (symbol: string) => {
      let result: FuturesSeries | null = null;
      let ok = true;
      try {
        result = await fetchFutures(symbol, session);
      } catch {
        ok = false;
      }
      if (cancelled) return;
      if (ok || tick === 0) setSeries((current) => new Map(current).set(symbol, result));
      setFailed((current) => {
        if (ok ? !current.has(symbol) : current.has(symbol)) return current;
        const next = new Set(current);
        if (ok) next.delete(symbol);
        else next.add(symbol);
        return next;
      });
      if (tick === 0) setDone((value) => value + 1);
    };
    const worker = async () => {
      while (cursor < symbols.length && !cancelled) await read(symbols[cursor++]);
    };
    void Promise.all(Array.from({ length: Math.min(WORKERS, symbols.length) }, worker));
    return () => {
      cancelled = true;
    };
  }, [key, enabled, session, tick]);

  return {
    series,
    failed,
    read: tick === 0 ? Math.min(done, symbols.length) : symbols.length,
    total: symbols.length,
    session,
  };
}

export type { Underlying };
