/**
 * Shared membership plan catalog + BYOK platform settings.
 * Plans stay in-memory (admin CRUD) with BYOK/server dual pricing defaults.
 */
import { Settings } from '../models/Settings.js';

export const DURATION_MONTH_OPTIONS = [1, 3, 6, 12];

const FEATURE_DEFAULTS = {
  maxStocks: 200,
  timeframesAllowed: ['1m', '5m', '15m'],
  allowTerminal: true,
  allowMarketXRay: true,
  allowFullFVG: true
};

/**
 * Suggested INR prices:
 * originalPrice = MRP (strike-through), price = offer / pay amount
 * BYOK offer base ₹250/mo, Server offer base ₹350/mo
 */
export const DEFAULT_PLANS = [
  // ── BYOK (user brings Kotak Neo keys) ──────────────────────────────────────
  {
    id: 'byok_1m',
    name: '1 Month · Your API',
    originalPrice: 349,
    price: 250,
    durationMonths: 1,
    badge: 'Your API',
    mode: 'byok',
    featured: false,
    enabled: true,
    sortOrder: 1,
    description: 'Connect Upstox / Kotak / Groww / Angel — you bring the market data key',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'byok_3m',
    name: '3 Months · Your API',
    originalPrice: 1047,
    price: 699,
    durationMonths: 3,
    badge: 'Popular',
    mode: 'byok',
    featured: true,
    enabled: true,
    sortOrder: 2,
    description: 'Your broker API · better value vs paying monthly',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'byok_6m',
    name: '6 Months · Your API',
    originalPrice: 2094,
    price: 1299,
    durationMonths: 6,
    badge: 'Best value',
    mode: 'byok',
    featured: false,
    enabled: true,
    sortOrder: 3,
    description: 'Your broker API · half-year membership',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'byok_12m',
    name: '12 Months · Your API',
    originalPrice: 4188,
    price: 2399,
    durationMonths: 12,
    badge: 'Yearly',
    mode: 'byok',
    featured: true,
    enabled: true,
    sortOrder: 4,
    description: 'Your broker API · full year membership',
    ...FEATURE_DEFAULTS
  },
  // ── Platform feed (Tradrift provides data — no user keys) ────────────────
  {
    id: 'server_1m',
    name: '1 Month · Platform Feed',
    originalPrice: 499,
    price: 350,
    durationMonths: 1,
    badge: 'Platform',
    mode: 'server',
    featured: false,
    enabled: true,
    sortOrder: 5,
    description: 'Ready to use — Tradrift provides the live market feed (no API keys)',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'server_3m',
    name: '3 Months · Platform Feed',
    originalPrice: 1497,
    price: 999,
    durationMonths: 3,
    badge: 'Popular',
    mode: 'server',
    featured: true,
    enabled: true,
    sortOrder: 6,
    description: 'Platform feed · better value vs paying monthly',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'server_6m',
    name: '6 Months · Platform Feed',
    originalPrice: 2994,
    price: 1799,
    durationMonths: 6,
    badge: 'Best value',
    mode: 'server',
    featured: false,
    enabled: true,
    sortOrder: 7,
    description: 'Platform feed · half-year membership',
    ...FEATURE_DEFAULTS
  },
  {
    id: 'server_12m',
    name: '12 Months · Platform Feed',
    originalPrice: 5988,
    price: 3499,
    durationMonths: 12,
    badge: 'Yearly',
    mode: 'server',
    featured: true,
    enabled: true,
    sortOrder: 8,
    description: 'Platform feed · full year membership',
    ...FEATURE_DEFAULTS
  }
];

/** Canonical display names — refresh stale DB copies of default plan ids */
const CANONICAL_PLAN_NAMES = Object.fromEntries(DEFAULT_PLANS.map((p) => [p.id, p]));

