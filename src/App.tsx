import { useEffect, useRef, useState } from "react";
import { signInWithCredential, GoogleAuthProvider, type User } from "firebase/auth";
import { auth } from "./lib/firebase";
import SettingsPage from "./components/SettingsPage";
import HelpContentPage from "./components/HelpContentPage";
import PreferencesPage, { PREF_KEY, DEFAULT_PREFS, type Prefs } from "./components/PreferencesPage";
import CoffeePage from "./components/CoffeePage";
import PageHeader from "./components/PageHeader";
import SignIn from "./components/SignIn";
import { parseEvent, isAllDayEvent, type ParsedEvent } from "./services/parseEvent";
import { getFirebaseIdToken, getGoogleCalendarToken, clearGoogleCalendarToken } from "./services/auth";
import { createCalendarEvent } from "./services/calendar";
import { fetchAvailability } from "./services/availability";
import DateRangePicker from "./components/DateRangePicker";
import "./App.css";

function buildGoogleCalendarUrl(event: ParsedEvent): string {
  const allDay = isAllDayEvent(event)
  const dates = allDay
    ? (() => {
        const startStr = event.start.slice(0, 10).replace(/-/g, '')
        const d = new Date(event.start.slice(0, 10))
        d.setDate(d.getDate() + 1)
        const endStr = d.toISOString().slice(0, 10).replace(/-/g, '')
        return `${startStr}/${endStr}`
      })()
    : (() => {
        const fmt = (iso: string) => iso.slice(0, 19).replace(/-/g, '').replace(/:/g, '')
        return `${fmt(event.start)}/${fmt(event.end)}`
      })()
  const url = new URL("https://calendar.google.com/calendar/r/eventedit");
  url.searchParams.set("text", event.title);
  url.searchParams.set("dates", dates);
  if (event.location) url.searchParams.set("location", event.location);
  if (event.description) url.searchParams.set("details", event.description);
  if (event.recurrence) url.searchParams.set("recur", `RRULE:${event.recurrence}`);
  return url.toString();
}

type SettingsPageType = "settings" | "help" | "preferences" | "coffee";

