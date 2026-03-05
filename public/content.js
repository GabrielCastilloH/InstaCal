(function () {
  'use strict';

  const INSTACAL_BTN_ID = 'instacal-edit-ai-btn';
  const INSTACAL_UI_ID  = 'instacal-inline-ui';
  const LOG = (...args) => console.log('[InstaCal]', ...args);

  LOG('content script loaded on', location.href);

  function buildCalendarEditUrl(eventId, calendarId, event) {
    const token = btoa(eventId + ' ' + calendarId).replace(/=+$/, '');
    const url = new URL('https://calendar.google.com/calendar/r/eventedit/' + token);
    const fmt = (iso) => iso.slice(0, 19).replace(/-/g, '').replace(/:/g, '');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', fmt(event.start) + '/' + fmt(event.end));
    if (event.location) url.searchParams.set('location', event.location);
    if (event.description) url.searchParams.set('details', event.description);
    return url.toString();
  }

  // ── Inline edit UI ────────────────────────────────────────────────────────

  function removeInlineUI() {
    document.getElementById(INSTACAL_UI_ID)?.remove();
  }

  function showInlineUI({ title, timeText, eventId, calendarId, anchorBtn }) {
    LOG('showInlineUI called', { title, eventId, calendarId });
    removeInlineUI();

    const prefill = title
      ? '\u201c' + title + '\u201d' + (timeText ? ' (' + timeText + ')' : '') + ' \u2014 '
      : '';

    const rect = anchorBtn.getBoundingClientRect();
    LOG('anchorBtn rect', rect);

    const ui = document.createElement('div');
    ui.id = INSTACAL_UI_ID;
    ui.style.cssText =
      'position:fixed;z-index:2147483647;' +
      'top:' + (rect.bottom + 8) + 'px;' +
      'left:' + Math.max(8, rect.left - 240) + 'px;' +
      'width:320px;' +
      'background:#FCFDFE;border:1.5px solid #6da7cc;border-radius:12px;' +
      'box-shadow:0 8px 32px rgba(43,66,87,.18);' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'overflow:hidden;box-sizing:border-box;';

    ui.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:10px 14px 8px;border-bottom:1px solid #e3ebf2;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#6da7cc">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
          '</svg>' +
          '<span style="font-size:13px;font-weight:600;color:#2b4257;">Edit with AI</span>' +
        '</div>' +
        '<button id="instacal-close" style="background:none;border:none;cursor:pointer;' +
        'color:#88a9c3;font-size:18px;line-height:1;padding:0 2px;">\u00d7</button>' +
      '</div>' +
      '<div style="padding:10px 14px 0;">' +
        '<textarea id="instacal-input" rows="2" placeholder="Describe your changes\u2026" ' +
        'style="width:100%;box-sizing:border-box;padding:8px 10px;' +
        'border:1.5px solid #6da7cc;border-radius:8px;font-size:13px;' +
        'font-family:inherit;color:#2b4257;background:#e3ebf2;' +
        'resize:none;outline:none;line-height:1.45;"></textarea>' +
      '</div>' +
      '<div id="instacal-status" style="display:none;padding:4px 14px 0;' +
      'font-size:12px;font-weight:600;"></div>' +
      '<div style="display:flex;gap:8px;padding:10px 14px 12px;justify-content:flex-end;">' +
        '<button id="instacal-cancel" style="padding:7px 14px;background:none;' +
        'border:1.5px solid #88a9c3;border-radius:8px;font-size:13px;font-weight:600;' +
        'color:#6da7cc;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '<button id="instacal-submit" style="padding:7px 16px;background:#6da7cc;' +
        'border:none;border-radius:8px;font-size:13px;font-weight:600;' +
        'color:#fff;cursor:pointer;font-family:inherit;">Update Event</button>' +
      '</div>';

    document.body.appendChild(ui);
    LOG('inline UI appended to body, element:', ui);

    const input     = ui.querySelector('#instacal-input');
    const status    = ui.querySelector('#instacal-status');
    const submitBtn = ui.querySelector('#instacal-submit');
    const cancelBtn = ui.querySelector('#instacal-cancel');

    input.value = prefill;
    input.focus();
    input.selectionStart = input.selectionEnd = prefill.length;

    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.backgroundColor = '#345e7d'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.backgroundColor = '#6da7cc'; });
    function closeUI() {
      LOG('closeUI called');
      removeInlineUI();
      window.removeEventListener('mousedown', onWindowMousedown, true);
      document.removeEventListener('mousedown', onOutsideClick, true);
    }
    ui.querySelector('#instacal-close').addEventListener('click', (e) => { LOG('X button clicked', e); closeUI(); });
    cancelBtn.addEventListener('click', closeUI);

    function setStatus(msg, color) {
      status.style.display = msg ? 'block' : 'none';
      status.style.color   = color || '#2b4257';
      status.textContent   = msg;
    }
    function setLoading(on) {
      submitBtn.disabled      = on;
      cancelBtn.disabled      = on;
      submitBtn.textContent   = on ? 'Updating\u2026' : 'Update Event';
      submitBtn.style.opacity = on ? '0.7' : '1';
    }

    submitBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      setLoading(true);
      setStatus('');
      chrome.runtime.sendMessage(
        { action: 'editEventWithAI', text, eventId, calendarId },
        (resp) => {
          setLoading(false);
          if (chrome.runtime.lastError) { setStatus('Extension error. Try again.', '#c0392b'); return; }
          if (resp && resp.success) {
            if (resp.autoSaved) {
              setStatus('\u2713 Event updated!', '#345e7d');
              setTimeout(() => {
                removeInlineUI();
                location.reload();
              }, 400);
            } else {
              removeInlineUI();
              const url = buildCalendarEditUrl(eventId, calendarId || 'primary', resp.event);
              window.location.href = url;
            }
          } else {
            setStatus(resp?.error || 'Something went wrong.', '#c0392b');
          }
        }
      );
    });

    // Intercept mousedown at window level (before GCal's document-level capture listener)
    // so clicks inside our UI don't trigger GCal's outside-click / popup-close logic.
    function onWindowMousedown(e) {
      const inside = ui.contains(e.target);
      LOG('window mousedown — target:', e.target, '| inside UI:', inside);
      if (inside) {
        e.stopPropagation();
        LOG('stopPropagation called — GCal should NOT see this click');
      }
    }
    window.addEventListener('mousedown', onWindowMousedown, true);

    function onOutsideClick(e) {
      if (ui.contains(e.target)) { LOG('onOutsideClick: inside UI, ignoring'); return; }
      const btn = document.getElementById(INSTACAL_BTN_ID);
      LOG('onOutsideClick: outside UI, target:', e.target);
      if (e.target !== btn && !btn?.contains(e.target)) {
        LOG('onOutsideClick: closing UI');
        removeInlineUI();
        document.removeEventListener('mousedown', onOutsideClick, true);
        window.removeEventListener('mousedown', onWindowMousedown, true);
      }
    }
    document.addEventListener('mousedown', onOutsideClick, true);
  }

  // ── Button: inside popup DOM (no dismiss) + position:fixed (always visible) ─

  function placeEditBtn(anchorEl) {
    // Find the popup dialog for context extraction
    const popup = anchorEl.closest('[role="dialog"]') || anchorEl.closest('[data-eventid]');
    if (!popup || popup.querySelector('#' + INSTACAL_BTN_ID)) return;

    // Extract event context
    const heading  = popup.querySelector('[role="heading"]') || popup.querySelector('h1,h2');
    const title    = heading ? heading.textContent.trim() : '';
    const whenEl   = popup.querySelector('#xDetDlgWhen');
    const timeText = whenEl ? whenEl.textContent.trim().replace(/\s+/g, ' ') : '';

    const raw = anchorEl.closest('[data-eventid]')?.getAttribute('data-eventid') || '';
    let eventId = '', calendarId = 'primary';
    try {
      const pad     = raw.length % 4;
      const decoded = atob(pad ? raw + '='.repeat(4 - pad) : raw);
      const sp      = decoded.indexOf(' ');
      if (sp > 0) { eventId = decoded.slice(0, sp); calendarId = decoded.slice(sp + 1); }
      else { eventId = decoded; }
    } catch (e) { LOG('decode error:', e); }

    const btn = document.createElement('button');
    btn.id   = INSTACAL_BTN_ID;
    btn.type = 'button';
    btn.title = 'Edit with AI (InstaCal)';
    // Bottom-of-popup button — inside dialog DOM so GCal doesn't close on click
    btn.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:6px;' +
      'width:calc(100% - 32px);margin:8px 16px 12px;padding:8px 0;' +
      'background:#6da7cc;color:#fff;border:none;border-radius:8px;' +
      'font-size:13px;font-weight:600;cursor:pointer;' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 1px 4px rgba(43,66,87,.25);';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
      '</svg><span>Edit with AI</span>';

    btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#345e7d'; });
    btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#6da7cc'; });
    btn.addEventListener('mousedown', (e) => { LOG('btn mousedown', e.target); });
    btn.addEventListener('click', (e) => {
      LOG('btn click fired', e.target);
      e.stopPropagation();
      showInlineUI({ title, timeText, eventId, calendarId, anchorBtn: btn });
    });

    // Insert after the organizer row inside the details content area
    const organizerEl = popup.querySelector('#xDetDlgCal');
    const organizerRow = organizerEl && organizerEl.closest('.nBzcnc');
    LOG('organizerEl:', organizerEl, '| organizerRow:', organizerRow);
    if (organizerRow) {
      organizerRow.insertAdjacentElement('afterend', btn);
      LOG('button inserted after organizer row');
    } else {
      popup.appendChild(btn);
      LOG('button appended to popup (fallback)');
    }

    // Clean up when the popup closes
    const watcher = new MutationObserver(() => {
      if (!document.contains(anchorEl)) {
        btn.remove();
        watcher.disconnect();
      }
    });
    watcher.observe(document.body, { childList: true, subtree: true });
  }

  // ── Scan & inject ─────────────────────────────────────────────────────────

  function scanAndInject() {
    document.querySelectorAll('[aria-label="Edit event"]:not([data-instacal])').forEach((el) => {
      el.setAttribute('data-instacal', '1');
      placeEditBtn(el);
    });
  }

  new MutationObserver((mutations) => {
    for (const m of mutations) if (m.addedNodes.length) { scanAndInject(); return; }
  }).observe(document.body, { childList: true, subtree: true });

  LOG('MutationObserver attached');
  scanAndInject();
})();
