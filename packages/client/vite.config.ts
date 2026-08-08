import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2020',
    // Игра целиком статическая: чем меньше чанков, тем меньше сетевых круговых на телефоне.
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
