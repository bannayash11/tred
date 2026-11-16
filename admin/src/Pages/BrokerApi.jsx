import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Save } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fieldBorderClass, firstError, isMaskedToken } from '../lib/formValidation';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

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

  const [kotak, setKotak] = useState(() => ({
    ...emptyKotak(),
    ...(pb.kotak || {})
  }));
  const [upstoxToken, setUpstoxToken] = useState(pb.upstox?.accessToken || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const next = systemSettings?.platformBroker;
    if (!next) return;
    setKotak((prev) => ({
      ...prev,
      consumerKey: next.kotak?.consumerKey || prev.consumerKey || '',
      ucc: next.kotak?.ucc || prev.ucc || '',
      mobileNumber: next.kotak?.mobileNumber || prev.mobileNumber || '',
      mpin: next.kotak?.mpin || prev.mpin || '',
      totpKey: next.kotak?.totpKey || prev.totpKey || ''
    }));
    if (next.upstox?.accessToken) setUpstoxToken(next.upstox.accessToken);
  }, [systemSettings?.platformBroker]);

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
    // Allow saving with masked existing secrets; only require fields if nothing configured yet
    const kotakConfigured = !!pb.kotak?.configured;
    const upstoxConfigured = !!pb.upstox?.configured;

    if (!kotakConfigured) {
      if (!String(kotak.consumerKey || '').trim() || isMaskedToken(kotak.consumerKey)) {
        nextErr.consumerKey = 'Kotak Consumer Key required.';
      }
      if (!String(kotak.ucc || '').trim()) nextErr.ucc = 'UCC required.';
      if (!String(kotak.mobileNumber || '').trim() || String(kotak.mobileNumber).includes('•')) {
        nextErr.mobileNumber = 'Mobile number required.';
      }
      if (!String(kotak.mpin || '').trim() || isMaskedToken(kotak.mpin)) {
        nextErr.mpin = 'MPIN required.';
      }
      if (!String(kotak.totpKey || '').trim() || isMaskedToken(kotak.totpKey)) {
        nextErr.totpKey = 'TOTP key required.';
      }
    }

    // Upstox optional — but if typing a new one, don't leave blank wipe (masked kept server-side)
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
          Platform Kotak / Upstox credentials can only be changed by Super Administrators.
        </p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Broker API"
        description="Platform feed credentials — save Kotak and Upstox together. Used for Terminal, charts, and Order Flow (server plans)."
        icon={KeyRound}
      />

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Kotak Neo</h3>
              <p className="mt-1 text-xs text-admin-muted">
                Primary live market feed for screener, charts, and Order Flow.
              </p>
            </div>
            <span
              className={`admin-chip ${
                pb.kotak?.configured
                  ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-amber-800/50 bg-amber-950/40 text-amber-200'
              }`}
            >
              {pb.kotak?.configured ? 'Configured' : 'Not set'}
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
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.consumerKey)}`}
              />
              {errors.consumerKey && <p className="mt-1.5 text-xs text-rose-400">{errors.consumerKey}</p>}
            </div>
            <div>
              <label className="admin-label">UCC</label>
              <input
                type="text"
                autoComplete="off"
                value={kotak.ucc}
                onChange={(e) => setKotakField('ucc', e.target.value)}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.ucc)}`}
              />
              {errors.ucc && <p className="mt-1.5 text-xs text-rose-400">{errors.ucc}</p>}
            </div>
            <div>
              <label className="admin-label">Mobile (+91…)</label>
              <input
                type="text"
                autoComplete="off"
                value={kotak.mobileNumber}
                onChange={(e) => setKotakField('mobileNumber', e.target.value)}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.mobileNumber)}`}
              />
              {errors.mobileNumber && (
                <p className="mt-1.5 text-xs text-rose-400">{errors.mobileNumber}</p>
              )}
            </div>
            <div>
              <label className="admin-label">MPIN</label>
              <input
                type="password"
                autoComplete="off"
                value={kotak.mpin}
                onChange={(e) => setKotakField('mpin', e.target.value)}
                placeholder={pb.kotak?.configured ? 'Leave masked to keep current' : ''}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.mpin)}`}
              />
              {errors.mpin && <p className="mt-1.5 text-xs text-rose-400">{errors.mpin}</p>}
            </div>
            <div>
              <label className="admin-label">TOTP secret</label>
              <input
                type="password"
                autoComplete="off"
                value={kotak.totpKey}
                onChange={(e) => setKotakField('totpKey', e.target.value)}
                placeholder={pb.kotak?.configured ? 'Leave masked to keep current' : ''}
                className={`admin-input font-mono border ${fieldBorderClass(!!errors.totpKey)}`}
              />
              {errors.totpKey && <p className="mt-1.5 text-xs text-rose-400">{errors.totpKey}</p>}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Upstox</h3>
              <p className="mt-1 text-xs text-admin-muted">
                Order Flow fallback when Kotak is down (`ORDER_FLOW_PROVIDER=auto`).
              </p>
            </div>
            <span
              className={`admin-chip ${
                pb.upstox?.configured
                  ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400'
              }`}
            >
              {pb.upstox?.configured ? 'Configured' : 'Optional'}
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

        {errors.form && (
          <p className="text-sm text-rose-400">{errors.form}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="admin-btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Kotak + Upstox'}
          </button>
          <p className="text-[11px] text-admin-muted">
            One save updates both. Masked fields keep the previous secret. BYOK users still use their own keys.
          </p>
        </div>
      </form>
    </div>
  );
}
