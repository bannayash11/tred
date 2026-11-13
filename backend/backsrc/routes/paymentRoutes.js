import express from 'express';
import {
  createOrder,
  verifyPayment,
  markPaymentFailed,
  handlePaymentWebhook,
  getAdminPayments,
  importAdminPayments,
  getMyPaymentHistory,
  cancelMembership,
  getUtrConfig,
  submitUtrPayment,
  approveUtrPayment,
  rejectUtrPayment
} from '../controllers/paymentController.js';
import { authMiddleware, subAdminOrAdmin, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Membership checkout requires login — payment confirm then activates plan
router.post('/create-order', authMiddleware, createOrder);
router.post('/verify', authMiddleware, verifyPayment);
router.post('/failed', authMiddleware, markPaymentFailed);
router.get('/my-history', authMiddleware, getMyPaymentHistory);
router.post('/cancel-membership', authMiddleware, cancelMembership);

// Manual UPI / UTR flow (alongside Razorpay)
router.get('/utr-config', getUtrConfig);
router.post('/utr/submit', authMiddleware, submitUtrPayment);

/**
 * Webhook is registered in server.js with express.raw() BEFORE express.json().
 * This export is kept for documentation / alternate mounting.
 * Do NOT mount this route after express.json() or signature verification will fail.
 */
export { handlePaymentWebhook };

// Admin payment tracking + UTR verification
router.get('/admin/all', authMiddleware, subAdminOrAdmin, getAdminPayments);
router.post('/admin/import', authMiddleware, adminOnly, importAdminPayments);
router.post('/admin/:id/approve-utr', authMiddleware, subAdminOrAdmin, approveUtrPayment);
router.post('/admin/:id/reject-utr', authMiddleware, subAdminOrAdmin, rejectUtrPayment);

export default router;
