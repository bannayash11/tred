import React from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import ChartModal from '../components/ChartModal';
import { createTrade } from '../services/api';

export default function Chart() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const sym = String(symbol || '').toUpperCase();

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/terminal');
  };

  const handleLogTrade = async (tradeEntry) => {
    if (context.onLogTrade) {
      await context.onLogTrade(tradeEntry);
      return;
    }
    try {
      await createTrade(tradeEntry);
    } catch (err) {
      console.error('Error logging trade from chart page:', err);
    }
  };

  if (!sym) {
    navigate('/terminal', { replace: true });
    return null;
  }

  return (
    <ChartModal
      symbol={sym}
      asPage
      onClose={handleClose}
      onLogTrade={handleLogTrade}
    />
  );
}
