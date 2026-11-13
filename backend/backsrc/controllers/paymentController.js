import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { findPlanById, getByokSalesEnabled } from '../services/membershipPlans.js';
import { connectByok } from '../services/byokSessionService.js';
import { encryptObject, decryptObject } from '../utils/cryptoSecrets.js';
import { activateMembershipForUser, sanitizeUser } from '../services/membershipActivation.js';
import { timingSafeEqualHex } from '../utils/security.js';
import { allowMemoryAuth, isDbReady } from '../utils/db.js';
import { memoryUsers } from '../middleware/authMiddleware.js';

/** Safe payment payload for API clients (never includes pendingByokCipher / signature). */
function toPublicPayment(doc) {
  if (!doc) return null;
  const p = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete p.pendingByokCipher;
  delete p.signature;
  delete p.__v;
  return p;
}

function assertPaymentOwnership(payment, reqUser) {
  const uid = String(reqUser?._id || reqUser?.id || '');
  return uid && payment?.userId && String(payment.userId) === uid;
}

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  return new Razorpay({ key_id, key_secret });
}

function normalizeCustomerDetails(input = {}) {
  return {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    phone: String(input.phone || '').trim()
  };
}

function formatFailureReason(errorLike = {}) {
  const description = errorLike.description || errorLike.error_description || errorLike.message || '';
  const reason = errorLike.reason || errorLike.code || errorLike.error_code || '';
  const parts = [description, reason].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' | ') : 'Payment failed';
}

/**
 * After payment is paid, activate membership once (idempotent).
 */
async function activateMembershipFromPayment(paymentDoc, { byokCredentials = null } = {}) {
  if (!paymentDoc?.planId || !paymentDoc?.userId) {
    return { activated: false, reason: 'no_plan_or_user' };
  }
  if (paymentDoc.membershipActivated) {
    return { activated: true, already: true };
  }
  if (paymentDoc.status !== 'paid') {
    return { activated: false, reason: 'not_paid' };
  }

  const plan = findPlanById(paymentDoc.planId);
  const mode = plan?.mode === 'byok' ? 'byok' : 'server';

  let byokBundle = null;
  if (mode === 'byok') {
    // Optional: keys sent at create-order (legacy) or at verify. Otherwise activate
    // membership first and let the client connect broker after payment.
    const withCipher =
      paymentDoc.pendingByokCipher != null
        ? paymentDoc
        : await Payment.findById(paymentDoc._id).select('+pendingByokCipher');
    if (withCipher?.pendingByokCipher) {
      byokBundle = decryptObject(withCipher.pendingByokCipher);
    }
    if (!byokBundle && byokCredentials) {
      const connected = await connectByok(byokCredentials);
      byokBundle = connected.bundle;
    }
  }

  const result = await activateMembershipForUser({
    userId: paymentDoc.userId,
    planId: paymentDoc.planId,
    byokBundle,
    byokCredentials: null
  });

  paymentDoc.membershipActivated = true;
  paymentDoc.pendingByokCipher = undefined;
  await Payment.updateOne(
    { _id: paymentDoc._id },
    { $set: { membershipActivated: true }, $unset: { pendingByokCipher: 1 } }
  );

  return { activated: true, user: result.user, plan: result.plan, mode: result.mode };
}

/**
 * POST /api/payment/create-order
 * Membership purchases require auth + planId. Amount is taken from the plan (server-side).
 */
