import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// JPL Horizons does not send CORS headers, so the browser talks to it through
// this same-origin proxy (available in both `npm run dev` and `npm run preview`).
const horizonsProxy = {
  '/api/horizons': {
    target: 'https://ssd.jpl.nasa.gov',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/horizons/, '/api/horizons.api'),
  },
};

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { proxy: horizonsProxy },
  preview: { proxy: horizonsProxy },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
        },
      },
    },
  },
});
