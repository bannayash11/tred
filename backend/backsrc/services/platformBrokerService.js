/**
 * Platform (server-plan) broker credentials — Fyers (default) + Kotak + Upstox —
 * managed from Admin in one save. Secrets encrypted in Settings DB.
 * Applied to process.env + live Fyers / Kotak / Order Flow runtime.
 */
import { Settings } from '../models/Settings.js';
import { encryptObject, decryptObject, maskSecret } from '../utils/cryptoSecrets.js';
import { kotakNeoService } from './kotakNeoService.js';
import { fyersService } from './fyersService.js';

const SETTINGS_KEY = 'platform_broker';

const EMPTY_FYERS = {
  appId: '',
  appSecret: '',
  accessToken: '',
  refreshToken: '',
  pin: '',
  redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html'
};

const EMPTY_KOTAK = {
  consumerKey: '',
  ucc: '',
  mobileNumber: '',
  mpin: '',
  totpKey: ''
};

const EMPTY_UPSTOX = {
  accessToken: ''
};

/** In-memory plaintext after load (never sent to client unmasked). */
let runtime = {
  fyers: { ...EMPTY_FYERS },
  kotak: { ...EMPTY_KOTAK },
  upstox: { ...EMPTY_UPSTOX },
  updatedAt: null
};

function isMasked(value) {
  const s = String(value || '');
  return !s.trim() || s.includes('•') || /^x{4,}/i.test(s);
}

function mergeSecretFields(prev, incoming, keys) {
  const out = { ...prev };
  for (const key of keys) {
    if (incoming[key] === undefined) continue;
    const v = String(incoming[key] ?? '').trim();
    if (isMasked(v)) continue; // keep previous
    out[key] = v;
  }
  return out;
}

export function getPlatformBrokerRuntime() {
  return {
    fyers: { ...runtime.fyers },
    kotak: { ...runtime.kotak },
    upstox: { ...runtime.upstox },
    updatedAt: runtime.updatedAt
  };
}

/** Safe for admin UI */
export function getPlatformBrokerPublic() {
  const f = runtime.fyers;
  const k = runtime.kotak;
  const u = runtime.upstox;
  return {
    primary: f.appId && f.accessToken ? 'fyers' : k.consumerKey ? 'kotak' : u.accessToken ? 'upstox' : null,
    fyers: {
      appId: f.appId || '',
      appSecret: f.appSecret ? maskSecret(f.appSecret, 4) : '',
      accessToken: f.accessToken ? maskSecret(f.accessToken, 4) : '',
      refreshToken: f.refreshToken ? maskSecret(f.refreshToken, 4) : '',
      pin: f.pin ? '••••••' : '',
      redirectUri: f.redirectUri || EMPTY_FYERS.redirectUri,
      configured: Boolean(f.appId && f.accessToken),
      canAutoRefresh: Boolean(f.appId && f.appSecret && f.refreshToken && f.pin)
    },
    kotak: {
      consumerKey: k.consumerKey ? maskSecret(k.consumerKey, 4) : '',
      ucc: k.ucc || '',
      mobileNumber: k.mobileNumber ? maskSecret(k.mobileNumber, 4) : '',
      mpin: k.mpin ? '••••••' : '',
      totpKey: k.totpKey ? '••••••••' : '',
      configured: Boolean(k.consumerKey && k.ucc && k.mobileNumber && k.mpin && k.totpKey)
    },
    upstox: {
      accessToken: u.accessToken ? maskSecret(u.accessToken, 4) : '',
      configured: Boolean(u.accessToken)
    },
    updatedAt: runtime.updatedAt,
    source: 'admin+env'
  };
}

