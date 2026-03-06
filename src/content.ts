const LOG = (...args: unknown[]) => console.log('[InstaCal]', ...args);

// --- People storage (inlined to keep content.js a single self-contained file) ---

const PEOPLE_KEY = 'instacal_people';
const MAX_PEOPLE = 10;

interface Person { id: string; firstName: string; lastName: string; email: string; lastUsed: number; }

function loadPeople(): Promise<Person[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PEOPLE_KEY], (r) => resolve((r[PEOPLE_KEY] as Person[] | undefined) ?? []));
  });
}

function savePeople(people: Person[]): Promise<void> {
  const sorted = [...people].sort((a, b) => b.lastUsed - a.lastUsed);
  return new Promise((resolve) => chrome.storage.local.set({ [PEOPLE_KEY]: sorted }, resolve));
}

function upsertPerson(people: Person[], name: string, email: string): Person[] {
  const idx = people.findIndex((p) => p.email.toLowerCase() === email.toLowerCase());
  if (idx !== -1) return people.map((p, i) => (i === idx ? { ...p, lastUsed: Date.now() } : p));
  const [firstName, ...rest] = name.trim().split(' ');
  const newPerson: Person = { id: crypto.randomUUID(), firstName: firstName ?? name, lastName: rest.join(' '), email, lastUsed: Date.now() };
  const updated = [...people];
  if (updated.length >= MAX_PEOPLE) {
    const lru = updated.reduce((min, p, i) => (p.lastUsed < updated[min].lastUsed ? i : min), 0);
    updated.splice(lru, 1);
  }
  updated.push(newPerson);
  return updated;
}

LOG('content script loaded on', location.href);

const EDIT_BTN_ID    = 'instacal-edit-ai-btn';
const EDIT_PANEL_ID  = 'instacal-edit-ai-panel';
const EDIT_BACKDROP_ID = 'instacal-backdrop';

// --- URL parsing ---

function getEventFromEditUrl(): { eventId: string; calendarId: string } | null {
  const match = location.pathname.match(/\/r\/eventedit\/([^?#/]+)/);
  if (!match) return null;
  const raw = match[1];
  try {
    // Google Calendar uses base64url encoding — convert to standard base64 before decoding
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const decoded = atob(pad ? b64 + '='.repeat(4 - pad) : b64);
    const sp = decoded.indexOf(' ');
    const result = sp > 0
      ? { eventId: decoded.slice(0, sp).trim(), calendarId: decoded.slice(sp + 1).trim() }
      : { eventId: decoded.trim(), calendarId: 'primary' };
    LOG('getEventFromEditUrl decoded:', result);
    return result;
  } catch (e) {
    LOG('getEventFromEditUrl failed to decode:', e);
    return null;
  }
}

// --- Cleanup ---

function removeInjected() {
  document.getElementById(EDIT_BTN_ID)?.remove();
  document.getElementById(EDIT_PANEL_ID)?.remove();
  document.getElementById(EDIT_BACKDROP_ID)?.remove();
}

// --- Panel ---

function closePanel() {
  document.getElementById(EDIT_PANEL_ID)?.remove();
  document.getElementById(EDIT_BACKDROP_ID)?.remove();
}

function sendMessage(msg: object): Promise<Record<string, any>> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

/** Replaces the panel body with the "Invite name?" form and resolves with the result. */
function promptForUnknownPerson(
  body: HTMLElement,
  name: string,
  people: Person[]
): Promise<{ email: string; save: boolean } | null> {
  return new Promise((resolve) => {
    const isFull = people.length >= MAX_PEOPLE;

    body.innerHTML =
      '<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#2b4257;">Invite ' + name + '?</p>' +
      '<input id="instacal-invite-email" type="email" placeholder="Email address" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;' +
        'border:1.5px solid #88a9c3;border-radius:8px;font-size:14px;' +
        'font-family:inherit;color:#2b4257;background:#e3ebf2;' +
        'outline:none;line-height:1.5;display:block;transition:border-color 0.15s;" />' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;' +
        'font-size:13px;color:#2b4257;">' +
        '<input type="checkbox" id="instacal-invite-save" ' + (!isFull ? 'checked' : '') + ' ' +
          'style="width:14px;height:14px;cursor:pointer;" />' +
        '<span>Add ' + name + ' to People</span>' +
      '</label>' +
      (isFull
        ? '<p style="margin:6px 0 0;font-size:11px;color:#88a9c3;">Least recently used contact will be removed</p>'
        : '') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">' +
        '<button id="instacal-invite-ignore" style="padding:8px 18px;background:none;' +
          'border:1.5px solid #88a9c3;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#6da7cc;cursor:pointer;font-family:inherit;">Ignore</button>' +
        '<button id="instacal-invite-add" style="padding:8px 18px;background:#6da7cc;' +
          'border:none;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#fff;cursor:pointer;font-family:inherit;opacity:0.5;" disabled>Add</button>' +
      '</div>';

    const emailInput  = body.querySelector<HTMLInputElement>('#instacal-invite-email')!;
    const saveCheck   = body.querySelector<HTMLInputElement>('#instacal-invite-save')!;
    const ignoreBtn   = body.querySelector<HTMLButtonElement>('#instacal-invite-ignore')!;
    const addBtn      = body.querySelector<HTMLButtonElement>('#instacal-invite-add')!;

    emailInput.focus();

    emailInput.addEventListener('input', () => {
      const valid = emailInput.value.trim().includes('@');
      addBtn.disabled = !valid;
      addBtn.style.opacity = valid ? '1' : '0.5';
    });
    emailInput.addEventListener('focus',  () => { emailInput.style.borderColor = '#6da7cc'; });
    emailInput.addEventListener('blur',   () => { emailInput.style.borderColor = '#88a9c3'; });
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !addBtn.disabled) resolve({ email: emailInput.value.trim(), save: saveCheck.checked });
    });

    ignoreBtn.addEventListener('click', () => resolve(null));
    addBtn.addEventListener('click', () => resolve({ email: emailInput.value.trim(), save: saveCheck.checked }));
  });
}

