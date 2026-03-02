import type { ParsedEvent } from './parseEvent'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export async function createCalendarEvent(token: string, event: ParsedEvent): Promise<unknown> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const body = {
    summary: event.title,
    start: { dateTime: event.start, timeZone },
    end: { dateTime: event.end, timeZone },
    ...(event.location != null && { location: event.location }),
    ...(event.description != null && { description: event.description }),
    ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
  }

  const response = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar API error ${response.status}: ${text}`)
  }

  return response.json()
}
