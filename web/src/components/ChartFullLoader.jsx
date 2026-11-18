import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-viewport chart loader (separate from Terminal / page spinners).
 * Platform membership: never show which broker (Kotak/Fyers/Upstox).
 */
export default function ChartFullLoader({
  symbol,
  timeframe = '5m',
  rangeKey = '5D',
  feedLabel = null
}) {
  if (typeof document === 'undefined') return null;

  const source = feedLabel || 'Loading live chart';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05080f]/92 backdrop-blur-xl"
      role="status"
      aria-live="polite"
      aria-label="Loading chart"
    >
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-b from-[#121a2a] via-[#0c1220] to-[#080c16] px-7 py-8 shadow-2xl shadow-amber-950/40">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center">
            <span className="absolute h-14 w-14 animate-[spin_1.4s_linear_infinite] rounded-full border-2 border-amber-400/20 border-t-amber-400" />
            <span className="absolute h-9 w-9 animate-[spin_1s_linear_infinite_reverse] rounded-full border-2 border-cyan-400/25 border-b-cyan-400" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Chart feed
          </p>
          <h3 className="mt-2 text-lg font-extrabold tracking-tight text-white">
            {symbol || 'Loading'}
          </h3>
          <p className="mt-1.5 text-xs text-slate-400">
            {String(timeframe || '').toUpperCase()} · {rangeKey} · fetching candles
          </p>

          <div className="mt-5 flex w-full items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/2 animate-[chartLoadSweep_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-500 via-cyan-400 to-amber-500" />
            </div>
          </div>

          <p className="mt-4 text-[10px] font-medium text-slate-500">{source}</p>
        </div>
      </div>

      <style>{`
        @keyframes chartLoadSweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>,
    document.body
  );
}
