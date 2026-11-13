/**
 * Supported BYOK brokers + field metadata (shared contract with web UI).
 * order-flow-main uses Upstox access token; Kotak matches our server KOTAK_*.
 */
export const BYOK_PROVIDERS = ['upstox', 'kotak', 'groww', 'angelone'];

export const BYOK_BROKER_META = {
  upstox: {
    id: 'upstox',
    label: 'Upstox',
    docsUrl: 'https://upstox.com/developer/api-documentation/',
    fields: ['accessToken'],
    optionalFields: ['apiKey', 'apiSecret']
  },
  kotak: {
    id: 'kotak',
    label: 'Kotak Neo',
    docsUrl: 'https://www.kotaksecurities.com/tradeapi/',
    fields: ['consumerKey', 'ucc', 'mobileNumber', 'mpin', 'totpKey']
  },
  groww: {
    id: 'groww',
    label: 'Groww',
    docsUrl: 'https://groww.in/trade-api/docs',
    // Prefer daily access token; or API key + secret
    fields: [],
    either: [
      ['accessToken'],
      ['apiKey', 'apiSecret']
    ]
  },
  angelone: {
    id: 'angelone',
    label: 'Angel One',
    docsUrl: 'https://smartapi.angelone.in/docs',
    fields: ['apiKey', 'clientCode', 'pin', 'totpKey']
  }
};

export function normalizeByokProvider(raw) {
  const id = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '');
  if (id === 'angel' || id === 'angel1' || id === 'angelone') return 'angelone';
  if (id === 'kotakneo' || id === 'kotak') return 'kotak';
  if (id === 'upstox') return 'upstox';
  if (id === 'groww') return 'groww';
  return null;
}

export function assertByokFields(provider, creds = {}) {
  const meta = BYOK_BROKER_META[provider];
  if (!meta) {
    const err = new Error('Unsupported BYOK broker. Use Upstox, Kotak Neo, Groww or Angel One.');
    err.statusCode = 400;
    throw err;
  }

  if (meta.either?.length) {
    const ok = meta.either.some((group) =>
      group.every((k) => String(creds[k] || '').trim())
    );
    if (!ok) {
      const err = new Error(
        'Groww BYOK needs either Access Token, or API Key + API Secret (from Groww Trading APIs).'
      );
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  for (const key of meta.fields || []) {
    if (!String(creds[key] || '').trim()) {
      const err = new Error(`Missing required field: ${key} (${meta.label})`);
      err.statusCode = 400;
      throw err;
    }
  }
}