function injectPanel(eventId: string, calendarId: string) {
  if (document.getElementById(EDIT_PANEL_ID)) { closePanel(); return; }

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = EDIT_BACKDROP_ID;
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;' +
    'background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);';
  backdrop.addEventListener('click', closePanel);
  document.body.appendChild(backdrop);

  // Modal card
  const panel = document.createElement('div');
  panel.id = EDIT_PANEL_ID;
  panel.style.cssText =
    'position:fixed;z-index:2147483647;' +
    'top:50%;left:50%;transform:translate(-50%,-50%);' +
    'width:380px;max-width:calc(100vw - 32px);' +
    'background:#fcfdfe;border-radius:12px;' +
    'box-shadow:0 8px 32px rgba(43,66,87,0.18),0 2px 8px rgba(43,66,87,0.10);' +
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'box-sizing:border-box;overflow:hidden;';

  panel.innerHTML =
    '<div style="background:#6da7cc;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#fff">' +
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>' +
        '<span style="font-size:14px;font-weight:600;color:#fff;">Edit with AI</span>' +
      '</div>' +
      '<button id="instacal-panel-x" style="background:none;border:none;border-radius:6px;' +
        'width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;color:rgba(255,255,255,0.85);font-size:15px;line-height:1;padding:0;">&#x2715;</button>' +
    '</div>' +
    '<div id="instacal-panel-body" style="padding:16px 20px 20px;">' +
      '<textarea id="instacal-panel-input" rows="3" placeholder="Describe what to change\u2026" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;' +
        'border:1.5px solid #88a9c3;border-radius:8px;font-size:14px;' +
        'font-family:inherit;color:#2b4257;background:#e3ebf2;' +
        'resize:none;outline:none;line-height:1.5;display:block;transition:border-color 0.15s;"></textarea>' +
      '<div id="instacal-panel-status" style="display:none;font-size:12px;font-weight:600;margin-top:8px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">' +
        '<button id="instacal-panel-cancel" style="padding:8px 18px;background:none;' +
          'border:1.5px solid #88a9c3;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#6da7cc;cursor:pointer;font-family:inherit;transition:background 0.15s;">Cancel</button>' +
        '<button id="instacal-panel-submit" style="padding:8px 18px;background:#6da7cc;' +
          'border:none;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#fff;cursor:pointer;font-family:inherit;transition:background-color 0.15s;">Update Event</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(panel);

  const body      = panel.querySelector<HTMLElement>('#instacal-panel-body')!;
  const input     = panel.querySelector<HTMLTextAreaElement>('#instacal-panel-input')!;
  const statusEl  = panel.querySelector<HTMLElement>('#instacal-panel-status')!;
  const submitBtn = panel.querySelector<HTMLButtonElement>('#instacal-panel-submit')!;
  const cancelBtn = panel.querySelector<HTMLButtonElement>('#instacal-panel-cancel')!;
  const xBtn      = panel.querySelector<HTMLButtonElement>('#instacal-panel-x')!;

  input.focus();
  input.addEventListener('focus', () => { input.style.borderColor = '#6da7cc'; });
  input.addEventListener('blur',  () => { input.style.borderColor = '#88a9c3'; });

  xBtn.addEventListener('click', closePanel);
  cancelBtn.addEventListener('click', closePanel);
  cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#e3ebf2'; });
  cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'none'; });
  submitBtn.addEventListener('mouseenter', () => { submitBtn.style.backgroundColor = '#345e7d'; });
  submitBtn.addEventListener('mouseleave', () => { submitBtn.style.backgroundColor = '#6da7cc'; });

  function setStatus(msg: string, isError?: boolean) {
    statusEl.style.display = msg ? 'block' : 'none';
    statusEl.style.color   = isError ? '#c43b49' : '#4c9161';
    statusEl.textContent   = msg;
  }

  function showLoadingInBody(msg: string) {
    body.innerHTML =
      '<p style="margin:0;font-size:13px;color:#6da7cc;font-weight:600;text-align:center;padding:12px 0;">' +
      msg + '</p>';
  }

  submitBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }

    void (async () => {
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      xBtn.disabled      = true;
      submitBtn.textContent  = 'Updating\u2026';
      submitBtn.style.opacity = '0.7';
      setStatus('');

      try {
        // Load people from storage and convert to contacts for the AI
        const people = await loadPeople();
        const peopleContacts = people.map((p) => ({
          firstName: p.firstName, lastName: p.lastName, email: p.email,
        }));

        // Step 1: Get AI edits (background also fetches existing event)
        const aiResult = await sendMessage({ action: 'editEventWithAI', text, eventId, calendarId, people: peopleContacts });

        if (chrome.runtime.lastError || !aiResult?.success) {
          setStatus(aiResult?.error || 'Something went wrong.', true);
          submitBtn.disabled = false; cancelBtn.disabled = false; xBtn.disabled = false;
          submitBtn.textContent = 'Update Event'; submitBtn.style.opacity = '1';
          return;
        }

        const {
          event,
          eventId: resolvedEventId,
          calendarId: resolvedCalendarId,
          resolvedAttendees = [],
          unknownAttendees = [],
          existingGCalAttendees = [],
        } = aiResult;

        // Step 2: Resolve unknown attendees one by one (same UX as the main popup)
        let currentPeople = people;
        const finalNewAttendees: Array<{ email: string; name: string }> = [...resolvedAttendees];

        for (const unknownName of unknownAttendees as string[]) {
          showLoadingInBody('');
          const resolution = await promptForUnknownPerson(body, unknownName, currentPeople);
          if (resolution) {
            finalNewAttendees.push({ email: resolution.email, name: unknownName });
            if (resolution.save) {
              currentPeople = upsertPerson(currentPeople, unknownName, resolution.email);
              await savePeople(currentPeople);
            }
          }
          // Show brief "Updating…" between steps
          showLoadingInBody('Updating\u2026');
        }

        // Step 3: PATCH the calendar event
        showLoadingInBody('Updating\u2026');
        const patchResult = await sendMessage({
          action: 'patchCalendarEvent',
          eventId: resolvedEventId,
          calendarId: resolvedCalendarId,
          event,
          newAttendees: finalNewAttendees,
          existingGCalAttendees,
        });

        if (chrome.runtime.lastError || !patchResult?.success) {
          // Restore the edit form on patch failure
          panel.querySelector<HTMLElement>('#instacal-panel-body')!.innerHTML =
            body.innerHTML; // body was replaced; restore original form fields aren't available — show error in new structure
          body.innerHTML =
            '<p style="margin:0 0 8px;font-size:13px;color:#c43b49;font-weight:600;">' +
            (patchResult?.error || 'Failed to update event. Try again.') + '</p>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
              '<button id="instacal-close-err" style="padding:8px 18px;background:#6da7cc;' +
                'border:none;border-radius:8px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;">Close</button>' +
            '</div>';
          body.querySelector('#instacal-close-err')?.addEventListener('click', closePanel);
          return;
        }

        body.innerHTML =
          '<p style="margin:0;font-size:13px;color:#4c9161;font-weight:600;text-align:center;padding:8px 0;">' +
          '\u2713 Event updated! Reloading\u2026</p>';
        setTimeout(() => location.reload(), 1500);

      } catch (err) {
        LOG('panel submit error:', err);
        setStatus('Extension error. Try again.', true);
        submitBtn.disabled = false; cancelBtn.disabled = false; xBtn.disabled = false;
        submitBtn.textContent = 'Update Event'; submitBtn.style.opacity = '1';
      }
    })();
  });

  // Close on Escape
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { closePanel(); document.removeEventListener('keydown', onKey, true); }
  }
  document.addEventListener('keydown', onKey, true);
}