export const createOrder = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Sign in required before purchasing a membership.'
      });
    }

    const planId = String(req.body?.planId || '').trim();
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'planId is required. Membership activates only after paid checkout.'
      });
    }

    const plan = findPlanById(planId);
    if (!plan || plan.enabled === false) {
      return res.status(404).json({ success: false, message: 'Membership plan not found or disabled.' });
    }

    const mode = plan.mode === 'byok' ? 'byok' : 'server';
    if (mode === 'byok' && !getByokSalesEnabled()) {
      const alreadyByok =
        req.user?.subscription?.byokGranted || req.user?.subscription?.mode === 'byok';
      if (!alreadyByok) {
        return res.status(403).json({
          success: false,
          message: 'BYOK membership sales are currently disabled by admin.'
        });
      }
    }

    const amountInr = Number(plan.price);
    if (!Number.isFinite(amountInr) || amountInr < 1) {
      return res.status(400).json({
        success: false,
        message: 'Plan price is invalid. Contact support.'
      });
    }

    // Client may send amount for display check — reject mismatches
    if (req.body?.amount != null && Number(req.body.amount) !== amountInr) {
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch. Refresh pricing and try again.'
      });
    }

    const customerDetails = normalizeCustomerDetails(
      req.body?.customerDetails || {
        name: req.user.name,
        email: req.user.email,
        phone: req.body?.customerDetails?.phone || ''
      }
    );

    if (!customerDetails.name || !customerDetails.email) {
      return res.status(400).json({
        success: false,
        message: 'customerDetails.name and customerDetails.email are required.'
      });
    }

    // BYOK keys are optional at order time — preferred flow is: pay → then connect broker.
    let pendingByokCipher = null;
    if (mode === 'byok') {
      const creds = req.body?.byokCredentials;
      if (creds && typeof creds === 'object') {
        try {
          const connected = await connectByok(creds);
          pendingByokCipher = encryptObject(connected.bundle);
        } catch (err) {
          const msg = String(err?.message || '').trim();
          return res.status(err.statusCode || 400).json({
            success: false,
            message:
              msg && msg !== '[object Object]'
                ? msg
                : 'Could not validate BYOK broker credentials. Check keys and try again.'
          });
        }
      }
    }

    const razorpay = getRazorpayClient();
    const amountPaise = Math.round(amountInr * 100);
    const userId = req.user._id || req.user.id;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        planId: plan.id,
        planName: plan.name,
        userId: String(userId),
        customerName: customerDetails.name,
        customerEmail: customerDetails.email,
        customerPhone: customerDetails.phone || ''
      }
    });

    const paymentDoc = await Payment.create({
      userId,
      customerDetails,
      orderId: order.id,
      amount: amountInr,
      currency: order.currency || 'INR',
      status: 'created',
      planId: plan.id,
      planName: plan.name,
      membershipActivated: false,
      ...(pendingByokCipher ? { pendingByokCipher } : {})
    });

    return res.status(201).json({
      success: true,
      orderId: paymentDoc.orderId,
      amount: paymentDoc.amount,
      currency: paymentDoc.currency,
      planId: paymentDoc.planId,
      planName: paymentDoc.planName,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentRecordId: paymentDoc._id
    });
  } catch (err) {
    console.error('[Payment] create-order error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create payment order.'
    });
  }
};

