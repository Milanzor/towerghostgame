import { defineConfig } from 'vite'

// Build into docs/ so GitHub Pages (and GitHub Actions) can serve it.
// base './' makes all asset URLs relative, so it works under
// https://<user>.github.io/<repo>/ without extra config.
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
})
