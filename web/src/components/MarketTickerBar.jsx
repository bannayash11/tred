import React from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

export default function MarketTickerBar({
  niftyData,
  bankNiftyData,
  stocks = [],
  onSelectStock
}) {
  const filteredStocks = (stocks || []).filter(
    (s) => s.symbol !== 'NIFTY 50' && s.symbol !== 'BANKNIFTY'
  );

  const baseItems = [];
  if (niftyData?.currentPrice != null) {
    baseItems.push({
      symbol: 'NIFTY 50',
      name: 'Nifty 50',
      currentPrice: niftyData.currentPrice,
      change: niftyData.change ?? 0,
      isIndex: true
    });
  }
  if (bankNiftyData?.currentPrice != null) {
    baseItems.push({
      symbol: 'BANKNIFTY',
      name: 'Bank Nifty',
      currentPrice: bankNiftyData.currentPrice,
      change: bankNiftyData.change ?? 0,
      isIndex: true
    });
  }
  baseItems.push(...filteredStocks);

  if (baseItems.length === 0) {
    return (
      <div className="w-full bg-[#070b16] border-b border-slate-800/80 flex items-center h-9 sm:h-10 z-30 px-4 text-[11px] text-slate-500">
        Waiting for live market ticks…
      </div>
    );
  }

  // Duplicate for seamless infinite loop marquee
  const tickerItems = [...baseItems, ...baseItems];

  const formatPrice = (price) => {
    if (price === undefined || price === null) return '₹0.00';
    return `₹${Number(price).toLocaleString('en-IN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="w-full bg-[#070b16] border-b border-slate-800/80 overflow-hidden relative flex items-center h-9 sm:h-10 z-30 select-none">
      {/* Left Stationary "LIVE TICKER" Badge */}
      <div className="flex items-center space-x-1.5 px-3 sm:px-4 h-full bg-[#080d1a] border-r border-slate-800 shrink-0 z-20 shadow-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] sm:text-[11px] font-extrabold text-white tracking-wider uppercase font-mono">
          LIVE <span className="text-cyan-400">TICKER</span>
        </span>
      </div>

      {/* Gradient Edge Masks */}
      <div className="pointer-events-none absolute left-24 sm:left-28 top-0 bottom-0 w-6 bg-gradient-to-r from-[#070b16] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#070b16] to-transparent z-10" />

      {/* Marquee Track */}
      <div className="overflow-hidden w-full flex items-center">
        <div className="animate-ticker-marquee flex items-center gap-2 sm:gap-3 px-2">
          {tickerItems.map((item, idx) => {
            const isPositive = Number(item.change) >= 0;
            return (
              <div
                key={`${item.symbol}-${idx}`}
                onClick={() => {
                  if (item.isIndex) {
                    if (onSelectStock) onSelectStock(item.symbol === 'NIFTY 50' ? 'NIFTY 50' : 'BANKNIFTY');
                  } else if (onSelectStock) {
                    onSelectStock(item.symbol);
                  }
                }}
                className={`flex items-center space-x-2 rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer shrink-0 border ${
                  item.isIndex
                    ? 'bg-slate-900/90 border-cyan-800/50 hover:border-cyan-400 shadow-sm'
                    : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-600 hover:bg-slate-900'
                }`}
                title={`Click to view ${item.name || item.symbol} chart`}
              >
                <span
                  className={`font-extrabold tracking-tight text-[11px] sm:text-xs ${
                    item.isIndex ? 'text-cyan-300 font-mono' : 'text-slate-200'
                  }`}
                >
                  {item.symbol}
                </span>

                <span className="font-mono text-[11px] sm:text-xs font-bold text-white">
                  {formatPrice(item.currentPrice)}
                </span>

                <span
                  className={`font-mono text-[10px] sm:text-[11px] font-bold flex items-center ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositive ? '▲ +' : '▼ '}
                  {Math.abs(item.change)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

