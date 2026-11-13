/**
 * BYOK broker catalog — fields + step-by-step setup instructions for users.
 * Matches backend/backsrc/services/byokBrokers.js providers.
 */

export const BYOK_BROKERS = [
  {
    id: 'upstox',
    label: 'Upstox',
    short: 'Recommended · same as Order Flow',
    docsUrl: 'https://upstox.com/developer/api-documentation/',
    fields: [
      {
        key: 'accessToken',
        label: 'Access Token',
        placeholder: 'Paste today’s Upstox access token',
        type: 'password',
        required: true
      },
      {
        key: 'apiKey',
        label: 'API Key (optional)',
        placeholder: 'From Upstox developer app',
        required: false
      },
      {
        key: 'apiSecret',
        label: 'API Secret (optional)',
        placeholder: 'Stored encrypted for later token refresh',
        type: 'password',
        required: false
      }
    ],
    steps: [
      'Open Upstox Developer portal and sign in with your Upstox demat / trading account.',
      'Create an API app (Apps → New App). Note API Key and API Secret.',
      'Set a Redirect URL (any https URL you control, e.g. https://localhost).',
      'Open the login URL: https://api.upstox.com/v2/login/authorization/dialog?client_id=API_KEY&redirect_uri=YOUR_REDIRECT',
      'After login, Upstox redirects with ?code=…. Exchange that code for an Access Token (Token API).',
      'Paste the Access Token here. Tokens usually expire daily — refresh when market data stops.',
      'Tip: Order Flow’s Upstox provider uses only UPSTOX_ACCESS_TOKEN — same token works here.'
    ]
  },
  {
    id: 'kotak',
    label: 'Kotak Neo',
    short: 'Consumer Key + UCC + TOTP',
    docsUrl: 'https://www.kotaksecurities.com/tradeapi/',
    fields: [
      { key: 'consumerKey', label: 'Consumer Key (API Key)', placeholder: 'uuid from Neo Trade API', required: true },
      { key: 'ucc', label: 'UCC / Client Code', placeholder: 'e.g. Y1IBR', required: true },
      { key: 'mobileNumber', label: 'Registered Mobile', placeholder: '+91XXXXXXXXXX', required: true },
      { key: 'mpin', label: 'MPIN', placeholder: '••••••', type: 'password', required: true },
      { key: 'totpKey', label: 'TOTP Secret (Base32)', placeholder: 'From Neo API / authenticator setup', required: true }
    ],
    steps: [
      'Open a Kotak Securities trading account and activate Neo Trade API access.',
      'From the Neo API / developer section, create an app and copy the Consumer Key.',
      'Note your UCC (client code) and the mobile number registered with Kotak.',
      'Set / note your trading MPIN (used in tradeApiValidate).',
      'Enable TOTP for API login and save the Base32 TOTP secret (not the 6-digit code).',
      'Paste all five fields here. We login → validate MPIN → store an encrypted session.',
      'If login fails, regenerate TOTP sync on your phone and retry within the same 30s window.'
    ]
  },
  {
    id: 'groww',
    label: 'Groww',
    short: 'Access Token or API Key + Secret',
    docsUrl: 'https://groww.in/trade-api/docs',
    fields: [
      {
        key: 'accessToken',
        label: 'Access Token (easiest)',
        placeholder: 'From Groww → Trading APIs → Access Token',
        type: 'password',
        required: false
      },
      {
        key: 'apiKey',
        label: 'API Key (alternative)',
        placeholder: 'Groww Cloud API Key',
        required: false
      },
      {
        key: 'apiSecret',
        label: 'API Secret (with API Key)',
        placeholder: 'Groww Cloud API Secret',
        type: 'password',
        required: false
      }
    ],
    steps: [
      'You need a Groww account + active Groww Trading API subscription.',
      'On web Groww: Profile (top-right) → Settings → Trading APIs.',
      'Easiest: Generate an Access Token and paste it above (expires ~daily ~6 AM).',
      'Or: Generate API Key + Secret on Groww Cloud API Keys, approve the key, then paste both.',
      'We exchange Key+Secret for a token (checksum) or validate your Access Token directly.',
      'Docs: https://groww.in/trade-api/docs — Live Data APIs need the same token.',
      'Fill either Access Token OR (API Key + Secret) — not necessarily both.'
    ]
  },
  {
    id: 'angelone',
    label: 'Angel One',
    short: 'SmartAPI · API Key + Client + PIN + TOTP',
    docsUrl: 'https://smartapi.angelone.in/docs',
    fields: [
      { key: 'apiKey', label: 'SmartAPI API Key', placeholder: 'From smartapi.angelone.in → My Apps', required: true },
      { key: 'clientCode', label: 'Client Code', placeholder: 'Your Angel One client id', required: true },
      { key: 'pin', label: 'PIN / Password', placeholder: '4-digit trading PIN', type: 'password', required: true },
      { key: 'totpKey', label: 'TOTP Secret (Base32)', placeholder: 'Secret from enable-totp QR', required: true }
    ],
    steps: [
      'Go to https://smartapi.angelone.in and sign in with Angel One credentials.',
      'Create an app under My Apps → copy the API Key (X-PrivateKey).',
      'Enable TOTP: https://smartapi.angelone.in/enable-totp — scan QR in Authenticator.',
      'Save the TOTP Base32 secret from the QR/setup (not the rotating 6-digit code).',
      'Keep your Angel One Client Code and trading PIN ready.',
      'Paste API Key, Client Code, PIN and TOTP secret here.',
      'We call loginByPassword, store jwt + feed tokens encrypted. Session lasts until midnight IST typically.'
    ]
  }
];

export function getByokBroker(id) {
  return BYOK_BROKERS.find((b) => b.id === id) || BYOK_BROKERS[0];
}

export function validateByokForm(providerId, values) {
  const broker = getByokBroker(providerId);
  if (!broker) return 'Select a broker.';

  if (providerId === 'groww') {
    const hasToken = !!String(values.accessToken || '').trim();
    const hasPair =
      !!String(values.apiKey || '').trim() && !!String(values.apiSecret || '').trim();
    if (!hasToken && !hasPair) {
      return 'Groww: enter Access Token, or both API Key and API Secret.';
    }
    return '';
  }

  for (const field of broker.fields) {
    if (field.required && !String(values[field.key] || '').trim()) {
      return `${field.label} is required.`;
    }
  }
  return '';
}

export function buildByokPayload(providerId, values) {
  const broker = getByokBroker(providerId);
  const payload = { provider: providerId };
  for (const field of broker.fields) {
    const v = String(values[field.key] || '').trim();
    if (v) payload[field.key] = field.key === 'totpKey' ? v.replace(/\s+/g, '') : v;
  }
  return payload;
}
