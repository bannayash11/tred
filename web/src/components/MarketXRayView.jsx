import React, { useState } from 'react';
import {
  Activity,
  Layers,
  TrendingUp,
  TrendingDown,
  Flame,
  BarChart3,
  RefreshCw,
  ShieldAlert,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Compass,
  Sliders,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Eye,
  Gauge,
  Percent,
  PieChart,
  Scale,
  AlertTriangle,
  Search
} from 'lucide-react';
export default function MarketXRayView({ xrayData, onSelectStock, errorMessage = '' }) {
  const activeData = xrayData || null;

  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'SECTORS' | 'FII_DII' | 'OPTIONS_VIX'
  const [selectedSectorName, setSelectedSectorName] = useState('Banking');
  const [sectorSearch, setSectorSearch] = useState('');

  if (!activeData) {
    return (
      <div
        className={`rounded-2xl border border-dashed p-12 text-center text-sm ${
          errorMessage
            ? 'border-rose-800/70 bg-rose-950/30 text-rose-300'
            : 'border-slate-800 text-slate-500'
        }`}
      >
        {errorMessage || 'No Market X-Ray data available. Waiting for live feed…'}
      </div>
    );
  }

  const {
    advancing = 0,
    declining = 0,
    neutral = 0,
    totalStocks = 0,
    advanceDeclineRatio = 0,
    advancingVolume = 0,
    decliningVolume = 0,
    advanceVolumeRatio = 0,
    sectors = [],
    bullishSetupsCount = 0,
    bearishSetupsCount = 0,
    fiiDiiFlow = {},
    vixRegime = { niftyDailyRange: {}, bankNiftyDailyRange: {} },
    optionsMacro = {},
    smtDivergence = null,
    volumeSurgeStocks = []
  } = activeData;

  const filteredSectors = (sectors || []).filter((s) =>
    s.name.toLowerCase().includes(sectorSearch.toLowerCase())
  );

  // Active sector object for master-detail view
  const currentSector = (sectors || []).find((s) => s.name === selectedSectorName) || sectors[0] || null;

  const formatVolume = (vol) => {
    if (!vol) return '0';
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)} Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)} L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)} K`;
    return vol.toLocaleString('en-IN');
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  Market X-Ray & Institutional Macro Flow
                </h1>
                <span className="rounded-md bg-cyan-950/90 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800/60 uppercase">
                  Institutional Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Macro market breadth, FII/DII positioning, Sector rotation matrix, VIX regime, and SMC order flow.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Live Tick */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-300 border border-slate-800/80">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-slate-400">Live 2s Tick Sync</span>
          </div>

          <div className="inline-flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('OVERVIEW')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'OVERVIEW'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Macro Pulse
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SECTORS')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'SECTORS'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Sector Drilldown
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('FII_DII')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'FII_DII'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              FII / DII Flow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('OPTIONS_VIX')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'OPTIONS_VIX'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Options & VIX
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Top 4 Key Metric Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Market Breadth */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Scale className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
              Market Breadth
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                advancing >= declining
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
              }`}
            >
              {advancing >= declining ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold font-mono text-white">
              {advanceDeclineRatio} <span className="text-sm font-normal text-slate-400">: 1</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              <span className="text-emerald-400 font-semibold">{advancing} Adv</span> / <span className="text-rose-400 font-semibold">{declining} Dec</span>
            </span>
          </div>

          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              style={{ width: `${Math.round((advancing / (totalStocks || 1)) * 100)}%` }}
              className="bg-emerald-500 transition-all duration-500"
            ></div>
            <div
              style={{ width: `${Math.round((declining / (totalStocks || 1)) * 100)}%` }}
              className="bg-rose-500 transition-all duration-500"
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>Vol Ratio: <strong className="text-slate-200 font-mono">{advanceVolumeRatio}x</strong></span>
            <span>{bullishSetupsCount} Bull / {bearishSetupsCount} Bear OB</span>
          </div>
        </div>

        {/* Card 2: FII Institutional Flow */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Layers className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
              FII Futures Bias
            </span>
            {fiiDiiFlow.available === false ? (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                NO DUMMY DATA
              </span>
            ) : (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  fiiDiiFlow.fiiLongRatio >= 55
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                }`}
              >
                {fiiDiiFlow.fiiLongRatio}% LONG
              </span>
            )}
          </div>

          {fiiDiiFlow.available === false ? (
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {fiiDiiFlow.insight || 'Official FII/DII feed not connected.'}
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-2xl font-extrabold font-mono ${
                    fiiDiiFlow.netInstitutionalFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {fiiDiiFlow.netInstitutionalFlow >= 0 ? '+' : ''}₹{fiiDiiFlow.netInstitutionalFlow} Cr
                </span>
                <span className="text-xs text-slate-400">Net Inst. Cash</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div style={{ width: `${fiiDiiFlow.fiiLongRatio}%` }} className="bg-emerald-500 transition-all duration-500" />
                <div style={{ width: `${fiiDiiFlow.fiiShortRatio}%` }} className="bg-rose-500 transition-all duration-500" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>FII: <strong className={fiiDiiFlow.fiiNetCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₹{fiiDiiFlow.fiiNetCash} Cr</strong></span>
                <span>DII: <strong className="text-emerald-400">₹{fiiDiiFlow.diiNetCash} Cr</strong></span>
              </div>
            </>
          )}
        </div>

        {/* Card 3: India VIX & Day Range */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Gauge className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
              India VIX Regime
            </span>
            {vixRegime.available === false ? (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                NO DUMMY DATA
              </span>
            ) : (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  vixRegime.vixChange <= 0
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                }`}
              >
                {vixRegime.vixChange <= 0 ? `${vixRegime.vixChange}% Vol Cooling` : `+${vixRegime.vixChange}% Vol Surge`}
              </span>
            )}
          </div>

          {vixRegime.available === false ? (
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {vixRegime.description || 'Live India VIX quote not connected.'}
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold font-mono text-cyan-400">{vixRegime.indiaVix}</span>
                <span className="text-xs text-slate-300 font-medium">Exp. ±{vixRegime.niftyDailyRange?.points} pts</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{vixRegime.regime}</div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 font-mono">
                <span>Floor: ₹{vixRegime.niftyDailyRange?.low}</span>
                <span>Ceiling: ₹{vixRegime.niftyDailyRange?.high}</span>
              </div>
            </>
          )}
        </div>

        {/* Card 4: Macro Options Sentiment */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Target className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
              Options Macro Bias
            </span>
            {optionsMacro.available === false ? (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                SEE ORDER FLOW
              </span>
            ) : (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  optionsMacro.niftyPcr >= 1.0
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                }`}
              >
                PCR: {optionsMacro.niftyPcr}
              </span>
            )}
          </div>

          {optionsMacro.available === false ? (
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {optionsMacro.summary || 'Use Order Flow for live option OI / PCR from Kotak.'}
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold font-mono text-white">{optionsMacro.niftyMaxPain}</span>
                <span className="text-xs text-slate-400">Max Pain Strike</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Put Wall: <strong className="text-emerald-400 font-mono">{optionsMacro.niftyPutWall}</strong></span>
                <span>Call Wall: <strong className="text-rose-400 font-mono">{optionsMacro.niftyCallWall}</strong></span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>BNF PCR: <strong className="text-slate-200 font-mono">{optionsMacro.bankNiftyPcr}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SMT Divergence & SMC Confluence Banner */}
      {smtDivergence && (
        <div
          className={`rounded-xl border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm transition-all ${
            smtDivergence.type === 'BULLISH'
              ? 'border-emerald-500/30 bg-emerald-950/20'
              : smtDivergence.type === 'BEARISH'
              ? 'border-rose-500/30 bg-rose-950/20'
              : 'border-amber-500/30 bg-amber-950/20'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                smtDivergence.type === 'BULLISH'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : smtDivergence.type === 'BEARISH'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  SMT Divergence Radar:
                </span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${
                    smtDivergence.type === 'BULLISH'
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                      : smtDivergence.type === 'BEARISH'
                      ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                      : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  {smtDivergence.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {smtDivergence.details}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                SMC Confluence
              </span>
              <div className="font-mono text-base font-extrabold text-white">
                <span className={smtDivergence.confluenceScore >= 70 ? 'text-emerald-400' : smtDivergence.confluenceScore <= 40 ? 'text-rose-400' : 'text-amber-400'}>
                  {smtDivergence.confluenceScore}
                </span>
                <span className="text-xs text-slate-500 font-normal"> / 100</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: MACRO PULSE (OVERVIEW) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {/* 2-Column Split: Sector Barometer on Left, Participant OI on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Sector Barometer (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white">Sector Rotation Barometer</h2>
                  <span className="text-xs text-slate-400">({sectors?.length || 0} Sectors)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('SECTORS')}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                >
                  <span>Open Full Drilldown</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Compact Sector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(sectors || []).slice(0, 8).map((sec) => (
                  <div
                    key={sec.name}
                    onClick={() => {
                      setSelectedSectorName(sec.name);
                      setActiveTab('SECTORS');
                    }}
                    className={`rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.01] ${
                      sec.avgChange >= 0
                        ? 'border-emerald-900/40 bg-emerald-950/15 hover:border-emerald-500/50'
                        : 'border-rose-900/40 bg-rose-950/15 hover:border-rose-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{sec.name}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              sec.status === 'BULLISH'
                                ? 'bg-emerald-950 text-emerald-400'
                                : sec.status === 'BEARISH'
                                ? 'bg-rose-950 text-rose-400'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {sec.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {sec.count} Stocks ({sec.advancingCount || 0} Adv / {sec.decliningCount || 0} Dec)
                        </span>
                      </div>
                      <div
                        className={`font-mono text-sm font-extrabold ${
                          sec.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {sec.avgChange >= 0 ? `+${sec.avgChange}%` : `${sec.avgChange}%`}
                      </div>
                    </div>

                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        style={{ width: `${Math.min(Math.abs(sec.avgChange) * 45, 100)}%` }}
                        className={`h-full ${sec.avgChange >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Participant OI Snapshot (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <PieChart className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white">Smart Money Positioning</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('FII_DII')}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                >
                  <span>Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {(fiiDiiFlow.participantBreakdown || []).map((p) => (
                  <div key={p.category} className="rounded-xl bg-slate-950/70 p-3 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{p.category}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                          p.sentiment.includes('BULLISH') || p.sentiment.includes('ACCUMULATION')
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : p.sentiment.includes('BEARISH') || p.sentiment.includes('TRAPPED')
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                            : 'bg-slate-900 text-slate-300 border border-slate-700/50'
                        }`}
                      >
                        {p.sentiment}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-semibold">{p.longPercent}% Long</span>
                      <span className="text-slate-400">{p.contracts}</span>
                      <span className="text-rose-400 font-semibold">{p.shortPercent}% Short</span>
                    </div>

                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div style={{ width: `${p.longPercent}%` }} className="bg-emerald-500"></div>
                      <div style={{ width: `${p.shortPercent}%` }} className="bg-rose-500"></div>
                    </div>
                  </div>
                ))}
              </div>

              {fiiDiiFlow.insight && (
                <div className="rounded-xl bg-cyan-950/30 p-3 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-start space-x-2">
                  <Zap className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{fiiDiiFlow.insight}</span>
                </div>
              )}
            </div>
          </div>

          {/* Institutional Volume Surge Radar */}
          {volumeSurgeStocks && volumeSurgeStocks.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white">Institutional Volume Surge Radar</h2>
                </div>
                <span className="text-[11px] text-slate-400">Click stock to inspect chart</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {volumeSurgeStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white group-hover:text-cyan-400 transition-colors">
                        {stock.symbol}
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {stock.name} ({stock.sector})
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                      <span className="text-slate-400 font-mono">{formatVolume(stock.volume)}</span>
                      <span className="rounded bg-cyan-950 px-1.5 py-0.2 font-bold text-cyan-400 border border-cyan-800/40 text-[9px]">
                        {stock.actionTag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SECTOR DRILLDOWN (MASTER-DETAIL WORKSPACE) */}
      {activeTab === 'SECTORS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Sectors List (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center">
                  <BarChart3 className="mr-2 h-4 w-4 text-cyan-400" />
                  Sectors List
                </h2>
                <span className="text-[11px] text-slate-400">Click a sector to load stocks</span>
              </div>
            </div>

            {/* Sector search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search sector..."
                value={sectorSearch}
                onChange={(e) => setSectorSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredSectors.map((sec) => {
                const isSelected = sec.name === (currentSector?.name || selectedSectorName);
                return (
                  <div
                    key={sec.name}
                    onClick={() => setSelectedSectorName(sec.name)}
                    className={`rounded-xl p-3 cursor-pointer transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/30 shadow-sm'
                        : 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                          {sec.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                            sec.status === 'BULLISH'
                              ? 'bg-emerald-950 text-emerald-400'
                              : sec.status === 'BEARISH'
                              ? 'bg-rose-950 text-rose-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {sec.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {sec.count} Stocks ({sec.advancingCount || 0} Adv / {sec.decliningCount || 0} Dec)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div
                        className={`font-mono text-xs font-extrabold ${
                          sec.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {sec.avgChange >= 0 ? `+${sec.avgChange}%` : `${sec.avgChange}%`}
                      </div>
                      <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Selected Sector Constituents Table (8 cols) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            {currentSector ? (
              <>
                {/* Sector Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h2 className="text-base font-extrabold text-white">
                        {currentSector.name} Sector Constituents
                      </h2>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          currentSector.avgChange >= 0
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        Avg {currentSector.avgChange >= 0 ? `+${currentSector.avgChange}%` : `${currentSector.avgChange}%`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Displaying {currentSector.stocks?.length || currentSector.count} tracked F&O stocks with real-time Order Block setups.
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    {currentSector.topGainer && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-sans">Top Gainer</span>
                        <span className="text-emerald-400 font-bold">{currentSector.topGainer.symbol} +{currentSector.topGainer.change}%</span>
                      </div>
                    )}
                    {currentSector.topDragger && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-sans">Lagging</span>
                        <span className="text-rose-400 font-bold">{currentSector.topDragger.symbol} {currentSector.topDragger.change}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Constituents Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Stock & Name</th>
                        <th className="py-2.5 px-3">LTP (₹)</th>
                        <th className="py-2.5 px-3">24h Change</th>
                        <th className="py-2.5 px-3">Volume</th>
                        <th className="py-2.5 px-3">SMC Setup / Zone</th>
                        <th className="py-2.5 px-3 text-right">Chart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {(currentSector.stocks || []).map((stock) => (
                        <tr
                          key={stock.symbol}
                          onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                              {stock.symbol}
                            </div>
                            <div className="text-[11px] text-slate-400">{stock.name}</div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-white">
                            {formatCurrency(stock.currentPrice)}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            <span
                              className={`inline-flex items-center ${
                                stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-400">
                            {formatVolume(stock.volume)}
                          </td>
                          <td className="py-3 px-3">
                            {stock.smcBias === 'BULLISH_OB' && (
                              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/50">
                                Bullish OB {stock.obZone ? `(${stock.obZone})` : ''}
                              </span>
                            )}
                            {stock.smcBias === 'BEARISH_OB' && (
                              <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800/50">
                                Bearish OB {stock.obZone ? `(${stock.obZone})` : ''}
                              </span>
                            )}
                            {stock.smcBias === 'BOS_EXPANSION' && (
                              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800/50">
                                BOS Expansion
                              </span>
                            )}
                            {stock.smcBias === 'BEARISH_DISPLACEMENT' && (
                              <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800/50">
                                Displacement
                              </span>
                            )}
                            {stock.smcBias === 'NEUTRAL' && (
                              <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-800">
                                Consolidating
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStock && onSelectStock(stock.symbol);
                              }}
                              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500 hover:text-black transition-colors"
                            >
                              Chart →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                Select a sector from the left list to view constituent stocks.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: FII / DII & PARTICIPANT POSITIONING */}
      {activeTab === 'FII_DII' && (
        <div className="space-y-5">
          {/* FII Net Cash & Long/Short Headline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">FII Net Cash Today</span>
              <div
                className={`text-2xl font-extrabold font-mono ${
                  fiiDiiFlow.fiiNetCash >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {fiiDiiFlow.fiiNetCash >= 0 ? '+' : ''}₹{fiiDiiFlow.fiiNetCash} Crores
              </div>
              <p className="text-[11px] text-slate-400">Provisional cash equity segment net turnover.</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">DII Net Cash Today</span>
              <div className="text-2xl font-extrabold font-mono text-emerald-400">
                +₹{fiiDiiFlow.diiNetCash} Crores
              </div>
              <p className="text-[11px] text-slate-400">Domestic institutional funds accumulation.</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">FII Index Futures Ratio</span>
              <div className="text-2xl font-extrabold font-mono text-cyan-400">
                {fiiDiiFlow.fiiLongRatio}% Long <span className="text-slate-500 text-sm">/ {fiiDiiFlow.fiiShortRatio}% Short</span>
              </div>
              <p className="text-[11px] text-slate-400">Overbought above 75%, oversold below 25%.</p>
            </div>
          </div>

          {/* Participant Breakdown Matrix */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center">
                  <PieChart className="mr-2 h-4 w-4 text-cyan-400" />
                  Participant-Wise Derivatives Open Interest Matrix
                </h2>
                <p className="text-xs text-slate-400">
                  Institutions (FII & Prop Desks) vs Retail (Client) positions across active NSE Index Futures contracts.
                </p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                Exchange Data Feed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(fiiDiiFlow.participantBreakdown || []).map((p) => (
                <div
                  key={p.category}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{p.category}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        p.sentiment.includes('BULLISH') || p.sentiment.includes('ACCUMULATION')
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : p.sentiment.includes('BEARISH') || p.sentiment.includes('TRAPPED')
                          ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                          : 'bg-slate-900 text-slate-300 border border-slate-700/50'
                      }`}
                    >
                      {p.sentiment}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-semibold">{p.longPercent}% Long</span>
                      <span className="text-rose-400 font-semibold">{p.shortPercent}% Short</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        style={{ width: `${p.longPercent}%` }}
                        className="bg-emerald-500 transition-all duration-500"
                      ></div>
                      <div
                        style={{ width: `${p.shortPercent}%` }}
                        className="bg-rose-500 transition-all duration-500"
                      ></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-[11px] text-slate-400">
                    <span>Net Contracts:</span>
                    <span className={`font-mono font-bold ${p.contracts.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {p.contracts}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {fiiDiiFlow.insight && (
              <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4 flex items-start space-x-3 text-xs text-cyan-200">
                <Zap className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-cyan-300 font-semibold">Institutional Trading Desk Observation: </strong>
                  {fiiDiiFlow.insight}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: OPTIONS, STRIKE WALLS & VIX VOLATILITY */}
      {activeTab === 'OPTIONS_VIX' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Volatility Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase text-white flex items-center">
                <Gauge className="mr-2 h-4 w-4 text-cyan-400" />
                India VIX Volatility Bands
              </h3>
              <span className="text-xs font-mono font-bold text-cyan-400">
                VIX: {vixRegime.indiaVix}
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-950/70 p-3.5 border border-slate-800/80 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">NIFTY 50 Expected 1-Day Range:</span>
                  <span className="font-mono font-bold text-white">±{vixRegime.niftyDailyRange.points} pts</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400">Floor: ₹{vixRegime.niftyDailyRange.low}</span>
                  <span className="text-rose-400">Ceiling: ₹{vixRegime.niftyDailyRange.high}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/70 p-3.5 border border-slate-800/80 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">BANKNIFTY Expected 1-Day Range:</span>
                  <span className="font-mono font-bold text-white">±{vixRegime.bankNiftyDailyRange.points} pts</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400">Floor: ₹{vixRegime.bankNiftyDailyRange.low}</span>
                  <span className="text-rose-400">Ceiling: ₹{vixRegime.bankNiftyDailyRange.high}</span>
                </div>
              </div>

              {vixRegime.niftyWeeklyRange && (
                <div className="rounded-xl bg-slate-950/70 p-3.5 border border-slate-800/80 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">NIFTY Weekly Implied Range:</span>
                    <span className="font-mono font-bold text-cyan-300">±{vixRegime.niftyWeeklyRange.points} pts</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400">Floor: ₹{vixRegime.niftyWeeklyRange.low}</span>
                    <span className="text-rose-400">Ceiling: ₹{vixRegime.niftyWeeklyRange.high}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
              <strong className="text-slate-300 font-semibold">Regime Note: </strong>
              {vixRegime.description}
            </div>
          </div>

          {/* Options Strike Walls Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase text-white flex items-center">
                <Target className="mr-2 h-4 w-4 text-cyan-400" />
                Institutional Strike Walls & Max Pain
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400">
                PCR: {optionsMacro.niftyPcr}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Put Wall (Heavy Support Floor)</span>
                  <span className="text-base font-extrabold font-mono text-emerald-400">
                    ₹{optionsMacro.niftyPutWall?.toLocaleString('en-IN')} PE
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                  Highest Put OI
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Call Wall (Overhead Supply Ceiling)</span>
                  <span className="text-base font-extrabold font-mono text-rose-400">
                    ₹{optionsMacro.niftyCallWall?.toLocaleString('en-IN')} CE
                  </span>
                </div>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/50">
                  Highest Call OI
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Nifty Expiry Max Pain Point</span>
                  <span className="text-base font-extrabold font-mono text-cyan-400">
                    ₹{optionsMacro.niftyMaxPain?.toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                  Pinning Target
                </span>
              </div>
            </div>

            {optionsMacro.summary && (
              <div className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <strong className="text-slate-300 font-semibold">Desk Summary: </strong>
                {optionsMacro.summary}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
