/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#0f172a',
        surfaceLight: '#1e293b',
        borderMuted: '#334155',
        bullish: '#10b981',
        bullishGlow: 'rgba(16, 185, 129, 0.15)',
        bearish: '#f43f5e',
        bearishGlow: 'rgba(244, 63, 94, 0.15)',
        accentCyan: '#06b6d4',
        accentGold: '#f59e0b'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
