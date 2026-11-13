import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Megaphone,
  KeyRound,
  Sliders,
  LogOut,
  ExternalLink,
  Activity,
  Globe,
  FileText,
  Zap,
  CreditCard,
  X
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

function SidebarPanel({ onClose, showClose }) {
  const { adminUser, usersList, plansList, seoPages, cmsPages, showToast, requestLogout } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';

  const linkClass = ({ isActive }) =>
    `flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
      isActive
        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-bold'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
    }`;

  const handleNav = () => {
    if (onClose) onClose();
  };

  return (
    <aside className="w-72 max-w-[85vw] border-r border-slate-800/80 bg-[#0a0f1d] flex flex-col justify-between h-full shrink-0">
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-slate-800/80">
          <div className="flex items-center space-x-3 min-w-0">
            <img
              src="/brand/tradrift-logo.svg"
              alt="Tradrift"
              className="h-10 w-10 rounded-xl shadow-md shadow-amber-500/20 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight text-white truncate">
                Trad<span className="text-amber-400">rift</span>
              </div>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                  isSubAdmin
                    ? 'bg-purple-950/80 text-purple-400 border-purple-800/60'
                    : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                }`}
              >
                {isSubAdmin ? 'SUB-ADMIN' : 'SUPER ADMIN'}
              </span>
            </div>
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:text-white shrink-0"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-3 sm:p-4 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Users & Membership
            </div>
            <NavLink to="/traders" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Users className="h-4 w-4" />
                <span>Traders</span>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{usersList.length}</span>
            </NavLink>
            <NavLink to="/plans" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Sliders className="h-4 w-4" />
                <span>Plans Manager</span>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{plansList.length}</span>
            </NavLink>
            <NavLink to="/payments" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <CreditCard className="h-4 w-4" />
                <span>Payments</span>
              </div>
            </NavLink>
          </div>

          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Site</div>
            <NavLink to="/seo" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Globe className="h-4 w-4" />
                <span>SEO Manager</span>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{seoPages.length}</span>
            </NavLink>
            <NavLink to="/cms" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <FileText className="h-4 w-4" />
                <span>CMS Pages</span>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{cmsPages.length}</span>
            </NavLink>
          </div>

          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">System</div>
            <NavLink
              to="/broker"
              onClick={(e) => {
                if (isSubAdmin) {
                  e.preventDefault();
                  showToast('⚠️ Broker API credentials are restricted to Super Admin only.');
                  return;
                }
                handleNav();
              }}
              className={linkClass}
            >
              <div className="flex items-center space-x-2.5">
                <KeyRound className="h-4 w-4" />
                <span>Broker API</span>
              </div>
              {isSubAdmin && (
                <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-800/50">
                  LOCKED
                </span>
              )}
            </NavLink>
            <NavLink to="/broadcast" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Megaphone className="h-4 w-4" />
                <span>Broadcast</span>
              </div>
            </NavLink>
            <NavLink to="/monitor" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Activity className="h-4 w-4" />
                <span>SMC Monitor</span>
              </div>
            </NavLink>
            <NavLink to="/opening-momentum" onClick={handleNav} className={linkClass}>
              <div className="flex items-center space-x-2.5">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>5M Momentum</span>
              </div>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                LIVE
              </span>
            </NavLink>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 overflow-hidden min-w-0">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                isSubAdmin ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-amber-500 text-black'
              }`}
            >
              {adminUser?.name ? adminUser.name.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="truncate min-w-0">
              <div className="text-xs font-bold text-white truncate">{adminUser?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400 truncate">{adminUser?.email || 'Admin'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={requestLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:text-cyan-400 border border-slate-800"
        >
          <span>Open Web Terminal</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      <div className="hidden lg:flex h-screen sticky top-0 z-30">
        <SidebarPanel />
      </div>

      {mobileOpen &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/75"
              aria-label="Close menu"
              onClick={onClose}
            />
            <div className="absolute left-0 top-0 bottom-0 h-full shadow-2xl">
              <SidebarPanel onClose={onClose} showClose />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
