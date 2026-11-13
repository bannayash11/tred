import React, { useMemo, useState } from 'react';
import { KeyRound, Shield, X, Loader2, ExternalLink, BookOpen } from 'lucide-react';
import {
  BYOK_BROKERS,
  getByokBroker,
  validateByokForm,
  buildByokPayload
} from '../lib/byokBrokers';

function emptyValues(brokerId) {
  const broker = getByokBroker(brokerId);
  const values = {};
  for (const f of broker.fields) values[f.key] = '';
  return values;
}

/**
 * Multi-broker BYOK form: Upstox · Kotak Neo · Groww · Angel One
 * Shows field inputs + step-by-step setup instructions per broker.
 */
export default function ByokCredentialsForm({
  open,
  plan,
  onClose,
  onSubmit,
  submitting = false,
  error = ''
}) {
  const [provider, setProvider] = useState('upstox');
  const [values, setValues] = useState(() => emptyValues('upstox'));
  const [localError, setLocalError] = useState('');
  const [showSteps, setShowSteps] = useState(true);

  const broker = useMemo(() => getByokBroker(provider), [provider]);

  if (!open || !plan) return null;

  const switchProvider = (id) => {
    setProvider(id);
    setValues(emptyValues(id));
    setLocalError('');
  };

  const setField = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    const msg = validateByokForm(provider, values);
    if (msg) {
      setLocalError(msg);
      return;
    }
    onSubmit?.(buildByokPayload(provider, values));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
        disabled={submitting}
      />
      <div className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[94vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold text-violet-300 mb-2">
              <KeyRound className="h-3 w-3" />
              BYOK · Bring Your Own Key
            </div>
            <h3 className="text-base font-bold text-white">Connect your broker</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Activating <span className="text-cyan-300 font-semibold">{plan.name}</span>
              {Number(plan.originalPrice) > Number(plan.price) && (
                <>
                  {' '}
                  ·{' '}
                  <span className="line-through text-slate-500">
                    ₹{Number(plan.originalPrice).toLocaleString('en-IN')}
                  </span>
                </>
              )}{' '}
              · offer ₹{Number(plan.price || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1.5">Select broker</label>
            <div className="grid grid-cols-2 gap-2">
              {BYOK_BROKERS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => switchProvider(b.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    provider === b.id
                      ? 'border-violet-500 bg-violet-500/15 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-bold">{b.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">{b.short}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 flex gap-2 text-[11px] text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Secrets are validated once, then encrypted (AES-256-GCM) on our server. They are never
              shown again in the app.
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSteps((s) => !s)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-900/80 text-[11px] font-bold text-cyan-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                How to get {broker.label} keys
              </span>
              <span className="text-slate-500 font-semibold">{showSteps ? 'Hide' : 'Show'}</span>
            </button>
            {showSteps && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-800">
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  {broker.steps.map((step, i) => (
                    <li key={i} className="pl-0.5">
                      {step}
                    </li>
                  ))}
                </ol>
                {broker.docsUrl && (
                  <a
                    href={broker.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-300 hover:text-violet-200"
                  >
                    Official docs <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {broker.fields.map((field) => (
              <div key={field.key}>
                <label className="text-slate-400 block mb-1">
                  {field.label}
                  {!field.required && (
                    <span className="text-slate-600 font-normal"> · optional</span>
                  )}
                </label>
                <input
                  type={field.type || 'text'}
                  autoComplete="off"
                  spellCheck={false}
                  value={values[field.key] || ''}
                  onChange={setField(field.key)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl bg-slate-900 p-2.5 text-white border border-slate-800 focus:border-violet-500/50 outline-none font-mono text-[11px]"
                  disabled={submitting}
                />
              </div>
            ))}
          </div>

          {(localError || error) && (
            <div className="rounded-xl border border-rose-800/70 bg-rose-950/40 px-3 py-2 text-rose-300 text-[11px]">
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl py-3 text-xs font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Validating {broker.label}…
              </>
            ) : (
              <>Activate with {broker.label}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
