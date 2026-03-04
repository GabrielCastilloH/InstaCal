const FREEBUSY_API = 'https://www.googleapis.com/calendar/v3/freeBusy'

const DAY_START_HOUR = 8   // 8:00 AM
const DAY_END_HOUR = 19    // 7:00 PM

const MIN_SLOT_MINUTES = 30

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Slot { start: Date; end: Date }

function roundUpTo15(date: Date): Date {
  const ms = 15 * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

function ordinal(n: number): string {
  const v = n % 100
  const suffix = (v >= 11 && v <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  const min = m.toString().padStart(2, '0')
  return `${hour}:${min} ${period}`
}

function formatDate(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${ordinal(date.getDate())}`
}

function getTzAbbr(): string {
  try {
    // 'shortGeneric' gives "PT", "ET", etc. — falls back to 'short' ("PST", "EST") if unsupported
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortGeneric' as Intl.DateTimeFormatOptions['timeZoneName'] })
      .formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
  }
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

export async function fetchAvailability(
  googleToken: string,
  customStart?: Date,
  customEnd?: Date,
): Promise<string> {
  const now = new Date()

  const timeMin = customStart ? new Date(customStart) : new Date(now)
  timeMin.setHours(0, 0, 0, 0)

  const timeMax = customEnd ? new Date(customEnd) : new Date(timeMin)
  if (customEnd) {
    timeMax.setHours(23, 59, 59, 999)
  } else {
    timeMax.setDate(timeMax.getDate() + 7)
  }

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
    const body = await response.text().catch(() => '')
    console.error('InstaCal freeBusy error:', response.status, body)
    throw new Error(`Google Calendar API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const busy: Slot[] = (data.calendars?.primary?.busy ?? []).map(
    (b: { start: string; end: string }) => ({ start: new Date(b.start), end: new Date(b.end) })
  )

  const tzAbbr = getTzAbbr()
  const numDays = Math.round((timeMax.getTime() - timeMin.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const lines: string[] = []

  for (let i = 0; i < numDays; i++) {
    const day = new Date(timeMin)
    day.setDate(day.getDate() + i)

    const dayStart = new Date(day)
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0)

    const dayEnd = new Date(day)
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0)

    const windowStart = i === 0 && now > dayStart ? roundUpTo15(now) : dayStart
    if (windowStart >= dayEnd) continue

    const slots = freeSlots(busy, windowStart, dayEnd)
    if (slots.length === 0) continue

    const slotStr = slots
      .map(s => `${formatTime(s.start)} – ${formatTime(s.end)}`)
      .join(' and ')

    lines.push(`• ${formatDate(day)}: ${slotStr} ${tzAbbr}`)
  }

  if (lines.length === 0) return 'No availability found for the selected dates.'
  return lines.join('\n')
}
