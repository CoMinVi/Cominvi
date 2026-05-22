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
        // `dist/` is versioned in git for deployment; keep deterministic filenames
        // to avoid mass renames in commits when a single source file changes.
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        compact: true,
      },
      external: ['jquery'],
    },
  },
}))
