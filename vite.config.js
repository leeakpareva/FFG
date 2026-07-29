import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The app carries 27 base64 member photos inline, so the main chunk is
    // always going to be large. Raise the warning bar rather than chasing it.
    chunkSizeWarningLimit: 1400,
  },
});
