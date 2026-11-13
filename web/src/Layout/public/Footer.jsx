import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#070b14] py-12 text-xs text-slate-400 mt-auto">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Col 1: Brand */}
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
              India's premier institutional Smart Money Concepts (SMC) & Liquidity terminal for 200+ NSE F&O stocks. Built for serious intraday and swing traders.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-emerald-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Institutional Screener Engine Online</span>
            </div>
          </div>

          {/* Col 2: Terminal Pages */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Terminal Suite</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/terminal" className="hover:text-cyan-400 transition-colors">Live Screener Board</Link>
              </li>
              <li>
                <Link to="/xray" className="hover:text-cyan-400 transition-colors">Market X-Ray Heatmap</Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-cyan-400 transition-colors">Dashboard</Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-cyan-400 transition-colors">Pricing & Plans</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Company */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-cyan-400 transition-colors">About</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-cyan-400 transition-colors">Contact Support</Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-cyan-400 transition-colors">Pricing</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform Security & Admin */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Security & Admin</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/dashboard" className="hover:text-cyan-400 transition-colors">Trader Security Center</Link>
              </li>
              <li>
                <a
                  href="http://localhost:3004"
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

        {/* Disclaimer & Copyright */}
        <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Tradrift Analytics. All Rights Reserved. Not SEBI Registered Investment Advisory. Educational & Analytical Platform.
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:underline">Terms & Conditions</Link>
            <Link to="/faq" className="hover:underline">FAQ</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}

