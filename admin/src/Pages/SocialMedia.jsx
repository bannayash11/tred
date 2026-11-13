import React, { useEffect, useState } from 'react';
import { Share2, Save, Loader2, ExternalLink } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import { fetchSocialSettingsApi, saveSocialSettingsApi } from '../services/api';

export default function SocialMedia() {
  const { adminUser, showToast } = useAdmin();
  const isSuperAdmin = adminUser?.role === 'admin';
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchSocialSettingsApi();
      if (!res?.success) throw new Error(res?.message || 'Failed to load social settings.');
      setPlatforms(res.platforms || []);
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not load social media settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateRow = (key, patch) => {
    setPlatforms((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can edit social media.');
      return;
    }
    for (const p of platforms) {
      const url = String(p.url || '').trim();
      if (p.enabled && url && !/^https?:\/\//i.test(url)) {
        showToast?.(`${p.label}: URL must start with https://`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await saveSocialSettingsApi({
        platforms: platforms.map((p) => ({
          key: p.key,
          enabled: !!p.enabled,
          url: String(p.url || '').trim()
        }))
      });
      if (!res?.success) throw new Error(res?.message || 'Save failed.');
      setPlatforms(res.platforms || platforms);
      showToast?.(res.message || 'Social media settings saved.');
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not save social settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-admin-muted">Social Media settings are Super Admin only.</p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Social Media"
        description="Choose which social links appear in the website footer. Disable to hide."
        icon={Share2}
      />

      <Panel className="p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {platforms.map((p) => (
              <div
                key={p.key}
                className="rounded-xl border border-admin-border bg-admin-bg/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{p.label}</div>
                    <div className="text-[11px] text-admin-muted">{p.key}</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!p.enabled}
                      onChange={(e) => updateRow(p.key, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-admin-accent"
                    />
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>

                <div>
                  <label className="admin-label">Profile URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={p.url || ''}
                      disabled={!p.enabled}
                      onChange={(e) => updateRow(p.key, { url: e.target.value })}
                      placeholder={p.placeholder || 'https://...'}
                      className="admin-input disabled:opacity-50"
                    />
                    {p.url && /^https?:\/\//i.test(p.url) ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn-secondary shrink-0"
                        title="Open link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            <p className="text-xs text-admin-muted">
              Only enabled platforms with a valid URL are shown on the web footer. Instagram and Twitter are
              recommended for Tradrift.
            </p>

            <div className="flex justify-end border-t border-admin-border pt-4">
              <button type="submit" disabled={saving} className="admin-btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save social links
              </button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
