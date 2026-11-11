import React from 'react';
import { Crown, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';

export default function MembershipBanner({ user, onOpenPricing, compact = false }) {
  const plans = useSelector((state) => state.content?.plans || []);
  const m = getMembership(user, plans);

  if (m.isPro && !compact) return null;

  if (m.isExpired) {
    return (
      <div className="rounded-2xl border border-rose-800/50 bg-rose-950/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-rose-200">Membership expired</div>
            <p className="text-[11px] text-rose-300/80 mt-0.5">{m.upgradeHint}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPricing}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-[11px] font-bold text-white hover:bg-rose-400 shrink-0"
        >
          Renew / Upgrade
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        m.isTrial
          ? 'border-amber-800/40 bg-amber-950/25'
          : 'border-cyan-800/40 bg-cyan-950/20'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {m.isTrial ? (
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Crown className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="text-xs font-bold text-white">
            Plan: <span className={m.isTrial ? 'text-amber-300' : 'text-cyan-300'}>{m.planName}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {m.maxStocksVisible} stocks · {m.timeframesAllowed.join(', ') || '—'} · Trade Log {m.maxJournalEntries}
            {m.upgradeHint ? ` · ${m.upgradeHint}` : ''}
          </p>
        </div>
      </div>
      {!m.isPro && (
        <button
          type="button"
          onClick={onOpenPricing}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-[11px] font-bold text-black hover:bg-amber-400 shrink-0"
        >
          Upgrade Plan
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
