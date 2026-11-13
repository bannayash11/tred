import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Upload,
  Settings2
} from 'lucide-react';
import {
  fetchAdminPayments,
  importAdminPaymentsApi,
  approveUtrPaymentApi,
  rejectUtrPaymentApi
} from '../services/api';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import { downloadCsv, parseCsv, pickFileAsText } from '../lib/csv';

const TABS = [
  { id: 'all', label: 'All', status: '' },
  { id: 'pending', label: 'UTR Pending', status: 'pending' },
  { id: 'paid', label: 'Paid', status: 'paid' },
  { id: 'failed', label: 'Failed', status: 'failed' },
  { id: 'created', label: 'Created', status: 'created' }
];

const PAYMENT_CSV_HEADERS = [
  'orderId',
  'paymentId',
  'utr',
  'amount',
  'currency',
  'status',
  'gateway',
  'paymentMethod',
  'planId',
  'planName',
  'customerName',
  'customerEmail',
  'customerPhone',
  'membershipActivated',
  'failureReason',
  'adminNote',
  'createdAt'
];

function formatInr(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function StatusBadge({ status }) {
  const map = {
    paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    created: 'border-admin-border bg-admin-bg text-admin-accent',
    pending: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  };
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        map[status] || 'bg-slate-800 text-slate-300 border-slate-700'
      }`}
    >
      {status || 'unknown'}
    </span>
  );
}

function MethodBadge({ method, gateway }) {
  const label = String(method || gateway || '').toUpperCase() || '—';
  if (label === '—') return <span className="text-[11px] text-slate-500">—</span>;
  const tone =
    gateway === 'utr' || method === 'upi'
      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
      : method === 'card'
        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700';
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {gateway === 'utr' ? `UTR${method ? ` · ${label}` : ''}` : label}
    </span>
  );
}

function SummaryCard({ title, value, icon: Icon, accent }) {
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-muted">{title}</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Panel>
  );
}

function paymentToCsvRow(p) {
  return {
    orderId: p.orderId || '',
    paymentId: p.paymentId || '',
    utr: p.utr || '',
    amount: p.amount ?? '',
    currency: p.currency || 'INR',
    status: p.status || '',
    gateway: p.gateway || '',
    paymentMethod: p.paymentMethod || '',
    planId: p.planId || '',
    planName: p.planName || '',
    customerName: p.customerDetails?.name || '',
    customerEmail: p.customerDetails?.email || '',
    customerPhone: p.customerDetails?.phone || '',
    membershipActivated: p.membershipActivated ? 'true' : 'false',
    failureReason: p.failureReason || '',
    adminNote: p.adminNote || '',
    createdAt: p.createdAt || ''
  };
}

export default function PaymentHistory() {
  const { showToast, adminUser } = useAdmin();
  const isSuperAdmin = adminUser?.role === 'admin';
  const [tab, setTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyIo, setBusyIo] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalSuccessCount: 0,
    totalFailedCount: 0,
    totalPendingCount: 0,
    utrPendingCount: 0
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const activeStatus = useMemo(() => TABS.find((t) => t.id === tab)?.status || '', [tab]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminPayments({
        status: activeStatus || undefined,
        search: search || undefined,
        page,
        limit: 20
      });
      if (!res?.success) throw new Error(res?.message || 'Failed to load payments.');
      setPayments(res.payments || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      setSummary(
        res.summary || {
          totalRevenue: 0,
          totalSuccessCount: 0,
          totalFailedCount: 0,
          totalPendingCount: 0,
          utrPendingCount: 0
        }
      );
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, search, page, showToast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleExport = async () => {
    setBusyIo(true);
    try {
      const res = await fetchAdminPayments({
        status: activeStatus || undefined,
        search: search || undefined,
        page: 1,
        limit: 5000,
        export: 1
      });
      if (!res?.success) throw new Error(res?.message || 'Export failed.');
      const rows = (res.payments || []).map(paymentToCsvRow);
      downloadCsv(
        `tradrift-payments-${new Date().toISOString().slice(0, 10)}.csv`,
        PAYMENT_CSV_HEADERS,
        rows
      );
      showToast?.(`Exported ${rows.length} payment rows.`);
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not export payments.');
    } finally {
      setBusyIo(false);
    }
  };

  const handleImport = async () => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can import payments.');
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
      const res = await importAdminPaymentsApi(rows);
      if (!res?.success) throw new Error(res?.message || 'Import failed.');
      showToast?.(res.message || 'Import complete.');
      await loadPayments();
    } catch (err) {
      if (String(err?.message || '').includes('No file')) return;
      showToast?.(err.userMessage || err.message || 'Could not import payments.');
    } finally {
      setBusyIo(false);
    }
  };

  const handleApprove = async (payment) => {
    const id = payment._id;
    if (!id) return;
    const note = window.prompt('Optional note (visible internally):', '') ?? '';
    setActionId(id);
    try {
      const res = await approveUtrPaymentApi(id, { adminNote: note.trim() });
      if (!res?.success) throw new Error(res?.message || 'Approve failed.');
      showToast?.(res.message || 'UTR approved. Membership activated.');
      await loadPayments();
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not approve UTR.');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (payment) => {
    const id = payment._id;
    if (!id) return;
    const reason = window.prompt('Reject reason (shown on payment record):', 'UTR not found / amount mismatch');
    if (reason == null) return;
    setActionId(id);
    try {
      const res = await rejectUtrPaymentApi(id, { reason: String(reason).trim() });
      if (!res?.success) throw new Error(res?.message || 'Reject failed.');
      showToast?.(res.message || 'UTR rejected.');
      await loadPayments();
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not reject UTR.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment history"
        description="Razorpay orders and manual UTR verification records."
        icon={CreditCard}
        actions={
          <>
            <Link to="/payments/settings" className="admin-btn-secondary">
              <Settings2 className="h-4 w-4" />
              Settings
            </Link>
            <button type="button" disabled={busyIo} onClick={handleImport} className="admin-btn-secondary">
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button type="button" disabled={busyIo} onClick={handleExport} className="admin-btn-secondary">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" onClick={loadPayments} className="admin-btn-secondary">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Revenue"
          value={formatInr(summary.totalRevenue)}
          icon={IndianRupee}
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <SummaryCard
          title="Successful Payments"
          value={summary.totalSuccessCount}
          icon={CheckCircle2}
          accent="bg-cyan-500/15 text-cyan-400"
        />
        <SummaryCard
          title="Failed Payments"
          value={summary.totalFailedCount}
          icon={XCircle}
          accent="bg-rose-500/15 text-rose-400"
        />
        <SummaryCard
          title="Pending (UTR)"
          value={summary.utrPendingCount ?? summary.totalPendingCount}
          icon={Clock3}
          accent="bg-admin-accent/15 text-admin-accent"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-admin-border bg-admin-bg p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-admin-accent text-admin-bg'
                  : 'text-admin-muted hover:bg-admin-surface hover:text-white'
              }`}
            >
              {t.label}
              {t.id === 'pending' && summary.utrPendingCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {summary.utrPendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Order ID, UTR, Payment ID, or Email…"
            className="admin-input pl-10"
          />
        </div>
      </div>

      <div className="admin-table-wrap overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-admin-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Order / UTR / Payment</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Failure / Note</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading payments…
                    </span>
                  </td>
                </tr>
              )}

              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                    No payments found for this filter.
                  </td>
                </tr>
              )}

              {!loading &&
                payments.map((p) => {
                  const busy = actionId === p._id;
                  const canReview = p.gateway === 'utr' && p.status === 'pending';
                  return (
                    <tr key={p._id || p.orderId}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-white">
                          {p.customerDetails?.name || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">{p.customerDetails?.email || '—'}</div>
                        {p.planName ? <div className="text-[11px] text-slate-500">{p.planName}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] text-slate-200">{p.orderId}</div>
                        {p.utr ? (
                          <div className="font-mono text-[11px] font-bold text-cyan-300">UTR: {p.utr}</div>
                        ) : (
                          <div className="font-mono text-[11px] text-slate-500">{p.paymentId || '—'}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white">
                        {formatInr(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={p.paymentMethod} gateway={p.gateway} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                        {p.membershipActivated ? (
                          <div className="mt-1 text-[10px] font-semibold text-emerald-400">Activated</div>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {p.status === 'failed' && p.failureReason ? (
                          <span title={p.failureReason} className="line-clamp-2 cursor-help text-[11px] text-rose-300">
                            {p.failureReason}
                          </span>
                        ) : p.adminNote ? (
                          <span className="line-clamp-2 text-[11px] text-slate-400">{p.adminNote}</span>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canReview ? (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove(p)}
                              className="admin-btn-ghost border-emerald-800/50 text-[10px] !text-emerald-300 disabled:opacity-50"
                            >
                              {busy ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleReject(p)}
                              className="admin-btn-danger px-2.5 py-1 text-[10px] disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-admin-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-admin-muted">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="admin-btn-secondary text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="admin-btn-secondary text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
