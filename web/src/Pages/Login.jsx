import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  User,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Activity,
  BarChart3,
  Layers,
  Target,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  Calendar,
  Sun,
  Moon
} from 'lucide-react';
import {
  fetchPublicSignupSettings,
  forgotPasswordApi,
  loginApi,
  registerApi,
  registerSendOtpApi,
  resetPasswordApi,
  verify2faApi
} from '../services/api';
import { loginSuccess } from '../store/slices/authSlice';
import authDeskImage from '../assets/auth-trading-desk.jpg';
import { useTheme } from '../context/ThemeContext';

/** Only allow same-app relative paths (blocks open redirects like //evil.com). */
function safeNextPath(raw, fallback = '/order-flow') {
  if (!raw || typeof raw !== 'string') return fallback;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  return path;
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Order Blocks',
    text: 'Demand & supply zones on NSE F&O names.'
  },
  {
    icon: Activity,
    title: 'Market X-Ray',
    text: 'Sector heat and capital flow in one view.'
  },
  {
    icon: Target,
    title: 'Liquidity Sweeps',
    text: 'Spot stop-hunts before the real move.'
  },
  {
    icon: BarChart3,
    title: 'Live Terminal',
    text: 'Real-time OB, FVG and liquidity scans.'
  }
];

const BASE_STATS = [
  { value: '200+', label: 'F&O Stocks' },
  { value: '1m', label: 'Live Scans' },
  { value: 'SMC', label: 'Core Engine' },
  { value: '18+', label: 'Traders Only' }
];

