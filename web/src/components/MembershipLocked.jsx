import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MembershipLocked({
  title = 'Membership required',
  message = 'Your current plan does not include this feature.',
  onOpenPricing
}) {
  const navigate = useNavigate();

  const handleOpenPlans = () => {
    if (typeof onOpenPricing === 'function') {
      onOpenPricing();
      return;
    }
    navigate('/pricing');
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 sm:p-14 text-center space-y-4 max-w-xl mx-auto my-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 text-amber-400">
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-extrabold text-white">{title}</h2>
      <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={handleOpenPlans}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-amber-500/20 hover:opacity-95"
      >
        View Membership Plans
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
