import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Shield, Zap, TrendingUp, Users, Target, ArrowRight } from 'lucide-react';

export default function About() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-6">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 rounded-full bg-cyan-950 px-3.5 py-1 text-xs font-bold text-cyan-400 border border-cyan-800">
          <Shield className="h-3.5 w-3.5" />
          <span>About Tradrift</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Democratizing <span className="text-cyan-400">Institutional Edge</span> for Indian Retail Traders
        </h1>
        <p className="text-sm text-slate-400">
          We bridge the technological gap between high-frequency institutional desks and retail traders through algorithmic Smart Money Concepts (SMC).
        </p>
      </div>

      {/* Grid: 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Institutional Footprints</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Large institutions cannot hide their orders. Our proprietary mathematical engine detects accumulation and distribution zones before price rallies.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
            <Target className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Zero Noise, Pure Price Action</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Forget lagging moving averages and oversold indicators. We scan real-time order blocks, imbalances, and buy-side/sell-side liquidity sweeps.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Systematic Execution</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            With macro sector heatmaps, order-block scanners, and clear risk-to-reward context, traders can focus on consistent setups.
          </p>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-950 to-[#0a1224] p-8 sm:p-12 text-center space-y-6 shadow-2xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Ready to trade like smart money?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          Start scanning 200+ NSE F&O stocks with automated Order Block detection today.
        </p>
        <button
          onClick={() =>
            navigate(isAuthenticated ? '/terminal' : '/login?next=/terminal')
          }
          className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-xs font-bold text-black hover:opacity-95 shadow-lg shadow-cyan-500/20 inline-flex items-center space-x-2"
        >
          <span>{isAuthenticated ? 'Launch Live Screener Terminal' : 'Login to Launch Terminal'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

