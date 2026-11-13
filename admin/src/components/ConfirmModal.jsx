import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="admin-panel w-full max-w-md space-y-4 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                danger
                  ? 'border-rose-800/60 bg-rose-950/70 text-rose-300'
                  : 'border-admin-accent/30 bg-admin-accent/10 text-admin-accent'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-admin-muted">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="admin-btn-ghost p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} disabled={loading} className="admin-btn-secondary">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'admin-btn-danger' : 'admin-btn-primary'}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
