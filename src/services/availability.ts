import { DEFAULT_AVAILABILITY_START, DEFAULT_AVAILABILITY_END } from '../constants'

const FREEBUSY_API = 'https://www.googleapis.com/calendar/v3/freeBusy'

function parseHHMM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number)
  return { h: h ?? 8, m: m ?? 0 }
}

const MIN_SLOT_MINUTES = 20
const EVENT_BUFFER_MS = 10 * 60_000

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
  dayStartTime = DEFAULT_AVAILABILITY_START,
  dayEndTime = DEFAULT_AVAILABILITY_END,
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

  console.log('[InstaCal] fetchAvailability start', {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    dayStartTime,
    dayEndTime,
    tokenPrefix: googleToken.slice(0, 10) + '…',
  })

  const requestBody = {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    items: [{ id: 'primary' }],
  }

  const response = await fetch(FREEBUSY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  console.log('[InstaCal] freeBusy response status:', response.status)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('[InstaCal] freeBusy error body:', body)
    throw new Error(`Google Calendar API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  console.log('[InstaCal] freeBusy raw data:', JSON.stringify(data))

  const busy: Slot[] = (data.calendars?.primary?.busy ?? []).map(
    (b: { start: string; end: string }) => ({
      start: new Date(new Date(b.start).getTime() - EVENT_BUFFER_MS),
      end: new Date(new Date(b.end).getTime() + EVENT_BUFFER_MS),
    })
  )
  console.log('[InstaCal] busy slots (buffered):', busy.map(b => ({ start: b.start.toISOString(), end: b.end.toISOString() })))

  const tzAbbr = getTzAbbr()
  const numDays = Math.round((timeMax.getTime() - timeMin.getTime()) / (24 * 60 * 60 * 1000))
  const lines: string[] = []

  console.log('[InstaCal] processing', numDays, 'days, tz:', tzAbbr)

  for (let i = 0; i < numDays; i++) {
    const day = new Date(timeMin)
    day.setDate(day.getDate() + i)

    const { h: sh, m: sm } = parseHHMM(dayStartTime)
    const dayStart = new Date(day)
    dayStart.setHours(sh, sm, 0, 0)

    const { h: eh, m: em } = parseHHMM(dayEndTime)
    const dayEnd = new Date(day)
    dayEnd.setHours(eh, em, 0, 0)

    const windowStart = i === 0 && now > dayStart ? roundUpTo15(now) : dayStart
    if (windowStart >= dayEnd) {
      console.log('[InstaCal] day', i, 'skipped: windowStart >= dayEnd', windowStart.toISOString(), dayEnd.toISOString())
      continue
    }

    const slots = freeSlots(busy, windowStart, dayEnd)
    console.log('[InstaCal] day', i, formatDate(day), '- slots:', slots.length, slots.map(s => `${formatTime(s.start)}-${formatTime(s.end)}`))
    if (slots.length === 0) continue

    const slotStr = slots
      .map(s => `${formatTime(s.start)} – ${formatTime(s.end)}`)
      .join(' and ')

    lines.push(`• ${formatDate(day)}: ${slotStr} ${tzAbbr}`)
  }

  console.log('[InstaCal] fetchAvailability result lines:', lines.length)
  if (lines.length === 0) return 'No availability found for the selected dates.'
  return lines.join('\n')
}
