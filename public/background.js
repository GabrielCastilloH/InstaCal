const CONTEXT_TEXT_KEY = 'instacal_context_text';
const PREF_KEY = 'instacal_prefs';
const GOOGLE_TOKEN_KEY = 'instacal_google_calendar_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'instacal_google_calendar_token_expiry';
const FIREBASE_TOKEN_KEY = 'instacal_firebase_token';
const FIREBASE_TOKEN_EXPIRY_KEY = 'instacal_firebase_token_expiry';
const FIREBASE_REFRESH_TOKEN_KEY = 'instacal_firebase_refresh_token';
const GOOGLE_CLIENT_ID_KEY = 'instacal_google_client_id';
const FIREBASE_API_KEY_KEY = 'instacal_firebase_api_key';

const BACKEND_URL = 'https://us-central1-instacal-app.cloudfunctions.net/api';

const DEFAULT_PREFS = {
    autoReview: true,
    smartDefaults: true,
    defaultDuration: 60,
    defaultStartTime: '12:00',
    defaultLocation: 'TBD',
};

function injectContentScriptIntoGCalTabs() {
    chrome.tabs.query({ url: 'https://calendar.google.com/*' }, (tabs) => {
        console.log('[InstaCal background] found', tabs.length, 'open GCal tab(s), injecting content script');
        for (const tab of tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js'],
            }).catch((err) => {
                console.warn('[InstaCal background] scripting inject failed for tab', tab.id, err);
            });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('InstaCal installed!');
    injectContentScriptIntoGCalTabs();
    chrome.contextMenus.create({
        id: 'add-to-instacal',
        title: 'Add to InstaCal',
        contexts: ['selection'],
    });
});

function buildCalendarUrl(event) {
    const fmt = (iso) => iso.slice(0, 19).replace(/-/g, '').replace(/:/g, '');
    const dates = `${fmt(event.start)}/${fmt(event.end)}`;
    const url = new URL('https://calendar.google.com/calendar/r/eventedit');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', dates);
    if (event.location) url.searchParams.set('location', event.location);
    if (event.description) url.searchParams.set('details', event.description);
    return url.toString();
}

function openPopupWithText(text) {
    chrome.storage.local.set({ [CONTEXT_TEXT_KEY]: text });
    chrome.windows.create({
        url: chrome.runtime.getURL('index.html'),
        type: 'popup',
        width: 380,
        height: 340,
    });
}

async function silentRefreshGoogleToken(clientId) {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
    ].join(' '));
    authUrl.searchParams.set('prompt', 'none');

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: authUrl.toString(), interactive: false },
            (responseUrl) => {
                if (chrome.runtime.lastError || !responseUrl) {
                    reject(new Error(chrome.runtime.lastError?.message ?? 'Silent refresh failed'));
                    return;
                }
                const hashParams = new URLSearchParams(new URL(responseUrl).hash.slice(1));
                const accessToken = hashParams.get('access_token');
                const expiresIn = parseInt(hashParams.get('expires_in') ?? '3600', 10);
                if (!accessToken) {
                    reject(new Error('No access token in response'));
                } else {
                    resolve({ accessToken, expiresIn });
                }
            }
        );
    });
}

async function refreshFirebaseToken(refreshToken, firebaseApiKey) {
    const response = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
        }
    );
    if (!response.ok) throw new Error(`Firebase refresh failed: ${response.status}`);
    const data = await response.json();
    return {
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: parseInt(data.expires_in, 10),
    };
}

chrome.runtime.onStartup.addListener(() => {
    injectContentScriptIntoGCalTabs();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'openEditWithAI') {
        chrome.storage.local.set({ instacal_edit_context: message.editContext ?? null });
        openPopupWithText(message.text || '');
        return false;
    }

    if (message.action === 'editEventWithAI') {
        handleEditEventWithAI(message).then(sendResponse).catch((err) => {
            sendResponse({ success: false, error: err.message || 'Unknown error' });
        });
        return true; // keep message channel open for async response
    }
});

