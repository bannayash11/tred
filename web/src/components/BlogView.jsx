import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, User, ArrowRight, X, Sparkles, ChevronRight } from 'lucide-react';
import { fetchBlogs } from '../services/api';

export default function BlogView() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);

  useEffect(() => {
    fetchBlogs()
      .then((res) => {
        if (res.success) setBlogs(res.blogs || []);
        else setBlogs([]);
      })
      .catch((err) => {
        console.error('Error fetching blogs:', err);
        setBlogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-950/60 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-800/50 mb-2">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Institutional Education Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Smart Money Concepts & Order Block Masterclass
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Learn how institutions move price, engineer liquidity sweeps, and build positive expectancy systems.
          </p>
        </div>
      </div>

      {/* Blogs Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          Loading trading insights...
        </div>
      ) : blogs.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500">
          No blog posts available.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              onClick={() => setSelectedBlog(blog)}
              className="group cursor-pointer rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-cyan-500/40 hover:bg-slate-900/90 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-500/5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-lg bg-cyan-950 px-2.5 py-1 text-[11px] font-semibold text-cyan-400 border border-cyan-800/60">
                    {blog.category}
                  </span>
                  <span className="flex items-center text-slate-400 text-[11px]">
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    {blog.readTime}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                  {blog.title}
                </h2>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {blog.excerpt}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px] font-medium">{blog.date}</span>
                <span className="flex items-center text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">
                  <span>Read Guide</span>
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Read Blog Modal */}
      {selectedBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setSelectedBlog(null)}
              className="absolute right-5 top-5 rounded-xl bg-slate-800/80 p-2 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-4">
              <span className="rounded-lg bg-cyan-950 px-2.5 py-1 text-xs font-semibold text-cyan-400 border border-cyan-800/60">
                {selectedBlog.category}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {selectedBlog.title}
              </h1>
              <div className="flex items-center space-x-3 text-xs text-slate-400 border-b border-slate-800 pb-4">
                <span>By {selectedBlog.author}</span>
                <span>•</span>
                <span>{selectedBlog.date}</span>
                <span>•</span>
                <span>{selectedBlog.readTime}</span>
              </div>

              <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedBlog.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

