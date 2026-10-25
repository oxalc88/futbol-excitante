import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: process.env.FE_BUILD_LAB === '1'
        ? { game: 'index.html', lab: 'lab.html' }
        : { game: 'index.html' },
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
