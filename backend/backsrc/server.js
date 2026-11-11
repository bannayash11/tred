import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { execSync } from 'child_process';

import authRoutes from './routes/authRoutes.js';
import screenerRoutes from './routes/screenerRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import cmsRoutes from './routes/cmsRoutes.js';
import orderFlowRoutes from './routes/orderFlowRoutes.js';
import { marketDataService } from './services/marketDataService.js';
import { orderFlowService } from './services/orderFlowService.js';
import { seedDefaultAdmin } from './utils/seedDefaultAdmin.js';

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
app.use('/api/journal', journalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/order-flow', orderFlowRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    mode: 'Smart Money Concepts & Order Block Analytics Terminal',
    timestamp: new Date().toISOString()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send immediate initial screener, market x-ray, and opening momentum payload
  socket.emit('INITIAL_STATE', {
    screener: marketDataService.getScreenerData(),
    marketXRay: marketDataService.getMarketXRay(),
    openingMomentum: marketDataService.getOpeningMomentumData()
  });

  // Client requests continuous real-time priority ticks for a specific stock (e.g. Chart Modal)
  socket.on('SUBSCRIBE_STOCK', (symbol) => {
    if (symbol) {
      marketDataService.addPriorityStock(symbol);
    }
  });

  socket.on('UNSUBSCRIBE_STOCK', (symbol) => {
    if (symbol) {
      marketDataService.removePriorityStock(symbol);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/orderblock_db';
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('[MongoDB] Connected successfully to database.');
    try {
      await seedDefaultAdmin();
    } catch (seedErr) {
      console.error('[Seed] Failed to seed default admin:', seedErr.message || seedErr);
    }
  })
  .catch((err) => {
    console.warn('[MongoDB] Local MongoDB not detected or offline. Running in zero-config in-memory mode.');
  });

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
    console.log(`🚀 OrderBlock Analytics Server running on port ${PORT}`);
    console.log(`📊 Real-Time SMC Engine Active with 30+ F&O Stocks`);
    console.log(`⚡ WebSocket / Socket.io server ready for connections`);
    console.log(`=======================================================`);
  });
}

listenWithRetry();
