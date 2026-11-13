import React, { useState, useEffect } from 'react';
import {
  Zap,
  Lock,
  RotateCcw,
  Save,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Sliders,
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
  archiveOpeningMomentumSession,
  fetchOpeningMomentumLive,
  getSocket
} from '../services/api';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

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
        showToast('Opening momentum settings saved.');
      } else {
        showToast('Failed to update settings: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerFreeze = async () => {
    setActionLoading(true);
    try {
      const res = await triggerOpeningMomentumFreeze();
      if (res.success) {
        showToast(res.message);
        loadData();
      } else {
        showToast('Failed to freeze reference: ' + (res.message || 'Error'));
      }
    } catch (err) {
      showToast('Error: ' + err.message);
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
        showToast(res.message);
        loadData();
      } else {
        showToast('Failed to reset session');
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveSession = async () => {
    setActionLoading(true);
    try {
      const res = await archiveOpeningMomentumSession(true);
      if (res.success) {
        showToast(res.message || `Archived ${res.sessionDate}`);
      } else {
        showToast('Archive failed: ' + (res.message || 'Error'));
      }
    } catch (err) {
      showToast('Error: ' + (err.response?.data?.message || err.message));
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
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Opening momentum"
        description="5-minute scanner from 09:20 reference close."
        icon={Zap}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`admin-chip ${
                settings.enabled
                  ? 'border-emerald-800/60 bg-emerald-950/60 text-emerald-300'
                  : 'border-rose-800/60 bg-rose-950/60 text-rose-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  settings.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {settings.enabled ? 'Live' : 'Paused'}
            </span>
            <span
              className={`admin-chip ${
                settings.isFrozen
                  ? 'border-cyan-800/60 bg-cyan-950/60 text-cyan-300'
                  : 'border-admin-border bg-admin-bg text-admin-accent'
              }`}
            >
              <Lock className="h-3 w-3" />
              {settings.isFrozen ? 'Frozen' : 'Awaiting 09:20'}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Panel className="p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-admin-muted">
            Reference freeze
          </div>
          <div className="text-sm sm:text-base font-extrabold text-white font-mono flex items-center space-x-1.5">
            <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="truncate">{settings.isFrozen ? 'Frozen at ' + formatTime(settings.frozenAt) : 'Unfrozen'}</span>
          </div>
          <div className="text-[11px] text-admin-muted">
            Target: {settings.freezeTime} AM IST
          </div>
        </Panel>

        <Panel className="p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-admin-muted">
            Tracked symbols
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-white font-mono">
            {liveData.stats?.totalTracked || settings.totalTrackedSymbols || 35}
          </div>
          <div className="text-[11px] text-admin-muted">NSE F&amp;O universe</div>
        </Panel>

        <Panel className="p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Breakouts
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
            {liveData.stats?.breakoutCount ?? 0}
          </div>
          <div className="text-[11px] text-admin-muted">Above first candle high</div>
        </Panel>

        <Panel className="p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
            Breakdowns
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-400 font-mono">
            {liveData.stats?.breakdownCount ?? 0}
          </div>
          <div className="text-[11px] text-admin-muted">Below first candle low</div>
        </Panel>
      </div>

      {/* 5M F&O Breadth Indicator Bar */}
      {(() => {
        const breadth = liveData.breadth || liveData.stats?.breadth || null;
        if (!breadth) return null;
        return (
          <Panel className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-white">
                <Scale className="h-4 w-4 text-admin-accent" />
                <span>Market breadth (vs 09:20)</span>
              </div>
              <span className={`admin-chip text-[10px] font-mono ${
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

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-admin-bg border border-admin-border p-0.5">
              <div style={{ width: `${breadth.advancePercent}%` }} className="bg-emerald-500 rounded-l-full transition-all duration-500" />
              {breadth.unchanged > 0 && (
                <div style={{ width: `${breadth.unchangedPercent}%` }} className="bg-slate-600 transition-all duration-500" />
              )}
              <div style={{ width: `${breadth.declinePercent}%` }} className="bg-rose-500 rounded-r-full transition-all duration-500" />
            </div>
          </Panel>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2 p-6 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-admin-border pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-admin-accent" />
                Parameters
              </h3>
              <p className="text-xs text-admin-muted">RVOL, board size, and breakout filter.</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Enabled Toggle */}
              <div>
                <label className="admin-label block mb-1.5">Scanner status</label>
                <select
                  value={settings.enabled ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.value === 'true' })}
                  className="admin-input"
                >
                  <option value="true">Active</option>
                  <option value="false">Paused</option>
                </select>
              </div>

              <div>
                <label className="admin-label block mb-1.5">Freeze time</label>
                <input
                  type="text"
                  value={settings.freezeTime}
                  onChange={(e) => setSettings({ ...settings, freezeTime: e.target.value })}
                  placeholder="09:20"
                  className="admin-input font-mono"
                />
                <span className="text-[10px] text-admin-muted mt-1 block">09:15–09:20 candle close</span>
              </div>

              <div>
                <label className="admin-label block mb-1.5">Min RVOL</label>
                <select
                  value={settings.minRvol}
                  onChange={(e) => setSettings({ ...settings, minRvol: parseFloat(e.target.value) })}
                  className="admin-input"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x</option>
                </select>
              </div>

              <div>
                <label className="admin-label block mb-1.5">Top movers count</label>
                <select
                  value={settings.topCount}
                  onChange={(e) => setSettings({ ...settings, topCount: parseInt(e.target.value, 10) })}
                  className="admin-input"
                >
                  <option value="5">Top 5 each side</option>
                  <option value="10">Top 10 each side</option>
                  <option value="15">Top 15 each side</option>
                  <option value="20">Top 20 each side</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-xl bg-admin-bg p-4 border border-admin-border">
              <input
                type="checkbox"
                id="breakoutOnly"
                checked={settings.breakoutOnly}
                onChange={(e) => setSettings({ ...settings, breakoutOnly: e.target.checked })}
                className="h-4 w-4 rounded border-admin-border bg-admin-surface text-admin-accent focus:ring-admin-accent"
              />
              <label htmlFor="breakoutOnly" className="cursor-pointer">
                <div className="font-semibold text-white text-xs">Breakout-only mode</div>
                <div className="text-[11px] text-admin-muted">
                  Rank only names outside the first 5m high/low.
                </div>
              </label>
            </div>

            <button type="submit" disabled={saving} className="admin-btn-primary">
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving…' : 'Save settings'}</span>
            </button>
          </form>
        </Panel>

        <Panel className="p-6 sm:p-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-admin-border pb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-admin-accent" />
                Operations
              </h3>
              <p className="text-xs text-admin-muted mt-0.5">Manual freeze, reset, and archive.</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-admin-border bg-admin-bg p-4 space-y-2 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-admin-accent" />
                  Re-freeze reference
                </div>
                <p className="text-admin-muted text-[11px]">Snapshot current prices as the baseline.</p>
                <button
                  type="button"
                  onClick={handleTriggerFreeze}
                  disabled={actionLoading}
                  className="admin-btn-primary w-full mt-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>{actionLoading ? 'Freezing…' : 'Re-freeze now'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-admin-border bg-admin-bg p-4 space-y-2 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-admin-accent" />
                  Reset session
                </div>
                <p className="text-admin-muted text-[11px]">Clear reference and resync universe.</p>
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={actionLoading}
                  className="admin-btn-secondary w-full mt-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset session</span>
                </button>
              </div>

              <div className="rounded-xl border border-admin-border bg-admin-bg p-4 space-y-3">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-admin-accent" />
                  Archive snapshot
                </div>
                <p className="text-admin-muted text-[11px]">Save today&apos;s rankings for preview.</p>
                <button
                  type="button"
                  onClick={handleArchiveSession}
                  disabled={actionLoading}
                  className="admin-btn-ghost w-full mt-2 disabled:opacity-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Archive now</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-admin-border bg-admin-bg p-3.5 text-[11px] text-admin-muted flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Live socket stream connected.</span>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white">Live preview</h3>
            <p className="text-xs text-admin-muted">
              Move % from 09:20 close via socket updates.
            </p>
          </div>
          <span className="admin-chip text-xs font-mono text-emerald-300">~1.5s refresh</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel className="p-5 space-y-4 border-emerald-900/30">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Top {settings.topCount} gainers
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
                                ? 'border border-admin-accent/40 bg-admin-accent/10 text-admin-accent'
                                : 'text-admin-muted'
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
          </Panel>

          <Panel className="p-5 space-y-4 border-rose-900/30">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-pulse" />
                <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4" />
                  Top {settings.topCount} losers
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
                                ? 'border border-admin-accent/40 bg-admin-accent/10 text-admin-accent'
                                : 'text-admin-muted'
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
          </Panel>
        </div>
      </div>
    </div>
  );
}
