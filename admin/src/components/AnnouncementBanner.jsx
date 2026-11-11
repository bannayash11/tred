import React from 'react';
import { Megaphone, X } from 'lucide-react';

export default function AnnouncementBanner({ text, onClose }) {
  if (!text) return null;

  return (
    <div className="relative isolate flex items-center justify-between gap-x-6 overflow-hidden bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 px-4 py-2 border-b border-cyan-800/40 text-xs">
      <div className="flex items-center gap-x-3 mx-auto">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
          <Megaphone className="h-3 w-3" />
        </span>
        <span className="font-medium text-slate-200">
          {text}
        </span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
