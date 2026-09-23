import { createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Photo/OCR import (plan 32): tesseract.js's worker script and WASM cores are served from /ocr/
// alongside the committed language data (public/ocr/eng.traineddata.gz) instead of the default
// jsDelivr CDN — so OCR works offline and under the production CSP (script-src 'self'). They're
// copied straight out of node_modules, so they always match the installed tesseract.js version and
// the multi-MB binaries never get committed. Only the LSTM cores are shipped (tesseract.js's
// default OEM is LSTM-only); the worker picks relaxed-SIMD, SIMD or plain based on the device.
const OCR_ASSETS: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
};

const nodeModulesPath = (spec: string) => fileURLToPath(new URL(`./node_modules/${spec}`, import.meta.url));

function tesseractAssets(): Plugin {
  return {
    name: 'tesseract-assets',
    // Dev: serve the files from node_modules.
    configureServer(server) {
      server.middlewares.use('/ocr/', (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0];
        const spec = OCR_ASSETS[name];
        if (!spec) return next();
        res.setHeader('Content-Type', 'text/javascript');
        createReadStream(nodeModulesPath(spec)).pipe(res);
      });
    },
    // Build: emit them into dist/ocr/ with stable (unhashed) names — the worker builds the core's
    // filename itself from corePath, so hashes would break it.
    generateBundle() {
      for (const [name, spec] of Object.entries(OCR_ASSETS)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(nodeModulesPath(spec)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tesseractAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Kitchen Canon',
        short_name: 'Kitchen Canon',
        description: 'Your personal recipe collection',
        theme_color: '#f97316',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // OCR assets (~12 MB of cores + ~3 MB language data) are not precached for every install;
        // they're cached on first use by the runtime rule below. NetworkFirst rather than
        // CacheFirst: the filenames are unhashed, so after a tesseract.js upgrade a cache-first
        // rule would keep serving a worker/core that no longer matches the bundled main-thread JS.
        globIgnores: ['ocr/**'],
        // Cache API responses for offline use
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ocr-assets',
              expiration: { maxEntries: 10 },
            },
          },
          {
            urlPattern: /^\/api\/recipes(\/[^/]+)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-recipes',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/api\/(courses|labels|meal-plans|meta)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-misc',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
