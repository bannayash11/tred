import React from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BarChart3,
  Flame,
  Clock,
  Target,
  ChevronRight,
  PlayCircle
} from 'lucide-react';

export default function HomePage({ onLaunchTerminal, onOpenPricing, onSelectStock, screenerData }) {
  const allStocks = screenerData?.allStocks || [];
  const bullish = screenerData?.bullishSetups || [];
  const bearish = screenerData?.bearishSetups || [];

  // Card 1: Top Bullish Setup
  const card1 = bullish[0] || allStocks.find((s) => s.symbol === 'RELIANCE') || {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    sector: 'Energy',
    currentPrice: 1320.0,
    change: 0.5,
    score: 95,
    type: 'BULLISH',
    zoneBottom: 1310,
    zoneTop: 1315,
    volumeRatio: 2.8,
    liquidityTarget: 1345
  };

  // Card 2: Top Bearish Setup
  const card2 = bearish[0] || allStocks.find((s) => s.symbol === 'WIPRO') || {
    symbol: 'WIPRO',
    name: 'Wipro Ltd',
    sector: 'IT',
    currentPrice: 198.0,
    change: -0.2,
    score: 88,
    type: 'BEARISH',
    zoneBottom: 198.7,
    zoneTop: 199.1,
    volumeRatio: 1.4,
    liquidityTarget: 195.3
  };

  // Card 3: Index or second high-momentum setup
  const card3 =
    bullish.find((s) => s.symbol === 'BANKNIFTY') ||
    allStocks.find((s) => s.symbol === 'BANKNIFTY') ||
    bullish[1] || {
      symbol: 'BANKNIFTY',
      name: 'Bank Nifty Index',
      sector: 'Indices',
      currentPrice: 58950.2,
      change: 1.88,
      score: 90,
      type: 'BULLISH',
      zoneBottom: 58613,
      zoneTop: 58755,
      volumeRatio: 1.8,
      liquidityTarget: 59200
    };

  const heroCards = [card1, card2, card3];
  return (
    <div className="space-y-24 py-6">
      {/* ================= 1. HERO SECTION ================= */}
      <section className="relative overflow-hidden pt-8 pb-12 text-center lg:pt-14">
        {/* Glowing Background Radial Highlights */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-transparent blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-[350px] w-[500px] rounded-full bg-emerald-500/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl space-y-6 px-4">
          {/* Top Pill */}
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-md shadow-lg shadow-cyan-500/10">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Next-Gen Smart Money Concepts (SMC) for Indian F&O</span>
            <ChevronRight className="h-3.5 w-3.5 text-cyan-400" />
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Spot Institutional Footprints{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Before the Big Move.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Stop chasing retail indicators and choppy noise. Scan 200+ NSE F&O stocks minute-by-minute with automated <strong className="text-white">Order Block zones</strong>, <strong className="text-white">liquidity sweeps</strong>, and <strong className="text-white">Market X-Ray</strong> capital flows.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onLaunchTerminal}
              className="group flex w-full sm:w-auto items-center justify-center space-x-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 px-8 py-4 text-sm font-extrabold text-black hover:opacity-95 transition-all shadow-xl shadow-cyan-500/25 hover:scale-105 active:scale-95"
            >
              <Zap className="h-4 w-4 fill-black" />
              <span>Launch Live Terminal</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onOpenPricing}
              className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-7 py-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all backdrop-blur-md"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>View 12-Month Bundle (₹22/day)</span>
            </button>
          </div>

          {/* Micro Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-3 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Zero Broker API Fees (Dhan/Fyers Free)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>1-Minute Real-Time Scans</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Built-in TradingView Charts</span>
            </div>
          </div>
        </div>

        {/* ================= HERO INTERACTIVE PREVIEW CARD ================= */}
        <div className="relative mx-auto mt-12 max-w-5xl px-4">
          <div className="relative rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 via-[#0a0f1d] to-[#080c14] p-3 sm:p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
            {/* Top Live Window Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 px-3">
              <div className="flex items-center space-x-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="ml-2 font-mono text-[11px] text-slate-400">tradrift-terminal // kotak-neo-live-stream</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>REAL-TIME NSE DATA ACTIVE</span>
              </div>
            </div>

            {/* Live Ticker Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
              {heroCards.map((card, idx) => {
                const isBullish = card.type !== 'BEARISH' && card.change >= 0;
                const formattedPrice = Number(card.currentPrice || 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                const formattedChange = `${card.change >= 0 ? '+' : ''}${Number(card.change || 0).toFixed(2)}%`;
                const zoneLow = Number(card.zoneBottom || card.currentPrice * 0.995).toFixed(1);
                const zoneHigh = Number(card.zoneTop || card.currentPrice * 1.005).toFixed(1);

                return (
                  <div
                    key={`${card.symbol}-${idx}`}
                    onClick={() => onSelectStock && onSelectStock(card.symbol)}
                    className={`cursor-pointer rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] ${
                      isBullish
                        ? 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400'
                        : 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-extrabold text-white">{card.symbol}</span>
                        <p className="text-[10px] text-slate-400">{card.sector || 'NSE F&O'} • 5m Real-Time</p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                          isBullish
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                            : 'bg-rose-950 text-rose-400 border-rose-800/50'
                        }`}
                      >
                        ★ {card.score || 90}/100 {card.score >= 90 ? 'Prime' : 'Strong'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between font-mono">
                      <span className="text-lg font-extrabold text-white">₹{formattedPrice}</span>
                      <span
                        className={`text-xs font-semibold ${
                          card.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formattedChange}
                      </span>
                    </div>

                    <div className="mt-2 rounded-lg bg-slate-950/80 p-2 text-[11px] font-mono space-y-0.5 border border-slate-800/60">
                      <div className={isBullish ? 'text-emerald-300' : 'text-rose-300'}>
                        {isBullish ? 'Bullish OB' : 'Bearish OB'}: ₹{zoneLow} - ₹{zoneHigh}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Volume Surge: {card.volumeRatio || '1.8'}x • {card.testCount === 0 ? 'Fresh Untouched Zone' : 'Tested ' + card.testCount + 'x'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Bar inside Mockup */}
            <div className="mt-3 flex items-center justify-between px-3 text-xs text-slate-400">
              <span>Click any card to inspect full TradingView chart with zone lines</span>
              <button
                onClick={onLaunchTerminal}
                className="text-cyan-400 hover:underline font-bold flex items-center space-x-1"
              >
                <span>Open Terminal</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. NUMBERS & TRUST METRICS ================= */}
      <section className="border-y border-slate-800/80 bg-slate-950/40 py-12">
        <div className="mx-auto max-w-6xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-400">200+</div>
            <div className="mt-1 text-xs text-slate-400 font-medium">NSE F&O Stocks Scanned</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400">60s</div>
            <div className="mt-1 text-xs text-slate-400 font-medium">Minute-by-Minute Refresh</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-400">1 : 3.2</div>
            <div className="mt-1 text-xs text-slate-400 font-medium">Average Risk-to-Reward</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-purple-400">₹0</div>
            <div className="mt-1 text-xs text-slate-400 font-medium">Data Cost (Free Dhan/Fyers)</div>
          </div>
        </div>
      </section>

      {/* ================= 3. FOUR CORE PILLARS ================= */}
      <section className="mx-auto max-w-6xl px-4 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Engineered for Precision
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Everything You Need to Trade Like Institutional Big Money
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            Traditional retail indicators like RSI and MACD lag behind price. Tradrift tracks actual orders and liquidity pools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature 1 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-4 hover:border-cyan-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">1. Live Liquidity Board</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scans all active F&O contracts every 60 seconds and ranks the cleanest bullish and bearish order blocks. Identifies fresh, unmitigated zones where institutions bought before violent breakout rallies.
            </p>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Calculated Quality Score (0 - 100) on each setup</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-4 hover:border-emerald-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">2. Automatic Chart Overlays</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click any stock to open high-speed TradingView Lightweight Charts. No manual drawing required — Order Block boxes, Stop Loss levels, and Buy/Sell-side Liquidity targets appear automatically.
            </p>
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Zero chart lag with pure canvas rendering</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-4 hover:border-purple-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-950 text-purple-400 border border-purple-800/60">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">3. Market X-Ray Macro Heatmap</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never fight against the macro market. Market X-Ray maps advancing vs declining stocks, sector rotation (Banking vs IT vs Auto), and overall distribution sentiment in real-time.
            </p>
            <div className="flex items-center space-x-2 text-xs font-mono text-purple-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Instant market breadth at a single glance</span>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-4 hover:border-amber-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950 text-amber-400 border border-amber-800/60">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">4. Trader Dashboard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage membership, payments, sessions and account security from one place — renew plans, cancel access, and stay in control.
            </p>
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Membership, payments and security in one hub</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. RETAIL TRADER VS TRADRIFT COMPARISON ================= */}
      <section className="mx-auto max-w-5xl px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">The Edge</span>
          <h2 className="text-3xl font-extrabold text-white">Why Retail Traders Fail vs Tradrift Traders</h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
          <div className="grid grid-cols-2 text-xs">
            <div className="p-6 border-r border-slate-800 bg-rose-950/10 space-y-4">
              <div className="font-bold text-rose-400 text-sm flex items-center space-x-2">
                <span>❌ The Old Retail Way</span>
              </div>
              <ul className="space-y-3 text-slate-400">
                <li>• Chasing lagging indicators (RSI overbought/oversold traps)</li>
                <li>• Buying breakouts that get immediately dumped by institutions</li>
                <li>• Guessing random support/resistance lines on subjective charts</li>
                <li>• Terrible 1:1 risk-reward resulting in negative expectancy</li>
                <li>• Overtrading choppy sideways stocks without institutional momentum</li>
              </ul>
            </div>

            <div className="p-6 bg-emerald-950/10 space-y-4">
              <div className="font-bold text-emerald-400 text-sm flex items-center space-x-2">
                <span>✅ The Tradrift Way</span>
              </div>
              <ul className="space-y-3 text-slate-300">
                <li>• Entering right at the base where institutions accumulated orders</li>
                <li>• Waiting for liquidity sweeps and Break of Structure (BOS)</li>
                <li>• Clear, objective Order Block boundary boxes with tight Stop Losses</li>
                <li>• High expectancy 1:2.5 to 1:4+ risk-to-reward setups</li>
                <li>• Scanning 200+ F&O stocks to isolate pure momentum leaders</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. PRICING & PROMOTION SECTION ================= */}
      <section className="mx-auto max-w-4xl px-4 text-center space-y-8">
        <div className="space-y-2">
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/40">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Limited Promotional Offer</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            12-Month Institutional Access Bundle
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Get full access to all terminal screeners, pop-up charts, and community at ~₹22/day.
          </p>
        </div>

        {/* Pricing Box */}
        <div className="relative mx-auto max-w-lg rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-[#0a0f1d] p-8 shadow-2xl text-left">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <span className="text-sm font-bold text-white">6 Months + 6 Months Free Bundle</span>
              <p className="text-xs text-emerald-400 font-medium">12 Full Months of Unrestricted Terminal Access</p>
            </div>
            <span className="rounded-full bg-cyan-950 px-2.5 py-1 text-[11px] font-bold text-cyan-400 border border-cyan-800">
              SAVE 72%
            </span>
          </div>

          <div className="my-6 flex items-baseline space-x-3">
            <span className="text-slate-500 line-through text-lg">₹28,999</span>
            <span className="text-4xl sm:text-5xl font-extrabold text-white font-mono">₹7,999</span>
            <span className="text-xs text-slate-400">/ 12 Months</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 mb-8">
            {[
              'Minute-by-minute live Order Block screener for 200+ F&O stocks',
              'Auto-drawn demand & supply zone pop-up charts',
              'Market X-Ray macro breadth & sector flow',
              'Trader dashboard with membership & payments',
              'Free future updates & broker integration support'
            ].map((f, i) => (
              <div key={i} className="flex items-center space-x-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onOpenPricing}
            className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 py-3.5 text-sm font-extrabold text-black hover:opacity-95 transition-opacity shadow-lg shadow-cyan-500/20"
          >
            <span>Claim 12-Month Access for ₹7,999</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ================= 6. FAQ SECTION ================= */}
      <section className="mx-auto max-w-3xl px-4 space-y-6">
        <h2 className="text-2xl font-extrabold text-white text-center">Frequently Asked Questions</h2>
        <div className="space-y-3 text-xs">
          {[
            {
              q: 'What is an Order Block in simple words?',
              a: 'An Order Block is the last down-candle before a violent upward rally (Bullish OB) or the last up-candle before a sharp decline (Bearish OB). This marks where institutions accumulated huge positions, creating high-probability retest zones.'
            },
            {
              q: 'Do I have to pay extra for live NSE stock data?',
              a: 'No! If you have a free Dhan or Fyers account, their official live market data APIs are 100% free with zero monthly charges. Our backend connects directly to them.'
            },
            {
              q: 'Does it work for both Intraday and Swing Trading?',
              a: 'Yes. The terminal scans multiple timeframes (1-minute, 5-minute for intraday scalping/momentum, and 15-minute/hourly for multi-day swing holding).'
            },
            {
              q: 'Can I use this on mobile phone?',
              a: 'Yes, the interface is completely mobile-responsive and allows smooth scanning and chart popups directly on your smartphone browser.'
            }
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1.5">
              <h3 className="font-bold text-white text-sm">{item.q}</h3>
              <p className="text-slate-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 7. BOTTOM BANNER CTA ================= */}
      <section className="mx-auto max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/25 dark:border-cyan-500/40 bg-gradient-to-r from-cyan-50 via-slate-50 to-blue-50 dark:from-cyan-950 dark:via-slate-900 dark:to-blue-950 p-8 sm:p-12 text-center space-y-5 shadow-xl shadow-cyan-500/5 dark:shadow-none">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ready to upgrade your trading edge?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            Join professional traders tracking institutional liquidity footprints across the Indian market.
          </p>
          <div className="pt-2">
            <button
              onClick={onLaunchTerminal}
              className="inline-flex items-center space-x-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 px-8 py-3.5 text-sm font-extrabold text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all shadow-xl shadow-cyan-500/25 cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-slate-950" />
              <span>Launch Live Terminal Now</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

