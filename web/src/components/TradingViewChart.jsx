import React, { useEffect, useRef } from 'react';

const INDEX_MAP = {
  'NIFTY 50': 'NSE:NIFTY',
  NIFTY: 'NSE:NIFTY',
  BANKNIFTY: 'NSE:BANKNIFTY',
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
  return `NSE:${raw.replace(/\s+/g, '')}`;
}

export function toTradingViewInterval(timeframe) {
  return INTERVAL_MAP[timeframe] || '5';
}

/**
 * Free TradingView Advanced Chart embed (their market data + branding).
 * Used when Kotak Neo candles are unavailable.
 */
export default function TradingViewChart({
  symbol,
  timeframe = '5m',
  className = ''
}) {
  const containerRef = useRef(null);
  const tvSymbol = toTradingViewSymbol(symbol);
  const interval = toTradingViewInterval(timeframe);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    el.innerHTML = '';

    const widgetHost = document.createElement('div');
    widgetHost.className = 'tradingview-widget-container__widget';
    widgetHost.style.height = '100%';
    widgetHost.style.width = '100%';
    el.appendChild(widgetHost);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#090d16',
      gridColor: 'rgba(148, 163, 184, 0.08)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      studies: []
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
  }, [tvSymbol, interval]);

  return (
    <div className={`relative flex h-full w-full min-h-[24rem] flex-col ${className}`}>
      <div
        ref={containerRef}
        className="tradingview-widget-container min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-800/70"
        style={{ height: '100%', width: '100%' }}
        title={tvSymbol}
      />
    </div>
  );
}
