import express from 'express';
import { SeoPage } from '../models/SeoPage.js';
import { authMiddleware, subAdminOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const DEFAULT_SEO_PAGES = [
  {
    pageKey: 'home',
    path: '/',
    pageName: 'Home',
    metaTitle: 'Tradrift — Institutional SMC & Liquidity Terminal',
    metaDescription:
      'Live Smart Money Concepts terminal for Indian F&O. Track order blocks, fair value gaps, liquidity sweeps and institutional footprints in real time.',
    metaKeywords: 'order block, smart money concepts, SMC, liquidity, F&O, nifty, banknifty, trading terminal',
    ogTitle: 'Tradrift — Institutional SMC Terminal',
    ogDescription: 'Real-time SMC order block & liquidity analytics for Indian markets.',
    ogImage: '',
    canonicalUrl: '/',
    robots: 'index, follow',
    sortOrder: 1
  },
  {
    pageKey: 'terminal',
    path: '/terminal',
    pageName: 'Live Terminal',
    metaTitle: 'Live SMC Terminal | Tradrift',
    metaDescription:
      'Scan live F&O stocks for bullish and bearish order block setups, FVGs and liquidity traps with the Tradrift terminal.',
    metaKeywords: 'SMC terminal, order block scanner, FVG, live trading screener',
    ogTitle: 'Live SMC Terminal | Tradrift',
    ogDescription: 'Institutional order block screener for Indian F&O markets.',
    ogImage: '',
    canonicalUrl: '/terminal',
    robots: 'index, follow',
    sortOrder: 2
  },
  {
    pageKey: 'market-xray',
    path: '/xray',
    pageName: 'Market X-Ray',
    metaTitle: 'Market X-Ray — Sector Heatmap & Institutional Flow | Tradrift',
    metaDescription:
      'Visualize sector strength, institutional flow and market breadth with Market X-Ray analytics.',
    metaKeywords: 'market xray, sector heatmap, institutional flow, market breadth',
    ogTitle: 'Market X-Ray | Tradrift',
    ogDescription: 'Sector heatmap and institutional flow dashboard.',
    ogImage: '',
    canonicalUrl: '/xray',
    robots: 'index, follow',
    sortOrder: 3
  },
  {
    pageKey: 'pricing',
    path: '/pricing',
    pageName: 'Pricing & Plans',
    metaTitle: 'Pricing & Membership Plans | Tradrift',
    metaDescription:
      'Compare Tradrift trial, starter and pro membership plans for live SMC terminal access.',
    metaKeywords: 'tradrift pricing, trading terminal plans, SMC membership',
    ogTitle: 'Membership Plans | Tradrift',
    ogDescription: 'Choose the right plan for institutional SMC analytics.',
    ogImage: '',
    canonicalUrl: '/pricing',
    robots: 'index, follow',
    sortOrder: 7
  },
  {
    pageKey: 'about',
    path: '/about',
    pageName: 'About Us',
    metaTitle: 'About Tradrift — Institutional Trading Analytics',
    metaDescription:
      'Learn about Tradrift, our SMC research approach, and how we help traders read institutional footprints.',
    metaKeywords: 'about tradrift, SMC research, trading analytics team',
    ogTitle: 'About Tradrift',
    ogDescription: 'Institutional SMC analytics built for serious F&O traders.',
    ogImage: '',
    canonicalUrl: '/about',
    robots: 'index, follow',
    sortOrder: 8
  },
  {
    pageKey: 'contact',
    path: '/contact',
    pageName: 'Contact',
    metaTitle: 'Contact Tradrift Support',
    metaDescription:
      'Get in touch with Tradrift for support, partnerships and membership queries.',
    metaKeywords: 'contact tradrift, trading support, membership help',
    ogTitle: 'Contact | Tradrift',
    ogDescription: 'Reach the Tradrift team for support and inquiries.',
    ogImage: '',
    canonicalUrl: '/contact',
    robots: 'index, follow',
    sortOrder: 9
  },
  {
    pageKey: 'dashboard',
    path: '/dashboard',
    pageName: 'User Dashboard',
    metaTitle: 'Trader Dashboard | Tradrift',
    metaDescription: 'Manage your Tradrift membership, sessions and account settings.',
    metaKeywords: 'trader dashboard, account settings, membership',
    ogTitle: 'Trader Dashboard | Tradrift',
    ogDescription: 'Your Tradrift account dashboard.',
    ogImage: '',
    canonicalUrl: '/dashboard',
    robots: 'noindex, nofollow',
    sortOrder: 11
  },
  {
    pageKey: 'login',
    path: '/login',
    pageName: 'Login',
    metaTitle: 'Sign In | Tradrift',
    metaDescription: 'Sign in to your Tradrift account to access the live SMC terminal.',
    metaKeywords: 'tradrift login, trader sign in',
    ogTitle: 'Sign In | Tradrift',
    ogDescription: 'Access your Tradrift trading account.',
    ogImage: '',
    canonicalUrl: '/login',
    robots: 'noindex, follow',
    sortOrder: 12
  },
  {
    pageKey: 'register',
    path: '/register',
    pageName: 'Register',
    metaTitle: 'Create Account | Tradrift',
    metaDescription:
      'Create your Tradrift account and start analyzing institutional order blocks in Indian markets.',
    metaKeywords: 'tradrift register, create trading account, SMC signup',
    ogTitle: 'Create Account | Tradrift',
    ogDescription: 'Join Tradrift and trade with institutional SMC tools.',
    ogImage: '',
    canonicalUrl: '/register',
    robots: 'noindex, follow',
    sortOrder: 13
  },
  {
    pageKey: 'privacy-policy',
    path: '/privacy-policy',
    pageName: 'Privacy Policy',
    metaTitle: 'Privacy Policy | Tradrift',
    metaDescription: 'Read how Tradrift collects, uses and protects your personal data.',
    metaKeywords: 'privacy policy, data protection, tradrift privacy',
    ogTitle: 'Privacy Policy | Tradrift',
    ogDescription: 'Tradrift privacy policy for trader accounts and platform usage.',
    ogImage: '',
    canonicalUrl: '/privacy-policy',
    robots: 'index, follow',
    sortOrder: 14
  },
  {
    pageKey: 'terms',
    path: '/terms',
    pageName: 'Terms & Conditions',
    metaTitle: 'Terms & Conditions | Tradrift',
    metaDescription: 'Terms of use for the Tradrift Smart Money Concepts trading analytics platform.',
    metaKeywords: 'terms and conditions, terms of use, tradrift terms',
    ogTitle: 'Terms & Conditions | Tradrift',
    ogDescription: 'Legal terms for using Tradrift analytics and membership services.',
    ogImage: '',
    canonicalUrl: '/terms',
    robots: 'index, follow',
    sortOrder: 15
  },
  {
    pageKey: 'faq',
    path: '/faq',
    pageName: 'FAQ',
    metaTitle: 'FAQ — Frequently Asked Questions | Tradrift',
    metaDescription: 'Answers about Tradrift accounts, trial, SMC terminal, and platform policies.',
    metaKeywords: 'tradrift faq, trading terminal help, SMC questions',
    ogTitle: 'FAQ | Tradrift',
    ogDescription: 'Common questions about Tradrift membership and features.',
    ogImage: '',
    canonicalUrl: '/faq',
    robots: 'index, follow',
    sortOrder: 16
  }
];

let inMemorySeoPages = DEFAULT_SEO_PAGES.map((page, index) => ({
  ...page,
  _id: `seo_${page.pageKey}`,
  isActive: true,
  schemaMarkup: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  sortOrder: page.sortOrder || index + 1
}));

const clonePage = (page) => JSON.parse(JSON.stringify(page));

const normalizePage = (page) => {
  const obj = typeof page.toObject === 'function' ? page.toObject() : { ...page };
  return {
    _id: String(obj._id || obj.pageKey),
    pageKey: obj.pageKey,
    path: obj.path,
    pageName: obj.pageName,
    metaTitle: obj.metaTitle || '',
    metaDescription: obj.metaDescription || '',
    metaKeywords: obj.metaKeywords || '',
    ogTitle: obj.ogTitle || '',
    ogDescription: obj.ogDescription || '',
    ogImage: obj.ogImage || '',
    canonicalUrl: obj.canonicalUrl || '',
    robots: obj.robots || 'index, follow',
    schemaMarkup: obj.schemaMarkup || '',
    isActive: obj.isActive !== false,
    sortOrder: obj.sortOrder ?? 0,
    updatedAt: obj.updatedAt || null
  };
};

async function ensureSeeded() {
  try {
    const count = await SeoPage.countDocuments();
    if (count === 0) {
      await SeoPage.insertMany(DEFAULT_SEO_PAGES);
      console.log('[SEO] Seeded default SEO pages into MongoDB.');
    } else {
      // Ensure any newly added default pages exist
      for (const page of DEFAULT_SEO_PAGES) {
        const exists = await SeoPage.findOne({ pageKey: page.pageKey });
        if (!exists) {
          await SeoPage.create(page);
        }
      }
    }

    const docs = await SeoPage.find().sort({ sortOrder: 1, pageName: 1 });
    if (docs.length) {
      inMemorySeoPages = docs.map(normalizePage);
    }
  } catch {
    // Mongo offline — keep in-memory defaults
  }
}

ensureSeeded();

// Public: all active SEO pages
router.get('/pages', async (req, res) => {
  try {
    let pages = [];
    try {
      pages = await SeoPage.find({ isActive: true }).sort({ sortOrder: 1, pageName: 1 });
      if (pages.length) {
        inMemorySeoPages = (await SeoPage.find().sort({ sortOrder: 1 })).map(normalizePage);
        return res.json({ success: true, pages: pages.map(normalizePage) });
      }
    } catch {
      // fallback
    }

    pages = inMemorySeoPages.filter((p) => p.isActive !== false);
    res.json({ success: true, pages: pages.map(clonePage) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: resolve SEO by path
router.get('/resolve', async (req, res) => {
  try {
    const rawPath = (req.query.path || '/').toString();
    const pathname = rawPath.split('?')[0] || '/';

    let pages = inMemorySeoPages;
    try {
      const docs = await SeoPage.find({ isActive: true }).sort({ sortOrder: 1 });
      if (docs.length) pages = docs.map(normalizePage);
    } catch {
      pages = inMemorySeoPages.filter((p) => p.isActive !== false);
    }

    // Exact match first
    let match = pages.find((p) => p.path === pathname);

    // Alias: /market-xray -> /xray, /about-us -> /about
    if (!match && (pathname === '/market-xray' || pathname === '/about-us')) {
      const aliasPath = pathname === '/market-xray' ? '/xray' : '/about';
      match = pages.find((p) => p.path === aliasPath);
    }

    if (!match) {
      match = pages.find((p) => p.pageKey === 'home' || p.path === '/') || null;
    }

    res.json({ success: true, seo: match ? clonePage(match) : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: list all SEO pages (including inactive)
router.get('/admin/pages', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    let pages = [];
    try {
      const docs = await SeoPage.find().sort({ sortOrder: 1, pageName: 1 });
      if (docs.length) {
        pages = docs.map(normalizePage);
        inMemorySeoPages = pages;
        return res.json({ success: true, pages });
      }
    } catch {
      // fallback
    }

    res.json({ success: true, pages: inMemorySeoPages.map(clonePage) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: update SEO for a page by pageKey
router.put('/admin/pages/:pageKey', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const { pageKey } = req.params;
    const payload = req.body || {};

    const allowed = [
      'pageName',
      'path',
      'metaTitle',
      'metaDescription',
      'metaKeywords',
      'ogTitle',
      'ogDescription',
      'ogImage',
      'canonicalUrl',
      'robots',
      'schemaMarkup',
      'isActive',
      'sortOrder'
    ];

    const updates = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) updates[key] = payload[key];
    }
    updates.updatedAt = new Date();

    let updated = null;
    try {
      updated = await SeoPage.findOneAndUpdate({ pageKey }, { $set: updates }, { new: true });
    } catch {
      // fallback
    }

    if (updated) {
      const normalized = normalizePage(updated);
      inMemorySeoPages = inMemorySeoPages.map((p) => (p.pageKey === pageKey ? normalized : p));
      return res.json({ success: true, message: 'SEO settings saved', page: normalized });
    }

    const idx = inMemorySeoPages.findIndex((p) => p.pageKey === pageKey);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'SEO page not found' });
    }

    inMemorySeoPages[idx] = {
      ...inMemorySeoPages[idx],
      ...updates,
      pageKey
    };

    res.json({
      success: true,
      message: 'SEO settings saved',
      page: clonePage(inMemorySeoPages[idx])
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: bulk upsert / reset defaults
router.post('/admin/seed', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    for (const page of DEFAULT_SEO_PAGES) {
      try {
        await SeoPage.findOneAndUpdate(
          { pageKey: page.pageKey },
          { $setOnInsert: page },
          { upsert: true, new: true }
        );
      } catch {
        // ignore per-page mongo errors
      }

      const exists = inMemorySeoPages.find((p) => p.pageKey === page.pageKey);
      if (!exists) {
        inMemorySeoPages.push({
          ...page,
          _id: `seo_${page.pageKey}`,
          isActive: true,
          schemaMarkup: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    try {
      const docs = await SeoPage.find().sort({ sortOrder: 1 });
      if (docs.length) inMemorySeoPages = docs.map(normalizePage);
    } catch {
      // keep memory
    }

    res.json({
      success: true,
      message: 'All website pages are registered for SEO management',
      pages: inMemorySeoPages.map(clonePage)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
