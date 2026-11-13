import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/** Guards trader-only pages (Terminal, X-Ray, Dashboard). */
export default function ProtectedRoute({ children }) {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
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

  return children;
}