/**
 * POST /api/payment/verify
 * Verifies signature, marks paid, then activates membership.
 */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      byokCredentials
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'RAZORPAY_KEY_SECRET is not configured.' });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!timingSafeEqualHex(expected, razorpay_signature)) {
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          status: 'failed',
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          failureReason: 'Signature verification failed'
        }
      );
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    const existing = await Payment.findOne({ orderId: razorpay_order_id }).select('+pendingByokCipher');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }
    if (!assertPaymentOwnership(existing, req.user)) {
      return res.status(403).json({ success: false, message: 'This payment does not belong to your account.' });
    }

    const razorpay = getRazorpayClient();
    let method = null;
    try {
      const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
      method = razorpayPayment?.method || null;
      const rzStatus = String(razorpayPayment?.status || '').toLowerCase();
      if (rzStatus && !['captured', 'authorized'].includes(rzStatus)) {
        return res.status(400).json({
          success: false,
          message: `Payment not successful on Razorpay (status: ${rzStatus}).`
        });
      }
      const paidPaise = Number(razorpayPayment?.amount);
      const expectedPaise = Math.round(Number(existing.amount) * 100);
      if (Number.isFinite(paidPaise) && paidPaise !== expectedPaise) {
        return res.status(400).json({
          success: false,
          message: 'Paid amount does not match the membership order.'
        });
      }
    } catch (fetchErr) {
      console.warn('[Payment] fetch payment method failed:', fetchErr.message || fetchErr);
    }

    const payment = await Payment.findOneAndUpdate(
      { _id: existing._id },
      {
        status: 'paid',
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        paymentMethod: method,
        failureReason: null
      },
      { new: true }
    ).select('+pendingByokCipher');

    let activation;
    try {
      activation = await activateMembershipFromPayment(payment, { byokCredentials });
    } catch (actErr) {
      console.error('[Payment] membership activation after verify failed:', actErr);
      return res.status(actErr.statusCode || 500).json({
        success: true,
        paymentVerified: true,
        membershipActivated: false,
        message:
          actErr.message ||
          'Payment verified but membership activation failed. Contact support with your Order ID.',
        payment: toPublicPayment(payment),
        orderId: payment.orderId
      });
    }

    if (!activation.activated && activation.reason === 'byok_credentials_required') {
      return res.json({
        success: true,
        paymentVerified: true,
        membershipActivated: false,
        message: activation.message,
        payment: toPublicPayment(payment),
        orderId: payment.orderId
      });
    }

    return res.json({
      success: true,
      paymentVerified: true,
      membershipActivated: !!activation.activated,
      message: activation.activated
        ? 'Payment confirmed. Membership is now active.'
        : 'Payment verified successfully.',
      payment: toPublicPayment(payment),
      user: activation.user || null
    });
  } catch (err) {
    console.error('[Payment] verify error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Payment verification failed.'
    });
  }
};

/**
 * POST /api/payment/failed
 */
export const markPaymentFailed = async (req, res) => {
  try {
    const { razorpay_order_id, orderId, error } = req.body || {};
    const resolvedOrderId = razorpay_order_id || orderId;

    if (!resolvedOrderId) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id (or orderId) is required.'
      });
    }

    const existing = await Payment.findOne({ orderId: resolvedOrderId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }
    if (!assertPaymentOwnership(existing, req.user)) {
      return res.status(403).json({ success: false, message: 'This payment does not belong to your account.' });
    }
    // Never downgrade a successful payment via client failure callback
    if (existing.status === 'paid' || existing.membershipActivated) {
      return res.json({
        success: true,
        message: 'Payment already confirmed — failure event ignored.',
        payment: toPublicPayment(existing)
      });
    }

    const failureReason = formatFailureReason(error || req.body || {});

    const payment = await Payment.findOneAndUpdate(
      { _id: existing._id, status: { $ne: 'paid' } },
      {
        status: 'failed',
        failureReason,
        ...(req.body?.razorpay_payment_id ? { paymentId: req.body.razorpay_payment_id } : {})
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: 'Payment marked as failed.',
      payment: toPublicPayment(payment || existing)
    });
  } catch (err) {
    console.error('[Payment] failed handler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to record payment failure.'
    });
  }
};

/**
 * POST /api/payment/webhook
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Payment] RAZORPAY_WEBHOOK_SECRET is not configured.');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header.' });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!timingSafeEqualHex(expected, signature)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventName = event?.event;
    const entity = event?.payload?.payment?.entity;

    if (!entity?.order_id) {
      return res.json({ success: true, message: 'Ignored event (no payment entity).' });
    }

    if (eventName === 'payment.captured') {
      const existing = await Payment.findOne({ orderId: entity.order_id }).select('+pendingByokCipher');
      if (!existing) {
        return res.json({ success: true, message: 'Order not found locally — ignored.' });
      }

      const paidPaise = Number(entity.amount);
      const expectedPaise = Math.round(Number(existing.amount) * 100);
      if (Number.isFinite(paidPaise) && Number.isFinite(expectedPaise) && paidPaise !== expectedPaise) {
        console.warn(
          `[Payment] webhook amount mismatch order=${entity.order_id} paid=${paidPaise} expected=${expectedPaise}`
        );
        return res.status(400).json({ success: false, message: 'Amount mismatch.' });
      }

      const payment = await Payment.findOneAndUpdate(
        { _id: existing._id },
        {
          status: 'paid',
          paymentId: entity.id,
          paymentMethod: entity.method || null,
          failureReason: null
        },
        { new: true }
      ).select('+pendingByokCipher');

      if (payment && !payment.membershipActivated) {
        try {
          await activateMembershipFromPayment(payment);
        } catch (actErr) {
          console.error('[Payment] webhook membership activation failed:', actErr.message || actErr);
        }
      }
    } else if (eventName === 'payment.failed') {
      await Payment.findOneAndUpdate(
        { orderId: entity.order_id },
        {
          status: 'failed',
          paymentId: entity.id || null,
          paymentMethod: entity.method || null,
          failureReason: formatFailureReason({
            description: entity.error_description,
            reason: entity.error_reason || entity.error_code
          })
        }
      );
    }

    return res.json({ success: true, received: true });
  } catch (err) {
    console.error('[Payment] webhook error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Webhook processing failed.'
    });
  }
};

/**
 * GET /api/payment/admin/all
 */
