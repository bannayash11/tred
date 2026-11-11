import React, { useState } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Save, ExternalLink } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export default function BrokerApi() {
  const { adminUser, systemSettings, saveBroker, showToast } = useAdmin();

  const isSubAdmin = adminUser?.role === 'subadmin';

  const [provider, setProvider] = useState(systemSettings.brokerProvider || 'DHAN');
  const [clientId, setClientId] = useState(systemSettings.dhanClientId || '1100293847');
  const [token, setToken] = useState(systemSettings.dhanToken || '••••••••••••••••••••••••••••••••');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubAdmin) {
      showToast('⚠️ Access Denied: Modifying Broker API credentials requires Super Admin role.');
      return;
    }
    setSaving(true);
    await saveBroker({
      brokerProvider: provider,
      dhanConfig: {
        clientId,
        accessToken: token,
        isConnected: true
      }
    });
    setSaving(false);
  };

  if (isSubAdmin) {
    return (
      <div className="rounded-3xl border border-rose-900/60 bg-rose-950/20 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-950 border border-rose-800 text-rose-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Access Restricted: Super Admin Only</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Broker API credentials, WebSocket data stream keys, and institutional data connectors can only be accessed or modified by Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center">
          <KeyRound className="mr-2 h-5 w-5 text-amber-400" />
          Zero-Cost Broker API Feed Configuration
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Connect official Indian broker data APIs (DhanHQ / Fyers v3) to power sub-second candle streams with ₹0 monthly data fees.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Selected Market Data Provider</h3>
            <p className="text-xs text-slate-400">Choose which live WebSocket bridge to bind to the SMC Engine.</p>
          </div>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-800/60 flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CONNECTED</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Broker API Engine</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800"
            >
              <option value="DHAN">DhanHQ API (Free 1-Minute Historical + Live WebSockets)</option>
              <option value="FYERS">Fyers API v3 (Free Real-time Data for Demat Holders)</option>
              <option value="OFFLINE_SIM">Offline High-Frequency Market Simulator (Fallback)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Client ID / App Key</label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Access Token / Secret JWT</label>
              <input
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 space-y-2 text-xs text-slate-400">
            <div className="font-bold text-white flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Free Data Strategy Active</span>
            </div>
            <p>
              Both DhanHQ and Fyers provide 100% free historical candles and WebSockets with zero monthly recurring exchange fees for Demat holders.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-black hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Testing & Saving...' : 'Save & Bind Broker Credentials'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
