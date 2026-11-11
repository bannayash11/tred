import React from 'react';
import { Megaphone, X, Radio } from 'lucide-react';

export default function AnnouncementBanner({ text, onClose }) {
  if (!text) return null;

  return (
    <div className="relative isolate z-50 w-full overflow-hidden bg-gradient-to-r from-cyan-950/90 via-slate-900 to-blue-950/90 px-4 py-1.5 border-b border-cyan-800/40 text-xs shadow-sm">
      <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5 mx-auto text-center">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
          <span className="font-semibold text-cyan-300 uppercase tracking-wider text-[10px] shrink-0">
            MARKET ALERT:
          </span>
          <span className="font-medium text-slate-200 text-xs">
            {text}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors shrink-0"
            title="Dismiss announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
