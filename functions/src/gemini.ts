import { GoogleGenerativeAI } from '@google/generative-ai'

export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
}

const SYSTEM_PROMPT_SMART = `You are a calendar parsing assistant.
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
- If only a single time is given with no end, infer a sensible duration based on the event type (e.g. dinner = 1.5h, coffee = 1h, meeting = 1h, workout = 1h, movie = 2h).
- If only a date is provided (no time), infer a sensible start time based on the event type (e.g. dinner = 7:00 PM, lunch = 12:00 PM, morning run = 7:00 AM, meeting = 9:00 AM).
- If no location is mentioned, set location to null.
- If no year is mentioned, assume the nearest future occurrence.
- All times should be interpreted in 12-hour context unless clearly 24-hour.
- Output ONLY the JSON object. Any other text will cause an error.`

const SYSTEM_PROMPT_MANUAL = `You are a calendar parsing assistant.
The user will describe a calendar event in natural language.
The current date and time is: {NOW_ISO}

Extract the event and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:
  "title":       string   — short event title, properly capitalized and grammatically clean (e.g. "Dinner with Gabe", not "dinner w/gabe")
  "start":       string   — ISO-8601 local datetime, no timezone offset (e.g. "2026-03-10T14:00:00")
  "end":         string   — ISO-8601 local datetime, no timezone offset
  "location":    string | null
  "description": string | null

User defaults (use these when the event description does not specify):
  Default start time: {DEFAULT_START_TIME}
  Default duration:   {DEFAULT_DURATION} minutes
  Default location:   {DEFAULT_LOCATION}

Rules:
- Resolve relative expressions ("tomorrow", "next Monday", "in 3 days") using the current date above.
- Recognize day abbreviations: sun/Sun = Sunday, mon/Mon = Monday, tues/Tue = Tuesday, wed/Wed = Wednesday, thurs/Thu = Thursday, fri/Fri = Friday, sat/Sat = Saturday.
- If a time range is given (e.g. "4-6", "4-6pm", "2:30-4:30"), use it exactly — set start to the first time and end to the second time.
- If only a single time is given with no end, set end = start + {DEFAULT_DURATION} minutes.
- If only a date is provided (no time), use the default start time above and set end = start + {DEFAULT_DURATION} minutes.
- If no location is mentioned, use the default location above.
- If no year is mentioned, assume the nearest future occurrence.
- All times should be interpreted in 12-hour context unless clearly 24-hour.
- Output ONLY the JSON object. Any other text will cause an error.`

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

type ParseDefaults = {
  smartDefaults: boolean
  defaultDuration: number
  defaultStartTime: string
  defaultLocation: string
}

export async function parseEventWithAI(
  input: { text: string; nowISO: string; defaults?: ParseDefaults },
  apiKey: string
): Promise<ParsedEvent> {
  const genAI = new GoogleGenerativeAI(apiKey)

  const useSmartDefaults = input.defaults?.smartDefaults !== false

  let systemPrompt: string
  if (useSmartDefaults) {
    systemPrompt = SYSTEM_PROMPT_SMART.replace('{NOW_ISO}', input.nowISO)
  } else {
    const d = input.defaults!
    systemPrompt = SYSTEM_PROMPT_MANUAL
      .replace(/{NOW_ISO}/g, input.nowISO)
      .replace(/{DEFAULT_START_TIME}/g, d.defaultStartTime)
      .replace(/{DEFAULT_DURATION}/g, String(d.defaultDuration))
      .replace(/{DEFAULT_LOCATION}/g, d.defaultLocation)
  }

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
