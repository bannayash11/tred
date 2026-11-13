import React, { useState } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Save } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fieldBorderClass, firstError, isMaskedToken } from '../lib/formValidation';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

export default function BrokerApi() {
  const { adminUser, systemSettings, saveBroker, showToast } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';

  const [provider, setProvider] = useState(systemSettings.brokerProvider || 'DHAN');
  const [clientId, setClientId] = useState(systemSettings.dhanClientId || '');
  const [token, setToken] = useState(systemSettings.dhanToken || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubAdmin) {
      showToast('Broker API is Super Admin only.');
      return;
    }
    const next = {};
    if (!String(clientId || '').trim()) next.clientId = 'Client ID / App Key is required.';
    if (isMaskedToken(token) || !String(token || '').trim()) {
      next.token = 'Enter a real access token (not a masked placeholder).';
    }
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(firstError(next));
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await saveBroker({
        brokerProvider: provider,
        dhanConfig: {
          clientId: String(clientId).trim(),
          accessToken: String(token).trim(),
          isConnected: true
        }
      });
    } catch (err) {
      const msg = err?.userMessage || err?.response?.data?.message || 'Could not save broker credentials.';
      setErrors({ token: msg });
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isSubAdmin) {
    return (
      <Panel className="space-y-3 border-rose-800/50 bg-rose-950/20 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-rose-800 bg-rose-950 text-rose-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">Super Admin only</h3>
        <p className="mx-auto max-w-md text-sm text-admin-muted">
          Broker API credentials can only be viewed or changed by Super Administrators.
        </p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Broker API"
        description="Connect market data provider credentials for the live feed."
        icon={KeyRound}
      />

      <Panel className="space-y-6 p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-admin-border pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Data provider</h3>
            <p className="mt-1 text-xs text-admin-muted">Bind a live WebSocket feed to the SMC engine.</p>
          </div>
          <span className="admin-chip border-emerald-800/50 bg-emerald-950/50 text-emerald-300">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="admin-label">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="admin-input">
              <option value="DHAN">DhanHQ</option>
              <option value="FYERS">Fyers API v3</option>
              <option value="OFFLINE_SIM">Offline simulator</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Client ID / App Key</label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setErrors({});
                }}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.clientId)}`}
              />
              {errors.clientId && <p className="mt-1.5 text-xs text-rose-400">{errors.clientId}</p>}
            </div>
            <div>
              <label className="admin-label">Access token</label>
              <input
                type="password"
                required
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setErrors({});
                }}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.token)}`}
              />
              {errors.token && <p className="mt-1.5 text-xs text-rose-400">{errors.token}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-admin-border bg-admin-bg/60 p-4 text-sm text-admin-muted">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-admin-success" />
              Tip
            </div>
            Use broker API keys from your Demat account. Avoid sharing tokens outside Super Admin.
          </div>

          <button type="submit" disabled={saving} className="admin-btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save credentials'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
