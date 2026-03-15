const LOG = (...args: unknown[]) => console.log('[InstaCal]', ...args);

LOG('content script loaded on', location.href);

const EDIT_BTN_ID = 'instacal-edit-ai-btn';
const DIALOG_ID   = 'instacal-dialog';

// --- URL parsing ---

function getEventFromEditUrl(): { eventId: string; calendarId: string } | null {
  const match = location.pathname.match(/\/r\/eventedit\/([^?#/]+)/);
  if (!match) return null;
  const raw = match[1];
  try {
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
  const dlg = document.getElementById(DIALOG_ID) as HTMLDialogElement | null;
  if (dlg) { dlg.close(); dlg.remove(); }
}

// --- Panel (shadow DOM + React, mounted by content-ui.js) ---

function injectPanel(eventId: string, calendarId: string) {
  // If the dialog and React app already exist, reuse them
  const existingDlg  = document.getElementById(DIALOG_ID) as HTMLDialogElement | null;
  const existingHost = document.getElementById('instacal-react-root');
  if (existingDlg && existingHost) {
    if (!existingDlg.open) existingDlg.showModal();
    existingHost.dispatchEvent(new CustomEvent('instacal:open-panel', { detail: { eventId, calendarId } }));
    return;
  }

  // Wrap in a <dialog> so it enters the CSS top layer and renders above
  // Google Calendar's own modal dialogs, regardless of z-index stacking contexts.
  const dialog = document.createElement('dialog');
  dialog.id = DIALOG_ID;
  dialog.style.cssText =
    'padding:0;margin:0;border:none;background:transparent;' +
    'max-width:none;max-height:none;width:100%;height:100%;' +
    'overflow:visible;pointer-events:none;';
  // Prevent native Escape from closing the dialog; React handles Escape itself
  dialog.addEventListener('cancel', (e) => e.preventDefault());

  // Hide the browser's default ::backdrop (our shadow DOM provides its own)
  const backdropStyle = document.createElement('style');
  backdropStyle.textContent = '#instacal-dialog::backdrop { background: transparent; }';
  document.head.appendChild(backdropStyle);

  const host = document.createElement('div');
  host.id = 'instacal-react-root';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const mount = document.createElement('div');
  mount.id = 'instacal-mount';
  shadow.appendChild(mount);

  // Wait for content-ui.js to finish mounting React, then show the dialog and open the panel.
  // showModal() is intentionally deferred — calling it before React is ready leaves an
  // invisible modal backdrop that makes the button (outside the dialog) permanently inert.
  host.addEventListener(
    'instacal:ui-ready',
    () => {
      dialog.showModal();
      host.dispatchEvent(new CustomEvent('instacal:open-panel', { detail: { eventId, calendarId } }));
    },
    { once: true },
  );

  // Close the dialog (without removing it) when React signals the panel has closed
  host.addEventListener('instacal:panel-closed', () => {
    dialog.close();
  });

  dialog.appendChild(host);
  document.body.appendChild(dialog);
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
