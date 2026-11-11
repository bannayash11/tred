import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, ArrowRight, Lock } from 'lucide-react';
import { upgradeSubscription } from '../store/slices/authSlice';
import { setPlans } from '../store/slices/contentSlice';
import { fetchPublicPlans } from '../services/api';

export default function Pricing() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const currentPlan = useSelector((state) => state.auth.user?.subscription?.plan || '');
  const currentPlanId = useSelector((state) => state.auth.user?.subscription?.planId || '');
  const plansFromStore = useSelector((state) => state.content?.plans || []);

  const [plans, setLocalPlans] = useState(plansFromStore);
  const [loading, setLoading] = useState(!plansFromStore.length);
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicPlans()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.plans) {
          setLocalPlans(res.plans);
          dispatch(setPlans(res.plans));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const goTerminal = () => {
    if (isAuthenticated) navigate('/terminal');
    else navigate('/login?next=/terminal');
  };

  const handleUpgrade = (plan) => {
    if (!isAuthenticated) {
      navigate('/register?next=/pricing');
      return;
    }
    dispatch(
      upgradeSubscription({
        plan: plan.name,
        planId: plan.id,
        id: plan.id,
        durationDays: plan.durationDays,
        durationMonths: plan.durationMonths
      })
    );
    setUpgraded(true);
    setTimeout(() => navigate('/terminal'), 1200);
  };

  const displayPlans = (plans.length ? plans : plansFromStore).filter((p) => p.enabled !== false);

  return (
    <div className="space-y-12 py-6">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/30">
          <Sparkles className="h-4 w-4" />
          <span>Admin-managed membership plans</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Choose your <span className="text-cyan-400">membership</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400">
          1, 3, 6 or 12 month access — price and included data are set by the OrderBlock admin team.
        </p>

        {upgraded && (
          <div className="rounded-2xl bg-emerald-950/90 border border-emerald-800 p-4 text-emerald-300 font-bold text-sm shadow-xl">
            Membership activated! Opening Terminal…
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center text-sm text-slate-500 py-10">Loading membership plans…</div>
      )}

      {!loading && displayPlans.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500 max-w-xl mx-auto">
          No membership plans are enabled yet. Please check back soon.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
        {displayPlans.map((plan) => {
          const isCurrent =
            currentPlanId === plan.id ||
            String(currentPlan).toLowerCase() === String(plan.name).toLowerCase();
          const tfs = plan.timeframesAllowed || String(plan.timeframes || '').split(',').map((t) => t.trim());
          const months = plan.durationMonths || Math.round((plan.durationDays || 30) / 30);

          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
                plan.featured
                  ? 'border-cyan-500 bg-gradient-to-b from-slate-900 via-slate-950 to-[#070b14] shadow-xl shadow-cyan-500/15 scale-[1.02]'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">
                    {plan.badge || `${months} Mo`}
                  </span>
                  {plan.featured && (
                    <span className="text-[10px] font-bold text-amber-400">FEATURED</span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-extrabold text-white font-mono">
                    ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400">/ {months} month{months > 1 ? 's' : ''}</span>
                </div>
                {plan.description && <p className="text-xs text-slate-400">{plan.description}</p>}

                <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Up to {plan.maxStocks} F&O stocks</span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Timeframes: {tfs.join(', ') || '—'}</span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      Trade Log:{' '}
                      {(plan.maxTradeLog ?? plan.maxJournal) > 500
                        ? 'Unlimited'
                        : `${plan.maxTradeLog ?? plan.maxJournal} entries`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    {plan.allowTerminal !== false ? (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-600 shrink-0" />
                    )}
                    <span className={plan.allowTerminal === false ? 'text-slate-500' : ''}>
                      Live Terminal
                    </span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    {plan.allowMarketXRay !== false ? (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-600 shrink-0" />
                    )}
                    <span className={plan.allowMarketXRay === false ? 'text-slate-500' : ''}>
                      Market X-Ray
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => (isCurrent ? goTerminal() : handleUpgrade(plan))}
                className={`w-full rounded-2xl py-3 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  plan.featured
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:opacity-95'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {isCurrent ? 'Open Terminal' : isAuthenticated ? 'Activate Plan' : 'Sign Up & Activate'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
