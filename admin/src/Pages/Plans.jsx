import React, { useMemo, useState } from 'react';
import {
  Sliders,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Shield,
  Activity,
  PenLine,
  LayoutDashboard
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';

const DURATION_OPTIONS = [
  { months: 1, label: '1 Month', days: 30 },
  { months: 3, label: '3 Months', days: 90 },
  { months: 6, label: '6 Months', days: 180 },
  { months: 12, label: '12 Months', days: 360 }
];

const TF_OPTIONS = ['1m', '5m', '15m'];

const emptyForm = () => ({
  name: '',
  price: 1999,
  durationMonths: 1,
  durationDays: 30,
  badge: 'Monthly',
  featured: false,
  enabled: true,
  sortOrder: 1,
  maxStocks: 30,
  timeframesAllowed: ['5m', '15m'],
  maxTradeLog: 30,
  allowTerminal: true,
  allowMarketXRay: true,
  allowTradeLog: true,
  allowFullFVG: true,
  description: ''
});

function FeatureToggle({ label, icon: Icon, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 cursor-pointer hover:border-slate-700">
      <span className="flex items-center gap-2 text-[11px] text-slate-300">
        {Icon && <Icon className="h-3.5 w-3.5 text-amber-400" />}
        {label}
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500"
      />
    </label>
  );
}

function PlanFormFields({ form, setForm }) {
  const setDuration = (months) => {
    const opt = DURATION_OPTIONS.find((d) => d.months === months) || DURATION_OPTIONS[0];
    setForm({
      ...form,
      durationMonths: opt.months,
      durationDays: opt.days
    });
  };

  const toggleTf = (tf) => {
    const has = form.timeframesAllowed?.includes(tf);
    const next = has
      ? form.timeframesAllowed.filter((t) => t !== tf)
      : [...(form.timeframesAllowed || []), tf];
    setForm({ ...form, timeframesAllowed: next });
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className="text-slate-400 block mb-1">Plan Name</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. 3 Months Access"
          className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 block mb-1">Price (₹)</label>
          <input
            type="number"
            required
            min={0}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1">Duration</label>
          <select
            value={form.durationMonths}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.months} value={d.months}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 block mb-1">Badge</label>
          <input
            type="text"
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            placeholder="Popular / Flagship"
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          />
        </div>
      </div>

      <div>
        <label className="text-slate-400 block mb-1">Short Description</label>
        <input
          type="text"
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Shown on pricing page"
          className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 space-y-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Data Access Limits
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 block mb-1">Max Stocks</label>
            <input
              type="number"
              min={0}
              value={form.maxStocks}
              onChange={(e) => setForm({ ...form, maxStocks: Number(e.target.value) })}
              className="w-full rounded-xl bg-slate-900 p-2.5 text-white border border-slate-800"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Trade Log Limit</label>
            <input
              type="number"
              min={0}
              value={form.maxTradeLog}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxTradeLog: Number(e.target.value),
                  maxJournal: Number(e.target.value)
                })
              }
              className="w-full rounded-xl bg-slate-900 p-2.5 text-white border border-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-400 block mb-1.5">Allowed Timeframes</label>
          <div className="flex flex-wrap gap-2">
            {TF_OPTIONS.map((tf) => {
              const on = form.timeframesAllowed?.includes(tf);
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => toggleTf(tf)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold border ${
                    on
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Feature Enable / Disable
        </div>
        <FeatureToggle
          label="Live Terminal"
          icon={LayoutDashboard}
          checked={form.allowTerminal}
          onChange={(v) => setForm({ ...form, allowTerminal: v })}
        />
        <FeatureToggle
          label="Market X-Ray"
          icon={Activity}
          checked={form.allowMarketXRay}
          onChange={(v) => setForm({ ...form, allowMarketXRay: v })}
        />
        <FeatureToggle
          label="Trade Log"
          icon={PenLine}
          checked={form.allowTradeLog}
          onChange={(v) => setForm({ ...form, allowTradeLog: v })}
        />
        <FeatureToggle
          label="Full FVG / Advanced Zones"
          icon={Shield}
          checked={form.allowFullFVG}
          onChange={(v) => setForm({ ...form, allowFullFVG: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FeatureToggle
          label="Plan Enabled (show on website)"
          icon={form.enabled ? Eye : EyeOff}
          checked={form.enabled}
          onChange={(v) => setForm({ ...form, enabled: v })}
        />
        <FeatureToggle
          label="Featured highlight"
          checked={form.featured}
          onChange={(v) => setForm({ ...form, featured: v })}
        />
      </div>
    </div>
  );
}

export default function Plans() {
  const { plansList, createPlan, updatePlan, deletePlan } = useAdmin();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const sortedPlans = useMemo(
    () => [...(plansList || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [plansList]
  );

  const openCreate = () => {
    setForm(emptyForm());
    setShowAddModal(true);
  };

  const openEdit = (plan) => {
    setEditingPlan({
      ...emptyForm(),
      ...plan,
      timeframesAllowed: plan.timeframesAllowed ||
        String(plan.timeframes || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      maxTradeLog: plan.maxTradeLog ?? plan.maxJournal ?? 30,
      allowTerminal: plan.allowTerminal !== false,
      allowMarketXRay: plan.allowMarketXRay !== false,
      allowTradeLog: plan.allowTradeLog !== false,
      allowFullFVG: plan.allowFullFVG !== false,
      enabled: plan.enabled !== false
    });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.timeframesAllowed?.length) {
      alert('Select at least one timeframe');
      return;
    }
    await createPlan({
      ...form,
      timeframes: form.timeframesAllowed.join(', '),
      maxJournal: form.maxTradeLog
    });
    setShowAddModal(false);
    setForm(emptyForm());
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (!editingPlan.timeframesAllowed?.length) {
      alert('Select at least one timeframe');
      return;
    }
    await updatePlan(editingPlan.id, {
      ...editingPlan,
      timeframes: editingPlan.timeframesAllowed.join(', '),
      maxJournal: editingPlan.maxTradeLog
    });
    setEditingPlan(null);
  };

  const toggleEnabled = async (plan) => {
    await updatePlan(plan.id, { ...plan, enabled: !(plan.enabled !== false) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center">
            <Sliders className="mr-2 h-5 w-5 text-amber-400" />
            Membership Plans Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Set 1 / 3 / 6 / 12 month plans, prices, data limits, and which features are enabled for each membership.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-black hover:opacity-90 shadow-md shadow-amber-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>Create Membership Plan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {sortedPlans.map((plan) => {
          const enabled = plan.enabled !== false;
          const tfs = plan.timeframesAllowed || String(plan.timeframes || '').split(',').map((t) => t.trim());
          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-5 flex flex-col justify-between space-y-4 shadow-xl ${
                plan.featured
                  ? 'border-amber-500/70 bg-gradient-to-b from-slate-900 to-[#0c1222]'
                  : 'border-slate-800 bg-slate-900/60'
              } ${!enabled ? 'opacity-60' : ''}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-slate-700">
                    {plan.badge || 'Plan'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(plan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                      title={enabled ? 'Disable on website' : 'Enable on website'}
                    >
                      {enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(plan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(plan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-2xl font-extrabold text-white">
                    ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    / {plan.durationMonths || Math.round((plan.durationDays || 30) / 30)} mo
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stocks</span>
                    <span className="font-mono font-bold text-white">{plan.maxStocks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timeframes</span>
                    <span className="font-mono text-cyan-300">{tfs.join(', ') || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trade Log</span>
                    <span className="font-mono font-bold text-white">
                      {(plan.maxTradeLog ?? plan.maxJournal) > 500
                        ? 'Unlimited'
                        : plan.maxTradeLog ?? plan.maxJournal}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {plan.allowTerminal !== false && (
                      <span className="rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/50 px-1.5 py-0.5 text-[9px] font-bold">
                        Terminal
                      </span>
                    )}
                    {plan.allowMarketXRay !== false && (
                      <span className="rounded bg-cyan-950/60 text-cyan-400 border border-cyan-900/50 px-1.5 py-0.5 text-[9px] font-bold">
                        X-Ray
                      </span>
                    )}
                    {plan.allowTradeLog !== false && (
                      <span className="rounded bg-amber-950/60 text-amber-400 border border-amber-900/50 px-1.5 py-0.5 text-[9px] font-bold">
                        Trade Log
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`rounded-xl px-2.5 py-2 text-center text-[10px] font-bold uppercase tracking-wide border ${
                  enabled
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {enabled ? 'Enabled on website' : 'Disabled — hidden from pricing'}
              </div>
            </div>
          );
        })}
      </div>

      {sortedPlans.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
          No membership plans yet. Create 1 / 3 / 6 / 12 month plans to show on the website.
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Plus className="mr-2 h-4 w-4 text-amber-400" />
                Create Membership Plan
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <PlanFormFields form={form} setForm={setForm} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-amber-500 px-5 py-2 font-bold text-black">
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Edit className="mr-2 h-4 w-4 text-cyan-400" />
                Edit Membership Plan
              </h3>
              <button type="button" onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <PlanFormFields form={editingPlan} setForm={setEditingPlan} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditingPlan(null)} className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-black inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete membership plan?"
        message={`Remove plan "${deleteTarget?.name || ''}" permanently. Already subscribed traders keep their current access until expiry.`}
        confirmLabel="Delete Plan"
        cancelLabel="Keep Plan"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePlan(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
