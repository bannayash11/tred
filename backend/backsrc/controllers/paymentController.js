import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import {
  findPlanById,
  getByokSalesEnabled,
  getRazorpayPaymentsEnabled,
  getUtrPaymentsEnabled,
  getUtrPayDetails
} from '../services/membershipPlans.js';
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

function envUtrFlagOn() {
  const raw = String(process.env.UTR_PAYMENTS_ENABLED ?? '1').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function getUtrPayConfig() {
  const details = getUtrPayDetails();
  const upiId = String(details.upiId || '').trim();
  const adminUtrOn = getUtrPaymentsEnabled() && envUtrFlagOn();
  return {
    enabled: adminUtrOn,
    upiId,
    payeeName: String(details.payeeName || 'Tradrift').trim(),
    qrImageUrl: String(details.qrImageUrl || '').trim(),
    instructions: String(
      details.instructions ||
        'Pay the exact plan amount via UPI, then paste the UTR / UPI reference number below.'
    ).trim(),
    razorpayEnabled: getRazorpayPaymentsEnabled(),
    utrEnabled: adminUtrOn && !!upiId
  };
}

function normalizeUtr(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]/g, '');
}

function isValidUtr(utr) {
  // UPI / IMPS / NEFT refs are typically 12–22 alphanumeric chars
  return /^[A-Z0-9]{8,30}$/.test(utr);
}

