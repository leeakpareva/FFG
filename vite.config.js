import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Baked at build time; shown in the profile menu so "which version am I
    // actually running?" is answerable by looking, not guessing.
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      // Two apps, one build: the member SPA and the admin panel. Separate
      // entries mean members never download admin code (or recharts).
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
