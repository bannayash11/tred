import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import TradingJournalView from '../components/TradingJournalView';

export default function TradingJournal() {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const authUser = useSelector((state) => state.auth.user);
  const user = context.user || authUser;
  const onOpenPricing = context.onOpenPricing || (() => navigate('/pricing'));

  return <TradingJournalView user={user} onOpenPricing={onOpenPricing} />;
}

