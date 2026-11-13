import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import AdminLayout from '../Layout/admin/AdminLayout';
import Traders from '../Pages/Traders';
import TraderForm from '../Pages/TraderForm';
import Plans from '../Pages/Plans';
import PlanForm from '../Pages/PlanForm';
import BrokerApi from '../Pages/BrokerApi';
import Broadcast from '../Pages/Broadcast';
import LiveMonitor from '../Pages/LiveMonitor';
import OpeningMomentumAdmin from '../Pages/OpeningMomentumAdmin';
import SeoManager from '../Pages/SeoManager';
import CmsPages from '../Pages/CmsPages';
import PaymentSettings from '../Pages/PaymentSettings';
import PaymentHistory from '../Pages/PaymentHistory';
import EmailTemplates from '../Pages/EmailTemplates';
import SocialMedia from '../Pages/SocialMedia';
import AdminLoginView from '../components/AdminLoginView';
import { useAdmin } from '../context/AdminContext';

export default function AdminRoutes() {
  const { adminUser, login, sessionChecked } = useAdmin();

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg text-sm text-admin-muted">
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
        <Route path="traders/new" element={<TraderForm />} />
        <Route path="traders/:id/edit" element={<TraderForm />} />
        <Route path="plans" element={<Plans />} />
        <Route path="plans/new" element={<PlanForm />} />
        <Route path="plans/:id/edit" element={<PlanForm />} />
        <Route path="payments/history" element={<PaymentHistory />} />
        <Route path="payments/settings" element={<PaymentSettings />} />
        <Route path="payments" element={<Navigate to="/payments/history" replace />} />
        <Route path="broker" element={<BrokerApi />} />
        <Route path="email-templates" element={<EmailTemplates />} />
        <Route path="smtp" element={<Navigate to="/email-templates" replace />} />
        <Route path="social" element={<SocialMedia />} />
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
