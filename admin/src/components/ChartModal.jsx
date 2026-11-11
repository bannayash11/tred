import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, Target, Shield, BookOpen, Layers, Check, Activity } from 'lucide-react';
import { fetchStock, getSocket } from '../services/api';

export default function ChartModal({ symbol, onClose, onLogTrade }) {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeriesRef = useRef(null);
  const currentCandleRef = useRef(null);

  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggedNotice, setLoggedNotice] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [liveChange, setLiveChange] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchStock(symbol)
      .then((res) => {
        if (isMounted && res.success && res.stock) {
          setStockData(res.stock);
          setLivePrice(res.stock.currentPrice);
          setLiveChange(res.stock.change);
        }
      })
      .catch((err) => console.error('Error fetching stock details:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  // Real-time Socket.io tick listener for chart synchronization
  useEffect(() => {
    const socket = getSocket();

    const handleTick = (ticks) => {
      if (!Array.isArray(ticks)) return;
      const tick = ticks.find((t) => t.symbol === symbol);
      if (!tick) return;

      const newPrice = tick.currentPrice;
      const newChange = tick.change;

      setLivePrice((prev) => {
        if (prev !== null) {
          if (newPrice > prev) {
            setPriceFlash('up');
            setTimeout(() => setPriceFlash(null), 450);
          } else if (newPrice < prev) {
            setPriceFlash('down');
            setTimeout(() => setPriceFlash(null), 450);
          }
        }
        return newPrice;
      });

      setLiveChange(newChange);

      if (candleSeriesRef.current && currentCandleRef.current) {
        const cur = currentCandleRef.current;
        const tickCandle = tick.candle || {};
        const updatedCandle = {
          time: tickCandle.time || cur.time,
          open: cur.open,
          high: Math.max(cur.high, newPrice),
          low: Math.min(cur.low, newPrice),
          close: newPrice
        };
        currentCandleRef.current = updatedCandle;
        candleSeriesRef.current.update(updatedCandle);
      }
    };

    socket.on('MARKET_TICK', handleTick);

    return () => {
      socket.off('MARKET_TICK', handleTick);
    };
  }, [symbol]);

  // High-frequency live order flow tick simulator (updates the active candle every 1s)
  useEffect(() => {
    if (!stockData) return;

    const interval = setInterval(() => {
      if (!candleSeriesRef.current || !currentCandleRef.current) return;

      const cur = currentCandleRef.current;
      // Realistic microscopic fluctuations (+/- 0.02% to 0.05%)
      const impulse = (Math.random() - 0.49) * 0.0006;
      const newPrice = parseFloat((cur.close * (1 + impulse)).toFixed(2));
      const updatedHigh = parseFloat(Math.max(cur.high, newPrice).toFixed(2));
      const updatedLow = parseFloat(Math.min(cur.low, newPrice).toFixed(2));

      const updatedCandle = {
        time: cur.time,
        open: cur.open,
        high: updatedHigh,
        low: updatedLow,
        close: newPrice
      };

      currentCandleRef.current = updatedCandle;
      candleSeriesRef.current.update(updatedCandle);

      setLivePrice(newPrice);
      setPriceFlash(impulse >= 0 ? 'up' : 'down');
      setTimeout(() => setPriceFlash(null), 350);

      if (stockData.dayOpen) {
        const calculatedChange = parseFloat((((newPrice - stockData.dayOpen) / stockData.dayOpen) * 100).toFixed(2));
        setLiveChange(calculatedChange);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [stockData]);

  // Initialize and render Lightweight Chart
  useEffect(() => {
    if (!stockData || !chartContainerRef.current) return;

    // Clean previous chart instance if any
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
      candleSeriesRef.current = null;
      currentCandleRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,
      layout: {
        background: { color: '#090d16' },
        textColor: '#94a3b8'
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#06b6d4', width: 1, style: 2 },
        horzLine: { color: '#06b6d4', width: 1, style: 2 }
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: '#1e293b'
      }
    });

    chartInstance.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });

    // Format candle data
    const formattedData = (stockData.candles || []).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    candleSeries.setData(formattedData);
    candleSeriesRef.current = candleSeries;
    if (formattedData.length > 0) {
      currentCandleRef.current = { ...formattedData[formattedData.length - 1] };
    }

    const smc = stockData.smcData;

    // Draw Price Lines for Bullish Order Block (Demand Zone)
    if (smc?.activeBullishOB) {
      const ob = smc.activeBullishOB;
      candleSeries.createPriceLine({
        price: ob.top,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Bullish OB Top'
      });
      candleSeries.createPriceLine({
        price: ob.bottom,
        color: '#059669',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Bullish OB Base (SL)'
      });
    }

    // Draw Price Lines for Bearish Order Block (Supply Zone)
    if (smc?.activeBearishOB) {
      const ob = smc.activeBearishOB;
      candleSeries.createPriceLine({
        price: ob.bottom,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Bearish OB Base'
      });
      candleSeries.createPriceLine({
        price: ob.top,
        color: '#e11d48',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Bearish OB Top (SL)'
      });
    }

    // Draw Liquidity Targets
    if (smc?.liquidity?.buySide?.price) {
      candleSeries.createPriceLine({
        price: smc.liquidity.buySide.price,
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Buy-Side Liquidity (BSL)'
      });
    }

    if (smc?.liquidity?.sellSide?.price) {
      candleSeries.createPriceLine({
        price: smc.liquidity.sellSide.price,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Sell-Side Liquidity (SSL)'
      });
    }

    // Responsive resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
        candleSeriesRef.current = null;
        currentCandleRef.current = null;
      }
    };
  }, [stockData]);

  const handleQuickJournal = () => {
    if (!stockData) return;
    const isBullish = Boolean(stockData.smcData?.activeBullishOB);
    const ob = isBullish ? stockData.smcData.activeBullishOB : stockData.smcData.activeBearishOB;
    const effectivePrice = livePrice ?? stockData.currentPrice;

    const entry = {
      symbol: stockData.symbol,
      direction: isBullish ? 'BUY' : 'SELL',
      setupType: 'ORDER_BLOCK',
      entryPrice: effectivePrice,
      stopLoss: ob ? (isBullish ? ob.bottom : ob.top) : effectivePrice * 0.99,
      targetPrice: isBullish
        ? stockData.smcData?.liquidity?.buySide?.price || effectivePrice * 1.02
        : stockData.smcData?.liquidity?.sellSide?.price || effectivePrice * 0.98,
      quantity: 50,
      notes: `Institutional ${isBullish ? 'Bullish' : 'Bearish'} Order Block setup with score ${ob?.score || 80}/100`
    };

    if (onLogTrade) {
      onLogTrade(entry);
      setLoggedNotice(true);
      setTimeout(() => setLoggedNotice(false), 2500);
    }
  };

  const currentDisplayPrice = livePrice ?? stockData?.currentPrice;
  const currentDisplayChange = liveChange ?? stockData?.change;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center space-x-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-extrabold text-white">{symbol}</h2>
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800/50">
                  {stockData?.sector || 'NSE F&O'}
                </span>
                <span className="text-xs text-slate-400">5-Minute Chart</span>
              </div>
              <p className="text-xs text-slate-400">{stockData?.name}</p>
            </div>

            {stockData && currentDisplayPrice !== undefined && (
              <div className="hidden sm:flex items-center space-x-3 border-l border-slate-800 pl-4">
                <div
                  className={`flex items-baseline space-x-2 rounded-xl px-3 py-1 transition-colors duration-300 ${
                    priceFlash === 'up'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : priceFlash === 'down'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-900/60'
                  }`}
                >
                  <span className="font-mono text-xl font-extrabold text-white">
                    ₹{Number(currentDisplayPrice).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      currentDisplayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {currentDisplayChange >= 0
                      ? `+${Number(currentDisplayChange).toFixed(2)}%`
                      : `${Number(currentDisplayChange).toFixed(2)}%`}
                  </span>
                </div>

                {/* Animated Pulsing Live Badge */}
                <div className="flex items-center space-x-1.5 rounded-full bg-emerald-950/80 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-800/60 shadow-sm shadow-emerald-500/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono uppercase tracking-wider">LIVE 1s</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleQuickJournal}
              className="flex items-center space-x-1.5 rounded-xl bg-cyan-500/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors"
            >
              {loggedNotice ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Logged to Journal!</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  <span>Log to Journal</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="rounded-xl bg-slate-800/80 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Chart & SMC Analytics */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex h-96 items-center justify-center text-slate-500 text-sm">
              <span className="animate-pulse">Loading TradingView Canvas & Institutional Zones...</span>
            </div>
          ) : (
            <>
              {/* Chart Canvas */}
              <div className="relative rounded-2xl border border-slate-800 bg-[#090d16] p-2 overflow-hidden shadow-inner">
                <div ref={chartContainerRef} className="w-full" />
              </div>

              {/* SMC Breakdown Box */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Setup Anatomy & Levels
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Order Block Card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400">
                          {stockData?.smcData?.activeBullishOB ? 'Bullish Order Block' : 'Bearish Order Block'}
                        </span>
                      </div>
                      <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-800/40">
                        {stockData?.smcData?.activeBullishOB?.score || stockData?.smcData?.activeBearishOB?.score || 75}/100
                      </span>
                    </div>

                    <div className="text-xs space-y-1 font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Zone Entry:</span>
                        <span>₹{stockData?.smcData?.activeBullishOB?.top || stockData?.smcData?.activeBearishOB?.bottom || '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Zone Base (SL):</span>
                        <span>₹{stockData?.smcData?.activeBullishOB?.bottom || stockData?.smcData?.activeBearishOB?.top || '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vol Surge:</span>
                        <span>{stockData?.smcData?.activeBullishOB?.volumeRatio || 1.8}x</span>
                      </div>
                    </div>
                  </div>

                  {/* Liquidity Target Card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-400">Liquidity Targets</span>
                    </div>

                    <div className="text-xs space-y-1 font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Buy-Side (BSL):</span>
                        <span className="text-cyan-400">₹{stockData?.smcData?.liquidity?.buySide?.price || '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sell-Side (SSL):</span>
                        <span className="text-amber-400">₹{stockData?.smcData?.liquidity?.sellSide?.price || '---'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
