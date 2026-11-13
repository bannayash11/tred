import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, ArrowRight, Lock, KeyRound, Server } from 'lucide-react';
import { setPlans } from '../store/slices/contentSlice';
import { fetchPublicPlans } from '../services/api';

/**
 * Step 1: Choose membership plan → navigate to /checkout?planId=...
 * Payment + details happen on MembershipCheckout page.
 */
export default function Pricing() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const currentPlan = useSelector((state) => state.auth.user?.subscription?.plan || '');
  const currentPlanId = useSelector((state) => state.auth.user?.subscription?.planId || '');
  const currentMode = useSelector((state) => state.auth.user?.subscription?.mode || '');
  const plansFromStore = useSelector((state) => state.content?.plans || []);

  const [plans, setLocalPlans] = useState(plansFromStore);
  const [byokSalesEnabled, setByokSalesEnabled] = useState(true);
  const [modeTab, setModeTab] = useState('byok');
  const [loading, setLoading] = useState(!plansFromStore.length);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    fetchPublicPlans()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.plans) {
          setLocalPlans(res.plans);
          dispatch(setPlans(res.plans));
          if (typeof res.byokSalesEnabled === 'boolean') {
            setByokSalesEnabled(res.byokSalesEnabled);
            if (!res.byokSalesEnabled) setModeTab('server');
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.userMessage || 'Could not load membership plans.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const allPlans = plans.length ? plans : plansFromStore;
  const displayPlans = useMemo(() => {
    return allPlans
      .filter((p) => p.enabled !== false)
      .filter((p) => {
        const mode = p.mode === 'byok' ? 'byok' : 'server';
        return mode === modeTab;
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [allPlans, modeTab]);

  const goTerminal = () => {
    if (isAuthenticated) navigate('/terminal');
    else navigate('/login?next=/terminal');
  };

  /** Step 1 only: select plan → details/checkout page */
  const handleSelectPlan = (plan) => {
    if (!isAuthenticated) {
      navigate(`/register?next=${encodeURIComponent(`/checkout?planId=${plan.id}`)}`);
      return;
    }
    navigate(`/checkout?planId=${plan.id}`);
  };

  return (
    <div className="space-y-10 py-6">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/30">
          <Sparkles className="h-4 w-4" />
          <span>Step 1 of 3 · Choose a plan</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Choose your <span className="text-cyan-400">membership</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400">
          Select a plan first. Next you&apos;ll confirm details, then pay securely with UPI or card.
        </p>

        <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1 gap-1">
          <button
            type="button"
            disabled={!byokSalesEnabled}
            onClick={() => setModeTab('byok')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              modeTab === 'byok' ? 'bg-violet-500 text-black' : 'text-slate-400 hover:text-white'
            } ${!byokSalesEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Your API · from ₹250
            {!byokSalesEnabled && <span className="text-[9px] ml-1">(off)</span>}
          </button>
          <button
            type="button"
            onClick={() => setModeTab('server')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              modeTab === 'server' ? 'bg-cyan-400 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Platform Feed · from ₹350
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-slate-500 py-10">Loading membership plans…</div>
      )}

      {!loading && loadError && (
        <div className="rounded-3xl border border-rose-800/70 bg-rose-950/40 p-10 text-center text-sm text-rose-300 max-w-xl mx-auto">
          {loadError}
        </div>
      )}

      {!loading && !loadError && displayPlans.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500 max-w-xl mx-auto">
          {modeTab === 'byok' && !byokSalesEnabled
            ? 'Your API plans are currently disabled. Choose Platform Feed.'
            : 'No membership plans are enabled for this mode yet.'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
        {displayPlans.map((plan) => {
          const isCurrent =
            currentPlanId === plan.id ||
            (String(currentPlan).toLowerCase() === String(plan.name).toLowerCase() &&
              (currentMode === plan.mode || !currentMode));
          const tfs =
            plan.timeframesAllowed ||
            String(plan.timeframes || '')
              .split(',')
              .map((t) => t.trim());
          const months = plan.durationMonths || Math.round((plan.durationDays || 30) / 30);
          const isByok = plan.mode === 'byok';

          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
                plan.featured
                  ? isByok
                    ? 'border-violet-500 bg-gradient-to-b from-slate-900 via-slate-950 to-[#0c0618] shadow-xl shadow-violet-500/15 scale-[1.02]'
                    : 'border-cyan-500 bg-gradient-to-b from-slate-900 via-slate-950 to-[#070b14] shadow-xl shadow-cyan-500/15 scale-[1.02]'
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
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {Number(plan.originalPrice) > Number(plan.price) && (
                      <span className="text-base text-slate-500 line-through font-mono">
                        ₹{Number(plan.originalPrice).toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-3xl font-extrabold text-white font-mono">
                      ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {months} month{months > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {plan.description && <p className="text-xs text-slate-400">{plan.description}</p>}

                <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      {isByok ? 'Data from your broker API' : 'Data from Tradrift platform feed'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Up to {plan.maxStocks} F&O stocks</span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Timeframes: {tfs.join(', ') || '—'}</span>
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
                </div>
              </div>

              <button
                type="button"
                onClick={() => (isCurrent ? goTerminal() : handleSelectPlan(plan))}
                className={`w-full rounded-2xl py-3 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  plan.featured
                    ? isByok
                      ? 'bg-gradient-to-r from-violet-400 to-cyan-400 text-black hover:opacity-95'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:opacity-95'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {isCurrent
                  ? 'Open Terminal'
                  : isAuthenticated
                    ? 'Continue to details'
                    : 'Sign up to continue'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
