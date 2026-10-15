import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base: './'` makes the build work from any sub-path, e.g.
// https://chiragdascodes.github.io/FSDCIA1/ on GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Pre-bundle everything up front so the dev server never re-optimises mid-session
  // (which can load two copies of React).
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'motion/react', 'lucide-react', 'opening_hours'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,ts}'],
  },
})
