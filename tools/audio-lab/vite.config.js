import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// Bundles lab.html (the headless audio test page) away from the game:
//   npx vite build -c tools/audio-lab/vite.config.js --outDir <dir>
export default defineConfig({
  root: resolve(import.meta.dirname),
  base: './',
  build: { emptyOutDir: true, rollupOptions: { input: resolve(import.meta.dirname, 'lab.html') } },
});
