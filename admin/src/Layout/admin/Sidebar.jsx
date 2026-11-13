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
  Settings2,
  Mail,
  Share2,
  X
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

const WEB_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://tradrift.in';

function SidebarPanel({ onClose, showClose }) {
  const { adminUser, usersList, plansList, seoPages, cmsPages, showToast, requestLogout } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';

  const linkClass = ({ isActive }) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-admin-accent/15 text-admin-accent'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const handleNav = () => {
    if (onClose) onClose();
  };

  return (
    <aside className="flex h-full w-64 max-w-[85vw] shrink-0 flex-col border-r border-admin-border bg-admin-surface">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-admin-border px-4 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/tradrift-logo.svg" alt="Tradrift" className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                Trad<span className="text-admin-accent">rift</span>
              </div>
              <div className="text-[11px] text-admin-muted">{isSubAdmin ? 'Sub-Admin' : 'Super Admin'}</div>
            </div>
          </div>
          {showClose && (
            <button type="button" onClick={onClose} className="admin-btn-ghost p-2" aria-label="Close sidebar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-admin-muted">
              Membership
            </div>
            <NavLink to="/traders" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Users className="h-4 w-4" />
                Traders
              </span>
              <span className="rounded bg-admin-bg px-1.5 py-0.5 text-[10px] text-admin-muted">
                {usersList.filter((u) => u.role !== 'admin' && u.role !== 'subadmin').length}
              </span>
            </NavLink>
            <NavLink to="/plans" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Sliders className="h-4 w-4" />
                Plans
              </span>
              <span className="rounded bg-admin-bg px-1.5 py-0.5 text-[10px] text-admin-muted">
                {plansList.length}
              </span>
            </NavLink>
            <NavLink to="/payments/history" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4" />
                Payment history
              </span>
            </NavLink>
            <NavLink to="/payments/settings" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Settings2 className="h-4 w-4" />
                Payment settings
              </span>
            </NavLink>
          </div>

          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-admin-muted">
              Content
            </div>
            <NavLink to="/seo" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Globe className="h-4 w-4" />
                SEO
              </span>
              <span className="rounded bg-admin-bg px-1.5 py-0.5 text-[10px] text-admin-muted">
                {seoPages.length}
              </span>
            </NavLink>
            <NavLink to="/cms" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <FileText className="h-4 w-4" />
                CMS
              </span>
              <span className="rounded bg-admin-bg px-1.5 py-0.5 text-[10px] text-admin-muted">
                {cmsPages.length}
              </span>
            </NavLink>
            <NavLink
              to="/social"
              onClick={(e) => {
                if (isSubAdmin) {
                  e.preventDefault();
                  showToast('Social Media is Super Admin only.');
                  return;
                }
                handleNav();
              }}
              className={linkClass}
            >
              <span className="flex items-center gap-2.5">
                <Share2 className="h-4 w-4" />
                Social Media
              </span>
            </NavLink>
          </div>

          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-admin-muted">
              System
            </div>
            <NavLink
              to="/broker"
              onClick={(e) => {
                if (isSubAdmin) {
                  e.preventDefault();
                  showToast('Broker API is Super Admin only.');
                  return;
                }
                handleNav();
              }}
              className={linkClass}
            >
              <span className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4" />
                Broker API
              </span>
              {isSubAdmin && (
                <span className="admin-chip border-rose-800/50 bg-rose-950/50 text-rose-300">Locked</span>
              )}
            </NavLink>
            <NavLink
              to="/email-templates"
              onClick={(e) => {
                if (isSubAdmin) {
                  e.preventDefault();
                  showToast('Email Templates are Super Admin only.');
                  return;
                }
                handleNav();
              }}
              className={linkClass}
            >
              <span className="flex items-center gap-2.5">
                <Mail className="h-4 w-4" />
                Email Templates
              </span>
              {isSubAdmin && (
                <span className="admin-chip border-rose-800/50 bg-rose-950/50 text-rose-300">Locked</span>
              )}
            </NavLink>
            <NavLink to="/broadcast" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Megaphone className="h-4 w-4" />
                Broadcast
              </span>
            </NavLink>
            <NavLink to="/monitor" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Activity className="h-4 w-4" />
                Monitor
              </span>
            </NavLink>
            <NavLink to="/opening-momentum" onClick={handleNav} className={linkClass}>
              <span className="flex items-center gap-2.5">
                <Zap className="h-4 w-4" />
                5M Momentum
              </span>
            </NavLink>
          </div>
        </nav>
      </div>

      <div className="space-y-3 border-t border-admin-border bg-admin-bg/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-admin-accent/15 text-xs font-semibold text-admin-accent">
              {adminUser?.name ? adminUser.name.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="min-w-0 truncate">
              <div className="truncate text-xs font-semibold text-white">
                {adminUser?.name || 'Administrator'}
              </div>
              <div className="truncate text-[11px] text-admin-muted">{adminUser?.email || ''}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={requestLogout}
            title="Sign Out"
            className="admin-btn-ghost p-1.5 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <a
          href={WEB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-lg border border-admin-border bg-admin-surface2 px-3 py-2 text-xs font-medium text-slate-300 hover:border-admin-accent/40 hover:text-admin-accent"
        >
          <span>Open website</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      <div className="sticky top-0 z-30 hidden h-screen lg:flex">
        <SidebarPanel />
      </div>

      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] lg:hidden" role="dialog" aria-modal="true">
            <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={onClose} />
            <div className="absolute bottom-0 left-0 top-0 h-full shadow-2xl">
              <SidebarPanel onClose={onClose} showClose />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
