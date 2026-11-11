import React, { useState } from 'react';
import { Users, Plus, Search, Edit, Trash2, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';

export default function Traders() {
  const { adminUser, usersList, createUser, updateUser, deleteUser, extendUserSub, showToast } = useAdmin();

  const isSubAdmin = adminUser?.role === 'subadmin';

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: 'password123',
    role: 'user',
    plan: '12 Months Pro Bundle',
    status: 'active',
    durationDays: 365
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    await createUser(form);
    setShowAddModal(false);
    setForm({
      name: '',
      email: '',
      password: 'password123',
      role: 'user',
      plan: '12 Months Pro Bundle',
      status: 'active',
      durationDays: 365
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    await updateUser(editingUser._id, editingUser);
    setEditingUser(null);
  };

  const filtered = usersList.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center">
            <Users className="mr-2 h-5 w-5 text-amber-400" />
            Registered Traders & Membership Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Administer subscriber access, grant trial extensions, and assign RBAC roles (Trader, Sub-Admin, Super Admin).
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-black hover:opacity-90 shadow-md shadow-amber-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Trader</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by trader name or email address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-white border border-slate-800 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Traders Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Trader Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expires At</th>
                <th className="px-6 py-4 text-right">Actions & Quick Grants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((u) => {
                const isExpired = new Date(u.subscription?.expiresAt) < new Date();
                return (
                  <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-white">{u.name}</td>
                    <td className="px-6 py-3.5 text-slate-400">{u.email}</td>
                    <td className="px-6 py-3.5">
                      {u.role === 'admin' ? (
                        <span className="rounded-full bg-rose-950/90 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800/60 inline-flex items-center">
                          👑 Super Admin
                        </span>
                      ) : u.role === 'subadmin' ? (
                        <span className="rounded-full bg-purple-950/90 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/60 inline-flex items-center">
                          🛡️ Sub-Admin
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700/60 inline-flex items-center">
                          ⚡ Trader
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-cyan-300">
                      {u.subscription?.plan || '14-Day Free Trial'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          u.subscription?.status === 'active' && !isExpired
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : u.subscription?.status === 'trial'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {isExpired ? 'EXPIRED' : (u.subscription?.status || 'TRIAL').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                      {u.subscription?.expiresAt
                        ? new Date(u.subscription.expiresAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {/* Quick Grants */}
                      <button
                        onClick={() => extendUserSub(u._id, { status: 'active', extendDays: 30 })}
                        className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
                        title="Grant +30 Days"
                      >
                        +30d
                      </button>
                      <button
                        onClick={() => extendUserSub(u._id, { status: 'active', plan: '12 Months Pro Bundle', extendDays: 365 })}
                        className="rounded-lg bg-emerald-950/80 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900"
                        title="Grant 1-Year Pro"
                      >
                        +1 Yr Pro
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => setEditingUser(u)}
                        className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700"
                        title="Edit Trader"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (isSubAdmin) {
                            showToast('⚠️ Deleting accounts is restricted to Super Admin.');
                            return;
                          }
                          setDeleteTarget(u);
                        }}
                        className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50"
                        title="Remove User"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= ADD TRADER MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Plus className="mr-2 h-4 w-4 text-amber-400" />
                Add New Trader Account
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@trader.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Role & Privileges</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  disabled={isSubAdmin}
                >
                  <option value="user">⚡ Trader / Standard Member</option>
                  {!isSubAdmin && <option value="subadmin">🛡️ Sub-Admin Operator</option>}
                  {!isSubAdmin && <option value="admin">👑 Super Administrator</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Membership Plan</label>
                  <select
                    value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  >
                    <option value="12 Months Pro Bundle">12 Months Pro Bundle</option>
                    <option value="Monthly Starter">Monthly Starter</option>
                    <option value="14-Day Free Trial">14-Day Free Trial</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Validity Duration (Days)</label>
                <input
                  type="number"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-2 font-bold text-black hover:bg-amber-400"
                >
                  Save Trader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT TRADER MODAL ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Edit className="mr-2 h-4 w-4 text-cyan-400" />
                Edit Trader Account
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Trader Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Role & Privileges</label>
                <select
                  value={editingUser.role || 'user'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  disabled={isSubAdmin}
                >
                  <option value="user">⚡ Trader / Standard Member</option>
                  {!isSubAdmin && <option value="subadmin">🛡️ Sub-Admin Operator</option>}
                  {!isSubAdmin && <option value="admin">👑 Super Administrator</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Assigned Plan</label>
                  <select
                    value={editingUser.subscription?.plan}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      subscription: { ...editingUser.subscription, plan: e.target.value }
                    })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  >
                    <option value="12 Months Pro Bundle">12 Months Pro Bundle</option>
                    <option value="Monthly Starter">Monthly Starter</option>
                    <option value="14-Day Free Trial">14-Day Free Trial</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select
                    value={editingUser.subscription?.status}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      subscription: { ...editingUser.subscription, status: e.target.value }
                    })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-black hover:bg-cyan-400"
                >
                  Update Trader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove trader account?"
        message={`Permanently remove ${deleteTarget?.name || 'this trader'} (${deleteTarget?.email || ''}) from the platform. This cannot be undone.`}
        confirmLabel="Remove Trader"
        cancelLabel="Keep Account"
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
