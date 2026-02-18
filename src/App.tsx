import { useEffect, useRef } from 'react'
import './App.css'

function App() {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="popup-container">
      <h1>InstaCal</h1>
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
