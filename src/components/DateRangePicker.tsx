import { useState } from 'react'
import './DateRangePicker.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface Props {
  initialStart: Date
  initialEnd: Date
  onApply: (start: Date, end: Date) => void
  onCancel: () => void
}

function midnight(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export default function DateRangePicker({ initialStart, initialEnd, onApply, onCancel }: Props) {
  const today = midnight(new Date())

  const [viewYear, setViewYear] = useState(initialStart.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialStart.getMonth())
  const [start, setStart] = useState<Date>(midnight(initialStart))
  const [end, setEnd] = useState<Date>(midnight(initialEnd))
  const [phase, setPhase] = useState<'start' | 'end'>('start')

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(day: Date) {
    if (phase === 'start') {
      setStart(day)
      setEnd(day)
      setPhase('end')
    } else {
      if (day >= start) {
        setEnd(day)
      } else {
        setEnd(start)
        setStart(day)
      }
      setPhase('start')
    }
  }

  const sT = start.getTime()
  const eT = end.getTime()

  function classify(day: Date) {
    const t = day.getTime()
    if (t === sT && t === eT) return 'dp-single'
    if (t === sT) return 'dp-start'
    if (t === eT) return 'dp-end'
    if (t > sT && t < eT) return 'dp-range'
    return ''
  }

  // Build grid cells
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => midnight(new Date(viewYear, viewMonth, i + 1))),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateStr = start.getTime() === end.getTime()
    ? fmt(start)
    : `${fmt(start)} - ${fmt(end)}`

  return (
    <div className="dp-overlay">
      <div className="dp-top">
        <div className="dp-nav-row">
          <button className="dp-nav" onClick={prevMonth}>‹</button>
          <span className="dp-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className="dp-nav" onClick={nextMonth}>›</button>
        </div>

        <div className="dp-day-names">
          {DAY_NAMES.map(d => <span key={d}>{d}</span>)}
        </div>

        <div className="dp-grid">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="dp-cell dp-empty" />
            const cls = ['dp-cell', classify(day), day.getTime() === today.getTime() ? 'dp-today' : ''].filter(Boolean).join(' ')
            return (
              <button key={i} className={cls} onClick={() => handleDayClick(day)}>
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      <div className="dp-footer">
        <span className="dp-range-label">
          <span className="dp-range-title">Export Availability</span>
          <span className="dp-range-dates">{dateStr}</span>
        </span>
        <div className="dp-footer-btns">
          <button className="dp-cancel" onClick={onCancel}>Cancel</button>
          <button className="dp-apply" onClick={() => onApply(start, end)}>Copy</button>
        </div>
      </div>
    </div>
  )
}
