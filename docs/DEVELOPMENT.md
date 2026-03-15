# Development Guide

## Prerequisites

- Node.js 18+
- Chrome / Chromium browser
- Firebase project (for auth — ask team for credentials)

---

## Setup

```bash
git clone <repo>
cd instacal
npm install
```

Copy environment variables:

```bash
cp .env.local.example .env.local   # if it exists, otherwise create manually
```

`.env.local` values:

| Variable | Description |
|----------|-------------|
| `VITE_CLOUD_FUNCTION_URL` | Backend URL (defaults to `http://localhost:5001/instacal-app/us-central1/api` in dev) |

---

## Local Development

The popup app has a Vite dev server for fast iteration on UI components:

```bash
npm run dev
```

This only covers the popup (`index.html`). Content scripts and the background worker require a full build + extension reload.

---

## Building

```bash
npm run build
```

Outputs to `dist/`. Verify these files exist after any Vite config change:

- `background.js`
- `auth.js`
- `content.js`
- `content-ui.js`
- `colors.css`
- `auth.html`
- `index.html`

---

## Loading the Extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder
4. After any code change, run `npm run build` then click the **↺ refresh** icon on the extension card

---

## Testing

```bash
npm run test            # unit tests (Vitest, no browser)
npm run test:watch      # watch mode
npm run test:coverage   # coverage report

npm run e2e             # build + Playwright extension tests
npm run e2e:ui          # Playwright UI mode
```

See `docs/TESTING.md` for the full manual testing checklist.

---

## Linting

```bash
npm run lint
```

---

## Generating Icons

```bash
npm run generate-icons
```

Requires `sharp`. Reads source SVG and writes PNG icons into `public/icons/`.

---

## Project Constraints

- **No `.js` or `.ts` in `public/`** — only static assets (manifest, HTML, images)
- **TypeScript everywhere** in `src/`
- **Never edit `dist/`** — it is generated output
- Design tokens live only in `src/styles/colors.ts` — never duplicated elsewhere
