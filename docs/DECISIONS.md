# Architectural Decisions

Key decisions and the reasoning behind them. Update this file when a significant design choice is made or revisited.

---

## Declarative content scripts (manifest) instead of dynamic injection for `content-ui.js`

`content-ui.js` is an ES module with static `import` statements (React shared chunk). `chrome.scripting.executeScript` runs scripts in classic mode and cannot resolve top-level `import`. Declaring both `content.js` and `content-ui.js` in `manifest.json → content_scripts` lets Chrome handle ES module resolution correctly.

Dynamic injection via `executeScript` is only used for `content.js` (which has no imports) when the extension is installed or the browser starts, to inject into already-open Google Calendar tabs that pre-date the extension install.

---

## Shadow DOM for the "Edit with AI" panel

The panel is injected into `calendar.google.com`, which has its own dense CSS. Shadow DOM provides full style encapsulation so Google's styles don't bleed into the panel and vice versa. Design tokens are re-injected as a `:host { --color-*: ... }` style block; component CSS is imported with `?inline` and appended as `<style>` tags into the shadow root.

---

## Fixed output names for background, auth, content, and content-ui

Vite normally hashes asset filenames for cache-busting. `manifest.json` and `auth.html` reference scripts by exact filename, so these four entry points use `[name].js` (no hash). All other chunks keep the default `assets/[name]-[hash].js` pattern.

---

## CSS design tokens in `src/styles/colors.ts` (not a `.css` file)

Tokens are TypeScript values so they can be imported by both the Vite plugin (which generates `colors.css` and injects `:root` into `index.html`) and any TypeScript code that needs a color value at runtime (e.g. `background.ts` setting the badge color). A plain `.css` file would not be importable in the service worker context.

---

## Vitest over Jest for unit testing

Vitest shares the Vite config, understands `import.meta.env`, and requires no additional Babel transforms. Jest would require a separate transform pipeline to handle ES modules and Vite-specific imports. Vitest's API is intentionally Jest-compatible, so the learning curve is minimal.

---

## Manual Chrome API stub instead of `vitest-chrome`

`vitest-chrome` publishes a CJS bundle that calls `require('vitest')`, which fails in ESM projects (`"type": "module"` in `package.json`). A small manual stub in `src/test/setup.ts` covers the surface area actually used (`chrome.storage.local.get/set`, `chrome.runtime.sendMessage`) without the compatibility issue.
