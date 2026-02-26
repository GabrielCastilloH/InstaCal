import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { clearGoogleCalendarToken } from "../services/auth";
import PageHeader from "./PageHeader";
import SettingsFooter from "./SettingsFooter";
import "./SettingsPage.css";

type SettingsSubPage = "help" | "preferences" | "coffee";

interface SettingsPageProps {
  onBack: () => void;
  onNavigate: (page: SettingsSubPage) => void;
}

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const PreferencesIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
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
);

const CoffeeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

const ChevronRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function SettingsPage({
  onBack,
  onNavigate,
}: SettingsPageProps) {
  async function handleSignOut() {
    await clearGoogleCalendarToken();
    await signOut(auth);
    onBack();
  }

  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Back">
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
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );

  return (
    <div className="settings-container">
      <PageHeader title="Settings" leftButton={backButton} />

      <div className="settings-table">
        <button className="settings-row" onClick={() => onNavigate("help")}>
          <span className="settings-row-icon">
            <InfoIcon />
          </span>
          <span className="settings-row-label">Help</span>
          <span className="settings-row-chevron">
            <ChevronRight />
          </span>
        </button>
        <button
          className="settings-row"
          onClick={() => onNavigate("preferences")}
        >
          <span className="settings-row-icon">
            <PreferencesIcon />
          </span>
          <span className="settings-row-label">Preferences</span>
          <span className="settings-row-chevron">
            <ChevronRight />
          </span>
        </button>
        <button className="settings-row" onClick={() => onNavigate("coffee")}>
          <span className="settings-row-icon">
            <CoffeeIcon />
          </span>
          <span className="settings-row-label">Buy us a Coffee</span>
          <span className="settings-row-chevron">
            <ChevronRight />
          </span>
        </button>
        <button className="settings-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      <SettingsFooter />
    </div>
  );
}
