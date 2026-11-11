import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import HomePage from '../components/HomePage';

export default function Home(props) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const onSelectStock = props.onSelectStock || context.onSelectStock;
  const onOpenPricing = props.onOpenPricing || context.onOpenPricing || (() => navigate('/pricing'));

  const goTerminal = () => {
    if (isAuthenticated) navigate('/terminal');
    else navigate('/login?next=/terminal');
  };

  return (
    <HomePage
      onLaunchTerminal={goTerminal}
      onOpenPricing={onOpenPricing}
      onSelectStock={onSelectStock}
      screenerData={context.screenerData}
    />
  );
}
