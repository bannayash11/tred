import React, { useState, useEffect } from 'react';
import {
  Zap,
  Lock,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sliders,
  Flame,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Scale
} from 'lucide-react';
import {
  fetchOpeningMomentumSettings,
  updateOpeningMomentumSettings,
  triggerOpeningMomentumFreeze,
  resetOpeningMomentumSession,
  fetchOpeningMomentumLive,
  getSocket
} from '../services/api';
import { useAdmin } from '../context/AdminContext';

export default function OpeningMomentumAdmin() {
  const { showToast } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [settings, setSettings] = useState({
    enabled: true,
    freezeTime: '09:20',
    timeframe: '5m',
    minRvol: 1.0,
    topCount: 10,
    breakoutOnly: false,
    isFrozen: false,
    frozenAt: null
  });

  const [liveData, setLiveData] = useState({
    gainers: [],
    losers: [],
    stats: {},
    isFrozen: false,
    frozenAt: null
  });

  // Load initial settings and live rankings
  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, liveRes] = await Promise.allSettled([
        fetchOpeningMomentumSettings(),
        fetchOpeningMomentumLive()
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.success) {
        setSettings(settingsRes.value.settings || {});
      }

      if (liveRes.status === 'fulfilled' && liveRes.value.success) {
        setLiveData(liveRes.value.data || {});
      }
    } catch (err) {
      console.error('Error loading Opening Momentum admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to live socket updates
    const socket = getSocket();
    const handleMomentumTick = (payload) => {
      if (payload) {
        setLiveData(payload);
        if (payload.isFrozen !== undefined) {
          setSettings((prev) => ({
            ...prev,
            isFrozen: payload.isFrozen,
            frozenAt: payload.frozenAt
          }));
        }
      }
    };

    socket.on('OPENING_MOMENTUM', handleMomentumTick);
    return () => {
      socket.off('OPENING_MOMENTUM', handleMomentumTick);
    };
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateOpeningMomentumSettings({
        enabled: settings.enabled,
        freezeTime: settings.freezeTime,
        minRvol: Number(settings.minRvol),
        topCount: Number(settings.topCount),
        breakoutOnly: settings.breakoutOnly
      });
      if (res.success) {
        setSettings((prev) => ({ ...prev, ...res.settings }));
        showToast('✅ Opening Momentum Scanner configuration saved successfully.');
      } else {
        showToast('❌ Failed to update settings: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerFreeze = async () => {
    setActionLoading(true);
    try {
      const res = await triggerOpeningMomentumFreeze();
      if (res.success) {
        showToast('🔒 ' + res.message);
        loadData();
      } else {
        showToast('❌ Failed to freeze reference: ' + (res.message || 'Error'));
      }
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetSession = async () => {
    if (!window.confirm('Are you sure you want to reset the Opening Momentum session and re-calibrate?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await resetOpeningMomentumSession();
      if (res.success) {
        showToast('🔄 ' + res.message);
        loadData();
      } else {
        showToast('❌ Failed to reset session');
      }
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'Not yet frozen';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' IST';
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center">
            <Zap className="mr-2.5 h-6 w-6 text-amber-400" />
            Opening 5-Minute Momentum Scanner Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Institutional velocity engine ranking F&O stocks by movement from the 09:20 AM (5-minute candle close) reference price.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              settings.enabled
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                settings.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{settings.enabled ? 'SCANNER LIVE' : 'SCANNER PAUSED'}</span>
          </span>

          <span
            className={`inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              settings.isFrozen
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
            }`}
          >
            <Lock className="h-3 w-3" />
            <span>{settings.isFrozen ? '09:20 FROZEN' : 'WAITING FOR 09:20'}</span>
          </span>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reference Freeze Status
          </div>
          <div className="text-sm sm:text-base font-extrabold text-white font-mono flex items-center space-x-1.5">
            <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="truncate">{settings.isFrozen ? 'Frozen at ' + formatTime(settings.frozenAt) : 'Unfrozen'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Target time: {settings.freezeTime} AM IST (5-Min Candle)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Tracked Universe
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
            {liveData.stats?.totalTracked || settings.totalTrackedSymbols || 35}
          </div>
          <div className="text-[11px] text-slate-500">Liquid NSE F&O Equities</div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            5M High Breakouts
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
            {liveData.stats?.breakoutCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Above first candle high</div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
            5M Low Breakdowns
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-400 font-mono">
            {liveData.stats?.breakdownCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Below first candle low</div>
        </div>
      </div>

      {/* 5M F&O Breadth Indicator Bar */}
      {(() => {
        const breadth = liveData.breadth || liveData.stats?.breadth || null;
        if (!breadth) return null;
        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                <Scale className="h-4 w-4 text-cyan-400" />
                <span>5M F&O Market Breadth (A/D vs 09:20 Close)</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                breadth.sentiment && breadth.sentiment.includes('BULLISH')
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  : breadth.sentiment && breadth.sentiment.includes('BEARISH')
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {breadth.sentimentLabel || 'Balanced Breadth'} · Ratio: {breadth.adRatio} : 1
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-semibold">
                ▲ {breadth.advances} Advancing ({breadth.advancePercent}%)
              </span>
              <span className="text-slate-400 text-[11px]">
                Net Difference: <strong className={breadth.adDifference >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {breadth.adDifference >= 0 ? `+${breadth.adDifference}` : breadth.adDifference}
                </strong>
                {breadth.unchanged > 0 && ` | ${breadth.unchanged} Unchanged`}
              </span>
              <span className="text-rose-400 font-semibold">
                {breadth.declines} Declining ({breadth.declinePercent}%) ▼
              </span>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800 p-0.5">
              <div style={{ width: `${breadth.advancePercent}%` }} className="bg-emerald-500 rounded-l-full transition-all duration-500" />
              {breadth.unchanged > 0 && (
                <div style={{ width: `${breadth.unchangedPercent}%` }} className="bg-slate-600 transition-all duration-500" />
              )}
              <div style={{ width: `${breadth.declinePercent}%` }} className="bg-rose-500 rounded-r-full transition-all duration-500" />
            </div>
          </div>
        );
      })()}

      {/* Configuration & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Sliders className="h-4 w-4 mr-2 text-amber-400" />
                Algorithm Parameters & Filters
              </h3>
              <p className="text-xs text-slate-400">
                Adjust calculation thresholds, RVOL sensitivity, and display rules for traders.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Enabled Toggle */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Scanner Engine Status</label>
                <select
                  value={settings.enabled ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.value === 'true' })}
                  className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-medium"
                >
                  <option value="true">Active (Streaming Live to Website & App)</option>
                  <option value="false">Paused (Maintenance / Market Closed)</option>
                </select>
              </div>

              {/* Reference Freeze Time */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Daily Reference Freeze Time</label>
                <input
                  type="text"
                  value={settings.freezeTime}
                  onChange={(e) => setSettings({ ...settings, freezeTime: e.target.value })}
                  placeholder="09:20"
                  className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  First 5m candle (09:15–09:20) closing price freeze
                </span>
              </div>

              {/* Min RVOL Threshold */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Min RVOL Filter (Relative Volume)
                </label>
                <select
                  value={settings.minRvol}
                  onChange={(e) => setSettings({ ...settings, minRvol: parseFloat(e.target.value) })}
                  className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-medium"
                >
                  <option value="0.5">0.5x (Permissive - Catch early moves)</option>
                  <option value="1.0">1.0x (Standard - Normal Volume)</option>
                  <option value="1.5">1.5x (Institutional Surge - Recommended)</option>
                  <option value="2.0">2.0x (Heavy Institutional Footprint Only)</option>
                </select>
              </div>

              {/* Top Movers Count */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Top Movers Board Size</label>
                <select
                  value={settings.topCount}
                  onChange={(e) => setSettings({ ...settings, topCount: parseInt(e.target.value, 10) })}
                  className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 font-medium"
                >
                  <option value="5">Top 5 Gainers & Top 5 Losers</option>
                  <option value="10">Top 10 Gainers & Top 10 Losers (Standard)</option>
                  <option value="15">Top 15 Gainers & Top 15 Losers</option>
                  <option value="20">Top 20 Gainers & Top 20 Losers</option>
                </select>
              </div>
            </div>

            {/* Breakout Only Mode Checkbox */}
            <div className="flex items-center space-x-3 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80">
              <input
                type="checkbox"
                id="breakoutOnly"
                checked={settings.breakoutOnly}
                onChange={(e) => setSettings({ ...settings, breakoutOnly: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="breakoutOnly" className="cursor-pointer">
                <div className="font-bold text-white text-xs">Strict ORB Breakout Mode Only</div>
                <div className="text-[11px] text-slate-400">
                  When enabled, stocks are only ranked if LTP has explicitly broken above the 5-Minute High (Bullish) or below the 5-Minute Low (Bearish). Inside-range stocks are excluded.
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-black hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Scanner Parameters'}</span>
            </button>
          </form>
        </div>

        {/* Live Operational Testing Actions */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Activity className="h-4 w-4 mr-2 text-cyan-400" />
                Live Operational Testing
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Test and verify reference price freezing anytime without waiting for 09:20 AM.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-cyan-950/20 border border-cyan-800/50 p-4 space-y-2 text-xs">
                <div className="font-bold text-cyan-300 flex items-center space-x-1.5">
                  <Lock className="h-4 w-4" />
                  <span>Manual Reference Re-Freeze</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Forces an immediate snapshot of current prices as the static reference baseline. Useful for testing ranking momentum during live trading sessions or post-market testing.
                </p>
                <button
                  type="button"
                  onClick={handleTriggerFreeze}
                  disabled={actionLoading}
                  className="w-full mt-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-bold text-black hover:bg-cyan-400 transition-colors flex items-center justify-center space-x-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>{actionLoading ? 'Freezing...' : '⚡ Re-Freeze 09:20 Reference Now'}</span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-2 text-xs">
                <div className="font-bold text-slate-300 flex items-center space-x-1.5">
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                  <span>Session Reset</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Clears locked reference prices and re-synchronizes with the F&O stock universe.
                </p>
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={actionLoading}
                  className="w-full mt-2 rounded-xl bg-slate-800 px-4 py-2 text-slate-200 font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Today's Session</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/80 p-3.5 border border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Socket.io real-time streaming actively syncing rankings to clients.</span>
          </div>
        </div>
      </div>

      {/* Live Preview Boards (Gainers & Losers) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center">
              <Flame className="h-5 w-5 mr-2 text-orange-400" />
              Live Output Preview (As Seen by Traders)
            </h3>
            <p className="text-xs text-slate-400">
              Real-time rankings calculated from 09:20 reference close: <span className="font-mono text-cyan-400">((LTP - RefClose) / RefClose) * 100</span>
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Auto-refresh: <span className="text-emerald-400 font-bold">1.5s Socket Stream</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Gainers Table */}
          <div className="rounded-3xl border border-emerald-900/40 bg-slate-900/60 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-sm font-bold text-emerald-400 flex items-center">
                  <TrendingUp className="mr-1.5 h-4 w-4" />
                  Top {settings.topCount} Bullish Velocity Movers
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Avg: {liveData.stats?.avgGainerMove || '+0.00%'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Stock</th>
                    <th className="py-2 px-2 text-right">LTP</th>
                    <th className="py-2 px-2 text-right">09:20 Close</th>
                    <th className="py-2 px-2 text-right">Move %</th>
                    <th className="py-2 px-2 text-center">RVOL</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(liveData.gainers || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-6 text-center text-slate-500 font-sans">
                        No bullish movers matching current filter.
                      </td>
                    </tr>
                  ) : (
                    (liveData.gainers || []).map((stock) => (
                      <tr key={stock.symbol} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-2 font-bold text-slate-500">#{stock.rank}</td>
                        <td className="py-2.5 px-2 font-sans">
                          <div className="font-bold text-white flex items-center space-x-1">
                            <span>{stock.symbol}</span>
                            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">{stock.sector}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-white">
                          ₹{stock.ltp?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-400">
                          ₹{stock.refClose?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-400">
                          +{stock.movementPercent?.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              stock.rvol >= 1.5
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                : 'text-slate-400'
                            }`}
                          >
                            {stock.rvol}x
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-sans">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              stock.status === 'BREAKOUT'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {stock.status === 'BREAKOUT' ? '5M BREAKOUT' : 'INSIDE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Losers Table */}
          <div className="rounded-3xl border border-rose-900/40 bg-slate-900/60 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-pulse" />
                <h4 className="text-sm font-bold text-rose-400 flex items-center">
                  <TrendingDown className="mr-1.5 h-4 w-4" />
                  Top {settings.topCount} Bearish Velocity Movers
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400">
                Avg: {liveData.stats?.avgLoserMove || '-0.00%'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Stock</th>
                    <th className="py-2 px-2 text-right">LTP</th>
                    <th className="py-2 px-2 text-right">09:20 Close</th>
                    <th className="py-2 px-2 text-right">Move %</th>
                    <th className="py-2 px-2 text-center">RVOL</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(liveData.losers || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-6 text-center text-slate-500 font-sans">
                        No bearish movers matching current filter.
                      </td>
                    </tr>
                  ) : (
                    (liveData.losers || []).map((stock) => (
                      <tr key={stock.symbol} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-2 font-bold text-slate-500">#{stock.rank}</td>
                        <td className="py-2.5 px-2 font-sans">
                          <div className="font-bold text-white flex items-center space-x-1">
                            <span>{stock.symbol}</span>
                            <ArrowDownRight className="h-3 w-3 text-rose-400" />
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">{stock.sector}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-white">
                          ₹{stock.ltp?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-400">
                          ₹{stock.refClose?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-rose-400">
                          {stock.movementPercent?.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              stock.rvol >= 1.5
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                : 'text-slate-400'
                            }`}
                          >
                            {stock.rvol}x
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-sans">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              stock.status === 'BREAKDOWN'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {stock.status === 'BREAKDOWN' ? '5M BREAKDOWN' : 'INSIDE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
