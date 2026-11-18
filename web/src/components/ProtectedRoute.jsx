import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { byokConnectCheckoutPath, needsByokBrokerConnect } from '../lib/membership';

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

  // Paid BYOK but broker keys missing / token expired → force connect page
  if (!allowByokPending && needsByokBrokerConnect(user)) {
    return <Navigate to={byokConnectCheckoutPath(user)} replace />;
  }

  return children;
}
