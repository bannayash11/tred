import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { execSync } from 'child_process';

import authRoutes from './routes/authRoutes.js';
import screenerRoutes from './routes/screenerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import cmsRoutes from './routes/cmsRoutes.js';
import orderFlowRoutes from './routes/orderFlowRoutes.js';
import directionalScannerRoutes from './routes/directionalScannerRoutes.js';
import alphaMove2Routes from './routes/alphaMove2Routes.js';
import paymentRoutes, { handlePaymentWebhook } from './routes/paymentRoutes.js';
import { marketDataService } from './services/marketDataService.js';
import { orderFlowService } from './services/orderFlowService.js';
import { seedDefaultAdmin } from './utils/seedDefaultAdmin.js';
import { JWT_SECRET, memoryUsers } from './middleware/authMiddleware.js';
import { isSubscriptionActive } from './utils/security.js';
import { User } from './models/User.js';
import {
  loadByokSettingsFromDb,
  loadFreeTrialSettingsFromDb,
  loadPlansFromDb
} from './services/membershipPlans.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
  'http://localhost:3004',
  'http://127.0.0.1:3004',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://violet-lark-104376.hostingersite.com',
  'https://darkslateblue-dotterel-519318.hostingersite.com',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : [])
];

// Enable CORS for frontend Vite client
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / same-origin tools (no Origin header)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

/**
 * Razorpay webhook MUST receive the raw body for HMAC verification.
 * Mount this BEFORE express.json() — otherwise req.body is already parsed
 * and x-razorpay-signature checks will fail.
 */
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  handlePaymentWebhook
);

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/screener/live')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/order-flow', orderFlowRoutes);
app.use('/api/directional-scanner', directionalScannerRoutes);
app.use('/api/alpha-move-2', alphaMove2Routes);
app.use('/api/payment', paymentRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    mode: 'Smart Money Concepts & Order Block Analytics Terminal',
    timestamp: new Date().toISOString()
  });
});

async function resolveSocketUser(token) {
  if (!token || token === 'null' || token === 'undefined') return null;
  if (token === 'demo-admin-token' || token === 'demo-user-token' || token === 'demo-subadmin-token') {
    return null;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  try {
    const user = await User.findById(decoded.id).select('-password');
    if (user) return user;
  } catch {
    // DB offline
  }
  const mem = memoryUsers.get(String(decoded.id));
  if (!mem) return null;
  const { password: _pw, ...safe } = mem;
  return safe;
}

// Socket.io — require JWT + active membership before market data
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      socket.handshake.query?.token;
    const user = await resolveSocketUser(token);
    if (!user) {
      return next(new Error('Authentication required'));
    }
    if (!isSubscriptionActive(user)) {
      return next(new Error('Active membership required'));
    }
    socket.data.user = user;
    return next();
  } catch (err) {
    return next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id} (${socket.data.user?.email || 'user'})`);

  socket.emit('INITIAL_STATE', {
    screener: marketDataService.getScreenerData(),
    marketXRay: marketDataService.getMarketXRay(),
    openingMomentum: marketDataService.getOpeningMomentumData()
  });

  socket.on('SUBSCRIBE_STOCK', (symbol) => {
    if (!socket.data.user || !isSubscriptionActive(socket.data.user)) return;
    if (symbol) marketDataService.addPriorityStock(symbol);
  });

  socket.on('UNSUBSCRIBE_STOCK', (symbol) => {
    if (symbol) marketDataService.removePriorityStock(symbol);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// MongoDB Connection — must be a persistent URI (e.g. MongoDB Atlas) on live hosts.
// Local 127.0.0.1 data is wiped if the server filesystem resets on each deploy.
// Accept MONGO_URI or MONGODB_URI (Hostinger / common convention).
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/tradrift_db';
const isLiveHost =
  process.env.NODE_ENV === 'production' ||
  process.env.REQUIRE_MONGO === '1' ||
  (!!MONGO_URI && !/127\.0\.0\.1|localhost/.test(MONGO_URI));

async function connectMongo(attempt = 1) {
  const maxAttempts = isLiveHost ? 8 : 3;
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000
    });
    console.log('[MongoDB] Connected successfully to database.');
    try {
      await seedDefaultAdmin();
    } catch (seedErr) {
      console.error('[Seed] Failed to seed default admin:', seedErr.message || seedErr);
    }
    try {
      await Promise.all([
        loadPlansFromDb(),
        loadByokSettingsFromDb(),
        loadFreeTrialSettingsFromDb()
      ]);
      console.log('[Membership] Plans + BYOK + free-trial settings loaded from DB.');
    } catch (planErr) {
      console.warn('[Membership] Using default in-memory plans:', planErr.message || planErr);
    }
  } catch (err) {
    console.error(
      `[MongoDB] Connection failed (attempt ${attempt}/${maxAttempts}):`,
      err.message || err
    );
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
      setTimeout(() => connectMongo(attempt + 1), delay);
      return;
    }
    if (isLiveHost) {
      console.error(
        '[MongoDB] FATAL: Set a persistent MONGO_URI or MONGODB_URI (MongoDB Atlas recommended). ' +
          'Without it, user accounts will not survive deploys.'
      );
      process.exit(1);
    }
    console.warn(
      '[MongoDB] Offline. Auth requires DB unless ALLOW_MEMORY_AUTH=1 (dev only — data lost on restart).'
    );
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected — will rely on mongoose auto-reconnect.');
});
mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected.');
});

connectMongo();

// Initialize Market Data & SMC Engine
marketDataService.initialize(io);

// Initialize Kotak-powered Order Flow board builder
orderFlowService.initialize().catch((err) => {
  console.error('[OrderFlow] Failed to initialize:', err.message || err);
});

// Crash Prevention: Global Handlers
process.on('uncaughtException', (err) => {
  console.error('🛡️ [SERVER PROTECTED - UNCAUGHT EXCEPTION]:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('🛡️ [SERVER PROTECTED - UNHANDLED REJECTION]:', reason);
});

const PORT = process.env.PORT || 5001;

function freePort(port) {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    if (!out) return;
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      if (String(pid) === String(process.pid)) continue;
      console.warn(`⚠️ [SERVER] Port ${port} busy — killing pid ${pid}`);
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

function listenWithRetry(attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 3) {
      freePort(PORT);
      setTimeout(() => listenWithRetry(attempt + 1), 400);
      return;
    }
    console.error('[Server Error]', err);
    process.exit(1);
  });
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Tradrift Analytics Server running on port ${PORT}`);
    console.log(`📊 Real-Time SMC Engine Active with 30+ F&O Stocks`);
    console.log(`⚡ WebSocket / Socket.io server ready for connections`);
    console.log(`=======================================================`);
  });
}

listenWithRetry();
