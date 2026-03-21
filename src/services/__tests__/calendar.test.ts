import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCalendarEvent } from '../../services/calendar'
import type { ParsedEvent } from '../../services/parseEvent'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function timedEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    title: 'Team Meeting',
    start: '2024-03-20T10:00:00',
    end: '2024-03-20T11:00:00',
    location: null,
    description: null,
    recurrence: null,
    isTask: false,
    ...overrides,
  }
}

function allDayEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    title: 'Holiday',
    start: '2024-03-20T00:00:00',
    end: '2024-03-20T23:59:59',
    location: null,
    description: null,
    recurrence: null,
    isTask: false,
    ...overrides,
  }
}

function mockOk() {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ id: 'event-123' }),
    text: () => Promise.resolve(''),
  } as Response)
}

describe('createCalendarEvent', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // ─── Request structure ────────────────────────────────────────────────────

  it('POSTs to the Calendar API with the auth token', async () => {
    mockOk()
    await createCalendarEvent('my-token', timedEvent())
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(CALENDAR_API),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      }),
    )
  })

  // ─── Timed events ─────────────────────────────────────────────────────────

  it('sends dateTime format for a timed event', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent())
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.summary).toBe('Team Meeting')
    expect(body.start.dateTime).toBe('2024-03-20T10:00:00')
    expect(body.end.dateTime).toBe('2024-03-20T11:00:00')
    expect(body.start.timeZone).toBeDefined()
    expect(body.start.date).toBeUndefined()
  })

  it('includes optional location when present', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent({ location: 'Conference Room A' }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.location).toBe('Conference Room A')
  })

  it('omits location key when null', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent({ location: null }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).not.toHaveProperty('location')
  })

  it('includes description when present', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent({ description: 'Quarterly review' }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.description).toBe('Quarterly review')
  })

  // ─── All-day events ───────────────────────────────────────────────────────

  it('sends date-only format for an all-day event', async () => {
    mockOk()
    await createCalendarEvent('token', allDayEvent())
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.start.date).toBe('2024-03-20')
    expect(body.start.dateTime).toBeUndefined()
    expect(body.start.timeZone).toBeUndefined()
  })

  it('advances the end date by one day for all-day events (Google Calendar convention)', async () => {
    mockOk()
    await createCalendarEvent('token', allDayEvent())
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.end.date).toBe('2024-03-21')
  })

  // ─── Recurrence ───────────────────────────────────────────────────────────

  it('wraps recurrence string in RRULE: prefix', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent({ recurrence: 'FREQ=WEEKLY;BYDAY=WE' }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=WE'])
  })

  it('omits recurrence key when null', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent({ recurrence: null }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).not.toHaveProperty('recurrence')
  })

  // ─── Attendees & notifications ────────────────────────────────────────────

  it('includes attendees with displayName in the body', async () => {
    mockOk()
    const attendees = [
      { email: 'alice@example.com', name: 'Alice Smith' },
      { email: 'bob@example.com', name: 'Bob Jones' },
    ]
    await createCalendarEvent('token', timedEvent(), attendees)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.attendees).toEqual([
      { email: 'alice@example.com', displayName: 'Alice Smith' },
      { email: 'bob@example.com', displayName: 'Bob Jones' },
    ])
  })

  it('uses sendUpdates=all when notifyAttendees is true and attendees are present', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent(), [{ email: 'a@b.com', name: 'A' }], true)
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('sendUpdates=all')
  })

  it('uses sendUpdates=none when notifyAttendees is false', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent(), [{ email: 'a@b.com', name: 'A' }], false)
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('sendUpdates=none')
  })

  it('uses sendUpdates=none when there are no attendees', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent(), [])
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('sendUpdates=none')
  })

  it('omits attendees key when list is empty', async () => {
    mockOk()
    await createCalendarEvent('token', timedEvent(), [])
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).not.toHaveProperty('attendees')
  })

  // ─── Error handling ───────────────────────────────────────────────────────

  it('throws with the HTTP status on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    } as Response)
    await expect(createCalendarEvent('token', timedEvent())).rejects.toThrow(
      'Google Calendar API error 403',
    )
  })

  it('propagates network errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))
    await expect(createCalendarEvent('token', timedEvent())).rejects.toThrow('Network failure')
  })
})
