/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#0b0f14',
          surface: '#12181f',
          surface2: '#182028',
          border: '#243040',
          muted: '#8b9aab',
          accent: '#4cc9c0',
          danger: '#f43f5e',
          success: '#34d399',
          warn: '#fbbf24'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
