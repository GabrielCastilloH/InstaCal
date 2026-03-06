import { COLORS } from './styles/colors';
import { PREF_KEY, DEFAULT_DURATION, DEFAULT_START_TIME, DEFAULT_LOCATION, TOKEN_EXPIRY_BUFFER_MS } from './constants';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DEFAULT_PREFS = {
    autoReview: true,
    tasksAsAllDayEvents: true,
    smartDefaults: true,
    defaultDuration: DEFAULT_DURATION,
    defaultStartTime: DEFAULT_START_TIME,
    defaultLocation: DEFAULT_LOCATION,
};

// --- Context menu setup ---

function injectContentScriptIntoGCalTabs() {
    chrome.tabs.query({ url: 'https://calendar.google.com/*' }, (tabs) => {
        for (const tab of tabs) {
            if (tab.id == null) continue;
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js'],
            }).catch((err) => {
                console.warn('[InstaCal] scripting inject failed for tab', tab.id, err);
            });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    injectContentScriptIntoGCalTabs();
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'add-to-instacal',
            title: 'Add to Calendar with InstaCal',
            contexts: ['selection'],
        });
    });
});

chrome.runtime.onStartup.addListener(() => {
    injectContentScriptIntoGCalTabs();
});

// --- Storage helper ---

function getFromStorage(keys: string | string[]): Promise<Record<string, any>> {
    return new Promise((resolve) => chrome.storage.local.get(keys, (items) => resolve(items)));
}

// --- Auth helpers ---

