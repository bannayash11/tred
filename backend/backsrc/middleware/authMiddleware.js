import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'tred_secret_jwt_key_2026';

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

    const memUser = memoryUsers.get(String(decoded.id));
    if (memUser) {
      const { password: _pw, ...safeMemUser } = memUser;
      req.user = safeMemUser;
      return next();
    }

    try {
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      // DB offline — do not elevate privileges
    }

    return res.status(401).json({ success: false, message: 'User not found or session invalid.' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', error: error.message });
  }
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
