import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

const WEAK_DEFAULTS = new Set([
  'tradrift-dev-byok-key',
  'change_me',
  'secret',
  'encryption_key'
]);

function resolveByokKeyMaterial() {
  const raw = process.env.BYOK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  const trimmed = raw != null ? String(raw).trim() : '';
  const weak = !trimmed || trimmed.length < 16 || WEAK_DEFAULTS.has(trimmed);

  if (weak) {
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_BYOK_ENCRYPTION_KEY === '1') {
      console.error(
        '[BYOK] BYOK_ENCRYPTION_KEY is missing or weak. Set a dedicated 16+ char key (do not reuse JWT_SECRET).'
      );
      process.exit(1);
    }
    if (!global.__tredEphemeralByokKey) {
      global.__tredEphemeralByokKey = crypto.randomBytes(32).toString('hex');
      console.warn(
        '[BYOK] BYOK_ENCRYPTION_KEY missing/weak — using ephemeral dev key. Encrypted data will not survive restarts.'
      );
    }
    return global.__tredEphemeralByokKey;
  }

  return trimmed;
}

const KEY_MATERIAL = resolveByokKeyMaterial();

function getKey() {
  return crypto.createHash('sha256').update(KEY_MATERIAL).digest();
}

/** Encrypt a JSON-serializable object → opaque string (iv:tag:cipher hex). */
export function encryptObject(value) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt opaque string → object. Returns null if invalid. */
export function decryptObject(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

export function maskSecret(value, keep = 4) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= keep) return '•'.repeat(8);
  return `${'•'.repeat(Math.min(24, s.length - keep))}${s.slice(-keep)}`;
}
