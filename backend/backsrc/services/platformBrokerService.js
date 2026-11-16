/**
 * Platform (server-plan) broker credentials — Kotak + Upstox —
 * managed from Admin in one save. Secrets encrypted in Settings DB.
 * Applied to process.env + live Kotak / Order Flow runtime.
 */
import { Settings } from '../models/Settings.js';
import { encryptObject, decryptObject, maskSecret } from '../utils/cryptoSecrets.js';
import { kotakNeoService } from './kotakNeoService.js';

const SETTINGS_KEY = 'platform_broker';

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
    kotak: { ...runtime.kotak },
    upstox: { ...runtime.upstox },
    updatedAt: runtime.updatedAt
  };
}

/** Safe for admin UI */
export function getPlatformBrokerPublic() {
  const k = runtime.kotak;
  const u = runtime.upstox;
  return {
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
  const k = runtime.kotak;
  const u = runtime.upstox;

  if (k.consumerKey) process.env.KOTAK_CONSUMER_KEY = k.consumerKey;
  if (k.ucc) process.env.KOTAK_UCC = k.ucc;
  if (k.mobileNumber) process.env.KOTAK_MOBILE_NUMBER = k.mobileNumber;
  if (k.mpin) process.env.KOTAK_MPIN = k.mpin;
  if (k.totpKey) process.env.KOTAK_TOTP_KEY = k.totpKey;
  if (u.accessToken) process.env.UPSTOX_ACCESS_TOKEN = u.accessToken;

  // Hot-reload Kotak singleton (constructor already ran with old env)
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
    if (!doc?.value?.cipher) return getPlatformBrokerPublic();
    const plain = decryptObject(doc.value.cipher);
    if (!plain || typeof plain !== 'object') return getPlatformBrokerPublic();
    runtime = {
      kotak: { ...EMPTY_KOTAK, ...(plain.kotak || {}) },
      upstox: { ...EMPTY_UPSTOX, ...(plain.upstox || {}) },
      updatedAt: doc.updatedAt || null
    };
    applyPlatformBrokerToEnv();
    console.log(
      `[PlatformBroker] Loaded from admin store · Kotak=${runtime.kotak.consumerKey ? 'yes' : 'no'} · Upstox=${runtime.upstox.accessToken ? 'yes' : 'no'}`
    );
  } catch (err) {
    console.warn('[PlatformBroker] load failed, using .env:', err.message);
  }
  return getPlatformBrokerPublic();
}

/**
 * Save Kotak + Upstox together (one admin submit).
 * Masked / empty secret fields keep previous values.
 */
export async function savePlatformBroker({ kotak = {}, upstox = {} } = {}) {
  const nextKotak = mergeSecretFields(runtime.kotak, kotak, [
    'consumerKey',
    'ucc',
    'mobileNumber',
    'mpin',
    'totpKey'
  ]);
  // ucc / mobile can be updated even if partially shown
  if (kotak.ucc !== undefined && String(kotak.ucc).trim() && !isMasked(kotak.ucc)) {
    nextKotak.ucc = String(kotak.ucc).trim();
  }
  if (kotak.mobileNumber !== undefined && String(kotak.mobileNumber).trim() && !String(kotak.mobileNumber).includes('•')) {
    nextKotak.mobileNumber = String(kotak.mobileNumber).trim();
  }

  const nextUpstox = mergeSecretFields(runtime.upstox, upstox, ['accessToken']);

  runtime = {
    kotak: nextKotak,
    upstox: nextUpstox,
    updatedAt: new Date()
  };

  const cipher = encryptObject({
    kotak: nextKotak,
    upstox: nextUpstox
  });

  await Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, value: { cipher }, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  applyPlatformBrokerToEnv();

  // Re-login Kotak in background so Terminal / OF pick up new keys
  void kotakNeoService.login?.().catch((err) => {
    console.warn('[PlatformBroker] Kotak re-login:', err.message);
  });

  // Soft-kick Order Flow to pick Upstox token on next provider start
  try {
    const { orderFlowService } = await import('./orderFlowService.js');
    if (orderFlowService?.state) {
      orderFlowService.state.lastError = null;
    }
    // If OF was waiting on Upstox, try again without blocking the HTTP response
    if (!orderFlowService.getStatus?.()?.ready && process.env.UPSTOX_ACCESS_TOKEN) {
      void orderFlowService.tryStartUpstox?.().then(() => {
        orderFlowService.state.ready = true;
        console.log('[PlatformBroker] Order Flow Upstox started after admin save');
      }).catch(() => {});
    }
  } catch {
    /* optional */
  }

  return getPlatformBrokerPublic();
}
