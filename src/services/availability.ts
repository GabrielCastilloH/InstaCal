const FREEBUSY_API = 'https://www.googleapis.com/calendar/v3/freeBusy'

// Availability window shown per day
const DAY_START_HOUR = 9   // 9:00 am
const DAY_END_HOUR = 18    // 6:00 pm

// Minimum free block to include (minutes)
const MIN_SLOT_MINUTES = 30

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Slot { start: Date; end: Date }

function roundUpTo15(date: Date): Date {
  const ms = 15 * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  const min = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`
  return `${hour}${min}${period}`
}

function freeSlots(busy: Slot[], windowStart: Date, windowEnd: Date): Slot[] {
  const sorted = busy
    .filter(b => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const slots: Slot[] = []
  let cursor = windowStart

  for (const b of sorted) {
    if (b.start > cursor) {
      const end = b.start < windowEnd ? b.start : windowEnd
      if (end.getTime() - cursor.getTime() >= MIN_SLOT_MINUTES * 60_000) {
        slots.push({ start: cursor, end })
      }
    }
    if (b.end > cursor) cursor = b.end
  }

  if (cursor < windowEnd && windowEnd.getTime() - cursor.getTime() >= MIN_SLOT_MINUTES * 60_000) {
    slots.push({ start: cursor, end: windowEnd })
  }

  return slots
}

export async function fetchAvailability(googleToken: string): Promise<string> {
  const now = new Date()

  const timeMin = new Date(now)
  timeMin.setHours(0, 0, 0, 0)

  const timeMax = new Date(timeMin)
  timeMax.setDate(timeMax.getDate() + 7)

  const response = await fetch(FREEBUSY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: 'primary' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Google Calendar API error ${response.status}`)
  }

  const data = await response.json()
  const busy: Slot[] = (data.calendars?.primary?.busy ?? []).map(
    (b: { start: string; end: string }) => ({ start: new Date(b.start), end: new Date(b.end) })
  )

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const lines: string[] = []

  for (let i = 0; i < 7; i++) {
    const day = new Date(timeMin)
    day.setDate(day.getDate() + i)

    const dayStart = new Date(day)
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0)

    const dayEnd = new Date(day)
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0)

    // For today, start from the next 15-min mark if we're already past DAY_START_HOUR
    const windowStart = i === 0 && now > dayStart ? roundUpTo15(now) : dayStart

    if (windowStart >= dayEnd) continue

    const slots = freeSlots(busy, windowStart, dayEnd)
    if (slots.length === 0) continue

    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    let label: string
    if (d.getTime() === today.getTime()) label = 'Today'
    else if (d.getTime() === tomorrow.getTime()) label = 'Tomorrow'
    else label = DAY_NAMES[day.getDay()]

    const slotStr = slots.map(s => `${formatTime(s.start)}-${formatTime(s.end)}`).join(', ')
    lines.push(`${label}: ${slotStr}`)
  }

  if (lines.length === 0) return 'No availability found for the next 7 days.'
  return lines.join('\n')
}
