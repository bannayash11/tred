import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Activity,
  BookOpen,
  Newspaper,
  Zap,
  User,
  LogOut,
  Sparkles,
  Menu,
  X,
  PenLine,
  Lock,
  Sun,
  Moon,
  GitBranch
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/', icon: Home },
  { id: 'terminal', label: 'Terminal', path: '/terminal', icon: LayoutDashboard, live: true, authRequired: true },
  { id: 'order-flow', label: 'Order Flow', path: '/order-flow', icon: GitBranch, live: true, authRequired: true },
  { id: 'momentum', label: '5M Momentum', path: '/momentum', icon: Zap, live: true, authRequired: true },
  { id: 'xray', label: 'Market X-Ray', path: '/xray', icon: Activity, authRequired: true },
  { id: 'news', label: 'Market News', path: '/news', icon: Newspaper },
  { id: 'blog', label: 'SMC Blog', path: '/blog', icon: BookOpen },
  { id: 'trade-log', label: 'Trade Log', path: '/trade-log', icon: PenLine, authRequired: true }
];

function formatChange(change) {
  if (change === undefined || change === null || Number.isNaN(Number(change))) return '0.00%';
  const n = Number(change);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function TickerPill({ label, price, change }) {
  const up = Number(change) >= 0;
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2 py-1 border border-slate-800/90 shrink-0">
      <span className="font-semibold text-slate-500 text-[10px] uppercase">{label}</span>
      <span className="font-mono text-[11px] font-bold text-slate-100">
        {price != null ? `₹${Number(price).toLocaleString('en-IN')}` : '—'}
      </span>
      <span className={`font-mono text-[10px] font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
        {formatChange(change)}
      </span>
    </div>
  );
}

export default function Navbar({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  user,
  onOpenAuth,
  onOpenPricing,
  onLogout,
  niftyData,
  bankNiftyData
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);

  const currentPath = location?.pathname || '/';
  const getActiveTab = () => {
    if (currentPath === '/' || currentPath === '') return 'home';
    if (currentPath.startsWith('/terminal')) return 'terminal';
    if (currentPath.startsWith('/order-flow')) return 'order-flow';
    if (currentPath.startsWith('/momentum') || currentPath.startsWith('/opening-momentum')) return 'momentum';
    if (currentPath.startsWith('/xray') || currentPath.startsWith('/market-xray')) return 'xray';
    if (currentPath.startsWith('/news')) return 'news';
    if (currentPath.startsWith('/blog')) return 'blog';
    if (currentPath.startsWith('/trade-log') || currentPath.startsWith('/journal')) return 'trade-log';
    if (currentPath.startsWith('/dashboard')) return 'dashboard';
    if (currentPath.startsWith('/pricing')) return 'pricing';
    return propActiveTab || 'home';
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const handleTabClick = (tab, path, authRequired = false) => {
    if (authRequired && !user) {
      navigate(`/login?next=${encodeURIComponent(path)}`);
      setMobileOpen(false);
      return;
    }
    if (propSetActiveTab) propSetActiveTab(tab);
    navigate(path);
    setMobileOpen(false);
  };

  const navButtonClass = (id) =>
    `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
      activeTab === id
        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-bold'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
    }`;

  const mobileMenu =
    mobileOpen &&
    createPortal(
      <div className="lg:hidden fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
        <button
          type="button"
          className="absolute inset-0 bg-black/75"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />

        <aside className="absolute left-0 top-0 bottom-0 w-[min(100vw-3rem,20rem)] bg-[#0a0f1d] border-r border-slate-800 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600">
                <Zap className="h-5 w-5 text-black fill-black" />
              </div>
              <span className="font-extrabold text-white truncate">
                ORDER<span className="text-cyan-400">BLOCK</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl bg-slate-800 p-2.5 text-slate-300 hover:text-white shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map(({ id, label, path, icon: Icon, live, authRequired }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabClick(id, path, authRequired)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {authRequired && !user && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                {live && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                if (onOpenPricing) onOpenPricing();
                else handleTabClick('pricing', '/pricing');
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-950/40 border border-amber-800/40 mt-2"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Pricing</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={() => handleTabClick('dashboard', '/dashboard')}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </button>
            )}

            {/* Mobile Theme Switcher */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 mt-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-cyan-400" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500" />
                )}
                <span>Theme</span>
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-2 shrink-0 safe-bottom">
            {user ? (
              <>
                <div className="text-xs text-slate-400 truncate px-1">{user.email}</div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-950/50 border border-rose-800/50 py-3 text-xs font-bold text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth?.();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-xs font-bold text-black"
              >
                <User className="h-3.5 w-3.5" />
                Login
              </button>
            )}
          </div>
        </aside>
      </div>,
      document.body
    );

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-xl">
        <div className="w-full max-w-[1800px] mx-auto flex h-14 sm:h-16 items-center justify-between gap-2 px-3 sm:px-5 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 hover:text-white shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('home', '/')}
              className="flex items-center gap-2 cursor-pointer group min-w-0"
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-cyan-400 to-blue-600 shadow-md shadow-cyan-500/20">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-black fill-black" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
                    ORDER<span className="text-cyan-400">BLOCK</span>
                  </span>
                  <span className="hidden sm:inline rounded bg-cyan-950/90 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-800/60 uppercase">
                    PRO
                  </span>
                </div>
                <span className="hidden md:block text-[10px] text-slate-500 font-medium -mt-0.5">
                  SMC & Liquidity Terminal
                </span>
              </div>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-0.5 rounded-2xl bg-slate-900/80 p-1 border border-slate-800/90">
            {NAV_ITEMS.map(({ id, label, path, icon: Icon, live, authRequired }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabClick(id, path, authRequired)}
                className={navButtonClass(id)}
                title={authRequired && !user ? 'Login required' : label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{label}</span>
                <span className="xl:hidden">
                  {id === 'xray' ? 'X-Ray' : id === 'news' ? 'News' : id === 'blog' ? 'Blog' : label}
                </span>
                {authRequired && !user && <Lock className="h-3 w-3 opacity-70" />}
                {live && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/80 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all shrink-0"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-cyan-600 transition-transform hover:-rotate-12" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenPricing) onOpenPricing();
                else handleTabClick('pricing', '/pricing');
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 sm:px-3 py-2 text-xs font-bold text-amber-300 border border-amber-500/35 hover:bg-amber-500/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Pricing</span>
            </button>

            {user ? (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-900/90 pl-1.5 sm:pl-2.5 pr-1 py-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTabClick('dashboard', '/dashboard')}
                  className="flex items-center gap-2"
                  title="Dashboard"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-black font-bold text-[10px]">
                    {user.name ? user.name.slice(0, 2).toUpperCase() : 'TR'}
                  </div>
                  <div className="hidden md:flex flex-col text-left leading-tight">
                    <span className="text-xs font-bold text-slate-100 max-w-[100px] truncate">{user.name}</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        membership.isExpired
                          ? 'text-rose-400'
                          : membership.isPro
                            ? 'text-cyan-400'
                            : membership.isStarter
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                      }`}
                    >
                      {membership.isExpired
                        ? 'Expired'
                        : membership.isPro
                          ? 'Pro'
                          : membership.isStarter
                            ? 'Starter'
                            : 'Trial'}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 sm:px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
              >
                <User className="h-3.5 w-3.5" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {mobileMenu}
    </>
  );
}
