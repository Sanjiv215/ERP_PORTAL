import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['server/**/*.test.js', 'client/src/**/*.test.jsx'],
    testTimeout: 30000
  }
});
