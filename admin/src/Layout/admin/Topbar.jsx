import React from 'react';
import { RefreshCw, LogOut, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

const TITLES = {
  '/': 'Traders',
  '/traders': 'Traders',
  '/plans': 'Plans',
  '/payments': 'Payments',
  '/payments/history': 'Payment history',
  '/payments/settings': 'Payment settings',
  '/broker': 'Broker API',
  '/smtp': 'Email Templates',
  '/email-templates': 'Email Templates',
  '/social': 'Social Media',
  '/broadcast': 'Broadcast',
  '/monitor': 'Monitor',
  '/opening-momentum': '5M Momentum',
  '/seo': 'SEO',
  '/cms': 'CMS'
};

function resolveTitle(pathname) {
  if (pathname.startsWith('/traders/')) return 'Trader';
  if (pathname.startsWith('/plans/')) return 'Plan';
  return TITLES[pathname] || 'Admin';
}

export default function Topbar({ onOpenSidebar }) {
  const { adminUser, requestLogout, refreshData, loading } = useAdmin();
  const location = useLocation();
  const isSubAdmin = adminUser?.role === 'subadmin';
  const title = resolveTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-admin-border bg-admin-surface/95 px-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="admin-btn-secondary flex h-9 w-9 items-center justify-center p-0 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          <div className="hidden text-[11px] text-admin-muted sm:block">Tradrift admin console</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={refreshData}
          disabled={loading}
          className="admin-btn-secondary"
          title="Refresh data"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-admin-accent' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <span className="admin-chip hidden border-admin-border bg-admin-bg text-admin-muted sm:inline-flex">
          {isSubAdmin ? 'Sub-Admin' : 'Super Admin'}
        </span>

        <button type="button" onClick={requestLogout} className="admin-btn-secondary text-rose-300 hover:border-rose-700">
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
