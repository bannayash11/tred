import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  User,
  Lock,
  Mail,
  ArrowRight,
  Zap,
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
import { loginApi, registerApi } from '../services/api';
import { loginSuccess } from '../store/slices/authSlice';
import authDeskImage from '../assets/auth-trading-desk.jpg';
import { useTheme } from '../context/ThemeContext';

const FEATURES = [
  {
    icon: Layers,
    title: 'Live Order Blocks',
    text: 'Institutional demand & supply zones mapped on 200+ F&O names.'
  },
  {
    icon: Activity,
    title: 'Market X-Ray',
    text: 'Sector heat, capital flow and breadth in one institutional view.'
  },
  {
    icon: Target,
    title: 'Liquidity Sweeps',
    text: 'Catch stop-hunts before the real displacement move begins.'
  },
  {
    icon: BarChart3,
    title: 'Trade Log',
    text: 'Record broker trades here — track setups, R:R and expectancy.'
  }
];

const STATS = [
  { value: '200+', label: 'F&O Stocks' },
  { value: '1m', label: 'Scan Speed' },
  { value: '14d', label: 'Free Trial' },
  { value: 'SMC', label: 'Native Engine' }
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const maxDob = useMemo(() => maxDobFor18Plus(), []);

  useEffect(() => {
    setIsRegister(mode === 'register');
  }, [mode]);

  if (isAuthenticated) {
    const next = searchParams.get('next') || '/order-flow';
    return <Navigate to={next} replace />;
  }

  const finishLogin = (res) => {
    if (res.user?.role === 'admin' || res.user?.role === 'subadmin') {
      setError('Admin accounts must sign in via the Admin Portal (port 3001).');
      return false;
    }
    localStorage.setItem('tred_auth_token', res.token);
    localStorage.setItem('tred_auth_user', JSON.stringify(res.user));
    dispatch(loginSuccess({ user: res.user, token: res.token }));
    const next = searchParams.get('next') || '/order-flow';
    navigate(next);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const age = getAgeFromDob(dateOfBirth);
        if (!dateOfBirth || age === null) {
          setError('Please enter a valid date of birth.');
          setLoading(false);
          return;
        }
        if (age < 18) {
          setError('Only users aged 18 years or older can create an account.');
          setLoading(false);
          return;
        }
        if (!confirmAge18) {
          setError('Please confirm that you are 18 years or older.');
          setLoading(false);
          return;
        }
        if (!acceptTerms) {
          setError('Please accept the Terms & Conditions and Privacy Policy.');
          setLoading(false);
          return;
        }
      }

      const res = isRegister
        ? await registerApi({
            name,
            email,
            password,
            dateOfBirth,
            confirmAge18: true,
            acceptTerms: true
          })
        : await loginApi({ email, password });

      if (res.success) {
        finishLogin(res);
      } else {
        setError(res.message || 'Authentication failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setConfirmAge18(false);
    setAcceptTerms(false);
    setDateOfBirth('');
    navigate(isRegister ? '/login' : '/register', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col lg:flex-row overflow-hidden">
      {/* ===== LEFT: Brand / Visual Panel ===== */}
      <aside className="relative lg:w-[40%] min-h-[42vh] lg:min-h-screen overflow-hidden">
        <img
          src={authDeskImage}
          alt="Institutional trading desk with live SMC charts"
          className="absolute inset-0 h-full w-full object-cover scale-105 animate-[authZoom_18s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#060a12]/75 via-[#0a1224]/80 to-[#041018]/92" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%)]" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8 lg:p-8 xl:p-10">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 text-black shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight leading-none">
                  ORDER<span className="text-cyan-400">BLOCK</span>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 mt-0.5">
                  Institutional SMC
                </div>
              </div>
            </Link>
            <Link
              to="/"
              className="hidden sm:inline-flex text-[11px] font-semibold text-slate-300 hover:text-white border border-white/10 bg-white/5 backdrop-blur-md rounded-full px-3.5 py-1.5 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>

          <div className="mt-10 lg:mt-0 max-w-xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Built for Indian F&O · Order Blocks · Liquidity
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl xl:text-[2.15rem] font-extrabold tracking-tight leading-[1.15] text-white">
                Trade with{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                  institutional clarity
                </span>
                , not retail noise.
              </h1>
              <p className="text-sm text-slate-300/90 leading-relaxed">
                Live SMC terminal — order blocks, FVGs and liquidity sweeps across NSE F&O in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-3 py-2.5 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="text-lg xl:text-xl font-extrabold text-white tracking-tight">{stat.value}</div>
                  <div className="text-[9px] xl:text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
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
                    className="group flex items-start gap-2.5 rounded-xl border border-slate-700/60 bg-[#0b1220]/55 backdrop-blur-md px-3 py-2.5 hover:border-cyan-500/40 transition-all"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25 transition-colors">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{f.title}</div>
                      <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{f.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 lg:mt-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              18+ traders only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Encrypted sessions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              Live SMC engine
            </span>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT: Auth Form ===== */}
      <main className="relative lg:w-[60%] flex-1 flex flex-col justify-center px-5 sm:px-8 lg:px-12 xl:px-16 py-10 lg:py-12">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute left-10 bottom-10 h-56 w-56 rounded-full bg-emerald-500/8 blur-[90px]" />

        <div className="relative z-10 w-full max-w-[440px] mx-auto">
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
                {isRegister ? 'Register' : 'Sign In'}
              </span>
            </div>
          </div>

          <div className="mb-7 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Trader Portal · 18+
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isRegister ? 'Create your trader account' : 'Welcome back, trader'}
            </h2>
            <p className="text-sm text-slate-400">
              {isRegister
                ? 'Start a 14-day institutional trial. Available only for users aged 18 and above.'
                : 'Access your dashboard, Trade Log, saved setups and live SMC terminal.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-950/80 border border-rose-800/50 p-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none transition-colors"
                />
              </div>
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
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-3 text-sm text-white border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none transition-colors dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Password</label>
                <span className="text-[10px] text-slate-500">Min. 6 characters</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/80 py-3 pl-10 pr-11 text-sm text-white border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none transition-colors"
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
            </div>

            {isRegister && (
              <>
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3 cursor-pointer hover:border-cyan-700/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={confirmAge18}
                    onChange={(e) => setConfirmAge18(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                    required
                  />
                  <span className="text-[11px] text-slate-300 leading-relaxed">
                    I confirm that I am <strong className="text-white">18 years of age or older</strong> and
                    legally eligible to use this trading analytics platform.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3 cursor-pointer hover:border-cyan-700/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
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

                <ul className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3.5 py-3">
                  {[
                    '14-day free institutional trial',
                    'Live terminal + Market X-Ray access',
                    'Cancel anytime — no broker lock-in'
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && (!confirmAge18 || !acceptTerms))}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 py-3 text-sm font-extrabold text-black hover:opacity-95 transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 mt-1"
            >
              <span>{loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In to Terminal'}</span>
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
              {isRegister ? 'Sign In' : 'Sign Up Free'}
            </button>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Terminal', to: '/terminal' },
              { label: 'Pricing', to: '/pricing' },
              { label: 'About', to: '/about' }
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[11px] font-semibold text-slate-500 hover:text-cyan-300 transition-colors py-1"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes authZoom {
          from { transform: scale(1.05); }
          to { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
