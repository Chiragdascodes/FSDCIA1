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
    include: ['react', 'react-dom', 'react-dom/client', 'motion/react', 'lucide-react', 'opening_hours'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // Separate long-lived vendor chunks so app updates don't re-download the map engine.
        advancedChunks: {
          groups: [
            { name: 'maplibre', test: /node_modules[\/]maplibre-gl/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,ts}'],
  },
})
