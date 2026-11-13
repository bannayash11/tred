import mongoose from 'mongoose';

const customerDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    customerDetails: {
      type: customerDetailsSchema,
      default: () => ({})
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    paymentId: {
      type: String,
      default: null,
      index: true
    },
    signature: {
      type: String,
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
      index: true
    },
    paymentMethod: {
      type: String,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },
    /** Membership plan purchased with this payment */
    planId: {
      type: String,
      default: null,
      index: true
    },
    planName: {
      type: String,
      default: null
    },
    /** Set true only after membership is activated post-payment */
    membershipActivated: {
      type: Boolean,
      default: false,
      index: true
    },
    /**
     * Encrypted BYOK bundle prepared at create-order (after broker validation).
     * Cleared once membership is activated.
     */
    pendingByokCipher: {
      type: String,
      default: null,
      select: false
    }
  },
  { timestamps: true }
);

paymentSchema.index({ 'customerDetails.email': 1 });
paymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
