/** Membership entitlements — prefers admin-managed plan catalog when available */

export const TIER_FEATURES = {
  expired: {
    key: 'expired',
    label: 'Membership Expired',
    maxStocksVisible: 0,
    timeframesAllowed: [],
    allowTerminal: false,
    allowMarketXRay: false,
    allowFullFVG: false,
    upgradeHint: 'Renew or upgrade a plan to restore Terminal and Market X-Ray access.'
  },
  trial: {
    key: 'trial',
    label: 'Trial Access',
    maxStocksVisible: 200,
    timeframesAllowed: ['1m', '3m', '5m', '15m', '1h', '1d'],
    allowTerminal: true,
    allowMarketXRay: true,
    allowFullFVG: true,
    upgradeHint: null
  }
};

export function isSubscriptionExpired(subscription) {
  if (!subscription) return false;
  if (subscription.status === 'expired') return true;
  if (!subscription.expiresAt) return false;
  const exp = new Date(subscription.expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() < Date.now();
}

/** Paid BYOK member who has not connected demat/broker API keys yet. */
export function needsByokBrokerConnect(user) {
  if (!user) return false;
  const sub = user.subscription;
  if (!sub || isSubscriptionExpired(sub)) return false;
  const isByokMember = sub.mode === 'byok' || !!sub.byokGranted;
  if (!isByokMember) return false;
  const status = String(user.byok?.status || 'none').toLowerCase();
  return status !== 'connected';
}

export function planToMembership(plan) {
  if (!plan) return null;
  const tfs = plan.timeframesAllowed
    ? plan.timeframesAllowed
    : String(plan.timeframes || '')
        .split(',')
        .map((t) => t.trim().replace(/ only$/i, ''))
        .filter(Boolean);

  const maxStocks = Number(plan.maxStocks ?? 30);

  return {
    key: plan.id || 'custom',
    label: plan.name || 'Membership',
    maxStocksVisible: maxStocks,
    timeframesAllowed: tfs.length ? tfs : ['15m'],
    allowTerminal: plan.allowTerminal !== false,
    allowMarketXRay: plan.allowMarketXRay !== false,
    allowFullFVG: plan.allowFullFVG !== false,
    upgradeHint:
      maxStocks >= 200 && tfs.includes('1m')
        ? null
        : 'Upgrade your membership for more stocks and timeframes.',
    planId: plan.id,
    price: plan.price,
    durationMonths: plan.durationMonths,
    durationDays: plan.durationDays
  };
}

export function findPlanForUser(user, plans = []) {
  const sub = user?.subscription;
  if (!sub || !plans?.length) return null;

  if (sub.planId) {
    const byId = plans.find((p) => p.id === sub.planId);
    if (byId) return byId;
  }

  const name = String(sub.plan || '').toLowerCase();
  return (
    plans.find((p) => String(p.name || '').toLowerCase() === name) ||
    plans.find((p) => name && String(p.name || '').toLowerCase().includes(name)) ||
    plans.find((p) => name.includes(String(p.name || '').toLowerCase())) ||
    null
  );
}

export function getMembership(user, plans = []) {
  const sub = user?.subscription || null;

  if (!user || isSubscriptionExpired(sub)) {
    const expired = TIER_FEATURES.expired;
    return {
      ...expired,
      planName: sub?.plan || expired.label,
      status: 'expired',
      expiresAt: sub?.expiresAt || null,
      isExpired: true,
      isTrial: false,
      isStarter: false,
      isPro: false,
      canUseTimeframe: () => false
    };
  }

  const matched = findPlanForUser(user, plans);
  if (matched) {
    const features = planToMembership(matched);
    const isTop =
      features.maxStocksVisible >= 200 && features.timeframesAllowed.includes('1m');
    return {
      ...features,
      planName: sub?.plan || features.label,
      status: sub?.status || 'active',
      mode: sub?.mode || matched.mode || 'server',
      byokGranted: !!sub?.byokGranted,
      expiresAt: sub?.expiresAt || null,
      isExpired: false,
      isTrial: features.price === 0 || (features.durationDays || 0) <= 14,
      isStarter: !isTop && features.maxStocksVisible <= 50,
      isPro: isTop,
      canUseTimeframe: (tf) => features.timeframesAllowed.includes(tf)
    };
  }

  const fallback =
    sub?.status === 'active'
      ? {
          ...TIER_FEATURES.trial,
          maxStocksVisible: 30,
          timeframesAllowed: ['5m', '15m'],
          allowFullFVG: true,
          key: 'active-fallback',
          label: sub.plan || 'Active'
        }
      : TIER_FEATURES.trial;

  return {
    ...fallback,
    planName: sub?.plan || fallback.label,
    status: sub?.status || 'trial',
    expiresAt: sub?.expiresAt || null,
    isExpired: false,
    isTrial: sub?.status !== 'active',
    isStarter: sub?.status === 'active',
    isPro: false,
    canUseTimeframe: (tf) => fallback.timeframesAllowed.includes(tf)
  };
}
