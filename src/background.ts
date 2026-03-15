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

function getGoogleToken(): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (result) => {
            if (chrome.runtime.lastError || !result?.token) resolve(null);
            else resolve(result.token);
        });
    });
}

async function getTokens() {
    const calendarToken = await getGoogleToken();
    if (!calendarToken) {
        console.error('[InstaCal] Google Calendar token unavailable');
        return null;
    }

    const result = await getFromStorage([
        'instacal_firebase_id_token',
        'instacal_firebase_id_token_expiry',
        'instacal_firebase_refresh_token',
        'instacal_firebase_api_key',
        'instacal_backend_url',
    ]);

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

type GCalAttendee = { email: string; displayName?: string; self?: boolean; responseStatus?: string };

async function handleEditEventWithAI(message: {
    text: string;
    eventId: string;
    calendarId: string;
    people?: Array<{ firstName: string; lastName: string; email: string }>;
}) {
    console.log('[InstaCal] handleEditEventWithAI called', { eventId: message.eventId, calendarId: message.calendarId, text: message.text });

    const tokens = await getTokens();
    if (!tokens) throw new Error('Not signed in to InstaCal');

    const calId = message.calendarId || 'primary';

    // Step 1: Fetch existing event (with fallbacks)
    async function fetchEvent(cid: string, eid: string): Promise<Record<string, any> | null> {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cid)}/events/${encodeURIComponent(eid)}`;
        console.log('[InstaCal] fetchEvent GET', url);
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens!.calendarToken}` } });
        console.log('[InstaCal] fetchEvent response', resp.status);
        if (resp.ok) return resp.json();
        if (resp.status !== 404) { const body = await resp.text(); throw new Error(`Failed to fetch event: ${resp.status}: ${body}`); }
        return null;
    }

    async function searchByICalUID(cid: string, uid: string): Promise<Record<string, any> | null> {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cid)}/events?iCalUID=${encodeURIComponent(uid)}&maxResults=1`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens!.calendarToken}` } });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.items?.[0] ?? null;
    }

    let gcalEvent: Record<string, any> | null = await fetchEvent(calId, message.eventId);
    if (!gcalEvent && calId !== 'primary') { gcalEvent = await fetchEvent('primary', message.eventId); if (gcalEvent) message.calendarId = 'primary'; }
    if (!gcalEvent) { gcalEvent = await searchByICalUID(calId, message.eventId); if (gcalEvent) message.eventId = gcalEvent.id; }
    if (!gcalEvent && calId !== 'primary') { gcalEvent = await searchByICalUID('primary', message.eventId); if (gcalEvent) { message.eventId = gcalEvent.id; message.calendarId = 'primary'; } }
    if (!gcalEvent) throw new Error('Event not found. Try opening the event in Google Calendar and clicking Edit with AI again.');

    const existingGCalAttendees: GCalAttendee[] = gcalEvent.attendees ?? [];
    const existingEvent = {
        title: gcalEvent.summary ?? '',
        start: gcalEvent.start?.dateTime ?? gcalEvent.start?.date ?? '',
        end: gcalEvent.end?.dateTime ?? gcalEvent.end?.date ?? '',
        location: gcalEvent.location ?? null,
        description: gcalEvent.description ?? null,
    };

    // Step 2: Call AI edit endpoint
    const prefsResult = await getFromStorage([PREF_KEY]);
    const userName = ((prefsResult[PREF_KEY] as Record<string, unknown> | undefined)?.userName as string | undefined) || '';

    const editUrl = `${tokens.backendUrl}/edit-event`;
    const editBody: Record<string, unknown> = {
        instruction: message.text,
        existingEvent,
        now: new Date().toISOString(),
        people: message.people ?? [],
        ...(userName ? { userName } : {}),
    };
    console.log('[InstaCal] POST', editUrl, 'instruction:', message.text, 'people count:', (message.people ?? []).length);

    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 25000);
    let editResp: Response;
    try {
        editResp = await fetch(editUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.firebaseToken}` },
            body: JSON.stringify(editBody),
            signal: aiController.signal,
        });
    } catch (err) {
        clearTimeout(aiTimeoutId);
        if (err instanceof Error && err.name === 'AbortError') throw new Error('AI request timed out. Please try again.');
        throw err;
    }
    clearTimeout(aiTimeoutId);
    if (!editResp.ok) {
        const rawBody = await editResp.text();
        console.log('[InstaCal] edit-event error body:', rawBody);
        let errMsg = `Server error: ${editResp.status}`;
        try { const b = JSON.parse(rawBody); if (b.error) errMsg = b.error; } catch {}
        throw new Error(errMsg);
    }
    const event = await editResp.json();
    console.log('[InstaCal] edit-event result:', JSON.stringify(event));

    // Return AI result + existing attendees — content script handles unknown attendee resolution, then calls patchCalendarEvent
    return {
        success: true,
        event,
        eventId: message.eventId,
        calendarId: message.calendarId || calId,
        resolvedAttendees: event.attendees ?? [],
        unknownAttendees: event.unknownAttendees ?? [],
        existingGCalAttendees,
    };
}

async function handlePatchCalendarEvent(message: {
    eventId: string;
    calendarId: string;
    event: Record<string, any>;
    newAttendees: Array<{ email: string; name: string }>;
    existingGCalAttendees: GCalAttendee[];
}) {
    const tokens = await getTokens();
    if (!tokens) throw new Error('Not signed in to InstaCal');

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const patchBody: Record<string, any> = {
        summary: message.event.title,
        start: { dateTime: message.event.start, timeZone },
        end: { dateTime: message.event.end, timeZone },
        ...(message.event.location != null && { location: message.event.location }),
        ...(message.event.description != null && { description: message.event.description }),
    };

    if (message.newAttendees.length > 0) {
        const existing = message.existingGCalAttendees.map((a) => ({ email: a.email }));
        const adding = message.newAttendees.map((a) => ({ email: a.email }));
        // Merge, de-duping by email
        const seen = new Set(existing.map((a) => a.email.toLowerCase()));
        const merged = [...existing];
        for (const a of adding) {
            if (!seen.has(a.email.toLowerCase())) { merged.push(a); seen.add(a.email.toLowerCase()); }
        }
        patchBody.attendees = merged;
    }

    const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(message.calendarId)}/events/${encodeURIComponent(message.eventId)}`;
    console.log('[InstaCal] PATCH', patchUrl, JSON.stringify(patchBody));
    const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${tokens.calendarToken}`, 'Content-Type': 'application/json' },
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
        return true;
    }
    if (message.action === 'patchCalendarEvent') {
        handlePatchCalendarEvent(message).then(sendResponse).catch((err: Error) => {
            sendResponse({ success: false, error: err.message || 'Unknown error' });
        });
        return true;
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
