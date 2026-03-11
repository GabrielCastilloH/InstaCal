import { GoogleGenerativeAI } from '@google/generative-ai'

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

export type ExistingEventContext = {
  title: string
  start: string       // ISO-8601 local datetime
  end: string
  location: string | null
  description: string | null
}

const SYSTEM_PROMPT_SMART = `You are a calendar parsing assistant.
The user will describe a calendar event or task in natural language.
The current date and time is: {NOW_ISO}

Extract the event/task and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:
  "title":            string   — short event title, properly capitalized and grammatically clean (e.g. "Dinner with Gabe", not "dinner w/gabe")
  "start":            string   — ISO-8601 local datetime, no timezone offset (e.g. "2026-03-10T14:00:00")
  "end":              string   — ISO-8601 local datetime, no timezone offset
  "location":         string | null
  "description":      string | null
  "recurrence":       string | null  — RFC 5545 RRULE string if the event repeats, otherwise null
  "isTask":           boolean  — true if this is a task/assignment/deadline (things to DO), false if it's an event/activity (scheduled TIME for doing something)
  "attendees":        array of { "email": string, "name": string } — people from the known contacts list who are mentioned as attendees; empty array [] if none
  "unknownAttendees": array of strings — names of attendees NOT found in the known contacts list; empty array [] if none

{PEOPLE_RULES}

Task vs Event Detection:
- Treat as TASK (isTask: true) when:
  - Input contains deadline keywords: "due", "deadline", "by [date]", "submit by"
  - Input has action verbs without specific time: "do X", "write X", "complete X", "finish X", "review X", "submit X"
- Treat as EVENT (isTask: false) when:
  - Input specifies time: "at 6", "2-4pm", "from X to Y"
  - Input describes scheduled activities: "dinner with", "meeting", "coffee", "lunch"
  - Input is about blocking time: "work on X from 2-5pm"

{TASK_FORMATTING_RULES}

Rules:
- Resolve relative expressions ("tomorrow", "next Monday", "in 3 days") using the current date above.
- Recognize day abbreviations: sun/Sun = Sunday, mon/Mon = Monday, tues/Tue = Tuesday, wed/Wed = Wednesday, thurs/Thu = Thursday, fri/Fri = Friday, sat/Sat = Saturday.
- If a time range is given (e.g. "4-6", "4-6pm", "2:30-4:30"), use it exactly — set start to the first time and end to the second time.
- If only a single time is given with no end, infer a sensible duration based on the event type (e.g. dinner = 1.5h, coffee = 1h, meeting = 1h, workout = 1h, movie = 2h).
- If only a date is provided (no time), infer a sensible start time based on the event type (e.g. dinner = 7:00 PM, lunch = 12:00 PM, morning run = 7:00 AM, meeting = 9:00 AM).
- If no location is mentioned, set location to null.
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

const SYSTEM_PROMPT_MANUAL = `You are a calendar parsing assistant.
The user will describe a calendar event or task in natural language.
The current date and time is: {NOW_ISO}

Extract the event/task and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:
  "title":            string   — short event title, properly capitalized and grammatically clean (e.g. "Dinner with Gabe", not "dinner w/gabe")
  "start":            string   — ISO-8601 local datetime, no timezone offset (e.g. "2026-03-10T14:00:00")
  "end":              string   — ISO-8601 local datetime, no timezone offset
  "location":         string | null
  "description":      string | null
  "recurrence":       string | null  — RFC 5545 RRULE string if the event repeats, otherwise null
  "isTask":           boolean  — true if this is a task/assignment/deadline (things to DO), false if it's an event/activity (scheduled TIME for doing something)
  "attendees":        array of { "email": string, "name": string } — people from the known contacts list who are mentioned as attendees; empty array [] if none
  "unknownAttendees": array of strings — names of attendees NOT found in the known contacts list; empty array [] if none

{PEOPLE_RULES}

Task vs Event Detection:
- Treat as TASK (isTask: true) when:
  - Input contains deadline keywords: "due", "deadline", "by [date]", "submit by"
  - Input has action verbs without specific time: "do X", "write X", "complete X", "finish X", "review X", "submit X"
- Treat as EVENT (isTask: false) when:
  - Input specifies time: "at 6", "2-4pm", "from X to Y"
  - Input describes scheduled activities: "dinner with", "meeting", "coffee", "lunch"
  - Input is about blocking time: "work on X from 2-5pm"

{TASK_FORMATTING_RULES}

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

