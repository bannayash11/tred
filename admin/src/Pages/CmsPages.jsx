import React, { useEffect, useState } from 'react';
import {
  FileText,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Shield,
  Scale
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const PAGE_META = {
  'privacy-policy': { icon: Shield, label: 'Privacy Policy', path: '/privacy-policy' },
  'terms-and-conditions': { icon: Scale, label: 'Terms & Conditions', path: '/terms' },
  faq: { icon: HelpCircle, label: 'FAQ', path: '/faq' }
};

const emptyFaq = () => ({ question: '', answer: '' });

export default function CmsPages() {
  const { cmsPages, loadCmsPages, updateCmsPage, seedCmsPages, showToast } = useAdmin();

  const [selectedSlug, setSelectedSlug] = useState('privacy-policy');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [faqItems, setFaqItems] = useState([emptyFaq()]);
  const [isPublished, setIsPublished] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCmsPages();
  }, []);

  useEffect(() => {
    if (!cmsPages.length) return;
    const page = cmsPages.find((p) => p.slug === selectedSlug) || cmsPages[0];
    if (page) loadForm(page);
  }, [cmsPages, selectedSlug]);

  const loadForm = (page) => {
    setSelectedSlug(page.slug);
    setTitle(page.title || '');
    setContent(page.content || '');
    setFaqItems(page.faqItems?.length ? page.faqItems.map((f) => ({ ...f })) : [emptyFaq()]);
    setIsPublished(page.isPublished !== false);
    setDirty(false);
  };

  const markDirty = () => setDirty(true);

  const handleSelect = (slug) => {
    if (dirty) {
      const ok = window.confirm('Unsaved CMS changes will be lost. Continue?');
      if (!ok) return;
    }
    const page = cmsPages.find((p) => p.slug === slug);
    if (page) loadForm(page);
    else setSelectedSlug(slug);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title,
      content,
      isPublished,
      faqItems: selectedSlug === 'faq' ? faqItems : []
    };
    const res = await updateCmsPage(selectedSlug, payload);
    setSaving(false);
    if (res?.success) setDirty(false);
  };

  const handleSeed = async () => {
    await seedCmsPages();
  };

  const selectedMeta = PAGE_META[selectedSlug] || PAGE_META['privacy-policy'];
  const SelectedIcon = selectedMeta.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center">
            <FileText className="mr-2 h-5 w-5 text-amber-400" />
            CMS Pages
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage Privacy Policy, Terms & Conditions, and FAQ content shown on the website and signup.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSeed}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync Default Pages
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-3 space-y-1.5 shadow-xl">
          {Object.entries(PAGE_META).map(([slug, meta]) => {
            const Icon = meta.icon;
            const page = cmsPages.find((p) => p.slug === slug);
            const active = selectedSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => handleSelect(slug)}
                className={`w-full text-left rounded-2xl px-3.5 py-3 border transition-all ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/40'
                    : 'border-transparent hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${active ? 'text-amber-300' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <div className={`text-xs font-bold ${active ? 'text-amber-300' : 'text-white'}`}>
                      {meta.label}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{meta.path}</div>
                  </div>
                  <span
                    className={`ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      page?.isPublished !== false
                        ? 'text-emerald-400 border-emerald-800/50 bg-emerald-950/40'
                        : 'text-slate-500 border-slate-700'
                    }`}
                  >
                    {page?.isPublished !== false ? 'ON' : 'OFF'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="xl:col-span-9 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <SelectedIcon className="h-4 w-4 text-amber-400" />
                  {selectedMeta.label}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Public URL: {selectedMeta.path}
                  {dirty && <span className="ml-2 text-amber-400 font-sans font-bold">· Unsaved</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPublished(!isPublished);
                  markDirty();
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                  isPublished
                    ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {isPublished ? 'Published' : 'Hidden'}
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div>
                <label className="text-slate-400 block mb-1">Page Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {selectedSlug === 'faq' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400">FAQ Items</label>
                    <button
                      type="button"
                      onClick={() => {
                        setFaqItems((prev) => [...prev, emptyFaq()]);
                        markDirty();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Question
                    </button>
                  </div>

                  {faqItems.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Q{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFaqItems((prev) => prev.filter((_, i) => i !== index));
                            markDirty();
                          }}
                          className="text-slate-500 hover:text-rose-400"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Question"
                        value={item.question}
                        onChange={(e) => {
                          const next = [...faqItems];
                          next[index] = { ...next[index], question: e.target.value };
                          setFaqItems(next);
                          markDirty();
                        }}
                        className="w-full rounded-xl bg-slate-900 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                      />
                      <textarea
                        rows={3}
                        placeholder="Answer"
                        value={item.answer}
                        onChange={(e) => {
                          const next = [...faqItems];
                          next[index] = { ...next[index], answer: e.target.value };
                          setFaqItems(next);
                          markDirty();
                        }}
                        className="w-full rounded-xl bg-slate-900 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="text-slate-400 block mb-1">
                    Page Content <span className="text-slate-600">(Markdown supported)</span>
                  </label>
                  <textarea
                    rows={16}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 focus:border-amber-400 focus:outline-none font-mono text-[11px] leading-relaxed"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 max-w-sm">
                Signup requires users to accept Terms & Privacy. Keep these pages updated and published.
              </p>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-bold text-black disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : dirty ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>{saving ? 'Saving…' : dirty ? 'Save CMS Page' : 'Saved'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
