import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2, Loader2, History } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

export default function PaymentSettings() {
  const { showToast, adminUser, systemSettings, savePaymentMethods, saveUtrPay, uploadUtrQr } =
    useAdmin();
  const isSuperAdmin = adminUser?.role === 'admin';
  const razorpayEnabled = !!systemSettings?.razorpayEnabled;
  const utrEnabled = systemSettings?.utrEnabled !== false;
  const [methodsSaving, setMethodsSaving] = useState(false);
  const [utrSaving, setUtrSaving] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [utrForm, setUtrForm] = useState({
    upiId: '',
    payeeName: 'Tradrift',
    qrImageUrl: '',
    instructions: ''
  });

  useEffect(() => {
    const pay = systemSettings?.utrPay;
    if (!pay) return;
    setUtrForm({
      upiId: pay.upiId || '',
      payeeName: pay.payeeName || 'Tradrift',
      qrImageUrl: pay.qrImageUrl || '',
      instructions: pay.instructions || ''
    });
  }, [systemSettings?.utrPay]);

  const toggleMethod = async (which) => {
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can change payment methods.');
      return;
    }
    const next = {
      razorpayEnabled: which === 'razorpay' ? !razorpayEnabled : razorpayEnabled,
      utrEnabled: which === 'utr' ? !utrEnabled : utrEnabled
    };
    if (!next.razorpayEnabled && !next.utrEnabled) {
      showToast?.('At least one payment method must stay ON.');
      return;
    }
    setMethodsSaving(true);
    try {
      await savePaymentMethods(next);
    } finally {
      setMethodsSaving(false);
    }
  };

  const handleSaveUtrPay = async (e) => {
    e?.preventDefault?.();
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can edit UTR / UPI details.');
      return;
    }
    if (!String(utrForm.upiId || '').trim()) {
      showToast?.('UPI ID is required (e.g. name@okhdfcbank).');
      return;
    }
    setUtrSaving(true);
    try {
      await saveUtrPay({
        upiId: String(utrForm.upiId).trim(),
        payeeName: String(utrForm.payeeName || 'Tradrift').trim(),
        qrImageUrl: String(utrForm.qrImageUrl || '').trim(),
        instructions: String(utrForm.instructions || '').trim()
      });
    } finally {
      setUtrSaving(false);
    }
  };

  const handleQrFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isSuperAdmin) {
      showToast?.('Only Super Admin can upload UPI QR.');
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      showToast?.('Upload PNG, JPG, or WEBP only.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast?.('QR image must be under 4MB.');
      return;
    }
    setQrUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });
      const res = await uploadUtrQr(dataUrl, file.type);
      if (res?.qrImageUrl) {
        setUtrForm((f) => ({ ...f, qrImageUrl: res.qrImageUrl }));
      }
    } catch {
      /* toast already shown */
    } finally {
      setQrUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Payment settings"
        description="Checkout gateways and UPI / UTR details shown to customers."
        icon={Settings2}
        actions={
          <Link to="/payments/history" className="admin-btn-secondary">
            <History className="h-4 w-4" />
            Payment history
          </Link>
        }
      />

      <Panel className="space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Checkout methods</p>
            <p className="mt-1 text-xs text-admin-muted">Toggle which gateways appear at checkout.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={methodsSaving || !isSuperAdmin}
              onClick={() => toggleMethod('razorpay')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                razorpayEnabled
                  ? 'border-emerald-800/70 bg-emerald-950/70 text-emerald-300'
                  : 'border-rose-800/60 bg-rose-950/40 text-rose-300'
              } ${!isSuperAdmin ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90'}`}
            >
              Razorpay: {razorpayEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              disabled={methodsSaving || !isSuperAdmin}
              onClick={() => toggleMethod('utr')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                utrEnabled
                  ? 'border-cyan-800/70 bg-cyan-950/70 text-cyan-300'
                  : 'border-rose-800/60 bg-rose-950/40 text-rose-300'
              } ${!isSuperAdmin ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90'}`}
            >
              UPI + UTR: {utrEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <p className="text-xs text-admin-muted">
          UTR payments stay pending until you Approve in Payment history — that activates membership.
        </p>
      </Panel>

      <Panel className="p-4">
        <form onSubmit={handleSaveUtrPay} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">UTR / UPI details</p>
              <p className="mt-1 text-xs text-admin-muted">Shown at checkout. Super Admin only.</p>
            </div>
            <button type="submit" disabled={utrSaving || !isSuperAdmin} className="admin-btn-primary">
              {utrSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save UTR details
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="admin-label">UPI ID</label>
              <input
                type="text"
                value={utrForm.upiId}
                disabled={!isSuperAdmin}
                onChange={(e) => setUtrForm((f) => ({ ...f, upiId: e.target.value }))}
                placeholder="name@okhdfcbank"
                className="admin-input disabled:opacity-60"
              />
            </div>
            <div>
              <label className="admin-label">Payee name</label>
              <input
                type="text"
                value={utrForm.payeeName}
                disabled={!isSuperAdmin}
                onChange={(e) => setUtrForm((f) => ({ ...f, payeeName: e.target.value }))}
                placeholder="Tradrift"
                className="admin-input disabled:opacity-60"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="admin-label">UPI QR code</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-bg">
                  {utrForm.qrImageUrl ? (
                    <img
                      src={utrForm.qrImageUrl}
                      alt="UPI QR preview"
                      className="h-full w-full bg-white object-contain"
                    />
                  ) : (
                    <span className="px-2 text-center text-[10px] text-admin-muted">No QR yet</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label
                    className={`admin-btn-secondary cursor-pointer ${
                      !isSuperAdmin || qrUploading ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    {qrUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {qrUploading ? 'Uploading…' : 'Upload QR image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={!isSuperAdmin || qrUploading}
                      onChange={handleQrFile}
                    />
                  </label>
                  <p className="text-[10px] text-admin-muted">PNG / JPG / WEBP · max 4MB</p>
                  <input
                    type="url"
                    value={utrForm.qrImageUrl}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setUtrForm((f) => ({ ...f, qrImageUrl: e.target.value }))}
                    placeholder="Or paste QR image URL"
                    className="admin-input text-xs disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label">Checkout instructions</label>
              <textarea
                rows={2}
                value={utrForm.instructions}
                disabled={!isSuperAdmin}
                onChange={(e) => setUtrForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Pay exact amount via UPI, then paste UTR…"
                className="admin-input resize-y disabled:opacity-60"
              />
            </div>
          </div>
        </form>
      </Panel>
    </div>
  );
}
