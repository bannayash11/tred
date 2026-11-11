import React from 'react';
import {
  LayoutDashboard,
  Activity,
  BookOpen,
  ShieldCheck,
  Zap,
  TrendingUp,
  User,
  LogOut,
  Sparkles
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
  onOpenPricing,
  onLogout,
  niftyData,
  bankNiftyData
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0a0f1d]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Ticker */}
        <div className="flex items-center space-x-6">
          <div 
            onClick={() => setActiveTab('terminal')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 text-black fill-black" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                  ORDER<span className="text-cyan-400">BLOCK</span>
                </span>
                <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800/60">
                  PRO
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 -mt-0.5">SMC & Liquidity Terminal</p>
            </div>
          </div>

          {/* Quick Index Tickers */}
          <div className="hidden lg:flex items-center space-x-3 border-l border-slate-800 pl-6 text-xs">
            <div className="flex items-center space-x-2 rounded-md bg-slate-900/80 px-2.5 py-1 border border-slate-800">
              <span className="font-semibold text-slate-300">NIFTY 50</span>
              <span className="font-mono text-white">
                {niftyData?.currentPrice ? `₹${niftyData.currentPrice.toLocaleString('en-IN')}` : '₹24,350.00'}
              </span>
              <span className={`font-mono text-[11px] ${niftyData?.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {niftyData?.change >= 0 ? `+${niftyData.change}%` : `${niftyData?.change}%`}
              </span>
            </div>

            <div className="flex items-center space-x-2 rounded-md bg-slate-900/80 px-2.5 py-1 border border-slate-800">
              <span className="font-semibold text-slate-300">BANKNIFTY</span>
              <span className="font-mono text-white">
                {bankNiftyData?.currentPrice ? `₹${bankNiftyData.currentPrice.toLocaleString('en-IN')}` : '₹52,180.00'}
              </span>
              <span className={`font-mono text-[11px] ${bankNiftyData?.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {bankNiftyData?.change >= 0 ? `+${bankNiftyData.change}%` : `${bankNiftyData?.change}%`}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>NSE Live Feed</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'terminal'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('xray')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'xray'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Market X-Ray</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'journal'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Journal</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold shadow'
                : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Admin</span>
          </button>
        </nav>

        {/* User Controls & Plan */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenPricing}
            className="hidden sm:flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Plans (₹22/day)</span>
          </button>

          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex flex-col text-right text-xs">
                <span className="font-semibold text-slate-200">{user.name}</span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {user.role === 'admin' ? 'Super Admin' : user.subscription?.plan || 'Active Member'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <User className="h-4 w-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