function getAgeFromDob(dobValue) {
  if (!dobValue) return null;
  const birth = new Date(dobValue);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function maxDobFor18Plus() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export default function Login({ mode = 'login' }) {
  const { theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [isRegister, setIsRegister] = useState(mode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [confirmAge18, setConfirmAge18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [freeTrialEnabled, setFreeTrialEnabled] = useState(false);
  const [freeTrialDays, setFreeTrialDays] = useState(14);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSignupSettings()
      .then((res) => {
        if (cancelled || !res?.success) return;
        setFreeTrialEnabled(!!res.freeTrialEnabled);
        if (res.freeTrialDays) setFreeTrialDays(Number(res.freeTrialDays) || 14);
      })
      .catch(() => {
        /* keep default OFF */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (freeTrialEnabled) {
      return [
        BASE_STATS[0],
        BASE_STATS[1],
        { value: `${freeTrialDays}d`, label: 'Free Trial' },
        BASE_STATS[2]
      ];
    }
    return BASE_STATS;
  }, [freeTrialEnabled, freeTrialDays]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [requires2fa, setRequires2fa] = useState(false);
  const [requiresSignupOtp, setRequiresSignupOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryCode, setRecoveryCode] = useState('0000');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const maxDob = useMemo(() => maxDobFor18Plus(), []);
  const nextPath = safeNextPath(searchParams.get('next'), '/order-flow');

  const clearFormErrors = () => {
    setError('');
    setFieldErrors({});
  };

  const applyAuthMessage = (message, fallbackField = 'password') => {
    const msg = String(message || '').trim();
    if (!msg) {
      setFieldErrors({ [fallbackField]: 'Please check your details.' });
      setError('Please check your details.');
      return;
    }
    const lower = msg.toLowerCase();
    let field = fallbackField;
    if (lower.includes('email') && (lower.includes('already') || lower.includes('registered'))) {
      field = 'email';
    } else if (lower.includes('password')) {
      field = 'password';
    } else if (lower.includes('date of birth') || lower.includes('18')) {
      field = lower.includes('confirm') ? 'confirmAge18' : 'dateOfBirth';
    } else if (lower.includes('terms') || lower.includes('privacy')) {
      field = 'acceptTerms';
    } else if (lower.includes('name')) {
      field = 'name';
    } else if (lower.includes('verification') || lower.includes('code') || lower.includes('2fa')) {
      field = 'otp';
    } else if (lower.includes('email') && lower.includes('password')) {
      field = 'password';
    }
    setFieldErrors({ [field]: msg });
    setError(msg);
  };

  useEffect(() => {
    setIsRegister(mode === 'register');
    setRequiresSignupOtp(false);
    setRequires2fa(false);
    setOtpCode('');
  }, [mode]);

  if (isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const finishLogin = (res) => {
    if (res.user?.role === 'admin' || res.user?.role === 'subadmin') {
      applyAuthMessage('Admin accounts must sign in via the Admin Portal (port 3001).', 'email');
      return false;
    }
    localStorage.setItem('tred_auth_token', res.token);
    localStorage.setItem('tred_auth_user', JSON.stringify(res.user));
    dispatch(loginSuccess({ user: res.user, token: res.token }));
    navigate(nextPath);
    return true;
  };

  const openForgot = () => {
    setForgotEmail(String(email || '').trim().toLowerCase());
    setRecoveryStep(1);
    setRecoveryCode('0000');
    setNewPassword('');
    setRecoveryNotice('');
    setRecoveryError('');
    setShowForgot(true);
  };

  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    const normalized = String(forgotEmail || '').trim().toLowerCase();
    if (!normalized) {
      setRecoveryError('Please enter your email.');
      return;
    }
    setForgotEmail(normalized);
    setRecoveryLoading(true);
    try {
      const res = await forgotPasswordApi({ email: normalized });
      if (res.success) {
        setRecoveryNotice(res.message || 'Use OTP 0000 to reset your password.');
        setRecoveryCode(res.otp || '0000');
        setRecoveryStep(2);
      } else {
        setRecoveryError(res.message || 'Could not start recovery.');
      }
    } catch (err) {
      setRecoveryError(err.userMessage || err.response?.data?.message || 'Could not start recovery.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    if (!String(recoveryCode || '').trim()) {
      setRecoveryError('Please enter OTP 0000.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setRecoveryError('New password must be at least 6 characters.');
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await resetPasswordApi({
        email: String(forgotEmail || '').trim().toLowerCase(),
        code: recoveryCode,
        newPassword
      });
      if (res.success) {
        setShowForgot(false);
        setPassword(newPassword);
        setIsRegister(false);
        clearFormErrors();
        setRecoveryNotice('');
        alert('Password reset successfully. Please sign in.');
      } else {
        setRecoveryError(res.message || 'Could not reset password.');
      }
    } catch (err) {
      setRecoveryError(err.userMessage || err.response?.data?.message || 'Could not reset password.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearFormErrors();

    try {
      if (requires2fa) {
        const res = await verify2faApi({ email: String(email).trim().toLowerCase(), code: otpCode });
        if (res.success && res.token) {
          finishLogin(res);
        } else {
          applyAuthMessage(res.message || 'Invalid verification code. Please try again.', 'otp');
        }
        return;
      }

      if (isRegister && requiresSignupOtp) {
        if (!/^\d{4}$/.test(String(otpCode || '').trim())) {
          applyAuthMessage('Enter the 4-digit email OTP (0000).', 'otp');
          return;
        }
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const res = await registerApi({
          name: String(name || '').trim(),
          email: normalizedEmail,
          password,
          dateOfBirth,
          confirmAge18: true,
          acceptTerms: true,
          otp: otpCode
        });
        if (res.success) {
          finishLogin(res);
        } else {
          applyAuthMessage(res.message || 'Could not create account. Please check OTP.', 'otp');
        }
        return;
      }

      if (isRegister) {
        const nextErrors = {};
        if (!String(name || '').trim()) nextErrors.name = 'Full name is required.';
        if (!String(email || '').trim()) nextErrors.email = 'Email is required.';
        if (!password || password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
        const age = getAgeFromDob(dateOfBirth);
        if (!dateOfBirth || age === null) {
          nextErrors.dateOfBirth = 'Please enter a valid date of birth.';
        } else if (age < 18) {
          nextErrors.dateOfBirth = 'Only users aged 18 years or older can create an account.';
        }
        if (!confirmAge18) nextErrors.confirmAge18 = 'Please confirm that you are 18 years or older.';
        if (!acceptTerms) nextErrors.acceptTerms = 'Please accept the Terms & Conditions and Privacy Policy.';
        if (Object.keys(nextErrors).length) {
          setFieldErrors(nextErrors);
          setError(Object.values(nextErrors)[0]);
          setLoading(false);
          return;
        }

        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (normalizedEmail !== email) setEmail(normalizedEmail);

        const otpRes = await registerSendOtpApi({ email: normalizedEmail });
        if (otpRes.success) {
          setOtpCode(otpRes.otp || '0000');
          setRequiresSignupOtp(true);
          clearFormErrors();
          return;
        }
        applyAuthMessage(otpRes.message || 'Could not send verification OTP.', 'email');
        return;
      }

      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (normalizedEmail !== email) setEmail(normalizedEmail);

      const res = await loginApi({ email: normalizedEmail, password });

      if (res.success && res.requires2fa) {
        setRequires2fa(true);
        clearFormErrors();
        return;
      }

      if (res.success) {
        finishLogin(res);
      } else {
        applyAuthMessage(res.message || 'Invalid email or password. Please check your details.');
      }
    } catch (err) {
      applyAuthMessage(
        err.userMessage ||
          err.response?.data?.message ||
          (isRegister
            ? requiresSignupOtp
              ? 'Could not verify OTP. Please try again.'
              : 'Could not send verification OTP. Please check your details.'
            : 'Invalid email or password. Please check your details.'),
        isRegister && requiresSignupOtp ? 'otp' : undefined
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    clearFormErrors();
    setConfirmAge18(false);
    setAcceptTerms(false);
    setDateOfBirth('');
    setRequires2fa(false);
    setRequiresSignupOtp(false);
    setOtpCode('');
    navigate(isRegister ? '/login' : '/register', { replace: true });
  };

  const inputBorder = (field) =>
    fieldErrors[field]
      ? 'border-rose-600 focus:border-rose-500 focus:ring-rose-500/30'
      : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30';
  const fieldHint = (field) =>
    fieldErrors[field] ? (
      <p className="mt-1.5 text-[11px] font-medium text-rose-400">{fieldErrors[field]}</p>
    ) : null;

  const isLight = theme === 'light';

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col lg:flex-row overflow-hidden">
      {/* ===== LEFT: Brand / Visual Panel (desktop only) ===== */}
      <aside className="relative hidden lg:flex lg:w-[40%] lg:min-h-screen overflow-hidden flex-col">
        <img
          src={authDeskImage}
          alt="Institutional trading desk with live SMC charts"
          className={`absolute inset-0 h-full w-full object-cover scale-105 animate-[authZoom_18s_ease-in-out_infinite_alternate] ${
            isLight ? 'opacity-40 saturate-75 brightness-110' : 'opacity-100'
          }`}
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? 'bg-gradient-to-br from-slate-50/95 via-cyan-50/90 to-emerald-50/92'
              : 'bg-gradient-to-br from-[#060a12]/75 via-[#0a1224]/80 to-[#041018]/92'
          }`}
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? 'bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.14),transparent_55%)]'
              : 'bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.18),transparent_55%)]'
          }`}
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? 'bg-[radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.1),transparent_50%)]'
              : 'bg-[radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%)]'
          }`}
        />

        <div
          className={`pointer-events-none absolute inset-0 ${isLight ? 'opacity-[0.05]' : 'opacity-[0.07]'}`}
          style={{
            backgroundImage: isLight
              ? 'linear-gradient(rgba(100,116,139,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.35) 1px, transparent 1px)'
              : 'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8 lg:p-8 xl:p-10">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/brand/tradrift-logo.svg"
                alt="Tradrift"
                className="h-10 w-10 rounded-xl shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform"
              />
              <div>
                <div
                  className={`text-lg font-extrabold tracking-tight leading-none ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Trad<span className={isLight ? 'text-cyan-600' : 'text-cyan-400'}>rift</span>
                </div>
                <div
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] mt-0.5 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Institutional SMC
                </div>
              </div>
            </Link>
            <Link
              to="/"
              className={`hidden sm:inline-flex text-[11px] font-semibold backdrop-blur-md rounded-full px-3.5 py-1.5 transition-colors ${
                isLight
                  ? 'text-slate-600 hover:text-slate-900 border border-slate-200/90 bg-white/70 hover:bg-white'
                  : 'text-slate-300 hover:text-white border border-white/10 bg-white/5'
              }`}
            >
              ← Back to Home
            </Link>
          </div>

          <div className="mt-10 lg:mt-0 max-w-xl space-y-7">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-md ${
                isLight
                  ? 'border-cyan-300/70 bg-cyan-50/90 text-cyan-800'
                  : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLight ? 'bg-cyan-500' : 'bg-cyan-400'}`} />
              Built for Indian F&O · Order Blocks · Liquidity
            </div>

            <div className="space-y-3">
              <h1
                className={`text-2xl sm:text-3xl xl:text-[2.15rem] font-extrabold tracking-tight leading-[1.15] ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Trade with{' '}
                <span
                  className={`bg-gradient-to-r bg-clip-text text-transparent ${
                    isLight
                      ? 'from-cyan-600 via-teal-600 to-emerald-600'
                      : 'from-cyan-300 via-teal-300 to-emerald-300'
                  }`}
                >
                  institutional clarity
                </span>
                , not retail noise.
              </h1>
              <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300/90'}`}>
                Live SMC terminal — order blocks, FVGs and liquidity sweeps across NSE F&O in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-xl border backdrop-blur-md px-3 py-2.5 transition-colors ${
                    isLight
                      ? 'border-slate-200/90 bg-white/80 shadow-sm shadow-slate-200/60 hover:bg-white'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                  }`}
                >
                  <div
                    className={`text-lg xl:text-xl font-extrabold tracking-tight ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {stat.value}
                  </div>
                  <div
                    className={`text-[9px] xl:text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:flex flex-col gap-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className={`group flex items-start gap-2.5 rounded-xl border backdrop-blur-md px-3 py-2.5 transition-all ${
                      isLight
                        ? 'border-slate-200/90 bg-white/85 shadow-sm shadow-slate-200/50 hover:border-cyan-300 hover:bg-white'
                        : 'border-slate-700/60 bg-[#0b1220]/55 hover:border-cyan-500/40'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isLight
                          ? 'bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200/80'
                          : 'bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {f.title}
                      </div>
                      <p
                        className={`text-[10px] leading-snug mt-0.5 ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {f.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-8 lg:mt-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className={`h-3.5 w-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              18+ traders only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className={`h-3.5 w-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              Encrypted sessions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className={`h-3.5 w-3.5 ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
              Live SMC engine
            </span>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT: Auth Form (login / signup / forgot only on mobile) ===== */}
      <main className="relative lg:w-[60%] flex-1 flex flex-col justify-center px-5 sm:px-8 lg:px-12 xl:px-16 py-8 sm:py-10 lg:py-12 min-h-screen">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute left-10 bottom-10 h-56 w-56 rounded-full bg-emerald-500/8 blur-[90px]" />

        <div className="relative z-10 w-full max-w-[440px] mx-auto">
          {/* Mobile brand header — left promo panel is hidden below lg */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <img
              src="/brand/tradrift-logo.svg"
              alt="Tradrift"
              className="h-9 w-9 rounded-xl shadow-md shadow-cyan-500/20"
            />
            <div>
              <div className={`text-base font-extrabold tracking-tight leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Trad<span className={isLight ? 'text-cyan-600' : 'text-cyan-400'}>rift</span>
              </div>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Trader Portal
              </div>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="text-[11px] font-semibold text-slate-400 hover:text-white">
              ← Back to Home
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-cyan-400 transition-colors"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-cyan-600" />
                )}
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">
                {showForgot ? 'Forgot' : isRegister ? 'Register' : 'Sign In'}
              </span>
            </div>
          </div>

          <div className="mb-7 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Trader Portal · 18+
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {requiresSignupOtp
                ? 'Verify your email'
                : isRegister
                  ? 'Create your trader account'
                  : 'Welcome back, trader'}
            </h2>
            <p className="text-sm text-slate-400">
              {requiresSignupOtp
                ? 'Enter the OTP sent to your email to finish signup. Default OTP is 0000 for now.'
                : isRegister
                  ? freeTrialEnabled
                    ? `Start a ${freeTrialDays}-day institutional trial. Available only for users aged 18 and above.`
                    : 'Create your account (18+). Choose a membership plan to unlock Terminal & Market X-Ray.'
                  : 'Access your dashboard, saved setups and live SMC terminal.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {requires2fa || requiresSignupOtp ? (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  {requiresSignupOtp ? 'Email Verification OTP' : '2FA Verification Code'}
                </label>
                {requiresSignupOtp && (
                  <p className="mb-2 text-[11px] text-slate-400">
                    OTP sent to <span className="font-semibold text-slate-200">{email}</span>
                  </p>
                )}
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={4}
                    placeholder="0000"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                      if (fieldErrors.otp) clearFormErrors();
                    }}
                    className={`w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border focus:ring-1 focus:outline-none transition-colors tracking-widest ${inputBorder('otp')}`}
                  />
                </div>
                {fieldHint('otp')}
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Default OTP for now: <span className="font-mono text-cyan-400">0000</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (requiresSignupOtp) {
                      setRequiresSignupOtp(false);
                    } else {
                      setRequires2fa(false);
                    }
                    setOtpCode('');
                    clearFormErrors();
                  }}
                  className="mt-2 text-[11px] font-semibold text-slate-400 hover:text-cyan-400"
                >
                  ← Back to {requiresSignupOtp ? 'details' : 'password'}
                </button>
              </div>
            ) : (
              <>
            {isRegister && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) clearFormErrors();
                    }}
                    className={`w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border focus:ring-1 focus:outline-none transition-colors ${inputBorder('name')}`}
                  />
                </div>
                {fieldHint('name')}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                    if (fieldErrors.email || fieldErrors.password) clearFormErrors();
                  }}
                  className={`w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border focus:ring-1 focus:outline-none transition-colors ${inputBorder('email')}`}
                />
              </div>
              {fieldHint('email') || (
                <p className="mt-1 text-[10px] text-slate-500">Email is not case-sensitive (Y and y are the same).</p>
              )}
            </div>

            {isRegister && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Date of Birth <span className="text-slate-600">(must be 18+)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <input
                    type="date"
                    required
                    max={maxDob}
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      if (fieldErrors.dateOfBirth) clearFormErrors();
                    }}
                    className={`w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border focus:ring-1 focus:outline-none transition-colors dark:[color-scheme:dark] ${inputBorder('dateOfBirth')}`}
                  />
                </div>
                {fieldHint('dateOfBirth')}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Password</label>
                {!isRegister ? (
                  <button
                    type="button"
                    onClick={openForgot}
                    className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    Forgot Password?
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500">Min. 6 characters</span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) clearFormErrors();
                  }}
                  className={`w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-11 text-sm text-white border focus:ring-1 focus:outline-none transition-colors ${inputBorder('password')}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldHint('password')}
            </div>

            {isRegister && (
              <>
                <div>
                <label className={`flex items-start gap-2.5 rounded-xl border bg-slate-950/50 px-3.5 py-3 cursor-pointer hover:border-cyan-700/40 transition-colors ${fieldErrors.confirmAge18 ? 'border-rose-600' : 'border-slate-800'}`}>
                  <input
                    type="checkbox"
                    checked={confirmAge18}
                    onChange={(e) => {
                      setConfirmAge18(e.target.checked);
                      if (fieldErrors.confirmAge18) clearFormErrors();
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                    required
                  />
                  <span className="text-[11px] text-slate-300 leading-relaxed">
                    I confirm that I am <strong className="text-white">18 years of age or older</strong> and
                    legally eligible to use this trading analytics platform.
                  </span>
                </label>
                {fieldHint('confirmAge18')}
                </div>

                <div>
                <label className={`flex items-start gap-2.5 rounded-xl border bg-slate-950/50 px-3.5 py-3 cursor-pointer hover:border-cyan-700/40 transition-colors ${fieldErrors.acceptTerms ? 'border-rose-600' : 'border-slate-800'}`}>
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => {
                      setAcceptTerms(e.target.checked);
                      if (fieldErrors.acceptTerms) clearFormErrors();
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                    required
                  />
                  <span className="text-[11px] text-slate-300 leading-relaxed">
                    I have read and agree to the{' '}
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms & Conditions
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {fieldHint('acceptTerms')}
                </div>

                <ul className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3.5 py-3">
                  {[
                    freeTrialEnabled
                      ? `${freeTrialDays}-day free institutional trial`
                      : 'Membership plans unlock full terminal access',
                    'Live terminal + Market X-Ray (with active plan)',
                    'BYOK or server feed — cancel anytime'
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
              </>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                (!requires2fa &&
                  !requiresSignupOtp &&
                  isRegister &&
                  (!confirmAge18 || !acceptTerms))
              }
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 py-3 text-sm font-extrabold text-black hover:opacity-95 transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 mt-1"
            >
              <span>
                {loading
                  ? 'Please wait…'
                  : requires2fa
                    ? 'Verify & Sign In'
                    : requiresSignupOtp
                      ? 'Verify OTP & Create Account'
                      : isRegister
                        ? 'Continue · Verify Email'
                        : 'Sign In to Terminal'}
              </span>
              {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline ml-1"
            >
              {isRegister ? 'Sign In' : freeTrialEnabled ? 'Sign Up Free' : 'Create Account'}
            </button>
          </div>
        </div>
      </main>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Reset Password
            </h3>
            <p className="text-slate-400">
              Enter your account email, then use OTP <span className="font-mono text-cyan-400">0000</span> to set a new password.
            </p>

            {recoveryNotice && (
              <div className="rounded-xl bg-emerald-950/80 border border-emerald-800/50 p-2.5 text-emerald-400">
                {recoveryNotice}
              </div>
            )}

            {recoveryStep === 1 ? (
              <form onSubmit={handleRequestRecovery} className="space-y-3">
                <div>
                  <label className="text-slate-400 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@gmail.com, you@yahoo.com, you@outlook.com, you@getnada.com"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value.toLowerCase());
                      if (recoveryError) setRecoveryError('');
                    }}
                    className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border placeholder:text-slate-600 ${
                      recoveryError ? 'border-rose-600' : 'border-slate-800'
                    }`}
                  />
                  {recoveryError && (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-400">{recoveryError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="rounded-lg bg-cyan-500 px-4 py-1.5 font-bold text-black disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Sending…' : 'Continue'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="text-slate-400 block mb-1">OTP</label>
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
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    Default OTP: <span className="font-mono text-cyan-400">0000</span>
                  </p>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    className={`w-full rounded-xl bg-slate-950 p-2.5 text-white border ${
                      recoveryError ? 'border-rose-600' : 'border-slate-800'
                    }`}
                  />
                  {recoveryError && (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-400">{recoveryError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(false);
                      setRecoveryError('');
                    }}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 font-bold text-black disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Saving…' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes authZoom {
          from { transform: scale(1.05); }
          to { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
