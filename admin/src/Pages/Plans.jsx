import React, { useEffect, useMemo, useState } from 'react';
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
  LayoutDashboard,
  KeyRound,
  Gift
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
  originalPrice: 499,
  price: 350,
  durationMonths: 1,
  durationDays: 30,
  badge: 'Monthly',
  mode: 'server',
  featured: false,
  enabled: true,
  sortOrder: 1,
  maxStocks: 200,
  timeframesAllowed: ['1m', '5m', '15m'],
  allowTerminal: true,
  allowMarketXRay: true,
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
          <label className="text-slate-400 block mb-1">Original price / MRP (₹)</label>
          <input
            type="number"
            min={0}
            value={form.originalPrice ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                originalPrice: e.target.value === '' ? 0 : Number(e.target.value)
              })
            }
            placeholder="e.g. 499"
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          />
          <p className="text-[10px] text-slate-500 mt-1">Strike-through on website (optional)</p>
        </div>
        <div>
          <label className="text-slate-400 block mb-1">Offer / pay price (₹)</label>
          <input
            type="number"
            required
            min={0}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
          />
          <p className="text-[10px] text-emerald-500/80 mt-1">
            {Number(form.originalPrice) > Number(form.price) && Number(form.originalPrice) > 0
              ? `${Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)}% OFF offer`
              : 'User pays this amount'}
          </p>
        </div>
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

      <div>
        <label className="text-slate-400 block mb-1">Feed Mode</label>
        <select
          value={form.mode === 'byok' ? 'byok' : 'server'}
          onChange={(e) => {
            const mode = e.target.value;
            const byokOffers = {
              1: { originalPrice: 349, price: 250 },
              3: { originalPrice: 1047, price: 699 },
              6: { originalPrice: 2094, price: 1299 },
              12: { originalPrice: 4188, price: 2399 }
            };
            const serverOffers = {
              1: { originalPrice: 499, price: 350 },
              3: { originalPrice: 1497, price: 999 },
              6: { originalPrice: 2994, price: 1799 },
              12: { originalPrice: 5988, price: 3499 }
            };
            const suggested =
              (mode === 'byok' ? byokOffers : serverOffers)[form.durationMonths] ||
              (mode === 'byok' ? byokOffers[1] : serverOffers[1]);
            setForm({
              ...form,
              mode,
              badge: form.badge || (mode === 'byok' ? 'BYOK' : 'Hosted'),
              originalPrice: suggested.originalPrice,
              price: suggested.price
            });
          }}
          className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
        >
          <option value="server">Server feed (Tradrift keys) — base ₹350/mo</option>
          <option value="byok">BYOK (user Kotak Neo keys) — base ₹250/mo</option>
        </select>
        <p className="text-[10px] text-slate-500 mt-1">
          BYOK users paste Consumer Key, UCC, Mobile, MPIN & TOTP once at checkout. Secrets are encrypted on the server.
        </p>
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
  const {
    adminUser,
    plansList,
    createPlan,
    updatePlan,
    deletePlan,
    showToast,
    systemSettings,
    saveByokSales,
    saveFreeTrial
  } = useAdmin();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [byokSaving, setByokSaving] = useState(false);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialDaysDraft, setTrialDaysDraft] = useState(
    () => systemSettings?.freeTrialDays || 14
  );

  useEffect(() => {
    if (systemSettings?.freeTrialDays) {
      setTrialDaysDraft(systemSettings.freeTrialDays);
    }
  }, [systemSettings?.freeTrialDays]);

  const byokSalesEnabled = systemSettings?.byokSalesEnabled !== false;
  const freeTrialEnabled = !!systemSettings?.freeTrialEnabled;
  const freeTrialDays = systemSettings?.freeTrialDays || 14;
  const isSuperAdmin = adminUser?.role === 'admin';

  const toggleByokSales = async () => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can change BYOK sales permission.');
      return;
    }
    setByokSaving(true);
    try {
      await saveByokSales(!byokSalesEnabled);
    } finally {
      setByokSaving(false);
    }
  };

  const toggleFreeTrial = async () => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can change free trial.');
      return;
    }
    setTrialSaving(true);
    try {
      await saveFreeTrial({
        enabled: !freeTrialEnabled,
        days: Number(trialDaysDraft) || freeTrialDays || 14
      });
    } finally {
      setTrialSaving(false);
    }
  };

  const saveTrialDays = async () => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can change free trial.');
      return;
    }
    const days = Number(trialDaysDraft);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      showToast?.('Trial days must be between 1 and 90.');
      return;
    }
    setTrialSaving(true);
    try {
      await saveFreeTrial({ enabled: freeTrialEnabled, days });
    } finally {
      setTrialSaving(false);
    }
  };

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
      mode: plan.mode === 'byok' ? 'byok' : 'server',
      originalPrice: Number(plan.originalPrice) || 0,
      price: Number(plan.price) || 0,
      timeframesAllowed: plan.timeframesAllowed ||
        String(plan.timeframes || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      allowTerminal: plan.allowTerminal !== false,
      allowMarketXRay: plan.allowMarketXRay !== false,
      allowFullFVG: plan.allowFullFVG !== false,
      enabled: plan.enabled !== false
    });
  };

  const validatePlan = (plan) => {
    if (!String(plan.name || '').trim()) return 'Plan name is required.';
    if (!Number.isFinite(Number(plan.price)) || Number(plan.price) < 0) {
      return 'Enter a valid offer price (₹0 or more).';
    }
    if (
      plan.originalPrice !== undefined &&
      plan.originalPrice !== '' &&
      (!Number.isFinite(Number(plan.originalPrice)) || Number(plan.originalPrice) < 0)
    ) {
      return 'Original price must be ₹0 or more.';
    }
    if (Number(plan.originalPrice) > 0 && Number(plan.originalPrice) <= Number(plan.price)) {
      return 'Original / MRP must be higher than offer price (or leave MRP as 0).';
    }
    if (!Number.isFinite(Number(plan.maxStocks)) || Number(plan.maxStocks) < 0) {
      return 'Max stocks must be 0 or greater.';
    }
    if (!plan.timeframesAllowed?.length) return 'Select at least one timeframe.';
    return '';
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const msg = validatePlan(form);
    if (msg) {
      showToast?.(msg);
      return;
    }
    try {
      await createPlan({
        ...form,
        name: String(form.name).trim(),
        timeframes: form.timeframesAllowed.join(', ')
      });
      setShowAddModal(false);
      setForm(emptyForm());
    } catch (err) {
      showToast?.(err?.userMessage || 'Could not create plan. Please check details.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    const msg = validatePlan(editingPlan);
    if (msg) {
      showToast?.(msg);
      return;
    }
    try {
      await updatePlan(editingPlan.id, {
        ...editingPlan,
        name: String(editingPlan.name).trim(),
        timeframes: editingPlan.timeframesAllowed.join(', ')
      });
      setEditingPlan(null);
    } catch (err) {
      showToast?.(err?.userMessage || 'Could not update plan. Please check details.');
    }
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
            BYOK vs Server plans · Free trial default OFF (admin can enable). Existing members keep access when toggles change.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={trialSaving || !isSuperAdmin}
            onClick={toggleFreeTrial}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-bold border transition-colors ${
              freeTrialEnabled
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            } ${!isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
            title={
              isSuperAdmin
                ? 'Toggle free trial for new signups (default OFF)'
                : 'Super Admin only'
            }
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Free trial: {freeTrialEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <button
            type="button"
            disabled={byokSaving || !isSuperAdmin}
            onClick={toggleByokSales}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-bold border transition-colors ${
              byokSalesEnabled
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
                : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
            } ${!isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
            title={
              isSuperAdmin
                ? 'Toggle whether new users can buy BYOK plans'
                : 'Super Admin only'
            }
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>BYOK sales: {byokSalesEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-black hover:opacity-90 shadow-md shadow-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create Membership Plan</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-amber-400" />
            Free trial for new signups
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Default is <span className="text-rose-300 font-semibold">OFF</span>. When ON, only new
            registrations get a trial. Already-registered users are not changed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Days</label>
          <input
            type="number"
            min={1}
            max={90}
            disabled={!isSuperAdmin || trialSaving}
            value={trialDaysDraft}
            onChange={(e) => setTrialDaysDraft(e.target.value)}
            className="w-20 rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white font-mono"
          />
          <button
            type="button"
            disabled={!isSuperAdmin || trialSaving}
            onClick={saveTrialDays}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Save days
          </button>
        </div>
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-slate-700">
                      {plan.badge || 'Plan'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                        plan.mode === 'byok'
                          ? 'bg-violet-950/70 text-violet-300 border-violet-800/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {plan.mode === 'byok' ? 'BYOK' : 'SERVER'}
                    </span>
                  </div>
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono">
                  {Number(plan.originalPrice) > Number(plan.price) && (
                    <span className="text-sm text-slate-500 line-through">
                      ₹{Number(plan.originalPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                  <span className="text-2xl font-extrabold text-white">
                    ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    / {plan.durationMonths || Math.round((plan.durationDays || 30) / 30)} mo
                  </span>
                  {(plan.discountPercent > 0 ||
                    (Number(plan.originalPrice) > Number(plan.price) && Number(plan.originalPrice) > 0)) && (
                    <span className="rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 px-2 py-0.5 text-[9px] font-bold">
                      {plan.discountPercent ||
                        Math.round(
                          ((Number(plan.originalPrice) - Number(plan.price)) /
                            Number(plan.originalPrice)) *
                            100
                        )}
                      % OFF
                    </span>
                  )}
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
