import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const raw =
    process.env.BYOK_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'tradrift-dev-byok-key';
  return crypto.createHash('sha256').update(String(raw)).digest();
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
