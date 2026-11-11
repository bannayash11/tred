import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  Award,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Lock
} from 'lucide-react';
import { fetchJournal, createTrade, removeTrade } from '../services/api';
import ConfirmModal from './ConfirmModal';
import MembershipBanner from './MembershipBanner';
import MembershipLocked from './MembershipLocked';
import { useSelector } from 'react-redux';
import { getMembership } from '../lib/membership';

export default function TradingJournalView({ user, onOpenPricing }) {
  const plans = useSelector((state) => state.content?.plans || []);
  const membership = getMembership(user, plans);
  const [journalData, setJournalData] = useState({
    trades: [],
    stats: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgRR: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [limitError, setLimitError] = useState('');

  // Form State
  const [form, setForm] = useState({
    symbol: 'RELIANCE',
    direction: 'BUY',
    setupType: 'ORDER_BLOCK',
    timeframe: membership.timeframesAllowed[0] || '15m',
    entryPrice: '',
    stopLoss: '',
    targetPrice: '',
    exitPrice: '',
    quantity: 50,
    status: 'TARGET_HIT',
    notes: ''
  });

  const loadJournal = () => {
    setLoading(true);
    fetchJournal()
      .then((res) => {
        if (res.success) {
          setJournalData(res);
        }
      })
      .catch((err) => {
        console.error('Error loading journal:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJournal();
  }, []);

  const handleAddTrade = async (e) => {
    e.preventDefault();
    setLimitError('');
    const currentCount = (journalData.trades || []).length;
    if (!membership.canAddJournalEntry(currentCount)) {
      setLimitError(
        `Trade Log limit reached for ${membership.label} (${membership.maxJournalEntries} entries). Upgrade to add more.`
      );
      return;
    }
    if (!membership.canUseTimeframe(form.timeframe) && membership.timeframesAllowed.length) {
      setLimitError(
        `Timeframe ${form.timeframe} is not included in your plan. Allowed: ${membership.timeframesAllowed.join(', ')}.`
      );
      return;
    }
    try {
      await createTrade(form);
      setShowAddModal(false);
      setForm({
        symbol: 'RELIANCE',
        direction: 'BUY',
        setupType: 'ORDER_BLOCK',
        timeframe: membership.timeframesAllowed[0] || '15m',
        entryPrice: '',
        stopLoss: '',
        targetPrice: '',
        exitPrice: '',
        quantity: 50,
        status: 'TARGET_HIT',
        notes: ''
      });
      loadJournal();
    } catch (err) {
      alert('Error creating trade: ' + err.message);
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await removeTrade(deleteTargetId);
      setDeleteTargetId(null);
      loadJournal();
    } catch (err) {
      alert('Error removing trade: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const { stats = {}, trades = [] } = journalData;
  const displayTrades = trades || [];

  const totalTradesCount = stats.totalTrades ?? displayTrades.length;
  const winningCount = stats.winningTrades ?? displayTrades.filter((t) => t.pnl > 0).length;
  const losingCount = stats.losingTrades ?? displayTrades.filter((t) => t.pnl < 0).length;
  const winRatePercent =
    totalTradesCount > 0 ? (stats.winRate ?? Math.round((winningCount / totalTradesCount) * 100)) : 0;

  // Safe numerical Net Realized PnL computation (never undefined)
  const rawPnL =
    stats.totalPnL !== undefined
      ? Number(stats.totalPnL)
      : stats.netPnL !== undefined
      ? Number(stats.netPnL)
      : displayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);

  const formattedPnL =
    (rawPnL >= 0 ? '+₹' : '-₹') +
    Math.abs(rawPnL).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const avgRRDisplay = stats.avgRR ?? '2.4';
  const tradeCount = (trades && trades.length) || 0;
  const atJournalLimit = !membership.canAddJournalEntry(tradeCount);

  if (!membership.allowJournal) {
    return (
      <MembershipLocked
        title="Trade Log locked"
        message={membership.upgradeHint || 'Your membership does not include Trade Log access.'}
        onOpenPricing={onOpenPricing}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />

      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center">
            <BookOpen className="mr-2 h-6 w-6 text-cyan-400" />
            Trade Log & Performance
          </h1>
          <p className="text-xs text-slate-400">
            Orders are placed on your broker. Log those trades here to track setups, R:R and PnL — this is not a practice account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (atJournalLimit) {
              setLimitError(
                `Trade Log limit reached (${tradeCount}/${membership.maxJournalEntries}). Upgrade to add more trades.`
              );
              onOpenPricing?.();
              return;
            }
            setLimitError('');
            setShowAddModal(true);
          }}
          className={`flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors shadow-lg ${
            atJournalLimit
              ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/40'
              : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20'
          }`}
        >
          {atJournalLimit ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>
            {atJournalLimit
              ? `Limit ${tradeCount}/${membership.maxJournalEntries}`
              : 'Log New Trade'}
          </span>
        </button>
      </div>

      {limitError && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
          {limitError}
        </div>
      )}

      {/* Analytics KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Trades */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Trades</span>
            <Award className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-white">
            {totalTradesCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {winningCount} Wins / {losingCount} Losses
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Win Rate</span>
            <Percent className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-emerald-400">
            {winRatePercent}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Institutional Win Accuracy
          </div>
        </div>

        {/* Total Net PnL */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Realized PnL</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div
            className={`mt-2 text-2xl font-extrabold font-mono ${
              rawPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formattedPnL}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Cumulative Profit & Loss
          </div>
        </div>

        {/* Avg R:R */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Risk-Reward</span>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-amber-400">
            1 : {avgRRDisplay}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Expectancy Multiplier
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Trade History & Audit Log</h2>
          <span className="text-xs text-slate-400">{displayTrades.length} Recorded Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Symbol</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Setup</th>
                <th className="px-6 py-3">Entry</th>
                <th className="px-6 py-3">Exit / Target</th>
                <th className="px-6 py-3">R:R</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">PnL</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                    No trades logged yet. Click "Log New Trade" or log directly from the Order Block chart!
                  </td>
                </tr>
              ) : (
                displayTrades.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 text-slate-400 font-sans text-[11px]">
                      {new Date(t.tradeDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-white font-sans">
                      {t.symbol}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          t.direction === 'BUY'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 font-sans">
                      {t.setupType}
                    </td>
                    <td className="px-6 py-3.5 text-slate-200">
                      ₹{t.entryPrice}
                    </td>
                    <td className="px-6 py-3.5 text-slate-300">
                      ₹{t.exitPrice || t.targetPrice}
                    </td>
                    <td className="px-6 py-3.5 text-amber-400 font-bold">
                      1:{t.riskReward || 2}
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.status === 'TARGET_HIT'
                            ? 'bg-emerald-950 text-emerald-400'
                            : t.status === 'SL_HIT'
                            ? 'bg-rose-950 text-rose-400'
                            : 'bg-cyan-950 text-cyan-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-3.5 font-bold ${
                        t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.pnl >= 0 ? `+₹${t.pnl}` : `-₹${Math.abs(t.pnl)}`}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans">
                      <button
                        onClick={() => handleDelete(t._id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Trade Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Log Trade Entry</h3>
            <form onSubmit={handleAddTrade} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Symbol</label>
                  <input
                    type="text"
                    required
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Direction</label>
                  <select
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  >
                    <option value="BUY">BUY (Long)</option>
                    <option value="SELL">SELL (Short)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Entry Price</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={form.entryPrice}
                    onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                    placeholder="e.g. 1290"
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={form.stopLoss}
                    onChange={(e) => setForm({ ...form, stopLoss: e.target.value })}
                    placeholder="e.g. 1282"
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target Price</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={form.targetPrice}
                    onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
                    placeholder="e.g. 1315"
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Exit Price</label>
                  <input
                    type="number"
                    step="0.05"
                    value={form.exitPrice}
                    onChange={(e) => setForm({ ...form, exitPrice: e.target.value })}
                    placeholder="e.g. 1310"
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 p-2 font-mono text-white border border-slate-800"
                  >
                    <option value="TARGET_HIT">Target Hit</option>
                    <option value="SL_HIT">Stoploss Hit</option>
                    <option value="OPEN">Still Open</option>
                    <option value="CLOSED">Manual Exit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes / Rationale</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Order block reaction, liquidity sweep observation..."
                  className="w-full rounded-lg bg-slate-950 p-2 text-white border border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-4 py-2 font-bold text-black hover:bg-cyan-400"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete trade entry?"
        message="This entry will be permanently removed from your Trade Log. This cannot be undone."
        confirmLabel="Delete Trade"
        cancelLabel="Keep Entry"
        danger
        loading={deleting}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
