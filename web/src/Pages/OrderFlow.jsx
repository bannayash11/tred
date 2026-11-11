import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import MembershipLocked from '../components/MembershipLocked';
import { getMembership } from '../lib/membership';
import { MarketFlowPage } from '../vendor/order-flow/features/market-flow/MarketFlowPage';
import { loadUnderlyings } from '../vendor/order-flow/lib/underlyings';

export default function OrderFlow() {
  const user = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);
  const [universe, setUniverse] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let live = true;
    loadUnderlyings()
      .then((rows) => {
        if (live) setUniverse(rows);
      })
      .catch((err) => {
        if (live) setLoadError(String(err?.message || err));
      });
    return () => {
      live = false;
    };
  }, []);

  if (!membership.allowTerminal) {
    return (
      <MembershipLocked
        title="Order Flow locked"
        message={membership.upgradeHint || 'Your membership does not include Order Flow access.'}
      />
    );
  }

  if (loadError) {
    return (
      <div className="p-8 text-sm text-rose-400">
        Failed to load underlyings: {loadError}
      </div>
    );
  }

  if (!universe) {
    return <div className="p-8 text-sm text-slate-400">Loading Order Flow…</div>;
  }

  /* Full-bleed host — site chrome hidden on this route; MarketFlowPage owns layout. */
  return (
    <div className="order-flow-host" style={{ minHeight: '100vh' }}>
      <MarketFlowPage universe={universe} />
    </div>
  );
}