function makeUtrOrderId() {
  return `utr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Shared membership checkout guards (Razorpay + UTR).
 */
async function resolveMembershipCheckoutContext(req) {
  if (!req.user) {
    const err = new Error('Sign in required before purchasing a membership.');
    err.statusCode = 401;
    throw err;
  }

  const planId = String(req.body?.planId || '').trim();
  if (!planId) {
    const err = new Error('planId is required. Membership activates only after paid checkout.');
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
      req.user?.subscription?.byokGranted || req.user?.subscription?.mode === 'byok';
    if (!alreadyByok) {
      const err = new Error('BYOK membership sales are currently disabled by admin.');
      err.statusCode = 403;
      throw err;
    }
  }

  const amountInr = Number(plan.price);
  if (!Number.isFinite(amountInr) || amountInr < 1) {
    const err = new Error('Plan price is invalid. Contact support.');
    err.statusCode = 400;
    throw err;
  }

  if (req.body?.amount != null && Number(req.body.amount) !== amountInr) {
    const err = new Error('Amount mismatch. Refresh pricing and try again.');
    err.statusCode = 400;
    throw err;
  }

  const customerDetails = normalizeCustomerDetails(
    req.body?.customerDetails || {
      name: req.user.name,
      email: req.user.email,
      phone: req.body?.customerDetails?.phone || ''
    }
  );

  if (!customerDetails.name || !customerDetails.email) {
    const err = new Error('customerDetails.name and customerDetails.email are required.');
    err.statusCode = 400;
    throw err;
  }

  let pendingByokCipher = null;
  if (mode === 'byok') {
    const creds = req.body?.byokCredentials;
    if (creds && typeof creds === 'object') {
      try {
        const connected = await connectByok(creds);
        pendingByokCipher = encryptObject(connected.bundle);
      } catch (err) {
        const msg = String(err?.message || '').trim();
        const e = new Error(
          msg && msg !== '[object Object]'
            ? msg
            : 'Could not validate BYOK broker credentials. Check keys and try again.'
        );
        e.statusCode = err.statusCode || 400;
        throw e;
      }
    }
  }

  return {
    plan,
    mode,
    amountInr,
    customerDetails,
    pendingByokCipher,
    userId: req.user._id || req.user.id
  };
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
 * GET /api/payment/utr-config
 * Public checkout config for manual UPI / UTR payments.
 */
export const getUtrConfig = async (_req, res) => {
  try {
    const config = getUtrPayConfig();
    const configured = !!(config.enabled && config.upiId);
    return res.json({
      success: true,
      ...config,
      configured,
      // Checkout picker uses these
      razorpayEnabled: !!config.razorpayEnabled,
      utrEnabled: configured
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load UTR payment config.'
    });
  }
};

/**
 * POST /api/payment/create-order
 * Membership purchases require auth + planId. Amount is taken from the plan (server-side).
 */
export const createOrder = async (req, res) => {
  try {
    if (!getRazorpayPaymentsEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Razorpay checkout is currently disabled by admin. Use UPI + UTR or contact support.'
      });
    }

    const { plan, amountInr, customerDetails, pendingByokCipher, userId } =
      await resolveMembershipCheckoutContext(req);

    const razorpay = getRazorpayClient();
    const amountPaise = Math.round(amountInr * 100);

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
      gateway: 'razorpay',
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
      gateway: 'razorpay',
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentRecordId: paymentDoc._id
    });
  } catch (err) {
    console.error('[Payment] create-order error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to create payment order.'
    });
  }
};

/**
 * POST /api/payment/utr/submit
 * User paid via UPI/bank outside Razorpay — submit UTR for admin verification.
 */
export const submitUtrPayment = async (req, res) => {
  try {
    const config = getUtrPayConfig();
    if (!config.enabled || !config.upiId) {
      return res.status(403).json({
        success: false,
        message: 'UTR / manual UPI payments are currently disabled.'
      });
    }

    const { plan, amountInr, customerDetails, pendingByokCipher, userId } =
      await resolveMembershipCheckoutContext(req);

    const utr = normalizeUtr(req.body?.utr);
    if (!isValidUtr(utr)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid UTR / UPI reference (8–30 letters or numbers).'
      });
    }

    const existingUtr = await Payment.findOne({ utr });
    if (existingUtr) {
      return res.status(409).json({
        success: false,
        message:
          existingUtr.status === 'paid'
            ? 'This UTR is already used for a confirmed payment.'
            : 'This UTR is already submitted. Wait for admin verification or contact support.'
      });
    }

    // One open UTR request per user+plan at a time
    const openPending = await Payment.findOne({
      userId,
      planId: plan.id,
      gateway: 'utr',
      status: 'pending'
    });
    if (openPending) {
      return res.status(409).json({
        success: false,
        message:
          'You already have a pending UTR payment for this plan. Wait for verification or contact support.',
        payment: toPublicPayment(openPending)
      });
    }

    // Always pending — membership only after admin manual Approve.
    const paymentDoc = await Payment.create({
      userId,
      customerDetails,
      orderId: makeUtrOrderId(),
      amount: amountInr,
      currency: 'INR',
      status: 'pending',
      gateway: 'utr',
      paymentMethod: 'upi',
      utr,
      planId: plan.id,
      planName: plan.name,
      membershipActivated: false,
      ...(pendingByokCipher ? { pendingByokCipher } : {})
    });

    return res.status(201).json({
      success: true,
      paymentVerified: false,
      membershipActivated: false,
      autoApproved: false,
      message:
        'UTR submitted. Please wait for payment confirmation — this can take up to 24 hours. Membership activates after we verify your payment.',
      payment: toPublicPayment(paymentDoc),
      orderId: paymentDoc.orderId,
      status: 'pending'
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This UTR was just submitted by someone else. Contact support if this is your payment.'
      });
    }
    console.error('[Payment] utr submit error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to submit UTR payment.'
    });
  }
};

/**
 * POST /api/payment/admin/:id/approve-utr
 */
export const approveUtrPayment = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment id is required.' });
    }

    const payment = await Payment.findById(id).select('+pendingByokCipher');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    if (payment.gateway !== 'utr') {
      return res.status(400).json({ success: false, message: 'Only UTR payments can be approved here.' });
    }
    if (payment.status === 'paid' && payment.membershipActivated) {
      return res.json({
        success: true,
        message: 'Already approved and activated.',
        payment: toPublicPayment(payment)
      });
    }
    if (payment.status !== 'pending' && payment.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve payment in status "${payment.status}".`
      });
    }

    const adminNote = String(req.body?.adminNote || '').trim().slice(0, 500);
    payment.status = 'paid';
    payment.paymentMethod = payment.paymentMethod || 'upi';
    payment.failureReason = null;
    payment.reviewedBy = req.user?._id || req.user?.id || null;
    payment.reviewedAt = new Date();
    if (adminNote) payment.adminNote = adminNote;
    await payment.save();

    let activation;
    try {
      activation = await activateMembershipFromPayment(payment);
    } catch (actErr) {
      console.error('[Payment] UTR approve activation failed:', actErr);
      return res.status(actErr.statusCode || 500).json({
        success: true,
        paymentApproved: true,
        membershipActivated: false,
        message:
          actErr.message ||
          'UTR approved but membership activation failed. Retry or activate manually.',
        payment: toPublicPayment(payment)
      });
    }

    return res.json({
      success: true,
      paymentApproved: true,
      membershipActivated: !!activation.activated,
      message: activation.activated
        ? 'UTR verified. Membership activated.'
        : 'UTR marked paid.',
      payment: toPublicPayment(payment),
      user: activation.user || null
    });
  } catch (err) {
    console.error('[Payment] approve-utr error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to approve UTR payment.'
    });
  }
};