export function normalizePlan(raw = {}) {
  const durationMonths = DURATION_MONTH_OPTIONS.includes(Number(raw.durationMonths))
    ? Number(raw.durationMonths)
    : raw.durationDays === 14
      ? 0
      : Math.max(1, Math.round((Number(raw.durationDays) || 30) / 30));

  const durationDays =
    raw.durationDays !== undefined && raw.durationDays !== null
      ? Number(raw.durationDays)
      : durationMonths === 0
        ? 14
        : durationMonths * 30;

  const tfRaw = raw.timeframesAllowed || raw.timeframes || ['15m'];
  const timeframesAllowed = Array.isArray(tfRaw)
    ? tfRaw.map((t) => String(t).trim()).filter(Boolean)
    : String(tfRaw)
        .split(',')
        .map((t) => t.trim().replace(/ only$/i, ''))
        .filter(Boolean);

  const mode = raw.mode === 'byok' ? 'byok' : 'server';

  const price = Number(raw.price) || 0;
  let originalPrice = Number(raw.originalPrice ?? raw.mrp ?? raw.listPrice);
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    originalPrice = 0;
  }
  // Offer only makes sense when MRP is higher than pay price
  if (originalPrice > 0 && originalPrice <= price) {
    originalPrice = 0;
  }
  const discountPercent =
    originalPrice > price && price >= 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return {
    id: raw.id || `plan_${Date.now()}`,
    name: raw.name || 'Untitled Plan',
    /** Offer / pay amount */
    price,
    /** MRP shown struck-through when > price */
    originalPrice,
    discountPercent,
    durationMonths,
    durationDays,
    badge: raw.badge || 'Plan',
    mode,
    featured: !!raw.featured,
    enabled: raw.enabled !== false,
    sortOrder: Number(raw.sortOrder) || 0,
    maxStocks: Number(raw.maxStocks ?? raw.maxStocksVisible) || 30,
    timeframes: timeframesAllowed.join(', '),
    timeframesAllowed,
    allowTerminal: raw.allowTerminal !== false,
    allowMarketXRay: raw.allowMarketXRay !== false,
    allowFullFVG: raw.allowFullFVG !== false,
    description: raw.description || ''
  };
}

let inMemoryPlans = DEFAULT_PLANS.map((p) => normalizePlan(p));

/** Platform flag: when false, new BYOK purchases are blocked; existing BYOK users keep access. */
let byokSalesEnabled = true;

/**
 * Free trial for new signups — DEFAULT OFF.
 * Admin can enable and set duration (days). Existing trial users keep their trial until expiry.
 */
let freeTrialEnabled = false;
let freeTrialDays = 14;

export function getPlans() {
  return inMemoryPlans;
}

export function setPlans(plans) {
  inMemoryPlans = plans;
}

export function findPlanById(id) {
  return inMemoryPlans.find((p) => p.id === id) || null;
}

export function getByokSalesEnabled() {
  return byokSalesEnabled;
}

export function setByokSalesEnabled(value) {
  byokSalesEnabled = !!value;
  return byokSalesEnabled;
}

export function getFreeTrialEnabled() {
  return freeTrialEnabled;
}

export function getFreeTrialDays() {
  return freeTrialDays;
}

export function setFreeTrialSettings({ enabled, days } = {}) {
  if (enabled !== undefined) freeTrialEnabled = !!enabled;
  if (days !== undefined) {
    const n = Number(days);
    if (Number.isFinite(n) && n >= 1 && n <= 90) freeTrialDays = Math.round(n);
  }
  return { freeTrialEnabled, freeTrialDays };
}

/** Subscription object applied on new user registration (respects admin trial toggle). */
export function buildSignupSubscription() {
  if (freeTrialEnabled) {
    const days = Math.max(1, freeTrialDays || 14);
    return {
      status: 'trial',
      plan: `${days}-Day Free Trial`,
      planId: null,
      mode: 'trial',
      byokGranted: false,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    };
  }
  return {
    status: 'expired',
    plan: 'No Active Plan',
    planId: null,
    mode: 'server',
    byokGranted: false,
    expiresAt: new Date(Date.now() - 60_000)
  };
}

export async function loadByokSettingsFromDb() {
  try {
    const doc = await Settings.findOne({ key: 'byok_platform' });
    if (doc?.value && typeof doc.value.salesEnabled === 'boolean') {
      byokSalesEnabled = doc.value.salesEnabled;
    }
  } catch {
    /* keep default */
  }
}

