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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center">
            <Globe className="mr-2 h-5 w-5 text-amber-400" />
            Website SEO Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage meta title, description, Open Graph and robots for every public web page so the full site stays SEO-friendly.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="inline-flex items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
          <span>{seeding ? 'Syncing pages…' : 'Sync / Register All Pages'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Page list */}
        <div className="xl:col-span-4 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden flex flex-col min-h-[520px]">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center">
                <FileText className="mr-1.5 h-4 w-4 text-amber-400" />
                All Web Pages
              </h3>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {seoPages.length} pages
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search page, path, title…"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[560px]">
            {filtered.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-10 px-4">
                No pages found. Click “Sync / Register All Pages” to load the website routes.
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
                  className={`w-full text-left rounded-2xl px-3.5 py-3 transition-all border ${
                    active
                      ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${active ? 'text-amber-300' : 'text-white'}`}>
                        {page.pageName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{page.path}</div>
                    </div>
                    <span
                      className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                        page.isActive !== false
                          ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}
                    >
                      {page.isActive !== false ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 line-clamp-1">
                    {page.metaTitle || 'No meta title set'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="xl:col-span-8 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl p-6">
          {!selected ? (
            <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-slate-500 text-sm space-y-3">
              <Globe className="h-10 w-10 opacity-40" />
              <p>Select a page from the left to edit its SEO.</p>
              <button
                type="button"
                onClick={handleSeed}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black"
              >
                Register All Website Pages
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">{form.pageName || selected.pageName}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-cyan-400/90 bg-cyan-950/40 border border-cyan-900/50 rounded px-2 py-0.5">
                      {form.path}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                      key: {selected.pageKey}
                    </span>
                    {dirty && (
                      <span className="text-[10px] font-bold text-amber-400">Unsaved changes</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setField('isActive', !form.isActive)}
                    className={`inline-flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${
                      form.isActive
                        ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {form.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>{form.isActive ? 'SEO Active' : 'SEO Disabled'}</span>
                  </button>

                  <a
                    href={`http://localhost:3000${form.path.replace('/:id', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:text-cyan-300"
                    onClick={() => showToast('Opening page on web terminal…')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Preview</span>
                  </a>
                </div>
              </div>

              {/* Google preview */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Search Preview
                </div>
                <div className="text-sm text-[#8ab4f8] font-medium truncate">
                  {form.metaTitle || 'Page title will appear here'}
                </div>
                <div className="text-[12px] text-emerald-500/90 truncate">
                  {`https://orderblock.local${form.canonicalUrl || form.path || '/'}`}
                </div>
                <div className="text-[12px] text-slate-400 line-clamp-2">
                  {form.metaDescription || 'Meta description preview appears here for Google-style snippets.'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Meta Title</label>
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
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Meta Description</label>
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
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-400 block mb-1">Meta Keywords (comma separated)</label>
                  <input
                    type="text"
                    value={form.metaKeywords}
                    onChange={(e) => setField('metaKeywords', e.target.value)}
                    placeholder="order block, SMC, liquidity, nifty…"
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Canonical URL</label>
                  <input
                    type="text"
                    value={form.canonicalUrl}
                    onChange={(e) => setField('canonicalUrl', e.target.value)}
                    placeholder="/pricing"
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Robots</label>
                  <select
                    value={form.robots}
                    onChange={(e) => setField('robots', e.target.value)}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  >
                    {ROBOTS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">OG Title</label>
                  <input
                    type="text"
                    value={form.ogTitle}
                    onChange={(e) => setField('ogTitle', e.target.value)}
                    placeholder="Social share title"
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">OG Image URL</label>
                  <input
                    type="text"
                    value={form.ogImage}
                    onChange={(e) => setField('ogImage', e.target.value)}
                    placeholder="https://…/og-image.jpg"
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-400 block mb-1">OG Description</label>
                  <textarea
                    rows={2}
                    value={form.ogDescription}
                    onChange={(e) => setField('ogDescription', e.target.value)}
                    placeholder="Social share description"
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-400 block mb-1">
                    Schema Markup (JSON-LD){' '}
                    <span className="text-slate-600">— optional structured data</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.schemaMarkup}
                    onChange={(e) => setField('schemaMarkup', e.target.value)}
                    placeholder='{"@context":"https://schema.org","@type":"WebPage",...}'
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none font-mono text-[11px]"
                  />
                  {selected.pageKey === 'blog-detail' && (
                    <p className="text-[10px] text-amber-400/80 mt-1.5">
                      Tip: use placeholders <code className="text-amber-300">{'{title}'}</code>,{' '}
                      <code className="text-amber-300">{'{excerpt}'}</code>,{' '}
                      <code className="text-amber-300">{'{id}'}</code> — they are replaced on blog article pages.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Display Name (admin)</label>
                  <input
                    type="text"
                    value={form.pageName}
                    onChange={(e) => setField('pageName', e.target.value)}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Route Path</label>
                  <input
                    type="text"
                    value={form.path}
                    onChange={(e) => setField('path', e.target.value)}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 max-w-md">
                  Changes apply on the live website as soon as you save. Title, description, OG tags and robots update per page route.
                </p>
                <button
                  type="submit"
                  disabled={saving || !dirty}
                  className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-bold text-black shadow-md shadow-amber-500/20 disabled:opacity-50 hover:opacity-95"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : dirty ? (
                    <Save className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>{saving ? 'Saving…' : dirty ? 'Save SEO Settings' : 'Saved'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
