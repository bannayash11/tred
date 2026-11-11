import React, { useState, useEffect } from 'react';
import { Radio, TrendingUp, TrendingDown, Clock, ExternalLink, RefreshCw, Filter } from 'lucide-react';
import { fetchNews } from '../services/api';

export default function NewsView() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterImpact, setFilterImpact] = useState('ALL');

  const loadNews = () => {
    setLoading(true);
    fetchNews()
      .then((res) => {
        if (res.success) setNewsList(res.news || []);
        else setNewsList([]);
      })
      .catch((err) => {
        console.error('Error fetching news:', err);
        setNewsList([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNews();
  }, []);

  const filteredNews = newsList.filter((item) => {
    if (filterImpact === 'ALL') return true;
    return item.impact === filterImpact;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center space-x-2 rounded-full bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-800/50 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Indian Market Wire</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            NSE F&O Real-Time Market News & Catalysts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Breaking headlines, institutional order flow updates, and earnings impact reports.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2 text-xs">
          {['ALL', 'BULLISH', 'BEARISH'].map((impact) => (
            <button
              key={impact}
              onClick={() => setFilterImpact(impact)}
              className={`rounded-xl px-3 py-1.5 font-medium transition-colors ${
                filterImpact === impact
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {impact}
            </button>
          ))}
          <button
            onClick={loadNews}
            title="Refresh News"
            className="rounded-xl bg-slate-800/80 p-2 text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* News List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          Fetching live market news wire...
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500">
          No news available.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNews.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        item.impact === 'BULLISH'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : item.impact === 'BEARISH'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.impact}
                    </span>
                    <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      {item.time}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-white hover:text-cyan-300 transition-colors pt-1">
                    {item.headline}
                  </h2>
                </div>

                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                  {item.source}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

