// Runs in the page's MAIN world at document_start, before Google Calendar's
// scripts register their keydown handlers. Being first in the capture chain
// means we can call stopImmediatePropagation() before GCal's handler fires.
//
// When the InstaCal panel is open, content-ui sets data-open on the host
// element. We read that attribute to decide whether to suppress shortcuts.
console.log('[InstaCal keyboard-guard] script loaded in main world');

function guard(e: KeyboardEvent) {
  const host = document.getElementById('instacal-react-root');
  const isOpen = host?.hasAttribute('data-open') ?? false;
  console.log(`[InstaCal keyboard-guard] ${e.type}`, { key: e.key, hostFound: !!host, isOpen });
  if (isOpen && e.key !== 'Escape') {
    e.stopImmediatePropagation();
    console.log(`[InstaCal keyboard-guard] blocked ${e.type}:`, e.key);
  }
}

window.addEventListener('keydown',  guard, true);
window.addEventListener('keypress', guard, true);
window.addEventListener('keyup',    guard, true);
