import React, { useState } from 'react';
import { X, Check, Sparkles, Shield, Zap, Lock } from 'lucide-react';

export default function PricingModal({ onClose, user, onUpgradeSuccess }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCheckout = () => {
    setLoading(true);
    // Simulate Razorpay checkout transaction
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        if (onUpgradeSuccess) onUpgradeSuccess();
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl bg-slate-800/80 p-1.5 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Payment Successful!</h3>
            <p className="text-xs text-slate-400">
              Your 12-Month Institutional Pro Access is now activated.
            </p>
          </div>
        ) : (
          <div>
            <div className="text-center space-y-2">
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-950/80 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-800/60">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Special Promotional Bundle</span>
              </span>
              <h2 className="text-2xl font-extrabold text-white">
                Institutional Pro Terminal
              </h2>
              <p className="text-xs text-slate-400">
                Full unrestricted access to minute-by-minute Order Block rankings, Liquidity sweep alerts, and Trade Log.
              </p>
            </div>

            {/* Price Box */}
            <div className="my-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/30 to-slate-900/60 p-6 text-center">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                6 Months + 6 Months Free Bundle
              </div>
              <div className="mt-2 flex items-baseline justify-center space-x-2">
                <span className="text-slate-500 line-through text-lg">₹28,999</span>
                <span className="text-4xl font-extrabold text-white font-mono">₹7,999</span>
                <span className="text-xs text-slate-400">/ 12 Months</span>
              </div>
              <div className="mt-1 text-xs font-medium text-emerald-400 font-mono">
                Only ~₹22 / day (All-Inclusive)
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="space-y-2.5 text-xs text-slate-300">
              {[
                'Live 1-Minute Order Block & Liquidity Screener across 200+ F&O stocks',
                'Automatic Institutional Demand & Supply Zone pop-up charts',
                'Market X-Ray Macro Heatmap & Sector Flow indicator',
                'Built-in Trade Log with Expectancy & PnL analytics',
                'Desktop & Mobile responsive high-speed terminal',
                'Free Future Updates & Discord VIP Community'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center space-x-2.5">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-400">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold text-black hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <span>Processing Razorpay Checkout...</span>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-black" />
                  <span>Activate 12-Month Pro Access</span>
                </>
              )}
            </button>

            <div className="mt-3 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              <span>Secured by 256-bit Encrypted Checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
