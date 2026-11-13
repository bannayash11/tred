import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DirectionalScannerBoard from '../components/DirectionalScannerBoard';
import MembershipBanner from '../components/MembershipBanner';
import MembershipLocked from '../components/MembershipLocked';
import { getMembership } from '../lib/membership';

export default function DirectionalScanner(props) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);

  const onSelectStock = props.onSelectStock || context.onSelectStock;
  const liveUpdatedSymbols = props.liveUpdatedSymbols || context.liveUpdatedSymbols;
  const user = props.user || context.user || authUser;
  const onOpenPricing = props.onOpenPricing || context.onOpenPricing || (() => navigate('/pricing'));
  const membership = getMembership(user, plans);

  if (!membership.allowTerminal) {
    return (
      <MembershipLocked
        title="AlphaMove locked"
        message={membership.upgradeHint || 'Your membership does not include live AlphaMove access.'}
        onOpenPricing={onOpenPricing}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />
      <DirectionalScannerBoard
        onSelectStock={onSelectStock}
        liveUpdatedSymbols={liveUpdatedSymbols}
        user={user}
        onOpenPricing={onOpenPricing}
      />
    </div>
  );
}
