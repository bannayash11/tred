import React, { useState } from 'react';
import { Megaphone, Send, BellRing, Eye } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export default function Broadcast() {
  const { systemSettings, saveAnnouncement } = useAdmin();

  const [text, setText] = useState(
    systemSettings.announcement ||
    '🔴 Live Market Updates Active: High institutional volume detected in Nifty Banking & Auto sectors.'
  );
  const [enabled, setEnabled] = useState(
    systemSettings.announcementEnabled !== undefined ? systemSettings.announcementEnabled : true
  );
  const [saving, setSaving] = useState(false);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSaving(true);
    await saveAnnouncement({
      announcement: text,
      announcementEnabled: enabled
    });
    setSaving(false);
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center">
          <Megaphone className="mr-2 h-5 w-5 text-amber-400" />
          Live Terminal Urgency Broadcasts
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Push real-time alert banners directly to the header of every logged-in trader browsing the live terminal.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Live Banner Preview */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Eye className="h-4 w-4 text-cyan-400" />
            <span>Live Trader Preview (What users see):</span>
          </div>

          {enabled ? (
            <div className="rounded-2xl border border-cyan-800/80 bg-gradient-to-r from-[#0a1b2a] via-[#0d283e] to-[#0a1b2a] px-4 py-3 text-xs text-cyan-300 font-semibold shadow-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>{text || 'Enter announcement message below...'}</span>
              </div>
              <span className="text-[10px] uppercase font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 shrink-0">
                Live Broadcast
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500 text-center italic">
              Broadcast banner is currently disabled and hidden from users.
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleBroadcast} className="space-y-4 text-xs pt-4 border-t border-slate-800">
          <div>
            <label className="text-slate-400 block mb-1">Announcement Message Text</label>
            <input
              type="text"
              required
              placeholder="e.g. ⚡ Institutional block trade detected in HDFCBANK & RELIANCE..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="broadcastToggle"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
            />
            <label htmlFor="broadcastToggle" className="text-slate-300 cursor-pointer font-semibold">
              Enable & Display Announcement Bar across Web Portal
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-black hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center space-x-2"
          >
            <Send className="h-4 w-4" />
            <span>{saving ? 'Transmitting Alert...' : 'Publish Live Broadcast Alert'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