/**
 * POST /api/payment/admin/:id/reject-utr
 */
export const rejectUtrPayment = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment id is required.' });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    if (payment.gateway !== 'utr') {
      return res.status(400).json({ success: false, message: 'Only UTR payments can be rejected here.' });
    }
    if (payment.status === 'paid' || payment.membershipActivated) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a payment that is already paid / activated.'
      });
    }
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject payment in status "${payment.status}".`
      });
    }

    const reason = String(req.body?.reason || req.body?.adminNote || '').trim().slice(0, 500);
    payment.status = 'failed';
    payment.failureReason = reason || 'UTR rejected by admin';
    payment.adminNote = reason || payment.adminNote;
    payment.reviewedBy = req.user?._id || req.user?.id || null;
    payment.reviewedAt = new Date();
    await payment.save();

    return res.json({
      success: true,
      message: 'UTR payment rejected.',
      payment: toPublicPayment(payment)
    });
  } catch (err) {
    console.error('[Payment] reject-utr error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to reject UTR payment.'
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
    const maxLimit = String(req.query.export || '') === '1' ? 5000 : 100;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status && ['created', 'pending', 'paid', 'failed'].includes(status)) {
      filter.status = status;
    }

    const gateway = String(req.query.gateway || '').trim().toLowerCase();
    if (gateway && ['razorpay', 'utr'].includes(gateway)) {
      filter.gateway = gateway;
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { orderId: rx },
        { paymentId: rx },
        { utr: rx },
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
      totalPendingCount: 0,
      utrPendingCount: 0
    };

    for (const row of aggregates) {
      if (row._id === 'paid') {
        summary.totalSuccessCount = row.count;
        summary.totalRevenue = row.revenue;
      } else if (row._id === 'failed') {
        summary.totalFailedCount = row.count;
      } else if (row._id === 'created' || row._id === 'pending') {
        summary.totalPendingCount += row.count;
        if (row._id === 'pending') summary.utrPendingCount = row.count;
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
 * POST /api/payment/admin/import
 * Bulk upsert payment rows from CSV/JSON import (matched by orderId).
 */
export const importAdminPayments = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.payments) ? req.body.payments : [];
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No payment rows to import.' });
    }
    if (rows.length > 2000) {
      return res.status(400).json({ success: false, message: 'Import limit is 2000 rows per request.' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const orderId = String(row.orderId || '').trim();
      const amount = Number(row.amount);
      if (!orderId || !Number.isFinite(amount) || amount < 1) {
        skipped += 1;
        errors.push({ row: i + 1, message: 'orderId and amount (>=1) are required.' });
        continue;
      }

      const statusRaw = String(row.status || 'created').trim().toLowerCase();
      const status = ['created', 'pending', 'paid', 'failed'].includes(statusRaw) ? statusRaw : 'created';
      const gatewayRaw = String(row.gateway || 'razorpay').trim().toLowerCase();
      const gateway = ['razorpay', 'utr'].includes(gatewayRaw) ? gatewayRaw : 'razorpay';

      const payload = {
        orderId,
        amount,
        currency: String(row.currency || 'INR').trim().toUpperCase() || 'INR',
        status,
        gateway,
        paymentId: row.paymentId ? String(row.paymentId).trim() : null,
        paymentMethod: row.paymentMethod ? String(row.paymentMethod).trim() : null,
        utr: row.utr ? String(row.utr).trim().toUpperCase() : null,
        failureReason: row.failureReason ? String(row.failureReason).trim() : null,
        adminNote: row.adminNote ? String(row.adminNote).trim() : null,
        planId: row.planId ? String(row.planId).trim() : null,
        planName: row.planName ? String(row.planName).trim() : null,
        membershipActivated:
          row.membershipActivated === true ||
          String(row.membershipActivated || '').toLowerCase() === 'true' ||
          String(row.membershipActivated || '') === '1',
        customerDetails: {
          name: String(row.customerName || row.name || '').trim(),
          email: String(row.customerEmail || row.email || '')
            .trim()
            .toLowerCase(),
          phone: String(row.customerPhone || row.phone || '').trim()
        }
      };

      try {
        const existing = await Payment.findOne({ orderId });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          updated += 1;
        } else {
          await Payment.create(payload);
          created += 1;
        }
      } catch (err) {
        skipped += 1;
        errors.push({ row: i + 1, orderId, message: err.message || 'Import failed' });
      }
    }

    return res.json({
      success: true,
      message: `Import done — ${created} created, ${updated} updated, ${skipped} skipped.`,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 50)
    });
  } catch (err) {
    console.error('[Payment] admin import error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to import payments.'
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