// --- Button injection ---

function injectEditButton(eventId: string, calendarId: string) {
  LOG('injectEditButton called', { eventId, calendarId });
  if (document.getElementById(EDIT_BTN_ID)) { LOG('button already exists, skipping'); return; }

  const saveBtn = document.querySelector<HTMLElement>('#xSaveBu');
  LOG('saveBtn found:', !!saveBtn);
  if (!saveBtn) return;

  LOG('injecting Edit with AI button next to Save');

  const btn = document.createElement('button');
  btn.id   = EDIT_BTN_ID;
  btn.type = 'button';
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ' +
    'fill="currentColor" style="flex-shrink:0;">' +
    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
    '</svg><span>Edit with AI</span>';
  btn.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;' +
    'margin-left:8px;padding:0 20px;height:36px;white-space:nowrap;' +
    'background:#6da7cc;color:#fff;' +
    'border:none;border-radius:8px;' +
    'font-size:13px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'font-weight:600;cursor:pointer;vertical-align:middle;box-sizing:border-box;' +
    'transition:background-color 0.15s;';

  btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#345e7d'; });
  btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#6da7cc'; });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    injectPanel(eventId, calendarId);
  });

  saveBtn.insertAdjacentElement('afterend', btn);
  LOG('Edit with AI button injected');
}

