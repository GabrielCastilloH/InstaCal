import { useEffect, useState } from 'react'
import PageHeader from './PageHeader'
import './PeoplePage.css'
import { MAX_PEOPLE } from '../constants'
import { type Person, loadPeople, savePeople } from '../utils/people'
import { savePeopleToFirestore } from '../services/firestorePeople'

export type { Person }
export { loadPeople, savePeople }

interface PeoplePageProps {
  onBack: () => void
  uid: string
}

export default function PeoplePage({ onBack, uid }: PeoplePageProps) {
  const [people, setPeople] = useState<Person[]>([])
  const [showForm, setShowForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadPeople().then(setPeople)
  }, [])

  async function handleAdd() {
    const trimFirst = firstName.trim()
    const trimLast = lastName.trim()
    const trimEmail = email.trim()
    if (!trimFirst || !trimEmail) return

    const newPerson: Person = {
      id: crypto.randomUUID(),
      firstName: trimFirst,
      lastName: trimLast,
      email: trimEmail,
      lastUsed: Date.now(),
    }
    const updated = [...people, newPerson]
    setPeople(updated)
    await savePeople(updated)
    savePeopleToFirestore(uid, updated).catch(() => {})
    setFirstName('')
    setLastName('')
    setEmail('')
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    const updated = people.filter((p) => p.id !== id)
    setPeople(updated)
    await savePeople(updated)
    savePeopleToFirestore(uid, updated).catch(() => {})
  }

  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  const counterChip = (
    <span className="people-counter">{people.length} / {MAX_PEOPLE}</span>
  )

  return (
    <div className="people-container">
      <PageHeader title="People" leftButton={backButton} rightButton={counterChip} />

      <div className="people-list">
        {people.map((p) => (
          <div key={p.id} className="person-card">
            <div className="person-info">
              <span className="person-name">{p.firstName} {p.lastName}</span>
              <span className="person-email">{p.email}</span>
            </div>
            <button
              className="person-delete-btn"
              onClick={() => handleDelete(p.id)}
              aria-label={`Remove ${p.firstName} ${p.lastName}`}
            >
              ×
            </button>
          </div>
        ))}

        {people.length === 0 && !showForm && (
          <p className="people-empty">No people yet. Add up to {MAX_PEOPLE} contacts.</p>
        )}
      </div>

      {showForm ? (
        <div className="people-form">
          <div className="people-form-row">
            <input
              className="people-input"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
            <input
              className="people-input"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            className="people-input people-input-full"
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="people-form-actions">
            <button
              className="people-btn-cancel"
              onClick={() => { setShowForm(false); setFirstName(''); setLastName(''); setEmail('') }}
            >
              Cancel
            </button>
            <button
              className="people-btn-save"
              onClick={handleAdd}
              disabled={!firstName.trim() || !email.trim()}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        people.length < MAX_PEOPLE && (
          <button className="people-add-btn" onClick={() => setShowForm(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add person
          </button>
        )
      )}
    </div>
  )
}
