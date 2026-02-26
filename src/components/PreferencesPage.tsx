import { useEffect, useState } from 'react'
import PageHeader from './PageHeader'
import './PreferencesPage.css'

const PREF_KEY = 'instacal_prefs'

interface Prefs {
  autoReview: boolean
}

const DEFAULT_PREFS: Prefs = { autoReview: true }

async function loadPrefs(): Promise<Prefs> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PREF_KEY], (result) => {
      resolve({ ...DEFAULT_PREFS, ...(result[PREF_KEY] as Partial<Prefs> ?? {}) })
    })
  })
}

async function savePrefs(prefs: Prefs): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [PREF_KEY]: prefs }, resolve)
  })
}

interface PreferencesPageProps {
  onBack: () => void
}

export default function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  useEffect(() => {
    loadPrefs().then(setPrefs)
  }, [])

  async function toggle(key: keyof Prefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await savePrefs(updated)
  }

  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )

  return (
    <div className="preferences-container">
      <PageHeader title="Preferences" leftButton={backButton} />

      <div className="pref-list">
        <div className="pref-row">
          <div className="pref-text">
            <span className="pref-label">Auto-add</span>
            <span className="pref-description">Skip review and add events directly to Calendar.</span>
          </div>
          <button
            className={`toggle ${prefs.autoReview ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => toggle('autoReview')}
            aria-label="Toggle auto-add"
            role="switch"
            aria-checked={prefs.autoReview}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  )
}