function App() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [settingsPage, setSettingsPage] = useState<SettingsPageType | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [copyStatus, setCopyStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availStart, setAvailStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [availEnd, setAvailEnd] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 6); return d;
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Store config values so background.js can silently refresh tokens without opening the popup
      chrome.storage.local.set({
        'instacal_google_client_id': import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string,
        'instacal_firebase_api_key': import.meta.env.VITE_FIREBASE_API_KEY as string,
      });

      // Check for a stored Google token and re-authenticate
      const googleToken = await getGoogleCalendarToken();
      if (googleToken) {
        try {
          const credential = GoogleAuthProvider.credential(null, googleToken);
          const result = await signInWithCredential(auth, credential);
          // Cache tokens for background service worker
          const idToken = await result.user.getIdToken();
          chrome.storage.local.set({
            instacal_firebase_id_token: idToken,
            instacal_firebase_id_token_expiry: Date.now() + 55 * 60 * 1000,
            instacal_firebase_refresh_token: result.user.refreshToken,
            instacal_firebase_api_key: import.meta.env.VITE_FIREBASE_API_KEY as string,
            instacal_backend_url: (import.meta.env.VITE_CLOUD_FUNCTION_URL as string) ?? '',
          });
          if (!cancelled) {
            setUser(result.user);
            setAuthLoading(false);
          }
          return;
        } catch {
          await clearGoogleCalendarToken();
        }
      }

      if (!cancelled) {
        setUser(null);
        setAuthLoading(false);
      }
    }

    init();

    // Re-run auth when the token is written by the auth tab after sign-in
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area === "local" && changes["instacal_google_calendar_token"]?.newValue) {
        init();
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  function loadPrefsIntoState() {
    chrome.storage.local.get([PREF_KEY], (result) => {
      const stored = result[PREF_KEY] as Partial<Prefs> | undefined;
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...stored });
    });
  }

  useEffect(() => { loadPrefsIntoState(); }, []);

  // Clear badge and show any pending error from background context-menu flow
  useEffect(() => {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.get(['instacal_badge_error'], (result) => {
      if (result.instacal_badge_error) {
        setStatus('error');
        setErrorMessage(String(result.instacal_badge_error));
        chrome.storage.local.remove('instacal_badge_error');
      }
    });
  }, []);


  // Re-load prefs when returning from settings so changes apply immediately
  useEffect(() => {
    if (!settingsPage) {
      inputRef.current?.focus();
      loadPrefsIntoState();
    }
  }, [settingsPage]);

  async function handleAddEvent() {
    const text = inputRef.current?.value.trim() ?? "";
    console.log('[InstaCal] handleAddEvent called, text:', text);
    if (!text) return;

    setStatus("loading");
    setErrorMessage(undefined);

    try {
      const idToken = await getFirebaseIdToken();
      const calendarToken = await getGoogleCalendarToken();
      console.log('[InstaCal] tokens', { hasIdToken: !!idToken, hasCalendarToken: !!calendarToken });
      if (!idToken || !calendarToken) {
        throw new Error("Not authenticated");
      }
      console.log('[InstaCal] calling parseEvent with prefs:', prefs);
      const event = await parseEvent(text, idToken, {
        smartDefaults: prefs.smartDefaults,
        tasksAsAllDayEvents: prefs.tasksAsAllDayEvents,
        defaultDuration: prefs.defaultDuration,
        defaultStartTime: prefs.defaultStartTime,
        defaultLocation: prefs.defaultLocation,
      });
      console.log('[InstaCal] parseEvent result:', event);

      if (prefs.autoReview) {
        console.log('[InstaCal] autoReview=true, creating calendar event directly');
        await createCalendarEvent(calendarToken, event);
        setStatus("success");
      } else {
        const url = buildGoogleCalendarUrl(event);
        console.log('[InstaCal] autoReview=false, opening Google Calendar URL:', url);
        chrome.tabs.create({ url });
      }
    } catch (err) {
      console.error('[InstaCal] handleAddEvent error:', err);
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }

  async function handleExportAvailability(start: Date, end: Date) {
    setShowDatePicker(false);
    setCopyStatus("loading");
    try {
      const calendarToken = await getGoogleCalendarToken();
      if (!calendarToken) throw new Error("Not authenticated");
      const text = await fetchAvailability(calendarToken, start, end, prefs.availabilityStart, prefs.availabilityEnd);
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error('InstaCal availability error:', err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  }

  function handleDatePickerApply(start: Date, end: Date) {
    setAvailStart(start);
    setAvailEnd(end);
    handleExportAvailability(start, end);
  }

  if (!authLoading && !user) {
    return <SignIn />;
  }

  if (user && settingsPage === "settings") {
    return (
      <SettingsPage
        onBack={() => setSettingsPage(null)}
        onNavigate={(page) => setSettingsPage(page)}
        onSignOut={() => { setUser(null); setSettingsPage(null); }}
      />
    );
  }
  if (user && settingsPage === "help") {
    return <HelpContentPage onBack={() => setSettingsPage("settings")} />;
  }
  if (user && settingsPage === "preferences") {
    return <PreferencesPage onBack={() => setSettingsPage("settings")} />;
  }
  if (user && settingsPage === "coffee") {
    return <CoffeePage onBack={() => setSettingsPage("settings")} />;
  }

  const gearButton = (
    <button
      className="gear-btn"
      aria-label="Settings"
      onClick={() => setSettingsPage("settings")}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <div className="popup-container">
      <PageHeader useLogo rightButton={gearButton} />
      <h2 className="subheading">Plan your next event</h2>
      <textarea
        ref={inputRef}
        className={`event-input ${authLoading ? "event-input-loading" : ""}`}
        placeholder="Dinner with Gabe this Monday at 6"
        readOnly={authLoading}
      />
      <div className="btn-row">
        <button
          className="add-event-btn"
          disabled={status === "loading" || authLoading}
          onClick={handleAddEvent}
        >
          {status === "loading" ? "Parsing…" : "Add Event"}
        </button>
        <button
          className="export-btn"
          disabled={authLoading}
          onClick={() => setShowDatePicker(true)}
          aria-label="Export availability"
          title="Export your availability"
        >
          {copyStatus === "copied" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          )}
        </button>
      </div>

      {copyStatus === "copied" && (
        <p className="status-msg status-success">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Availability copied!
        </p>
      )}
      {copyStatus === "error" && (
        <p className="status-msg status-error">Couldn't fetch availability.</p>
      )}
      {copyStatus === "idle" && status === "success" && (
        <p className="status-msg status-success">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Added to Calendar
        </p>
      )}
      {copyStatus === "idle" && status === "error" && (
        <p className="status-msg status-error">
          {errorMessage ?? "Something went wrong."}
        </p>
      )}

      {showDatePicker && (
        <DateRangePicker
          initialStart={availStart}
          initialEnd={availEnd}
          onApply={handleDatePickerApply}
          onCancel={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}

export default App;
