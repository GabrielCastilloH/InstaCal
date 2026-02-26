import OpenAI from 'openai'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
}

const SYSTEM_PROMPT = `You are a calendar parsing assistant.
The user will describe a calendar event in natural language.
The current date and time is: {NOW_ISO}

Extract the event and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:
  "title":       string   — short event title, properly capitalized and grammatically clean (e.g. "Dinner with Gabe", not "dinner w/gabe")
  "start":       string   — ISO-8601 local datetime, no timezone offset (e.g. "2026-03-10T14:00:00")
  "end":         string   — ISO-8601 local datetime, no timezone offset
  "location":    string | null
  "description": string | null

Rules:
- Resolve relative expressions ("tomorrow", "next Monday", "in 3 days") using the current date above.
- Recognize day abbreviations: sun/Sun = Sunday, mon/Mon = Monday, tues/Tue = Tuesday, wed/Wed = Wednesday, thurs/Thu = Thursday, fri/Fri = Friday, sat/Sat = Saturday.
- If a time range is given (e.g. "4-6", "4-6pm", "2:30-4:30"), use it exactly — set start to the first time and end to the second time.
- If only a single time is given with no end, set end = start + 60 minutes.
- If only a date is provided (no time), set start time to 09:00 and end time to 10:00.
- If no year is mentioned, assume the nearest future occurrence.
- All times should be interpreted in 12-hour context unless clearly 24-hour (e.g. "4" = 4:00 PM if in the afternoon/evening context, "9" = 9:00 AM if in a morning context).
- Output ONLY the JSON object. Any other text will cause an error.`

function getClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey })
}

function isValidParsedEvent(obj: unknown): obj is ParsedEvent {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.title === 'string' &&
    typeof e.start === 'string' &&
    typeof e.end === 'string' &&
    (e.location === null || typeof e.location === 'string') &&
    (e.description === null || typeof e.description === 'string')
  )
}

export async function parseEventWithAI(
  input: { text: string; nowISO: string },
  apiKey: string
): Promise<ParsedEvent> {
  const client = getClient(apiKey)

  const systemPrompt = SYSTEM_PROMPT.replace('{NOW_ISO}', input.nowISO)

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.text },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`OpenAI returned invalid JSON. Raw output: ${raw}`)
  }

  if (!isValidParsedEvent(parsed)) {
    throw new Error(`OpenAI response missing required fields. Raw output: ${raw}`)
  }

  return parsed
}
