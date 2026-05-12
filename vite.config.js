import { defineConfig } from 'vite'
import eslintPlugin from 'vite-plugin-eslint'

// vite.config.js
const PRODUCTION_ASSET_BASE =
  process.env.VITE_ASSET_BASE || 'https://precious-hotteok-8da21f.netlify.app/'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? PRODUCTION_ASSET_BASE : './',
  plugins: [eslintPlugin({ cache: false })],
  server: {
    host: 'localhost',
    cors: '*',
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
  },
  build: {
    minify: true,
    manifest: true,
    polyfillModulePreload: false,
    rollupOptions: {
      input: './src/main.js',
      output: {
        format: 'es',
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        compact: true,
      },
      external: ['jquery'],
    },
  },
})
