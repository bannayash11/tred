import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  LineChart,
  Layers,
  ArrowLeft,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Filter,
  List as ListIcon,
  LayoutGrid,
  Check,
  Minus,
  ExternalLink,
  Zap,
  Activity,
  BarChart3,
} from 'lucide-react';
import { SymbolMark } from '@/components/common/SymbolMark';
import { fmtPrice } from '@/utils/formatters';
import { expiryDisplay } from '@/components/common/expiryDisplay';
import {
  BuildMark,
  buildUpText,
  ChangeText,
  DotMeter,
  heatStyle,
  pctText,
  TickFlash,
  signedText,
  Spark,
  toneOf,
  shortSector,
} from './FlowParts';
import {
  clockOf,
  compactUnits,
  levelText,
  type FlowLevel,
  type FlowStock,
  type FlowSector,
  type FlowSettings,
  type MarketFlow,
} from './marketFlowModel';
import type { FlowUniverse } from './nifty50';
import { ThemeToggle } from '@/components/chrome/ThemeToggle';
import { applyTheme } from '@/lib/applyTheme';
import { FlowChart } from './FlowChart';
import { MiniChart } from './FlowPopup';
import { FlowSpread } from './FlowSectors';
import { useBox } from './useBox';
import type { Underlying } from '@/lib/underlyings';

export type MobileTab = 'bullish' | 'bearish' | 'chart' | 'sectors';
type ViewMode = 'list' | 'grid';

interface FlowMobileViewProps {
  flow: MarketFlow | null;
  universe: Underlying[];
  scope: FlowUniverse;
  setScope: (scope: FlowUniverse) => void;
  loading: boolean;
  error?: string | null;
  provider?: { id: string; label: string; alwaysLive: boolean } | null;
  market?: { at: number } | null;
  futuresRead: number;
  futuresTotal: number;
  onRescan: () => void;
  settings: Pick<FlowSettings, 'named' | 'lines'>;
}

const UNIVERSES: Array<{ value: FlowUniverse; label: string }> = [
  { value: 'nifty50', label: 'Nifty 50' },
  { value: 'fno', label: 'All F&O' },
];

