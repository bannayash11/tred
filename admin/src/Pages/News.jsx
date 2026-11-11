import React, { useState } from 'react';
import { Newspaper, Plus, Edit, Trash2, X, Send } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ConfirmModal from '../components/ConfirmModal';

export default function News() {
  const { newsList, createNews, updateNews, deleteNews } = useAdmin();

  const [headline, setHeadline] = useState('');
  const [category, setCategory] = useState('Nifty Indices');
  const [impact, setImpact] = useState('BULLISH');
  const [summary, setSummary] = useState('');
  const [editingNews, setEditingNews] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!headline || !summary) return;
    await createNews({ headline, category, impact, summary });
    setHeadline('');
    setSummary('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingNews) return;
    await updateNews(editingNews.id, editingNews);
    setEditingNews(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center">
          <Newspaper className="mr-2 h-5 w-5 text-amber-400" />
          Live Market News Wire CRUD
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Publish breaking financial updates with algorithmic market impact tags (Bullish, Bearish, Neutral).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Publishing Form */}
        <div className="lg:col-span-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center">
            <Plus className="mr-1.5 h-4 w-4 text-amber-400" />
            Publish Market Headline
          </h3>

          <form onSubmit={handlePublish} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Headline</label>
              <input
                type="text"
                required
                placeholder="e.g. RBI Keeps Repo Rate Unchanged at 6.5%"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                >
                  <option value="Nifty Indices">Nifty Indices</option>
                  <option value="Banking">Banking</option>
                  <option value="Auto & Metals">Auto & Metals</option>
                  <option value="Global Cues">Global Cues</option>
                  <option value="F&O Flow">F&O Flow</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Market Impact</label>
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                >
                  <option value="BULLISH">🟢 Bullish</option>
                  <option value="BEARISH">🔴 Bearish</option>
                  <option value="NEUTRAL">⚪ Neutral</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Analytical Summary</label>
              <textarea
                required
                rows={4}
                placeholder="Detailed market commentary and institutional significance..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 font-bold text-black hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5"
            >
              <span>Broadcast Headline</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Right Col: Published News Stream */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              Published Headlines ({newsList.length})
            </h3>
            <span className="text-[11px] text-slate-500">Live feed to Web News Tab</span>
          </div>

          <div className="space-y-3">
            {newsList.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          item.impact === 'BULLISH'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : item.impact === 'BEARISH'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.impact}
                      </span>
                      <span className="text-slate-400 text-[10px]">{item.category}</span>
                      <span className="text-slate-600 text-[10px]">• {item.time || 'Today'}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm">{item.headline}</h4>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => setEditingNews(item)}
                      className="p-1 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-900"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(item);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= EDIT NEWS MODAL ================= */}
      {editingNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Edit className="mr-2 h-4 w-4 text-cyan-400" />
                Edit News Wire Item
              </h3>
              <button onClick={() => setEditingNews(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Headline</label>
                <input
                  type="text"
                  required
                  value={editingNews.headline}
                  onChange={(e) => setEditingNews({ ...editingNews, headline: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    value={editingNews.category}
                    onChange={(e) => setEditingNews({ ...editingNews, category: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Impact</label>
                  <select
                    value={editingNews.impact}
                    onChange={(e) => setEditingNews({ ...editingNews, impact: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                  >
                    <option value="BULLISH">🟢 Bullish</option>
                    <option value="BEARISH">🔴 Bearish</option>
                    <option value="NEUTRAL">⚪ Neutral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Summary</label>
                <textarea
                  rows={4}
                  required
                  value={editingNews.summary}
                  onChange={(e) => setEditingNews({ ...editingNews, summary: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-white border border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingNews(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-black hover:bg-cyan-400"
                >
                  Update News Wire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete news item?"
        message={`Permanently delete "${deleteTarget?.headline || 'this news wire'}". This cannot be undone.`}
        confirmLabel="Delete News"
        cancelLabel="Keep Item"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteNews(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
