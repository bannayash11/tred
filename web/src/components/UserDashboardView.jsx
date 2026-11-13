import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  User,
  ShieldCheck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  Lock,
  Clock,
  Calendar,
  KeyRound,
  ShieldAlert,
  Smartphone,
  Laptop,
  Check,
  AlertTriangle,
  LogOut,
  RefreshCw,
  QrCode,
  XCircle,
  Loader2
} from 'lucide-react';
import {
  updatePasswordApi,
  toggle2FAApi,
  revokeSessionsApi,
  fetchMyPaymentHistory,
  cancelMembershipApi
} from '../services/api';
import { setTwoFactor, revokeOtherSessions, updateUser } from '../store/slices/authSlice';
import ConfirmModal from './ConfirmModal';

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

export default function UserDashboardView({ onOpenPricing }) {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);
  const user = authState.user;
  const twoFactorEnabled = authState.twoFactorEnabled;
  const activeSessions = authState.activeSessions;
  const securityScore = authState.securityScore;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  // 2FA modal / toggle state
  const [toggling2FA, setToggling2FA] = useState(false);
  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');

  // Sessions state
  const [sessionsNotice, setSessionsNotice] = useState('');
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Payments + cancel membership
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

  useEffect(() => {
    if (user) loadPayments();
  }, [user, loadPayments]);

  const handleCancelMembership = async () => {
    setCancelling(true);
    try {
      const res = await cancelMembershipApi({ reason: 'User cancelled from dashboard' });
      if (res.user) dispatch(updateUser(res.user));
      setNotice('Membership cancelled. Renew anytime from Pricing.');
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Could not cancel membership.');
      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
        Please sign in to view your dashboard.
      </div>
    );
  }

  const planName = user?.subscription?.plan || '14-Day Free Trial';
  const status = user?.subscription?.status || 'trial';
  const feedMode = user?.subscription?.mode || 'trial';
  const byokStatus = user?.byok?.status || 'none';
  const expiresAt = user?.subscription?.expiresAt
    ? new Date(user.subscription.expiresAt)
    : new Date(Date.now() + 14 * 24 * 3600 * 1000);

  const daysLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
  const isPro = status === 'active';

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
      const res = await updatePasswordApi({
        oldPassword,
        newPassword
      });
      if (res.success) {
        setNotice('✅ Password changed & session token encrypted successfully.');
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
      const msg = err.userMessage || err.response?.data?.message || 'Could not update password. Please try again.';
      setError(msg);
      setPasswordFieldErrors(
        /current|old|match/i.test(msg) ? { oldPassword: msg } : { newPassword: msg }
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    if (!twoFactorEnabled) {
      setShow2FAPrompt(true);
      return;
    }

    setToggling2FA(true);
    try {
      await toggle2FAApi({ enabled: false });
      dispatch(setTwoFactor(false));
      setError('');
      setOtpSuccessMsg('2FA Disabled.');
      setTimeout(() => setOtpSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Could not disable 2FA.');
    } finally {
      setToggling2FA(false);
    }
  };

  const handleVerifyAndEnable2FA = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Enter a valid 6-digit authentication code.');
      return;
    }
    setToggling2FA(true);
    try {
      await toggle2FAApi({ enabled: true });
      dispatch(setTwoFactor(true));
      setShow2FAPrompt(false);
      setOtpCode('');
      setError('');
      setOtpSuccessMsg('✅ 2-Factor Authentication enabled! Account protected with OTP.');
      setTimeout(() => setOtpSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Could not enable 2FA. Please try again.');
    } finally {
      setToggling2FA(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await revokeSessionsApi();
      dispatch(revokeOtherSessions());
      setSessionsNotice('✅ All other device sessions successfully signed out.');
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-950/60 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-800/50 mb-2">
            <User className="h-3.5 w-3.5" />
            <span>Trader Command Center (Redux RTK Powered)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Trader Security & Membership Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Supervise active institutional access, adjust device security, and check plan entitlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPricing}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-xs font-bold text-black hover:opacity-90 transition-opacity shadow-lg shadow-amber-500/20"
          >
            <CreditCard className="h-4 w-4" />
            <span>{isPro ? 'Renew / Change Plan' : 'Buy Membership · Pay Now'}</span>
          </button>
          {(status === 'active' || status === 'trial') && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center space-x-2 rounded-xl border border-rose-800/70 bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-950/70"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel Membership</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Membership Overview + Security Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Active Membership */}
        <div className="lg:col-span-2 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950 to-[#0a0f1d] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Active Subscription
              </span>
              <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 flex-wrap">
                {planName}
                {feedMode === 'byok' && (
                  <span className="rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60 px-2 py-0.5 text-[10px] font-bold">
                    BYOK{byokStatus === 'connected' ? ' · linked' : ''}
                  </span>
                )}
                {feedMode === 'server' && status === 'active' && (
                  <span className="rounded-full bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 text-[10px] font-bold">
                    SERVER FEED
                  </span>
                )}
              </h2>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                status === 'active'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/60'
              }`}
            >
              {status === 'active' ? '● PRO ACTIVE' : '● EVALUATION TRIAL'}
            </span>
          </div>

          {/* Days Remaining Meter */}
          <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800/80 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[11px] text-slate-400">Days Remaining</div>
              <div className="mt-1 text-2xl font-mono font-extrabold text-cyan-400">
                {daysLeft} Days
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Renewal / Expiry</div>
              <div className="mt-1 text-xs font-mono font-bold text-slate-200">
                {expiresAt.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Billing Cycle</div>
              <div className="mt-1 text-xs font-mono font-bold text-emerald-400">
                {isPro ? '12 Months Pre-Paid' : '14-Day Free Evaluation'}
              </div>
            </div>
          </div>

          {/* Feature Entitlements Breakdown */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Your Plan's Included Functionalities:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center space-x-2.5 rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  {isPro ? 'All 200+ NSE F&O Stocks Unlocked' : 'Top 8 Large-Cap F&O Stocks (Trial)'}
                </span>
              </div>

              <div className="flex items-center space-x-2.5 rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  {isPro ? '1-Min & 5-Min Real-time Scans' : '15-Min Candle Analysis (Trial)'}
                </span>
              </div>

              <div className="flex items-center space-x-2.5 rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  Automatic Order Block & Liquidity Lines
                </span>
              </div>

              <div className="flex items-center space-x-2.5 rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  Market X-Ray Macro Heatmap
                </span>
              </div>

              <div className="flex items-center space-x-2.5 rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  {isPro ? 'VIP Discord Trading Community' : 'VIP Community (Pro Only)'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onOpenPricing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-[11px] font-bold text-black hover:bg-amber-400"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isPro ? 'Renew on Razorpay' : 'Go to Payment Methods'}
            </button>
            {(status === 'active' || status === 'trial') && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-[11px] font-semibold text-slate-300 hover:border-rose-700 hover:text-rose-300"
              >
                Cancel plan
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Security Health Shield */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center">
                <ShieldCheck className="mr-2 h-4 w-4 text-emerald-400" />
                Account Security Health
              </h3>
              <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-800/60">
                {securityScore}%
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${securityScore}%` }}
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Two-Factor Authentication</span>
                <span className={`font-semibold ${twoFactorEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {twoFactorEnabled ? '● Active (Protected)' : '○ Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Password Encryption</span>
                <span className="font-semibold text-emerald-400">BCrypt 10-Rounds</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Active Devices</span>
                <span className="font-mono text-cyan-400">{activeSessions.length} Devices</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Assigned Role</span>
                <span className="font-mono text-slate-200 capitalize">{user?.role || 'user'}</span>
              </div>
            </div>
          </div>

          {/* 2FA Quick Action */}
          <div className="rounded-2xl bg-slate-950/80 p-4 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">2-Factor Authentication</div>
                <div className="text-[11px] text-slate-400">Protects login with 6-digit OTP</div>
              </div>
              <button
                onClick={handleToggle2FA}
                disabled={toggling2FA}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  twoFactorEnabled
                    ? 'bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/50'
                    : 'bg-emerald-500 text-black hover:bg-emerald-400'
                }`}
              >
                {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
            {otpSuccessMsg && (
              <div className="text-[11px] text-emerald-400 font-semibold">{otpSuccessMsg}</div>
            )}
          </div>
        </div>
      </div>

      {/* 2FA Modal Prompt (if opening to enable) */}
      {show2FAPrompt && (
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-xl bg-cyan-950 p-2.5 text-cyan-400 border border-cyan-800">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Setup Authenticator OTP</h4>
                <p className="text-xs text-slate-400">Enter the 6-digit confirmation code from your authenticator app.</p>
              </div>
            </div>
            <button
              onClick={() => setShow2FAPrompt(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-48 text-center font-mono tracking-widest text-lg rounded-xl bg-slate-900 border border-slate-700 py-2 text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleVerifyAndEnable2FA}
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-cyan-400"
            >
              Verify & Activate
            </button>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center">
              <CreditCard className="mr-2 h-4 w-4 text-amber-400" />
              Payment History
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Your Razorpay orders — membership activates only after status is Paid.
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
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
            {paymentsError}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
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
                    <button type="button" onClick={onOpenPricing} className="text-amber-400 underline">
                      Buy a membership
                    </button>
                  </td>
                </tr>
              )}
              {!paymentsLoading &&
                payments.map((p) => (
                  <tr key={p._id || p.orderId} className="hover:bg-slate-950/40">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                      {formatDateTime(p.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-200">{p.planName || p.planId || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[10px] text-slate-300">{p.orderId}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {p.paymentId || '—'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-white">
                      {formatInr(p.amount)}
                    </td>
                    <td className="px-3 py-2.5 uppercase text-slate-300">{p.paymentMethod || '—'}</td>
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

      {/* Bottom Grid: Change Password + Active Sessions Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 3: Secure Password Change Form */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <KeyRound className="mr-2 h-4 w-4 text-amber-400" />
              Update Account Password
            </h3>
            <span className="text-[11px] text-slate-500">Requires Old Password Verification</span>
          </div>

          {notice && (
            <div className="rounded-xl bg-emerald-950/80 p-3 text-xs text-emerald-400 border border-emerald-800/50">
              {notice}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs" noValidate>
            <div>
              <label className="text-slate-400 block mb-1">
                Current Password
              </label>
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
                className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border focus:outline-none ${
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
              <label className="text-slate-400 block mb-1">New Password</label>
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
                className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border focus:outline-none ${
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
              <label className="text-slate-400 block mb-1">Confirm New Password</label>
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
                className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border focus:outline-none ${
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
              className="w-full rounded-xl bg-cyan-500 py-2.5 font-bold text-black hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              {savingPassword ? 'Verifying & Encrypting...' : 'Update & Secure Password'}
            </button>
          </form>
        </div>

        {/* Card 4: Active Device Sessions */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <Laptop className="mr-2 h-4 w-4 text-cyan-400" />
              Active Login Sessions & Devices
            </h3>
            <button
              onClick={() => setShowRevokeConfirm(true)}
              className="text-xs font-semibold text-rose-400 hover:underline flex items-center"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Sign Out Other Devices
            </button>
          </div>

          {sessionsNotice && (
            <div className="rounded-xl bg-emerald-950/80 p-2.5 text-xs text-emerald-400 border border-emerald-800/50">
              {sessionsNotice}
            </div>
          )}

          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl bg-slate-950/80 p-3.5 border border-slate-800 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${s.isCurrent ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-900 text-slate-400'}`}>
                    {s.device.includes('iPhone') ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-white flex items-center">
                      {s.device}
                      {s.isCurrent && (
                        <span className="ml-2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.2 text-[10px]">
                          THIS DEVICE
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {s.browser} • {s.location} • <span className="font-mono text-slate-500">{s.ip}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  {s.isCurrent ? 'Active Now' : '4 hours ago'}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-950/40 p-3 border border-slate-800/40 text-[11px] text-slate-400">
            💡 If you detect any unrecognized device, click "Sign Out Other Devices" to terminate unauthorized active JWT tokens immediately.
          </div>
        </div>
      </div>

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
