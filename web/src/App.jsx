import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './Routes';
import SeoHead from './components/SeoHead';

export default function App() {
  return (
    <BrowserRouter>
      <SeoHead />
      <AppRoutes />
    </BrowserRouter>
  );
}
