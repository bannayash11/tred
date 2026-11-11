import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  CreditCard,
  Radio,
  Megaphone,
  CheckCircle,
  AlertCircle,
  Save,
  KeyRound,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  fetchAdminData,
  updateUserSub,
  updateBrokerConfig,
  updateAnnouncementConfig
} from '../services/api';

export default function AdminPanelView() {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  // Broker Form
  const [brokerProvider, setBrokerProvider] = useState('DHAN');
  const [dhanClientId, setDhanClientId] = useState('');
  const [dhanToken, setDhanToken] = useState('');

  // Announcement Form
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);

  const loadAdmin = () => {
    setLoading(true);
    fetchAdminData()
      .then((res) => {
        if (res.success) {
          setAdminData(res);
          if (res.settings) {
            setBrokerProvider(res.settings.brokerProvider || 'DHAN');
            setDhanClientId(res.settings.dhanConfig?.clientId || '');
            setDhanToken(res.settings.dhanConfig?.accessToken || '');
            setAnnouncementText(res.settings.announcement || '');
            setAnnouncementEnabled(res.settings.announcementEnabled ?? true);
          }
        }
      })
      .catch((err) => console.error('Error fetching admin data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const handleUpdateSub = async (userId, plan, status, extendDays) => {
    try {
      await updateUserSub(userId, { plan, status, extendDays });
      setNotice('User subscription updated successfully!');
      setTimeout(() => setNotice(''), 3000);
      loadAdmin();
    } catch (err) {
      alert('Error updating user: ' + err.message);
    }
  };

  const handleSaveBroker = async (e) => {
    e.preventDefault();
    try {
      await updateBrokerConfig({
        brokerProvider,
        dhanConfig: {
          clientId: dhanClientId,
          accessToken: dhanToken,
          isConnected: true
        }
      });
      setNotice('Broker API settings saved successfully!');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      alert('Error saving broker: ' + err.message);
    }
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await updateAnnouncementConfig({
        announcement: announcementText,
        announcementEnabled
      });
      setNotice('Announcement broadcasted to terminal!');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      alert('Error saving announcement: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-400">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
        Loading Admin Dashboard...
      </div>
    );
  }

  const { stats = {}, users = [], settings = {} } = adminData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center">
            <ShieldCheck className="mr-2 h-6 w-6 text-amber-400" />
            Super Admin Control Center
          </h1>
          <p className="text-xs text-slate-400">
            Manage registered traders, active subscriptions, broker API feeds, and system broadcasts.
          </p>
        </div>

        {notice && (
          <div className="rounded-xl bg-emerald-950/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-800/50 flex items-center">
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {notice}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total Registered</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-extrabold text-white">
            {stats.totalUsers || users.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Traders in platform</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Active Paid Subs</span>
            <CreditCard className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-extrabold text-emerald-400">
            {stats.activeSubscribers || 1}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">12-Mo & Monthly users</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Free Trials</span>
            <Radio className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-extrabold text-amber-400">
            {stats.trialUsers || 1}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">14-day evaluation period</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Estimated MRR</span>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-extrabold text-purple-400">
            ₹{stats.estimatedMRR?.toLocaleString('en-IN') || '7,999'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Recurring platform revenue</div>
        </div>
      </div>

      {/* Row: Broker API Config & Announcement Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Broker API Config */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center">
              <KeyRound className="mr-2 h-4 w-4 text-cyan-400" />
              Live Market Data Feed API Configuration
            </h2>
            <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">
              FREE Broker API Active
            </span>
          </div>

          <form onSubmit={handleSaveBroker} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Market Data Source Provider</label>
              <select
                value={brokerProvider}
                onChange={(e) => setBrokerProvider(e.target.value)}
                className="w-full rounded-lg bg-slate-950 p-2 text-white border border-slate-800 font-mono"
              >
                <option value="DHAN">DhanHQ API (100% Free Live Feed)</option>
                <option value="FYERS">Fyers API v3 (100% Free)</option>
                <option value="SIMULATOR">Built-in Market Simulator (High Frequency)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Dhan Client ID</label>
                <input
                  type="text"
                  placeholder="e.g. 1100293847"
                  value={dhanClientId}
                  onChange={(e) => setDhanClientId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Access Token / JWT</label>
                <input
                  type="password"
                  placeholder="Paste your Dhan API token"
                  value={dhanToken}
                  onChange={(e) => setDhanToken(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              💡 Tip: Dhan HQ provides free live Websocket ticks & 1-minute historical candles. You can generate free API keys inside your Dhan Web portal.
            </p>

            <button
              type="submit"
              className="flex items-center space-x-1.5 rounded-lg bg-cyan-500 px-4 py-2 font-bold text-black hover:bg-cyan-400 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save Broker Settings</span>
            </button>
          </form>
        </div>

        {/* 2. Announcement Banner Editor */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center">
              <Megaphone className="mr-2 h-4 w-4 text-amber-400" />
              Live Terminal Broadcast Banner
            </h2>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Show on Terminal:</span>
              <input
                type="checkbox"
                checked={announcementEnabled}
                onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                className="rounded bg-slate-950 text-cyan-500 focus:ring-0"
              />
            </div>
          </div>

          <form onSubmit={handleSaveAnnouncement} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Announcement Message</label>
              <textarea
                rows={3}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Message visible to all traders on top of the screen..."
                className="w-full rounded-lg bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex items-center space-x-1.5 rounded-lg bg-amber-500 px-4 py-2 font-bold text-black hover:bg-amber-400 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Broadcast Now</span>
            </button>
          </form>
        </div>
      </div>

      {/* Users & Subscription Management Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Traders & Subscription Access Control</h2>
            <p className="text-xs text-slate-400">Instantly grant, extend, or revoke access for any user</p>
          </div>
          <span className="text-xs text-slate-400">{users.length} Users Listed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">User Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Expires At</th>
                <th className="px-6 py-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {users.map((u) => {
                const isExpired = new Date(u.subscription?.expiresAt) < new Date();
                return (
                  <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-white font-sans">
                      {u.name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-sans">
                      {u.email}
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-sans text-cyan-300">
                      {u.subscription?.plan || 'Standard'}
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.subscription?.status === 'active' && !isExpired
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : u.subscription?.status === 'trial'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {isExpired ? 'EXPIRED' : (u.subscription?.status || 'TRIAL').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-[11px] font-sans">
                      {u.subscription?.expiresAt
                        ? new Date(u.subscription.expiresAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans space-x-2">
                      <button
                        onClick={() => handleUpdateSub(u._id, '12 Months Pro Bundle', 'active', 365)}
                        className="rounded-lg bg-emerald-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/40"
                      >
                        +365 Days Pro
                      </button>
                      <button
                        onClick={() => handleUpdateSub(u._id, 'Monthly Starter', 'active', 30)}
                        className="rounded-lg bg-cyan-950/80 px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-900/60 border border-cyan-800/40"
                      >
                        +30 Days
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
