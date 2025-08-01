import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'app',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
        chat: resolve(__dirname, 'app/d3.html')
      }
    }
  },
  server: {
    port: 3001,
    host: true,
    open: '/index.html',
    cors: true
  },
  preview: {
    port: 3001,
    host: true,
    open: true
  },
  optimizeDeps: {
    include: ['gun', 'gun/sea']
  },
  define: {
    global: 'globalThis'
  }
}) 