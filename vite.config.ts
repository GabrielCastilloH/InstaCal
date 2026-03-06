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
      // Emit dist/colors.css for auth.html (public/ page, references it via <link>)
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'colors.css',
          source: generateColorsCss(),
        })
      },
    },
  ],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        auth: resolve(__dirname, 'src/auth.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        'content-ui': resolve(__dirname, 'src/content-ui.tsx'),
      },
      output: {
        entryFileNames: (chunk) =>
          ['background', 'auth', 'content', 'content-ui'].includes(chunk.name)
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
