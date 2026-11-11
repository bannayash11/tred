import express from 'express';
import { authMiddleware, adminOnly, subAdminOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Content starts empty — admin publishes real blogs/news (no seed dummy articles)
let inMemoryBlogs = [];
let inMemoryNews = [];

// Tier Feature Rules Configuration
let tierFeatureRules = {
  trial: {
    name: '14-Day Free Trial',
    maxStocksVisible: 8,
    timeframesAllowed: ['15m'],
    maxJournalEntries: 5,
    allowMarketXRay: true,
    allowFullFVG: false
  },
  starter: {
    name: 'Monthly Starter',
    maxStocksVisible: 30,
    timeframesAllowed: ['5m', '15m'],
    maxJournalEntries: 30,
    allowMarketXRay: true,
    allowFullFVG: true
  },
  active: {
    name: '12 Months Pro Bundle',
    maxStocksVisible: 200,
    timeframesAllowed: ['1m', '5m', '15m'],
    maxJournalEntries: 9999,
    allowMarketXRay: true,
    allowFullFVG: true
  }
};

// Public Routes
router.get('/blogs', (req, res) => {
  res.json({ success: true, blogs: inMemoryBlogs });
});

router.get('/news', (req, res) => {
  res.json({ success: true, news: inMemoryNews });
});

router.get('/tier-rules', (req, res) => {
  res.json({ success: true, rules: tierFeatureRules });
});

// Admin / Sub-Admin Content Routes
router.post('/blogs', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { title, excerpt, category, content, author, readTime } = req.body;
  const newBlog = {
    id: `blog_${Date.now()}`,
    title,
    excerpt,
    category: category || 'Smart Money Concepts',
    readTime: readTime || '4 min read',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    author: author || 'OrderBlock Research Team',
    content
  };
  inMemoryBlogs.unshift(newBlog);
  res.json({ success: true, message: 'Blog published successfully', blog: newBlog });
});

router.post('/news', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { headline, category, impact, summary } = req.body;
  const newNews = {
    id: `news_${Date.now()}`,
    headline,
    category: category || 'Market Pulse',
    time: 'Just now',
    impact: impact || 'BULLISH',
    source: 'Admin Desk Broadcast',
    summary
  };
  inMemoryNews.unshift(newNews);
  res.json({ success: true, message: 'News item published', news: newNews });
});

router.put('/blogs/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  const blog = inMemoryBlogs.find(b => b.id === id);
  if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

  const { title, excerpt, category, content } = req.body;
  if (title) blog.title = title;
  if (excerpt) blog.excerpt = excerpt;
  if (category) blog.category = category;
  if (content) blog.content = content;

  res.json({ success: true, message: 'Blog updated successfully', blog });
});

router.delete('/blogs/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  inMemoryBlogs = inMemoryBlogs.filter(b => b.id !== id);
  res.json({ success: true, message: 'Blog deleted successfully' });
});

router.put('/news/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  const item = inMemoryNews.find(n => n.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'News item not found' });

  const { headline, category, impact, summary } = req.body;
  if (headline) item.headline = headline;
  if (category) item.category = category;
  if (impact) item.impact = impact;
  if (summary) item.summary = summary;

  res.json({ success: true, message: 'News item updated', news: item });
});

router.delete('/news/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  inMemoryNews = inMemoryNews.filter(n => n.id !== id);
  res.json({ success: true, message: 'News item deleted' });
});

router.post('/tier-rules', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { rules } = req.body;
  if (rules) {
    tierFeatureRules = { ...tierFeatureRules, ...rules };
  }
  res.json({ success: true, message: 'Membership tier feature rules updated', rules: tierFeatureRules });
});

export default router;

