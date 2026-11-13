import React, { useState } from 'react';
import { Megaphone, Send, Eye } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fieldBorderClass } from '../lib/formValidation';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

export default function Broadcast() {
  const { systemSettings, saveAnnouncement, showToast } = useAdmin();
  const [text, setText] = useState(systemSettings.announcement || '');
  const [enabled, setEnabled] = useState(
    systemSettings.announcementEnabled !== undefined ? systemSettings.announcementEnabled : true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const msg = String(text || '').trim();
    if (!msg) {
      setError('Announcement message is required.');
      return;
    }
    if (msg.length > 280) {
      setError('Message is too long (max 280 characters).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveAnnouncement({
        announcement: msg,
        announcementEnabled: enabled
      });
    } catch (err) {
      const fail = err?.userMessage || err?.response?.data?.message || 'Could not publish broadcast.';
      setError(fail);
      showToast?.(fail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Broadcast"
        description="Publish a banner shown to logged-in traders on the web terminal."
        icon={Megaphone}
      />

      <Panel className="space-y-6 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-admin-muted">
            <Eye className="h-4 w-4 text-admin-accent" />
            Preview
          </div>
          {enabled ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-admin-accent/30 bg-admin-accent/10 px-4 py-3 text-sm text-admin-accent">
              <span className="min-w-0">{text || 'Enter announcement message below...'}</span>
              <span className="admin-chip shrink-0 border-admin-accent/30 bg-admin-bg text-admin-accent">
                Live
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-admin-border bg-admin-bg p-4 text-center text-sm text-admin-muted">
              Banner is disabled and hidden from users.
            </div>
          )}
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4 border-t border-admin-border pt-4" noValidate>
          <div>
            <label className="admin-label">Message</label>
            <input
              type="text"
              required
              maxLength={280}
              placeholder="Short market update for traders..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError('');
              }}
              className={`admin-input border ${fieldBorderClass(!!error)}`}
            />
            {error ? (
              <p className="mt-1.5 text-xs text-rose-400">{error}</p>
            ) : (
              <p className="mt-1 text-[11px] text-admin-muted">{String(text || '').length}/280</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-admin-bg text-admin-accent"
            />
            Show announcement bar on the website
          </label>

          <button type="submit" disabled={saving} className="admin-btn-primary">
            <Send className="h-4 w-4" />
            {saving ? 'Publishing...' : 'Publish broadcast'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
