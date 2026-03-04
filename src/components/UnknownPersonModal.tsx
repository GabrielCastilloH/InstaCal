import { useState } from 'react'
import './UnknownPersonModal.css'
import { MAX_PEOPLE } from '../constants'

interface UnknownPersonModalProps {
  name: string
  peopleCount: number
  onIgnore: () => void
  onAdd: (email: string, saveToDefaults: boolean) => void
}

export default function UnknownPersonModal({
  name,
  peopleCount,
  onIgnore,
  onAdd,
}: UnknownPersonModalProps) {
  const [email, setEmail] = useState('')
  const isFull = peopleCount >= MAX_PEOPLE
  const [saveToDefaults, setSaveToDefaults] = useState(!isFull)

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3 className="modal-heading">Invite {name}?</h3>

        <input
          className="modal-email-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <label className="modal-checkbox-row">
          <input
            type="checkbox"
            checked={saveToDefaults}
            onChange={(e) => setSaveToDefaults(e.target.checked)}
            disabled={isFull && !saveToDefaults}
          />
          <span className="modal-checkbox-label">Add {name} to People</span>
        </label>

        {saveToDefaults && isFull && (
          <p className="modal-eviction-note">Least recently used contact will be removed</p>
        )}

        <div className="modal-actions">
          <button className="modal-btn-ignore" onClick={onIgnore}>
            Ignore
          </button>
          <button
            className="modal-btn-add"
            onClick={() => onAdd(email.trim(), saveToDefaults)}
            disabled={!email.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
