import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
    open: true
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html"
    }
  },
  optimizeDeps: {
    include: ["gun"]
  },
  resolve: {
    alias: {
      gun: "gun"
    }
  },
  root: "."
});
