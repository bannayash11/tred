import mongoose from 'mongoose';

/** true when mongoose has an active connection */
export function isDbReady() {
  return mongoose.connection.readyState === 1;
}

export function allowMemoryAuth() {
  // Explicit opt-in only — memory users vanish on every deploy/restart
  return process.env.ALLOW_MEMORY_AUTH === '1' && process.env.NODE_ENV !== 'production';
}

export function dbUnavailableResponse(res, action = 'complete this request') {
  return res.status(503).json({
    success: false,
    message: `Database unavailable. Cannot ${action}. Please try again in a moment.`
  });
}
