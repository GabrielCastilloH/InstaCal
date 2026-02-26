import PageHeader from './PageHeader'
import './PreferencesPage.css'

interface PreferencesPageProps {
  onBack: () => void
}

export default function PreferencesPage({ onBack }: PreferencesPageProps) {
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
      <p className="preferences-placeholder">Preferences coming soon.</p>
    </div>
  )
}
