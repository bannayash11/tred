import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Save, Send, Loader2, RotateCcw, Eye } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import {
  fetchEmailTemplatesApi,
  saveSmtpSettingsApi,
  testSmtpSettingsApi,
  saveEmailTemplateApi,
  resetEmailTemplateApi,
  previewEmailTemplateApi
} from '../services/api';

const emptySmtp = () => ({
  enabled: true,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Tradrift',
  fromEmail: ''
});

export default function EmailTemplates() {
  const { adminUser, showToast } = useAdmin();
  const isSuperAdmin = adminUser?.role === 'admin';
  const [tab, setTab] = useState('smtp');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const [smtp, setSmtp] = useState(emptySmtp());
  const [passSet, setPassSet] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState(adminUser?.email || '');

  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [activeKey, setActiveKey] = useState('recovery_otp');
  const [draft, setDraft] = useState(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  const activeMeta = useMemo(
    () => templates.find((t) => t.key === activeKey) || null,
    [templates, activeKey]
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchEmailTemplatesApi();
      if (!res?.success) throw new Error(res?.message || 'Failed to load email settings.');
      const s = res.smtp || {};
      setSmtp({
        enabled: s.enabled !== false,
        host: s.host || '',
        port: Number(s.port) || 587,
        secure: !!s.secure,
        user: s.user || '',
        pass: '',
        fromName: s.fromName || 'Tradrift',
        fromEmail: s.fromEmail || ''
      });
      setPassSet(!!s.passSet);
      setReady(!!res.ready);
      setTemplates(res.templates || []);
      setVariables(res.variables || []);
      const firstKey = res.templates?.[0]?.key || 'recovery_otp';
      const pick = res.templates?.find((t) => t.key === activeKey) || res.templates?.[0];
      setActiveKey(pick?.key || firstKey);
      if (pick) {
        setDraft({
          subject: pick.subject || '',
          html: pick.html || '',
          text: pick.text || '',
          enabled: pick.enabled !== false
        });
      }
      if (!testTo && adminUser?.email) setTestTo(adminUser.email);
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not load email settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pick = templates.find((t) => t.key === activeKey);
    if (!pick) return;
    setDraft({
      subject: pick.subject || '',
      html: pick.html || '',
      text: pick.text || '',
      enabled: pick.enabled !== false
    });
    setPreviewHtml('');
    setPreviewSubject('');
  }, [activeKey, templates]);

  const onSmtpChange = (key, value) => setSmtp((prev) => ({ ...prev, [key]: value }));

  const handleSaveSmtp = async (e) => {
    e?.preventDefault?.();
    if (!isSuperAdmin) return showToast?.('Only Super Admin can edit SMTP.');
    if (!String(smtp.host || '').trim()) return showToast?.('SMTP host is required.');
    if (!String(smtp.fromEmail || '').includes('@')) return showToast?.('Valid from-email required.');

    setSavingSmtp(true);
    try {
      const payload = {
        enabled: !!smtp.enabled,
        host: String(smtp.host).trim(),
        port: Number(smtp.port) || 587,
        secure: !!smtp.secure,
        user: String(smtp.user || '').trim(),
        fromName: String(smtp.fromName || 'Tradrift').trim(),
        fromEmail: String(smtp.fromEmail || '').trim()
      };
      if (String(smtp.pass || '').trim()) payload.pass = String(smtp.pass).trim();

      const res = await saveSmtpSettingsApi(payload);
      if (!res?.success) throw new Error(res?.message || 'Save failed.');
      showToast?.(res.message || 'SMTP saved.');
      setPassSet(!!res.smtp?.passSet);
      setReady(!!res.ready);
      setSmtp((prev) => ({ ...prev, pass: '' }));
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not save SMTP.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTest = async () => {
    if (!isSuperAdmin) return;
    const to = String(testTo || '').trim().toLowerCase();
    if (!to.includes('@')) return showToast?.('Enter a valid test email.');
    setTesting(true);
    try {
      const res = await testSmtpSettingsApi({ to });
      if (!res?.success) throw new Error(res?.message || 'Test failed.');
      showToast?.(res.message || 'Test email sent.');
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'SMTP test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!isSuperAdmin || !draft || !activeKey) return;
    setSavingTpl(true);
    try {
      const res = await saveEmailTemplateApi(activeKey, draft);
      if (!res?.success) throw new Error(res?.message || 'Save failed.');
      showToast?.(res.message || 'Template saved.');
      setTemplates((prev) =>
        prev.map((t) => (t.key === activeKey ? { ...t, ...res.template } : t))
      );
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not save template.');
    } finally {
      setSavingTpl(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!isSuperAdmin || !activeKey) return;
    if (!window.confirm('Reset this template to default content?')) return;
    setSavingTpl(true);
    try {
      const res = await resetEmailTemplateApi(activeKey);
      if (!res?.success) throw new Error(res?.message || 'Reset failed.');
      showToast?.(res.message || 'Template reset.');
      setTemplates((prev) =>
        prev.map((t) => (t.key === activeKey ? { ...t, ...res.template } : t))
      );
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Could not reset template.');
    } finally {
      setSavingTpl(false);
    }
  };

  const handlePreview = async () => {
    try {
      const res = await previewEmailTemplateApi(activeKey);
      if (!res?.success) throw new Error(res?.message || 'Preview failed.');
      setPreviewSubject(res.subject || '');
      setPreviewHtml(res.html || '');
    } catch (err) {
      showToast?.(err.userMessage || err.message || 'Preview failed.');
    }
  };

  if (!isSuperAdmin) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-admin-muted">Email Templates are Super Admin only.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        description="SMTP mail settings + dynamic templates for signup verify, forgot password, and login OTP."
        icon={Mail}
      />

      <div className="flex w-fit flex-wrap gap-1.5 rounded-xl border border-admin-border bg-admin-bg p-1">
        <button
          type="button"
          onClick={() => setTab('smtp')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'smtp'
              ? 'bg-admin-accent text-admin-bg'
              : 'text-admin-muted hover:bg-admin-surface hover:text-white'
          }`}
        >
          Mail settings (SMTP)
        </button>
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'templates'
              ? 'bg-admin-accent text-admin-bg'
              : 'text-admin-muted hover:bg-admin-surface hover:text-white'
          }`}
        >
          Email templates
        </button>
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-white">SMTP status</div>
          <p className="mt-1 text-xs text-admin-muted">
            {ready
              ? 'Ready — OTPs will send with your templates.'
              : 'Configure SMTP first, then edit templates.'}
          </p>
        </div>
        <span
          className={`admin-chip ${
            ready
              ? 'border-emerald-800/50 bg-emerald-950/50 text-emerald-300'
              : 'border-rose-800/50 bg-rose-950/40 text-rose-300'
          }`}
        >
          {ready ? 'Ready' : 'Not configured'}
        </span>
      </Panel>

      {loading ? (
        <Panel className="flex items-center gap-2 p-6 text-sm text-admin-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </Panel>
      ) : tab === 'smtp' ? (
        <>
          <Panel className="p-5 sm:p-6">
            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-admin-border bg-admin-bg px-3 py-2.5">
                <span className="text-sm text-slate-300">Enable SMTP email</span>
                <input
                  type="checkbox"
                  checked={!!smtp.enabled}
                  onChange={(e) => onSmtpChange('enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-admin-accent"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="admin-label">SMTP host</label>
                  <input
                    type="text"
                    value={smtp.host}
                    onChange={(e) => onSmtpChange('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="admin-input"
                    required
                  />
                </div>
                <div>
                  <label className="admin-label">Port</label>
                  <input
                    type="number"
                    value={smtp.port}
                    onChange={(e) => onSmtpChange('port', Number(e.target.value))}
                    className="admin-input"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-admin-border bg-admin-bg px-3 py-2.5">
                    <span className="text-sm text-slate-300">TLS / SSL (secure)</span>
                    <input
                      type="checkbox"
                      checked={!!smtp.secure}
                      onChange={(e) => onSmtpChange('secure', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-admin-accent"
                    />
                  </label>
                </div>
                <div>
                  <label className="admin-label">SMTP username</label>
                  <input
                    type="text"
                    value={smtp.user}
                    onChange={(e) => onSmtpChange('user', e.target.value)}
                    className="admin-input"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="admin-label">
                    SMTP password {passSet ? '(saved — leave blank to keep)' : ''}
                  </label>
                  <input
                    type="password"
                    value={smtp.pass}
                    onChange={(e) => onSmtpChange('pass', e.target.value)}
                    placeholder={passSet ? '••••••••' : 'App password / API key'}
                    className="admin-input"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="admin-label">From name</label>
                  <input
                    type="text"
                    value={smtp.fromName}
                    onChange={(e) => onSmtpChange('fromName', e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-label">From email</label>
                  <input
                    type="email"
                    value={smtp.fromEmail}
                    onChange={(e) => onSmtpChange('fromEmail', e.target.value)}
                    className="admin-input"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-admin-border pt-4">
                <button type="submit" disabled={savingSmtp} className="admin-btn-primary">
                  {savingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save mail settings
                </button>
              </div>
            </form>
          </Panel>

          <Panel className="space-y-3 p-5">
            <div className="text-sm font-semibold text-white">Send test email</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="admin-input"
                placeholder="you@example.com"
              />
              <button
                type="button"
                disabled={testing || !ready}
                onClick={handleTest}
                className="admin-btn-secondary shrink-0"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </button>
            </div>
          </Panel>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel className="space-y-1 p-3 xl:col-span-4">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveKey(t.key)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                  activeKey === t.key
                    ? 'bg-admin-accent/15 text-admin-accent'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="text-sm font-semibold">{t.label || t.key}</div>
                <div className="mt-0.5 text-[11px] text-admin-muted line-clamp-2">{t.description}</div>
              </button>
            ))}
          </Panel>

          <div className="space-y-4 xl:col-span-8">
            {draft && (
              <Panel className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {activeMeta?.label || activeKey}
                    </div>
                    <p className="mt-1 text-xs text-admin-muted">{activeMeta?.description}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!draft.enabled}
                      onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-admin-accent"
                    />
                    Enabled
                  </label>
                </div>

                <div>
                  <label className="admin-label">Subject</label>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                    className="admin-input font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="admin-label">HTML body</label>
                  <textarea
                    rows={14}
                    value={draft.html}
                    onChange={(e) => setDraft((d) => ({ ...d, html: e.target.value }))}
                    className="admin-input resize-y font-mono text-[11px] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="admin-label">Plain text fallback</label>
                  <textarea
                    rows={3}
                    value={draft.text}
                    onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                    className="admin-input resize-y font-mono text-xs"
                  />
                </div>

                <div className="rounded-lg border border-admin-border bg-admin-bg/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-admin-muted">
                    Dynamic variables
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variables.map((v) => (
                      <span key={v.key} className="admin-chip border-admin-border bg-admin-surface text-admin-accent">
                        {`{{${v.key}}}`}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-admin-muted">
                    OTP is generated randomly and injected into {`{{otp}}`} for every send.
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-admin-border pt-4">
                  <button type="button" onClick={handlePreview} className="admin-btn-secondary">
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button type="button" disabled={savingTpl} onClick={handleResetTemplate} className="admin-btn-secondary">
                    <RotateCcw className="h-4 w-4" />
                    Reset default
                  </button>
                  <button type="button" disabled={savingTpl} onClick={handleSaveTemplate} className="admin-btn-primary">
                    {savingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save template
                  </button>
                </div>
              </Panel>
            )}

            {previewHtml ? (
              <Panel className="overflow-hidden">
                <div className="border-b border-admin-border px-4 py-3 text-xs text-admin-muted">
                  Preview subject: <span className="text-white">{previewSubject}</span>
                </div>
                <iframe
                  title="Email preview"
                  className="h-[420px] w-full bg-white"
                  srcDoc={previewHtml}
                />
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
