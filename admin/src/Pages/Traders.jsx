import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, Plus, Search, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import { downloadCsv, parseCsv, pickFileAsText } from '../lib/csv';
import { importAdminUsersApi } from '../services/api';

const USER_CSV_HEADERS = [
  'name',
  'email',
  'role',
  'plan',
  'status',
  'expiresAt',
  'password',
  'durationDays'
];

function isStaffRole(role) {
  return role === 'admin' || role === 'subadmin';
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return <span className="admin-chip border-rose-800/50 bg-rose-950/60 text-rose-300">Admin</span>;
  }
  if (role === 'subadmin') {
    return <span className="admin-chip border-sky-800/50 bg-sky-950/60 text-sky-300">Sub-Admin</span>;
  }
  return <span className="admin-chip border-admin-border bg-admin-bg text-admin-muted">Trader</span>;
}

function StatusBadge({ user }) {
  const isExpired = new Date(user.subscription?.expiresAt) < new Date();
  if (isExpired) {
    return <span className="admin-chip border-rose-800/50 bg-rose-950/60 text-rose-300">Expired</span>;
  }
  if (user.subscription?.status === 'active') {
    return <span className="admin-chip border-emerald-800/50 bg-emerald-950/60 text-emerald-300">Active</span>;
  }
  if (user.subscription?.status === 'trial') {
    return <span className="admin-chip border-amber-800/50 bg-amber-950/60 text-amber-300">Trial</span>;
  }
  return <span className="admin-chip border-admin-border bg-admin-bg text-admin-muted">Inactive</span>;
}

