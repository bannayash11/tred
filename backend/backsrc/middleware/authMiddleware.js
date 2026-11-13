import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { allowMemoryAuth } from '../utils/db.js';
import { isSubscriptionActive } from '../utils/security.js';

// Must load before JWT_SECRET resolution (ESM imports run before server.js body)
dotenv.config();

const WEAK_DEFAULTS = new Set([
  'tred_secret_jwt_key_2026',
  'change_me_to_a_long_random_secret',
  'secret',
  'jwt_secret'
]);

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 16 || WEAK_DEFAULTS.has(String(secret).trim())) {
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_JWT_SECRET === '1') {
      console.error(
        '[Auth] JWT_SECRET is missing or weak. Set a strong JWT_SECRET (16+ chars) in the environment.'
      );
      process.exit(1);
    }
    if (!global.__tredEphemeralJwtSecret) {
      global.__tredEphemeralJwtSecret = crypto.randomBytes(48).toString('hex');
      console.warn(
        '[Auth] JWT_SECRET missing/weak — using ephemeral dev secret. Set JWT_SECRET before deploying.'
      );
    }
    return global.__tredEphemeralJwtSecret;
  }
  return String(secret).trim();
}

export const JWT_SECRET = resolveJwtSecret();

// Offline / in-memory users created when MongoDB is unavailable
export const memoryUsers = new Map();

export const signToken = (user, expiresIn = '7d') =>
  jwt.sign(
    {
      id: String(user._id || user.id),
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn }
  );

export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. Missing bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ success: false, message: 'Authentication required. Invalid token.' });
    }

    // Reject legacy static demo tokens
    if (token === 'demo-admin-token' || token === 'demo-user-token' || token === 'demo-subadmin-token') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
    }

    // Prefer live DB user so role / subscription / revocation stay fresh
    try {
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      // DB offline — fall through to memory map only
    }

    if (allowMemoryAuth()) {
      const memUser = memoryUsers.get(String(decoded.id));
      if (memUser) {
        const { password: _pw, ...safeMemUser } = memUser;
        req.user = safeMemUser;
        return next();
      }
    }

    return res.status(401).json({ success: false, message: 'User not found or session invalid.' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', error: error.message });
  }
};

export const requireActiveSubscription = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (!isSubscriptionActive(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Active membership required. Renew or upgrade your plan to access this feature.'
    });
  }
  return next();
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied: Super Admin privileges required.' });
};

export const subAdminOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'subadmin')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied: Admin or Sub-Admin privileges required.' });
};