// --- Auth check ---

function checkSignedIn(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['instacal_google_calendar_token', 'instacal_google_calendar_token_expiry'],
      (result) => {
        const token = result['instacal_google_calendar_token'];
        const expiry = result['instacal_google_calendar_token_expiry'] as number | undefined;
        resolve(typeof token === 'string' && (!expiry || Date.now() < expiry));
      }
    );
  });
}

// --- SPA navigation + DOM watch ---

let currentHref = location.href;

async function tryInjectForCurrentUrl() {
  LOG('tryInjectForCurrentUrl', location.href);
  const eventInfo = getEventFromEditUrl();
  LOG('eventInfo:', eventInfo);
  if (!eventInfo) { removeInjected(); return; }
  const signedIn = await checkSignedIn();
  LOG('signedIn:', signedIn);
  if (!signedIn) { removeInjected(); return; }
  injectEditButton(eventInfo.eventId, eventInfo.calendarId);
}

new MutationObserver(() => {
  if (location.href !== currentHref) {
    currentHref = location.href;
    LOG('URL changed to', currentHref);
    removeInjected();
  }
  if (getEventFromEditUrl() && !document.getElementById(EDIT_BTN_ID)) {
    void tryInjectForCurrentUrl();
  }
}).observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'instacal_google_calendar_token' in changes) {
    void tryInjectForCurrentUrl();
  }
});

LOG('MutationObserver attached');
void tryInjectForCurrentUrl();
