import WebSocket from 'ws';

/**
 * Kotak Neo SFeed market-data WebSocket (native_batch).
 * Streams live LTP ticks without REST quote polling.
 * Guide: https://www.kotakneo.com/uploads/kotak_neo_market_data_websocket_guide_38e4831feb.pdf
 */

const EXCHANGE_BY_ID = {
  1: 'nse_cm',
  2: 'nse_fo',
  3: 'cde_fo',
  4: 'nse_com',
  5: 'bse_cm',
  6: 'bse_fo',
  7: 'bse_cd',
  8: 'bse_co',
  9: 'mcx_fo',
  10: 'ncd_co'
};

const DEFAULT_DIVIDER = 100;

function readU16(buf, o) {
  return buf.readUInt16LE(o);
}
function readI8(buf, o) {
  return buf.readInt8(o);
}
function readU8(buf, o) {
  return buf.readUInt8(o);
}
function readU32(buf, o) {
  return buf.readUInt32LE(o);
}
function readI32(buf, o) {
  return buf.readInt32LE(o);
}
function readI64(buf, o) {
  return Number(buf.readBigInt64LE(o));
}
function readF64(buf, o) {
  return buf.readDoubleLE(o);
}

export class KotakFeedWs {
  constructor({ ucc, authToken, feedUrl, tokens = [], onTicks, onStatus } = {}) {
    this.ucc = ucc;
    this.authToken = authToken;
    this.feedUrl = feedUrl;
    this.tokens = tokens; // [{ segment, token, symbol }]
    this.onTicks = onTicks;
    this.onStatus = onStatus;

    this.ws = null;
    this.dividers = new Map(); // exchange_id → divider
    this.tokenToSymbol = new Map(); // `${segment}|${token}` → symbol
    this.alive = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.authFailCount = 0;
    this._closed = false;
  }

  start() {
    this._closed = false;
    this.connect();
  }

