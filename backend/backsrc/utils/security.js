import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/** Simple in-memory rate limiter: key -> { count, resetAt } */
const rateBuckets = new Map();

export function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= maxAttempts,
    remaining: Math.max(0, maxAttempts - bucket.count),
    retryAfterMs: Math.max(0, bucket.resetAt - now)
  };
}

export function hashSecret(value) {
  return bcrypt.hash(String(value), 10);
}

export function compareSecret(value, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(value), hash);
}

/** One-time codes: store SHA-256 so we never keep plaintext recovery/2FA codes */
export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

export function timingSafeEqualHex(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function generateNumericCode(digits = 6) {
  const max = 10 ** digits;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(digits, '0');
}

export function isSubscriptionActive(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'subadmin') return true;
  const sub = user.subscription;
  if (!sub) return false;
  if (sub.status === 'expired') return false;
  if (sub.expiresAt) {
    const exp = new Date(sub.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return false;
  }
  return sub.status === 'active' || sub.status === 'trial';
}

export function maskBrokerSettings(settings = {}) {
  const copy = JSON.parse(JSON.stringify(settings));
  if (copy.dhanConfig?.accessToken) {
    const token = String(copy.dhanConfig.accessToken);
    if (token && !token.startsWith('•')) {
      copy.dhanConfig.accessToken = '••••••••••••••••••••••••••••••••';
    }
  }
  return copy;
}

/** Only same-app relative paths: /foo — reject //evil.com, http://..., etc. */
export function safeRelativePath(raw, fallback = '/') {
  if (!raw || typeof raw !== 'string') return fallback;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  return path;
}
