# InstaCal Manual Testing Checklist

Flows that require real Google OAuth cannot be automated and must be verified manually.

## Setup

1. `npm run build`
2. Open `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `dist/`

---

## Auth

- [ ] Fresh install → click Sign In → Google OAuth popup appears → signs in → popup UI shown
- [ ] Token expiry → background auto-refreshes (shorten `FIREBASE_TOKEN_EXPIRY_MS` in dev or wait ~55 min)
- [ ] Sign out → popup returns to sign-in screen

## Event Creation (popup)

- [ ] Type "Lunch with John tomorrow at noon" → parsed event shown → confirm → event appears in Google Calendar
- [ ] Type event with unknown name → UnknownPersonModal appears → enter email → event created with attendee
- [ ] Toggle `autoReview` off → event creation opens Google Calendar editor instead of creating directly
- [ ] Empty input → submit button disabled (no request sent)

## Context Menu

- [ ] Select text on any webpage → right-click → "Add to Calendar with InstaCal" → parses and creates event

## Edit with AI (content script)

- [ ] Open any event on `calendar.google.com` → "Edit with AI" button appears on event view
- [ ] Click button → side panel opens
- [ ] Type edit instruction → event updates in Google Calendar
- [ ] Close panel → panel dismisses cleanly (no lingering shadow DOM artifacts)

## Availability Export

- [ ] Click availability section in popup → DateRangePicker appears
- [ ] Select start date → select end date (max 14 days enforced)
- [ ] Click Copy → paste output shows correct free time blocks

## People Management

- [ ] Open Settings → People tab → add person with name + email → person appears in list
- [ ] Type event including that person's name → event created with attendee pre-filled (no modal)
- [ ] Add people up to MAX_PEOPLE (10) → adding another evicts LRU entry

## Preferences

- [ ] Change Default Duration → create timed event → duration reflects setting
- [ ] Change Default Start Time → create event → start time reflects setting
- [ ] Toggle `tasksAsAllDayEvents` → create task → all-day vs. timed behavior changes

---

## Automated Tests

```bash
# Unit tests (37 tests, no browser required)
npm run test

# Coverage report
npm run test:coverage

# E2E (requires built extension)
npm run e2e
```
