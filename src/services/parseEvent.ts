const BACKEND_URL = import.meta.env.VITE_CLOUD_FUNCTION_URL ?? 'http://localhost:5001/instacal-app/us-central1/api'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
  recurrence: string | null
}

export type ParseDefaults = {
  smartDefaults: boolean
  defaultDuration: number
  defaultStartTime: string
  defaultLocation: string
}

export async function parseEvent(text: string, idToken: string, defaults?: ParseDefaults): Promise<ParsedEvent> {
  const response = await fetch(`${BACKEND_URL}/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      text,
      now: new Date().toISOString(),
      defaults,
    }),
  })

  if (!response.ok) {
    let message = `Server error: ${response.status}`
    try {
      const body = await response.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // response body wasn't JSON — keep the status-based message
    }
    throw new Error(message)
  }

  return response.json() as Promise<ParsedEvent>
}
