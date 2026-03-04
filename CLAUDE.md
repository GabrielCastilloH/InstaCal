# InstaCal — Architecture Reference for Claude

## Project overview
Chrome extension (Manifest V3), React + TypeScript + Vite, Firebase Auth, Google Calendar API.

## The public/ rule
`public/` is **only** for static assets: JSON manifests, HTML templates, images, fonts.
**No `.js` or `.ts` files ever live there.**
Vite copies everything in `public/` to `dist/` verbatim — nothing in `public/` goes through the TypeScript compiler or bundler.

## Single source of truth for CSS design tokens
`src/styles/colors.css` owns all CSS custom properties / design tokens.
A Vite plugin (`copy-colors-css` in `vite.config.ts`) emits it to `dist/colors.css` at build time.
- Never duplicate tokens in other files.
- Never edit `dist/` directly — it is generated output.

## Non-React entry points
Scripts that run outside the React app (`background.ts`, `auth.ts`) are added as Rollup inputs with **fixed output names (no hash)** because `manifest.json` and `auth.html` reference them by exact filename.

```ts
// vite.config.ts — rollupOptions
input: {
  main: resolve(__dirname, 'index.html'),
  background: resolve(__dirname, 'src/background.ts'),
  auth: resolve(__dirname, 'src/auth.ts'),
},
output: {
  entryFileNames: (chunk) =>
    chunk.name === 'background' || chunk.name === 'auth'
      ? '[name].js'
      : 'assets/[name]-[hash].js',
},
```

## TypeScript everywhere
All logic files are `.ts` or `.tsx`. No plain `.js` in `src/`.
Plain files in `public/` are acceptable only for truly static content (HTML, JSON) — never for scripting logic.

## Build verification
After any Vite config change, run `npm run build` and confirm `dist/` contains:
- `background.js`
- `auth.js`
- `colors.css`
- `auth.html`
- `index.html`
