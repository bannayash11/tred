import React, { useId, useMemo, useState, useEffect } from 'react';

/**
 * Free TradingView embeds block NSE candle data ("This symbol is only available
 * on TradingView") and then fall back to NASDAQ:AAPL. Same Indian tickers work
 * on BSE (EOD). Indices stay NSE-only on TV.com — we don't embed those.
 */
const INDEX_EMBED = {
  SENSEX: 'BSE:SENSEX'
};

const INDEX_EXTERNAL = {
  'NIFTY 50': 'NSE:NIFTY',
  NIFTY50: 'NSE:NIFTY',
  NIFTY: 'NSE:NIFTY',
  BANKNIFTY: 'NSE:BANKNIFTY',
  'BANK NIFTY': 'NSE:BANKNIFTY',
  FINNIFTY: 'NSE:FINNIFTY',
  MIDCPNIFTY: 'NSE:MIDCPNIFTY'
};

const INTERVAL_MAP = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D'
};

/** BSE embed ticker: BAJAJ-AUTO → BAJAJ_AUTO, M&M → M_M, GVT&D → GVT_D */
function toBseTicker(ticker) {
  return String(ticker || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-&]/g, '_');
}

/**
 * Map app symbol → TradingView EXCHANGE:SYMBOL for the free embed.
 * Equities use BSE (NSE is blocked in widgets). Returns '' when embed can't show it.
 */
export function toTradingViewSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return 'BSE:SENSEX';

  if (INDEX_EMBED[raw]) return INDEX_EMBED[raw];
  if (INDEX_EXTERNAL[raw]) return ''; // blocked in free embeds

  if (raw.includes(':')) {
    const colon = raw.indexOf(':');
    const ex = raw.slice(0, colon);
    const ticker = raw.slice(colon + 1);
    if (INDEX_EMBED[ticker]) return INDEX_EMBED[ticker];
    if (INDEX_EXTERNAL[ticker]) return '';
    if (ex === 'NSE' || ex === 'BSE') return `BSE:${toBseTicker(ticker)}`;
    return raw;
  }

  return `BSE:${toBseTicker(raw)}`;
}

/** Symbol to open on tradingview.com when the embed can't show it */
export function toTradingViewExternalSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return 'NSE:NIFTY';
  if (INDEX_EXTERNAL[raw]) return INDEX_EXTERNAL[raw];
  if (INDEX_EMBED[raw]) return INDEX_EMBED[raw];
  if (raw.includes(':')) return raw;
  return `NSE:${raw.replace(/\s+/g, '')}`;
}

export function tradingViewSymbolUrl(tvSymbol) {
  if (!tvSymbol) return 'https://www.tradingview.com/';
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
}

export function toTradingViewInterval(timeframe) {
  return INTERVAL_MAP[timeframe] || '5';
}

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return narrow;
}

/**
 * Free TradingView Advanced Chart embed (their market data + branding).
 * Uses the widget iframe URL directly so the symbol is never lost (script embeds
 * often fall back to NASDAQ:AAPL when React remounts / async config fails).
 */
export default function TradingViewChart({
  symbol,
  timeframe = '5m',
  className = ''
}) {
  const reactId = useId();
  const frameId = useMemo(
    () => `tv_${String(reactId).replace(/:/g, '')}`,
    [reactId]
  );
  const tvSymbol = toTradingViewSymbol(symbol);
  const externalSymbol = toTradingViewExternalSymbol(symbol);
  const interval = toTradingViewInterval(timeframe);
  const isNarrow = useIsNarrow(768);

  const iframeSrc = useMemo(() => {
    if (!tvSymbol) return '';
    const config = {
      autosize: true,
      width: '100%',
      height: '100%',
      symbol: tvSymbol,
      interval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#090d16',
      gridColor: 'rgba(148, 163, 184, 0.08)',
      hide_top_toolbar: false,
      hide_side_toolbar: isNarrow,
      hide_legend: isNarrow,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      withdateranges: !isNarrow,
      support_host: 'https://www.tradingview.com',
      studies: [],
      isTransparent: false,
      // Helps TradingView bind this frame (same as their embed script)
      frameElementId: frameId
    };
    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(
      JSON.stringify(config)
    )}`;
  }, [tvSymbol, interval, isNarrow, frameId]);

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        height: isNarrow ? 'min(68dvh, 560px)' : '100%',
        minHeight: isNarrow ? 320 : 480
      }}
    >
      <div
        className="tradingview-widget-container absolute inset-0 overflow-hidden rounded-lg border border-slate-800/70"
        style={{ width: '100%', height: '100%' }}
        title={tvSymbol || externalSymbol}
      >
        {tvSymbol && iframeSrc ? (
          <iframe
            id={frameId}
            key={`${tvSymbol}-${interval}-${isNarrow ? 'm' : 'd'}`}
            title={`TradingView ${tvSymbol}`}
            src={iframeSrc}
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            allow="fullscreen"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#090d16] px-6 text-center">
            <p className="text-sm font-semibold text-slate-200">
              {externalSymbol} isn’t available in the free TradingView embed
            </p>
            <p className="max-w-md text-[12px] leading-relaxed text-slate-400">
              NSE indices can’t be charted in the widget (it would fall back to Apple). Use{' '}
              <span className="text-cyan-300">Manual</span> for live Kotak candles, or open the
              full chart on TradingView.
            </p>
            <a
              href={tradingViewSymbolUrl(externalSymbol)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-amber-400"
            >
              Open {externalSymbol} on TradingView
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
