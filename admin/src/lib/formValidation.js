/** Shared helpers for field-level form validation UX. */

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function positiveNumber(value, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return allowZero ? n >= 0 : n > 0;
}

export function wholeNumberAtLeast(value, min = 1) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min;
}

export function firstError(errors) {
  const vals = Object.values(errors || {}).filter(Boolean);
  return vals[0] || '';
}

export function fieldBorderClass(hasError, ok = 'border-admin-border focus:border-admin-accent') {
  return hasError ? 'border-rose-600 focus:border-rose-500' : ok;
}

export function isMaskedToken(value) {
  const s = String(value || '').trim();
  return !s || /^[•]+$/.test(s) || s.includes('••••');
}