export function applyPlatformBrokerToEnv() {
  const f = runtime.fyers;
  const k = runtime.kotak;
  const u = runtime.upstox;

  if (f.appId) process.env.FYERS_APP_ID = f.appId;
  if (f.appSecret) process.env.FYERS_APP_SECRET = f.appSecret;
  if (f.accessToken) process.env.FYERS_ACCESS_TOKEN = f.accessToken;
  if (f.refreshToken) process.env.FYERS_REFRESH_TOKEN = f.refreshToken;
  if (f.pin) process.env.FYERS_PIN = f.pin;
  if (f.redirectUri) process.env.FYERS_REDIRECT_URI = f.redirectUri;

  if (k.consumerKey) process.env.KOTAK_CONSUMER_KEY = k.consumerKey;
  if (k.ucc) process.env.KOTAK_UCC = k.ucc;
  if (k.mobileNumber) process.env.KOTAK_MOBILE_NUMBER = k.mobileNumber;
  if (k.mpin) process.env.KOTAK_MPIN = k.mpin;
  if (k.totpKey) process.env.KOTAK_TOTP_KEY = k.totpKey;
  if (u.accessToken) process.env.UPSTOX_ACCESS_TOKEN = u.accessToken;

  if (typeof fyersService.applyCredentials === 'function') {
    fyersService.applyCredentials({
      appId: process.env.FYERS_APP_ID || '',
      appSecret: process.env.FYERS_APP_SECRET || '',
      accessToken: process.env.FYERS_ACCESS_TOKEN || '',
      refreshToken: process.env.FYERS_REFRESH_TOKEN || '',
      pin: process.env.FYERS_PIN || '',
      redirectUri: process.env.FYERS_REDIRECT_URI || ''
    });
  }

  if (typeof kotakNeoService.applyCredentials === 'function') {
    kotakNeoService.applyCredentials({
      consumerKey: process.env.KOTAK_CONSUMER_KEY || '',
      ucc: process.env.KOTAK_UCC || '',
      mobileNumber: process.env.KOTAK_MOBILE_NUMBER || '',
      mpin: process.env.KOTAK_MPIN || '',
      totpKey: process.env.KOTAK_TOTP_KEY || ''
    });
  }
}

/**
 * Seed runtime from .env when DB has nothing yet.
 */
export function seedRuntimeFromEnv() {
  runtime = {
    fyers: {
      appId: process.env.FYERS_APP_ID || '',
      appSecret: process.env.FYERS_APP_SECRET || '',
      accessToken: process.env.FYERS_ACCESS_TOKEN || '',
      refreshToken: process.env.FYERS_REFRESH_TOKEN || '',
      pin: process.env.FYERS_PIN || '',
      redirectUri:
        process.env.FYERS_REDIRECT_URI || EMPTY_FYERS.redirectUri
    },
    kotak: {
      consumerKey: process.env.KOTAK_CONSUMER_KEY || '',
      ucc: process.env.KOTAK_UCC || '',
      mobileNumber: process.env.KOTAK_MOBILE_NUMBER || '',
      mpin: process.env.KOTAK_MPIN || '',
      totpKey: process.env.KOTAK_TOTP_KEY || ''
    },
    upstox: {
      accessToken: process.env.UPSTOX_ACCESS_TOKEN || ''
    },
    updatedAt: null
  };
}

export async function loadPlatformBrokerFromDb() {
  seedRuntimeFromEnv();
  try {
    const doc = await Settings.findOne({ key: SETTINGS_KEY });
    if (!doc?.value?.cipher) {
      applyPlatformBrokerToEnv();
      return getPlatformBrokerPublic();
    }
    const plain = decryptObject(doc.value.cipher);
    if (!plain || typeof plain !== 'object') {
      applyPlatformBrokerToEnv();
      return getPlatformBrokerPublic();
    }
    runtime = {
      fyers: { ...EMPTY_FYERS, ...(plain.fyers || {}) },
      kotak: { ...EMPTY_KOTAK, ...(plain.kotak || {}) },
      upstox: { ...EMPTY_UPSTOX, ...(plain.upstox || {}) },
      updatedAt: doc.updatedAt || null
    };
    // Env can fill gaps if admin never saved broker creds yet
    if (!runtime.fyers.appId && process.env.FYERS_APP_ID) {
      runtime.fyers.appId = process.env.FYERS_APP_ID;
    }
    if (!runtime.fyers.accessToken && process.env.FYERS_ACCESS_TOKEN) {
      runtime.fyers.accessToken = process.env.FYERS_ACCESS_TOKEN;
    }
    if (!runtime.fyers.appSecret && process.env.FYERS_APP_SECRET) {
      runtime.fyers.appSecret = process.env.FYERS_APP_SECRET;
    }
    if (!runtime.fyers.refreshToken && process.env.FYERS_REFRESH_TOKEN) {
      runtime.fyers.refreshToken = process.env.FYERS_REFRESH_TOKEN;
    }
    if (!runtime.fyers.pin && process.env.FYERS_PIN) {
      runtime.fyers.pin = process.env.FYERS_PIN;
    }
    if (!runtime.upstox.accessToken && process.env.UPSTOX_ACCESS_TOKEN) {
      runtime.upstox.accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    }
    applyPlatformBrokerToEnv();
    console.log(
      `[PlatformBroker] Loaded · Fyers=${runtime.fyers.accessToken ? 'yes' : 'no'} · Kotak=${runtime.kotak.consumerKey ? 'yes' : 'no'} · Upstox=${runtime.upstox.accessToken ? 'yes' : 'no'}`
    );
  } catch (err) {
    console.warn('[PlatformBroker] load failed, using .env:', err.message);
    applyPlatformBrokerToEnv();
  }
  return getPlatformBrokerPublic();
}