  stop() {
    this._closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.alive = false;
    try {
      this.ws?.removeAllListeners();
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  connect() {
    if (this._closed) return;
    if (!this.feedUrl || !this.ucc || !this.authToken) {
      this.onStatus?.({ ok: false, message: 'Missing feedUrl / ucc / auth for Kotak WS' });
      return;
    }

    const url = String(this.feedUrl).replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    this.onStatus?.({ ok: false, message: `Connecting Kotak SFeed ${url}` });

    for (const row of this.tokens) {
      if (!row?.segment || !row?.token || !row?.symbol) continue;
      this.tokenToSymbol.set(`${row.segment}|${row.token}`, row.symbol);
      // also key by token alone (binary packets carry token + exchange)
      this.tokenToSymbol.set(`${row.token}`, row.symbol);
    }

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.onStatus?.({ ok: false, message: `WS create failed: ${err.message}` });
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.binaryType = 'nodebuffer';

    ws.on('open', () => {
      const auth = {
        user: this.ucc,
        auth: this.authToken,
        format: 'native_batch',
        source: 'NEOTRADEAPI',
        sdk_version: 1.1,
        sdk_date: '2026-11-11'
      };
      ws.send(JSON.stringify(auth));
    });

    ws.on('message', (data, isBinary) => {
      try {
        if (!isBinary && typeof data !== 'string' && !Buffer.isBuffer(data)) return;
        const asBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        // Text frame if looks like JSON
        if (!isBinary || asBuf[0] === 0x7b /* { */) {
          const text = asBuf.toString('utf8');
          if (text.trim().startsWith('{')) {
            this.handleControl(JSON.parse(text));
            return;
          }
        }
        this.handleBinary(asBuf);
      } catch (err) {
        console.warn('[KotakFeedWs] message error:', err.message);
      }
    });

    ws.on('close', () => {
      this.alive = false;
      this.onStatus?.({ ok: false, message: 'Kotak SFeed closed' });
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.warn('[KotakFeedWs] socket error:', err.message);
    });
  }

  scheduleReconnect(forcedWaitMs) {
    if (this._closed) return;
    if (this.reconnectTimer) return;
    // Auth storms (Matrix Auth failed) were burning Kotak rate limits and starving Order Flow REST.
    const wait =
      forcedWaitMs != null
        ? forcedWaitMs
        : Math.min(60_000, 2000 * 2 ** Math.min(this.reconnectAttempt, 5));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, wait);
  }

  handleControl(msg) {
    const code = Number(msg?.message_code);
    if (code === 1120) {
      this.authFailCount += 1;
      this.onStatus?.({
        ok: false,
        message: msg?.message || 'Kotak SFeed auth failed'
      });
      try {
        this.ws?.removeAllListeners();
        this.ws?.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
      this.alive = false;
      // Matrix auth flaps burn Kotak HTTPS quota — cool down hard after the first failure.
      const coolDown = this.authFailCount >= 2 ? 15 * 60_000 : 5 * 60_000;
      console.warn(
        `[KotakFeedWs] Matrix auth failed ×${this.authFailCount} — cooling ${Math.round(coolDown / 1000)}s for Order Flow REST`
      );
      this.scheduleReconnect(coolDown);
      return;
    }

    if (code === 1117 || code === 1119) {
      const exchanges = msg?.exchanges || {};
      for (const [name, meta] of Object.entries(exchanges)) {
        const id = Object.entries(EXCHANGE_BY_ID).find(([, n]) => n === name)?.[0];
        const div = Number(meta?.divider) || DEFAULT_DIVIDER;
        if (id != null) this.dividers.set(Number(id), div);
        this.dividers.set(name, div);
      }
      if (code === 1117) {
        this.alive = true;
        this.reconnectAttempt = 0;
        this.authFailCount = 0;
        this.onStatus?.({ ok: true, message: 'Kotak SFeed authenticated' });
        this.subscribeAll();
      }
    }
  }

  subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const scrips = [];
    const indices = [];
    for (const row of this.tokens) {
      const key = `${row.segment}|${row.token}`;
      if (row.kind === 'index' || /NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY/i.test(row.symbol)) {
        // Prefer index channel when segment is fo index-like; also subscribe as scrip token
        indices.push(key);
      }
      scrips.push(key);
    }

    const chunk = (arr, n = 80) => {
      for (let i = 0; i < arr.length; i += n) {
        const slice = arr.slice(i, i + n).join(',');
        if (!slice) continue;
        this.ws.send(JSON.stringify({ event: 'subscribeScrips', inputtoken: slice, ack_symbol: true }));
      }
    };
    chunk(scrips);

    if (indices.length) {
      // Named index subscriptions (NSE CM style names help for Nifty 50)
      const named = [];
      for (const row of this.tokens) {
        if (row.symbol === 'NIFTY 50') named.push('nse_cm|Nifty 50');
        else if (row.symbol === 'BANKNIFTY') named.push('nse_cm|Nifty Bank');
      }
      const indexTokens = [...new Set([...indices, ...named])].join(',');
      if (indexTokens) {
        this.ws.send(JSON.stringify({ event: 'subscribeIndices', inputtoken: indexTokens, ack_symbol: true }));
      }
    }
  }

  dividerFor(exchangeId) {
    return this.dividers.get(exchangeId) || this.dividers.get(EXCHANGE_BY_ID[exchangeId]) || DEFAULT_DIVIDER;
  }

  handleBinary(frame) {
    const ticks = [];
    let offset = 0;
    while (offset + 2 <= frame.length) {
      const size = readU16(frame, offset);
      if (size < 9 || offset + size > frame.length) break;
      const packet = frame.subarray(offset, offset + size);
      offset += size;
      const tick = this.decodePacket(packet);
      if (tick) ticks.push(tick);
    }
    if (ticks.length && typeof this.onTicks === 'function') this.onTicks(ticks);
  }

  decodePacket(packet) {
    if (packet.length < 9) return null;
    const messageCode = readU16(packet, 2);
    const exchangeId = readI8(packet, 4);
    const level = readU8(packet, 5);
    const divider = this.dividerFor(exchangeId);
    const exchange = EXCHANGE_BY_ID[exchangeId] || 'nse_cm';

    if (messageCode === 7207) {
      return this.decodeIndex(packet, exchange, divider);
    }
    if (messageCode === 7208) {
      if (level === 1) return this.decodeMini(packet, exchange, divider);
      if (level === 2 || level === 4 || level === 8) return this.decodePicture(packet, exchange, divider);
    }
    return null;
  }

  resolveSymbol(exchange, token, name) {
    return (
      this.tokenToSymbol.get(`${exchange}|${token}`) ||
      this.tokenToSymbol.get(String(token)) ||
      (name && this.tokenToSymbol.get(name)) ||
      null
    );
  }

  decodeIndex(packet, exchange, divider) {
    if (packet.length < 62) return null;
    const token = readU32(packet, 9);
    const open = readI32(packet, 13) / divider;
    const close = readI32(packet, 17) / divider;
    const high = readI32(packet, 21) / divider;
    const low = readI32(packet, 25) / divider;
    const ltp = readI32(packet, 29) / divider;
    const chgPct = readI32(packet, 49) / 100;
    let name = '';
    if (packet.length >= 87) {
      name = packet.subarray(66, 87).toString('utf8').replace(/\0/g, '').trim();
    }
    const symbol =
      this.resolveSymbol(exchange, token, name) ||
      (name.toUpperCase().includes('BANK') ? 'BANKNIFTY' : name.toUpperCase().includes('NIFTY') ? 'NIFTY 50' : null);
    if (!symbol || !(ltp > 0)) return null;
    return {
      symbol,
      currentPrice: ltp,
      open,
      high,
      low,
      close: ltp,
      change: Number.isFinite(chgPct) ? chgPct : close ? ((ltp - close) / close) * 100 : 0,
      volume: 0,
      source: 'ws'
    };
  }

  decodeMini(packet, exchange, divider) {
    if (packet.length < 54) return null;
    const token = readU32(packet, 9);
    const ltp = readU32(packet, 21) / divider;
    const closeRaw = readU32(packet, 33); // quirk: often NOT divided
    const chgPct = readI32(packet, 37) / 100;
    const symbol = this.resolveSymbol(exchange, token);
    if (!symbol || !(ltp > 0)) return null;
    const prev = closeRaw > 10000 ? closeRaw : closeRaw / divider; // tolerate both shapes
    return {
      symbol,
      currentPrice: ltp,
      open: ltp,
      high: ltp,
      low: ltp,
      close: ltp,
      change: Number.isFinite(chgPct) ? chgPct : prev ? ((ltp - prev) / prev) * 100 : 0,
      volume: 0,
      source: 'ws'
    };
  }

  decodePicture(packet, exchange, divider) {
    if (packet.length < 144) return null;
    const token = readU32(packet, 9);
    const volume = readI64(packet, 29);
    const open = readU32(packet, 53) / divider;
    const close = readU32(packet, 57) / divider;
    const high = readU32(packet, 61) / divider;
    const low = readU32(packet, 65) / divider;
    const ltp = readU32(packet, 69) / divider;
    const chgPct = readI32(packet, 99) / 100;
    const symbol = this.resolveSymbol(exchange, token);
    if (!symbol || !(ltp > 0)) return null;
    return {
      symbol,
      currentPrice: ltp,
      open: open || ltp,
      high: high || ltp,
      low: low || ltp,
      close: ltp,
      change: Number.isFinite(chgPct) ? chgPct : close ? ((ltp - close) / close) * 100 : 0,
      volume: volume || 0,
      source: 'ws'
    };
  }
}
