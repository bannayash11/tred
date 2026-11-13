/**
 * Multi-broker BYOK (Bring Your Own Key):
 * Upstox · Kotak Neo · Groww · Angel One
 *
 * Secrets encrypted at rest (AES-256-GCM). We validate once, store a session
 * ciphertext when the broker returns tokens, and never send secrets back to the client.
 */
import crypto from 'crypto';
import https from 'https';
import { encryptObject, decryptObject, maskSecret } from '../utils/cryptoSecrets.js';
import {
  assertByokFields,
  normalizeByokProvider
} from './byokBrokers.js';

/** Kotak/broker APIs often return message/error as objects — always coerce to a readable string. */
function brokerErrorMessage(payload, fallback = 'Broker request failed.') {
  if (payload == null || payload === '') return fallback;
  if (typeof payload === 'string') {
    const t = payload.trim();
    return t && t !== '[object Object]' ? t : fallback;
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (typeof payload === 'object') {
    const nested =
      payload.message ||
      payload.error ||
      payload.description ||
      payload.error_description ||
      payload.msg ||
      payload.detail;
    if (nested && nested !== payload) return brokerErrorMessage(nested, fallback);
    try {
      const json = JSON.stringify(payload);
      if (json && json !== '{}' && json !== '[]') return json.slice(0, 280);
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

function generateTOTP(secret) {
  if (!secret) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = String(secret).toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function httpsJson({ hostname, path, method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          ...headers,
          ...(payload
            ? {
                'Content-Type': headers['Content-Type'] || 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            : {})
        },
        timeout: 20_000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = JSON.parse(text);
          } catch {
            /* ignore */
          }
          resolve({ statusCode: res.statusCode, data, text });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Broker request timed out'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchJson(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { statusCode: res.status, data, text };
}

function dayExpiryIso(hours = 18) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** ── Upstox: order-flow-main style — daily access token ─────────────────── */
export async function createUpstoxSession(creds = {}) {
  const accessToken = String(creds.accessToken || '').trim();
  if (!accessToken) {
    const err = new Error('Upstox BYOK requires Access Token (from Upstox OAuth / developer app).');
    err.statusCode = 400;
    throw err;
  }

  const res = await fetchJson('https://api.upstox.com/v2/user/profile', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (res.statusCode !== 200 || res.data?.status === 'error') {
    const err = new Error(
      brokerErrorMessage(
        res.data?.errors?.[0]?.message || res.data?.message || res.data?.error,
        'Upstox access token invalid or expired. Generate a fresh token from Upstox developer login.'
      )
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    accessToken,
    profile: res.data?.data || null,
    createdAt: new Date().toISOString(),
    expiresAt: dayExpiryIso(16)
  };
}

/** ── Kotak Neo ──────────────────────────────────────────────────────────── */
export async function createKotakSession(creds = {}) {
  assertByokFields('kotak', creds);
  const consumerKey = String(creds.consumerKey || '').trim();
  const ucc = String(creds.ucc || '').trim();
  const mobileNumber = String(creds.mobileNumber || '').trim();
  const mpin = String(creds.mpin || '').trim();
  const totpKey = String(creds.totpKey || '').trim();

  const totp = generateTOTP(totpKey);
  const loginRes = await httpsJson({
    hostname: 'mis.kotaksecurities.com',
    path: '/login/1.0/tradeApiLogin',
    headers: {
      accept: 'application/json',
      Authorization: consumerKey,
      'neo-fin-key': 'neotradeapi'
    },
    body: { ucc, mobileNumber, totp }
  });

  if (loginRes.statusCode !== 200 || !loginRes.data?.data?.token) {
    const err = new Error(
      brokerErrorMessage(
        loginRes.data?.message || loginRes.data?.error || loginRes.data,
        'Kotak login failed. Check Consumer Key, UCC, mobile and TOTP.'
      )
    );
    err.statusCode = 400;
    throw err;
  }

  const viewToken = loginRes.data.data.token;
  const sid = loginRes.data.data.sid;

  const validateRes = await httpsJson({
    hostname: 'mis.kotaksecurities.com',
    path: '/login/1.0/tradeApiValidate',
    headers: {
      accept: 'application/json',
      Authorization: consumerKey,
      sid,
      Auth: viewToken,
      'neo-fin-key': 'neotradeapi'
    },
    body: { mpin }
  });

  if (validateRes.statusCode !== 200 || !validateRes.data?.data?.baseUrl) {
    const err = new Error(
      brokerErrorMessage(
        validateRes.data?.message || validateRes.data?.error || validateRes.data,
        'Kotak MPIN validation failed. Check MPIN and try again.'
      )
    );
    err.statusCode = 400;
    throw err;
  }

  const assignedUrl = String(validateRes.data.data.baseUrl)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const rawFeed = validateRes.data.data.feedUrl || validateRes.data.data.ftUrl || null;
  const feedUrl = rawFeed
    ? String(rawFeed).replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
    : 'wss://sfeed.kotaksecurities.com/apifeed';

  return {
    viewToken,
    sid,
    baseUrl: assignedUrl,
    feedUrl,
    createdAt: new Date().toISOString(),
    expiresAt: dayExpiryIso(18)
  };
}

/** ── Groww Trading API ──────────────────────────────────────────────────── */
export async function createGrowwSession(creds = {}) {
  assertByokFields('groww', creds);
  let accessToken = String(creds.accessToken || '').trim();

  if (!accessToken) {
    const apiKey = String(creds.apiKey || '').trim();
    const apiSecret = String(creds.apiSecret || '').trim();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const checksum = crypto.createHash('sha256').update(`${apiSecret}${timestamp}`).digest('hex');

    const tokenRes = await fetchJson('https://api.groww.in/v1/token/api/access', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-VERSION': '1.0'
      },
      body: {
        key_type: 'approval',
        checksum,
        timestamp
      }
    });

    accessToken = tokenRes.data?.token || tokenRes.data?.data?.token || '';
    if (tokenRes.statusCode >= 400 || !accessToken) {
      const err = new Error(
        brokerErrorMessage(
          tokenRes.data?.message || tokenRes.data?.error || tokenRes.data,
          'Groww token exchange failed. Check API Key + Secret, and approve the key on Groww Cloud.'
        )
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // Light validation — holdings/margin endpoints vary; try user/margin style quote endpoint
  const probe = await fetchJson('https://api.groww.in/v1/live-data/ltp?exchange=NSE&segment=CASH&trading_symbols=RELIANCE', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-API-VERSION': '1.0'
    }
  });

  if (probe.statusCode === 401 || probe.statusCode === 403) {
    const err = new Error(
      'Groww access token rejected. Generate a fresh Access Token from Groww → Profile → Trading APIs.'
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    accessToken,
    createdAt: new Date().toISOString(),
    expiresAt: dayExpiryIso(14)
  };
}

/** ── Angel One SmartAPI ─────────────────────────────────────────────────── */
export async function createAngelOneSession(creds = {}) {
  assertByokFields('angelone', creds);
  const apiKey = String(creds.apiKey || '').trim();
  const clientCode = String(creds.clientCode || '').trim();
  const pin = String(creds.pin || '').trim();
  const totpKey = String(creds.totpKey || '').trim();
  const totp = generateTOTP(totpKey);

  const loginRes = await fetchJson(
    'https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00:00:00:00:00:00',
        'X-PrivateKey': apiKey
      },
      body: {
        clientcode: clientCode,
        password: pin,
        totp
      }
    }
  );

  if (!loginRes.data?.status || !loginRes.data?.data?.jwtToken) {
    const err = new Error(
      brokerErrorMessage(
        loginRes.data?.message || loginRes.data?.error || loginRes.data,
        'Angel One login failed. Check API Key, Client Code, PIN and TOTP secret (enable TOTP on SmartAPI first).'
      )
    );
    err.statusCode = 400;
    throw err;
  }

  const { jwtToken, refreshToken, feedToken } = loginRes.data.data;
  return {
    jwtToken,
    refreshToken,
    feedToken,
    apiKey,
    clientCode,
    createdAt: new Date().toISOString(),
    expiresAt: dayExpiryIso(14)
  };
}

/** Dispatch by provider */
export async function connectByok(rawCreds = {}) {
  const provider = normalizeByokProvider(rawCreds.provider) || 'upstox';
  const creds = { ...rawCreds, provider };

  let session;
  if (provider === 'upstox') session = await createUpstoxSession(creds);
  else if (provider === 'kotak') session = await createKotakSession(creds);
  else if (provider === 'groww') session = await createGrowwSession(creds);
  else if (provider === 'angelone') session = await createAngelOneSession(creds);
  else {
    const err = new Error('Unsupported BYOK broker.');
    err.statusCode = 400;
    throw err;
  }

  return { provider, session, bundle: buildEncryptedByokBundle(provider, creds, session) };
}

export function buildEncryptedByokBundle(provider, creds, session) {
  const clean = {};
  for (const [k, v] of Object.entries(creds || {})) {
    if (k === 'provider') continue;
    if (v == null || v === '') continue;
    clean[k] = String(v).trim();
  }

  return {
    provider,
    status: 'connected',
    connectedAt: new Date(),
    lastValidatedAt: new Date(),
    uccMasked: maskSecret(creds.ucc || creds.clientCode || '', 2) || null,
    mobileMasked: maskSecret(creds.mobileNumber || '', 4) || null,
    consumerKeyMasked:
      maskSecret(creds.consumerKey || creds.apiKey || creds.accessToken || '', 4) || null,
    secretsCipher: encryptObject({ provider, ...clean }),
    sessionCipher: encryptObject({ provider, ...session }),
    lastError: null
  };
}

export function getByokPublicStatus(user) {
  const byok = user?.byok;
  const status = byok?.status || 'none';
  if (!byok || status === 'none') {
    return { enabled: false, status: 'none', provider: null };
  }
  return {
    enabled: status === 'connected' || status === 'pending',
    status,
    provider: byok.provider || null,
    connectedAt: byok.connectedAt || null,
    lastValidatedAt: byok.lastValidatedAt || null,
    uccMasked: byok.uccMasked || null,
    mobileMasked: byok.mobileMasked || null,
    consumerKeyMasked: byok.consumerKeyMasked || null,
    hasSession: !!byok.sessionCipher
  };
}

export function readByokSecrets(user) {
  return decryptObject(user?.byok?.secretsCipher);
}

export function readByokSession(user) {
  return decryptObject(user?.byok?.sessionCipher);
}

export async function refreshByokSession(user) {
  const secrets = readByokSecrets(user);
  if (!secrets) return null;
  const provider = normalizeByokProvider(secrets.provider || user?.byok?.provider) || 'upstox';
  const { bundle } = await connectByok({ ...secrets, provider });
  return bundle;
}
