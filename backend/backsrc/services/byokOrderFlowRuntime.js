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

    // Board data is always the shared platform Order Flow file (fast).
    // BYOK only tags the feed + gates access; do not block on Upstox instrument maps.
    if (feed.provider === 'upstox') {
      let handle = this.handles.get(userId);
      if (!handle || handle.providerId !== 'upstox') {
        handle = {
          providerId: 'upstox',
          provider: null,
          feed: feed.feed,
          lastTouch: Date.now(),
          ready: true,
          lastError: null,
          accessToken: feed.session?.accessToken || feed.secrets?.accessToken || null
        };
        this.handles.set(userId, handle);
        // Warm Upstox adapter in the background (optional); never delay /status or /market.
        void this._warmUpstox(userId, feed).catch(() => {});
      }
      handle.lastTouch = Date.now();
      handle.feed = feed.feed;
      return { mode: 'byok', feed: feed.feed, handle };
    }

    // Kotak / Groww / Angel BYOK — same shared board, tagged as BYOK.
    return {
      mode: 'byok',
      feed: feed.feed,
      handle: {
        providerId: feed.provider,
        provider: null,
        feed: feed.feed,
        ready: true,
        lastError: null
      }
    };
  }

  async _warmUpstox(userId, feed) {
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
    const handle = this.handles.get(userId);
    if (handle && handle.providerId === 'upstox') {
      handle.provider = upstox;
      handle.ready = true;
      handle.lastTouch = Date.now();
    }
  }

  getStatus(ctx) {
    const base = orderFlowService.getStatus() || {};
    if (ctx.mode === 'server') {
      const feed = ctx.feed || { mode: 'server', provider: base.provider?.id || 'kotak', label: 'Platform' };
      return {
        ...base,
        feed,
        // FlowStatus expects { id, label, alwaysLive }
        provider: {
          id: base.provider?.id || feed.provider || 'kotak',
          label: feed.label || base.provider?.label || 'Platform',
          alwaysLive: Boolean(base.provider?.alwaysLive)
        }
      };
    }
    const h = ctx.handle;
    const feed = ctx.feed || h?.feed || { mode: 'byok', provider: h?.providerId || null, label: 'BYOK' };
    const providerId = h?.providerId || feed.provider || 'byok';
    // Use platform board readiness — BYOK is a feed tag, not a separate slow pipe.
    return {
      ...base,
      ready: Boolean(base.ready || h?.ready),
      feed,
      provider: {
        id: providerId,
        label: feed.label || `BYOK · ${providerId}`,
        // Match platform cadence — alwaysLive would spam futures polls.
        alwaysLive: Boolean(base.provider?.alwaysLive)
      },
      lastError: h?.lastError || base.lastError || null,
      session: base.session || null
    };
  }
}

export const byokOrderFlowRuntime = new ByokOrderFlowRuntime();
