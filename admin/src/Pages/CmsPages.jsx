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
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

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
      <PageHeader
        title="CMS pages"
        description="Privacy, terms, and FAQ content for the website."
        icon={FileText}
        actions={
          <button type="button" onClick={handleSeed} className="admin-btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Sync defaults
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Panel className="xl:col-span-3 p-3 space-y-1.5">
          {Object.entries(PAGE_META).map(([slug, meta]) => {
            const Icon = meta.icon;
            const page = cmsPages.find((p) => p.slug === slug);
            const active = selectedSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => handleSelect(slug)}
                className={`w-full text-left rounded-xl px-3.5 py-3 border transition-all ${
                  active
                    ? 'bg-admin-accent/10 border-admin-accent/40'
                    : 'border-transparent hover:bg-admin-bg'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${active ? 'text-admin-accent' : 'text-admin-muted'}`} />
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${active ? 'text-admin-accent' : 'text-white'}`}>
                      {meta.label}
                    </div>
                    <div className="text-[10px] text-admin-muted font-mono truncate">{meta.path}</div>
                  </div>
                  <span
                    className={`admin-chip ml-auto text-[9px] uppercase ${
                      page?.isPublished !== false
                        ? 'border-emerald-800/50 bg-emerald-950/60 text-emerald-300'
                        : 'border-admin-border bg-admin-bg text-admin-muted'
                    }`}
                  >
                    {page?.isPublished !== false ? 'ON' : 'OFF'}
                  </span>
                </div>
              </button>
            );
          })}
        </Panel>

        <Panel className="xl:col-span-9 p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-admin-border pb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <SelectedIcon className="h-4 w-4 text-admin-accent" />
                  {selectedMeta.label}
                </h3>
                <p className="text-[11px] text-admin-muted font-mono mt-1">
                  {selectedMeta.path}
                  {dirty && <span className="ml-2 text-admin-accent font-sans font-semibold">· Unsaved</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPublished(!isPublished);
                  markDirty();
                }}
                className={`admin-btn-ghost text-[11px] ${
                  isPublished
                    ? 'border-emerald-800/60 !bg-emerald-950/40 !text-emerald-300'
                    : ''
                }`}
              >
                {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {isPublished ? 'Published' : 'Hidden'}
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div>
                <label className="admin-label block mb-1">Page title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  className="admin-input"
                />
              </div>

              {selectedSlug === 'faq' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="admin-label">FAQ items</label>
                    <button
                      type="button"
                      onClick={() => {
                        setFaqItems((prev) => [...prev, emptyFaq()]);
                        markDirty();
                      }}
                      className="admin-btn-ghost text-[11px] text-admin-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Question
                    </button>
                  </div>

                  {faqItems.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-admin-border bg-admin-bg p-3.5 space-y-2"
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
                        className="admin-input"
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
                        className="admin-input"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="admin-label block mb-1">
                    Content <span className="text-admin-muted font-normal">(Markdown)</span>
                  </label>
                  <textarea
                    rows={16}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      markDirty();
                    }}
                    className="admin-input font-mono text-[11px] leading-relaxed"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-admin-border">
              <p className="text-[10px] text-admin-muted max-w-sm">
                Keep legal pages published for signup acceptance.
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
        </Panel>
      </div>
    </div>
  );
}
