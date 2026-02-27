import { GoogleGenerativeAI } from '@google/generative-ai'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
  recurrence: string | null
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
  "recurrence":  string | null  — RFC 5545 RRULE string if the event repeats, otherwise null

Rules:
- Resolve relative expressions ("tomorrow", "next Monday", "in 3 days") using the current date above.
- Recognize day abbreviations: sun/Sun = Sunday, mon/Mon = Monday, tues/Tue = Tuesday, wed/Wed = Wednesday, thurs/Thu = Thursday, fri/Fri = Friday, sat/Sat = Saturday.
- If a time range is given (e.g. "4-6", "4-6pm", "2:30-4:30"), use it exactly — set start to the first time and end to the second time.
- If only a single time is given with no end, set end = start + 60 minutes.
- If only a date is provided (no time), set start time to 09:00 and end time to 10:00.
- If no year is mentioned, assume the nearest future occurrence.
- All times should be interpreted in 12-hour context unless clearly 24-hour (e.g. "4" = 4:00 PM if in the afternoon/evening context, "9" = 9:00 AM if in a morning context).
- For recurring events, set "recurrence" to a valid RRULE string (without the "RRULE:" prefix — just the rule itself, e.g. "FREQ=WEEKLY;BYDAY=TU"). For non-recurring events, set "recurrence" to null.
- Recurrence examples:
    "every Tuesday"                  → "FREQ=WEEKLY;BYDAY=TU"
    "every Monday and Wednesday"     → "FREQ=WEEKLY;BYDAY=MO,WE"
    "every weekday"                  → "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    "every weekend"                  → "FREQ=WEEKLY;BYDAY=SA,SU"
    "every day" / "daily"            → "FREQ=DAILY"
    "every week" / "weekly"          → "FREQ=WEEKLY"
    "every month" / "monthly"        → "FREQ=MONTHLY"
    "every year" / "annually"        → "FREQ=YEARLY"
    "every other week"               → "FREQ=WEEKLY;INTERVAL=2"
    "every two weeks"                → "FREQ=WEEKLY;INTERVAL=2"
    "every first Monday of the month"→ "FREQ=MONTHLY;BYDAY=1MO"
    "every last Friday"              → "FREQ=MONTHLY;BYDAY=-1FR"
- For "start", use the first (nearest future) occurrence of the recurring day/time.
- Output ONLY the JSON object. Any other text will cause an error.`

function isValidParsedEvent(obj: unknown): obj is ParsedEvent {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.title === 'string' &&
    typeof e.start === 'string' &&
    typeof e.end === 'string' &&
    (e.location === null || typeof e.location === 'string') &&
    (e.description === null || typeof e.description === 'string') &&
    (e.recurrence === null || typeof e.recurrence === 'string')
  )
}

export async function parseEventWithAI(
  input: { text: string; nowISO: string },
  apiKey: string
): Promise<ParsedEvent> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const systemPrompt = SYSTEM_PROMPT.replace('{NOW_ISO}', input.nowISO)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent(input.text)
  const response = result.response
  const raw = response.text() ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Gemini returned invalid JSON. Raw output: ${raw}`)
  }

  if (!isValidParsedEvent(parsed)) {
    throw new Error(`Gemini response missing required fields. Raw output: ${raw}`)
  }

  return parsed
}
