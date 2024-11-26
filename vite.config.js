import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    watch: {
      usePolling: true,
      interval: 100,
      include: ['src/**/*'],
      patterns: ['src/**/*.html']
    }
  },
  build: {
    outDir: 'dist',
  }
}) 