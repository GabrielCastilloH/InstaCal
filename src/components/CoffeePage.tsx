import PageHeader from './PageHeader'
import './CoffeePage.css'

interface CoffeePageProps {
  onBack: () => void
}

export default function CoffeePage({ onBack }: CoffeePageProps) {
  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )

  return (
    <div className="coffee-container">
      <PageHeader title="Buy us a Coffee" leftButton={backButton} />
      <p className="coffee-message">
        Thank you for your support!{' '}
        <a
          href="https://buymeacoffee.com/yhough"
          target="_blank"
          rel="noopener noreferrer"
          className="coffee-link"
        >
          Buy us a coffee ☕
        </a>
      </p>
    </div>
  )
}
