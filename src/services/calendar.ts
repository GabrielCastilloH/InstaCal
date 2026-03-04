import type { ParsedEvent } from './parseEvent'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function buildEventBody(event: ParsedEvent) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return {
    summary: event.title,
    start: { dateTime: event.start, timeZone },
    end: { dateTime: event.end, timeZone },
    ...(event.location != null && { location: event.location }),
    ...(event.description != null && { description: event.description }),
    ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
  }
}

export async function createCalendarEvent(token: string, event: ParsedEvent): Promise<unknown> {
  const response = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildEventBody(event)),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar API error ${response.status}: ${text}`)
  }

  return response.json()
}

export async function patchCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: ParsedEvent,
): Promise<unknown> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildEventBody(event)),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar API error ${response.status}: ${text}`)
  }

  return response.json()
}