export const getAdminPayments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status && ['created', 'paid', 'failed'].includes(status)) {
      filter.status = status;
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { orderId: rx },
        { paymentId: rx },
        { 'customerDetails.email': rx },
        { 'customerDetails.name': rx },
        { planId: rx },
        { planName: rx }
      ];
    }

    const [payments, total, aggregates] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0]
              }
            }
          }
        }
      ])
    ]);

    const summary = {
      totalRevenue: 0,
      totalSuccessCount: 0,
      totalFailedCount: 0,
      totalPendingCount: 0
    };

    for (const row of aggregates) {
      if (row._id === 'paid') {
        summary.totalSuccessCount = row.count;
        summary.totalRevenue = row.revenue;
      } else if (row._id === 'failed') {
        summary.totalFailedCount = row.count;
      } else if (row._id === 'created') {
        summary.totalPendingCount = row.count;
      }
    }

    return res.json({
      success: true,
      payments: payments.map(toPublicPayment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      summary
    });
  } catch (err) {
    console.error('[Payment] admin list error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch payments.'
    });
  }
};

/**
 * GET /api/payment/my-history
 * Logged-in user's own payment history.
 */
export const getMyPaymentHistory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const filter = { userId };

    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      payments: payments.map(toPublicPayment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error('[Payment] my-history error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load payment history.'
    });
  }
};

/**
 * POST /api/payment/cancel-membership
 * User cancels active membership (access ends immediately; no auto-refund).
 */
export const cancelMembership = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const reason = String(req.body?.reason || '').trim().slice(0, 300);

    const expiredSub = {
      status: 'expired',
      plan: 'No Active Plan',
      planId: null,
      mode: req.user?.subscription?.mode === 'byok' ? 'byok' : 'server',
      byokGranted: !!req.user?.subscription?.byokGranted,
      expiresAt: new Date()
    };

    if (isDbReady()) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (user.subscription?.status !== 'active' && user.subscription?.status !== 'trial') {
        return res.status(400).json({
          success: false,
          message: 'No active membership to cancel.'
        });
      }

      expiredSub.mode = user.subscription?.mode === 'byok' ? 'byok' : 'server';
      expiredSub.byokGranted = !!user.subscription?.byokGranted;
      user.subscription = expiredSub;
      await user.save();

      console.log(
        `[Membership] User ${user.email} cancelled membership.${reason ? ` Reason: ${reason}` : ''}`
      );

      return res.json({
        success: true,
        message: 'Membership cancelled. Terminal access is now locked until you renew.',
        user: sanitizeUser(user)
      });
    }

    if (allowMemoryAuth()) {
      const mem = memoryUsers.get(String(userId));
      if (mem) {
        mem.subscription = expiredSub;
        return res.json({
          success: true,
          message: 'Membership cancelled (dev memory).',
          user: sanitizeUser(mem)
        });
      }
    }

    return res.status(503).json({
      success: false,
      message: 'Database unavailable. Could not cancel membership.'
    });
  } catch (err) {
    console.error('[Payment] cancel-membership error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to cancel membership.'
    });
  }
};
