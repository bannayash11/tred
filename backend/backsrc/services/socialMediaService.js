import { Settings } from '../models/Settings.js';

const SETTINGS_KEY = 'social_media_platform';

export const SOCIAL_PLATFORM_META = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tradrift' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/tradrift' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@tradrift' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/tradrift' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/tradrift' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/tradrift' }
];

function emptyPlatform() {
  return { enabled: false, url: '' };
}

function defaultSocialSettings() {
  const out = {};
  for (const p of SOCIAL_PLATFORM_META) {
    out[p.key] = emptyPlatform();
  }
  // Sensible defaults: Instagram + Twitter enabled but empty until admin fills URLs
  out.instagram = { enabled: true, url: '' };
  out.twitter = { enabled: true, url: '' };
  return out;
}

/** @type {null | Record<string, { enabled: boolean, url: string }>} */
let socialConfig = null;

function normalizePlatform(raw = {}) {
  return {
    enabled: !!raw.enabled,
    url: String(raw.url || '').trim()
  };
}

export function getSocialMediaSettings() {
  const defaults = defaultSocialSettings();
  const stored = socialConfig || {};
  const out = {};
  for (const p of SOCIAL_PLATFORM_META) {
    out[p.key] = normalizePlatform(stored[p.key] || defaults[p.key]);
  }
  return out;
}

export function getSocialMediaAdmin() {
  const settings = getSocialMediaSettings();
  return SOCIAL_PLATFORM_META.map((meta) => ({
    ...meta,
    enabled: !!settings[meta.key]?.enabled,
    url: settings[meta.key]?.url || ''
  }));
}

/** Public footer payload — only enabled + valid http(s) URLs */
export function getPublicSocialMedia() {
  const settings = getSocialMediaSettings();
  return SOCIAL_PLATFORM_META.map((meta) => {
    const item = settings[meta.key] || emptyPlatform();
    const url = String(item.url || '').trim();
    const ok = !!item.enabled && /^https?:\/\//i.test(url);
    return {
      key: meta.key,
      label: meta.label,
      enabled: ok,
      url: ok ? url : ''
    };
  }).filter((x) => x.enabled);
}

export function setSocialMediaSettings(partial = {}) {
  const current = getSocialMediaSettings();
  const next = { ...current };

  for (const p of SOCIAL_PLATFORM_META) {
    const incoming = partial[p.key];
    if (!incoming || typeof incoming !== 'object') continue;
    next[p.key] = {
      enabled:
        incoming.enabled !== undefined ? !!incoming.enabled : !!current[p.key]?.enabled,
      url:
        incoming.url !== undefined
          ? String(incoming.url || '').trim()
          : current[p.key]?.url || ''
    };
  }

  // Also accept array form from admin UI
  if (Array.isArray(partial.platforms)) {
    for (const row of partial.platforms) {
      const key = String(row?.key || '').trim();
      if (!next[key]) continue;
      next[key] = {
        enabled: row.enabled !== undefined ? !!row.enabled : next[key].enabled,
        url: row.url !== undefined ? String(row.url || '').trim() : next[key].url
      };
    }
  }

  socialConfig = next;
  return getSocialMediaSettings();
}

export async function loadSocialMediaFromDb() {
  try {
    const doc = await Settings.findOne({ key: SETTINGS_KEY });
    if (doc?.value && typeof doc.value === 'object') {
      const defaults = defaultSocialSettings();
      const merged = { ...defaults };
      for (const p of SOCIAL_PLATFORM_META) {
        if (doc.value[p.key]) merged[p.key] = normalizePlatform(doc.value[p.key]);
      }
      socialConfig = merged;
      return getSocialMediaSettings();
    }
  } catch (err) {
    console.warn('[Social] load from DB failed:', err.message || err);
  }
  socialConfig = defaultSocialSettings();
  return getSocialMediaSettings();
}

export async function persistSocialMediaSettings() {
  const value = getSocialMediaSettings();
  await Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return value;
}
