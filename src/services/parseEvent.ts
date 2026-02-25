const BACKEND_URL = 'http://localhost:3000'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
}

export async function parseEvent(text: string): Promise<ParsedEvent> {
  const response = await fetch(`${BACKEND_URL}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, now: new Date().toISOString() }),
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
