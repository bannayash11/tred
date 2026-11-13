import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Smartphone,
  Laptop,
  LogOut,
  RefreshCw,
  XCircle,
  Loader2,
  LayoutDashboard,
  Lock,
  Activity,
  Flame,
  ScanSearch,
  ArrowUpRight,
  CalendarDays,
  Gauge
} from 'lucide-react';
import {
  updatePasswordApi,
  revokeSessionsApi,
  fetchSessionsApi,
  fetchMyPaymentHistory,
  cancelMembershipApi
} from '../services/api';
import { revokeOtherSessions, updateUser, setSessions } from '../store/slices/authSlice';
import ConfirmModal from './ConfirmModal';
import './user-dashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'membership', label: 'Membership', icon: CreditCard },
  { id: 'security', label: 'Security', icon: ShieldCheck }
];

const QUICK_LINKS = [
  {
    to: '/terminal',
    title: 'Terminal',
    blurb: 'Live SMC setups',
    icon: Activity,
    tone: 'from-cyan-500/20 to-transparent'
  },
  {
    to: '/opening-momentum',
    title: 'Momentum',
    blurb: 'Opening scanner',
    icon: Flame,
    tone: 'from-amber-500/20 to-transparent'
  },
  {
    to: '/market-xray',
    title: 'Market X-Ray',
    blurb: 'Macro heatmap',
    icon: ScanSearch,
    tone: 'from-emerald-500/20 to-transparent'
  },
  {
    to: '/order-flow',
    title: 'Order Flow',
    blurb: 'Institutional flow',
    icon: Gauge,
    tone: 'from-sky-500/20 to-transparent'
  }
];

function formatInr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function initialsFrom(user) {
  const base = (user?.name || user?.email || 'TR').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function statusLabel(status) {
  if (status === 'active') return 'Pro Active';
  if (status === 'trial') return 'Trial';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  return status || 'Trial';
}

function statusTone(status) {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'trial') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

const panelMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
};

