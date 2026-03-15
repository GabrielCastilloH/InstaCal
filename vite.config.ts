import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { palette, status, shadows, utility, google } from './src/styles/colors'

function generateColorsCss(): string {
  return `:root {
  /* Base color scale: 100 (lightest) to 900 (darkest) */
  --color-primary-100: ${palette['primary-100']};
  --color-primary-400: ${palette['primary-400']};
  --color-primary-500: ${palette['primary-500']};
  --color-primary-600: ${palette['primary-600']};
  --color-primary-700: ${palette['primary-700']};
  --color-primary-900: ${palette['primary-900']};

  /* Semantic aliases */
  --color-bg-subtle:           var(--color-primary-100);
  --color-text-primary:        var(--color-primary-900);
  --color-text-secondary:      var(--color-primary-700);
  --color-text-tertiary:       var(--color-primary-600);
  --color-text-muted:          var(--color-primary-400);
  --color-border-default:      var(--color-primary-500);
  --color-border-focus:        var(--color-primary-700);
  --color-interactive-primary: var(--color-primary-500);
  --color-interactive-hover:   var(--color-primary-700);

  /* Status colors */
  --color-failure: ${status.failure};
  --color-success: ${status.success};

  /* Shadow tokens */
  --shadow-sm:    ${shadows.sm};
  --shadow-md:    ${shadows.md};
  --shadow-thumb: ${shadows.thumb};

  /* Utility */
  --color-white:   ${utility.white};
  --color-bg-body: ${utility['bg-body']};
  --color-bg-page: ${utility['bg-page']};

  /* Google brand (for Sign-In button — dictated by Google guidelines) */
  --color-google-text:   ${google.text};
  --color-google-border: ${google.border};
  --color-google-hover:  ${google.hover};
}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'design-tokens',
      // Inject CSS variables into index.html so all component CSS has access
      transformIndexHtml() {
        return [{ tag: 'style', children: generateColorsCss(), injectTo: 'head-prepend' }]
      },
      // Emit dist/colors.css for use by content scripts injected into external pages
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'colors.css',
          source: generateColorsCss(),
        })
      },
    },
    {
      // content-ui.tsx must be a self-contained classic script — it runs as a
      // Chrome content script and cannot load sibling ES-module chunk files.
      // We build it separately with esbuild (which bundles everything inline)
      // after Rollup finishes, overwriting any stub Rollup may have emitted.
      name: 'bundle-content-ui',
      apply: 'build',
      enforce: 'post',
      async closeBundle() {
        const { build } = await import('esbuild');
        const path = await import('path');
        const fs = await import('fs');

        await build({
          entryPoints: [path.resolve(__dirname, 'src/content-ui.tsx')],
          bundle: true,
          outfile: path.resolve(__dirname, 'dist/content-ui.js'),
          format: 'iife',
          jsx: 'automatic',
          target: 'chrome100',
          define: { 'process.env.NODE_ENV': '"production"' },
          plugins: [
            {
              // Handle Vite's `?inline` CSS imports — return the file contents
              // as an exported string so the component can inject them at runtime.
              name: 'inline-css',
              setup(build) {
                build.onResolve({ filter: /\.css\?inline$/ }, args => ({
                  path: path.resolve(path.dirname(args.importer), args.path.replace(/\?inline$/, '')),
                  namespace: 'inline-css',
                }));
                build.onLoad({ filter: /.*/, namespace: 'inline-css' }, args => ({
                  contents: `export default ${JSON.stringify(fs.readFileSync(args.path, 'utf8'))}`,
                  loader: 'js',
                }));
              },
            },
          ],
        });
      },
    },
  ],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        // content-ui is intentionally omitted here — the bundle-content-ui
        // plugin above builds it as a self-contained IIFE via esbuild.
      },
      output: {
        entryFileNames: (chunk) =>
          ['background', 'content'].includes(chunk.name)
            ? '[name].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:* https://apis.google.com https://accounts.google.com",
        "frame-src https://accounts.google.com https://*.firebaseapp.com https://*.google.com",
        "connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
        "img-src 'self' data: https://*.googleusercontent.com",
        "style-src 'self' 'unsafe-inline'",
      ].join('; '),
    },
  },
})
