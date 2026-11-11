import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import AdminRoutes from './Routes';

export default function App() {
  return (
    <BrowserRouter>
      <AdminProvider>
        <AdminRoutes />
      </AdminProvider>
    </BrowserRouter>
  );
}
