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
      default: 'trial'
    },
    plan: {
      type: String,
      default: '14-Day Free Trial'
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
    }
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
