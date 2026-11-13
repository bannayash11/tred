import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
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
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { updateUser } from '../store/slices/authSlice';
import { setPlans } from '../store/slices/contentSlice';
import { fetchPublicPlans } from '../services/api';
import { toErrorText } from '../lib/apiError';
import RazorpayCheckout from '../components/RazorpayCheckout';
import {
  BYOK_BROKERS,
  getByokBroker,
  validateByokForm,
  buildByokPayload,
} from '../lib/byokBrokers';

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
  const planId = searchParams.get('planId') || '';
  const payRef = useRef(null);

  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const authUser = useSelector((state) => state.auth.user);
  const plansFromStore = useSelector((state) => state.content?.plans || []);

  const [plans, setLocalPlans] = useState(plansFromStore);
  const [loading, setLoading] = useState(!plansFromStore.length);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(authUser?.name || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [readyToPay, setReadyToPay] = useState(false);
  const [byokProvider, setByokProvider] = useState('upstox');
  const [byokValues, setByokValues] = useState(() => emptyByokValues('upstox'));
  const [byokCredentials, setByokCredentials] = useState(null);
  const [showByokHelp, setShowByokHelp] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
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
      setPhone(authUser.phone || '');
    }
  }, [authUser]);

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

  const plan = useMemo(
    () => (plans || []).find((p) => p.id === planId && p.enabled !== false) || null,
    [plans, planId]
  );

  const isByok = plan?.mode === 'byok';
  const broker = useMemo(() => getByokBroker(byokProvider), [byokProvider]);
  const months = plan ? plan.durationMonths || Math.round((plan.durationDays || 30) / 30) : 0;

  const originalPrice = Number(plan?.originalPrice || 0);
  const finalPrice = Number(plan?.price || 0);
  const discountAmount = originalPrice > finalPrice ? originalPrice - finalPrice : 0;
  const discountPct = originalPrice > finalPrice ? Math.round((discountAmount / originalPrice) * 100) : 0;

  const customerDetails = useMemo(
    () => ({
      name: String(name || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      phone: String(phone || '').trim()
    }),
    [name, email, phone]
  );

  const markDirty = () => setReadyToPay(false);

  const toggleSecretVisibility = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const continueToPayment = (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setReadyToPay(false);
    setByokCredentials(null);

    const errors = {};
    if (!plan) {
      setFormError('Please select a membership plan first.');
      return;
    }
    if (customerDetails.name.length < 2) errors.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerDetails.email)) {
      errors.email = 'Enter a valid email address.';
    }
    const digits = customerDetails.phone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      errors.phone = 'Enter a 10-digit mobile number for UPI.';
    }
    if (isByok) {
      const msg = validateByokForm(byokProvider, byokValues);
      if (msg) errors.byok = msg;
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError(toErrorText(Object.values(errors)[0], 'Please fix the highlighted fields.'));
      return;
    }
    if (isByok) setByokCredentials(buildByokPayload(byokProvider, byokValues));
    setReadyToPay(true);
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

  if (!planId || !plan) {
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email address <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        markDirty();
                        setEmail(e.target.value);
                      }}
                      placeholder="you@email.com"
                      autoComplete="email"
                      style={{ outline: 'none' }}
                      className={`w-full rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        fieldErrors.email
                          ? 'border border-rose-400 bg-rose-50/50 dark:border-rose-500 dark:bg-rose-950/20 focus:border-rose-500'
                          : 'border border-slate-300 bg-white hover:border-slate-400 focus:border-cyan-500 dark:border-slate-700/80 dark:bg-[#0e1628] dark:hover:border-slate-600 dark:focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.email}
                    </span>
                  )}
                </div>

                {/* Mobile Number for UPI */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mobile (for UPI) <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 select-none text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                      +91
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => {
                        markDirty();
                        setPhone(e.target.value);
                      }}
                      placeholder="10-digit mobile"
                      inputMode="tel"
                      autoComplete="tel"
                      style={{ outline: 'none' }}
                      className={`w-full rounded-xl pl-12 pr-3.5 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus-visible:outline-none focus:ring-0 font-mono ${
                        fieldErrors.phone
                          ? 'border border-rose-400 bg-rose-50/50 dark:border-rose-500 dark:bg-rose-950/20 focus:border-rose-500'
                          : 'border border-slate-300 bg-white hover:border-slate-400 focus:border-cyan-500 dark:border-slate-700/80 dark:bg-[#0e1628] dark:hover:border-slate-600 dark:focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {fieldErrors.phone ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.phone}
                    </span>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Used for Razorpay UPI checkout request & receipt.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── SECTION 2: Broker API Credentials (BYOK) ───────── */}
          {isByok && (
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

              <fieldset disabled={readyToPay} className="space-y-4 disabled:opacity-60 transition-opacity">
                {/* Select Broker */}
                <div className="space-y-1.5 max-w-md">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select your broker <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <select
                    value={byokProvider}
                    onChange={(e) => {
                      const id = e.target.value;
                      markDirty();
                      setByokProvider(id);
                      setByokValues(emptyByokValues(id));
                      setShowByokHelp(false);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700/80 dark:bg-[#0e1628] px-4 py-3 text-sm text-slate-900 dark:text-white font-medium hover:border-slate-400 dark:hover:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 cursor-pointer transition appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat shadow-sm"
                    style={{
                      outline: 'none',
                      boxShadow: 'none',
                      WebkitFocusRingColor: 'transparent',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${isDark ? '%2338bdf8' : '%230284c7'}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`
                    }}
                  >
                    {BYOK_BROKERS.map((b) => (
                      <option key={b.id} value={b.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                        {b.label}
                        {b.short ? ` — ${b.short}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Security Guarantee Banner */}
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/20 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed backdrop-blur-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">Zero Key Exposure: </span>
                    Keys are validated once directly via broker API and stored encrypted. Never logged or shown in plaintext.
                  </div>
                </div>

                {/* Setup Help Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowByokHelp((s) => !s)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-900 dark:hover:text-white transition"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {showByokHelp ? 'Hide' : 'Need'} {broker.label} Setup Guide?
                  </button>

                  {showByokHelp && (
                    <div className="mt-2.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#080d18] p-4 space-y-3 shadow-sm dark:shadow-none animate-fadeIn">
                      <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                        {broker.label} Quick Setup Steps
                      </div>
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
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <a
                            href={broker.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                          >
                            <span>Open {broker.label} Developer Portal</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Broker Dynamic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {broker.fields.map((f) => {
                    const isSecret = f.type === 'password';
                    const isShown = showSecrets[f.key];
                    const inputType = isSecret ? (isShown ? 'text' : 'password') : (f.type || 'text');

                    return (
                      <div key={f.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>
                            {f.label} {f.required && <span className="text-rose-500 dark:text-rose-400">*</span>}
                          </span>
                          {!f.required && (
                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              Optional
                            </span>
                          )}
                        </div>

                        <div className="relative flex items-center">
                          <input
                            type={inputType}
                            autoComplete="off"
                            spellCheck={false}
                            value={byokValues[f.key] || ''}
                            onChange={(e) => {
                              markDirty();
                              setByokValues((v) => ({ ...v, [f.key]: e.target.value }));
                            }}
                            placeholder={f.placeholder || ''}
                            style={{ outline: 'none' }}
                            className={`w-full rounded-xl px-3.5 py-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              isSecret ? 'pr-10' : ''
                            } ${
                              fieldErrors.byok && f.required && !byokValues[f.key]
                                ? 'border border-rose-400 bg-rose-50/50 dark:border-rose-500 dark:bg-rose-950/20 focus:border-rose-500'
                                : 'border border-slate-300 bg-white hover:border-slate-400 focus:border-cyan-500 dark:border-slate-700/80 dark:bg-[#0e1628] dark:hover:border-slate-600 dark:focus:border-cyan-400'
                            }`}
                          />

                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(f.key)}
                              className="absolute right-3 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition"
                              title={isShown ? 'Hide token' : 'Show token'}
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
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{fieldErrors.byok}</span>
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {/* ── SECTION 3: Primary CTA Button or Payment Box ──── */}
          {!readyToPay ? (
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 py-4 px-6 text-sm sm:text-base font-black text-slate-950 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>Continue to Secure Payment</span>
                <span className="font-mono bg-slate-950/20 px-2 py-0.5 rounded-md text-slate-950 font-bold">
                  ₹{finalPrice.toLocaleString('en-IN')}
                </span>
                <CreditCard className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </button>

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
                    UPI recommended for zero-fee, instant membership activation.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{finalPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Razorpay Component Container */}
              <div className="pt-1">
                <RazorpayCheckout
                  planId={plan.id}
                  amount={plan.price}
                  customerDetails={customerDetails}
                  byokCredentials={byokCredentials}
                  description={plan.name}
                  buttonLabel={`Pay ₹${finalPrice.toLocaleString('en-IN')} with Razorpay`}
                  onSuccess={({ user }) => {
                    if (user) dispatch(updateUser(user));
                    setSuccess(true);
                    setTimeout(() => navigate('/terminal'), 1200);
                  }}
                  onFailure={(err) => {
                    setFormError(
                      toErrorText(
                        err?.userMessage || err?.message || err?.description || err,
                        'Payment failed. Check broker keys / Razorpay and try again.'
                      )
                    );
                    setReadyToPay(false);
                  }}
                />
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
                  SSL 256-Bit Encrypted
                </span>
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
