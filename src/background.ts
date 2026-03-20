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

async function getGoogleToken(): Promise<string | null> {
    try {
        const result = await chrome.identity.getAuthToken({ interactive: false });
        return result?.token ?? null;
    } catch (err) {
        console.warn('[InstaCal] getGoogleToken failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

function evictGoogleToken(token: string): Promise<void> {
    return chrome.identity.removeCachedAuthToken({ token });
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

    const doFetch = (t: string) => fetch(CALENDAR_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    let response = await doFetch(token);

    // Stale cached token — evict it and retry once with a fresh token.
    if (response.status === 401) {
        await evictGoogleToken(token);
        const freshToken = await getGoogleToken();
        if (!freshToken) throw new Error('Not authenticated with Google Calendar');
        response = await doFetch(freshToken);
    }

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
    const doFetch = (t: string) => fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
    });
    let patchResp = await doFetch(tokens.calendarToken);
    if (patchResp.status === 401) {
        await evictGoogleToken(tokens.calendarToken);
        const freshToken = await getGoogleToken();
        if (!freshToken) throw new Error('Not authenticated with Google Calendar');
        patchResp = await doFetch(freshToken);
    }
    if (!patchResp.ok) {
        const body = await patchResp.text();
        throw new Error(`Calendar API error ${patchResp.status}: ${body}`);
    }
    return { success: true };
}

async function handleGetAvailability(message: {
    timeMin: string;
    timeMax: string;
    dayStartTime: string;
    dayEndTime: string;
}): Promise<{ success: true; text: string } | { success: false; error: string }> {
    console.log('[InstaCal] handleGetAvailability', message);
    const calendarToken = await getGoogleToken();
    console.log('[InstaCal] calendarToken for availability:', calendarToken ? 'obtained' : 'null');
    if (!calendarToken) return { success: false, error: 'Not authenticated with Google Calendar' };

    const FREEBUSY_API = 'https://www.googleapis.com/calendar/v3/freeBusy';
    const MIN_SLOT_MINUTES = 20;
    const EVENT_BUFFER_MS = 10 * 60_000;

    console.log('[InstaCal] calling freeBusy API', { timeMin: message.timeMin, timeMax: message.timeMax });
    const freeBusyBody = JSON.stringify({ timeMin: message.timeMin, timeMax: message.timeMax, items: [{ id: 'primary' }] });
    let activeToken = calendarToken;
    const doFreeBusy = (t: string) => fetch(FREEBUSY_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: freeBusyBody,
    });
    let response = await doFreeBusy(activeToken);
    if (response.status === 401) {
        await evictGoogleToken(activeToken);
        const freshToken = await getGoogleToken();
        if (!freshToken) return { success: false, error: 'Not authenticated with Google Calendar' };
        activeToken = freshToken;
        response = await doFreeBusy(activeToken);
    }
    console.log('[InstaCal] freeBusy status:', response.status);
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error('[InstaCal] freeBusy error:', response.status, body);
        return { success: false, error: `Google Calendar API error ${response.status}: ${body}` };
    }

    const data = await response.json();
    console.log('[InstaCal] freeBusy data:', JSON.stringify(data));

    interface Slot { start: Date; end: Date }
    const busy: Slot[] = (data.calendars?.primary?.busy ?? []).map(
        (b: { start: string; end: string }) => ({
            start: new Date(new Date(b.start).getTime() - EVENT_BUFFER_MS),
            end:   new Date(new Date(b.end).getTime()   + EVENT_BUFFER_MS),
        })
    );
    console.log('[InstaCal] busy slots:', busy.length);

    function parseHHMM(t: string) { const [h, m] = t.split(':').map(Number); return { h: h ?? 8, m: m ?? 0 }; }
    function roundUpTo15(d: Date) { const ms = 15 * 60 * 1000; return new Date(Math.ceil(d.getTime() / ms) * ms); }
    function formatTime(d: Date) { const h = d.getHours(); const m = d.getMinutes(); return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`; }
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    function ordinal(n: number) { const v = n % 100; return `${n}${(v>=11&&v<=13)?'th':['th','st','nd','rd'][n%10]??'th'}`; }
    function formatDate(d: Date) { return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${ordinal(d.getDate())}`; }
    function getTzAbbr() {
        try { return new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortGeneric' as Intl.DateTimeFormatOptions['timeZoneName'] }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''; }
        catch { return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''; }
    }
    function freeSlots(busy: Slot[], windowStart: Date, windowEnd: Date): Slot[] {
        const sorted = busy.filter(b => b.end > windowStart && b.start < windowEnd).sort((a,b) => a.start.getTime()-b.start.getTime());
        const slots: Slot[] = []; let cursor = windowStart;
        for (const b of sorted) {
            if (b.start > cursor) { const end = b.start < windowEnd ? b.start : windowEnd; if (end.getTime()-cursor.getTime() >= MIN_SLOT_MINUTES*60_000) slots.push({start:cursor,end}); }
            if (b.end > cursor) cursor = b.end;
        }
        if (cursor < windowEnd && windowEnd.getTime()-cursor.getTime() >= MIN_SLOT_MINUTES*60_000) slots.push({start:cursor,end:windowEnd});
        return slots;
    }

    const now = new Date();
    const timeMin = new Date(message.timeMin);
    const timeMax = new Date(message.timeMax);
    const numDays = Math.round((timeMax.getTime() - timeMin.getTime()) / (24*60*60*1000));
    const tzAbbr  = getTzAbbr();
    const lines: string[] = [];

    console.log('[InstaCal] processing', numDays, 'days');
    for (let i = 0; i < numDays; i++) {
        const day = new Date(timeMin);
        day.setDate(day.getDate() + i);
        const { h: sh, m: sm } = parseHHMM(message.dayStartTime);
        const dayStart = new Date(day); dayStart.setHours(sh, sm, 0, 0);
        const { h: eh, m: em } = parseHHMM(message.dayEndTime);
        const dayEnd = new Date(day); dayEnd.setHours(eh, em, 0, 0);
        const windowStart = i === 0 && now > dayStart ? roundUpTo15(now) : dayStart;
        if (windowStart >= dayEnd) { console.log('[InstaCal] day', i, 'skipped (window past end)'); continue; }
        const slots = freeSlots(busy, windowStart, dayEnd);
        console.log('[InstaCal] day', i, formatDate(day), slots.length, 'slots');
        if (slots.length === 0) continue;
        lines.push(`• ${formatDate(day)}: ${slots.map(s => `${formatTime(s.start)} – ${formatTime(s.end)}`).join(' and ')} ${tzAbbr}`);
    }

    const text = lines.length === 0 ? 'No availability found for the selected dates.' : lines.join('\n');
    console.log('[InstaCal] availability result:', JSON.stringify(text));
    return { success: true, text };
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
    if (message.action === 'getAvailability') {
        handleGetAvailability(message).then(sendResponse).catch((err: Error) => {
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
