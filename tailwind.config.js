/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#03060d',
        deep: '#070d1a',
        panel: '#0b1426',
        edge: '#1a2a47',
        sun: { DEFAULT: '#f5b82e', soft: '#ffd770', dim: '#8a6a1f' },
        earth: { DEFAULT: '#22d3ee', soft: '#7ce8fa', dim: '#0e6d80' },
        risk: { DEFAULT: '#ff4d4f', warn: '#ff8a3d' },
        ok: '#34d399',
        ink: { DEFAULT: '#e6edf7', mute: '#8da2c0', faint: '#566b8c' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(34,211,238,0.35)',
        sunglow: '0 0 24px -6px rgba(245,184,46,0.45)',
      },
    },
  },
  plugins: [],
};
