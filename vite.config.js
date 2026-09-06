import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['server/**/*.test.js', 'client/src/**/*.test.jsx', 'client/src/**/*.test.js'],
    testTimeout: 30000
  }
});
