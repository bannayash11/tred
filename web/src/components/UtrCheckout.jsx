import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, QrCode, ShieldCheck, AlertTriangle } from 'lucide-react';
import { fetchUtrConfig, submitUtrPaymentApi } from '../services/api';
import { toErrorText } from '../lib/apiError';

/**
 * Manual UPI / UTR checkout — membership activates after admin verifies UTR.
 */
export default function UtrCheckout({
  planId,
  amount,
  customerDetails,
  buttonLabel,
  onSuccess,
  onFailure
}) {
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | failed
  const [activatedOk, setActivatedOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    fetchUtrConfig()
      .then((res) => {
        if (cancelled) return;
        setConfig(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setConfig({ success: false, enabled: false, configured: false });
        setMessage(toErrorText(err?.userMessage || err?.message, 'Could not load UPI details.'));
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upiDeepLink = useMemo(() => {
    if (!config?.upiId || !amount) return '';
    const params = new URLSearchParams({
      pa: config.upiId,
      pn: config.payeeName || 'Tradrift',
      am: String(Number(amount).toFixed(2)),
      cu: 'INR',
      tn: `Membership ${planId || ''}`.trim()
    });
    return `upi://pay?${params.toString()}`;
  }, [config?.upiId, config?.payeeName, amount, planId]);

  const qrSrc = useMemo(() => {
    if (config?.qrImageUrl) return config.qrImageUrl;
    if (!upiDeepLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(upiDeepLink)}`;
  }, [config?.qrImageUrl, upiDeepLink]);

  const copyUpi = useCallback(async () => {
    if (!config?.upiId) return;
    try {
      await navigator.clipboard.writeText(config.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setMessage('Could not copy UPI ID — select and copy manually.');
    }
  }, [config?.upiId]);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setSubmitting(true);
      setMessage('');
      setStatus('idle');
      try {
        if (!planId) throw new Error('Plan is required.');
        if (!amount || Number(amount) < 1) throw new Error('Invalid amount.');
        if (!customerDetails?.name || !customerDetails?.email) {
          throw new Error('Customer name and email are required.');
        }
        const cleaned = String(utr || '')
          .trim()
          .toUpperCase()
          .replace(/[\s\-]/g, '');
        if (cleaned.length < 8) {
          throw new Error('Enter the full UTR / UPI reference from your payment app.');
        }

        const res = await submitUtrPaymentApi({
          planId,
          amount: Number(amount),
          utr: cleaned,
          customerDetails
        });

        if (!res?.success) {
          throw new Error(res?.message || 'UTR submit failed.');
        }

        const didActivate = !!(res.membershipActivated || res.autoApproved);
        setActivatedOk(didActivate);
        setStatus('success');
        setMessage(
          res.message ||
            (didActivate
              ? 'UTR received. Membership is now active.'
              : 'UTR submitted. Membership will activate after admin verifies your payment.')
        );
        onSuccess?.({
          payment: res.payment,
          user: res.user || null,
          paymentVerified: !!res.paymentVerified || !!res.autoApproved,
          membershipActivated: !!res.membershipActivated,
          autoApproved: !!res.autoApproved,
          pendingUtr: !didActivate,
          status: res.status || (didActivate ? 'paid' : 'pending')
        });
      } catch (err) {
        setStatus('failed');
        const msg = toErrorText(
          err?.userMessage || err?.response?.data?.message || err?.message,
          'Could not submit UTR. Please try again.'
        );
        setMessage(msg);
        onFailure?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [planId, amount, customerDetails, utr, onSuccess, onFailure]
  );

  if (configLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading UPI details…
      </div>
    );
  }

  if (!config?.enabled || !config?.configured || !config?.upiId) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">UTR / UPI payments are not available right now.</p>
            <p className="mt-1 opacity-90">Choose Razorpay for instant checkout, or try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-200">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold">
              {activatedOk
                ? 'Payment confirmed — membership active'
                : 'UTR received — pending verification'}
            </p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-950/40 p-4 sm:p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 text-center sm:text-left">
          {config.instructions}
        </p>

        <div className="flex flex-col items-center gap-4">
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-600 bg-white p-3 shadow-sm">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="Scan UPI QR to pay"
                width={224}
                height={224}
                className="h-52 w-52 sm:h-56 sm:w-56 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-52 w-52 sm:h-56 sm:w-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">
                <QrCode className="h-14 w-14 mb-2" />
                <span className="text-xs font-semibold">QR unavailable</span>
              </div>
            )}
            <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Scan with any UPI app
            </p>
          </div>

          <div className="w-full space-y-2.5 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pay to</p>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {config.payeeName || 'Tradrift'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <code className="rounded-lg bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 break-all">
                {config.upiId}
              </code>
              <button
                type="button"
                onClick={copyUpi}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Exact amount:{' '}
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                ₹{Number(amount).toLocaleString('en-IN')}
              </span>
            </p>
            {upiDeepLink ? (
              <a
                href={upiDeepLink}
                className="inline-flex text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Open UPI app →
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          UTR / UPI Reference Number
        </label>
        <input
          type="text"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="e.g. 123456789012"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-3 text-sm font-mono font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500/60 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-slate-500">
          Find this in GPay / PhonePe / Paytm / bank SMS after payment.
        </p>
      </div>

      {message && status === 'failed' ? (
        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{message}</p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !utr.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {buttonLabel || `Submit UTR · ₹${Number(amount).toLocaleString('en-IN')}`}
      </button>

      <p className="text-center text-[10px] text-slate-500 dark:text-slate-400">
        Not instant — admin verifies UTR, then membership activates.
      </p>
    </div>
  );
}