function UsersTable({ rows, isStaff, isSubAdmin, onExtend, onDelete }) {
  return (
    <div className="admin-table-wrap overflow-x-auto">
      <table className="admin-table min-w-[900px]">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            {!isStaff && <th>Plan</th>}
            {!isStaff && <th>Status</th>}
            {!isStaff && <th>Expires</th>}
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u._id}>
              <td className="font-medium text-white">{u.name}</td>
              <td className="text-admin-muted">{u.email}</td>
              <td>
                <RoleBadge role={u.role} />
              </td>
              {!isStaff && (
                <>
                  <td className="text-slate-300">{u.subscription?.plan || '—'}</td>
                  <td>
                    <StatusBadge user={u} />
                  </td>
                  <td className="font-mono text-xs text-admin-muted">
                    {u.subscription?.expiresAt
                      ? new Date(u.subscription.expiresAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : '—'}
                  </td>
                </>
              )}
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {!isStaff && (
                    <>
                      <button
                        type="button"
                        onClick={() => onExtend(u._id, { status: 'active', extendDays: 30 })}
                        className="admin-btn-ghost px-2 py-1 text-xs"
                        title="Grant +30 days"
                      >
                        +30d
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onExtend(u._id, {
                            status: 'active',
                            plan: '12 Months Pro Bundle',
                            extendDays: 365
                          })
                        }
                        className="admin-btn-ghost px-2 py-1 text-xs text-admin-success"
                        title="Grant 1 year"
                      >
                        +1y
                      </button>
                    </>
                  )}
                  <Link to={`/traders/${u._id}/edit`} className="admin-btn-ghost p-1.5" title="Edit">
                    <Edit className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(u)}
                    className="admin-btn-ghost p-1.5 hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={isStaff ? 4 : 7} className="px-4 py-10 text-center text-admin-muted">
                {isStaff ? 'No admins found.' : 'No traders found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Traders() {
  const { adminUser, usersList, stats, deleteUser, extendUserSub, showToast, refreshData } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';
  const [tab, setTab] = useState('traders');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyIo, setBusyIo] = useState(false);

  const traders = useMemo(() => usersList.filter((u) => !isStaffRole(u.role)), [usersList]);
  const admins = useMemo(() => usersList.filter((u) => isStaffRole(u.role)), [usersList]);

  const activeList = tab === 'admins' ? admins : traders;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [activeList, search]);

  const traderStats = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let trial = 0;
    for (const u of traders) {
      const status = u.subscription?.status;
      const exp = u.subscription?.expiresAt ? new Date(u.subscription.expiresAt).getTime() : 0;
      if (status === 'active' && exp > now) active += 1;
      if (status === 'trial' && exp > now) trial += 1;
    }
    return { total: traders.length, active, trial };
  }, [traders]);

  const handleExport = () => {
    const source = search.trim() ? filtered : activeList;
    const rows = source.map((u) => ({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'user',
      plan: u.subscription?.plan || '',
      status: u.subscription?.status || '',
      expiresAt: u.subscription?.expiresAt || '',
      password: '',
      durationDays: ''
    }));
    const label = tab === 'admins' ? 'admins' : 'traders';
    downloadCsv(
      `tradrift-${label}-${new Date().toISOString().slice(0, 10)}.csv`,
      USER_CSV_HEADERS,
      rows
    );
    showToast?.(`Exported ${rows.length} ${label}.`);
  };

  const handleImport = async () => {
    if (isSubAdmin) {
      showToast?.('Only Super Admin can import accounts.');
      return;
    }
    try {
      const { text } = await pickFileAsText();
      const { rows } = parseCsv(text);
      if (!rows.length) {
        showToast?.('CSV has no data rows.');
        return;
      }
      setBusyIo(true);
      const res = await importAdminUsersApi(rows);
      if (!res?.success) throw new Error(res?.message || 'Import failed.');
      showToast?.(res.message || 'Import complete.');
      await refreshData?.();
    } catch (err) {
      if (String(err?.message || '').includes('No file')) return;
      showToast?.(err.userMessage || err.message || 'Could not import accounts.');
    } finally {
      setBusyIo(false);
    }
  };

  const requestDelete = (u) => {
    if (isSubAdmin) {
      showToast('Deleting accounts is Super Admin only.');
      return;
    }
    setDeleteTarget(u);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === 'admins' ? 'Admins' : 'Traders'}
        description={
          tab === 'admins'
            ? 'Super Admin and Sub-Admin accounts (separate from traders).'
            : 'Customer trader accounts and membership access.'
        }
        icon={tab === 'admins' ? Shield : Users}
        actions={
          <>
            <button type="button" disabled={busyIo} onClick={handleImport} className="admin-btn-secondary">
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button type="button" disabled={busyIo} onClick={handleExport} className="admin-btn-secondary">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <Link to="/traders/new" className="admin-btn-primary">
              <Plus className="h-4 w-4" />
              {tab === 'admins' ? 'Add admin' : 'Add trader'}
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-admin-border bg-admin-bg p-1 w-fit">
        <button
          type="button"
          onClick={() => {
            setTab('traders');
            setSearch('');
          }}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'traders'
              ? 'bg-admin-accent text-admin-bg'
              : 'text-admin-muted hover:bg-admin-surface hover:text-white'
          }`}
        >
          Traders
          <span className="ml-1.5 opacity-80">{traders.length}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('admins');
            setSearch('');
          }}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'admins'
              ? 'bg-admin-accent text-admin-bg'
              : 'text-admin-muted hover:bg-admin-surface hover:text-white'
          }`}
        >
          Admins
          <span className="ml-1.5 opacity-80">{admins.length}</span>
        </button>
      </div>

      {tab === 'traders' ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Total traders</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-white">{traderStats.total}</div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Active</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-admin-success">
              {traderStats.active}
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Trials</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-admin-warn">{traderStats.trial}</div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Est. MRR</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-admin-accent">
              ₹{Number(stats.estimatedMRR || 0).toLocaleString('en-IN')}
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Total staff</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-white">{admins.length}</div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Super Admins</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-rose-300">
              {admins.filter((u) => u.role === 'admin').length}
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-admin-muted">Sub-Admins</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-sky-300">
              {admins.filter((u) => u.role === 'subadmin').length}
            </div>
          </Panel>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
        <input
          type="text"
          placeholder={tab === 'admins' ? 'Search admin name or email...' : 'Search trader name or email...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input pl-10"
        />
      </div>

      <UsersTable
        rows={filtered}
        isStaff={tab === 'admins'}
        isSubAdmin={isSubAdmin}
        onExtend={extendUserSub}
        onDelete={requestDelete}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={isStaffRole(deleteTarget?.role) ? 'Remove admin?' : 'Remove trader?'}
        message={`Permanently remove ${deleteTarget?.name || 'this account'} (${deleteTarget?.email || ''}). This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteUser(deleteTarget._id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
