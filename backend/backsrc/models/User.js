import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'subadmin', 'admin'],
    default: 'user'
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  isAdultConfirmed: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  activeSessions: [
    {
      id: String,
      device: String,
      browser: String,
      ip: String,
      location: String,
      lastActive: { type: Date, default: Date.now }
    }
  ],
  securityLogs: [
    {
      action: String,
      ip: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  subscription: {
    status: {
      type: String,
      enum: ['active', 'expired', 'trial'],
      // Default OFF — no free trial unless admin enables + register applies it
      default: 'expired'
    },
    plan: {
      type: String,
      default: 'No Active Plan'
    },
    planId: {
      type: String,
      default: null
    },
    /** server = shared Tradrift feed | byok = user broker keys | trial */
    mode: {
      type: String,
      enum: ['server', 'byok', 'trial'],
      default: 'server'
    },
    /**
     * Grandfather flag: if admin turns BYOK sales OFF, users who already
     * purchased BYOK keep access while this stays true.
     */
    byokGranted: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() - 60_000)
    }
  },
  /** Encrypted BYOK broker bundle — secrets never leave the server plaintext */
  byok: {
    provider: { type: String, default: null },
    status: {
      type: String,
      enum: ['none', 'pending', 'connected', 'error'],
      default: 'none'
    },
    connectedAt: { type: Date, default: null },
    lastValidatedAt: { type: Date, default: null },
    uccMasked: { type: String, default: null },
    mobileMasked: { type: String, default: null },
    consumerKeyMasked: { type: String, default: null },
    secretsCipher: { type: String, default: null, select: false },
    sessionCipher: { type: String, default: null, select: false },
    lastError: { type: String, default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
