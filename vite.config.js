import { defineConfig } from 'vite'
import eslintPlugin from 'vite-plugin-eslint'

const productionAssetBase = 'https://precious-hotteok-8da21f.netlify.app/'

// vite.config.js
export default defineConfig(({ command }) => ({
  base: command === 'build' ? productionAssetBase : '/',
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
    // MapLibre and Lottie are isolated in lazy chunks; 1 MB keeps the build output focused on actionable warnings.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: './src/main.js',
      output: {
        format: 'es',
        entryFileNames: 'main.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        compact: true,
      },
      external: ['jquery'],
    },
  },
}))
