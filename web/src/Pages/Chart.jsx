import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChartModal from '../components/ChartModal';
import { parseChartSymbolParam } from '../lib/chartRoutes';

export default function Chart() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const sym = parseChartSymbolParam(symbol);

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/terminal');
  };

  if (!sym) {
    navigate('/terminal', { replace: true });
    return null;
  }

  return <ChartModal symbol={sym} asPage onClose={handleClose} />;
}
