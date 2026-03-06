import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import UnknownPersonModal from './components/UnknownPersonModal';
import { usePeople } from './hooks/usePeople';
import { sendMessage } from './utils/messaging';
import contentUiCss from './content-ui.css?inline';
import modalCss from './components/UnknownPersonModal.css?inline';
import { palette, status as statusColors, shadows, utility } from './styles/colors';

function buildHostCss(): string {
  return `:host {
  --color-primary-100: ${palette['primary-100']};
  --color-primary-400: ${palette['primary-400']};
  --color-primary-500: ${palette['primary-500']};
  --color-primary-600: ${palette['primary-600']};
  --color-primary-700: ${palette['primary-700']};
  --color-primary-900: ${palette['primary-900']};
  --color-bg-subtle:           var(--color-primary-100);
  --color-text-primary:        var(--color-primary-900);
  --color-text-secondary:      var(--color-primary-700);
  --color-text-tertiary:       var(--color-primary-600);
  --color-text-muted:          var(--color-primary-400);
  --color-border-default:      var(--color-primary-500);
  --color-border-focus:        var(--color-primary-700);
  --color-interactive-primary: var(--color-primary-500);
  --color-interactive-hover:   var(--color-primary-700);
  --color-failure: ${statusColors.failure};
  --color-success: ${statusColors.success};
  --shadow-sm:    ${shadows.sm};
  --shadow-md:    ${shadows.md};
  --shadow-thumb: ${shadows.thumb};
  --color-white:   ${utility.white};
  --color-bg-body: ${utility['bg-body']};
  --color-bg-page: ${utility['bg-page']};
}`;
}

type FlowState = 'idle' | 'loading' | 'patching' | 'success' | 'error';

interface PendingPatch {
  event: Record<string, unknown>;
  eventId: string;
  calendarId: string;
  existingAttendees: Array<{ email: string; displayName?: string }>;
}