async function getTokens() {
    const result = await getFromStorage([
        'instacal_google_calendar_token',
        'instacal_google_calendar_token_expiry',
        'instacal_firebase_id_token',
        'instacal_firebase_id_token_expiry',
        'instacal_firebase_refresh_token',
        'instacal_firebase_api_key',
        'instacal_backend_url',
    ]);

    const calendarToken = result.instacal_google_calendar_token;
    const calendarExpiry = result.instacal_google_calendar_token_expiry;
    if (!calendarToken || (calendarExpiry && Date.now() >= calendarExpiry - TOKEN_EXPIRY_BUFFER_MS)) {
        console.error('[InstaCal] Google Calendar token missing or expired');
        return null;
    }

    let firebaseToken = result.instacal_firebase_id_token;
    const firebaseExpiry = result.instacal_firebase_id_token_expiry;
    const refreshToken = result.instacal_firebase_refresh_token;
    const apiKey = result.instacal_firebase_api_key;

    const firebaseExpired = !firebaseToken || (firebaseExpiry && Date.now() >= firebaseExpiry - TOKEN_EXPIRY_BUFFER_MS);

    if (firebaseExpired) {
        if (!refreshToken || !apiKey) {
            console.error('[InstaCal] Firebase token expired and no refresh token available');
            return null;
        }
        try {
            const resp = await fetch(
                `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
                }
            );
            if (!resp.ok) {
                const err = await resp.text();
                console.error('[InstaCal] Token refresh failed:', err);
                return null;
            }
            const data = await resp.json();
            firebaseToken = data.id_token;
            const expiresIn = parseInt(data.expires_in || '3600', 10);
            chrome.storage.local.set({
                instacal_firebase_id_token: firebaseToken,
                instacal_firebase_id_token_expiry: Date.now() + expiresIn * 1000,
                instacal_firebase_refresh_token: data.refresh_token,
            });
        } catch (err) {
            console.error('[InstaCal] Token refresh error:', err);
            return null;
        }
    }

    return {
        firebaseToken,
        calendarToken,
        backendUrl: result.instacal_backend_url || 'https://us-central1-instacal-app.cloudfunctions.net/api',
    };
}

// --- Event helpers ---

async function parseEvent(text: string, idToken: string, prefs: Record<string, any>, backendUrl: string) {
    const response = await fetch(`${backendUrl}/parse`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            text,
            now: new Date().toISOString(),
            defaults: {
                smartDefaults: prefs.smartDefaults,
                tasksAsAllDayEvents: prefs.tasksAsAllDayEvents,
                defaultDuration: prefs.defaultDuration,
                defaultStartTime: prefs.defaultStartTime,
                defaultLocation: prefs.defaultLocation,
            },
        }),
    });
    if (!response.ok) {
        let message = `Server error: ${response.status}`;
        try {
            const body = await response.json();
            if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
    }
    return response.json();
}

function isAllDayEvent(event: Record<string, any>): boolean {
    return (
        event.start.slice(0, 10) === event.end.slice(0, 10) &&
        event.start.slice(11, 19) === '00:00:00' &&
        event.end.slice(11, 19) === '23:59:59'
    );
}

async function createCalendarEvent(token: string, event: Record<string, any>) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const allDay = isAllDayEvent(event);
    const body = allDay
        ? {
            summary: event.title,
            start: { date: event.start.slice(0, 10) },
            end: {
                date: (() => {
                    const d = new Date(event.end.slice(0, 10));
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                })(),
            },
            ...(event.location != null && { location: event.location }),
            ...(event.description != null && { description: event.description }),
            ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
          }
        : {
            summary: event.title,
            start: { dateTime: event.start, timeZone },
            end: { dateTime: event.end, timeZone },
            ...(event.location != null && { location: event.location }),
            ...(event.description != null && { description: event.description }),
            ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
          };

    const response = await fetch(CALENDAR_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Calendar API error ${response.status}: ${text}`);
    }
    return response.json();
}

function buildGoogleCalendarUrl(event: Record<string, any>): string {
    const allDay = isAllDayEvent(event);
    let dates;
    if (allDay) {
        const startStr = event.start.slice(0, 10).replace(/-/g, '');
        const d = new Date(event.start.slice(0, 10));
        d.setDate(d.getDate() + 1);
        dates = `${startStr}/${d.toISOString().slice(0, 10).replace(/-/g, '')}`;
    } else {
        const fmt = (iso: string) => iso.slice(0, 19).replace(/-/g, '').replace(/:/g, '');
        dates = `${fmt(event.start)}/${fmt(event.end)}`;
    }
    const url = new URL('https://calendar.google.com/calendar/r/eventedit');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', dates);
    if (event.location) url.searchParams.set('location', event.location);
    if (event.description) url.searchParams.set('details', event.description);
    if (event.recurrence) url.searchParams.set('recur', `RRULE:${event.recurrence}`);
    return url.toString();
}

// --- Badge feedback ---

function setBadge(text: string, color: string): void {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
}

// --- AI edit message handler ---

async function handleEditEventWithAI(message: { text: string; eventId: string; calendarId: string }) {
    const tokens = await getTokens();
    if (!tokens) throw new Error('Not signed in to InstaCal');

    const calId = message.calendarId || 'primary';

    // Step 1: Fetch existing event
    const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(message.eventId)}`;
    const getResp = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${tokens.calendarToken}` },
    });
    if (!getResp.ok) {
        const body = await getResp.text();
        throw new Error(`Failed to fetch event: ${getResp.status}: ${body}`);
    }
    const gcalEvent = await getResp.json();

    const existingEvent = {
        title: gcalEvent.summary ?? '',
        start: gcalEvent.start?.dateTime ?? gcalEvent.start?.date ?? '',
        end: gcalEvent.end?.dateTime ?? gcalEvent.end?.date ?? '',
        location: gcalEvent.location ?? null,
        description: gcalEvent.description ?? null,
    };

    // Step 2: Call AI edit endpoint
    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 25000);
    let editResp: Response;
    try {
        editResp = await fetch(`${tokens.backendUrl}/edit-event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokens.firebaseToken}`,
            },
            body: JSON.stringify({
                instruction: message.text,
                existingEvent,
                now: new Date().toISOString(),
            }),
            signal: aiController.signal,
        });
    } catch (err) {
        clearTimeout(aiTimeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('AI request timed out. Please try again.');
        }
        throw err;
    }
    clearTimeout(aiTimeoutId);
    if (!editResp.ok) {
        let errMsg = `Server error: ${editResp.status}`;
        try { const b = await editResp.json(); if (b.error) errMsg = b.error; } catch {}
        throw new Error(errMsg);
    }
    const event = await editResp.json();

    // Step 3: PATCH the calendar event
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const patchBody = {
        summary: event.title,
        start: { dateTime: event.start, timeZone },
        end: { dateTime: event.end, timeZone },
        ...(event.location != null && { location: event.location }),
        ...(event.description != null && { description: event.description }),
    };
    const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(message.eventId)}`;
    const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${tokens.calendarToken}`,
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'editEventWithAI') {
        handleEditEventWithAI(message).then(sendResponse).catch((err: Error) => {
            sendResponse({ success: false, error: err.message || 'Unknown error' });
        });
        return true; // keep message channel open for async response
    }
});

// --- Main handler ---

chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'add-to-instacal' || !info.selectionText) return;
    const text = info.selectionText.trim();
    if (!text) return;

    const tokens = await getTokens();
    if (!tokens) {
        setBadge('!', COLORS.failure);
        chrome.storage.local.set({ instacal_badge_error: 'Not signed in. Open InstaCal to sign in.' });
        return;
    }

    const prefsResult = await getFromStorage([PREF_KEY]);
    const prefs = { ...DEFAULT_PREFS, ...prefsResult[PREF_KEY] };

    try {
        const event = await parseEvent(text, tokens.firebaseToken, prefs, tokens.backendUrl);

        if (prefs.autoReview) {
            await createCalendarEvent(tokens.calendarToken, event);
            setBadge('+', COLORS.success);
        } else {
            chrome.tabs.create({ url: buildGoogleCalendarUrl(event) });
        }
    } catch (err) {
        console.error('[InstaCal] Error:', err);
        setBadge('!', COLORS.failure);
        chrome.storage.local.set({ instacal_badge_error: err instanceof Error ? err.message : String(err) });
    }
});
