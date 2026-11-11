import React, { useState } from 'react';
import { BookOpen, Plus, Edit, Trash2, X, Send } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';

export default function Blogs() {
  const { blogsList, createBlog, updateBlog, deleteBlog } = useAdmin();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Smart Money Concepts');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [editingBlog, setEditingBlog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title || !content) return;
    await createBlog({
      title,
      category,
      excerpt: excerpt || title,
      content
    });
    setTitle('');
    setExcerpt('');
    setContent('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingBlog) return;
    await updateBlog(editingBlog.id, editingBlog);
    setEditingBlog(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center">
          <BookOpen className="mr-2 h-5 w-5 text-amber-400" />
          SMC Educational Guides & Articles CRUD
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Author and manage in-depth Smart Money Concepts, Order Block physics, and Liquidity tutorials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Publishing Form */}
        <div className="lg:col-span-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center">
            <Plus className="mr-1.5 h-4 w-4 text-amber-400" />
            Publish New SMC Guide
          </h3>

          <form onSubmit={handlePublish} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Article Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Master Fair Value Gaps (FVG) in BankNifty"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
              >
                <option value="Smart Money Concepts">Smart Money Concepts</option>
                <option value="Liquidity Sweeps">Liquidity Sweeps</option>
                <option value="Risk Management">Risk Management</option>
                <option value="Order Flow & Imbalance">Order Flow & Imbalance</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Short Excerpt</label>
              <input
                type="text"
                placeholder="One-sentence teaser summary..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Article Content (Markdown Supported)</label>
              <textarea
                required
                rows={6}
                placeholder="Write the full educational guide content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 font-bold text-black hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5"
            >
              <span>Publish Educational Guide</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Right Col: Published Blogs List */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              Published Guides ({blogsList.length})
            </h3>
            <span className="text-[11px] text-slate-500">Live on Web SMC Blog Hub</span>
          </div>

          <div className="space-y-4">
            {blogsList.map((blog) => (
              <div
                key={blog.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-3 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800/60">
                      {blog.category}
                    </span>
                    <h4 className="font-bold text-white text-base mt-1">{blog.title}</h4>
                    <div className="text-[10px] text-slate-500">
                      {blog.author} • {blog.date} • {blog.readTime}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => setEditingBlog(blog)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(blog);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-400 text-xs line-clamp-2">{blog.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= EDIT BLOG MODAL ================= */}
      {editingBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Edit className="mr-2 h-4 w-4 text-cyan-400" />
                Edit SMC Guide
              </h3>
              <button onClick={() => setEditingBlog(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingBlog.title}
                  onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <input
                  type="text"
                  value={editingBlog.category}
                  onChange={(e) => setEditingBlog({ ...editingBlog, category: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Excerpt</label>
                <input
                  type="text"
                  value={editingBlog.excerpt || ''}
                  onChange={(e) => setEditingBlog({ ...editingBlog, excerpt: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Content</label>
                <textarea
                  rows={8}
                  required
                  value={editingBlog.content}
                  onChange={(e) => setEditingBlog({ ...editingBlog, content: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBlog(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-black hover:bg-cyan-400"
                >
                  Update Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete blog guide?"
        message={`Permanently delete "${deleteTarget?.title || 'this guide'}". This cannot be undone.`}
        confirmLabel="Delete Guide"
        cancelLabel="Keep Guide"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteBlog(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
