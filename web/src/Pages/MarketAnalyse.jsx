import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MarketAnalyseView from '../components/MarketAnalyseView';
import MembershipBanner from '../components/MembershipBanner';
import MembershipLocked from '../components/MembershipLocked';
import { fetchMarketAnalyse } from '../services/api';
import { getMembership } from '../lib/membership';
import { chartPath } from '../lib/chartRoutes';

export default function MarketAnalyse(props) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const user = props.user || context.user || authUser;
  const onOpenPricing = props.onOpenPricing || context.onOpenPricing || (() => navigate('/pricing'));
  const onSelectStock =
    props.onSelectStock ||
    context.onSelectStock ||
    ((symbol) => navigate(chartPath(symbol)));
  const membership = getMembership(user, plans);

  const load = useCallback(() => {
    setLoading(true);
    fetchMarketAnalyse()
      .then((res) => {
        if (res.success && res.data) {
          setReport(res.data);
          setErrorMessage('');
        } else {
          setErrorMessage(res.message || 'Could not build market analysis.');
        }
      })
      .catch((err) => {
        console.error('Market analyse fetch error:', err);
        setErrorMessage(err.userMessage || err.response?.data?.message || 'Could not load analysis.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!membership.allowMarketXRay) return;
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load, membership.allowMarketXRay]);

  if (!membership.allowMarketXRay) {
    return (
      <MembershipLocked
        title="Market Analyse locked"
        message={membership.upgradeHint || 'Your membership does not include Market Analyse.'}
        onOpenPricing={onOpenPricing}
      />
    );
  }

  return (
    <div className="space-y-5">
      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />
      <MarketAnalyseView
        report={report}
        loading={loading}
        errorMessage={errorMessage}
        onRefresh={load}
        onSelectStock={onSelectStock}
      />
    </div>
  );
}
