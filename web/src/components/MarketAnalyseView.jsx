import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Crosshair,
  Eye,
  Gauge,
  RefreshCw,
  Search,
  Shield,
  Target,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

function biasTone(bias) {
  if (bias === 'UP') return 'emerald';
  if (bias === 'DOWN') return 'rose';
  return 'amber';
}

function BiasBadge({ bias }) {
  const tone = biasTone(bias);
  const map = {
    emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    rose: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
    amber: 'bg-amber-950/80 text-amber-300 border-amber-800/60'
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[tone]}`}>
      {bias || 'RANGE'}
    </span>
  );
}

function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function LevelRow({ label, price, role }) {
  const color =
    role === 'resistance'
      ? 'text-rose-300'
      : role === 'support'
        ? 'text-emerald-300'
        : 'text-cyan-300';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>
      <span className={`font-mono text-sm font-bold ${color}`}>{fmt(price)}</span>
    </div>
  );
}

function InstrumentCard({ data, onOpenChart }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-500">
        Index data unavailable.
      </div>
    );
  }

  const tone = biasTone(data.bias);
  const Icon = data.bias === 'UP' ? TrendingUp : data.bias === 'DOWN' ? TrendingDown : Compass;
  const ring =
    tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'rose'
        ? 'border-rose-500/30 bg-rose-500/5'
        : 'border-amber-500/30 bg-amber-500/5';

  return (
    <div className={`rounded-2xl border ${ring} p-4 sm:p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${tone === 'emerald' ? 'text-emerald-400' : tone === 'rose' ? 'text-rose-400' : 'text-amber-400'}`} />
            <h3 className="text-base font-extrabold text-white tracking-tight">{data.name || data.symbol}</h3>
            <BiasBadge bias={data.bias} />
          </div>
          <p className="mt-1 text-[12px] text-slate-400 leading-relaxed">{data.headline}</p>
        </div>
        {onOpenChart && (
          <button
            type="button"
            onClick={() => onOpenChart(data.symbol)}
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:text-white hover:border-cyan-500/40"
          >
            Chart
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">LTP</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-white">{fmt(data.price)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Change</div>
          <div
            className={`mt-1 font-mono text-lg font-extrabold ${
              Number(data.change) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {Number(data.change) >= 0 ? '+' : ''}
            {fmt(data.change)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Confidence</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-cyan-300">{data.confidence}%</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Day range</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-slate-100">
            {data.rangePositionPct != null ? `${data.rangePositionPct}%` : '—'}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
          Fixed points
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data.fixedPoints || []).map((p) => (
            <LevelRow key={p.id} label={p.label} price={p.price} role={p.role} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 uppercase">
            <ArrowUpRight className="h-3.5 w-3.5" />
            When UP
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">{data.scenarios?.upside?.summary}</p>
        </div>
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300 uppercase">
            <ArrowDownRight className="h-3.5 w-3.5" />
            When DOWN
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">{data.scenarios?.downside?.summary}</p>
        </div>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase">
            <Shield className="h-3.5 w-3.5" />
            Range
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">{data.scenarios?.range?.summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span>
          Structure: <strong className="text-slate-300">{data.structure?.label || '—'}</strong>
        </span>
        <span>
          RSI≈ <strong className="text-slate-300 font-mono">{data.momentum?.rsi ?? '—'}</strong>
        </span>
        <span>
          12-bar move:{' '}
          <strong className="text-slate-300 font-mono">
            {data.momentum?.movePct != null ? `${data.momentum.movePct}%` : '—'}
          </strong>
        </span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH: 'border-cyan-700/60 bg-cyan-950/50 text-cyan-300',
    MEDIUM: 'border-amber-800/50 bg-amber-950/40 text-amber-300',
    LOW: 'border-slate-700 bg-slate-900/60 text-slate-400'
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${map[priority] || map.LOW}`}>
      {priority || 'LOW'}
    </span>
  );
}

function FnoRow({ card, onOpenChart }) {
  const changeUp = Number(card.change) >= 0;
  return (
    <button
      type="button"
      onClick={() => onOpenChart?.(card.symbol)}
      className="w-full text-left grid grid-cols-12 gap-2 items-center rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 hover:border-cyan-500/35 hover:bg-slate-900/70 transition-colors"
    >
      <div className="col-span-12 sm:col-span-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white text-sm truncate">{card.symbol}</span>
          <BiasBadge bias={card.bias} />
          <PriorityBadge priority={card.priority} />
        </div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">
          {card.sector} · {card.name}
        </div>
      </div>
      <div className="col-span-4 sm:col-span-2 font-mono text-sm text-slate-100">{fmt(card.price)}</div>
      <div
        className={`col-span-4 sm:col-span-2 font-mono text-sm font-semibold ${
          changeUp ? 'text-emerald-400' : 'text-rose-400'
        }`}
      >
        {changeUp ? '+' : ''}
        {fmt(card.change)}%
      </div>
      <div className="col-span-4 sm:col-span-2 font-mono text-[12px] text-cyan-300">
        {card.confidence}% · {fmt(card.score, 1)}
      </div>
      <div className="col-span-12 sm:col-span-2 text-[11px] text-slate-400 leading-snug">
        {(card.watchReasons || []).slice(0, 2).join(' · ') || card.action}
      </div>
    </button>
  );
}

export default function MarketAnalyseView({
  report,
  loading = false,
  errorMessage = '',
  onRefresh,
  onSelectStock
}) {
  const [fnoSearch, setFnoSearch] = useState('');
  const [biasFilter, setBiasFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [priorityOnly, setPriorityOnly] = useState(false);

  const fno = report?.fnoUniverse || null;

  const filteredFno = useMemo(() => {
    const list = fno?.all || [];
    const q = fnoSearch.trim().toLowerCase();
    return list.filter((card) => {
      if (biasFilter !== 'ALL' && card.bias !== biasFilter) return false;
      if (sectorFilter !== 'ALL' && card.sector !== sectorFilter) return false;
      if (priorityOnly && card.priority === 'LOW') return false;
      if (!q) return true;
      return (
        card.symbol?.toLowerCase().includes(q) ||
        card.name?.toLowerCase().includes(q) ||
        card.sector?.toLowerCase().includes(q) ||
        (card.watchReasons || []).some((r) => String(r).toLowerCase().includes(q))
      );
    });
  }, [fno, fnoSearch, biasFilter, sectorFilter, priorityOnly]);

  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-12 text-center text-sm text-slate-400">
        Analysing Nifty, BankNifty & F&amp;O universe…
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className={`rounded-2xl border border-dashed p-12 text-center text-sm ${
          errorMessage
            ? 'border-rose-800/70 bg-rose-950/30 text-rose-300'
            : 'border-slate-800 text-slate-500'
        }`}
      >
        {errorMessage || 'No analysis report yet.'}
      </div>
    );
  }

  const tone = biasTone(report.marketBias);
  const BiasIcon =
    report.marketBias === 'UP' ? TrendingUp : report.marketBias === 'DOWN' ? TrendingDown : Gauge;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Market Analyse</h1>
              <BiasBadge bias={report.marketBias} />
              {report.isLive && (
                <span className="rounded-md border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                  Live
                </span>
              )}
              {fno?.total != null && (
                <span className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold text-slate-300 uppercase">
                  {fno.total} F&amp;O
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Index bias + saara F&amp;O scan — search karke dekho kis stock pe focus karna hai.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
            Confidence{' '}
            <span className="ml-1 font-mono font-bold text-cyan-300">{report.confidence}%</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:border-cyan-500/40 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-800/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Verdict strip */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 ${
          tone === 'emerald'
            ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 to-slate-950'
            : tone === 'rose'
              ? 'border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-slate-950'
              : 'border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-slate-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border shrink-0 ${
              tone === 'emerald'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : tone === 'rose'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            <BiasIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Market verdict</div>
            <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-white">{report.verdict}</h2>
            <p className="mt-1 text-[12px] text-slate-400">
              Composite score <span className="font-mono text-slate-200">{report.compositeScore}</span>
              {report.smt ? ` · ${report.smt}` : ''}
            </p>
          </div>
          {report.breadth && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 shrink-0">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Breadth</div>
              <div className="mt-1 font-mono text-sm font-bold text-white">
                <span className="text-emerald-400">{report.breadth.advancing}</span>
                <span className="text-slate-600 mx-1">/</span>
                <span className="text-rose-400">{report.breadth.declining}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                A/D {report.breadth.advanceDeclineRatio} · OB {report.breadth.bullishSetupsCount}/
                {report.breadth.bearishSetupsCount}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report bullets */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Analysis report</h3>
        </div>
        <ul className="space-y-2">
          {(report.summaryBullets || []).map((line, idx) => (
            <li key={idx} className="flex gap-2 text-[13px] text-slate-300 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Playbook */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/15 p-4">
          <div className="text-[11px] font-bold uppercase text-emerald-300 mb-2">Kab market UP?</div>
          <p className="text-[13px] text-slate-300 leading-relaxed">{report.playbook?.whenUp || '—'}</p>
        </div>
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/15 p-4">
          <div className="text-[11px] font-bold uppercase text-rose-300 mb-2">Kab market DOWN?</div>
          <p className="text-[13px] text-slate-300 leading-relaxed">{report.playbook?.whenDown || '—'}</p>
        </div>
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/15 p-4">
          <div className="text-[11px] font-bold uppercase text-amber-300 mb-2">Range / wait</div>
          <p className="text-[13px] text-slate-300 leading-relaxed">{report.playbook?.whenRange || '—'}</p>
        </div>
      </div>

      {/* Watchlist of fixed points */}
      {(report.playbook?.fixedWatch || []).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            Fixed watch levels
          </div>
          <div className="flex flex-wrap gap-2">
            {report.playbook.fixedWatch.map((lvl) => (
              <div
                key={`${lvl.symbol}-${lvl.label}`}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {lvl.symbol} · {lvl.label}
                </div>
                <div className="font-mono text-sm font-bold text-cyan-300">{fmt(lvl.price)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InstrumentCard data={report.instruments?.nifty} onOpenChart={onSelectStock} />
        <InstrumentCard data={report.instruments?.bankNifty} onOpenChart={onSelectStock} />
      </div>

      {/* F&O: kispe dekhna hai + search */}
      {fno && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/20 to-slate-950 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Kispe dekhna hai</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Priority F&amp;O names — bias + structure + momentum se rank.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                <span className="rounded-md border border-emerald-800/50 bg-emerald-950/40 px-2 py-1 text-emerald-300">
                  UP {fno.upCount || 0}
                </span>
                <span className="rounded-md border border-rose-800/50 bg-rose-950/40 px-2 py-1 text-rose-300">
                  DOWN {fno.downCount || 0}
                </span>
                <span className="rounded-md border border-amber-800/50 bg-amber-950/40 px-2 py-1 text-amber-300">
                  RANGE {fno.rangeCount || 0}
                </span>
                <span className="rounded-md border border-cyan-800/50 bg-cyan-950/40 px-2 py-1 text-cyan-300">
                  HIGH {fno.highPriorityCount || 0}
                </span>
              </div>
            </div>

            {(fno.watchNow || []).length === 0 ? (
              <p className="text-xs text-slate-500">Abhi koi high-conviction F&amp;O pick nahi — live candles warm hone do.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {fno.watchNow.map((card) => (
                  <button
                    key={`watch-${card.symbol}`}
                    type="button"
                    onClick={() => onSelectStock?.(card.symbol)}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-white text-sm truncate">{card.symbol}</span>
                        <BiasBadge bias={card.bias} />
                      </div>
                      <PriorityBadge priority={card.priority} />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-base font-bold text-slate-100">{fmt(card.price)}</span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          Number(card.change) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {Number(card.change) >= 0 ? '+' : ''}
                        {fmt(card.change)}%
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                      {(card.watchReasons || []).join(' · ')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                      {card.nearestSupport != null && <span>S {fmt(card.nearestSupport)}</span>}
                      {card.nearestResistance != null && <span>R {fmt(card.nearestResistance)}</span>}
                      {card.rsi != null && <span>RSI {card.rsi}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Saara F&amp;O analyse</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Symbol / name / sector search · bias filter · chart open ke liye tap
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="search"
                    value={fnoSearch}
                    onChange={(e) => setFnoSearch(e.target.value)}
                    placeholder="Search RELIANCE, Banking, OB…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <select
                  value={biasFilter}
                  onChange={(e) => setBiasFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="ALL">All bias</option>
                  <option value="UP">UP only</option>
                  <option value="DOWN">DOWN only</option>
                  <option value="RANGE">RANGE only</option>
                </select>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="ALL">All sectors</option>
                  {(fno.sectors || []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPriorityOnly((v) => !v)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    priorityOnly
                      ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Watch-worthy
                </button>
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <div className="col-span-4">Symbol</div>
              <div className="col-span-2">LTP</div>
              <div className="col-span-2">Change</div>
              <div className="col-span-2">Conf / Score</div>
              <div className="col-span-2">Why watch</div>
            </div>

            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredFno.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-500">
                  Koi match nahi — search / filter clear karke try karo.
                </div>
              ) : (
                filteredFno.map((card) => (
                  <FnoRow key={card.symbol} card={card} onOpenChart={onSelectStock} />
                ))
              )}
            </div>

            <div className="text-[10px] text-slate-500">
              Showing {filteredFno.length} / {fno.total || 0} F&amp;O underlyings
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 text-[11px] text-slate-500">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span>{report.disclaimer}</span>
      </div>
    </div>
  );
}
