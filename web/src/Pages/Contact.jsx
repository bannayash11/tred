import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setName('');
    setEmail('');
    setMessage('');
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-6">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 rounded-full bg-cyan-950 px-3.5 py-1 text-xs font-bold text-cyan-400 border border-cyan-800">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Support & Inquiries</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Get in Touch with our Trading Desk
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Have questions about SMC screener algorithms, broker API hookups, or institutional subscriptions?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Contact Info */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Direct Contacts</h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Email Desk</div>
                  <div className="font-semibold text-white">support@orderblock.local</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Trading Desk Helpline</div>
                  <div className="font-semibold text-white">+91 22 6982 4500 (Mon-Fri 9AM-5PM)</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Institutional Office</div>
                  <div className="font-semibold text-white">Bandra-Kurla Complex (BKC), Mumbai, Maharashtra 400051</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-2 text-xs text-slate-400">
            <div className="font-bold text-white text-sm">Broker API Integration Support</div>
            <p>
              Looking to connect your personal DhanHQ, Fyers v3, or Zerodha Kite Connect WebSocket keys? Our technical team provides 1-on-1 setup assistance for Pro members.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4 shadow-xl">
          <h3 className="text-base font-bold text-white">Send a Message</h3>

          {submitted && (
            <div className="rounded-xl bg-emerald-950/80 border border-emerald-800 p-3 text-xs text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Thank you! Your message has been received by our desk. We will respond within 2 hours.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Your Name</label>
              <input
                type="text"
                required
                placeholder="Rahul Mehta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="rahul@trading.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Message / Question</label>
              <textarea
                required
                rows={4}
                placeholder="How can our institutional trading desk assist you?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl bg-slate-950 p-3 text-white border border-slate-800 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 py-3 font-bold text-black hover:bg-cyan-400 transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
            >
              <span>Transmit Message</span>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

