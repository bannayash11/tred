import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function AdminLoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: request code, 2: enter code & new pass
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');

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
        return;
      }

      if (res.data.success) {
        localStorage.setItem('tred_admin_token', res.data.token);
        localStorage.setItem('tred_admin_user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setError(res.data.message || 'Invalid email or password. Please check your details.');
      }
    } catch (err) {
      setError(
        err.userMessage ||
          err.response?.data?.message ||
          'Invalid email or password. Please check your details.'
      );
    } finally {
      setLoading(false);
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
        setRecoveryNotice(res.data.message || 'Use OTP 0000 to reset your password.');
        setRecoveryCode(res.data.otp || '0000');
        setRecoveryStep(2);
      }
    } catch (err) {
      setError(
        err.userMessage || err.response?.data?.message || 'Could not send recovery code. Please try again.'
      );
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!String(recoveryCode || '').trim()) {
      setError('Please enter the recovery OTP (0000).');
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
        alert('Admin password has been reset successfully! Please sign in.');
        setShowForgotModal(false);
        setRecoveryStep(1);
        setPassword(newPassword);
        setError('');
      } else {
        setError(res.data.message || 'Could not reset password. Please check your details.');
      }
    } catch (err) {
      setError(
        err.userMessage || err.response?.data?.message || 'Could not reset password. Please check your details.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[130px]" />

      <div className="relative w-full max-w-md rounded-3xl border border-amber-900/40 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
        {/* Brand Shield Header */}
        <div className="text-center space-y-2">
          <img
            src="/brand/tradrift-logo.svg"
            alt="Tradrift"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg shadow-amber-500/20"
          />
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Trad<span className="text-amber-400">rift</span> SUPER ADMIN
          </h1>
          <p className="text-xs text-slate-400">
            Restricted Master Control Gateway. Authorized Administrators Only.
          </p>
        </div>

        {error && requires2fa && (
          <div className="rounded-xl bg-rose-950/80 border border-rose-800/50 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleAdminLogin} className="space-y-4 text-xs" noValidate>
          {requires2fa ? (
            <div>
              <label className="text-slate-400 block mb-1">2FA Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={4}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                    if (error) setError('');
                  }}
                  placeholder="0000"
                  className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none tracking-widest ${
                    error ? 'border-rose-600 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                  }`}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                Default OTP for now: <span className="font-mono text-amber-400">0000</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setRequires2fa(false);
                  setOtpCode('');
                  setError('');
                }}
                className="mt-2 text-amber-400 hover:underline text-[11px]"
              >
                ← Back to password
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-slate-400 block mb-1">Admin Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value.toLowerCase());
                      if (error) setError('');
                    }}
                    placeholder="admin@example.com"
                    className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none ${
                      error ? 'border-rose-600 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                    }`}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Email is not case-sensitive (Y and y are the same).</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400">Master Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                      setError('');
                    }}
                    className="text-amber-400 hover:underline text-[11px]"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="••••••••••••"
                    className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none ${
                      error ? 'border-rose-600 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                    }`}
                  />
                </div>
                {error && (
                  <p className="mt-1.5 text-[11px] font-medium text-rose-400">{error}</p>
                )}
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-xs font-bold text-black hover:opacity-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <span>{requires2fa ? 'Verify & Access Console' : 'Authenticate & Access Console'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
          🛡️ Session guarded by SHA-256 JWT & IP Activity Auditing.
        </div>
      </div>

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center">
              <KeyRound className="mr-2 h-4 w-4 text-amber-400" />
              Administrator Security Recovery
            </h3>
            <p className="text-slate-400">
              Recover access using the authorized admin email address.
            </p>

            {recoveryNotice && (
              <div className="rounded-xl bg-emerald-950/80 border border-emerald-800/50 p-2.5 text-emerald-400 font-mono">
                {recoveryNotice}
              </div>
            )}

            {recoveryStep === 1 ? (
              <form onSubmit={handleRequestRecovery} className="space-y-3">
                <div>
                  <label className="text-slate-400 block mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value.toLowerCase());
                      if (error) setError('');
                    }}
                    className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border ${
                      error ? 'border-rose-600' : 'border-slate-800'
                    }`}
                  />
                  {error && recoveryStep === 1 && (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-400">{error}</p>
                  )}
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-4 py-1.5 font-bold text-black"
                  >
                    Send Recovery Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="text-slate-400 block mb-1">Recovery OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={4}
                    placeholder="0000"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-xl bg-slate-950 p-2.5 font-mono text-white border border-slate-800 text-center tracking-widest text-sm"
                  />
                  <p className="mt-1.5 text-[10px] text-slate-500">Default OTP for now: <span className="font-mono text-amber-400">0000</span></p>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">New Administrator Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border ${
                      error ? 'border-rose-600' : 'border-slate-800'
                    }`}
                  />
                  {error && recoveryStep === 2 && (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-400">{error}</p>
                  )}
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setError('');
                    }}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 font-bold text-black"
                  >
                    Confirm & Reset Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

