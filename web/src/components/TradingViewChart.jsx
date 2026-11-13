import React, { useId, useMemo, useState, useEffect } from 'react';

const INDEX_MAP = {
  'NIFTY 50': 'NSE:NIFTY',
  NIFTY50: 'NSE:NIFTY',
  NIFTY: 'NSE:NIFTY',
  BANKNIFTY: 'NSE:BANKNIFTY',
  'BANK NIFTY': 'NSE:BANKNIFTY',
  FINNIFTY: 'NSE:FINNIFTY',
  MIDCPNIFTY: 'NSE:MIDCPNIFTY',
  SENSEX: 'BSE:SENSEX'
};

const INTERVAL_MAP = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D'
};

/** Map app symbol → TradingView EXCHANGE:SYMBOL */
export function toTradingViewSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return 'NSE:NIFTY';
  if (INDEX_MAP[raw]) return INDEX_MAP[raw];
  if (raw.includes(':')) return raw;
  // M&M, BAJAJ-AUTO etc. stay as-is for NSE
  return `NSE:${raw.replace(/\s+/g, '')}`;
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
  const interval = toTradingViewInterval(timeframe);
  const isNarrow = useIsNarrow(768);

  const iframeSrc = useMemo(() => {
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
        title={tvSymbol}
      >
        <iframe
          id={frameId}
          key={`${tvSymbol}-${interval}-${isNarrow ? 'm' : 'd'}`}
          title={`TradingView ${tvSymbol}`}
          src={iframeSrc}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
