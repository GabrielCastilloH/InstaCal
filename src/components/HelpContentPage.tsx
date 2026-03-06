import PageHeader from './PageHeader'
import './HelpContentPage.css'

interface HelpContentPageProps {
  onBack: () => void
}

export default function HelpContentPage({ onBack }: HelpContentPageProps) {
  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )

  return (
    <div className="help-container">
      <PageHeader title="Help" leftButton={backButton} />

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
          <li>Dentist appointment in 3 days at 2pm</li>
          <li>Team lunch Friday at noon at CTB</li>
          <li>meet w/ yaelin tmw, 4, olin lib</li>
        </ul>
      </div>

      <div className="help-divider" />

      <div className="help-section">
        <p className="help-feature-label">Export Availability</p>
        <div className="help-step">
          <span className="step-num">1</span>
          <span className="step-text">Tap the <strong>calendar icon</strong> next to Add Event.</span>
        </div>
        <div className="help-step">
          <span className="step-num">2</span>
          <span className="step-text">Pick a date range to check.</span>
        </div>
        <div className="help-step">
          <span className="step-num">3</span>
          <span className="step-text">Your free slots are copied to your clipboard, ready to paste anywhere.</span>
        </div>
      </div>

      <div className="help-divider" />

      <div className="help-section">
        <p className="help-feature-label">Add from Any Page</p>
        <div className="help-step">
          <span className="step-num">1</span>
          <span className="step-text">Highlight any text on a webpage (e.g. an event description).</span>
        </div>
        <div className="help-step">
          <span className="step-num">2</span>
          <span className="step-text">Right-click and choose <strong>Add to Calendar with InstaCal</strong>.</span>
        </div>
        <div className="help-step">
          <span className="step-num">3</span>
          <span className="step-text">InstaCal opens with the details pre-filled, ready to review and add.</span>
        </div>
      </div>
    </div>
  )
}
