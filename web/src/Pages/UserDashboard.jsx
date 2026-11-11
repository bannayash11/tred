import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserDashboardView from '../components/UserDashboardView';

export default function UserDashboard({ onOpenPricing }) {
  const navigate = useNavigate();

  return (
    <UserDashboardView
      onOpenPricing={onOpenPricing ? onOpenPricing : () => navigate('/pricing')}
    />
  );
}

