import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { needsByokBrokerConnect } from '../lib/membership';

/** Guards trader-only pages (Terminal, X-Ray, Dashboard). */
export default function ProtectedRoute({ children, allowByokPending = false }) {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();

  if (!isAuthenticated) {
    const raw = `${location.pathname || '/'}${location.search || ''}`;
    // Only pass same-app relative paths into ?next=
    const safe =
      raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')
        ? raw
        : '/order-flow';
    return <Navigate to={`/login?next=${encodeURIComponent(safe)}`} replace />;
  }

  // Paid BYOK but broker keys missing → force connect page before terminal tools
  if (!allowByokPending && needsByokBrokerConnect(user)) {
    const planId = user?.subscription?.planId || '';
    const qs = new URLSearchParams({ connectBroker: '1' });
    if (planId) qs.set('planId', planId);
    return <Navigate to={`/checkout?${qs.toString()}`} replace />;
  }

  return children;
}
