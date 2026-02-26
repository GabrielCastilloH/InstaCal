import { useEffect, useState } from 'react'
import PageHeader from './PageHeader'
import './PreferencesPage.css'

export const PREF_KEY = 'instacal_prefs'

export interface Prefs {
  autoReview: boolean
  smartDefaults: boolean
  defaultDuration: number
  defaultStartTime: string
  defaultLocation: string
}

export const DEFAULT_PREFS: Prefs = {
  autoReview: true,
  smartDefaults: true,
  defaultDuration: 60,
  defaultStartTime: '12:00',
  defaultLocation: 'TBD',
}

export async function loadPrefs(): Promise<Prefs> {
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
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  useEffect(() => {
    loadPrefs().then(setPrefs)
  }, [])

  async function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    if (!prefs) return
    const updated = { ...prefs, [key]: value }
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
            className={`toggle ${prefs?.autoReview ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => updatePref('autoReview', !prefs?.autoReview)}
            aria-label="Toggle auto-add"
            role="switch"
            aria-checked={prefs?.autoReview ?? false}
            disabled={prefs === null}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="pref-row pref-row-no-border">
          <div className="pref-text">
            <span className="pref-label">Smart defaults</span>
            <span className="pref-description">AI picks time and duration based on the event type.</span>
          </div>
          <button
            className={`toggle ${prefs?.smartDefaults ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => updatePref('smartDefaults', !prefs?.smartDefaults)}
            aria-label="Toggle smart defaults"
            role="switch"
            aria-checked={prefs?.smartDefaults ?? true}
            disabled={prefs === null}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {!prefs?.smartDefaults && (
          <div className="pref-defaults-box">
            <div className="pref-row">
              <div className="pref-text">
                <span className="pref-label">Default duration</span>
              </div>
              <div className="pref-input-group">
                <input
                  type="number"
                  className="pref-number-input"
                  min={15}
                  max={480}
                  step={15}
                  value={prefs?.defaultDuration ?? DEFAULT_PREFS.defaultDuration}
                  disabled={prefs === null}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 15 && v <= 480) updatePref('defaultDuration', v)
                  }}
                />
                <span className="pref-input-suffix">min</span>
              </div>
            </div>

            <div className="pref-row">
              <div className="pref-text">
                <span className="pref-label">Default start time</span>
              </div>
              <input
                type="time"
                className="pref-time-input"
                value={prefs?.defaultStartTime ?? DEFAULT_PREFS.defaultStartTime}
                disabled={prefs === null}
                onChange={(e) => updatePref('defaultStartTime', e.target.value)}
              />
            </div>

            <div className="pref-row">
              <div className="pref-text">
                <span className="pref-label">Default location</span>
              </div>
              <input
                type="text"
                className="pref-text-input"
                value={prefs?.defaultLocation ?? DEFAULT_PREFS.defaultLocation}
                disabled={prefs === null}
                placeholder="TBD"
                onChange={(e) => updatePref('defaultLocation', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
