import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { fetchSeoByPath } from '../services/api';

const SITE_ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'https://tradrift.local';

const DEFAULT_TITLE = 'Tradrift — Institutional SMC & Liquidity Terminal';

function upsertMeta(attr, key, content) {
  if (content === undefined || content === null) return;
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', String(content));
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(jsonText) {
  const existing = document.getElementById('ob-seo-jsonld');
  if (existing) existing.remove();
  if (!jsonText || !String(jsonText).trim()) return;

  try {
    JSON.parse(jsonText);
  } catch {
    return;
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'ob-seo-jsonld';
  script.text = jsonText;
  document.head.appendChild(script);
}

function applyTemplate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] != null ? String(vars[key]) : '';
  });
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

/**
 * Applies admin-managed SEO meta tags for the current route.
 * Optional overrides: { title, excerpt, id } for dynamic pages.
 */
export default function SeoHead({ overrides = null }) {
  const location = useLocation();
  const params = useParams();
  const [seo, setSeo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const path = location.pathname || '/';

    fetchSeoByPath(path)
      .then((res) => {
        if (cancelled || !res?.success || !res.seo) return;

        let vars = {
          id: params.id || '',
          title: overrides?.title || '',
          excerpt: overrides?.excerpt || ''
        };

        if (overrides) {
          vars = { ...vars, ...overrides };
        }

        if (!cancelled) setSeo({ ...res.seo, _vars: vars });
      })
      .catch(() => {
        if (!cancelled) setSeo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, params.id, overrides?.title, overrides?.excerpt]);

  useEffect(() => {
    if (!seo) {
      document.title = DEFAULT_TITLE;
      return;
    }

    const vars = seo._vars || {};
    const title = applyTemplate(seo.metaTitle, vars) || DEFAULT_TITLE;
    const description = applyTemplate(seo.metaDescription, vars);
    const keywords = applyTemplate(seo.metaKeywords, vars);
    const ogTitle = applyTemplate(seo.ogTitle, vars) || title;
    const ogDescription = applyTemplate(seo.ogDescription, vars) || description;
    const ogImage = seo.ogImage || '';
    const canonicalPath = applyTemplate(seo.canonicalUrl || seo.path || location.pathname, vars);
    const robots = seo.robots || 'index, follow';
    const schema = applyTemplate(seo.schemaMarkup, vars);

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'keywords', keywords);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:title', ogTitle);
    upsertMeta('property', 'og:description', ogDescription);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', absoluteUrl(canonicalPath));
    if (ogImage) upsertMeta('property', 'og:image', absoluteUrl(ogImage));
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', ogTitle);
    upsertMeta('name', 'twitter:description', ogDescription);
    if (ogImage) upsertMeta('name', 'twitter:image', absoluteUrl(ogImage));
    upsertLink('canonical', absoluteUrl(canonicalPath));
    upsertJsonLd(schema);
  }, [seo, location.pathname]);

  return null;
}
