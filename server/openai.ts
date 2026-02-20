export type ParsedEvent = {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
}

export async function parseEventWithAI(input: {
  text: string
  nowISO: string
}): Promise<ParsedEvent> {
  // Mock — OpenAI call goes here
  console.log(`[parseEventWithAI] text="${input.text}" now="${input.nowISO}"`)

  return {
    title: 'Stub Event',
    start: '2026-02-25T18:00:00',
    end: '2026-02-25T19:00:00',
    location: null,
    description: null,
  }
}
