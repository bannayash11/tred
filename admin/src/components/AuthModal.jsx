import React, { useState } from 'react';
import { X, User, Lock, Mail, ArrowRight } from 'lucide-react';
import { loginApi, registerApi } from '../services/api';

export default function AuthModal({ onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clearErrors = () => {
    setError('');
    setFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearErrors();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const next = {};
    if (isRegister && !String(name || '').trim()) next.name = 'Full name is required.';
    if (!normalizedEmail) next.email = 'Email is required.';
    if (!password || password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (Object.keys(next).length) {
      setFieldErrors(next);
      setError(Object.values(next)[0]);
      setLoading(false);
      return;
    }

    try {
      const res = isRegister
        ? await registerApi({ name: String(name).trim(), email: normalizedEmail, password })
        : await loginApi({ email: normalizedEmail, password });

      if (res.success) {
        localStorage.setItem('tred_auth_token', res.token);
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      } else {
        const msg =
          res.message ||
          (isRegister
            ? 'Could not create account. Please check your details.'
            : 'Invalid email or password. Please check your details.');
        setError(msg);
        setFieldErrors(
          /email already|registered/i.test(msg) ? { email: msg } : { password: msg }
        );
      }
    } catch (err) {
      const msg =
        err.userMessage ||
        err.response?.data?.message ||
        (isRegister
          ? 'Could not create account. Please check your details.'
          : 'Invalid email or password. Please check your details.');
      setError(msg);
      setFieldErrors(
        /email already|registered/i.test(msg) ? { email: msg } : { password: msg }
      );
    } finally {
      setLoading(false);
    }
  };

  const border = (field) =>
    fieldErrors[field]
      ? 'border-rose-600 focus:border-rose-500'
      : 'border-slate-800 focus:border-cyan-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl bg-slate-800/80 p-1.5 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center space-y-1 mb-6">
          <h2 className="text-xl font-extrabold text-white">
            {isRegister ? 'Create Trader Account' : 'Welcome to Tradrift Terminal'}
          </h2>
          <p className="text-xs text-slate-400">
            {isRegister ? 'Start your 14-day institutional trial' : 'Sign in to access your saved setups & terminal'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs" noValidate>
          {isRegister && (
            <div>
              <label className="text-slate-400 block mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) clearErrors();
                  }}
                  className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none ${border('name')}`}
                />
              </div>
              {fieldErrors.name && (
                <p className="mt-1.5 text-[11px] font-medium text-rose-400">{fieldErrors.name}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-slate-400 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.toLowerCase());
                  if (fieldErrors.email || fieldErrors.password) clearErrors();
                }}
                className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none ${border('email')}`}
              />
            </div>
            {fieldErrors.email ? (
              <p className="mt-1.5 text-[11px] font-medium text-rose-400">{fieldErrors.email}</p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-500">Email is not case-sensitive (Y and y are the same).</p>
            )}
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) clearErrors();
                }}
                className={`w-full rounded-xl bg-slate-950 py-2.5 pl-9 pr-3 text-white border focus:outline-none ${border('password')}`}
              />
            </div>
            {fieldErrors.password && (
              <p className="mt-1.5 text-[11px] font-medium text-rose-400">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center space-x-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-black hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <span>{isRegister ? 'Create Account' : 'Sign In to Terminal'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-400">
          {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              clearErrors();
            }}
            className="font-bold text-cyan-400 hover:underline ml-1"
          >
            {isRegister ? 'Sign In' : 'Sign Up Free'}
          </button>
        </div>
      </div>
    </div>
  );
}
