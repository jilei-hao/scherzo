import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  base: '/scherzo/', // for GitHub Pages deployment
  plugins: [react()],
  server: {
    port: 3001,
  },
  optimizeDeps: {
    exclude: ['itk-wasm']
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
  },
});
