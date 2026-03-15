# Architecture

## Overview

InstaCal is a Chrome Extension (Manifest V3) built with React + TypeScript + Vite, Firebase Auth, and the Google Calendar API.

---

## Entry Points

| File | Output | Purpose |
|------|--------|---------|
| `src/main.tsx` → `index.html` | `assets/main-[hash].js` | Popup React app |
| `src/background.ts` | `background.js` | Service worker (fixed name — referenced in manifest) |
| `src/auth.ts` | `auth.js` | Auth page script (fixed name — referenced in `auth.html`) |
| `src/content.ts` | `content.js` | Lightweight DOM injector for Google Calendar |
| `src/content-ui.tsx` | `content-ui.js` | React app for the "Edit with AI" panel |

`background.js`, `auth.js`, `content.js`, and `content-ui.js` use fixed output names (no hash) because `manifest.json` and `auth.html` reference them by exact filename.

---

## Event Creation Flow (Popup)

```
User types text
  → App.tsx calls parseEvent() (src/services/parseEvent.ts)
    → POST /parse to Firebase Cloud Function (Bearer: Firebase ID token)
      → Returns ParsedEvent { title, start, end, location, ... }
  → If unknownAttendees present → UnknownPersonModal
  → background.ts createCalendarEvent() → Google Calendar API
  → Or if autoReview=false → open google.com/calendar/r/eventedit URL
```

## Context Menu Flow

```
User selects text → right-click → "Add to Calendar with InstaCal"
  → background.ts contextMenus.onClicked
    → getTokens() (refreshes Firebase token if expired)
    → parseEvent() → Google Calendar API or review URL
```

## Edit with AI Flow (Content Script)

```
content.ts injects button + shadow host (#instacal-react-root) into Google Calendar DOM
content-ui.ts MutationObserver detects host → mounts React → dispatches instacal:ui-ready
content.ts receives instacal:ui-ready → dispatches instacal:open-panel with event data

User submits instruction in panel
  → sendMessage({ action: 'editEventWithAI', ... }) → background.ts
    → fetchEvent() from Google Calendar API
    → POST /edit-event (Bearer: Firebase ID token)
    → Returns updated ParsedEvent + unknownAttendees
  → If unknownAttendees → UnknownPersonModal in shadow DOM
  → sendMessage({ action: 'patchCalendarEvent', ... }) → background.ts
    → PATCH Google Calendar API
```

---

## Token Storage

All tokens are stored in `chrome.storage.local`:

| Key | Value |
|-----|-------|
| `instacal_google_calendar_token` | Google OAuth access token |
| `instacal_google_calendar_token_expiry` | Expiry timestamp (ms) |
| `instacal_firebase_id_token` | Firebase ID token |
| `instacal_firebase_id_token_expiry` | Expiry timestamp (ms) |
| `instacal_firebase_refresh_token` | Firebase refresh token |
| `instacal_firebase_api_key` | Firebase API key |
| `instacal_backend_url` | Cloud Function base URL |

The background service worker auto-refreshes the Firebase ID token when it is within `TOKEN_EXPIRY_BUFFER_MS` (5 min) of expiry using the refresh token.

---

## Shadow DOM (Content Script UI)

`content.ts` creates `#instacal-react-root` as a fixed-position shadow host (`z-index: 2147483646`, `pointer-events: none`). `content-ui.tsx` mounts React into its shadow root. CSS design tokens are injected as a `:host { --color-*: ... }` style tag; component CSS is imported with `?inline` and injected as `<style>` tags into the shadow root.

---

## CSS Design Tokens

All tokens live in `src/styles/colors.ts`. A custom Vite plugin (`design-tokens` in `vite.config.ts`) generates CSS from those values at build time:
- Injects `:root { ... }` into `index.html` via `transformIndexHtml`
- Emits `dist/colors.css` for `auth.html` via `generateBundle`

Never duplicate token values. Never edit `dist/` directly.

---

## Key Source Files

```
src/
  background.ts         Service worker — token management, Calendar API, context menu
  auth.ts               Firebase sign-in page script
  content.ts            Injects button + shadow host into Google Calendar
  content-ui.tsx        React app inside shadow DOM
  App.tsx               Popup React app root
  constants.ts          Shared constants (keys, limits, defaults)
  services/
    parseEvent.ts       POST /parse — AI event parsing
    prefs.ts            chrome.storage CRUD for user preferences
    calendar.ts         Google Calendar API helpers (popup path)
    availability.ts     Free/busy export logic
    firestorePeople.ts  Firestore sync for People list
  utils/
    people.ts           In-memory people CRUD + LRU eviction
    messaging.ts        chrome.runtime.sendMessage wrapper
  hooks/
    usePeople.ts        React hook — loads/saves people from storage
  components/
    UnknownPersonModal  Prompts for email when attendee name is unrecognized
    DateRangePicker     Calendar UI for availability export date range
```
