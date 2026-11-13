import express from 'express';
import { CmsPage } from '../models/CmsPage.js';
import { authMiddleware, subAdminOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const DEFAULT_CMS_PAGES = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: `## Privacy Policy

Last updated: November 6, 2026

Tradrift ("we", "our", or "us") respects your privacy. This policy explains how we collect, use, and protect information when you use our Smart Money Concepts trading analytics platform.

### 1. Information We Collect
- Account details such as name, email address, and date of birth
- Subscription and billing-related information
- Usage data from the terminal and dashboard features
- Technical data such as IP address, browser type, and device information

### 2. How We Use Your Information
- To create and manage your trader account
- To provide live market analytics and membership services
- To improve platform performance and security
- To send important service or membership communications

### 3. Data Sharing
We do not sell your personal data. We may share limited information with trusted service providers (hosting, payments, analytics) strictly to operate the platform, or when required by law.

### 4. Data Security
We use industry-standard safeguards including encrypted sessions and access controls. No method of transmission over the internet is 100% secure, but we continuously work to protect your account.

### 5. Your Rights
You may request access, correction, or deletion of your personal data by contacting support through the Contact page.

### 6. Contact
For privacy questions, reach us via the Contact page on Tradrift.`,
    faqItems: [],
    isPublished: true
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    content: `## Terms & Conditions

Last updated: November 6, 2026

By creating an account or using Tradrift, you agree to these Terms & Conditions.

### 1. Eligibility
You must be at least 18 years old and legally able to enter into this agreement to use the platform.

### 2. Nature of Service
Tradrift provides educational and analytical tools related to Smart Money Concepts, order blocks, liquidity, and market structure. We do **not** provide investment advice, brokerage services, or guaranteed trading profits.

### 3. Account Responsibility
You are responsible for keeping your login credentials secure and for all activity under your account.

### 4. Acceptable Use
You agree not to misuse the platform, attempt unauthorized access, scrape data abusively, or disrupt service for other users.

### 5. Subscriptions & Trials
Paid plans and free trials are subject to the pricing and duration shown at signup or on the Pricing page. Refunds, if any, follow our published policy.

### 6. Risk Disclosure
Trading in futures and options involves substantial risk of loss. Past performance does not guarantee future results. You alone are responsible for your trading decisions.

### 7. Limitation of Liability
To the maximum extent permitted by law, Tradrift is not liable for trading losses, indirect damages, or service interruptions beyond our reasonable control.

### 8. Changes
We may update these terms from time to time. Continued use of the platform after updates means you accept the revised terms.

### 9. Contact
Questions about these terms can be sent through the Contact page.`,
    faqItems: [],
    isPublished: true
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    content: '',
    faqItems: [
      {
        question: 'What is Tradrift?',
        answer:
          'Tradrift is an institutional Smart Money Concepts (SMC) analytics terminal for Indian F&O markets, covering order blocks, FVGs, liquidity sweeps, and Market X-Ray.'
      },
      {
        question: 'Who can create an account?',
        answer:
          'Only users aged 18 years or older can register. You must also accept our Terms & Conditions and Privacy Policy during signup.'
      },
      {
        question: 'Is this investment advice?',
        answer:
          'No. Tradrift provides analytics and education tools. All trading decisions and risk remain solely with you.'
      },
      {
        question: 'What is included in the free trial?',
        answer:
          'New traders get a 14-day institutional trial with access to the live terminal and Market X-Ray based on the trial plan limits.'
      },
      {
        question: 'How do I cancel or manage my plan?',
        answer:
          'You can review membership details from your Trader Dashboard. For billing help, contact support through the Contact page.'
      },
      {
        question: 'How is my data protected?',
        answer:
          'We use encrypted sessions and access controls. Full details are available in our Privacy Policy.'
      }
    ],
    isPublished: true
  }
];

let inMemoryCmsPages = DEFAULT_CMS_PAGES.map((page) => ({
  ...page,
  _id: `cms_${page.slug}`,
  createdAt: new Date(),
  updatedAt: new Date()
}));

const clone = (v) => JSON.parse(JSON.stringify(v));

const normalizePage = (page) => {
  const obj = typeof page.toObject === 'function' ? page.toObject() : { ...page };
  return {
    _id: String(obj._id || `cms_${obj.slug}`),
    slug: obj.slug,
    title: obj.title || '',
    content: obj.content || '',
    faqItems: Array.isArray(obj.faqItems) ? obj.faqItems : [],
    isPublished: obj.isPublished !== false,
    updatedAt: obj.updatedAt || null,
    createdAt: obj.createdAt || null
  };
};

