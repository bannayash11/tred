/**
 * Per-user Order Flow for BYOK members.
 * Upstox BYOK → user access token. Other brokers → clear status until adapter is ready.
 * Server-plan users keep the shared orderFlowService.
 */
import { resolveUserMarketFeed } from './byokSessionService.js';
import { createUpstoxOrderFlowProvider } from './upstoxOrderFlowProvider.js';
import { orderFlowService } from './orderFlowService.js';

const IDLE_TTL_MS = 20 * 60 * 1000;

class ByokOrderFlowRuntime {
  constructor() {
    this.handles = new Map();
  }

  gc() {
    const now = Date.now();
    for (const [id, h] of this.handles) {
      if (now - h.lastTouch > IDLE_TTL_MS) this.handles.delete(id);
    }
  }

  async resolve(user) {
    const feed = await resolveUserMarketFeed(user);
    if (feed.mode === 'server') {
      return { mode: 'server', feed: feed.feed, service: orderFlowService };
    }
    if (!feed.connected) {
      const err = new Error(feed.error || 'Connect your broker for Order Flow.');
      err.statusCode = 403;
      err.feed = feed.feed;
      throw err;
    }

    const userId = String(user._id || user.id);
    this.gc();

    if (feed.provider === 'upstox') {
      let handle = this.handles.get(userId);
      if (!handle || handle.providerId !== 'upstox') {
        const universe = orderFlowService.getUniverse?.() || orderFlowService.universe || [];
        const list =
          universe.length > 0
            ? universe
            : [
                { symbol: 'NIFTY', exch: 'NSE' },
                { symbol: 'BANKNIFTY', exch: 'NSE' },
                { symbol: 'RELIANCE', exch: 'NSE' },
                { symbol: 'SBIN', exch: 'NSE' },
                { symbol: 'HDFCBANK', exch: 'NSE' },
                { symbol: 'INFY', exch: 'NSE' },
                { symbol: 'TCS', exch: 'NSE' }
              ];
        const upstox = createUpstoxOrderFlowProvider(list, {
          accessToken: feed.session?.accessToken || feed.secrets?.accessToken
        });
        await upstox.init();
        handle = {
          providerId: 'upstox',
          provider: upstox,
          feed: feed.feed,
          lastTouch: Date.now(),
          ready: true,
          lastError: null
        };
        this.handles.set(userId, handle);
      }
      handle.lastTouch = Date.now();
      return { mode: 'byok', feed: feed.feed, handle };
    }

    // Kotak / Groww / Angel — reuse platform market board for display but tag feed;
    // futures/chain for non-Upstox BYOK still need dedicated OF adapters.
    return {
      mode: 'byok',
      feed: feed.feed,
      handle: {
        providerId: feed.provider,
        provider: null,
        feed: feed.feed,
        ready: false,
        lastError: {
          message: `Order Flow live board for ${feed.provider} BYOK is not fully wired yet. Use Upstox BYOK for Order Flow, or a Platform plan.`
        }
      }
    };
  }

  getStatus(ctx) {
    if (ctx.mode === 'server') {
      return { ...orderFlowService.getStatus(), feed: ctx.feed };
    }
    const h = ctx.handle;
    return {
      ready: !!h?.ready,
      feed: ctx.feed || h?.feed,
      provider: h?.feed || ctx.feed,
      lastError: h?.lastError || null,
      session: orderFlowService.getStatus()?.session || null
    };
  }
}

export const byokOrderFlowRuntime = new ByokOrderFlowRuntime();
