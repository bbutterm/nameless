import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : './',
  server: { port: 5173 },
  build: {
    target: 'es2020',
    // Собираем строго внутрь пакета — так делает Vite по умолчанию и так это
    // точно работает. Попытка писать сразу в корневой ../../dist оказалась
    // единственным изменением между коммитом, который на Vercel собрался, и
    // коммитом, который молча умирал на transforming; экзотику убрали.
    // Результат зеркалится в корень отдельным шагом (scripts/mirror-dist.mjs).
    outDir: 'dist',
    // Игра целиком статическая: чем меньше чанков, тем меньше сетевых круговых на телефоне.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react';
          // Текст трёх глав — почти весь вес бандла. Отдельным чанком он не
          // мешает оболочке отрисоваться, и браузер кэширует его отдельно от кода.
          if (id.includes('/content/data/') || id.includes('content/src/generated')) {
            return 'content';
          }
          return undefined;
        },
      },
    },
  },
});
