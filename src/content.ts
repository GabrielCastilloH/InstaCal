const LOG = (...args: unknown[]) => console.log('[InstaCal]', ...args);

LOG('content script loaded on', location.href);

const EDIT_BTN_ID   = 'instacal-edit-ai-btn';
const EDIT_PANEL_ID = 'instacal-edit-ai-panel';

// --- URL parsing ---

function getEventFromEditUrl(): { eventId: string; calendarId: string } | null {
  const match = location.pathname.match(/\/r\/eventedit\/([^?#/]+)/);
  if (!match) return null;
  const raw = match[1];
  try {
    const pad     = raw.length % 4;
    const decoded = atob(pad ? raw + '='.repeat(4 - pad) : raw);
    const sp      = decoded.indexOf(' ');
    if (sp > 0) {
      return { eventId: decoded.slice(0, sp), calendarId: decoded.slice(sp + 1) };
    }
    return { eventId: decoded, calendarId: 'primary' };
  } catch {
    return null;
  }
}

const EDIT_BACKDROP_ID = 'instacal-backdrop';

// --- Cleanup ---

function removeInjected() {
  document.getElementById(EDIT_BTN_ID)?.remove();
  document.getElementById(EDIT_PANEL_ID)?.remove();
  document.getElementById(EDIT_BACKDROP_ID)?.remove();
}

// --- Panel (fixed modal) ---

function closePanel() {
  document.getElementById(EDIT_PANEL_ID)?.remove();
  document.getElementById(EDIT_BACKDROP_ID)?.remove();
}

function injectPanel(eventId: string, calendarId: string) {
  if (document.getElementById(EDIT_PANEL_ID)) {
    closePanel();
    return;
  }

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
    // Header
    '<div style="' +
      'background:#6da7cc;' +
      'padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#fff">' +
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>' +
        '<span style="font-size:14px;font-weight:600;color:#fff;">Edit with AI</span>' +
      '</div>' +
      '<button id="instacal-panel-x" style="' +
        'background:none;border:none;border-radius:6px;' +
        'width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;color:rgba(255,255,255,0.85);font-size:15px;line-height:1;padding:0;">' +
        '&#x2715;' +
      '</button>' +
    '</div>' +
    // Body
    '<div style="padding:16px 20px 20px;">' +
      '<textarea id="instacal-panel-input" rows="3" ' +
        'placeholder="Describe what to change\u2026" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;' +
        'border:1.5px solid #88a9c3;border-radius:8px;font-size:14px;' +
        'font-family:inherit;color:#2b4257;background:#e3ebf2;' +
        'resize:none;outline:none;line-height:1.5;display:block;' +
        'transition:border-color 0.15s;"></textarea>' +
      '<div id="instacal-panel-status" style="display:none;font-size:12px;font-weight:600;' +
        'margin-top:8px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">' +
        '<button id="instacal-panel-cancel" style="padding:8px 18px;background:none;' +
          'border:1.5px solid #88a9c3;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#6da7cc;cursor:pointer;font-family:inherit;transition:background 0.15s;">Cancel</button>' +
        '<button id="instacal-panel-submit" style="padding:8px 18px;' +
          'background:#6da7cc;' +
          'border:none;border-radius:8px;font-size:13px;font-weight:600;' +
          'color:#fff;cursor:pointer;font-family:inherit;' +
          'transition:background-color 0.15s;">Update Event</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(panel);

  const input     = panel.querySelector<HTMLTextAreaElement>('#instacal-panel-input')!;
  const status    = panel.querySelector<HTMLElement>('#instacal-panel-status')!;
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
    status.style.display = msg ? 'block' : 'none';
    status.style.color   = isError ? '#c43b49' : '#4c9161';
    status.textContent   = msg;
  }
  function setLoading(on: boolean) {
    submitBtn.disabled      = on;
    cancelBtn.disabled      = on;
    xBtn.disabled           = on;
    submitBtn.textContent   = on ? 'Updating\u2026' : 'Update Event';
    submitBtn.style.opacity = on ? '0.7' : '1';
  }

  submitBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    setLoading(true);
    setStatus('');
    chrome.runtime.sendMessage(
      { action: 'editEventWithAI', text, eventId, calendarId },
      (resp: { success: boolean; error?: string }) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setStatus('Extension error. Try again.', true);
          return;
        }
        if (resp && resp.success) {
          setStatus('\u2713 Event updated! Reloading\u2026');
          setTimeout(() => location.reload(), 1500);
        } else {
          setStatus(resp?.error || 'Something went wrong.', true);
        }
      }
    );
  });

  // Close on Escape
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { closePanel(); document.removeEventListener('keydown', onKey, true); }
  }
  document.addEventListener('keydown', onKey, true);
}

// --- Button injection ---

function injectEditButton(eventId: string, calendarId: string) {
  if (document.getElementById(EDIT_BTN_ID)) return;

  const saveBtn = document.querySelector<HTMLElement>('#xSaveBu');
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
  const eventInfo = getEventFromEditUrl();
  if (!eventInfo) {
    removeInjected();
    return;
  }
  const signedIn = await checkSignedIn();
  if (!signedIn) {
    removeInjected();
    return;
  }
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

// React to sign-in / sign-out without needing a page reload
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'instacal_google_calendar_token' in changes) {
    void tryInjectForCurrentUrl();
  }
});

LOG('MutationObserver attached');
void tryInjectForCurrentUrl();
