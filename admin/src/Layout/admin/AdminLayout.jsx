import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ConfirmModal from '../../components/ConfirmModal';
import { useAdmin } from '../../context/AdminContext';

export default function AdminLayout() {
  const { toast, showLogoutConfirm, cancelLogout, logout } = useAdmin();
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
    <div className="flex min-h-screen bg-admin-bg font-sans text-slate-100">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-admin-accent px-4 py-3 text-sm font-semibold text-[#06221f] shadow-xl sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm">
          {toast}
        </div>
      )}

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out?"
        message="You will need to sign in again to manage the admin console."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        danger
        onCancel={cancelLogout}
        onConfirm={logout}
      />
    </div>
  );
}
