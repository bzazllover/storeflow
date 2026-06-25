import type { Config } from 'tailwindcss'
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {
    colors: { ink: '#0d0f14', panel: '#161a23', line: '#262c3a', accent: '#5b8cff', good: '#3ecf8e', warn: '#f6c453', bad: '#ff6b6b' },
    fontFamily: { sans: ['ui-sans-serif','system-ui','sans-serif'], mono: ['ui-monospace','monospace'] }
  } },
  plugins: [],
} satisfies Config
