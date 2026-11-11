import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, HelpCircle, ChevronDown } from 'lucide-react';
import { fetchCmsPage } from '../services/api';

const SLUG_ALIASES = {
  privacy: 'privacy-policy',
  'privacy-policy': 'privacy-policy',
  terms: 'terms-and-conditions',
  'terms-and-conditions': 'terms-and-conditions',
  faq: 'faq'
};

function renderMarkdownLite(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1.5 text-slate-300">
        {listItems.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const formatInline = (str) => {
    const parts = String(str).split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={idx} className="text-base font-bold text-white pt-4">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={idx} className="text-xl font-extrabold text-white pt-2">
          {trimmed.slice(3)}
        </h2>
      );
    } else {
      blocks.push(
        <p key={idx} className="text-sm text-slate-300 leading-relaxed">
          {formatInline(trimmed)}
        </p>
      );
    }
  });

  flushList();
  return blocks;
}

function FaqAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  if (!items?.length) {
    return <p className="text-sm text-slate-400">No FAQ items published yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? -1 : index)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-semibold text-white">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="px-4 pb-4 text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CmsPage({ slug: slugProp }) {
  const params = useParams();
  const raw = slugProp || params.slug || 'privacy-policy';
  const slug = SLUG_ALIASES[raw] || raw;

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchCmsPage(slug)
      .then((res) => {
        if (res.success && res.page) setPage(res.page);
        else setError('Page not found');
      })
      .catch(() => setError('Failed to load page'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Loading…</div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-white">Page not found</h1>
        <Link to="/" className="text-cyan-400 text-sm font-semibold hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  const isFaq = page.slug === 'faq';

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Home
      </Link>

      <div className="space-y-2 border-b border-slate-800 pb-5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {isFaq ? <HelpCircle className="h-3 w-3 text-cyan-400" /> : <FileText className="h-3 w-3 text-cyan-400" />}
          Legal & Help
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{page.title}</h1>
        {page.updatedAt && (
          <p className="text-[11px] text-slate-500">
            Last updated: {new Date(page.updatedAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        )}
      </div>

      {isFaq ? (
        <FaqAccordion items={page.faqItems} />
      ) : (
        <article className="space-y-3">{renderMarkdownLite(page.content)}</article>
      )}

      <div className="pt-6 border-t border-slate-800 flex flex-wrap gap-4 text-xs">
        <Link to="/privacy-policy" className="text-slate-400 hover:text-cyan-400">
          Privacy Policy
        </Link>
        <Link to="/terms" className="text-slate-400 hover:text-cyan-400">
          Terms & Conditions
        </Link>
        <Link to="/faq" className="text-slate-400 hover:text-cyan-400">
          FAQ
        </Link>
      </div>
    </div>
  );
}
