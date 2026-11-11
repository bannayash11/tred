/** Membership entitlements — prefers admin-managed plan catalog when available */

export const TIER_FEATURES = {
  expired: {
    key: 'expired',
    label: 'Membership Expired',
    maxStocksVisible: 0,
    timeframesAllowed: [],
    maxJournalEntries: 0,
    allowTerminal: false,
    allowMarketXRay: false,
    allowJournal: false,
    allowFullFVG: false,
    upgradeHint: 'Renew or upgrade a plan to restore Terminal, X-Ray and Trade Log access.'
  },
  trial: {
    key: 'trial',
    label: 'Trial Access',
    maxStocksVisible: 200,
    timeframesAllowed: ['1m', '3m', '5m', '15m', '1h', '1d'],
    maxJournalEntries: 100,
    allowTerminal: true,
    allowMarketXRay: true,
    allowJournal: true,
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

export function planToMembership(plan) {
  if (!plan) return null;
  const tfs = plan.timeframesAllowed
    ? plan.timeframesAllowed
    : String(plan.timeframes || '')
      .split(',')
      .map((t) => t.trim().replace(/ only$/i, ''))
      .filter(Boolean);

  const maxLog = Number(plan.maxTradeLog ?? plan.maxJournal ?? 30);
  const maxStocks = Number(plan.maxStocks ?? 30);

  return {
    key: plan.id || 'custom',
    label: plan.name || 'Membership',
    maxStocksVisible: maxStocks,
    timeframesAllowed: tfs.length ? tfs : ['15m'],
    maxJournalEntries: maxLog,
    allowTerminal: plan.allowTerminal !== false,
    allowMarketXRay: plan.allowMarketXRay !== false,
    allowJournal: plan.allowTradeLog !== false,
    allowFullFVG: plan.allowFullFVG !== false,
    upgradeHint:
      maxStocks >= 200 && tfs.includes('1m')
        ? null
        : 'Upgrade your membership for more stocks, timeframes and Trade Log capacity.',
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
      canUseTimeframe: () => false,
      canAddJournalEntry: () => false
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
      expiresAt: sub?.expiresAt || null,
      isExpired: false,
      isTrial: features.price === 0 || (features.durationDays || 0) <= 14,
      isStarter: !isTop && features.maxStocksVisible <= 50,
      isPro: isTop,
      canUseTimeframe: (tf) => features.timeframesAllowed.includes(tf),
      canAddJournalEntry: (currentCount) => currentCount < features.maxJournalEntries
    };
  }

  // Fallback when catalog not loaded yet — generous trial-like access for active subs
  const fallback =
    sub?.status === 'active' ? { ...TIER_FEATURES.trial, maxStocksVisible: 30, timeframesAllowed: ['5m', '15m'], maxJournalEntries: 30, allowFullFVG: true, key: 'active-fallback', label: sub.plan || 'Active' } : TIER_FEATURES.trial;

  return {
    ...fallback,
    planName: sub?.plan || fallback.label,
    status: sub?.status || 'trial',
    expiresAt: sub?.expiresAt || null,
    isExpired: false,
    isTrial: sub?.status !== 'active',
    isStarter: sub?.status === 'active',
    isPro: false,
    canUseTimeframe: (tf) => fallback.timeframesAllowed.includes(tf),
    canAddJournalEntry: (currentCount) => currentCount < fallback.maxJournalEntries
  };
}
