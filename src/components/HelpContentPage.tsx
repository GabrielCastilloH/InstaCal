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
          <span className="step-text">Type what, when, and where.</span>
        </div>
        <div className="help-step">
          <span className="step-num">2</span>
          <span className="step-text">AI fills in the details.</span>
        </div>
        <div className="help-step">
          <span className="step-num">3</span>
          <span className="step-text">Hit <strong>Add Event</strong> to save it.</span>
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

      <div className="help-feature-card">
        <div className="help-feature-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div className="help-feature-body">
          <p className="help-feature-title">Export Availability</p>
          <p className="help-feature-desc">Tap the calendar icon, pick a date range, and your free slots are copied to your clipboard.</p>
        </div>
      </div>

      <div className="help-feature-card">
        <div className="help-feature-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div className="help-feature-body">
          <p className="help-feature-title">Add from Any Page</p>
          <p className="help-feature-desc">Highlight text, right-click, and choose <strong>Add to Calendar with InstaCal</strong>.</p>
        </div>
      </div>
    </div>
  )
}