export function FlowMobileView({
  flow,
  scope,
  setScope,
  loading,
  error,
  provider,
  market,
  futuresRead,
  futuresTotal,
  onRescan,
  settings,
}: FlowMobileViewProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('bullish');
  const [searchQuery, setSearchQuery] = useState('');
  const [buildFilter, setBuildFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const updating = flow ? futuresRead < futuresTotal || flow.provisional : loading;

  // Selected stock object for the detail sheet
  const selectedStock = useMemo(() => {
    if (!selectedSymbol || !flow) return null;
    return flow.stocks.find(s => s.symbol === selectedSymbol) ?? null;
  }, [selectedSymbol, flow]);

  // Filtered stocks for Bullish / Bearish tabs
  const currentSideStocks = useMemo(() => {
    if (!flow) return [];
    if (activeTab === 'bullish') return flow.bullish;
    if (activeTab === 'bearish') return flow.bearish;
    return [];
  }, [flow, activeTab]);

  const filteredStocks = useMemo(() => {
    let list = [...currentSideStocks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        s =>
          s.symbol.toLowerCase().includes(q) ||
          s.name?.toLowerCase().includes(q) ||
          s.sectorLabel?.toLowerCase().includes(q)
      );
    }

    if (selectedSector) {
      list = list.filter(s => s.sector === selectedSector || s.sectorLabel === selectedSector);
    }

    if (buildFilter !== 'ALL') {
      if (buildFilter === 'TOP10') {
        list = list.slice(0, 10);
      } else if (buildFilter === 'LONG_BUILD') {
        list = list.filter(s => s.buildUp === 'LONG_BUILD');
      } else if (buildFilter === 'SHORT_COVER') {
        list = list.filter(s => s.buildUp === 'SHORT_COVER');
      } else if (buildFilter === 'SHORT_BUILD') {
        list = list.filter(s => s.buildUp === 'SHORT_BUILD');
      } else if (buildFilter === 'LONG_UNWIND') {
        list = list.filter(s => s.buildUp === 'LONG_UNWIND');
      }
    }

    return list;
  }, [currentSideStocks, searchQuery, selectedSector, buildFilter]);

  // Market Breadth counts
  const bullishCount = flow?.bullish.length ?? 0;
  const bearishCount = flow?.bearish.length ?? 0;
  const flatCount = flow?.rangebound.length ?? 0;
  const totalCount = bullishCount + bearishCount + flatCount || 1;

  // Bullish vs Bearish bias label
  const marketBias = useMemo(() => {
    if (!flow) return 'Loading...';
    if (bullishCount > bearishCount * 1.5) return 'Strong Bullish Bias';
    if (bullishCount > bearishCount * 1.1) return 'Bullish Leaning';
    if (bearishCount > bullishCount * 1.5) return 'Strong Bearish Bias';
    if (bearishCount > bullishCount * 1.1) return 'Bearish Leaning';
    return 'Balanced Flow';
  }, [flow, bullishCount, bearishCount]);

  // Stepper in bottom sheet
  const handleStepStock = (direction: 'next' | 'prev') => {
    if (!selectedStock) return;
    const list = filteredStocks.length > 0 ? filteredStocks : currentSideStocks;
    const idx = list.findIndex(s => s.symbol === selectedStock.symbol);
    if (idx < 0) return;
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      setSelectedSymbol(list[targetIdx].symbol);
    }
  };

  return (
    <div className="mf-mobile-root min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 pb-20">
      {/* ── App Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0a0f1d]/95 backdrop-blur-md border-b border-slate-800/80 px-3 pt-2 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Back button */}
          <Link
            to="/terminal"
            className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all"
            aria-label="Back to Terminal"
          >
            <ChevronLeft size={18} />
          </Link>

          {/* Title & Live Status */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight leading-none truncate">
              Order Flow
            </h1>
            {updating ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Updating
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>

          {/* Universe Capsule */}
          <div className="flex items-center bg-slate-800/90 rounded-full p-0.5 border border-slate-700/70 text-[11px] font-medium">
            {UNIVERSES.map(u => (
              <button
                key={u.value}
                type="button"
                onClick={() => setScope(u.value)}
                className={`px-2.5 py-1 rounded-full transition-all leading-none ${
                  scope === u.value
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={onRescan}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all disabled:opacity-50"
            title="Refresh Order Flow"
            aria-label="Refresh Order Flow"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>

          {/* Theme Toggle */}
          <ThemeToggle onChange={t => applyTheme(t)} size="sm" />
        </div>
      </header>

      {/* ── Market Breadth Pulse Bar ─────────────────────────── */}
      <section className="px-3 pt-2.5 pb-1">
        <div className="bg-[#0f172a]/90 rounded-2xl p-3 border border-slate-800/80 shadow-sm">
          {/* Top Line: Bias & Timestamp */}
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity size={14} className="text-emerald-400" />
              {marketBias}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {market?.at ? clockOf(market.at) : 'Active Session'}
            </span>
          </div>

          {/* Proportional Advance / Decline Bar */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex mb-2.5">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(bullishCount / totalCount) * 100}%` }}
              title={`Bullish: ${bullishCount}`}
            />
            <div
              className="bg-slate-600 transition-all duration-500"
              style={{ width: `${(flatCount / totalCount) * 100}%` }}
              title={`Flat: ${flatCount}`}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${(bearishCount / totalCount) * 100}%` }}
              title={`Bearish: ${bearishCount}`}
            />
          </div>

          {/* Clickable Quick Summary Chips */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('bullish')}
              className={`p-1.5 rounded-xl border transition-all ${
                activeTab === 'bullish'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800/50 border-slate-700/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/90 flex items-center justify-center gap-1">
                <TrendingUp size={11} /> Bullish
              </div>
              <div className="text-base font-extrabold font-mono text-emerald-400 mt-0.5">
                {bullishCount}
              </div>
            </button>

            <div className="p-1.5 rounded-xl border bg-slate-800/30 border-slate-700/30 text-slate-400">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <Minus size={11} /> Rangebound
              </div>
              <div className="text-base font-extrabold font-mono text-slate-300 mt-0.5">
                {flatCount}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('bearish')}
              className={`p-1.5 rounded-xl border transition-all ${
                activeTab === 'bearish'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'bg-slate-800/50 border-slate-700/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400/90 flex items-center justify-center gap-1">
                <TrendingDown size={11} /> Bearish
              </div>
              <div className="text-base font-extrabold font-mono text-rose-400 mt-0.5">
                {bearishCount}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ── Main Tab Contents ─────────────────────────────────── */}
      <main className="flex-1 px-3 pt-2">
        {/* Loading / Error States */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-3 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={onRescan}
              className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {!flow && loading && (
          <div className="space-y-3 py-4">
            <div className="h-10 bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-800/40 rounded-2xl animate-pulse" />
            <div className="h-20 bg-slate-800/40 rounded-2xl animate-pulse" />
            <div className="h-20 bg-slate-800/40 rounded-2xl animate-pulse" />
          </div>
        )}

        {/* ── TAB 1 & 2: Bullish & Bearish Lists ───────────────── */}
        {(activeTab === 'bullish' || activeTab === 'bearish') && flow && (
          <div className="space-y-2.5">
            {/* Search & Filter Toolbar */}
            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="flex-1 relative flex items-center">
                <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'bullish' ? 'Bullish' : 'Bearish'} stocks...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* View Mode Switcher (List vs Grid) */}
              <div className="flex items-center bg-[#0f172a] rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-slate-700/80 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="List View"
                >
                  <ListIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-slate-700/80 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>

            {/* Filter Pills Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setBuildFilter('ALL')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                  buildFilter === 'ALL'
                    ? activeTab === 'bullish'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-rose-500 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                }`}
              >
                All ({currentSideStocks.length})
              </button>

              {activeTab === 'bullish' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setBuildFilter('LONG_BUILD')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      buildFilter === 'LONG_BUILD'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Long Build-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildFilter('SHORT_COVER')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      buildFilter === 'SHORT_COVER'
                        ? 'bg-teal-400 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    Short Covering
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setBuildFilter('SHORT_BUILD')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      buildFilter === 'SHORT_BUILD'
                        ? 'bg-rose-500 text-white font-bold'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Short Build-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildFilter('LONG_UNWIND')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      buildFilter === 'LONG_UNWIND'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Long Unwinding
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setBuildFilter('TOP10')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                  buildFilter === 'TOP10'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                }`}
              >
                Top 10 Movers
              </button>

              {selectedSector && (
                <button
                  type="button"
                  onClick={() => setSelectedSector(null)}
                  className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium flex items-center gap-1"
                >
                  <span>Sector: {selectedSector}</span>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Featured Leaders Carousel (Strongest readings) */}
            {!searchQuery && !selectedSector && buildFilter === 'ALL' && flow.featured[activeTab].length > 0 && (
              <div className="py-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Zap size={12} className={activeTab === 'bullish' ? 'text-emerald-400' : 'text-rose-400'} />
                  Top Conviction Leaders
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {flow.featured[activeTab].slice(0, 2).map(stock => (
                    <FeaturedCard
                      key={stock.symbol}
                      stock={stock}
                      side={activeTab}
                      onClick={() => setSelectedSymbol(stock.symbol)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stock Count Subheader */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <span>
                Showing <b className="text-white font-mono">{filteredStocks.length}</b>{' '}
                {activeTab === 'bullish' ? 'bullish' : 'bearish'} underlyings
              </span>
              <span>Sorted by Move Size</span>
            </div>

            {/* Stock List / Grid Content */}
            {filteredStocks.length === 0 ? (
              <div className="p-8 text-center bg-[#0f172a]/50 rounded-2xl border border-slate-800/60 text-slate-400 text-sm">
                No stocks match your filter criteria.
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1.5">
                {filteredStocks.map(stock => (
                  <StockRowItem
                    key={stock.symbol}
                    stock={stock}
                    side={activeTab}
                    onClick={() => setSelectedSymbol(stock.symbol)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredStocks.map(stock => (
                  <StockGridCard
                    key={stock.symbol}
                    stock={stock}
                    side={activeTab}
                    onClick={() => setSelectedSymbol(stock.symbol)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Mobile Flow Chart ─────────────────────────── */}
        {activeTab === 'chart' && flow && (
          <MobileChartTab
            flow={flow}
            settings={settings}
            onSelectStock={sym => setSelectedSymbol(sym)}
          />
        )}

        {/* ── TAB 4: Sectors Rotation ──────────────────────────── */}
        {activeTab === 'sectors' && flow && (
          <MobileSectorsTab
            flow={flow}
            onSelectSector={secId => {
              setSelectedSector(secId);
              setActiveTab('bullish');
            }}
          />
        )}
      </main>

      {/* ── Fixed Native App Bottom Navigation Bar ────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0f1d]/95 backdrop-blur-xl border-t border-slate-800/90 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]"
        role="navigation"
        aria-label="Order Flow Navigation"
      >
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {/* Bullish Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('bullish')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
              activeTab === 'bullish'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <TrendingUp size={18} strokeWidth={activeTab === 'bullish' ? 2.5 : 2} />
              {bullishCount > 0 && (
                <span className="absolute -top-1 -right-3 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 leading-none">
                  {bullishCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight mt-1">Bullish</span>
          </button>

          {/* Bearish Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('bearish')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
              activeTab === 'bearish'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <TrendingDown size={18} strokeWidth={activeTab === 'bearish' ? 2.5 : 2} />
              {bearishCount > 0 && (
                <span className="absolute -top-1 -right-3 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-rose-500 text-white leading-none">
                  {bearishCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight mt-1">Bearish</span>
          </button>

          {/* Chart Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'chart'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart size={18} strokeWidth={activeTab === 'chart' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold tracking-tight mt-1">Flow Chart</span>
          </button>

          {/* Sectors Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('sectors')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'sectors'
                ? 'text-amber-400 bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={18} strokeWidth={activeTab === 'sectors' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold tracking-tight mt-1">Sectors</span>
          </button>
        </div>
      </nav>

      {/* ── Native Mobile Detail Bottom Sheet Modal ────────────── */}
      {selectedStock && flow && (
        <FlowMobileDetailSheet
          stock={selectedStock}
          flow={flow}
          onClose={() => setSelectedSymbol(null)}
          onStep={handleStepStock}
          hasPrev={
            filteredStocks.findIndex(s => s.symbol === selectedStock.symbol) > 0
          }
          hasNext={
            filteredStocks.findIndex(s => s.symbol === selectedStock.symbol) <
            filteredStocks.length - 1
          }
          currentIndex={
            filteredStocks.findIndex(s => s.symbol === selectedStock.symbol) + 1
          }
          totalCount={filteredStocks.length}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stock Row Item (Mobile Watchlist App List View)
// ─────────────────────────────────────────────────────────────
const StockRowItem = memo(function StockRowItem({
  stock,
  side,
  onClick,
}: {
  stock: FlowStock;
  side: 'bullish' | 'bearish';
  onClick: () => void;
}) {
  const isUp = (stock.changePct ?? 0) >= 0;
  const price = stock.fut?.price ?? stock.spot;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className="p-3 rounded-2xl bg-[#0f172a]/70 border border-slate-800/80 active:bg-slate-800/90 active:scale-[0.99] transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-sm"
    >
      {/* Left: Rank, Logo, Ticker, Sector */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[11px] font-mono text-slate-500 font-bold w-4 text-center shrink-0">
          {stock.rank ?? '-'}
        </span>
        <SymbolMark symbol={stock.symbol} kind={stock.kind} size={28} showTitle={false} />
        <div className="min-w-0">
          <div className="text-xs font-bold text-white font-mono tracking-tight leading-snug flex items-center gap-1.5 truncate">
            <span>{stock.symbol}</span>
            <BuildMark stock={stock} />
          </div>
          <div className="text-[11px] text-slate-400 truncate max-w-[110px] leading-tight">
            {stock.sectorLabel || stock.name}
          </div>
        </div>
      </div>

      {/* Middle: Sparkline & Build-up Pill */}
      <div className="flex flex-col items-center justify-center shrink-0 px-1">
        <Spark stock={stock} width={52} height={18} />
        <span
          className={`text-[9px] font-semibold mt-1 px-1.5 py-0.2 rounded-full border leading-tight ${
            stock.buildUp === 'LONG_BUILD'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : stock.buildUp === 'SHORT_COVER'
              ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
              : stock.buildUp === 'SHORT_BUILD'
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}
        >
          {buildUpText(stock)}
        </span>
      </div>

      {/* Right: Price & % Change Badge */}
      <div className="text-right shrink-0">
        <div className="text-xs font-bold font-mono text-slate-200">
          ₹{fmtPrice(price)}
        </div>
        <div
          className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
            isUp
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
        >
          {pctText(stock.changePct)}
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          OI {signedText(stock.oiChangePct, 1)}%
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Stock Grid Card (Mobile 2-Column Grid View)
// ─────────────────────────────────────────────────────────────
const StockGridCard = memo(function StockGridCard({
  stock,
  side,
  onClick,
}: {
  stock: FlowStock;
  side: 'bullish' | 'bearish';
  onClick: () => void;
}) {
  const isUp = (stock.changePct ?? 0) >= 0;
  const price = stock.fut?.price ?? stock.spot;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className="p-3 rounded-2xl bg-[#0f172a]/70 border border-slate-800/80 active:bg-slate-800/90 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <SymbolMark symbol={stock.symbol} kind={stock.kind} size={22} showTitle={false} />
          <span className="text-xs font-bold font-mono text-white truncate">
            {stock.symbol}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 font-bold">
          #{stock.rank}
        </span>
      </div>

      <div className="my-1.5 flex items-center justify-center">
        <Spark stock={stock} width={100} height={24} />
      </div>

      <div className="mt-1 pt-1.5 border-t border-slate-800/60 flex items-end justify-between">
        <div>
          <div className="text-xs font-mono font-bold text-slate-200">
            ₹{fmtPrice(price)}
          </div>
          <div className="text-[9px] text-slate-400 truncate max-w-[80px]">
            {buildUpText(stock)}
          </div>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
            isUp ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {pctText(stock.changePct)}
        </span>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Featured Card (Top Movers Spotlight)
// ─────────────────────────────────────────────────────────────
const FeaturedCard = memo(function FeaturedCard({
  stock,
  side,
  onClick,
}: {
  stock: FlowStock;
  side: 'bullish' | 'bearish';
  onClick: () => void;
}) {
  const isUp = side === 'bullish';
  const price = stock.fut?.price ?? stock.spot;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
        isUp
          ? 'bg-gradient-to-b from-emerald-950/30 to-[#0f172a] border-emerald-500/30 hover:border-emerald-500/50'
          : 'bg-gradient-to-b from-rose-950/30 to-[#0f172a] border-rose-500/30 hover:border-rose-500/50'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <SymbolMark symbol={stock.symbol} kind={stock.kind} size={24} showTitle={false} />
          <span className="text-xs font-bold font-mono text-white truncate">
            {stock.symbol}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
            isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {pctText(stock.changePct)}
        </span>
      </div>

      <div className="text-sm font-extrabold font-mono text-slate-100 my-1">
        ₹{fmtPrice(price)}
      </div>

      <div className="my-1.5">
        <Spark stock={stock} width={120} height={24} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
        <span>{buildUpText(stock)}</span>
        <span>{stock.checks.length ? <DotMeter checks={stock.checks} /> : null}</span>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Mobile Detail Bottom Sheet Modal
// ─────────────────────────────────────────────────────────────
function FlowMobileDetailSheet({
  stock,
  flow,
  onClose,
  onStep,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}: {
  stock: FlowStock;
  flow: MarketFlow;
  onClose: () => void;
  onStep: (dir: 'next' | 'prev') => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
}) {
  const navigate = useNavigate();
  const price = stock.fut?.price ?? stock.spot;
  const isUp = (stock.changePct ?? 0) >= 0;

  // Lock body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        className="relative w-full max-h-[88vh] bg-[#0c1322] border-t border-slate-700/80 rounded-t-3xl shadow-2xl z-10 flex flex-col overflow-hidden pb-[max(20px,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-label={`${stock.symbol} detail sheet`}
      >
        {/* Drag Handle & Top Controls */}
        <div className="pt-2.5 pb-2 px-4 flex items-center justify-between border-b border-slate-800/60 shrink-0">
          {/* Stepper Navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => onStep('prev')}
              className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Previous stock"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1.5">
              {currentIndex} of {totalCount}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onStep('next')}
              className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Next stock"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Drag pill in center */}
          <div className="w-10 h-1 rounded-full bg-slate-600/80" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white"
            title="Close Sheet"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
          {/* Stock Header Banner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SymbolMark symbol={stock.symbol} kind={stock.kind} size={40} showTitle={false} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold font-mono text-white leading-none">
                    {stock.symbol}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isUp
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {stock.side === 'bullish' ? 'BULLISH' : 'BEARISH'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {stock.name} · {stock.sectorLabel || 'Index'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-base font-extrabold font-mono text-white">
                ₹{fmtPrice(price)}
              </div>
              <div
                className={`text-xs font-bold font-mono ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {pctText(stock.changePct)}{' '}
                {stock.fut && (
                  <span className="text-[11px] opacity-80">
                    ({signedText(stock.fut.priceChange)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mini Candlestick Chart */}
          <div className="bg-[#080d1a] rounded-2xl p-2 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-2 pt-1 pb-2 flex items-center justify-between">
              <span>Day Window Candles</span>
              <span>Levels from {expiryDisplay(stock.expiry).label}</span>
            </div>
            <div className="h-44 w-full">
              <MiniChart stock={stock} window={flow.window} />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Rank & Move
              </div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">
                #{stock.rank ?? '-'}{' '}
                <small className="text-slate-400 font-sans font-normal">
                  ({pctText(stock.changePct)})
                </small>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Build-Up State
              </div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {buildUpText(stock)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Conviction Score
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {stock.checks.length ? <DotMeter checks={stock.checks} count /> : '—'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Open Interest (OI)
              </div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">
                {signedText(stock.oiChangePct, 1)}%{' '}
                {stock.fut && (
                  <small className="text-slate-400 font-normal">
                    ({compactUnits(stock.fut.oi)})
                  </small>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Key Support
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {stock.support ? `S1 ${levelText(stock.support.strike)}` : 'None'}
                {stock.support2 && (
                  <span className="text-slate-400 font-normal">
                    {' '}· S2 {levelText(stock.support2.strike)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Key Resistance
              </div>
              <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">
                {stock.resistance ? `R1 ${levelText(stock.resistance.strike)}` : 'None'}
                {stock.resistance2 && (
                  <span className="text-slate-400 font-normal">
                    {' '}· R2 {levelText(stock.resistance2.strike)}
                  </span>
                )}
              </div>
            </div>

            {stock.zone && (
              <div className="col-span-2 p-2.5 rounded-xl bg-[#0f172a] border border-slate-800">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  Consolidation Zone
                </div>
                <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                  ₹{fmtPrice(stock.zone.low)} – ₹{fmtPrice(stock.zone.high)}{' '}
                  <span className="text-slate-400 font-sans font-normal">
                    ({clockOf(stock.zone.from)} – {clockOf(stock.zone.to)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Conviction Reasoning Checks */}
          {stock.checks.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#0f172a] border border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Why It Ranks Here
              </h3>
              <ul className="space-y-1.5 text-xs">
                {stock.checks.map(check => (
                  <li
                    key={check.id}
                    className="flex items-start gap-2 py-0.5 text-slate-300"
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                        check.pass == null
                          ? 'bg-slate-800 text-slate-500'
                          : check.pass
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {check.pass == null ? (
                        <Minus size={10} />
                      ) : check.pass ? (
                        <Check size={10} />
                      ) : (
                        <X size={10} />
                      )}
                    </span>
                    <div>
                      <b className="font-semibold text-white">{check.label}</b>
                      {check.note && (
                        <span className="text-[11px] text-slate-400 ml-1.5 font-mono">
                          {check.note}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action: Open Chart in Terminal */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate(`/chart/${stock.symbol}`)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-[0.99] transition-all"
            >
              <span>Open {stock.symbol} Full Chart</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile Flow Chart Tab
// ─────────────────────────────────────────────────────────────
function MobileChartTab({
  flow,
  settings,
  onSelectStock,
}: {
  flow: MarketFlow;
  settings: Pick<FlowSettings, 'named' | 'lines'>;
  onSelectStock: (sym: string) => void;
}) {
  const [chartRef, chartBox] = useBox<HTMLDivElement>();
  const chartW = chartBox.width || 340;

  return (
    <div className="space-y-3">
      {/* Chart Card */}
      <div className="p-3 rounded-2xl bg-[#0f172a] border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Market Flow Fan
            </h2>
            <p className="text-[11px] text-slate-400">
              Through the day from 09:15 IST
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {flow.stocks.length} Underlyings
          </span>
        </div>

        {/* SVG Flow Chart */}
        <div ref={chartRef} className="w-full h-[340px] overflow-hidden relative">
          {chartW > 0 ? (
            <FlowChart
              key={flow.window}
              flow={flow}
              settings={settings}
              width={chartW}
              height={340}
              headH={0}
            />
          ) : (
            <div className="w-full h-full bg-slate-800/40 rounded-xl animate-pulse" />
          )}
        </div>
      </div>

      {/* Top Gainers & Losers Chips */}
      <div className="p-3 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Top Movers On Chart
        </div>
        <div className="flex flex-wrap gap-1.5">
          {flow.bullish.slice(0, 5).map(s => (
            <button
              key={s.symbol}
              type="button"
              onClick={() => onSelectStock(s.symbol)}
              className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1 active:scale-95 transition-all"
            >
              <span>{s.symbol}</span>
              <span className="text-[10px]">{pctText(s.changePct)}</span>
            </button>
          ))}
          {flow.bearish.slice(0, 5).map(s => (
            <button
              key={s.symbol}
              type="button"
              onClick={() => onSelectStock(s.symbol)}
              className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold flex items-center gap-1 active:scale-95 transition-all"
            >
              <span>{s.symbol}</span>
              <span className="text-[10px]">{pctText(s.changePct)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Spread Histogram */}
      <div className="p-3 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Market Return Distribution
        </div>
        <div className="py-2 flex justify-center">
          <FlowSpread flow={flow} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile Sectors Tab
// ─────────────────────────────────────────────────────────────
function MobileSectorsTab({
  flow,
  onSelectSector,
}: {
  flow: MarketFlow;
  onSelectSector: (secId: string) => void;
}) {
  const measured = useMemo(() => {
    return flow.sectors
      .filter(s => s.changePct != null)
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  }, [flow.sectors]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Sector Rotation
        </h2>
        <span className="text-[11px] text-slate-400">
          Ranked by Median Move
        </span>
      </div>

      <div className="space-y-1.5">
        {measured.map(sector => {
          const pct = sector.changePct ?? 0;
          const isUp = pct >= 0;
          const total = sector.count || 1;

          return (
            <div
              key={sector.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSector(sector.label)}
              className="p-3 rounded-2xl bg-[#0f172a]/80 border border-slate-800/80 active:bg-slate-800/90 active:scale-[0.99] transition-all cursor-pointer flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    {sector.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {sector.bullish} Up · {sector.bearish} Down · {sector.rangebound} Flat
                  </div>
                </div>

                <div
                  className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                    isUp
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {pctText(sector.changePct)}
                </div>
              </div>

              {/* Progress Mini Bar */}
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(sector.bullish / total) * 100}%` }}
                />
                <div
                  className="bg-slate-600"
                  style={{ width: `${(sector.rangebound / total) * 100}%` }}
                />
                <div
                  className="bg-rose-500"
                  style={{ width: `${(sector.bearish / total) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

