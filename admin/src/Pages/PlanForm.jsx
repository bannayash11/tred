import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Eye,
  EyeOff,
  Shield,
  Activity,
  LayoutDashboard
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

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
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-admin-border bg-admin-bg px-3 py-2.5 hover:border-admin-accent/30">
      <span className="flex items-center gap-2 text-sm text-slate-300">
        {Icon ? <Icon className="h-3.5 w-3.5 text-admin-accent" /> : null}
        {label}
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-admin-accent"
      />
    </label>
  );
}

function validatePlan(plan) {
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
}

export default function PlanForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { plansList, createPlan, updatePlan, showToast } = useAdmin();

  const existing = useMemo(
    () => (isEdit ? plansList.find((p) => String(p.id) === String(id)) : null),
    [isEdit, plansList, id]
  );

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !existing) return;
    setForm({
      ...emptyForm(),
      ...existing,
      mode: existing.mode === 'byok' ? 'byok' : 'server',
      originalPrice: Number(existing.originalPrice) || 0,
      price: Number(existing.price) || 0,
      timeframesAllowed:
        existing.timeframesAllowed ||
        String(existing.timeframes || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      allowTerminal: existing.allowTerminal !== false,
      allowMarketXRay: existing.allowMarketXRay !== false,
      allowFullFVG: existing.allowFullFVG !== false,
      enabled: existing.enabled !== false
    });
  }, [isEdit, existing]);

  if (isEdit && plansList.length > 0 && !existing) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-admin-muted">Plan not found.</p>
        <Link to="/plans" className="admin-btn-secondary mt-4">
          Back to plans
        </Link>
      </Panel>
    );
  }

  const setDuration = (months) => {
    const opt = DURATION_OPTIONS.find((d) => d.months === months) || DURATION_OPTIONS[0];
    setForm((prev) => ({
      ...prev,
      durationMonths: opt.months,
      durationDays: opt.days
    }));
  };

  const toggleTf = (tf) => {
    setForm((prev) => {
      const has = prev.timeframesAllowed?.includes(tf);
      const next = has
        ? prev.timeframesAllowed.filter((t) => t !== tf)
        : [...(prev.timeframesAllowed || []), tf];
      return { ...prev, timeframesAllowed: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validatePlan(form);
    if (msg) {
      showToast?.(msg);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: String(form.name).trim(),
        timeframes: form.timeframesAllowed.join(', ')
      };
      if (isEdit) {
        await updatePlan(existing.id, payload);
        showToast?.('Plan updated.');
      } else {
        await createPlan(payload);
        showToast?.('Plan created.');
      }
      navigate('/plans');
    } catch (err) {
      showToast?.(err?.userMessage || 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={isEdit ? 'Edit plan' : 'Create plan'}
        description="Set pricing, duration, feed mode, and feature access."
        icon={isEdit ? Save : Plus}
        actions={
          <Link to="/plans" className="admin-btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <Panel className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="admin-label">Plan name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="admin-input"
              placeholder="e.g. 3 Months Access"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Original / MRP (₹)</label>
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
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Offer price (₹)</label>
              <input
                type="number"
                required
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Duration</label>
              <select
                value={form.durationMonths}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="admin-input"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.months} value={d.months}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Feed mode</label>
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
                className="admin-input"
              >
                <option value="server">Server feed</option>
                <option value="byok">BYOK</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Badge</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="admin-input"
              />
            </div>
          </div>

          <div>
            <label className="admin-label">Short description</label>
            <input
              type="text"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="admin-input"
              placeholder="Shown on pricing page"
            />
          </div>

          <div className="rounded-lg border border-admin-border bg-admin-bg/50 p-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-admin-muted">
              Access limits
            </div>
            <div>
              <label className="admin-label">Max stocks</label>
              <input
                type="number"
                min={0}
                value={form.maxStocks}
                onChange={(e) => setForm({ ...form, maxStocks: Number(e.target.value) })}
                className="admin-input max-w-xs"
              />
            </div>
            <div>
              <label className="admin-label">Timeframes</label>
              <div className="flex flex-wrap gap-2">
                {TF_OPTIONS.map((tf) => {
                  const on = form.timeframesAllowed?.includes(tf);
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => toggleTf(tf)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                        on
                          ? 'border-admin-accent/40 bg-admin-accent/15 text-admin-accent'
                          : 'border-admin-border bg-admin-surface text-admin-muted'
                      }`}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-admin-muted">
              Features
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FeatureToggle
              label="Enabled on website"
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

          <div className="flex justify-end gap-2 border-t border-admin-border pt-4">
            <Link to="/plans" className="admin-btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="admin-btn-primary">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : isEdit ? 'Save plan' : 'Create plan'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
