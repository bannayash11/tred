import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchOrderFlowFutures,
  fetchOrderFlowMarket,
  fetchOrderFlowStatus
} from './feed';
import { buildFlowRows } from './flowModel';
import { BUILD_LABELS } from './futuresModel';
import './order-flow.css';

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtOi(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  return n.toLocaleString('en-IN');
}

function Card({ row }) {
  const up = (row.changePct || 0) >= 0;
  const build = row.buildUp;
  const buildClass =
    build === 'LONG_BUILD' || build === 'SHORT_COVER'
      ? 'is-long'
      : build === 'SHORT_BUILD' || build === 'LONG_UNWIND'
        ? 'is-short'
        : '';

  return (
    <article className="of-card">
      <div>
        <div className="of-card__sym">{row.symbol}</div>
        <div className="of-card__meta">
          ₹{Number(row.spot).toLocaleString('en-IN', { maximumFractionDigits: 2 })} · {row.expiry}
          {row.source ? ` · via ${row.source}` : ''}
        </div>
      </div>
      <div className={`of-card__move ${up ? 'is-up' : 'is-down'}`}>{fmtPct(row.changePct)}</div>
      <div className="of-card__build">
        {build && <span className={`of-chip ${buildClass}`}>{BUILD_LABELS[build] || build}</span>}
        {row.oiChangePct != null && (
          <span className="of-chip">Fut OI {fmtPct(row.oiChangePct)}</span>
        )}
        {row.options?.support && (
          <span className="of-chip">Sup {row.options.support.strike} ({fmtOi(row.options.support.oi)})</span>
        )}
        {row.options?.resistance && (
          <span className="of-chip">Res {row.options.resistance.strike} ({fmtOi(row.options.resistance.oi)})</span>
        )}
        {row.options?.pcr != null && <span className="of-chip">PCR {row.options.pcr.toFixed(2)}</span>}
      </div>
    </article>
  );
}

function Column({ title, rows, tone }) {
  return (
    <section className={`of-col of-col--${tone}`}>
      <header className="of-col__head">
        <span>{title}</span>
        <span>{rows.length}</span>
      </header>
      <div className="of-col__body">
        {rows.length === 0 ? (
          <div className="of-empty">No names on this side yet.</div>
        ) : (
          rows.map((row) => <Card key={row.symbol} row={row} />)
        )}
      </div>
    </section>
  );
}

export default function OrderFlowBoard() {
  const [status, setStatus] = useState(null);
  const [market, setMarket] = useState(null);
  const [futuresMap, setFuturesMap] = useState(() => new Map());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [futuresDone, setFuturesDone] = useState(0);
  const [tick, setTick] = useState(0);

  const loadMarket = useCallback(async () => {
    try {
      const [st, mkt] = await Promise.all([fetchOrderFlowStatus(), fetchOrderFlowMarket()]);
      setStatus(st);
      setMarket(mkt);
      setError(null);
    } catch (err) {
      const msg =
        err?.userMessage ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to load Order Flow.';
      setError(msg);
      if (err?.response?.data?.provider) setStatus(err.response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!market?.series?.length || !status?.session) return undefined;
    let cancelled = false;
    const symbols = market.series.map((s) => s.symbol);
    setFuturesDone(0);
    setFuturesMap(new Map());

    const run = async () => {
      const next = new Map();
      let cursor = 0;
      const workers = Array.from({ length: Math.min(4, symbols.length) }, async () => {
        while (cursor < symbols.length && !cancelled) {
          const symbol = symbols[cursor++];
          try {
            const series = await fetchOrderFlowFutures(symbol, status.session);
            if (!cancelled) next.set(symbol, series);
          } catch {
            if (!cancelled) next.set(symbol, null);
          }
          if (!cancelled) {
            setFuturesDone((n) => n + 1);
            setFuturesMap(new Map(next));
          }
        }
      });
      await Promise.all(workers);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [market?.at, status?.session, market?.series]);

  const flow = useMemo(() => buildFlowRows(market, futuresMap), [market, futuresMap]);

  const stamp = market?.at
    ? new Date(market.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="of-page">
      <div className="of-page__head">
        <div>
          <h1 className="of-page__title">
            Order <em>Flow</em>
          </h1>
          <p className="of-page__sub">
            Futures direction + option OI walls · live from Kotak Neo
          </p>
        </div>
        <div className="of-status">
          <span className="of-status__pill">
            <span
              className={`of-status__dot ${error ? 'is-err' : status?.ready ? 'is-live' : ''}`}
              aria-hidden
            />
            {status?.provider?.label || 'Kotak Neo'}
          </span>
          {status?.session && <span className="of-status__pill">Session {status.session}</span>}
          {stamp && <span className="of-status__pill">As of {stamp} IST</span>}
          <span className="of-status__pill">
            Futures {Math.min(futuresDone, market?.series?.length || 0)}/{market?.series?.length || 0}
          </span>
          <button type="button" className="of-btn" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="of-error">{error}</div>}

      {loading && !market ? (
        <div className="of-empty">Loading market file from Kotak…</div>
      ) : (
        <>
          <div className="of-grid">
            <Column title="Bullish" rows={flow.bullish} tone="bull" />
            <Column title="Bearish" rows={flow.bearish} tone="bear" />
          </div>

          {(flow.rangebound.length > 0 || flow.pending.length > 0) && (
            <div className="of-range">
              <p className="of-range__title">
                Rangebound / pending ({flow.rangebound.length + flow.pending.length})
              </p>
              <div className="of-range__list">
                {[...flow.rangebound, ...flow.pending].map((row) => (
                  <span key={row.symbol} className="of-range__item">
                    {row.symbol} {fmtPct(row.changePct)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
