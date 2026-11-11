import React from 'react';
import { RefreshCw, LogOut, Menu } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export default function Topbar({ onOpenSidebar }) {
  const { adminUser, requestLogout, refreshData, loading } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';

  return (
    <header className="h-14 sm:h-16 border-b border-slate-800/80 bg-[#0a0f1d]/95 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 rounded-full bg-slate-900 px-2.5 sm:px-3 py-1 border border-slate-800 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-slate-300 font-mono text-[10px] sm:text-[11px] truncate">
            <span className="sm:hidden">API Online</span>
            <span className="hidden sm:inline">Backend API Online (5001)</span>
          </span>
        </div>

        <button
          type="button"
          onClick={refreshData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900/80 px-2 sm:px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-white border border-slate-800/80 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <span
          className={`rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold border truncate max-w-[9rem] sm:max-w-none ${
            isSubAdmin
              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
              : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
          }`}
        >
          <span className="sm:hidden">{isSubAdmin ? 'Sub-Admin' : 'Admin'}</span>
          <span className="hidden sm:inline">{isSubAdmin ? 'Sub-Admin Operator' : 'Super Administrator'}</span>
        </span>

        <button
          type="button"
          onClick={requestLogout}
          className="flex items-center gap-1.5 rounded-xl bg-rose-950/40 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-800/50 hover:bg-rose-900/60"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