const SYSTEM_PROMPT_EDIT = `You are a calendar editing assistant.
The current date and time is: {NOW_ISO}

The user wants to modify an existing calendar event.

Existing event:
  Title:       {EXISTING_TITLE}
  Start:       {EXISTING_START}
  End:         {EXISTING_END}
  Location:    {EXISTING_LOCATION}
  Description: {EXISTING_DESCRIPTION}

Apply the user's instruction to the event above and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:
  "title":       string
  "start":       string   — ISO-8601 local datetime, no timezone offset
  "end":         string   — ISO-8601 local datetime, no timezone offset
  "location":    string | null
  "description": string | null
  "recurrence":  string | null
  "isTask":      boolean

Rules:
- Preserve every field the user did NOT mention.
- Resolve relative time expressions ("1 hour later", "push back 30 min") relative to the EXISTING event's start/end, not the current time.
- If the user says "make it 2 hours long", keep start and set end = start + 2h.
- If the user says "rename to X", only change title; keep everything else.
- If location is not mentioned, preserve the existing location exactly (including null).
- "recurrence" stays null unless the user explicitly mentions recurrence.
- "isTask" stays false unless the user explicitly changes it.
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
    (e.recurrence === null || typeof e.recurrence === 'string') &&
    typeof e.isTask === 'boolean' &&
    (e.attendees === undefined || Array.isArray(e.attendees)) &&
    (e.unknownAttendees === undefined || Array.isArray(e.unknownAttendees))
  )
}

type ParseDefaults = {
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

export async function editEventWithAI(
  input: { instruction: string; existingEvent: ExistingEventContext; nowISO: string; people?: PersonContact[] },
  apiKey: string
): Promise<ParsedEvent> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const { instruction, existingEvent, nowISO, people } = input

  let systemPrompt = SYSTEM_PROMPT_EDIT
    .replace('{NOW_ISO}', nowISO)
    .replace('{EXISTING_TITLE}', existingEvent.title)
    .replace('{EXISTING_START}', existingEvent.start)
    .replace('{EXISTING_END}', existingEvent.end)
    .replace('{EXISTING_LOCATION}', existingEvent.location ?? 'null')
    .replace('{EXISTING_DESCRIPTION}', existingEvent.description ?? 'null')

  // Always inject the attendees block so the AI can detect guest additions even with an empty people list
  const knownPeopleSection = (people && people.length > 0)
    ? `Known people (resolve their names to emails when mentioned):\n${people.map((p) => `- ${p.firstName} ${p.lastName}: ${p.email}`).join('\n')}\n`
    : 'Known people: (none saved yet)\n'

  const attendeesBlock = `
${knownPeopleSection}
IMPORTANT — if the user's instruction asks to add, invite, or include a person as a guest/attendee:
  "attendees":        array of { "email": string, "name": string } — people from Known people who were mentioned; empty array if none
  "unknownAttendees": array of strings — names to add as guests NOT found in Known people; empty array if none

Only populate these when the instruction explicitly asks to add/invite someone. Do NOT add people just because they appear in the title.
`
  systemPrompt = systemPrompt.replace(
    '- Output ONLY the JSON object. Any other text will cause an error.',
    `${attendeesBlock}- Output ONLY the JSON object. Any other text will cause an error.`
  )

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })

  const result = await model.generateContent(instruction)
  const raw = result.response.text() ?? ''

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    throw new Error(`Gemini returned invalid JSON. Raw output: ${raw}`)
  }
  if (!isValidParsedEvent(parsed)) {
    throw new Error(`Gemini response missing required fields. Raw output: ${raw}`)
  }
  return parsed
}

export async function parseEventWithAI(
  input: { text: string; nowISO: string; defaults?: ParseDefaults; people?: PersonContact[] },
  apiKey: string
): Promise<ParsedEvent> {
  const genAI = new GoogleGenerativeAI(apiKey)

  const useSmartDefaults = input.defaults?.smartDefaults !== false
  const tasksAsAllDayEvents = input.defaults?.tasksAsAllDayEvents !== false

  const taskFormattingRules = tasksAsAllDayEvents
    ? `Task Formatting (when isTask is true):
- Create an all-day event on the due date
- Title: Clean task name with smart suffix ("Homework Due" or "Submit Report" based on context)
- Start: Due date at 00:00:00
- End: Due date at 23:59:59
- Description: "Deadline: [formatted due date, e.g. February 12, 2026]"
`
    : ''

  const knownPeopleSection = (input.people && input.people.length > 0)
    ? `Known contacts:\n${input.people.map((p) => `- ${p.firstName} ${p.lastName}: ${p.email}`).join('\n')}`
    : 'Known contacts: (none)'

  const peopleRules = `${knownPeopleSection}

Attendee detection rules:
- Any person's name mentioned alongside social/work words ("with", "and", "meet", "invite", etc.) is an attendee.
- "Dinner with Gabe" → unknownAttendees: ["Gabe"]. "Coffee with Sarah and Tom" → unknownAttendees: ["Sarah", "Tom"].
- If the name matches a known contact, put them in "attendees" with their email; otherwise put the name string in "unknownAttendees".
- Always output both "attendees" and "unknownAttendees" — use [] when empty.`

  let systemPrompt: string
  if (useSmartDefaults) {
    systemPrompt = SYSTEM_PROMPT_SMART
      .replace('{NOW_ISO}', input.nowISO)
      .replace('{TASK_FORMATTING_RULES}', taskFormattingRules)
      .replace('{PEOPLE_RULES}', peopleRules)
  } else {
    const d = input.defaults!
    systemPrompt = SYSTEM_PROMPT_MANUAL
      .replace(/{NOW_ISO}/g, input.nowISO)
      .replace(/{TASK_FORMATTING_RULES}/g, taskFormattingRules)
      .replace(/{DEFAULT_START_TIME}/g, d.defaultStartTime)
      .replace(/{DEFAULT_DURATION}/g, String(d.defaultDuration))
      .replace(/{DEFAULT_LOCATION}/g, d.defaultLocation)
      .replace('{PEOPLE_RULES}', peopleRules)
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
