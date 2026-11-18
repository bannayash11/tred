import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Save } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fieldBorderClass, firstError, isMaskedToken } from '../lib/formValidation';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

const emptyFyers = () => ({
  appId: '',
  appSecret: '',
  accessToken: '',
  refreshToken: '',
  pin: '',
  redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html'
});

const emptyKotak = () => ({
  consumerKey: '',
  ucc: '',
  mobileNumber: '',
  mpin: '',
  totpKey: ''
});

export default function BrokerApi() {
  const { adminUser, systemSettings, saveBroker, showToast } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';
  const pb = systemSettings?.platformBroker || {};

  const [fyers, setFyers] = useState(() => ({
    ...emptyFyers(),
    ...(pb.fyers || {})
  }));
  const [kotak, setKotak] = useState(() => ({
    ...emptyKotak(),
    ...(pb.kotak || {})
  }));
  const [upstoxToken, setUpstoxToken] = useState(pb.upstox?.accessToken || '');
  const [defaultProvider, setDefaultProvider] = useState(pb.defaultProvider || 'kotak');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const next = systemSettings?.platformBroker;
    if (!next) return;
    setFyers((prev) => ({
      ...prev,
      appId: next.fyers?.appId || prev.appId || '',
      appSecret: next.fyers?.appSecret || prev.appSecret || '',
      accessToken: next.fyers?.accessToken || prev.accessToken || '',
      refreshToken: next.fyers?.refreshToken || prev.refreshToken || '',
      pin: next.fyers?.pin || prev.pin || '',
      redirectUri: next.fyers?.redirectUri || prev.redirectUri || emptyFyers().redirectUri
    }));
    setKotak((prev) => ({
      ...prev,
      consumerKey: next.kotak?.consumerKey || prev.consumerKey || '',
      ucc: next.kotak?.ucc || prev.ucc || '',
      mobileNumber: next.kotak?.mobileNumber || prev.mobileNumber || '',
      mpin: next.kotak?.mpin || prev.mpin || '',
      totpKey: next.kotak?.totpKey || prev.totpKey || ''
    }));
    if (next.upstox?.accessToken) setUpstoxToken(next.upstox.accessToken);
    if (next.defaultProvider) setDefaultProvider(next.defaultProvider);
  }, [systemSettings?.platformBroker]);

  const setFyersField = (key, value) => {
    setFyers((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  const setKotakField = (key, value) => {
    setKotak((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubAdmin) {
      showToast('Broker API is Super Admin only.');
      return;
    }

    const nextErr = {};
    const fyersConfigured = !!pb.fyers?.configured;
    const kotakConfigured = !!pb.kotak?.configured;
    const upstoxConfigured = !!pb.upstox?.configured;

    // At least one platform broker must be configured
    if (!fyersConfigured && !kotakConfigured && !upstoxConfigured) {
      if (defaultProvider === 'fyers') {
        if (!String(fyers.appId || '').trim()) nextErr.fyersAppId = 'Fyers App ID required.';
        if (!String(fyers.accessToken || '').trim() || isMaskedToken(fyers.accessToken)) {
          nextErr.fyersAccessToken = 'Fyers access token required.';
        }
      } else if (defaultProvider === 'upstox') {
        if (!String(upstoxToken || '').trim() || isMaskedToken(upstoxToken)) {
          nextErr.upstoxToken = 'Upstox access token required.';
        }
      } else if (!String(kotak.consumerKey || '').trim() || isMaskedToken(kotak.consumerKey)) {
        nextErr.form = 'Configure Kotak (or another broker) before saving.';
      }
    }

    if (!upstoxConfigured && upstoxToken && isMaskedToken(upstoxToken)) {
      nextErr.upstoxToken = 'Paste a real Upstox access token.';
    }

    if (Object.keys(nextErr).length) {
      setErrors(nextErr);
      showToast(firstError(nextErr));
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await saveBroker({
        defaultProvider,
        fyers: {
          appId: fyers.appId,
          appSecret: fyers.appSecret,
          accessToken: fyers.accessToken,
          refreshToken: fyers.refreshToken,
          pin: fyers.pin,
          redirectUri: fyers.redirectUri
        },
        kotak: {
          consumerKey: kotak.consumerKey,
          ucc: kotak.ucc,
          mobileNumber: kotak.mobileNumber,
          mpin: kotak.mpin,
          totpKey: kotak.totpKey
        },
        upstox: {
          accessToken: upstoxToken
        }
      });
    } catch (err) {
      const msg = err?.userMessage || err?.response?.data?.message || 'Could not save broker credentials.';
      setErrors({ form: msg });
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
          Platform Fyers / Kotak / Upstox credentials can only be changed by Super Administrators.
        </p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Broker API"
        description="Platform feed for Terminal, charts, and server plans. Pick a default — others are automatic fallback."
        icon={KeyRound}
      />

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Panel className="space-y-4 p-5 sm:p-6">
          <div className="border-b border-admin-border pb-4">
            <h3 className="text-sm font-semibold text-white">Default live feed</h3>
            <p className="mt-1 text-xs text-admin-muted">
              Primary broker for quotes + candles. If it fails, system tries the other two automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { id: 'kotak', label: 'Kotak Neo', hint: 'Recommended · TOTP auto login' },
              { id: 'fyers', label: 'Fyers', hint: 'Daily access token' },
              { id: 'upstox', label: 'Upstox', hint: 'Daily access token' }
            ].map((opt) => {
              const selected = defaultProvider === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setDefaultProvider(opt.id);
                    setErrors({});
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-emerald-600/60 bg-emerald-950/40 ring-1 ring-emerald-500/40'
                      : 'border-admin-border bg-admin-panel/40 hover:border-slate-600'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{opt.label}</div>
                  <div className="mt-1 text-[11px] text-admin-muted">{opt.hint}</div>
                  {selected && (
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Default
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-admin-muted">
            Priority now:{' '}
            <span className="font-mono text-slate-300">
              {defaultProvider}
              {' → '}
              {['kotak', 'fyers', 'upstox'].filter((p) => p !== defaultProvider).join(' → ')}
            </span>
          </p>
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Fyers API v3</h3>
              <p className="mt-1 text-xs text-admin-muted">
                Live feed + charts when selected as default or used as fallback. Daily token required.
              </p>
            </div>
            <span
              className={`admin-chip ${
                pb.fyers?.configured
                  ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-amber-800/50 bg-amber-950/40 text-amber-200'
              }`}
            >
              {defaultProvider === 'fyers'
                ? 'Default'
                : pb.fyers?.configured
                  ? 'Fallback · Configured'
                  : 'Not set'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">App ID</label>
              <input
                type="text"
                autoComplete="off"
                value={fyers.appId}
                onChange={(e) => setFyersField('appId', e.target.value)}
                placeholder="XXXXXX-100"
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.fyersAppId)}`}
              />
              {errors.fyersAppId && <p className="mt-1.5 text-xs text-rose-400">{errors.fyersAppId}</p>}
            </div>
            <div>
              <label className="admin-label">App Secret</label>
              <input
                type="password"
                autoComplete="off"
                value={fyers.appSecret}
                onChange={(e) => setFyersField('appSecret', e.target.value)}
                placeholder={pb.fyers?.configured ? 'Leave masked to keep current' : 'App secret'}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label">Access token</label>
              <input
                type="password"
                autoComplete="off"
                value={fyers.accessToken}
                onChange={(e) => setFyersField('accessToken', e.target.value)}
                placeholder={
                  pb.fyers?.configured ? 'Leave masked to keep · or paste new daily token' : 'Access token'
                }
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.fyersAccessToken)}`}
              />
              {errors.fyersAccessToken && (
                <p className="mt-1.5 text-xs text-rose-400">{errors.fyersAccessToken}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label">Refresh token (~15 days)</label>
              <input
                type="password"
                autoComplete="off"
                value={fyers.refreshToken}
                onChange={(e) => setFyersField('refreshToken', e.target.value)}
                placeholder={pb.fyers?.configured ? 'Leave masked to keep current' : 'Refresh token'}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">PIN (for auto refresh)</label>
              <input
                type="password"
                autoComplete="off"
                value={fyers.pin}
                onChange={(e) => setFyersField('pin', e.target.value)}
                placeholder={pb.fyers?.canAutoRefresh ? '••••••' : 'Fyers trading PIN'}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">Redirect URI</label>
              <input
                type="text"
                autoComplete="off"
                value={fyers.redirectUri}
                onChange={(e) => setFyersField('redirectUri', e.target.value)}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
          </div>
          {pb.fyers?.canAutoRefresh ? (
            <p className="text-[11px] text-emerald-400/90">Auto daily refresh enabled (PIN + refresh token set).</p>
          ) : (
            <p className="text-[11px] text-admin-muted">
              Without PIN + refresh token you must paste a new access token after ~6:30 AM.
            </p>
          )}
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Kotak Neo</h3>
              <p className="mt-1 text-xs text-admin-muted">
                Live feed + Order Flow. TOTP login — best default when Fyers quota is tight.
              </p>
            </div>
            <span
              className={`admin-chip ${
                pb.kotak?.configured
                  ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400'
              }`}
            >
              {defaultProvider === 'kotak'
                ? 'Default'
                : pb.kotak?.configured
                  ? 'Fallback · Configured'
                  : 'Optional'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="admin-label">Consumer Key</label>
              <input
                type="password"
                autoComplete="off"
                value={kotak.consumerKey}
                onChange={(e) => setKotakField('consumerKey', e.target.value)}
                placeholder={pb.kotak?.configured ? 'Leave masked to keep current' : 'Kotak consumer key'}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">UCC</label>
              <input
                type="text"
                autoComplete="off"
                value={kotak.ucc}
                onChange={(e) => setKotakField('ucc', e.target.value)}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">Mobile (+91…)</label>
              <input
                type="text"
                autoComplete="off"
                value={kotak.mobileNumber}
                onChange={(e) => setKotakField('mobileNumber', e.target.value)}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">MPIN</label>
              <input
                type="password"
                autoComplete="off"
                value={kotak.mpin}
                onChange={(e) => setKotakField('mpin', e.target.value)}
                placeholder={pb.kotak?.configured ? 'Leave masked to keep current' : ''}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
            <div>
              <label className="admin-label">TOTP secret</label>
              <input
                type="password"
                autoComplete="off"
                value={kotak.totpKey}
                onChange={(e) => setKotakField('totpKey', e.target.value)}
                placeholder={pb.kotak?.configured ? 'Leave masked to keep current' : ''}
                className="admin-input font-mono border border-admin-border"
              />
            </div>
          </div>
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Upstox</h3>
              <p className="mt-1 text-xs text-admin-muted">
                Fallback / Order Flow option chain. Paste daily access token when needed.
              </p>
            </div>
            <span
              className={`admin-chip ${
                pb.upstox?.configured
                  ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400'
              }`}
            >
              {defaultProvider === 'upstox'
                ? 'Default'
                : pb.upstox?.configured
                  ? 'Fallback · Configured'
                  : 'Optional'}
            </span>
          </div>

          <div>
            <label className="admin-label">Access token</label>
            <input
              type="password"
              autoComplete="off"
              value={upstoxToken}
              onChange={(e) => {
                setUpstoxToken(e.target.value);
                setErrors({});
              }}
              placeholder={
                pb.upstox?.configured ? 'Leave masked to keep current · or paste a new daily token' : 'Upstox access token'
              }
              className={`admin-input font-mono border ${fieldBorderClass(!!errors.upstoxToken)}`}
            />
            {errors.upstoxToken && (
              <p className="mt-1.5 text-xs text-rose-400">{errors.upstoxToken}</p>
            )}
          </div>
        </Panel>

        {errors.form && <p className="text-sm text-rose-400">{errors.form}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="admin-btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save broker credentials'}
          </button>
          <p className="text-[11px] text-admin-muted">
            One save updates default + Fyers + Kotak + Upstox and restarts the live feed. Masked
            fields keep the previous secret.
          </p>
        </div>
      </form>
    </div>
  );
}
