import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, BookOpen, Clock, Calendar, User, Share2, Bookmark } from 'lucide-react';
import { fetchBlogs } from '../services/api';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogs()
      .then((res) => {
        if (res.success && res.blogs) {
          const found = res.blogs.find((b) => b.id === id || b.id === `blog_${id}`);
          setBlog(found || res.blogs[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Loading SMC educational article...
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-white">Article Not Found</h2>
        <button
          onClick={() => navigate('/blog')}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-black"
        >
          Return to Blog Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <button
        onClick={() => navigate('/blog')}
        className="inline-flex items-center space-x-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to SMC Educational Hub</span>
      </button>

      {/* Article Header */}
      <div className="space-y-4 border-b border-slate-800 pb-6">
        <div className="inline-flex items-center space-x-2 rounded-full bg-cyan-950 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-800/60">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{blog.category}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {blog.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <User className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-300 font-semibold">{blog.author}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{blog.date}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{blog.readTime}</span>
          </div>
        </div>
      </div>

      {/* Article Body */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10 space-y-6 text-sm text-slate-300 leading-relaxed font-sans shadow-xl">
        <div className="text-base font-medium text-slate-200 border-l-4 border-cyan-400 pl-4 py-1 italic bg-cyan-950/20 rounded-r-xl">
          {blog.excerpt}
        </div>

        <div className="space-y-4 whitespace-pre-line text-slate-300">
          {blog.content}
        </div>
      </div>

      {/* Footer Share & Navigation */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-6">
        <button
          onClick={() => navigate('/blog')}
          className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          &larr; More Educational Guides
        </button>

        <button
          onClick={() =>
            navigate(isAuthenticated ? '/terminal' : '/login?next=/terminal')
          }
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-black hover:opacity-90 shadow-lg shadow-cyan-500/20"
        >
          {isAuthenticated ? 'Scan These Setups in Live Terminal →' : 'Login to Open Live Terminal →'}
        </button>
      </div>
    </div>
  );
}

