import express from 'express';
import {
  createOrder,
  verifyPayment,
  markPaymentFailed,
  handlePaymentWebhook,
  getAdminPayments,
  getMyPaymentHistory,
  cancelMembership
} from '../controllers/paymentController.js';
import { authMiddleware, subAdminOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Membership checkout requires login — payment confirm then activates plan
router.post('/create-order', authMiddleware, createOrder);
router.post('/verify', authMiddleware, verifyPayment);
router.post('/failed', authMiddleware, markPaymentFailed);
router.get('/my-history', authMiddleware, getMyPaymentHistory);
router.post('/cancel-membership', authMiddleware, cancelMembership);

/**
 * Webhook is registered in server.js with express.raw() BEFORE express.json().
 * This export is kept for documentation / alternate mounting.
 * Do NOT mount this route after express.json() or signature verification will fail.
 */
export { handlePaymentWebhook };

// Admin payment tracking
router.get('/admin/all', authMiddleware, subAdminOrAdmin, getAdminPayments);

export default router;
