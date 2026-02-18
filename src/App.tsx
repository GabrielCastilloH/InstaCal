import { useEffect, useRef, useState } from 'react'
import logoLarge from './assets/logo-large.svg'
import HelpPage from './HelpPage'
import './App.css'

function App() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (!showHelp) {
      inputRef.current?.focus()
    }
  }, [showHelp])

  if (showHelp) {
    return <HelpPage onBack={() => setShowHelp(false)} />
  }

  return (
    <div className="popup-container">
      <button className="gear-btn" aria-label="Settings" onClick={() => setShowHelp(true)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
      <img src={logoLarge} alt="InstaCal" className="logo" />
      <h2 className="subheading">Plan your next event</h2>
      <textarea
        ref={inputRef}
        className="event-input"
        placeholder="Dinner with Gabe this Monday at 6"
      />
      <button className="add-event-btn">Add Event</button>
    </div>
  )
}

export default App