/**
 * Save Fyers + Kotak + Upstox together (one admin submit).
 * Masked / empty secret fields keep previous values.
 */
export async function savePlatformBroker({ fyers = {}, kotak = {}, upstox = {} } = {}) {
  const nextFyers = mergeSecretFields(runtime.fyers, fyers, [
    'appId',
    'appSecret',
    'accessToken',
    'refreshToken',
    'pin',
    'redirectUri'
  ]);
  if (fyers.appId !== undefined && String(fyers.appId).trim() && !isMasked(fyers.appId)) {
    nextFyers.appId = String(fyers.appId).trim();
  }
  if (
    fyers.redirectUri !== undefined &&
    String(fyers.redirectUri).trim() &&
    !isMasked(fyers.redirectUri)
  ) {
    nextFyers.redirectUri = String(fyers.redirectUri).trim();
  }

  const nextKotak = mergeSecretFields(runtime.kotak, kotak, [
    'consumerKey',
    'ucc',
    'mobileNumber',
    'mpin',
    'totpKey'
  ]);
  if (kotak.ucc !== undefined && String(kotak.ucc).trim() && !isMasked(kotak.ucc)) {
    nextKotak.ucc = String(kotak.ucc).trim();
  }
  if (
    kotak.mobileNumber !== undefined &&
    String(kotak.mobileNumber).trim() &&
    !String(kotak.mobileNumber).includes('•')
  ) {
    nextKotak.mobileNumber = String(kotak.mobileNumber).trim();
  }

  const nextUpstox = mergeSecretFields(runtime.upstox, upstox, ['accessToken']);

  runtime = {
    fyers: nextFyers,
    kotak: nextKotak,
    upstox: nextUpstox,
    updatedAt: new Date()
  };

  const cipher = encryptObject({
    fyers: nextFyers,
    kotak: nextKotak,
    upstox: nextUpstox
  });

  await Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, value: { cipher }, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  applyPlatformBrokerToEnv();

  void kotakNeoService.login?.().catch((err) => {
    console.warn('[PlatformBroker] Kotak re-login:', err.message);
  });

  try {
    const { orderFlowService } = await import('./orderFlowService.js');
    if (orderFlowService?.state) {
      orderFlowService.state.lastError = null;
    }
    if (!orderFlowService.getStatus?.()?.ready && process.env.UPSTOX_ACCESS_TOKEN) {
      void orderFlowService
        .tryStartUpstox?.()
        .then(() => {
          orderFlowService.state.ready = true;
          console.log('[PlatformBroker] Order Flow Upstox started after admin save');
        })
        .catch(() => {});
    }
  } catch {
    /* optional */
  }

  // Kick market data to prefer Fyers without full process restart
  try {
    const { marketDataService } = await import('./marketDataService.js');
    if (fyersService.configured && typeof marketDataService?.initFyersLiveFeed === 'function') {
      void marketDataService.initFyersLiveFeed();
    }
  } catch {
    /* optional */
  }

  return getPlatformBrokerPublic();
}
