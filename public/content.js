(function () {
  'use strict';

  const INSTACAL_BTN_ID = 'instacal-edit-ai-btn';
  const INSTACAL_UI_ID  = 'instacal-inline-ui';
  const LOG = (...args) => console.log('[InstaCal]', ...args);

  LOG('content script loaded on', location.href);

  // ── Inline edit UI ────────────────────────────────────────────────────────

  function removeInlineUI() {
    document.getElementById(INSTACAL_UI_ID)?.remove();
  }

  function showInlineUI({ title, timeText, eventId, calendarId, anchorBtn }) {
    removeInlineUI();

    const prefill = title
      ? '\u201c' + title + '\u201d' + (timeText ? ' (' + timeText + ')' : '') + ' \u2014 '
      : '';

    const rect = anchorBtn.getBoundingClientRect();

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

    const input     = ui.querySelector('#instacal-input');
    const status    = ui.querySelector('#instacal-status');
    const submitBtn = ui.querySelector('#instacal-submit');
    const cancelBtn = ui.querySelector('#instacal-cancel');

    input.value = prefill;
    input.focus();
    input.selectionStart = input.selectionEnd = prefill.length;

    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.backgroundColor = '#345e7d'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.backgroundColor = '#6da7cc'; });
    ui.querySelector('#instacal-close').addEventListener('click', removeInlineUI);
    cancelBtn.addEventListener('click', removeInlineUI);

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
            setStatus('\u2713 Event updated!', '#345e7d');
            setTimeout(removeInlineUI, 1800);
          } else {
            setStatus(resp?.error || 'Something went wrong.', '#c0392b');
          }
        }
      );
    });

    function onOutsideClick(e) {
      const btn = document.getElementById(INSTACAL_BTN_ID);
      if (!ui.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        removeInlineUI();
        document.removeEventListener('mousedown', onOutsideClick, true);
      }
    }
    document.addEventListener('mousedown', onOutsideClick, true);
  }

  // ── Button: inside popup DOM (no dismiss) + position:fixed (always visible) ─

  function placeEditBtn(anchorEl) {
    // Find the popup dialog to append into (keeps clicks inside popup so GCal won't dismiss)
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
    // position:fixed so overflow/clipping can never hide it,
    // but DOM-parent is the popup so GCal sees clicks as inside the dialog
    btn.style.cssText =
      'position:fixed;z-index:2147483647;' +
      'height:28px;display:inline-flex;align-items:center;gap:4px;padding:0 9px;' +
      'background:#6da7cc;color:#fff;border:none;border-radius:7px;' +
      'font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 1px 4px rgba(43,66,87,.25);';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
      '</svg><span>Edit with AI</span>';

    btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#345e7d'; });
    btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#6da7cc'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showInlineUI({ title, timeText, eventId, calendarId, anchorBtn: btn });
    });

    // Append to the popup element — click target is inside the popup's DOM tree
    popup.appendChild(btn);

    // rAF loop: keep button visually pinned to the left of the pencil icon
    let rafId;
    function updatePos() {
      if (!document.contains(anchorEl) || !document.contains(btn)) return;
      const r = anchorEl.getBoundingClientRect();
      btn.style.top   = Math.round(r.top + (r.height - 28) / 2) + 'px';
      btn.style.right = Math.round(window.innerWidth - r.left + 6) + 'px';
      rafId = requestAnimationFrame(updatePos);
    }
    rafId = requestAnimationFrame(updatePos);

    LOG('button appended to popup dialog, tracking pencil via rAF');

    // Clean up when the popup closes
    const watcher = new MutationObserver(() => {
      if (!document.contains(anchorEl)) {
        cancelAnimationFrame(rafId);
        btn.remove();
        removeInlineUI();
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
