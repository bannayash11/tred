import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import AdminLayout from '../Layout/admin/AdminLayout';
import Traders from '../Pages/Traders';
import Plans from '../Pages/Plans';
import BrokerApi from '../Pages/BrokerApi';
import Broadcast from '../Pages/Broadcast';
import LiveMonitor from '../Pages/LiveMonitor';
import OpeningMomentumAdmin from '../Pages/OpeningMomentumAdmin';
import SeoManager from '../Pages/SeoManager';
import CmsPages from '../Pages/CmsPages';
import AdminPayments from '../Pages/AdminPayments';
import AdminLoginView from '../components/AdminLoginView';
import { useAdmin } from '../context/AdminContext';

export default function AdminRoutes() {
  const { adminUser, login, sessionChecked } = useAdmin();

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-sm">
        Verifying admin session...
      </div>
    );
  }

  if (!adminUser) {
    return (
      <AdminLoginView
        onLoginSuccess={(user, token) => {
          login(user, token || localStorage.getItem('tred_admin_token'));
        }}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Traders />} />
        <Route path="traders" element={<Traders />} />
        <Route path="plans" element={<Plans />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="broker" element={<BrokerApi />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="monitor" element={<LiveMonitor />} />
        <Route path="opening-momentum" element={<OpeningMomentumAdmin />} />
        <Route path="seo" element={<SeoManager />} />
        <Route path="cms" element={<CmsPages />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
