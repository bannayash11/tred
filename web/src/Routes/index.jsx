import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../Layout/public/PublicLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import Home from '../Pages/Home';
import Terminal from '../Pages/Terminal';
import OpeningMomentum from '../Pages/OpeningMomentum';
import DirectionalScanner from '../Pages/DirectionalScanner';
import AlphaMove2 from '../Pages/AlphaMove2';
import MarketXRay from '../Pages/MarketXRay';
import UserDashboard from '../Pages/UserDashboard';
import Pricing from '../Pages/Pricing';
import MembershipCheckout from '../Pages/MembershipCheckout';
import About from '../Pages/About';
import Contact from '../Pages/Contact';
import Login from '../Pages/Login';
import CmsPage from '../Pages/CmsPage';
import Chart from '../Pages/Chart';
import OrderFlow from '../Pages/OrderFlow';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login mode="login" />} />
      <Route path="register" element={<Login mode="register" />} />

      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route
          path="terminal"
          element={
            <ProtectedRoute>
              <Terminal />
            </ProtectedRoute>
          }
        />
        <Route
          path="order-flow"
          element={
            <ProtectedRoute>
              <OrderFlow />
            </ProtectedRoute>
          }
        />
        <Route
          path="momentum"
          element={
            <ProtectedRoute>
              <OpeningMomentum />
            </ProtectedRoute>
          }
        />
        <Route
          path="opening-momentum"
          element={
            <ProtectedRoute>
              <OpeningMomentum />
            </ProtectedRoute>
          }
        />
        <Route
          path="alpha-move"
          element={
            <ProtectedRoute>
              <DirectionalScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="directional"
          element={
            <ProtectedRoute>
              <DirectionalScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="alpha-move-2"
          element={
            <ProtectedRoute>
              <AlphaMove2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="chart/:symbol"
          element={
            <ProtectedRoute>
              <Chart />
            </ProtectedRoute>
          }
        />
        <Route
          path="xray"
          element={
            <ProtectedRoute>
              <MarketXRay />
            </ProtectedRoute>
          }
        />
        <Route
          path="market-xray"
          element={
            <ProtectedRoute>
              <MarketXRay />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="pricing" element={<Pricing />} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <MembershipCheckout />
            </ProtectedRoute>
          }
        />
        <Route path="about" element={<About />} />
        <Route path="about-us" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy-policy" element={<CmsPage slug="privacy-policy" />} />
        <Route path="privacy" element={<CmsPage slug="privacy-policy" />} />
        <Route path="terms" element={<CmsPage slug="terms-and-conditions" />} />
        <Route path="terms-and-conditions" element={<CmsPage slug="terms-and-conditions" />} />
        <Route path="faq" element={<CmsPage slug="faq" />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
