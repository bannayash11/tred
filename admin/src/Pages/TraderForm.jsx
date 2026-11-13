import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, UserPlus } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import {
  isValidEmail,
  normalizeEmail,
  wholeNumberAtLeast,
  firstError,
  fieldBorderClass
} from '../lib/formValidation';

const emptyForm = () => ({
  name: '',
  email: '',
  password: 'password123',
  role: 'user',
  plan: '12 Months Pro Bundle',
  status: 'active',
  durationDays: 365
});

export default function TraderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { adminUser, usersList, createUser, updateUser, showToast } = useAdmin();
  const isSubAdmin = adminUser?.role === 'subadmin';

  const existing = useMemo(
    () => (isEdit ? usersList.find((u) => String(u._id) === String(id)) : null),
    [isEdit, usersList, id]
  );

  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    if (!existing) return;
    setForm({
      name: existing.name || '',
      email: existing.email || '',
      password: '',
      role: existing.role || 'user',
      plan: existing.subscription?.plan || '12 Months Pro Bundle',
      status: existing.subscription?.status || 'active',
      durationDays: 365
    });
  }, [isEdit, existing]);

  if (isEdit && usersList.length > 0 && !existing) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-admin-muted">Trader not found.</p>
        <Link to="/traders" className="admin-btn-secondary mt-4">
          Back to traders
        </Link>
      </Panel>
    );
  }

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!String(form.name || '').trim()) nextErrors.name = 'Full name is required.';
    const email = normalizeEmail(form.email);
    if (!email) nextErrors.email = 'Email is required.';
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';

    if (!isEdit) {
      if (!form.password || String(form.password).length < 6) {
        nextErrors.password = 'Password must be at least 6 characters.';
      }
      if (!wholeNumberAtLeast(form.durationDays, 1)) {
        nextErrors.durationDays = 'Validity must be at least 1 day.';
      }
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showToast(firstError(nextErrors));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateUser(existing._id, {
          ...existing,
          name: String(form.name).trim(),
          email,
          role: form.role,
          subscription: {
            ...existing.subscription,
            plan: form.plan,
            status: form.status
          }
        });
        showToast('Trader updated.');
      } else {
        await createUser({
          ...form,
          email,
          name: String(form.name).trim()
        });
        showToast('Trader created.');
      }
      navigate('/traders');
    } catch (err) {
      const msg =
        err?.userMessage || err?.response?.data?.message || 'Could not save trader. Please check details.';
      setErrors({ email: msg });
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={isEdit ? 'Edit trader' : 'Add trader'}
        description={
          isEdit
            ? 'Update account details, role, and membership status.'
            : 'Create a new trader or staff account.'
        }
        icon={isEdit ? Save : UserPlus}
        actions={
          <Link to="/traders" className="admin-btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <Panel className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="admin-label">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              className={`admin-input border ${fieldBorderClass(!!errors.name)}`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name}</p>}
          </div>

          <div>
            <label className="admin-label">Email</label>
            <input
              type="email"
              autoCapitalize="none"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value.toLowerCase())}
              className={`admin-input border ${fieldBorderClass(!!errors.email)}`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
          </div>

          <div>
            <label className="admin-label">Role</label>
            <select
              value={form.role}
              onChange={(e) => onChange('role', e.target.value)}
              className="admin-input"
              disabled={isSubAdmin}
            >
              <option value="user">Trader</option>
              {!isSubAdmin && <option value="subadmin">Sub-Admin</option>}
              {!isSubAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => onChange('plan', e.target.value)}
                className="admin-input"
              >
                <option value="12 Months Pro Bundle">12 Months Pro Bundle</option>
                <option value="Monthly Starter">Monthly Starter</option>
                <option value="14-Day Free Trial">14-Day Free Trial</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => onChange('status', e.target.value)}
                className="admin-input"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="admin-label">Temporary password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => onChange('password', e.target.value)}
                  className={`admin-input border ${fieldBorderClass(!!errors.password)}`}
                />
                {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password}</p>}
              </div>
              <div>
                <label className="admin-label">Validity (days)</label>
                <input
                  type="number"
                  value={form.durationDays}
                  onChange={(e) => onChange('durationDays', Number(e.target.value))}
                  className={`admin-input border ${fieldBorderClass(!!errors.durationDays)}`}
                />
                {errors.durationDays && (
                  <p className="mt-1 text-xs text-rose-400">{errors.durationDays}</p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-admin-border pt-4">
            <Link to="/traders" className="admin-btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="admin-btn-primary">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create trader'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
