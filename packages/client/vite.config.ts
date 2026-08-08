import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : './',
  server: { port: 5173 },
  build: {
    target: 'es2020',
    // Игра целиком статическая: чем меньше чанков, тем меньше сетевых круговых на телефоне.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