function EditPanelApp({ host }: { host: HTMLElement }) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [formError, setFormError] = useState('');
  const [patchError, setPatchError] = useState('');
  const [unknownQueue, setUnknownQueue] = useState<string[]>([]);
  const [resolvedAttendees, setResolvedAttendees] = useState<Array<{ email: string; name: string }>>([]);
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { people, addPerson } = usePeople();

  useEffect(() => {
    // Signal content.ts that React is mounted and ready to receive events
    host.dispatchEvent(new CustomEvent('instacal:ui-ready'));

    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ eventId: string; calendarId: string }>).detail;
      setEventId(detail.eventId);
      setCalendarId(detail.calendarId);
      setInstruction('');
      setFlowState('idle');
      setFormError('');
      setPatchError('');
      setUnknownQueue([]);
      setResolvedAttendees([]);
      setPendingPatch(null);
      setOpen(true);
    }

    function handleClose() {
      setOpen(false);
    }

    host.addEventListener('instacal:open-panel', handleOpen);
    host.addEventListener('instacal:close-panel', handleClose);
    return () => {
      host.removeEventListener('instacal:open-panel', handleOpen);
      host.removeEventListener('instacal:close-panel', handleClose);
    };
  }, [host]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  async function applyPatch(patch: PendingPatch, attendees: Array<{ email: string; name: string }>) {
    setFlowState('patching');
    try {
      const result = await sendMessage({
        action: 'patchCalendarEvent',
        eventId: patch.eventId,
        calendarId: patch.calendarId,
        event: patch.event,
        newAttendees: attendees,
        existingGCalAttendees: patch.existingAttendees,
      });
      if (!result?.success) {
        setFlowState('error');
        setPatchError((result?.error as string) || 'Failed to update event. Try again.');
        return;
      }
      setFlowState('success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      setFlowState('error');
      setPatchError((err as Error).message || 'Failed to update event.');
    }
  }

  async function handleSubmit() {
    if (!instruction.trim()) return;
    setFlowState('loading');
    setFormError('');

    try {
      const peopleContacts = people.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
      }));

      const result = await sendMessage({
        action: 'editEventWithAI',
        text: instruction.trim(),
        eventId,
        calendarId,
        people: peopleContacts,
      });

      if (!result?.success) {
        setFlowState('idle');
        setFormError((result?.error as string) || 'Something went wrong.');
        return;
      }

      const {
        event,
        eventId: resolvedEventId,
        calendarId: resolvedCalId,
        resolvedAttendees: known = [],
        unknownAttendees: unknownNames = [],
        existingGCalAttendees = [],
      } = result as {
        event: Record<string, unknown>;
        eventId: string;
        calendarId: string;
        resolvedAttendees: Array<{ email: string; name: string }>;
        unknownAttendees: string[];
        existingGCalAttendees: Array<{ email: string; displayName?: string }>;
      };

      const patch: PendingPatch = {
        event,
        eventId: resolvedEventId,
        calendarId: resolvedCalId,
        existingAttendees: existingGCalAttendees,
      };

      if (unknownNames.length > 0) {
        setPendingPatch(patch);
        setResolvedAttendees([...known]);
        setUnknownQueue([...unknownNames]);
        setFlowState('idle');
      } else {
        await applyPatch(patch, [...known]);
      }
    } catch (err) {
      setFlowState('idle');
      setFormError((err as Error).message || 'Extension error. Try again.');
    }
  }

  async function handleModalAdd(email: string, save: boolean) {
    const name = unknownQueue[0];
    const newResolved = [...resolvedAttendees, { email, name }];
    setResolvedAttendees(newResolved);
    if (save) await addPerson(name, email);
    const newQueue = unknownQueue.slice(1);
    setUnknownQueue(newQueue);
    if (newQueue.length === 0 && pendingPatch) {
      await applyPatch(pendingPatch, newResolved);
    }
  }

  function handleModalIgnore() {
    const newQueue = unknownQueue.slice(1);
    setUnknownQueue(newQueue);
    if (newQueue.length === 0 && pendingPatch) {
      void applyPatch(pendingPatch, resolvedAttendees);
    }
  }

  if (!open) return null;

  const showForm = flowState === 'idle' && unknownQueue.length === 0;
  const isWorking = flowState === 'loading' || flowState === 'patching';

  return (
    <>
      <div className="instacal-backdrop" onClick={() => setOpen(false)} />
      <div className="instacal-panel">
        <div className="instacal-header">
          <div className="instacal-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Edit with AI
          </div>
          <button className="instacal-close-btn" onClick={() => setOpen(false)}>&#x2715;</button>
        </div>

        <div className="instacal-body">
          {showForm && (
            <>
              <textarea
                ref={textareaRef}
                className="instacal-textarea"
                rows={3}
                placeholder="Describe what to change…"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              {formError && <p className="instacal-form-error">{formError}</p>}
              <div className="instacal-actions">
                <button className="instacal-btn-cancel" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="instacal-btn-primary" onClick={() => void handleSubmit()}>
                  Update Event
                </button>
              </div>
            </>
          )}

          {isWorking && (
            <p className="instacal-loading">
              {flowState === 'patching' ? 'Applying changes\u2026' : 'Thinking\u2026'}
            </p>
          )}

          {flowState === 'success' && (
            <p className="instacal-success">\u2713 Event updated! Reloading\u2026</p>
          )}

          {flowState === 'error' && (
            <>
              <p className="instacal-error-msg">{patchError}</p>
              <div className="instacal-actions">
                <button className="instacal-btn-primary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {unknownQueue.length > 0 && (
        <UnknownPersonModal
          name={unknownQueue[0]}
          peopleCount={people.length}
          onIgnore={handleModalIgnore}
          onAdd={handleModalAdd}
        />
      )}
    </>
  );
}

// --- Lazy mount: wait for content.ts to create the shadow host ---

let mounted = false;

function mountApp(host: HTMLElement) {
  if (mounted || !host.shadowRoot) return;
  mounted = true;

  const shadow = host.shadowRoot;

  // Inject design tokens as :host custom properties
  const tokenStyle = document.createElement('style');
  tokenStyle.textContent = buildHostCss();
  shadow.insertBefore(tokenStyle, shadow.firstChild);

  // Inject component CSS strings
  const modalStyle = document.createElement('style');
  modalStyle.textContent = modalCss;
  shadow.appendChild(modalStyle);

  const panelStyle = document.createElement('style');
  panelStyle.textContent = contentUiCss;
  shadow.appendChild(panelStyle);

  const mount = shadow.getElementById('instacal-mount');
  if (mount) {
    createRoot(mount).render(<EditPanelApp host={host} />);
  }
}

// Check if shadow host already exists (e.g. script reloaded)
const existingHost = document.getElementById('instacal-react-root');
if (existingHost) {
  mountApp(existingHost);
} else {
  // Watch for content.ts to append the shadow host to document.body
  const observer = new MutationObserver(() => {
    const host = document.getElementById('instacal-react-root');
    if (host) {
      observer.disconnect();
      mountApp(host);
    }
  });
  observer.observe(document.body, { childList: true });
}
