import logoLarge from './assets/logo-large.svg'
import './HelpPage.css'

interface HelpPageProps {
  onBack: () => void
}

export default function HelpPage({ onBack }: HelpPageProps) {
  return (
    <div className="help-container">

      <button className="back-btn" onClick={onBack} aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <img src={logoLarge} alt="InstaCal" className="help-logo" />

      <p className="help-tagline">AI-powered event scheduling</p>

      <div className="help-section">
        <div className="help-step">
          <span className="step-num">1</span>
          <span className="step-text">Describe your event naturally: include what, when, and where if you know it.</span>
        </div>
        <div className="help-step">
          <span className="step-num">2</span>
          <span className="step-text">AI figures out the details and fills in anything missing.</span>
        </div>
        <div className="help-step">
          <span className="step-num">3</span>
          <span className="step-text">Hit <strong>Add Event</strong> and it lands straight in Google Calendar.</span>
        </div>
      </div>

      <div className="help-examples">
        <p className="examples-label">Try something like</p>
        <ul>
          <li>"Dentist appointment in 3 days at 2pm"</li>
          <li>"Team lunch Friday at noon at CTB"</li>
          <li>"meet w/ yaelin tmw, 4, olin lib"</li>
        </ul>
      </div>

      <div className="help-contact">
        <p className="examples-label">Bugs or feedback?</p>
        <div className="contact-links">
          <a href="mailto:yh2299@cornell.edu">yh2299@cornell.edu</a>
          <a href="mailto:gac232@cornell.edu">gac232@cornell.edu</a>
        </div>
      </div>

    </div>
  )
}
