import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sliders, Plus, Edit, Trash2, Eye, EyeOff, KeyRound, Gift } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

export default function Plans() {
  const {
    adminUser,
    plansList,
    updatePlan,
    deletePlan,
    showToast,
    systemSettings,
    saveByokSales,
    saveFreeTrial
  } = useAdmin();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [byokSaving, setByokSaving] = useState(false);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialDaysDraft, setTrialDaysDraft] = useState(() => systemSettings?.freeTrialDays || 14);

  useEffect(() => {
    if (systemSettings?.freeTrialDays) setTrialDaysDraft(systemSettings.freeTrialDays);
  }, [systemSettings?.freeTrialDays]);

  const byokSalesEnabled = systemSettings?.byokSalesEnabled !== false;
  const freeTrialEnabled = !!systemSettings?.freeTrialEnabled;
  const freeTrialDays = systemSettings?.freeTrialDays || 14;
  const isSuperAdmin = adminUser?.role === 'admin';

  const sortedPlans = useMemo(
    () => [...(plansList || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [plansList]
  );

  const toggleByokSales = async () => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can change BYOK sales.');
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

  const toggleEnabled = async (plan) => {
    await updatePlan(plan.id, { ...plan, enabled: !(plan.enabled !== false) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Membership pricing, trial settings, and feature access."
        icon={Sliders}
        actions={
          <>
            <button
              type="button"
              disabled={trialSaving || !isSuperAdmin}
              onClick={toggleFreeTrial}
              className={`admin-btn-secondary ${freeTrialEnabled ? 'border-emerald-700 text-emerald-300' : ''}`}
            >
              <Gift className="h-3.5 w-3.5" />
              Trial {freeTrialEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              disabled={byokSaving || !isSuperAdmin}
              onClick={toggleByokSales}
              className={`admin-btn-secondary ${
                byokSalesEnabled ? 'border-emerald-700 text-emerald-300' : 'border-rose-800 text-rose-300'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              BYOK {byokSalesEnabled ? 'ON' : 'OFF'}
            </button>
            <Link to="/plans/new" className="admin-btn-primary">
              <Plus className="h-4 w-4" />
              Create plan
            </Link>
          </>
        }
      />

      <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Free trial for new signups</div>
          <p className="mt-1 text-xs text-admin-muted">
            Default is OFF. Existing users are not changed when you toggle this.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-admin-muted">Days</label>
          <input
            type="number"
            min={1}
            max={90}
            disabled={!isSuperAdmin || trialSaving}
            value={trialDaysDraft}
            onChange={(e) => setTrialDaysDraft(e.target.value)}
            className="admin-input w-20 font-mono"
          />
          <button
            type="button"
            disabled={!isSuperAdmin || trialSaving}
            onClick={saveTrialDays}
            className="admin-btn-secondary"
          >
            Save
          </button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedPlans.map((plan) => {
          const enabled = plan.enabled !== false;
          const tfs =
            plan.timeframesAllowed ||
            String(plan.timeframes || '')
              .split(',')
              .map((t) => t.trim());
          return (
            <Panel
              key={plan.id}
              className={`flex flex-col justify-between space-y-4 p-5 ${
                plan.featured ? 'border-admin-accent/40' : ''
              } ${!enabled ? 'opacity-60' : ''}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="admin-chip border-admin-border bg-admin-bg text-admin-accent">
                      {plan.badge || 'Plan'}
                    </span>
                    <span className="admin-chip border-admin-border bg-admin-bg text-admin-muted">
                      {plan.mode === 'byok' ? 'BYOK' : 'SERVER'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(plan)}
                      className="admin-btn-ghost p-1.5"
                      title={enabled ? 'Disable' : 'Enable'}
                    >
                      {enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <Link to={`/plans/${plan.id}/edit`} className="admin-btn-ghost p-1.5" title="Edit">
                      <Edit className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(plan)}
                      className="admin-btn-ghost p-1.5 hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono">
                  {Number(plan.originalPrice) > Number(plan.price) && (
                    <span className="text-sm text-admin-muted line-through">
                      ₹{Number(plan.originalPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                  <span className="text-2xl font-semibold text-white">
                    ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-admin-muted">
                    / {plan.durationMonths || Math.round((plan.durationDays || 30) / 30)} mo
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-admin-border pt-3 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-admin-muted">Stocks</span>
                    <span className="font-mono font-semibold text-white">{plan.maxStocks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-admin-muted">Timeframes</span>
                    <span className="font-mono text-admin-accent">{tfs.join(', ') || '—'}</span>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-lg px-2.5 py-2 text-center text-[11px] font-semibold uppercase tracking-wide border ${
                  enabled
                    ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-admin-border bg-admin-bg text-admin-muted'
                }`}
              >
                {enabled ? 'Live on website' : 'Hidden from pricing'}
              </div>
            </Panel>
          );
        })}
      </div>

      {sortedPlans.length === 0 && (
        <Panel className="border-dashed p-10 text-center text-sm text-admin-muted">
          No plans yet. Create a plan to show on the website.
        </Panel>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete plan?"
        message={`Remove plan "${deleteTarget?.name || ''}". Existing subscribers keep access until expiry.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
