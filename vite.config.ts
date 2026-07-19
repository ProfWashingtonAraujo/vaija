import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts'
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('@radix-ui')) return 'radix'
            if (id.includes('react-router')) return 'router'
            if (id.includes('sonner')) return 'feedback'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          }
        },
      },
    },
  },
})
