import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  KeyRound,
  Loader2,
  Shield,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  Server,
  Zap,
  Smartphone,
  LayoutDashboard,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { updateUser } from '../store/slices/authSlice';
import { setPlans } from '../store/slices/contentSlice';
import { fetchPublicPlans, fetchUtrConfig, updateByokCredentialsApi } from '../services/api';
import { toErrorText } from '../lib/apiError';
import RazorpayCheckout from '../components/RazorpayCheckout';
import UtrCheckout from '../components/UtrCheckout';
import {
  BYOK_BROKERS,
  getByokBroker,
  validateByokForm,
  buildByokPayload,
} from '../lib/byokBrokers';
import { needsByokBrokerConnect } from '../lib/membership';

function emptyByokValues(brokerId) {
  const broker = getByokBroker(brokerId);
  const values = {};
  for (const f of broker.fields) values[f.key] = '';
  return values;
}

function StepDot({ step, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all ${
          active
            ? 'bg-gradient-to-tr from-cyan-400 to-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/40'
            : done
            ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
            : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800/90 dark:text-slate-400 dark:border-slate-700/60'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step}
      </span>
      <span
        className={`text-xs font-bold tracking-tight transition-colors ${
          active
            ? 'text-slate-900 dark:text-white'
            : done
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function MembershipCheckout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const planIdParam = searchParams.get('planId') || '';
  const forceConnectBroker = searchParams.get('connectBroker') === '1';
  const payRef = useRef(null);

  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const authUser = useSelector((state) => state.auth.user);
  const plansFromStore = useSelector((state) => state.content?.plans || []);

  const planId = planIdParam || authUser?.subscription?.planId || '';
  const mustConnectBroker = forceConnectBroker || needsByokBrokerConnect(authUser);

  const [plans, setLocalPlans] = useState(plansFromStore);
  const [loading, setLoading] = useState(!plansFromStore.length);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(authUser?.name || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [readyToPay, setReadyToPay] = useState(false);
  /** razorpay | utr — user picks how to pay (default prefers UTR; Razorpay often admin-off) */
  const [payMethod, setPayMethod] = useState('utr');
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const [utrAvailable, setUtrAvailable] = useState(false);
  const [utrPendingDone, setUtrPendingDone] = useState(false);
  const [utrPendingInfo, setUtrPendingInfo] = useState({ utr: '', orderId: '', amount: null });
  /** After BYOK payment: collect demat/broker API keys */
  const [awaitingByok, setAwaitingByok] = useState(() => mustConnectBroker);
  const [byokProvider, setByokProvider] = useState('upstox');
  const [byokValues, setByokValues] = useState(() => emptyByokValues('upstox'));
  const [showByokHelp, setShowByokHelp] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [byokSubmitting, setByokSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/checkout?planId=${planId}`)}`, { replace: true });
    }
  }, [isAuthenticated, navigate, planId]);

  useEffect(() => {
    if (authUser) {
      setName(authUser.name || '');
      setEmail(authUser.email || '');
    }
  }, [authUser]);

  useEffect(() => {
    if (mustConnectBroker) {
      setAwaitingByok(true);
      setReadyToPay(false);
    }
  }, [mustConnectBroker]);

  useEffect(() => {
    let cancelled = false;
    if (plansFromStore.length) {
      setLocalPlans(plansFromStore);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchPublicPlans()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.plans) {
          setLocalPlans(res.plans);
          dispatch(setPlans(res.plans));
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.userMessage || 'Could not load plan.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, plansFromStore.length]);

  useEffect(() => {
    if (readyToPay && payRef.current) {
      payRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [readyToPay]);

  useEffect(() => {
    let cancelled = false;
    fetchUtrConfig()
      .then((res) => {
        if (cancelled) return;
        const rzOn = !!res?.razorpayEnabled;
        const utrOn = !!(res?.utrEnabled || (res?.enabled && res?.configured && res?.upiId));
        setRazorpayAvailable(rzOn);
        setUtrAvailable(utrOn);
        // Prefer UTR when available; else Razorpay if admin enabled it
        if (utrOn) setPayMethod('utr');
        else if (rzOn) setPayMethod('razorpay');
        else setPayMethod('utr');
      })
      .catch(() => {
        if (!cancelled) {
          setRazorpayAvailable(false);
          setUtrAvailable(false);
          setPayMethod('utr');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(
    () => (plans || []).find((p) => p.id === planId && p.enabled !== false) || null,
    [plans, planId]
  );

  const isByok =
    plan?.mode === 'byok' ||
    authUser?.subscription?.mode === 'byok' ||
    !!authUser?.subscription?.byokGranted;
  const broker = useMemo(() => getByokBroker(byokProvider), [byokProvider]);
  const months = plan ? plan.durationMonths || Math.round((plan.durationDays || 30) / 30) : 0;

  const originalPrice = Number(plan?.originalPrice || 0);
  const finalPrice = Number(plan?.price || 0);
  const discountAmount = originalPrice > finalPrice ? originalPrice - finalPrice : 0;
  const discountPct = originalPrice > finalPrice ? Math.round((discountAmount / originalPrice) * 100) : 0;

  const customerDetails = useMemo(
    () => ({
      name: String(name || '').trim(),
      email: String(email || authUser?.email || '').trim().toLowerCase(),
      phone: String(authUser?.phone || '').trim()
    }),
    [name, email, authUser?.email, authUser?.phone]
  );

  const detailsErrors = useMemo(() => {
    const errors = {};
    if (customerDetails.name.length < 2) {
      errors.name = 'Full name is required (min 2 characters).';
    } else if (!/^[a-zA-Z\s.'-]{2,80}$/.test(customerDetails.name)) {
      errors.name = 'Enter a valid full name.';
    }
    if (!customerDetails.email) {
      errors.email = 'Registered email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerDetails.email)) {
      errors.email = 'Registered email is missing or invalid.';
    }
    return errors;
  }, [customerDetails.name, customerDetails.email]);

  const detailsComplete = Object.keys(detailsErrors).length === 0;

  useEffect(() => {
    if (readyToPay && !detailsComplete) {
      setReadyToPay(false);
    }
  }, [readyToPay, detailsComplete]);

  const markDirty = () => {
    setReadyToPay(false);
    setFormError('');
    setFieldErrors({});
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const continueToPayment = (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setReadyToPay(false);

    if (!plan) {
      setFormError('Please select a membership plan first.');
      return;
    }
    if (!detailsComplete) {
      setFieldErrors(detailsErrors);
      setFormError(
        toErrorText(Object.values(detailsErrors)[0], 'Please fill all required details first.')
      );
      return;
    }
    setReadyToPay(true);
  };

  const connectBrokerAfterPayment = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    const msg = validateByokForm(byokProvider, byokValues);
    if (msg) {
      setFieldErrors({ byok: msg });
      setFormError(msg);
      return;
    }
    setByokSubmitting(true);
    try {
      const payload = buildByokPayload(byokProvider, byokValues);
      const res = await updateByokCredentialsApi(payload);
      if (res?.user) dispatch(updateUser(res.user));
      setSuccess(true);
      setTimeout(() => navigate('/terminal'), 1200);
    } catch (err) {
      setFormError(
        toErrorText(
          err?.userMessage || err?.response?.data?.message || err?.message || err,
          'Could not connect broker. Check your demat API keys and try again.'
        )
      );
    } finally {
      setByokSubmitting(false);
    }
  };

  const skipBrokerConnect = () => {
    // Paid BYOK without keys cannot use terminal — keep them on this step
    if (mustConnectBroker || needsByokBrokerConnect(authUser)) {
      setFormError('Broker API keys are required before you can open Terminal or Order Flow.');
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/terminal'), 800);
  };

  const shell = (children) => (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 min-h-[75vh] overflow-hidden bg-slate-50 dark:bg-[#070b14] transition-colors duration-200">
      {/* Dynamic Ambient Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-[#090e1c] via-[#070b14] to-[#050811]" />
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
            <div className="absolute top-1/3 -right-16 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
            <div className="absolute bottom-0 left-10 h-80 w-80 rounded-full bg-indigo-600/10 blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/90 via-white to-slate-50" />
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-emerald-400/10 blur-[100px]" />
            <div className="absolute top-1/3 -right-16 h-96 w-96 rounded-full bg-cyan-400/10 blur-[100px]" />
            <div className="absolute bottom-0 left-10 h-80 w-80 rounded-full bg-indigo-400/5 blur-[90px]" />
          </>
        )}
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)'
              : 'linear-gradient(rgba(100,116,139,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.07) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)'
          }}
        />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex min-h-[45vh] flex-col items-center justify-center text-sm text-slate-600 dark:text-slate-300 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 dark:text-emerald-400" />
        <span className="font-medium text-slate-500 dark:text-slate-400">Loading plan details…</span>
      </div>
    );
  }

  if (!mustConnectBroker && (!planId || !plan)) {
    return shell(
      <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0c1322]/90 p-8 sm:p-10 text-center shadow-xl dark:shadow-2xl backdrop-blur-xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">No plan selected</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Please choose a membership plan to continue with your checkout and terminal access.
          </p>
        </div>
        <Link
          to="/pricing"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.99] transition-all"
        >
          <span>View Membership Plans</span>
        </Link>
      </div>
    );
  }

  if (success) {
    return shell(
      <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-950/40 p-8 sm:p-10 text-center shadow-xl dark:shadow-2xl backdrop-blur-xl animate-fadeIn">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-9 w-9" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Payment Successful!</h2>
          <p className="text-sm text-emerald-800 dark:text-emerald-200/90">
            Your membership is now active. Launching trading terminal…
          </p>
        </div>
      </div>
    );
  }

  /* ── UTR submitted: wait for manual payment confirmation (up to 24h) ── */
  if (utrPendingDone) {
    const shownAmount =
      utrPendingInfo.amount != null
        ? Number(utrPendingInfo.amount)
        : Number(plan?.price || 0);
    return shell(
      <div className="mx-auto max-w-lg animate-fadeIn">
        <div className="overflow-hidden rounded-3xl border border-cyan-300/70 dark:border-cyan-500/35 bg-white/95 dark:bg-[#0c1322]/95 shadow-2xl backdrop-blur-xl">
          <div className="relative border-b border-cyan-200/80 dark:border-cyan-500/20 bg-gradient-to-br from-cyan-50 via-white to-emerald-50/60 dark:from-cyan-950/50 dark:via-[#0c1322] dark:to-emerald-950/30 px-6 sm:px-8 pt-8 pb-7 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 shadow-lg shadow-cyan-500/10">
              <Clock className="h-8 w-8" />
            </div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Under review
            </p>
            <h2 className="mt-3 text-2xl sm:text-[1.7rem] font-black tracking-tight text-slate-900 dark:text-white">
              Please wait for payment confirmation
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              We received your UTR. Our team will verify the payment and activate your membership
              within <span className="font-bold text-slate-900 dark:text-white">24 hours</span>.
            </p>
          </div>

          <div className="space-y-5 px-6 sm:px-8 py-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/50 p-4 space-y-3">
              {utrPendingInfo.utr ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">UTR</span>
                  <code className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-bold font-mono text-cyan-700 dark:text-cyan-300 break-all">
                    {utrPendingInfo.utr}
                  </code>
                </div>
              ) : null}
              {shownAmount > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{shownAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : null}
              {plan?.name ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-right">
                    {plan.name}
                  </span>
                </div>
              ) : null}
              {utrPendingInfo.orderId ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Order</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 break-all text-right">
                    {utrPendingInfo.orderId}
                  </span>
                </div>
              ) : null}
            </div>

            <ol className="space-y-3">
              {[
                { done: true, title: 'UTR submitted', body: 'Your payment reference is saved.' },
                {
                  done: false,
                  title: 'We confirm payment',
                  body: 'Usually within 24 hours after bank/UPI check.'
                },
                {
                  done: false,
                  title: 'Membership activates',
                  body: 'You can then open Terminal from your dashboard.'
                }
              ].map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                      step.done
                        ? 'bg-emerald-500 text-slate-950'
                        : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-500'
                    }`}
                  >
                    {step.done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              Keep this UTR safe. You can close this page — we will activate membership after confirmation.
              Check your dashboard later for status.
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 hover:brightness-105"
              >
                <LayoutDashboard className="h-4 w-4" />
                Go to dashboard
              </button>
              <Link
                to="/pricing"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60 px-4 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Back to plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Post-payment: connect demat / broker API (BYOK only) ── */
  if (awaitingByok && isByok) {
    return shell(
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Paid · Connect broker API
          </div>
          <div className="flex items-center gap-2 sm:gap-3 bg-white/90 dark:bg-slate-900/60 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <StepDot step={1} label="Plan" done />
            <span className="h-0.5 w-4 bg-emerald-500/40 sm:w-8" />
            <StepDot step={2} label="Details" done />
            <span className="h-0.5 w-4 bg-emerald-500/40 sm:w-8" />
            <StepDot step={3} label="Payment" done />
            <span className="h-0.5 w-4 bg-emerald-500/40 sm:w-8" />
            <StepDot step={4} label="Broker" active />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-[#0e1628] dark:to-[#0a1122] p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Connect your demat / broker API
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Plan{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {plan?.name || authUser?.subscription?.plan || 'Your API'}
            </span>{' '}
            is unlocked. Broker API keys are required — Terminal / Order Flow stay locked until you connect.
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 dark:border-slate-800/90 dark:bg-[#0c1222]/90 shadow-xl backdrop-blur-2xl">
          <form onSubmit={connectBrokerAfterPayment} className="p-5 sm:p-8 space-y-6">
            {formError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm font-medium">{formError}</div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-[#090e1a]/90 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    Broker API Configuration
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  256-Bit Stored Encrypted
                </span>
              </div>

              <fieldset disabled={byokSubmitting} className="space-y-4 disabled:opacity-60">
                <div className="space-y-1.5 max-w-md">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select your broker <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={byokProvider}
                    onChange={(e) => {
                      const id = e.target.value;
                      setByokProvider(id);
                      setByokValues(emptyByokValues(id));
                      setShowByokHelp(false);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700/80 dark:bg-[#0e1628] px-4 py-3 text-sm text-slate-900 dark:text-white font-medium focus:border-cyan-500 dark:focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    {BYOK_BROKERS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                        {b.short ? ` — ${b.short}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/20 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">Zero Key Exposure: </span>
                    Keys are validated once via broker API and stored encrypted. Never logged or shown in plaintext.
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowByokHelp((s) => !s)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {showByokHelp ? 'Hide' : 'Need'} {broker.label} Setup Guide?
                  </button>
                  {showByokHelp && (
                    <div className="mt-2.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#080d18] p-4 space-y-3">
                      <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {broker.steps.slice(0, 4).map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 font-mono mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                      {broker.docsUrl && (
                        <a
                          href={broker.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400"
                        >
                          Open {broker.label} Developer Portal
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {broker.fields.map((f) => {
                    const isSecret = f.type === 'password';
                    const isShown = showSecrets[f.key];
                    const inputType = isSecret ? (isShown ? 'text' : 'password') : f.type || 'text';
                    return (
                      <div key={f.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>
                            {f.label} {f.required && <span className="text-rose-500">*</span>}
                          </span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type={inputType}
                            autoComplete="off"
                            spellCheck={false}
                            value={byokValues[f.key] || ''}
                            onChange={(e) =>
                              setByokValues((v) => ({ ...v, [f.key]: e.target.value }))
                            }
                            placeholder={f.placeholder || ''}
                            className={`w-full rounded-xl px-3.5 py-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#0e1628] focus:border-cyan-500 dark:focus:border-cyan-400 focus:outline-none ${
                              isSecret ? 'pr-10' : ''
                            } ${
                              fieldErrors.byok && f.required && !byokValues[f.key]
                                ? 'border-rose-400'
                                : ''
                            }`}
                          />
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(f.key)}
                              className="absolute right-3 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                              {isShown ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {fieldErrors.byok && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{fieldErrors.byok}</span>
                  </div>
                )}
              </fieldset>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={byokSubmitting}
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 py-4 px-6 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 hover:brightness-105 disabled:opacity-60"
              >
                {byokSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Validating {broker.label}…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5" />
                    Connect {broker.label} & Open Terminal
                  </>
                )}
              </button>
              {mustConnectBroker ? (
                <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Broker details required. Logout/login ke baad bhi yahi step pe aoge jab tak connect na ho.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={byokSubmitting}
                  onClick={skipBrokerConnect}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                >
                  Skip for now — connect later from dashboard
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    );
  }

  return shell(
    <div className="space-y-6">
      {/* ── Top Navigation & Stepper ─────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white transition shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Change plan</span>
        </button>

        {/* Modern Stepper Timeline */}
        <div className="flex items-center gap-2 sm:gap-3 bg-white/90 dark:bg-slate-900/60 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <StepDot step={1} label="Plan" done />
          <span className="h-0.5 w-4 bg-emerald-500/40 sm:w-8" />
          <StepDot step={2} label="Details" active={!readyToPay} done={readyToPay} />
          <span className={`h-0.5 w-4 sm:w-8 transition-colors ${readyToPay ? 'bg-emerald-500/40' : 'bg-slate-200 dark:bg-slate-800'}`} />
          <StepDot step={3} label="Payment" active={readyToPay} />
          {isByok && (
            <>
              <span className="h-0.5 w-4 sm:w-8 bg-slate-200 dark:bg-slate-800" />
              <StepDot step={4} label="Broker" />
            </>
          )}
        </div>
      </div>

      {/* ── Selected Plan Showcase Banner ─────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-[#0e1628] dark:to-[#0a1122] p-4 sm:p-5 shadow-lg shadow-emerald-500/5 dark:shadow-xl dark:shadow-emerald-950/20 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Plan Info */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3 stroke-[3]" /> Selected Plan
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {isByok ? (
                  <>
                    <KeyRound className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                    Your API (BYOK)
                  </>
                ) : (
                  <>
                    <Server className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Platform Feed
                  </>
                )}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {plan.name}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {months} months full access · Real-time Order Flow, Option Chain & Terminal
            </p>
          </div>

          {/* Pricing Box */}
          <div className="flex items-baseline sm:flex-col sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/80">
            {discountAmount > 0 && (
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-xs text-slate-400 dark:text-slate-500 line-through font-mono">
                  ₹{originalPrice.toLocaleString('en-IN')}
                </span>
                <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-black text-emerald-700 dark:text-emerald-300 font-mono">
                  {discountPct}% OFF
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                ₹{finalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                / {months} mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Details & Credentials Form Card ──────────────── */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 dark:border-slate-800/90 dark:bg-[#0c1222]/90 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/60 backdrop-blur-2xl">
        {/* Card Header */}
        <div className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800/80 dark:bg-[#0e162a]/70 px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              {readyToPay ? 'Confirm & Pay' : 'Enter your details'}
            </h3>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            256-bit Encrypted Checkout
          </span>
        </div>

        <form onSubmit={continueToPayment} className="p-5 sm:p-8 space-y-6">
          {/* ── High-Contrast Modern Alert Box ─────────────────── */}
          {(loadError || formError) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-gradient-to-r dark:from-rose-950/60 dark:via-rose-900/30 dark:to-rose-950/50 dark:text-rose-200 p-4 shadow-sm dark:shadow-xl dark:shadow-rose-950/30 flex items-start gap-3 backdrop-blur-md animate-fadeIn">
              <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Please complete the required details
                </div>
                <div className="text-xs sm:text-sm font-medium text-rose-900 dark:text-rose-100/90 leading-snug">
                  {formError || loadError}
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 1: Personal Contact Information ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Contact Information</span>
            </div>

            <fieldset disabled={readyToPay} className="disabled:opacity-60 transition-opacity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full name <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      value={name}
                      onChange={(e) => {
                        markDirty();
                        setName(e.target.value);
                      }}
                      placeholder="e.g. Rahul Sharma"
                      autoComplete="name"
                      required
                      minLength={2}
                      style={{ outline: 'none' }}
                      className={`w-full rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        fieldErrors.name
                          ? 'border border-rose-400 bg-rose-50/50 dark:border-rose-500 dark:bg-rose-950/20 focus:border-rose-500'
                          : 'border border-slate-300 bg-white hover:border-slate-400 focus:border-cyan-500 dark:border-slate-700/80 dark:bg-[#0e1628] dark:hover:border-slate-600 dark:focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {fieldErrors.name && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.name}
                    </span>
                  )}
                </div>

                {/* Registered Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Registered email <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="email"
                      value={email}
                      readOnly
                      required
                      autoComplete="email"
                      style={{ outline: 'none' }}
                      className={`w-full rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-white cursor-default bg-slate-50 dark:bg-[#0a1220] transition-all focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        fieldErrors.email
                          ? 'border border-rose-400 dark:border-rose-500'
                          : 'border border-slate-300 dark:border-slate-700/80'
                      }`}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.email}
                    </span>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      From your login account — used for payment receipt.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          {/* BYOK: broker keys are collected only after payment succeeds */}
          {isByok && !readyToPay && (
            <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 dark:bg-cyan-950/20 p-4 text-xs text-cyan-900 dark:text-cyan-200 leading-relaxed">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
              <div>
                <span className="font-bold">BYOK next step: </span>
                After payment confirms, you will connect your demat / broker API keys (Upstox, Kotak, Groww, or Angel One).
              </div>
            </div>
          )}

          {/* ── Primary CTA Button or Payment Box ──── */}
          {!readyToPay ? (
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={!detailsComplete || !plan}
                title={
                  !detailsComplete
                    ? 'Pehle full name aur email fill karo'
                    : !plan
                      ? 'Plan select karo'
                      : undefined
                }
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 py-4 px-6 text-sm sm:text-base font-black text-slate-950 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 disabled:shadow-none"
              >
                <span>Continue to Secure Payment</span>
                <span className="font-mono bg-slate-950/20 px-2 py-0.5 rounded-md text-slate-950 font-bold">
                  ₹{finalPrice.toLocaleString('en-IN')}
                </span>
                <CreditCard className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </button>
              {!detailsComplete && (
                <p className="text-center text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                  Full name aur registered email required — pehle details complete karo.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Instant Activation
                </span>
                <span>•</span>
                <span>UPI (GPay / PhonePe / Paytm)</span>
                <span>•</span>
                <span>Debit / Credit Cards</span>
                <span>•</span>
                <span>NetBanking</span>
              </div>
            </div>
          ) : (
            <div
              ref={payRef}
              className="space-y-5 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 bg-gradient-to-b from-emerald-50/80 via-white to-slate-50 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-[#0c1322] p-5 sm:p-6 shadow-lg shadow-emerald-500/5 dark:shadow-xl animate-fadeIn"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-200 dark:border-emerald-500/20 pb-4">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Ready to pay ₹{finalPrice.toLocaleString('en-IN')}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                    {isByok
                      ? 'Choose how to pay — broker keys come after membership is active.'
                      : 'Choose Razorpay (instant) or UPI UTR (manual verify).'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{finalPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {(razorpayAvailable || utrAvailable) && (
                <div className={`grid grid-cols-1 gap-2 ${razorpayAvailable && utrAvailable ? 'sm:grid-cols-2' : ''}`}>
                  {razorpayAvailable ? (
                    <button
                      type="button"
                      onClick={() => setPayMethod('razorpay')}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                        payMethod === 'razorpay'
                          ? 'border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <CreditCard className={`h-5 w-5 shrink-0 ${payMethod === 'razorpay' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white">Razorpay</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">UPI / Card / NetBanking · Instant</p>
                      </div>
                    </button>
                  ) : null}
                  {utrAvailable ? (
                    <button
                      type="button"
                      onClick={() => setPayMethod('utr')}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                        payMethod === 'utr'
                          ? 'border-cyan-500 bg-cyan-500/15 ring-1 ring-cyan-500/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <Smartphone className={`h-5 w-5 shrink-0 ${payMethod === 'utr' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white">UPI + UTR</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Pay to our UPI · Admin verifies</p>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}

              {!razorpayAvailable && !utrAvailable ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
                  No payment method is enabled right now. Please contact support or try again later.
                </div>
              ) : null}

              <div className="pt-1">
                {payMethod === 'utr' && utrAvailable ? (
                  <UtrCheckout
                    planId={plan.id}
                    amount={plan.price}
                    customerDetails={customerDetails}
                    buttonLabel={`Submit UTR · ₹${finalPrice.toLocaleString('en-IN')}`}
                    onSuccess={({
                      user,
                      membershipActivated,
                      paymentVerified,
                      autoApproved,
                      payment,
                      orderId
                    }) => {
                      if (user) dispatch(updateUser(user));
                      setFormError('');
                      if (autoApproved || membershipActivated || paymentVerified) {
                        if (isByok) {
                          setAwaitingByok(true);
                          setReadyToPay(false);
                          setUtrPendingDone(false);
                          return;
                        }
                        setSuccess(true);
                        setTimeout(() => navigate('/terminal'), 1200);
                        return;
                      }
                      setUtrPendingInfo({
                        utr: payment?.utr || '',
                        orderId: payment?.orderId || orderId || '',
                        amount: payment?.amount ?? plan.price
                      });
                      setUtrPendingDone(true);
                    }}
                    onFailure={(err) => {
                      setFormError(
                        toErrorText(
                          err?.userMessage || err?.response?.data?.message || err?.message,
                          'UTR submit failed. Check the reference and try again.'
                        )
                      );
                    }}
                  />
                ) : payMethod === 'razorpay' && razorpayAvailable ? (
                  <RazorpayCheckout
                    planId={plan.id}
                    amount={plan.price}
                    customerDetails={customerDetails}
                    description={plan.name}
                    buttonLabel={`Pay ₹${finalPrice.toLocaleString('en-IN')} with Razorpay`}
                    onSuccess={({ user, membershipActivated, paymentVerified }) => {
                      if (user) dispatch(updateUser(user));
                      setFormError('');
                      if (isByok) {
                        setAwaitingByok(true);
                        setReadyToPay(false);
                        return;
                      }
                      if (membershipActivated || paymentVerified) {
                        setSuccess(true);
                        setTimeout(() => navigate('/terminal'), 1200);
                      }
                    }}
                    onFailure={(err) => {
                      const raw = String(err?.userMessage || err?.message || err?.description || '');
                      if (/payment (received|confirmed|verified)/i.test(raw) && /membership/i.test(raw)) {
                        if (isByok) {
                          setAwaitingByok(true);
                          setReadyToPay(false);
                          setFormError('');
                          return;
                        }
                      }
                      setFormError(
                        toErrorText(
                          err?.userMessage || err?.message || err?.description || err,
                          'Payment failed. Please try again with UPI or another method.'
                        )
                      );
                      setReadyToPay(false);
                    }}
                  />
                ) : null}
              </div>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setReadyToPay(false)}
                  className="font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                >
                  ← Edit personal details
                </button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {payMethod === 'utr' ? 'Manual UTR verification' : 'SSL 256-Bit Encrypted'}
                </span>
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
