import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { auth } from "./lib/firebase";
import SettingsPage from "./components/SettingsPage";
import HelpContentPage from "./components/HelpContentPage";
import PreferencesPage from "./components/PreferencesPage";
import CoffeePage from "./components/CoffeePage";
import PageHeader from "./components/PageHeader";
import SignIn from "./components/SignIn";
import { parseEvent, type ParsedEvent } from "./services/parseEvent";
import { getFirebaseIdToken, getGoogleCalendarToken, setGoogleCalendarToken } from "./services/auth";
import { createCalendarEvent } from "./services/calendar";
import "./App.css";

const PREF_KEY = "instacal_prefs";

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SettingsPageType = "settings" | "help" | "preferences" | "coffee";

function App() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [user, setUser] = useState(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [autoReview, setAutoReview] = useState(true);
  const [pendingEvent, setPendingEvent] = useState<ParsedEvent | null>(null);
  const [settingsPage, setSettingsPage] = useState<SettingsPageType | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Complete sign-in if the background script stored a pending OAuth token
  useEffect(() => {
    chrome.storage.local.get(["instacal_pending_auth"], async (result) => {
      const pending = result.instacal_pending_auth as { accessToken?: string; expiresIn?: number; error?: string } | undefined;
      if (!pending) return;

      await chrome.storage.local.remove("instacal_pending_auth");

      if (pending.error) {
        console.error("[App] Auth failed in background:", pending.error);
        return;
      }

      if (pending.accessToken) {
        try {
          const credential = GoogleAuthProvider.credential(null, pending.accessToken);
          const userResult = await signInWithCredential(auth, credential);
          if (userResult.user) {
            await setGoogleCalendarToken(pending.accessToken, pending.expiresIn);
          }
        } catch (err) {
          console.error("[App] signInWithCredential failed:", err);
        }
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get([PREF_KEY], (result) => {
      const prefs = result[PREF_KEY] as { autoReview?: boolean } | undefined;
      if (prefs && typeof prefs.autoReview === "boolean") {
        setAutoReview(prefs.autoReview);
      }
    });
  }, []);

  // Re-load prefs when returning from settings so toggle changes apply immediately
  useEffect(() => {
    if (!settingsPage) {
      inputRef.current?.focus();
      chrome.storage.local.get([PREF_KEY], (result) => {
        const prefs = result[PREF_KEY] as { autoReview?: boolean } | undefined;
        if (prefs && typeof prefs.autoReview === "boolean") {
          setAutoReview(prefs.autoReview);
        }
      });
    }
  }, [settingsPage]);

  async function handleAddEvent() {
    const text = inputRef.current?.value.trim() ?? "";
    if (!text) return;

    setStatus("loading");
    setErrorMessage(undefined);

    try {
      const idToken = await getFirebaseIdToken();
      const calendarToken = await getGoogleCalendarToken();
      if (!idToken || !calendarToken) {
        throw new Error("Not authenticated");
      }
      const event = await parseEvent(text, idToken);

      if (autoReview) {
        await createCalendarEvent(calendarToken, event);
        setStatus("success");
      } else {
        // Show review step before adding
        setPendingEvent(event);
        setStatus("idle");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }

  async function handleConfirmEvent() {
    if (!pendingEvent) return;
    setStatus("loading");
    try {
      const calendarToken = await getGoogleCalendarToken();
      if (!calendarToken) throw new Error("Not authenticated");
      await createCalendarEvent(calendarToken, pendingEvent);
      setPendingEvent(null);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }

  function handleEditEvent() {
    setPendingEvent(null);
    setStatus("idle");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (!authLoading && !user) {
    return <SignIn />;
  }

  if (user && settingsPage === "settings") {
    return (
      <SettingsPage
        onBack={() => setSettingsPage(null)}
        onNavigate={(page) => setSettingsPage(page)}
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

  if (pendingEvent) {
    return (
      <div className="popup-container">
        <PageHeader useLogo rightButton={gearButton} />
        <h2 className="subheading">does this look right?</h2>
        <div className="review-card">
          <p className="review-title">{pendingEvent.title}</p>
          <p className="review-time">{formatEventTime(pendingEvent.start)} → {formatEventTime(pendingEvent.end)}</p>
          {pendingEvent.location && (
            <p className="review-location">{pendingEvent.location}</p>
          )}
        </div>
        <div className="review-actions">
          <button className="review-edit-btn" onClick={handleEditEvent}>Edit</button>
          <button
            className="review-confirm-btn"
            disabled={status === "loading"}
            onClick={handleConfirmEvent}
          >
            {status === "loading" ? "Adding…" : "Confirm"}
          </button>
        </div>
        {status === "error" && (
          <p className="status-msg status-error">{errorMessage ?? "Something went wrong."}</p>
        )}
      </div>
    );
  }

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
      <button
        className="add-event-btn"
        disabled={status === "loading" || authLoading}
        onClick={handleAddEvent}
      >
        {status === "loading" ? "Parsing…" : "Add Event"}
      </button>

      {status === "success" && (
        <p className="status-msg status-success">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Added to Calendar
        </p>
      )}
      {status === "error" && (
        <p className="status-msg status-error">
          {errorMessage ?? "Something went wrong."}
        </p>
      )}
    </div>
  );
}

export default App;