export default function UserDashboardView({ onOpenPricing }) {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);
  const user = authState.user;
  const activeSessions = authState.activeSessions || [];

  const [tab, setTab] = useState('overview');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  const [sessionsNotice, setSessionsNotice] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const res = await fetchMyPaymentHistory({ limit: 20 });
      setPayments(res.payments || []);
    } catch (err) {
      setPaymentsError(err.userMessage || err.message || 'Could not load payment history.');
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetchSessionsApi();
      dispatch(setSessions(res.sessions || []));
    } catch {
      // Keep empty list; UI shows empty state
    } finally {
      setSessionsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      loadPayments();
      loadSessions();
    }
  }, [user, loadPayments, loadSessions]);

  const planName = user?.subscription?.plan || '14-Day Free Trial';
  const status = user?.subscription?.status || 'trial';
  const feedMode = user?.subscription?.mode || 'trial';
  const byokStatus = user?.byok?.status || 'none';
  const expiresAt = user?.subscription?.expiresAt
    ? new Date(user.subscription.expiresAt)
    : new Date(Date.now() + 14 * 24 * 3600 * 1000);

  const daysLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
  const isPro = status === 'active';
  const trialWindow = isPro ? 365 : 14;
  const daysPct = Math.max(4, Math.min(100, Math.round((daysLeft / trialWindow) * 100)));

  const entitlements = useMemo(
    () => [
      isPro ? 'All 200+ NSE F&O stocks unlocked' : 'Top 8 large-cap F&O stocks (trial)',
      isPro ? '1-min & 5-min real-time scans' : '15-min candle analysis (trial)',
      'Automatic order block & liquidity lines',
      'Market X-Ray macro heatmap',
      isPro ? 'VIP Discord trading community' : 'VIP community (Pro only)'
    ],
    [isPro]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleCancelMembership = async () => {
    setCancelling(true);
    setError('');
    try {
      const res = await cancelMembershipApi({ reason: 'User cancelled from dashboard' });
      if (res.user) dispatch(updateUser(res.user));
      setNotice('Membership cancelled. Renew anytime from Pricing.');
      setShowCancelConfirm(false);
      setTab('membership');
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Could not cancel membership.');
      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setPasswordFieldErrors({});

    const next = {};
    if (!oldPassword) next.oldPassword = 'Current password is required.';
    if (!newPassword || newPassword.length < 6) {
      next.newPassword = 'New password must be at least 6 characters.';
    }
    if (!confirmPassword) next.confirmPassword = 'Please confirm your new password.';
    else if (newPassword !== confirmPassword) {
      next.confirmPassword = 'New passwords do not match.';
    }
    if (Object.keys(next).length) {
      setPasswordFieldErrors(next);
      setError(Object.values(next)[0]);
      return;
    }

    setSavingPassword(true);
    try {
      const res = await updatePasswordApi({ oldPassword, newPassword });
      if (res.success) {
        setNotice('Password updated successfully.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordFieldErrors({});
      } else {
        const msg = res.message || 'Failed to update password.';
        setError(msg);
        setPasswordFieldErrors(
          /current|old/i.test(msg) ? { oldPassword: msg } : { newPassword: msg }
        );
      }
    } catch (err) {
      const msg =
        err.userMessage || err.response?.data?.message || 'Could not update password. Please try again.';
      setError(msg);
      setPasswordFieldErrors(
        /current|old|match/i.test(msg) ? { oldPassword: msg } : { newPassword: msg }
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await revokeSessionsApi();
      dispatch(revokeOtherSessions());
      setSessionsNotice('Other device sessions signed out.');
      setTimeout(() => setSessionsNotice(''), 3500);
    } catch (err) {
      setSessionsNotice(
        err.userMessage || err.response?.data?.message || 'Could not revoke sessions. Please try again.'
      );
      setTimeout(() => setSessionsNotice(''), 4000);
    } finally {
      setShowRevokeConfirm(false);
    }
  };

  if (!user) {
    return (
      <div className="ud-shell rounded-2xl ud-panel p-10 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-cyan-400" />
        <p className="ud-display text-lg font-semibold text-white">Sign in required</p>
        <p className="mt-1 text-sm text-slate-400">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  const displayName = user.name || user.email?.split('@')[0] || 'Trader';

  return (
    <div className="ud-shell space-y-6 pb-8">
      {/* Profile hero */}
      <section className="ud-enter ud-panel ud-hero overflow-hidden rounded-3xl">
        <div className="ud-hero__glow" aria-hidden />
        <div className="relative px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div className="ud-avatar flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-emerald-400 ud-display text-[1.35rem] font-bold text-[#041016] sm:h-[4.75rem] sm:w-[4.75rem] sm:text-2xl">
                  {initialsFrom(user)}
                </div>
                <span
                  className={`ud-status-dot ${
                    status === 'active'
                      ? 'bg-emerald-400'
                      : status === 'trial'
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                  }`}
                  title={statusLabel(status)}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/85">
                    {greeting}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusTone(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
                <h1 className="ud-display mt-1 truncate text-[1.65rem] font-bold leading-none tracking-tight text-white sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-1.5 truncate text-[13px] text-slate-400">{user.email}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-950/55 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                    <CreditCard className="h-3 w-3 text-cyan-400" />
                    {planName}
                  </span>
                  {feedMode === 'byok' && (
                    <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                      BYOK {byokStatus === 'connected' ? '· linked' : '· connect broker'}
                    </span>
                  )}
                  {feedMode === 'server' && status === 'active' && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      <Activity className="h-3 w-3" />
                      Server feed
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700/70 bg-slate-950/40 px-2.5 py-1 text-[11px] text-slate-300">
                    <CalendarDays className="h-3 w-3 text-cyan-400/80" />
                    <span className="ud-mono font-semibold text-cyan-200">{daysLeft}</span>
                    <span className="text-slate-500">days left</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={onOpenPricing}
                className="ud-cta-primary inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-bold text-black"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isPro ? 'Renew / change plan' : 'Upgrade membership'}
              </button>
              {(status === 'active' || status === 'trial') && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-3.5 py-2.5 text-xs font-semibold text-rose-300/90 transition hover:border-rose-500/40 hover:bg-rose-500/15"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Tabs — full-width segmented bar */}
          <div className="ud-tabbar mt-5 -mx-5 flex gap-1 border-t border-slate-800/70 bg-slate-950/35 px-2 py-2 sm:-mx-7 sm:px-3">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-active={tab === id}
                onClick={() => setTab(id)}
                className="ud-tab inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 sm:flex-none sm:px-5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(notice || error) && (
        <div
          className={`ud-enter rounded-2xl border px-4 py-3 text-sm ${
            notice
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {notice || error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" {...panelMotion} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Plan pulse */}
              <div className="ud-panel ud-stat ud-enter ud-enter-delay-1 rounded-3xl p-6 lg:col-span-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Plan pulse
                    </p>
                    <h2 className="ud-display mt-1 text-xl font-bold text-white">{planName}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {isPro ? 'Annual prepaid access' : 'Evaluation window'} · expires{' '}
                      <span className="ud-mono text-slate-200">
                        {expiresAt.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="ud-ring shrink-0" style={{ ['--pct']: daysPct }}>
                    <div className="ud-ring__inner">
                      <div>
                        <div className="ud-mono text-2xl font-bold text-cyan-300">{daysLeft}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          days left
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                      <CalendarDays className="h-3 w-3" /> Billing
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {isPro ? '12 months' : '14-day trial'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                      <ShieldCheck className="h-3 w-3" /> Devices
                    </div>
                    <p className="mt-1 ud-mono text-sm font-semibold text-emerald-300">
                      {activeSessions.length || 1}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTab('membership')}
                  className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  View membership details <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Security snapshot */}
              <div className="ud-panel ud-enter ud-enter-delay-2 rounded-3xl p-6 lg:col-span-3">
                <h3 className="ud-display text-base font-bold text-white">Security</h3>
                <p className="mt-1 text-xs text-slate-400">Password & device access</p>
                <ul className="mt-5 space-y-3 text-xs">
                  <li className="flex items-center justify-between border-b border-slate-800/70 pb-2">
                    <span className="text-slate-400">Password</span>
                    <span className="text-emerald-300">Protected</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-slate-800/70 pb-2">
                    <span className="text-slate-400">Devices</span>
                    <span className="ud-mono text-cyan-300">{activeSessions.length || 1}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-400">Role</span>
                    <span className="capitalize text-slate-200">{user?.role || 'user'}</span>
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => setTab('security')}
                  className="mt-5 w-full rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  Manage security
                </button>
              </div>

              {/* Included highlights */}
              <div className="ud-panel ud-enter ud-enter-delay-3 rounded-3xl p-6 lg:col-span-4">
                <h3 className="ud-display text-base font-bold text-white">What you have</h3>
                <p className="mt-1 text-xs text-slate-400">Included with your current plan</p>
                <ul className="mt-4 space-y-2.5">
                  {entitlements.slice(0, 4).map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quick launch */}
            <div className="ud-enter ud-enter-delay-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="ud-display text-lg font-bold text-white">Launch desk</h3>
                  <p className="text-xs text-slate-400">Jump straight into your trading tools</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {QUICK_LINKS.map(({ to, title, blurb, icon: Icon, tone }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`ud-launch ud-panel relative overflow-hidden rounded-2xl p-4 ${tone ? `bg-gradient-to-br ${tone}` : ''}`}
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <div className="mt-3 ud-display text-sm font-bold text-white">{title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{blurb}</div>
                    <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'membership' && (
          <motion.div key="membership" {...panelMotion} className="space-y-6">
            <div className="ud-panel rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Active subscription
                  </p>
                  <h2 className="ud-display mt-1 text-2xl font-bold text-white">{planName}</h2>
                </div>
                <span
                  className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-bold ${statusTone(status)}`}
                >
                  {statusLabel(status)}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 text-center">
                  <div className="text-[11px] text-slate-500">Days remaining</div>
                  <div className="ud-mono mt-1 text-2xl font-bold text-cyan-300">{daysLeft}</div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 text-center">
                  <div className="text-[11px] text-slate-500">Renewal / expiry</div>
                  <div className="ud-mono mt-2 text-sm font-bold text-slate-100">
                    {expiresAt.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 text-center">
                  <div className="text-[11px] text-slate-500">Billing cycle</div>
                  <div className="mt-2 text-sm font-bold text-emerald-300">
                    {isPro ? '12 months prepaid' : '14-day evaluation'}
                  </div>
                </div>
              </div>

              <h3 className="mt-8 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Included functionalities
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {entitlements.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 text-xs text-slate-200"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-amber-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isPro ? 'Renew on Razorpay' : 'Buy membership'}
                </button>
                {(status === 'active' || status === 'trial') && (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-rose-600 hover:text-rose-300"
                  >
                    Cancel plan
                  </button>
                )}
              </div>
            </div>

            {/* Payments */}
            <div className="ud-panel rounded-3xl p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="ud-display flex items-center gap-2 text-base font-bold text-white">
                    <CreditCard className="h-4 w-4 text-amber-400" />
                    Payment history
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Razorpay orders — membership unlocks only after status is Paid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPayments}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-amber-300"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${paymentsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {paymentsError && (
                <div className="mt-4 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                  {paymentsError}
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Plan</th>
                      <th className="px-3 py-2.5 font-semibold">Order / Payment</th>
                      <th className="px-3 py-2.5 font-semibold">Amount</th>
                      <th className="px-3 py-2.5 font-semibold">Method</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paymentsLoading && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading payments…
                          </span>
                        </td>
                      </tr>
                    )}
                    {!paymentsLoading && payments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          No payments yet.{' '}
                          <button
                            type="button"
                            onClick={onOpenPricing}
                            className="text-amber-400 underline"
                          >
                            Buy a membership
                          </button>
                        </td>
                      </tr>
                    )}
                    {!paymentsLoading &&
                      payments.map((p) => (
                        <tr key={p._id || p.orderId} className="ud-pay-row">
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                            {formatDateTime(p.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-200">
                            {p.planName || p.planId || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="ud-mono text-[10px] text-slate-300">{p.orderId}</div>
                            <div className="ud-mono text-[10px] text-slate-500">
                              {p.paymentId || '—'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-bold text-white">
                            {formatInr(p.amount)}
                          </td>
                          <td className="px-3 py-2.5 uppercase text-slate-300">
                            {p.paymentMethod || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.status === 'paid'
                                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                                  : p.status === 'failed'
                                    ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                                    : 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'security' && (
          <motion.div key="security" {...panelMotion} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Password */}
              <div className="ud-panel rounded-3xl p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="ud-display flex items-center gap-2 text-base font-bold text-white">
                    <KeyRound className="h-4 w-4 text-amber-400" />
                    Update password
                  </h3>
                  <span className="text-[11px] text-slate-500">Verify current password</span>
                </div>

                {notice && tab === 'security' && (
                  <div className="mt-3 rounded-xl border border-emerald-800/50 bg-emerald-950/80 p-3 text-xs text-emerald-400">
                    {notice}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3 text-xs" noValidate>
                  <div>
                    <label className="mb-1 block text-slate-400">Current password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter current password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                        if (passwordFieldErrors.oldPassword) {
                          setPasswordFieldErrors({});
                          setError('');
                        }
                      }}
                      className={`w-full rounded-xl border bg-slate-950 p-2.5 text-white focus:outline-none ${
                        passwordFieldErrors.oldPassword
                          ? 'border-rose-600 focus:border-rose-500'
                          : 'border-slate-800 focus:border-cyan-500'
                      }`}
                    />
                    {passwordFieldErrors.oldPassword && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-400">
                        {passwordFieldErrors.oldPassword}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-slate-400">New password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordFieldErrors.newPassword) {
                          setPasswordFieldErrors({});
                          setError('');
                        }
                      }}
                      className={`w-full rounded-xl border bg-slate-950 p-2.5 text-white focus:outline-none ${
                        passwordFieldErrors.newPassword
                          ? 'border-rose-600 focus:border-rose-500'
                          : 'border-slate-800 focus:border-cyan-500'
                      }`}
                    />
                    {passwordFieldErrors.newPassword && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-400">
                        {passwordFieldErrors.newPassword}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-slate-400">Confirm new password</label>
                    <input
                      type="password"
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordFieldErrors.confirmPassword) {
                          setPasswordFieldErrors({});
                          setError('');
                        }
                      }}
                      className={`w-full rounded-xl border bg-slate-950 p-2.5 text-white focus:outline-none ${
                        passwordFieldErrors.confirmPassword
                          ? 'border-rose-600 focus:border-rose-500'
                          : 'border-slate-800 focus:border-cyan-500'
                      }`}
                    />
                    {passwordFieldErrors.confirmPassword && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-400">
                        {passwordFieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full rounded-xl bg-cyan-400 py-2.5 font-bold text-black transition hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {savingPassword ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </div>

              {/* Sessions */}
              <div className="ud-panel rounded-3xl p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="ud-display flex items-center gap-2 text-base font-bold text-white">
                    <Laptop className="h-4 w-4 text-cyan-400" />
                    Active sessions
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowRevokeConfirm(true)}
                    className="inline-flex items-center text-xs font-semibold text-rose-400 hover:underline"
                  >
                    <LogOut className="mr-1 h-3 w-3" />
                    Sign out others
                  </button>
                </div>

                {sessionsNotice && (
                  <div className="mt-3 rounded-xl border border-emerald-800/50 bg-emerald-950/80 p-2.5 text-xs text-emerald-400">
                    {sessionsNotice}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {sessionsLoading && activeSessions.length === 0 && (
                    <p className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading sessions…
                    </p>
                  )}
                  {!sessionsLoading && activeSessions.length === 0 && (
                    <p className="text-xs text-slate-500">No session details available yet.</p>
                  )}
                  {activeSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`rounded-xl p-2 ${
                            s.isCurrent
                              ? 'border border-cyan-800 bg-cyan-950 text-cyan-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {String(s.device || '').includes('iPhone') ||
                          String(s.device || '').includes('Android') ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Laptop className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-white">
                            <span className="truncate">{s.device}</span>
                            {s.isCurrent && (
                              <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-400">
                                This device
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {s.browser} · {s.location} ·{' '}
                            <span className="ud-mono text-slate-500">{s.ip}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-slate-500">
                        {s.isCurrent
                          ? 'Active now'
                          : s.lastActive
                            ? formatDateTime(s.lastActive)
                            : 'Earlier'}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 rounded-2xl border border-slate-800/40 bg-slate-950/40 p-3 text-[11px] text-slate-400">
                  If you see an unrecognized device, sign out other sessions to revoke their tokens
                  immediately.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={showRevokeConfirm}
        title="Sign out other devices?"
        message="All other active sessions will be terminated immediately. You will stay signed in on this device."
        confirmLabel="Sign Out Others"
        cancelLabel="Cancel"
        danger
        onCancel={() => setShowRevokeConfirm(false)}
        onConfirm={handleRevokeOtherSessions}
      />

      <ConfirmModal
        open={showCancelConfirm}
        title="Cancel membership?"
        message="Terminal and premium tools will lock immediately. Past payments stay in your history. You can buy again anytime from Pricing (Razorpay)."
        confirmLabel={cancelling ? 'Cancelling…' : 'Yes, Cancel Membership'}
        cancelLabel="Keep Membership"
        danger
        onCancel={() => !cancelling && setShowCancelConfirm(false)}
        onConfirm={handleCancelMembership}
      />
    </div>
  );
}
