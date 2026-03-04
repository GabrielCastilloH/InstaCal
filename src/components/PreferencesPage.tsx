import { useEffect, useState } from 'react'
import PageHeader from './PageHeader'
import './PreferencesPage.css'
import {
  PREF_KEY,
  DEFAULT_DURATION,
  DEFAULT_START_TIME,
  DEFAULT_LOCATION,
  DEFAULT_AVAILABILITY_START,
  DEFAULT_AVAILABILITY_END,
  DURATION_MIN,
  DURATION_MAX,
} from '../constants'

export interface Prefs {
  autoReview: boolean
  tasksAsAllDayEvents: boolean
  smartDefaults: boolean
  defaultDuration: number
  defaultStartTime: string
  defaultLocation: string
  availabilityStart: string
  availabilityEnd: string
  notifyAttendees: boolean
}

export const DEFAULT_PREFS: Prefs = {
  autoReview: true,
  tasksAsAllDayEvents: true,
  smartDefaults: true,
  defaultDuration: DEFAULT_DURATION,
  defaultStartTime: DEFAULT_START_TIME,
  defaultLocation: DEFAULT_LOCATION,
  availabilityStart: DEFAULT_AVAILABILITY_START,
  availabilityEnd: DEFAULT_AVAILABILITY_END,
  notifyAttendees: true,
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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadPrefs().then((p) => {
      setPrefs(p)
      setLoaded(true)
    })
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
            disabled={!loaded}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="pref-row">
          <div className="pref-text">
            <span className="pref-label">Tasks as all-day events</span>
            <span className="pref-description">Tasks with deadlines are added as all-day events on their due date.</span>
          </div>
          <button
            className={`toggle ${prefs?.tasksAsAllDayEvents ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => updatePref('tasksAsAllDayEvents', !prefs?.tasksAsAllDayEvents)}
            aria-label="Toggle tasks as all-day events"
            role="switch"
            aria-checked={prefs?.tasksAsAllDayEvents ?? true}
            disabled={!loaded}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="pref-row">
          <div className="pref-text">
            <span className="pref-label">Notify attendees</span>
            <span className="pref-description">Send a Google Calendar invite email to people added to events.</span>
          </div>
          <button
            className={`toggle ${prefs?.notifyAttendees ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => updatePref('notifyAttendees', !prefs?.notifyAttendees)}
            aria-label="Toggle notify attendees"
            role="switch"
            aria-checked={prefs?.notifyAttendees ?? true}
            disabled={!loaded}
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
            disabled={!loaded}
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
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={15}
                  value={prefs?.defaultDuration ?? DEFAULT_PREFS.defaultDuration}
                  disabled={!loaded}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= DURATION_MIN && v <= DURATION_MAX) updatePref('defaultDuration', v)
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
                disabled={!loaded}
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
                disabled={!loaded}
                placeholder="TBD"
                onChange={(e) => updatePref('defaultLocation', e.target.value)}
              />
            </div>
          </div>
        )}

        <span className="pref-section-label">Availability</span>
        <div className="pref-defaults-box">
          <div className="pref-row">
            <div className="pref-text">
              <span className="pref-label">Day start</span>
            </div>
            <input
              type="time"
              className="pref-time-input"
              value={prefs?.availabilityStart ?? DEFAULT_PREFS.availabilityStart}
              disabled={!loaded}
              onChange={(e) => updatePref('availabilityStart', e.target.value)}
            />
          </div>
          <div className="pref-row">
            <div className="pref-text">
              <span className="pref-label">Day end</span>
            </div>
            <input
              type="time"
              className="pref-time-input"
              value={prefs?.availabilityEnd ?? DEFAULT_PREFS.availabilityEnd}
              disabled={!loaded}
              onChange={(e) => updatePref('availabilityEnd', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
