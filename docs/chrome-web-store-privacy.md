# Chrome Web Store — Privacy Practices Tab

Copy each section into the corresponding field, then Save Draft.

---

## Single Purpose Description

InstaCal lets users create and edit Google Calendar events using natural language. Users can type a description in the popup or right-click selected text on any page to instantly parse and add an event. An AI-powered "Edit with AI" button is injected into Google Calendar to allow voice-style edits to existing events. Users can also export a formatted availability summary from their calendar.

---

## contextMenus

A context menu item "Add to Calendar with InstaCal" appears when the user selects text on any page. Clicking it parses the selected text as an event description and creates the calendar event or opens the Google Calendar review form. This lets users add events without opening the extension popup.

---

## identity

`chrome.identity.getAuthToken` obtains a Google OAuth access token for the signed-in Chrome profile. This token is required to authorize all Google Calendar API calls (create events, read events, check free/busy time). The token is fetched silently when the user is already authorized; interactive consent is only shown on first use. `chrome.identity.removeCachedAuthToken` is called to evict stale tokens when the Calendar API returns a 401 error.

---

## scripting

`chrome.scripting.executeScript` injects `content.js` (bundled inside the extension) into Google Calendar tabs that were already open when the extension was installed or when Chrome starts. The manifest `content_scripts` declaration only activates on pages loaded after the extension is enabled; dynamic injection covers pre-existing tabs. The injected script adds an "Edit with AI" button to event detail panels in Google Calendar — no code is fetched from the network.

---

## storage

`chrome.storage.local` stores: (1) Firebase authentication tokens (ID token, refresh token, expiry timestamp) so the background service worker can make authorized API calls without the popup being open; (2) user preferences such as default event duration, default location, and auto-review toggle; (3) a contacts list (name + email) that the user explicitly adds, enabling AI to resolve attendee names in event descriptions. All data is stored locally on the device and is never sold or shared with third parties.

---

## tabs

`chrome.tabs.query` finds open Google Calendar tabs so the content script can be injected into them on extension install and browser startup. `chrome.tabs.create` opens a new tab in two cases: (1) to show the Google Calendar event edit form pre-populated with parsed event details when the user has the auto-review preference disabled, and (2) to open an external support link from the extension's settings page.

---

## Host permissions

**`https://calendar.google.com/*`** — Required to inject the content script that adds the "Edit with AI" button to event panels in Google Calendar.

**`https://www.googleapis.com/*`** — Required to call the Google Calendar REST API to create events, fetch event details, patch existing events, and query free/busy data for the user's primary calendar.

**`https://us-central1-instacal-app.cloudfunctions.net/*`** — The extension's own backend API, used to parse natural language event descriptions and to AI-edit existing events. Only called with the user's authenticated Firebase ID token.

**`https://identitytoolkit.googleapis.com/*` and `https://securetoken.googleapis.com/*`** — Used by the Firebase Authentication SDK to sign users in and to refresh expired ID tokens in the background service worker.

**`https://instacal-app.firebaseapp.com/*`, `https://*.firebaseapp.com/*`, `https://www.gstatic.com/*`, `https://apis.google.com/*`** — Required infrastructure URLs for the Firebase Authentication SDK (auth state, CORS, and SDK delivery).

---

## Remote code execution

The extension does not execute any remote code. All JavaScript is bundled inside the extension package and served from the extension's own origin. The Content Security Policy in the manifest (`script-src 'self'; object-src 'self'`) blocks `eval()`, `new Function()`, and inline scripts. Network requests fetch data (calendar events, parsed event results) from known API endpoints — no executable code is fetched or evaluated at runtime.

---

## Data usage certification

Check the box certifying that data usage complies with the Developer Program Policies:
- Does not sell user data
- Does not use data for purposes unrelated to the extension's single purpose
- Does not use data to determine creditworthiness or for lending
- Stores tokens locally and transmits them only to the user's own Google APIs and the extension's own backend
