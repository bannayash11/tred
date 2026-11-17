import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import Panel from './ui/Panel';
import OtpInputBoxes from './OtpInputBoxes';
import { OTP_DIGITS, OTP_RESEND_COOLDOWN_SEC, isCompleteOtp } from '../lib/otp';
import useOtpCooldown from '../hooks/useOtpCooldown';

export default function AdminLoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const authOtpCooldown = useOtpCooldown(0);
  const recoveryOtpCooldown = useOtpCooldown(0);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (requires2fa) {
        const res = await api.post('/auth/verify-2fa', { email, code: otpCode });
        if (res.data.success && res.data.token) {
          localStorage.setItem('tred_admin_token', res.data.token);
          localStorage.setItem('tred_admin_user', JSON.stringify(res.data.user));
          onLoginSuccess(res.data.user, res.data.token);
        } else {
          setError(res.data.message || 'Invalid verification code');
        }
        return;
      }

      const normalizedEmail = String(email || '').trim().toLowerCase();
      const res = await api.post('/auth/admin-login', {
        email: normalizedEmail,
        password
      });

      if (res.data.success && res.data.requires2fa) {
        setRequires2fa(true);
        authOtpCooldown.start(res.data.retryAfterSec || OTP_RESEND_COOLDOWN_SEC);
        return;
      }

      if (res.data.success) {
        localStorage.setItem('tred_admin_token', res.data.token);
        localStorage.setItem('tred_admin_user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setError(res.data.message || 'Invalid email or password.');
      }
    } catch (err) {
      const retry = err.response?.data?.retryAfterSec;
      if (retry) authOtpCooldown.start(retry);
      setError(err.userMessage || err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendAuthOtp = async () => {
    if (authOtpCooldown.active || otpResending) return;
    setOtpResending(true);
    setError('');
    try {
      const res = await api.post('/auth/resend-2fa', {
        email: String(email || '').trim().toLowerCase()
      });
      if (res.data.success) {
        if (res.data.otp) setOtpCode(res.data.otp);
        authOtpCooldown.start(res.data.retryAfterSec || OTP_RESEND_COOLDOWN_SEC);
      } else {
        setError(res.data.message || 'Could not resend OTP.');
      }
    } catch (err) {
      const retry = err.response?.data?.retryAfterSec;
      if (retry) authOtpCooldown.start(retry);
      setError(err.userMessage || err.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setOtpResending(false);
    }
  };

  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    setError('');
    const normalized = String(forgotEmail || '').trim().toLowerCase();
    if (!normalized) {
      setError('Please enter your admin email.');
      return;
    }
    setForgotEmail(normalized);
    try {
      const res = await api.post('/auth/forgot-password', { email: normalized });
      if (res.data.success) {
        setRecoveryNotice(res.data.message || 'If that account exists, an OTP was emailed.');
        if (res.data.otp) setRecoveryCode(res.data.otp);
        setRecoveryStep(2);
        recoveryOtpCooldown.start(res.data.retryAfterSec || OTP_RESEND_COOLDOWN_SEC);
      }
    } catch (err) {
      const retry = err.response?.data?.retryAfterSec;
      if (retry) recoveryOtpCooldown.start(retry);
      setError(err.userMessage || err.response?.data?.message || 'Could not send recovery code.');
    }
  };

  const handleResendRecoveryOtp = async () => {
    if (recoveryOtpCooldown.active) return;
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', {
        email: String(forgotEmail || '').trim().toLowerCase()
      });
      if (res.data.success) {
        setRecoveryNotice(res.data.message || 'OTP resent to your email.');
        if (res.data.otp) setRecoveryCode(res.data.otp);
        recoveryOtpCooldown.start(res.data.retryAfterSec || OTP_RESEND_COOLDOWN_SEC);
      }
    } catch (err) {
      const retry = err.response?.data?.retryAfterSec;
      if (retry) recoveryOtpCooldown.start(retry);
      setError(err.userMessage || err.response?.data?.message || 'Could not resend OTP.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!isCompleteOtp(recoveryCode)) {
      setError(`Please enter the ${OTP_DIGITS}-digit recovery OTP.`);
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    try {
      const res = await api.post('/auth/reset-password', {
        email: String(forgotEmail || '').trim().toLowerCase(),
        code: recoveryCode,
        newPassword
      });
      if (res.data.success) {
        setShowForgot(false);
        setRecoveryStep(1);
        setPassword(newPassword);
        setError('');
        setRecoveryNotice('');
      } else {
        setError(res.data.message || 'Could not reset password.');
      }
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Could not reset password.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-admin-bg p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(76,201,192,0.12),_transparent_55%)]" />

      <Panel className="relative w-full max-w-md space-y-6 p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <img src="/brand/tradrift-logo.svg" alt="Tradrift" className="mx-auto h-12 w-12 rounded-xl" />
          <h1 className="text-xl font-semibold text-white">
            Trad<span className="text-admin-accent">rift</span> Admin
          </h1>
          <p className="text-sm text-admin-muted">Sign in to manage traders, plans, and content.</p>
        </div>

        {error && requires2fa && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-800/50 bg-rose-950/60 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4" noValidate>
          {requires2fa ? (
            <div>
              <label className="admin-label">2FA code ({OTP_DIGITS} digits)</label>
              <OtpInputBoxes
                id="admin-2fa-otp"
                value={otpCode}
                length={OTP_DIGITS}
                hasError={Boolean(error)}
                ariaLabel="Admin 2FA code"
                onChange={(next) => {
                  setOtpCode(next);
                  if (error) setError('');
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={authOtpCooldown.active || otpResending}
                  onClick={handleResendAuthOtp}
                  className="text-xs text-admin-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                >
                  {otpResending
                    ? 'Sending…'
                    : authOtpCooldown.active
                      ? `Resend OTP in ${authOtpCooldown.secondsLeft}s`
                      : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequires2fa(false);
                    setOtpCode('');
                    setError('');
                    authOtpCooldown.clear();
                  }}
                  className="text-xs text-admin-accent hover:underline"
                >
                  Back to password
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="admin-label">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value.toLowerCase());
                      if (error) setError('');
                    }}
                    placeholder="admin@example.com"
                    className="admin-input pl-9"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-admin-muted">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgot(true);
                      setError('');
                    }}
                    className="text-xs text-admin-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="••••••••"
                    className="admin-input pl-9"
                  />
                </div>
                {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="admin-btn-primary w-full py-2.5">
            {loading ? (
              'Signing in...'
            ) : (
              <>
                {requires2fa ? 'Verify' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </Panel>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-md space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-admin-accent" />
              Reset password
            </h3>

            {recoveryNotice && (
              <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/60 p-2.5 font-mono text-xs text-emerald-300">
                {recoveryNotice}
              </div>
            )}

            {recoveryStep === 1 ? (
              <form onSubmit={handleRequestRecovery} className="space-y-3">
                <div>
                  <label className="admin-label">Admin email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value.toLowerCase());
                      if (error) setError('');
                    }}
                    className="admin-input"
                  />
                  {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowForgot(false)} className="admin-btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn-primary">
                    Send code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="admin-label">Recovery OTP ({OTP_DIGITS} digits)</label>
                  <OtpInputBoxes
                    id="admin-recovery-otp"
                    value={recoveryCode}
                    length={OTP_DIGITS}
                    hasError={Boolean(error)}
                    ariaLabel="Admin recovery OTP"
                    onChange={(next) => {
                      setRecoveryCode(next);
                      if (error) setError('');
                    }}
                  />
                  <button
                    type="button"
                    disabled={recoveryOtpCooldown.active}
                    onClick={handleResendRecoveryOtp}
                    className="mt-2 text-xs text-admin-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                  >
                    {recoveryOtpCooldown.active
                      ? `Resend OTP in ${recoveryOtpCooldown.secondsLeft}s`
                      : 'Resend OTP'}
                  </button>
                </div>
                <div>
                  <label className="admin-label">New password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="admin-input"
                  />
                  {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(false);
                      setError('');
                    }}
                    className="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn-primary">
                    Reset password
                  </button>
                </div>
              </form>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
