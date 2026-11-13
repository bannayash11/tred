import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Save,
  Globe,
  FileText,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

const ROBOTS_OPTIONS = [
  'index, follow',
  'noindex, follow',
  'index, nofollow',
  'noindex, nofollow'
];

const emptyForm = {
  pageName: '',
  path: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  canonicalUrl: '',
  robots: 'index, follow',
  schemaMarkup: '',
  isActive: true
};

export default function SeoManager() {
  const { seoPages, loadSeoPages, updateSeoPage, seedSeoPages, showToast } = useAdmin();

  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadSeoPages();
  }, []);

  useEffect(() => {
    if (!seoPages.length) return;
    if (!selectedKey || !seoPages.find((p) => p.pageKey === selectedKey)) {
      selectPage(seoPages[0]);
    }
  }, [seoPages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return seoPages;
    return seoPages.filter(
      (p) =>
        p.pageName?.toLowerCase().includes(q) ||
        p.path?.toLowerCase().includes(q) ||
        p.pageKey?.toLowerCase().includes(q) ||
        p.metaTitle?.toLowerCase().includes(q)
    );
  }, [seoPages, search]);

  const selectPage = (page) => {
    if (!page) return;
    setSelectedKey(page.pageKey);
    setForm({
      pageName: page.pageName || '',
      path: page.path || '',
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      metaKeywords: page.metaKeywords || '',
      ogTitle: page.ogTitle || '',
      ogDescription: page.ogDescription || '',
      ogImage: page.ogImage || '',
      canonicalUrl: page.canonicalUrl || '',
      robots: page.robots || 'index, follow',
      schemaMarkup: page.schemaMarkup || '',
      isActive: page.isActive !== false
    });
    setDirty(false);
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const titleLen = form.metaTitle.length;
  const descLen = form.metaDescription.length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedKey) return;
    setSaving(true);
    const res = await updateSeoPage(selectedKey, form);
    setSaving(false);
    if (res?.success) setDirty(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    await seedSeoPages();
    setSeeding(false);
  };

  const selected = seoPages.find((p) => p.pageKey === selectedKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO"
        description="Meta tags, Open Graph, and robots per public route."
        icon={Globe}
        actions={
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="admin-btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'Syncing…' : 'Sync pages'}
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Page list */}
        <Panel className="xl:col-span-4 overflow-hidden flex flex-col min-h-[520px] p-0">
          <div className="p-4 border-b border-admin-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-admin-accent" />
                Pages
              </h3>
              <span className="admin-chip border-admin-border bg-admin-bg text-admin-muted">
                {seoPages.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search page, path, title…"
                className="admin-input pl-10 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[560px]">
            {filtered.length === 0 && (
              <div className="text-center text-xs text-admin-muted py-10 px-4">
                No pages found. Use Sync pages to register routes.
              </div>
            )}

            {filtered.map((page) => {
              const active = page.pageKey === selectedKey;
              return (
                <button
                  key={page.pageKey}
                  type="button"
                  onClick={() => {
                    if (dirty && selectedKey && selectedKey !== page.pageKey) {
                      const ok = window.confirm('You have unsaved SEO changes. Discard and switch page?');
                      if (!ok) return;
                    }
                    selectPage(page);
                  }}
                  className={`w-full text-left rounded-xl px-3.5 py-3 transition-all border ${
                    active
                      ? 'bg-admin-accent/10 border-admin-accent/40'
                      : 'bg-transparent border-transparent hover:bg-admin-bg hover:border-admin-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold truncate ${active ? 'text-admin-accent' : 'text-white'}`}>
                        {page.pageName}
                      </div>
                      <div className="text-[10px] text-admin-muted font-mono mt-0.5 truncate">{page.path}</div>
                    </div>
                    <span
                      className={`admin-chip shrink-0 mt-0.5 text-[9px] uppercase ${
                        page.isActive !== false
                          ? 'border-emerald-800/50 bg-emerald-950/60 text-emerald-300'
                          : 'border-admin-border bg-admin-bg text-admin-muted'
                      }`}
                    >
                      {page.isActive !== false ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-[10px] text-admin-muted mt-1.5 line-clamp-1">
                    {page.metaTitle || 'No meta title'}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Editor */}
        <Panel className="xl:col-span-8 p-6">
          {!selected ? (
            <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-admin-muted text-sm space-y-3">
              <Globe className="h-10 w-10 opacity-40" />
              <p>Select a page to edit SEO.</p>
              <button type="button" onClick={handleSeed} className="admin-btn-primary">
                Sync pages
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-admin-border pb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{form.pageName || selected.pageName}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="admin-chip font-mono text-[11px] border-admin-border bg-admin-bg text-admin-accent">
                      {form.path}
                    </span>
                    <span className="text-[10px] text-admin-muted uppercase tracking-wide">
                      key: {selected.pageKey}
                    </span>
                    {dirty && (
                      <span className="text-[10px] font-semibold text-admin-accent">Unsaved</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setField('isActive', !form.isActive)}
                    className={`admin-btn-ghost text-[11px] ${
                      form.isActive
                        ? 'border-emerald-800/60 !bg-emerald-950/40 !text-emerald-300'
                        : ''
                    }`}
                  >
                    {form.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>{form.isActive ? 'Active' : 'Disabled'}</span>
                  </button>

                  <a
                    href={`http://localhost:3000${form.path.replace('/:id', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn-ghost text-[11px]"
                    onClick={() => showToast('Opening page on web terminal…')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Preview</span>
                  </a>
                </div>
              </div>

              {/* Google preview */}
              <div className="rounded-xl border border-admin-border bg-admin-bg p-4 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-admin-muted mb-2">
                  Search preview
                </div>
                <div className="text-sm text-[#8ab4f8] font-medium truncate">
                  {form.metaTitle || 'Page title will appear here'}
                </div>
                <div className="text-[12px] text-emerald-500/90 truncate">
                  {`https://tradrift.local${form.canonicalUrl || form.path || '/'}`}
                </div>
                <div className="text-[12px] text-slate-400 line-clamp-2">
                  {form.metaDescription || 'Meta description preview appears here for Google-style snippets.'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="admin-label">Meta title</label>
                    <span
                      className={`text-[10px] font-mono ${
                        titleLen > 60 ? 'text-rose-400' : titleLen >= 45 ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {titleLen}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => setField('metaTitle', e.target.value)}
                    placeholder="Optimal ~50–60 characters"
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="admin-label">Meta description</label>
                    <span
                      className={`text-[10px] font-mono ${
                        descLen > 160 ? 'text-rose-400' : descLen >= 120 ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {descLen}/160
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={form.metaDescription}
                    onChange={(e) => setField('metaDescription', e.target.value)}
                    placeholder="Optimal ~140–160 characters — clear value proposition for search results"
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label block mb-1">Meta keywords</label>
                  <input
                    type="text"
                    value={form.metaKeywords}
                    onChange={(e) => setField('metaKeywords', e.target.value)}
                    placeholder="order block, SMC, liquidity, nifty…"
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label block mb-1">Canonical URL</label>
                  <input
                    type="text"
                    value={form.canonicalUrl}
                    onChange={(e) => setField('canonicalUrl', e.target.value)}
                    placeholder="/pricing"
                    className="admin-input font-mono"
                  />
                </div>

                <div>
                  <label className="admin-label block mb-1">Robots</label>
                  <select
                    value={form.robots}
                    onChange={(e) => setField('robots', e.target.value)}
                    className="admin-input"
                  >
                    {ROBOTS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="admin-label block mb-1">OG title</label>
                  <input
                    type="text"
                    value={form.ogTitle}
                    onChange={(e) => setField('ogTitle', e.target.value)}
                    placeholder="Social share title"
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label block mb-1">OG image URL</label>
                  <input
                    type="text"
                    value={form.ogImage}
                    onChange={(e) => setField('ogImage', e.target.value)}
                    placeholder="https://…/og-image.jpg"
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label block mb-1">OG description</label>
                  <textarea
                    rows={2}
                    value={form.ogDescription}
                    onChange={(e) => setField('ogDescription', e.target.value)}
                    placeholder="Social share description"
                    className="admin-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label block mb-1">
                    Schema (JSON-LD){' '}
                    <span className="text-admin-muted font-normal">optional</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.schemaMarkup}
                    onChange={(e) => setField('schemaMarkup', e.target.value)}
                    placeholder='{"@context":"https://schema.org","@type":"WebPage",...}'
                    className="admin-input font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="admin-label block mb-1">Display name</label>
                  <input
                    type="text"
                    value={form.pageName}
                    onChange={(e) => setField('pageName', e.target.value)}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="admin-label block mb-1">Route path</label>
                  <input
                    type="text"
                    value={form.path}
                    onChange={(e) => setField('path', e.target.value)}
                    className="admin-input font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-admin-border">
                <p className="text-[10px] text-admin-muted max-w-md">
                  Saved changes go live on the website immediately.
                </p>
                <button type="submit" disabled={saving || !dirty} className="admin-btn-primary">
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : dirty ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>{saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</span>
                </button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}
