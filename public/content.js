(function () {
  'use strict';

  const INSTACAL_BTN_ID  = 'instacal-edit-ai-btn';
  const INSTACAL_UI_ID   = 'instacal-inline-ui';
  const LOG = (...args) => console.log('[InstaCal]', ...args);

  LOG('content script loaded on', location.href);

  // ── Inline-UI ────────────────────────────────────────────────────────────

  function removeInlineUI() {
    document.getElementById(INSTACAL_UI_ID)?.remove();
  }

  function showInlineUI({ title, timeText, eventId, calendarId, anchorEl }) {
    removeInlineUI();

    const prefill = title
      ? '\u201c' + title + '\u201d' + (timeText ? ' (' + timeText + ')' : '') + ' \u2014 '
      : '';

    // Position near the GCal popup
    const popup = anchorEl.closest('[role="dialog"]') || anchorEl.closest('[data-eventid]');
    const rect  = popup ? popup.getBoundingClientRect() : { left: 60, bottom: 80, width: 320 };

    const ui = document.createElement('div');
    ui.id = INSTACAL_UI_ID;
    ui.style.cssText =
      'position:fixed;z-index:2147483647;' +
      'left:' + Math.max(8, rect.left) + 'px;' +
      'top:'  + (rect.bottom + 8) + 'px;' +
      'width:' + Math.max(320, rect.width) + 'px;' +
      'background:#FCFDFE;border:1.5px solid #6da7cc;border-radius:12px;' +
      'box-shadow:0 8px 32px rgba(43,66,87,.18);' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'overflow:hidden;box-sizing:border-box;';

    ui.innerHTML =
      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:10px 14px 8px;border-bottom:1px solid #e3ebf2;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#6da7cc">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
          '</svg>' +
          '<span style="font-size:13px;font-weight:600;color:#2b4257;">Edit with AI</span>' +
        '</div>' +
        '<button id="instacal-close" style="background:none;border:none;cursor:pointer;' +
        'color:#88a9c3;font-size:18px;line-height:1;padding:0 2px;" title="Close">\u00d7</button>' +
      '</div>' +
      // Textarea
      '<div style="padding:10px 14px 0;">' +
        '<textarea id="instacal-input" rows="2" placeholder="Describe your changes\u2026" ' +
        'style="width:100%;box-sizing:border-box;padding:8px 10px;' +
        'border:1.5px solid #6da7cc;border-radius:8px;font-size:13px;' +
        'font-family:inherit;color:#2b4257;background:#e3ebf2;' +
        'resize:none;outline:none;line-height:1.45;">' +
        '</textarea>' +
      '</div>' +
      // Status (hidden by default)
      '<div id="instacal-status" style="display:none;padding:4px 14px 0;' +
      'font-size:12px;font-weight:600;"></div>' +
      // Buttons
      '<div style="display:flex;gap:8px;padding:10px 14px 12px;justify-content:flex-end;">' +
        '<button id="instacal-cancel" style="padding:7px 14px;background:none;' +
        'border:1.5px solid #88a9c3;border-radius:8px;font-size:13px;font-weight:600;' +
        'color:#6da7cc;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '<button id="instacal-submit" style="padding:7px 16px;background:#6da7cc;' +
        'border:none;border-radius:8px;font-size:13px;font-weight:600;' +
        'color:#fff;cursor:pointer;font-family:inherit;">Update Event</button>' +
      '</div>';

    document.body.appendChild(ui);

    const input    = ui.querySelector('#instacal-input');
    const status   = ui.querySelector('#instacal-status');
    const submitBtn = ui.querySelector('#instacal-submit');
    const cancelBtn = ui.querySelector('#instacal-cancel');

    // Pre-fill and position cursor at end
    input.value = prefill;
    input.focus();
    input.selectionStart = input.selectionEnd = prefill.length;

    // Hover states
    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.backgroundColor = '#345e7d'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.backgroundColor = '#6da7cc'; });

    ui.querySelector('#instacal-close').addEventListener('click', removeInlineUI);
    cancelBtn.addEventListener('click', removeInlineUI);

    function setStatus(msg, color) {
      status.style.display = msg ? 'block' : 'none';
      status.style.color   = color || '#2b4257';
      status.textContent   = msg;
    }

    function setLoading(loading) {
      submitBtn.disabled     = loading;
      cancelBtn.disabled     = loading;
      submitBtn.textContent  = loading ? 'Updating\u2026' : 'Update Event';
      submitBtn.style.opacity = loading ? '0.7' : '1';
    }

    submitBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;
      setLoading(true);
      setStatus('');

      chrome.runtime.sendMessage(
        { action: 'editEventWithAI', text, eventId, calendarId },
        (resp) => {
          setLoading(false);
          if (chrome.runtime.lastError) {
            setStatus('Extension error. Try again.', '#c0392b');
            return;
          }
          if (resp && resp.success) {
            setStatus('\u2713 Event updated!', '#345e7d');
            setTimeout(removeInlineUI, 1800);
          } else {
            setStatus(resp?.error || 'Something went wrong.', '#c0392b');
          }
        }
      );
    });

    // Close when clicking outside
    function onOutsideClick(e) {
      if (!ui.contains(e.target) && e.target.id !== INSTACAL_BTN_ID) {
        removeInlineUI();
        document.removeEventListener('mousedown', onOutsideClick, true);
      }
    }
    document.addEventListener('mousedown', onOutsideClick, true);
  }

  // ── Button injection ──────────────────────────────────────────────────────

  function injectEditButton(anchorEl) {
    const popup =
      anchorEl.closest('[role="dialog"]') ||
      anchorEl.closest('[data-eventid]');
    if (!popup) { LOG('no popup found'); return; }
    if (popup.querySelector('#' + INSTACAL_BTN_ID)) return;

    const headingEl = popup.querySelector('[role="heading"]') || popup.querySelector('h1, h2');
    const title     = headingEl ? headingEl.textContent.trim() : '';
    LOG('title:', JSON.stringify(title));

    const btn = document.createElement('button');
    btn.id    = INSTACAL_BTN_ID;
    btn.type  = 'button';
    btn.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:6px;' +
      'width:100%;padding:8px 0;' +
      'background-color:#6da7cc;color:#fff;' +
      'border:none;border-radius:8px;' +
      'font-size:13px;font-weight:600;' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'cursor:pointer;white-space:nowrap;line-height:1;box-sizing:border-box;';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ' +
      'fill="currentColor" style="flex-shrink:0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87' +
      ' 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
      '<span>Edit with AI</span>';

    btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#345e7d'; });
    btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#6da7cc'; });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Decode data-eventid (base64 "eventId calendarId")
      const eventEl = anchorEl.closest('[data-eventid]');
      const raw     = eventEl ? eventEl.getAttribute('data-eventid') : '';
      let eventId = '', calendarId = 'primary';
      try {
        const pad     = raw.length % 4;
        const decoded = atob(pad ? raw + '='.repeat(4 - pad) : raw);
        const sp      = decoded.indexOf(' ');
        if (sp > 0) { eventId = decoded.slice(0, sp); calendarId = decoded.slice(sp + 1); }
        else { eventId = decoded; }
      } catch (err) { LOG('decode error:', err); }

      const whenEl  = popup.querySelector('#xDetDlgWhen');
      const timeText = whenEl ? whenEl.textContent.trim().replace(/\s+/g, ' ') : '';

      LOG('eventId:', eventId, 'calendarId:', calendarId);
      showInlineUI({ title, timeText, eventId, calendarId, anchorEl });
    });

    const detailsSection = popup.querySelector('[jsname="sV9x3c"]');
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 16px 12px;box-sizing:border-box;';
    row.appendChild(btn);

    if (detailsSection && detailsSection.parentElement) {
      detailsSection.parentElement.insertBefore(row, detailsSection.nextSibling);
    } else {
      popup.appendChild(row);
    }
    LOG('button injected');
  }

  function scanAndInject() {
    document.querySelectorAll('[aria-label="Edit event"]:not([data-instacal])').forEach((el) => {
      el.setAttribute('data-instacal', '1');
      injectEditButton(el);
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { scanAndInject(); return; }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  LOG('MutationObserver attached');
  scanAndInject();
})();
