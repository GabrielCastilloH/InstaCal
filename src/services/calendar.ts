import type { ParsedEvent } from './parseEvent'
import { isAllDayEvent } from './parseEvent'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export async function createCalendarEvent(
  token: string,
  event: ParsedEvent,
  attendees?: Array<{ email: string; name: string }>,
  notifyAttendees = true
): Promise<unknown> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const allDay = isAllDayEvent(event)
  const attendeeList = attendees ?? []

  const body = allDay
    ? {
        summary: event.title,
        start: { date: event.start.slice(0, 10) },
        end: {
          date: (() => {
            const d = new Date(event.end.slice(0, 10))
            d.setDate(d.getDate() + 1)
            return d.toISOString().slice(0, 10)
          })(),
        },
        ...(event.location != null && { location: event.location }),
        ...(event.description != null && { description: event.description }),
        ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
        ...(attendeeList.length > 0 && { attendees: attendeeList.map((a) => ({ email: a.email, displayName: a.name })) }),
      }
    : {
        summary: event.title,
        start: { dateTime: event.start, timeZone },
        end: { dateTime: event.end, timeZone },
        ...(event.location != null && { location: event.location }),
        ...(event.description != null && { description: event.description }),
        ...(event.recurrence != null && { recurrence: [`RRULE:${event.recurrence}`] }),
        ...(attendeeList.length > 0 && { attendees: attendeeList.map((a) => ({ email: a.email, displayName: a.name })) }),
      }

  const sendUpdates = attendeeList.length > 0 ? (notifyAttendees ? 'all' : 'none') : 'none'
  const url = `${CALENDAR_API}?sendUpdates=${sendUpdates}`

  const response = await fetch(url, {
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