async function ensureSeeded() {
  try {
    for (const page of DEFAULT_CMS_PAGES) {
      const exists = await CmsPage.findOne({ slug: page.slug });
      if (!exists) {
        await CmsPage.create(page);
      }
    }
    const docs = await CmsPage.find().sort({ title: 1 });
    if (docs.length) inMemoryCmsPages = docs.map(normalizePage);
  } catch {
    // Mongo offline — keep in-memory defaults
  }
}

ensureSeeded();

// Public: list published CMS pages (summary)
router.get('/pages', async (req, res) => {
  try {
    let pages = [];
    try {
      const docs = await CmsPage.find({ isPublished: true }).sort({ title: 1 });
      if (docs.length) {
        pages = docs.map(normalizePage);
        return res.json({ success: true, pages });
      }
    } catch {
      // fallback
    }
    pages = inMemoryCmsPages.filter((p) => p.isPublished !== false).map(clone);
    res.json({ success: true, pages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: get one page by slug
router.get('/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let page = null;

    try {
      const doc = await CmsPage.findOne({ slug, isPublished: true });
      if (doc) page = normalizePage(doc);
    } catch {
      // fallback
    }

    if (!page) {
      page = inMemoryCmsPages.find((p) => p.slug === slug && p.isPublished !== false) || null;
    }

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    res.json({ success: true, page: clone(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: list all
router.get('/admin/pages', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    let pages = [];
    try {
      const docs = await CmsPage.find().sort({ title: 1 });
      if (docs.length) {
        pages = docs.map(normalizePage);
        inMemoryCmsPages = pages;
        return res.json({ success: true, pages });
      }
    } catch {
      // fallback
    }
    res.json({ success: true, pages: inMemoryCmsPages.map(clone) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: update by slug
router.put('/admin/pages/:slug', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const allowedSlugs = ['privacy-policy', 'terms-and-conditions', 'faq'];
    if (!allowedSlugs.includes(slug)) {
      return res.status(400).json({ success: false, message: 'Invalid CMS page slug' });
    }

    const { title, content, faqItems, isPublished } = req.body || {};
    const updates = { updatedAt: new Date() };
    if (title !== undefined) updates.title = String(title).trim();
    if (content !== undefined) updates.content = String(content);
    if (isPublished !== undefined) updates.isPublished = !!isPublished;
    if (faqItems !== undefined) {
      updates.faqItems = Array.isArray(faqItems)
        ? faqItems
            .filter((item) => item && String(item.question || '').trim() && String(item.answer || '').trim())
            .map((item) => ({
              question: String(item.question).trim(),
              answer: String(item.answer).trim()
            }))
        : [];
    }

    let updated = null;
    try {
      updated = await CmsPage.findOneAndUpdate({ slug }, { $set: updates }, { new: true, upsert: true });
    } catch {
      // fallback
    }

    if (updated) {
      const normalized = normalizePage(updated);
      const idx = inMemoryCmsPages.findIndex((p) => p.slug === slug);
      if (idx >= 0) inMemoryCmsPages[idx] = normalized;
      else inMemoryCmsPages.push(normalized);
      return res.json({ success: true, message: 'CMS page saved', page: normalized });
    }

    const idx = inMemoryCmsPages.findIndex((p) => p.slug === slug);
    if (idx === -1) {
      const created = {
        _id: `cms_${slug}`,
        slug,
        title: updates.title || slug,
        content: updates.content || '',
        faqItems: updates.faqItems || [],
        isPublished: updates.isPublished !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryCmsPages.push(created);
      return res.json({ success: true, message: 'CMS page saved', page: clone(created) });
    }

    inMemoryCmsPages[idx] = {
      ...inMemoryCmsPages[idx],
      ...updates,
      slug
    };

    res.json({ success: true, message: 'CMS page saved', page: clone(inMemoryCmsPages[idx]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: reseed defaults (does not overwrite existing content if already present — only fills missing)
router.post('/admin/seed', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    await ensureSeeded();
    try {
      const docs = await CmsPage.find().sort({ title: 1 });
      if (docs.length) inMemoryCmsPages = docs.map(normalizePage);
    } catch {
      // keep memory
    }
    res.json({
      success: true,
      message: 'CMS pages ready (Privacy, Terms, FAQ)',
      pages: inMemoryCmsPages.map(clone)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
