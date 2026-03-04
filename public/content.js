(function () {
  'use strict';

  const INSTACAL_BTN_ID = 'instacal-edit-ai-btn';
  const LOG = (...args) => console.log('[InstaCal]', ...args);

  LOG('content script loaded on', location.href);

  function injectEditButton(anchorEl) {
    // Find the popup dialog root
    const popup =
      anchorEl.closest('[role="dialog"]') ||
      anchorEl.closest('[data-eventid]');

    if (!popup) {
      LOG('no popup found');
      return;
    }
    if (popup.querySelector('#' + INSTACAL_BTN_ID)) return;

    // Extract event title
    const headingEl =
      popup.querySelector('[role="heading"]') ||
      popup.querySelector('h1, h2');
    const title = headingEl ? headingEl.textContent.trim() : '';
    LOG('title:', JSON.stringify(title));

    // Build the button
    const btn = document.createElement('button');
    btn.id = INSTACAL_BTN_ID;
    btn.type = 'button';
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
      'fill="currentColor" style="flex-shrink:0">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77' +
      'l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
      '</svg>' +
      '<span>Edit with AI</span>';

    btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#345e7d'; });
    btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#6da7cc'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const prefill = title ? '\u201c' + title + '\u201d \u2014 ' : '';
      LOG('click — prefill:', JSON.stringify(prefill));
      chrome.runtime.sendMessage({ action: 'openEditWithAI', text: prefill });
    });

    // Wrap in a padded row and append inside the popup
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 16px 12px;box-sizing:border-box;';
    row.appendChild(btn);

    // Inject at the end of the popup's main content container
    // The details section has jsname="sV9x3c"; insert after it if present,
    // otherwise append to the popup root itself.
    const detailsSection = popup.querySelector('[jsname="sV9x3c"]');
    if (detailsSection && detailsSection.parentElement) {
      detailsSection.parentElement.insertBefore(row, detailsSection.nextSibling);
      LOG('injected after details section');
    } else {
      popup.appendChild(row);
      LOG('injected as last child of popup');
    }
  }

  function scanAndInject() {
    const candidates = document.querySelectorAll(
      '[aria-label="Edit event"]:not([data-instacal])'
    );
    if (candidates.length > 0) {
      LOG('found', candidates.length, 'edit button(s)');
    }
    candidates.forEach((el) => {
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
