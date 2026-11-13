import { User } from '../models/User.js';
import { memoryUsers } from '../middleware/authMiddleware.js';
import { allowMemoryAuth, isDbReady } from '../utils/db.js';
import {
  findPlanById,
  getByokSalesEnabled
} from './membershipPlans.js';
import { connectByok, getByokPublicStatus } from './byokSessionService.js';

export function sanitizeUser(user) {
  return {
    id: user._id || user.id,
    _id: user._id || user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    twoFactorEnabled: !!user.twoFactorEnabled,
    subscription: user.subscription
      ? {
          status: user.subscription.status,
          plan: user.subscription.plan,
          planId: user.subscription.planId || null,
          mode: user.subscription.mode || 'trial',
          byokGranted: !!user.subscription.byokGranted,
          expiresAt: user.subscription.expiresAt
        }
      : user.subscription,
    byok: getByokPublicStatus(user)
  };
}

/**
 * Activate a membership plan for a user after payment is confirmed.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.planId
 * @param {object|null} opts.byokCredentials - optional raw creds (validated here); can connect after payment
 * @param {object|null} opts.byokBundle - already-built encrypted bundle from create-order
 * @param {object|null} opts.existingUser - optional lean user for byokGranted check
 */
export async function activateMembershipForUser({
  userId,
  planId,
  byokCredentials = null,
  byokBundle = null,
  existingUser = null
} = {}) {
  if (!userId) {
    const err = new Error('Authenticated user is required to activate membership.');
    err.statusCode = 401;
    throw err;
  }
  if (!planId) {
    const err = new Error('planId is required.');
    err.statusCode = 400;
    throw err;
  }

  const plan = findPlanById(planId);
  if (!plan || plan.enabled === false) {
    const err = new Error('Membership plan not found or disabled.');
    err.statusCode = 404;
    throw err;
  }

  const mode = plan.mode === 'byok' ? 'byok' : 'server';

  if (mode === 'byok' && !getByokSalesEnabled()) {
    const alreadyByok =
      existingUser?.subscription?.byokGranted || existingUser?.subscription?.mode === 'byok';
    if (!alreadyByok) {
      const err = new Error('BYOK membership sales are currently disabled by admin.');
      err.statusCode = 403;
      throw err;
    }
  }

  let bundle = byokBundle || null;
  if (mode === 'byok' && !bundle && byokCredentials) {
    try {
      const connected = await connectByok(byokCredentials);
      bundle = connected.bundle;
    } catch (err) {
      err.statusCode = err.statusCode || 400;
      throw err;
    }
  }
  // BYOK membership can activate without broker keys — user connects demat/API after payment.

  const days = Number(plan.durationDays) || (Number(plan.durationMonths) || 1) * 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const subscription = {
    status: 'active',
    plan: plan.name,
    planId: plan.id,
    mode,
    byokGranted: mode === 'byok' ? true : !!existingUser?.subscription?.byokGranted,
    expiresAt
  };

  if (isDbReady()) {
    const user = await User.findById(userId).select('+byok.secretsCipher +byok.sessionCipher');
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    // Refresh byokGranted from live user if existingUser was stale
    if (mode !== 'byok') {
      subscription.byokGranted = !!user.subscription?.byokGranted;
    }

    user.subscription = subscription;
    if (bundle) {
      user.byok = bundle;
    } else if (mode === 'byok') {
      // Paid BYOK member — broker connect happens post-payment
      user.byok = { status: 'none' };
    } else if (mode === 'server' && !user.byok) {
      user.byok = { status: 'none' };
    }
    await user.save();
    return { user: sanitizeUser(user), plan, mode };
  }

  if (allowMemoryAuth()) {
    const mem = memoryUsers.get(String(userId));
    if (mem) {
      mem.subscription = subscription;
      if (bundle) {
        mem.byok = bundle;
      } else if (mode === 'byok') {
        mem.byok = { status: 'none' };
      }
      return { user: sanitizeUser(mem), plan, mode };
    }
  }

  const err = new Error('Database unavailable. Cannot activate membership.');
  err.statusCode = 503;
  throw err;
}
