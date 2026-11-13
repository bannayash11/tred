import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { fetchAdminPayments } from '../services/api';
import { useAdmin } from '../context/AdminContext';

const TABS = [
  { id: 'all', label: 'All', status: '' },
  { id: 'paid', label: 'Paid', status: 'paid' },
  { id: 'failed', label: 'Failed', status: 'failed' },
  { id: 'created', label: 'Created', status: 'created' }
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
    created: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
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

function MethodBadge({ method }) {
  if (!method) {
    return <span className="text-[11px] text-slate-500">—</span>;
  }
  const label = String(method).toUpperCase();
  const tone =
    method === 'upi'
      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
      : method === 'card'
        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700';
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

function SummaryCard({ title, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-extrabold text-white tabular-nums">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const { showToast } = useAdmin();
  const [tab, setTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalSuccessCount: 0,
    totalFailedCount: 0,
    totalPendingCount: 0
  });

  // Debounce search
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
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to load payments.');
      }
      setPayments(res.payments || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      setSummary(
        res.summary || {
          totalRevenue: 0,
          totalSuccessCount: 0,
          totalFailedCount: 0,
          totalPendingCount: 0
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center text-xl font-extrabold text-white">
            <CreditCard className="mr-2 h-5 w-5 text-amber-400" />
            Payment Tracking
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Monitor Razorpay orders, UPI/card methods, failures, and revenue in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPayments}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/40 hover:text-amber-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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
          title="Pending / Created"
          value={summary.totalPendingCount}
          icon={Clock3}
          accent="bg-amber-500/15 text-amber-400"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Order ID, Payment ID, or Email…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Order / Payment ID</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading payments…
                    </span>
                  </td>
                </tr>
              )}

              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    No payments found for this filter.
                  </td>
                </tr>
              )}

              {!loading &&
                payments.map((p) => (
                  <tr key={p._id || p.orderId} className="hover:bg-slate-900/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                      {formatDateTime(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-white">
                        {p.customerDetails?.name || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.customerDetails?.email || '—'}</div>
                      {p.customerDetails?.phone ? (
                        <div className="text-[11px] text-slate-500">{p.customerDetails.phone}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[11px] text-slate-200">{p.orderId}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.paymentId || '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white">
                      {formatInr(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <MethodBadge method={p.paymentMethod} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      {p.status === 'failed' && p.failureReason ? (
                        <span
                          title={p.failureReason}
                          className="line-clamp-2 cursor-help text-[11px] text-rose-300"
                        >
                          {p.failureReason}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">
            Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
