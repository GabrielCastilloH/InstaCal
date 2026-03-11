const BACKEND_URL = import.meta.env.VITE_CLOUD_FUNCTION_URL ?? 'http://localhost:5001/instacal-app/us-central1/api'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
  recurrence: string | null
  isTask: boolean
  attendees?: Array<{ email: string; name: string }>
  unknownAttendees?: string[]
}

export function isAllDayEvent(event: ParsedEvent): boolean {
  const startDate = event.start.slice(0, 10)
  const endDate = event.end.slice(0, 10)
  const startTime = event.start.slice(11, 19)
  const endTime = event.end.slice(11, 19)
  return startDate === endDate && startTime === '00:00:00' && endTime === '23:59:59'
}

export type ParseDefaults = {
  smartDefaults: boolean
  tasksAsAllDayEvents: boolean
  defaultDuration: number
  defaultStartTime: string
  defaultLocation: string
}

export type PersonContact = {
  firstName: string
  lastName: string
  email: string
}

export async function parseEvent(
  text: string,
  idToken: string,
  defaults?: ParseDefaults,
  people?: PersonContact[],
  userName?: string,
): Promise<ParsedEvent> {
  const url = `${BACKEND_URL}/parse`
  console.log('[InstaCal] parseEvent → POST', url)
  console.log('[InstaCal] idToken present:', !!idToken, '| length:', idToken?.length)
  console.log('[InstaCal] request body:', JSON.stringify({ text, defaults, people, userName }))

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      text,
      now: new Date().toISOString(),
      defaults,
      people,
      ...(userName ? { userName } : {}),
    }),
  })

  console.log('[InstaCal] response status:', response.status, response.statusText)

  if (!response.ok) {
    let message = `Server error: ${response.status}`
    try {
      const body = await response.json() as { error?: string }
      console.log('[InstaCal] error response body:', body)
      if (body.error) message = body.error
    } catch {
      const raw = await response.text().catch(() => '')
      console.log('[InstaCal] error response (raw):', raw)
    }
    throw new Error(message)
  }

  const result = await response.json() as ParsedEvent
  console.log('[InstaCal] parsed event result:', result)
  return result
}