export async function persistByokSettings() {
  await Settings.findOneAndUpdate(
    { key: 'byok_platform' },
    { key: 'byok_platform', value: { salesEnabled: byokSalesEnabled }, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}

export async function loadFreeTrialSettingsFromDb() {
  try {
    const doc = await Settings.findOne({ key: 'free_trial_platform' });
    if (doc?.value) {
      if (typeof doc.value.enabled === 'boolean') freeTrialEnabled = doc.value.enabled;
      if (Number.isFinite(Number(doc.value.days))) {
        const n = Number(doc.value.days);
        if (n >= 1 && n <= 90) freeTrialDays = Math.round(n);
      }
    }
  } catch {
    /* keep defaults (OFF) */
  }
}

export async function persistFreeTrialSettings() {
  await Settings.findOneAndUpdate(
    { key: 'free_trial_platform' },
    {
      key: 'free_trial_platform',
      value: { enabled: freeTrialEnabled, days: freeTrialDays },
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
}

function withOfferDefaults(plan) {
  let normalized = normalizePlan(plan);
  const canon = CANONICAL_PLAN_NAMES[normalized.id];
  // Refresh legacy default titles → logical names
  if (
    canon &&
    (/^Server\s*·/i.test(normalized.name) ||
      /^BYOK\s*·/i.test(normalized.name) ||
      /^Hosted Access\s*·/i.test(normalized.name) ||
      /^Own Keys\s*·/i.test(normalized.name))
  ) {
    normalized = normalizePlan({
      ...normalized,
      name: canon.name,
      description: canon.description || normalized.description,
      badge: canon.badge || normalized.badge
    });
  }
  if (normalized.originalPrice > normalized.price) return normalized;
  const fromDefault = DEFAULT_PLANS.find((p) => p.id === normalized.id);
  if (fromDefault?.originalPrice > fromDefault.price) {
    return normalizePlan({ ...normalized, originalPrice: fromDefault.originalPrice });
  }
  // Soft fallback so offer UI still shows for older plans without MRP
  if (normalized.price > 0) {
    const guess = Math.round(normalized.price * 1.4);
    return normalizePlan({ ...normalized, originalPrice: guess });
  }
  return normalized;
}

export async function loadPlansFromDb() {
  try {
    const doc = await Settings.findOne({ key: 'membership_plans' });
    if (doc?.value && Array.isArray(doc.value) && doc.value.length) {
      let loaded = doc.value.map((p) => withOfferDefaults(p));
      const hasByok = loaded.some((p) => p.mode === 'byok');
      // Older catalogs had no BYOK mode — append default BYOK plans (keep existing)
      if (!hasByok) {
        const byokDefaults = DEFAULT_PLANS.filter((p) => p.mode === 'byok').map((p) =>
          normalizePlan(p)
        );
        // Mark legacy plans as server-hosted
        loaded = loaded.map((p) => normalizePlan({ ...p, mode: p.mode || 'server' }));
        loaded = [...byokDefaults, ...loaded];
        inMemoryPlans = loaded;
        try {
          await persistPlans();
        } catch {
          /* keep memory */
        }
      } else {
        const needsPersist = loaded.some((p, i) => {
          const raw = doc.value[i];
          const priceBackfill = !raw?.originalPrice && p.originalPrice > p.price;
          const nameBackfill =
            /^Server\s*·/i.test(String(raw?.name || '')) ||
            /^BYOK\s*·/i.test(String(raw?.name || '')) ||
            /^Hosted Access\s*·/i.test(String(raw?.name || '')) ||
            /^Own Keys\s*·/i.test(String(raw?.name || ''));
          return priceBackfill || nameBackfill;
        });
        inMemoryPlans = loaded;
        if (needsPersist) {
          try {
            await persistPlans();
          } catch {
            /* keep memory */
          }
        }
      }
    }
  } catch {
    /* keep defaults */
  }
}

export async function persistPlans() {
  await Settings.findOneAndUpdate(
    { key: 'membership_plans' },
    { key: 'membership_plans', value: inMemoryPlans, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}
