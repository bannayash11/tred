import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ConfirmModal from '../../components/ConfirmModal';
import { Users, CreditCard, Radio, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export default function AdminLayout() {
  const { stats, toast, showLogoutConfirm, cancelLogout, logout } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex font-sans">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-semibold">Total Traders</span>
                <Users className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-white">{stats.totalUsers}</div>
              <div className="text-[10px] text-slate-500 hidden sm:block">Registered platform accounts</div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-semibold">Pro Active</span>
                <CreditCard className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">{stats.activeSubscribers}</div>
              <div className="text-[10px] text-slate-500 hidden sm:block">Paid 12-Month Pro users</div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-semibold">Trials</span>
                <Radio className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400">{stats.trialUsers}</div>
              <div className="text-[10px] text-slate-500 hidden sm:block">14-day free trials</div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-semibold">Est. MRR</span>
                <ShieldCheck className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-purple-400">
                ₹{stats.estimatedMRR.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 hidden sm:block">Recurring SaaS run-rate</div>
            </div>
          </div>

          <Outlet />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 rounded-2xl bg-amber-500 px-4 sm:px-5 py-3 text-xs font-bold text-black shadow-2xl shadow-amber-500/30">
          <span>{toast}</span>
        </div>
      )}

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out of Admin Console?"
        message="You will need to authenticate again to manage traders, plans, and content."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        danger
        onCancel={cancelLogout}
        onConfirm={logout}
      />
    </div>
  );
}