async function handleEditEventWithAI({ text, eventId, calendarId }) {
    const storage = await new Promise((resolve) => {
        chrome.storage.local.get(
            [
                PREF_KEY,
                GOOGLE_TOKEN_KEY, GOOGLE_TOKEN_EXPIRY_KEY,
                FIREBASE_TOKEN_KEY, FIREBASE_TOKEN_EXPIRY_KEY,
                FIREBASE_REFRESH_TOKEN_KEY,
                GOOGLE_CLIENT_ID_KEY, FIREBASE_API_KEY_KEY,
            ],
            resolve
        );
    });

    const prefs = { ...DEFAULT_PREFS, ...(storage[PREF_KEY] || {}) };
    let googleToken   = storage[GOOGLE_TOKEN_KEY];
    const googleExpiry = storage[GOOGLE_TOKEN_EXPIRY_KEY];
    let firebaseToken  = storage[FIREBASE_TOKEN_KEY];
    const firebaseExpiry = storage[FIREBASE_TOKEN_EXPIRY_KEY];
    const firebaseRefreshToken = storage[FIREBASE_REFRESH_TOKEN_KEY];
    const clientId     = storage[GOOGLE_CLIENT_ID_KEY];
    const firebaseApiKey = storage[FIREBASE_API_KEY_KEY];

    const googleValid  = googleToken  && googleExpiry  && Date.now() < googleExpiry  - 5 * 60 * 1000;
    const firebaseValid = firebaseToken && firebaseExpiry && Date.now() < firebaseExpiry;

    if (!googleValid || !firebaseValid) {
        if (!clientId || !firebaseApiKey) throw new Error('Not signed in to InstaCal');
        if (!googleValid) {
            const { accessToken, expiresIn } = await silentRefreshGoogleToken(clientId);
            chrome.storage.local.set({
                [GOOGLE_TOKEN_KEY]: accessToken,
                [GOOGLE_TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
            });
            googleToken = accessToken;
        }
        if (!firebaseValid) {
            if (!firebaseRefreshToken) throw new Error('No Firebase refresh token');
            const { idToken, refreshToken: newRefresh, expiresIn } =
                await refreshFirebaseToken(firebaseRefreshToken, firebaseApiKey);
            chrome.storage.local.set({
                [FIREBASE_TOKEN_KEY]: idToken,
                [FIREBASE_TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
                [FIREBASE_REFRESH_TOKEN_KEY]: newRefresh,
            });
            firebaseToken = idToken;
        }
    }

    // Parse the user's description into event fields
    const parseResp = await fetch(`${BACKEND_URL}/parse`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({
            text,
            now: new Date().toISOString(),
            defaults: {
                smartDefaults: prefs.smartDefaults,
                defaultDuration: prefs.defaultDuration,
                defaultStartTime: prefs.defaultStartTime,
                defaultLocation: prefs.defaultLocation,
            },
        }),
    });
    if (!parseResp.ok) throw new Error(`Parse error: ${parseResp.status}`);
    const event = await parseResp.json();

    // PATCH the existing calendar event
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const patchBody = {
        summary: event.title,
        start: { dateTime: event.start, timeZone },
        end:   { dateTime: event.end,   timeZone },
        ...(event.location    != null && { location:    event.location }),
        ...(event.description != null && { description: event.description }),
    };
    const calId  = calendarId || 'primary';
    const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`;
    const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
    });
    if (!patchResp.ok) {
        const body = await patchResp.text();
        throw new Error(`Calendar API error ${patchResp.status}: ${body}`);
    }

    return { success: true };
}

chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'add-to-instacal' || !info.selectionText) return;
    const text = info.selectionText.trim();
    if (!text) return;

    const storage = await new Promise((resolve) => {
        chrome.storage.local.get(
            [
                PREF_KEY,
                GOOGLE_TOKEN_KEY, GOOGLE_TOKEN_EXPIRY_KEY,
                FIREBASE_TOKEN_KEY, FIREBASE_TOKEN_EXPIRY_KEY,
                FIREBASE_REFRESH_TOKEN_KEY,
                GOOGLE_CLIENT_ID_KEY, FIREBASE_API_KEY_KEY,
            ],
            resolve
        );
    });

    const prefs = { ...DEFAULT_PREFS, ...(storage[PREF_KEY] || {}) };

    let googleToken = storage[GOOGLE_TOKEN_KEY];
    const googleExpiry = storage[GOOGLE_TOKEN_EXPIRY_KEY];
    let firebaseToken = storage[FIREBASE_TOKEN_KEY];
    const firebaseExpiry = storage[FIREBASE_TOKEN_EXPIRY_KEY];
    const firebaseRefreshToken = storage[FIREBASE_REFRESH_TOKEN_KEY];
    const clientId = storage[GOOGLE_CLIENT_ID_KEY];
    const firebaseApiKey = storage[FIREBASE_API_KEY_KEY];

    const googleValid = googleToken && googleExpiry && Date.now() < googleExpiry - 5 * 60 * 1000;
    const firebaseValid = firebaseToken && firebaseExpiry && Date.now() < firebaseExpiry;

    if (!googleValid || !firebaseValid) {
        // Must have config to do any silent refresh; if missing, user hasn't signed in yet
        if (!clientId || !firebaseApiKey) {
            openPopupWithText(text);
            return;
        }

        try {
            if (!googleValid) {
                const { accessToken: newGoogleToken, expiresIn } = await silentRefreshGoogleToken(clientId);
                chrome.storage.local.set({
                    [GOOGLE_TOKEN_KEY]: newGoogleToken,
                    [GOOGLE_TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
                });
                googleToken = newGoogleToken;
            }

            if (!firebaseValid) {
                if (!firebaseRefreshToken) throw new Error('No Firebase refresh token stored');
                const { idToken, refreshToken: newRefreshToken, expiresIn } =
                    await refreshFirebaseToken(firebaseRefreshToken, firebaseApiKey);
                chrome.storage.local.set({
                    [FIREBASE_TOKEN_KEY]: idToken,
                    [FIREBASE_TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
                    [FIREBASE_REFRESH_TOKEN_KEY]: newRefreshToken,
                });
                firebaseToken = idToken;
            }
        } catch (refreshErr) {
            console.error('InstaCal: silent token refresh failed:', refreshErr);
            openPopupWithText(text);
            return;
        }
    }

    try {
        const parseResponse = await fetch(`${BACKEND_URL}/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${firebaseToken}`,
            },
            body: JSON.stringify({
                text,
                now: new Date().toISOString(),
                defaults: {
                    smartDefaults: prefs.smartDefaults,
                    defaultDuration: prefs.defaultDuration,
                    defaultStartTime: prefs.defaultStartTime,
                    defaultLocation: prefs.defaultLocation,
                },
            }),
        });

        if (!parseResponse.ok) {
            throw new Error(`Parse failed: ${parseResponse.status}`);
        }

        const event = await parseResponse.json();

        if (prefs.autoReview) {
            // Auto-Add enabled: silently create the calendar event
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const calBody = {
                summary: event.title,
                start: { dateTime: event.start, timeZone },
                end: { dateTime: event.end, timeZone },
                ...(event.location ? { location: event.location } : {}),
                ...(event.description ? { description: event.description } : {}),
            };

            const calResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${googleToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(calBody),
                }
            );

            if (!calResponse.ok) {
                throw new Error(`Calendar API error: ${calResponse.status}`);
            }
            // Event added silently — no window opened
        } else {
            // Auto-Add disabled: open Google Calendar event creation page with parsed data
            chrome.tabs.create({ url: buildCalendarUrl(event) });
        }
    } catch (err) {
        console.error('InstaCal context menu error:', err);
        openPopupWithText(text);
    }
});
