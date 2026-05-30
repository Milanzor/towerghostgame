import { defineConfig } from 'vite'

// Build into docs/ so GitHub Pages (and GitHub Actions) can serve it.
// base './' makes all asset URLs relative, so it works under
// https://<user>.github.io/<repo>/ without extra config.
// Hashed asset filenames let the in-app auto-updater detect new builds.
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
