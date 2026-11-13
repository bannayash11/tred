import React, { useCallback, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { createPaymentOrder, verifyPaymentApi, markPaymentFailedApi } from '../services/api';
import { toErrorText } from '../lib/apiError';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

/**
 * Razorpay checkout — membership activates only after payment verify succeeds.
 *
 * Props:
 * - planId (required)
 * - amount (number, INR — must match plan.price)
 * - customerDetails: { name, email, phone }
 * - byokCredentials?: object (optional; BYOK keys are normally collected after payment)
 * - description?: string
 * - buttonLabel?: string
 * - className?: string
 * - disabled?: boolean
 * - autoStart?: boolean — start checkout immediately when mounted
 * - onSuccess?: ({ payment, user, membershipActivated }) => void
 * - onFailure?: (error) => void
 * - onDismiss?: () => void
 */
export default function RazorpayCheckout({
  planId,
  amount,
  customerDetails,
  byokCredentials = null,
  description = 'Membership checkout',
  buttonLabel = 'Pay Now',
  className = '',
  disabled = false,
  autoStart = false,
  hideButton = false,
  onSuccess,
  onFailure,
  onDismiss
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | success | failed
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(false);

  const handlePay = useCallback(async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');

    let orderId = null;

    try {
      if (!planId) throw new Error('Plan is required for checkout.');
      if (!amount || Number(amount) < 1) throw new Error('Invalid payment amount.');
      if (!customerDetails?.name || !customerDetails?.email) {
        throw new Error('Customer name and email are required.');
      }

      await loadRazorpayScript();

      const orderRes = await createPaymentOrder({
        planId,
        amount: Number(amount),
        customerDetails: {
          name: customerDetails.name,
          email: customerDetails.email,
          phone: customerDetails.phone || ''
        },
        ...(byokCredentials ? { byokCredentials } : {})
      });

      if (!orderRes?.success || !orderRes.orderId) {
        throw new Error(
          toErrorText(orderRes?.message, 'Could not create payment order.')
        );
      }

      orderId = orderRes.orderId;
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || orderRes.keyId;
      if (!keyId) {
        throw new Error('Razorpay key is missing. Set VITE_RAZORPAY_KEY_ID.');
      }

      const options = {
        key: keyId,
        amount: Math.round(Number(orderRes.amount || amount) * 100),
        currency: orderRes.currency || 'INR',
        name: 'Tradrift Analytics',
        description: description || orderRes.planName || 'Membership',
        order_id: orderId,
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone || ''
        },
        theme: { color: '#f59e0b' },
        // Enable every standard Razorpay method (must also be ON in Razorpay Dashboard)
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          cardless_emi: true,
          paylater: true
        },
        // UPI first, then all other modes — do not hide anything
        config: {
          display: {
            blocks: {
              upi_first: {
                name: 'UPI — GPay, PhonePe, Paytm & QR',
                instruments: [{ method: 'upi' }]
              },
              cards: {
                name: 'Credit / Debit Cards',
                instruments: [{ method: 'card' }]
              },
              banking: {
                name: 'Netbanking',
                instruments: [{ method: 'netbanking' }]
              },
              wallets: {
                name: 'Wallets',
                instruments: [{ method: 'wallet' }]
              },
              emi_paylater: {
                name: 'EMI & Pay Later',
                instruments: [
                  { method: 'emi' },
                  { method: 'cardless_emi' },
                  { method: 'paylater' }
                ]
              }
            },
            sequence: [
              'block.upi_first',
              'block.cards',
              'block.banking',
              'block.wallets',
              'block.emi_paylater'
            ],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        handler: async (response) => {
          try {
            const verifyRes = await verifyPaymentApi({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              ...(byokCredentials ? { byokCredentials } : {})
            });

            if (!verifyRes?.success) {
              throw new Error(toErrorText(verifyRes?.message, 'Payment verification failed.'));
            }

            // Payment verified = success. Membership may activate now or after BYOK connect.
            if (verifyRes.paymentVerified || verifyRes.membershipActivated) {
              const activated = !!verifyRes.membershipActivated;
              setStatus('success');
              setMessage(
                activated
                  ? 'Payment confirmed. Membership activated!'
                  : 'Payment confirmed! Next step: connect your broker.'
              );
              onSuccess?.({
                payment: verifyRes.payment,
                user: verifyRes.user,
                membershipActivated: activated,
                paymentVerified: true,
                message: verifyRes.message
              });
              return;
            }

            throw new Error(
              toErrorText(verifyRes.message, 'Payment could not be confirmed. Please try again.')
            );
          } catch (err) {
            const msg = toErrorText(
              err?.userMessage || err?.message || err,
              'Verification failed. Contact support with your Order ID.'
            );
            setStatus('failed');
            setMessage(msg);
            onFailure?.({ ...err, message: msg, userMessage: msg });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setMessage('Checkout closed. You can try again anytime.');
            onDismiss?.();
          }
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', async (response) => {
        const error = response?.error || {};
        try {
          await markPaymentFailedApi({
            razorpay_order_id: error.metadata?.order_id || orderId,
            razorpay_payment_id: error.metadata?.payment_id,
            error: {
              description: error.description,
              reason: error.reason || error.code
            }
          });
        } catch {
          /* webhook still covers accuracy */
        }

        setStatus('failed');
        setMessage(error.description || 'Payment failed. Please retry with UPI or another method.');
        setLoading(false);
        onFailure?.(error);
      });

      rzp.open();
    } catch (err) {
      if (orderId) {
        try {
          await markPaymentFailedApi({
            razorpay_order_id: orderId,
            error: { description: err.message, reason: 'checkout_init_failed' }
          });
        } catch {
          /* ignore */
        }
      }
      const msg = toErrorText(
        err?.userMessage || err?.message || err,
        'Unable to start checkout. Please try again.'
      );
      setStatus('failed');
      setMessage(msg);
      setLoading(false);
      onFailure?.({ message: msg, userMessage: msg, cause: err });
    }
  }, [
    amount,
    byokCredentials,
    customerDetails,
    description,
    onDismiss,
    onFailure,
    onSuccess,
    planId
  ]);

  React.useEffect(() => {
    if (autoStart && !started && !disabled) {
      setStarted(true);
      handlePay();
    }
  }, [autoStart, disabled, handlePay, started]);

  if (hideButton) {
    return (
      <div className="space-y-2">
        {loading && (
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Opening secure Razorpay checkout…
          </p>
        )}
        {status === 'failed' && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-800 bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {message}{' '}
              <button type="button" onClick={handlePay} className="underline underline-offset-2">
                Retry
              </button>
            </span>
          </div>
        )}
        {status === 'success' && (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/80 px-3 py-2 text-xs font-semibold text-emerald-300">
            {message}
          </div>
        )}
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
        {message || 'Payment confirmed.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || loading}
        className={
          className ||
          'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            {buttonLabel}
          </>
        )}
      </button>

      {status === 'failed' && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-800 bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {message}{' '}
            <button
              type="button"
              onClick={handlePay}
              className="underline underline-offset-2 hover:text-rose-200"
            >
              Retry payment
            </button>
          </span>
        </div>
      )}

      {message && status === 'idle' && <p className="text-[11px] text-slate-400">{message}</p>}
    </div>
  );
}
