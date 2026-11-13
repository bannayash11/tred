import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Instagram, Youtube, Linkedin, Facebook, Send } from 'lucide-react';
import { fetchPublicSocial } from '../../services/api';

function TwitterIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SocialIcon({ platform, className }) {
  switch (platform) {
    case 'instagram':
      return <Instagram className={className} />;
    case 'twitter':
      return <TwitterIcon className={className} />;
    case 'youtube':
      return <Youtube className={className} />;
    case 'linkedin':
      return <Linkedin className={className} />;
    case 'telegram':
      return <Send className={className} />;
    case 'facebook':
      return <Facebook className={className} />;
    default:
      return <ExternalLink className={className} />;
  }
}

export default function Footer() {
  const [social, setSocial] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSocial()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && Array.isArray(res.social)) setSocial(res.social);
      })
      .catch(() => {
        if (!cancelled) setSocial([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="border-t border-slate-800/80 bg-[#070b14] py-12 text-xs text-slate-400 mt-auto">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2.5">
              <img
                src="/brand/tradrift-logo.svg"
                alt="Tradrift"
                className="h-8 w-8 rounded-lg shadow-sm"
              />
              <span className="text-base font-extrabold text-white tracking-tight">
                Trad<span className="text-cyan-400">rift</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              India's premier institutional Smart Money Concepts (SMC) & Liquidity terminal for 200+ NSE F&O
              stocks. Built for serious intraday and swing traders.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-emerald-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Institutional Screener Engine Online</span>
            </div>

            {social.length > 0 ? (
              <div className="pt-2">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Follow us
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {social.map((item) => (
                    <a
                      key={item.key}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      title={item.label}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/70 text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
                    >
                      <SocialIcon platform={item.key} className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Terminal Suite</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/terminal" className="hover:text-cyan-400 transition-colors">
                  Live Screener Board
                </Link>
              </li>
              <li>
                <Link to="/xray" className="hover:text-cyan-400 transition-colors">
                  Market X-Ray Heatmap
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-cyan-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-cyan-400 transition-colors">
                  Pricing & Plans
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-cyan-400 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-cyan-400 transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-cyan-400 transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Security & Admin</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/dashboard" className="hover:text-cyan-400 transition-colors">
                  Trader Security Center
                </Link>
              </li>
              <li>
                <a
                  href="http://localhost:3001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors flex items-center space-x-1"
                >
                  <span>Admin Console</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="text-slate-500">SEBI Regulated Data (Dhan/Fyers)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Tradrift Analytics. All Rights Reserved. Not SEBI Registered
            Investment Advisory. Educational & Analytical Platform.
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:underline">
              Terms & Conditions
            </Link>
            <Link to="/faq" className="hover:underline">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
