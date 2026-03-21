import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAvailability } from '../../services/availability'

// Tests pin the system clock and run in the local timezone of the test
// runner (UTC in CI). Dates are constructed as local midnight so that
// setHours() calls inside fetchAvailability align with expectations.

function localMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function mockFreeBusy(busy: Array<{ start: string; end: string }> = []) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ calendars: { primary: { busy } } }),
    text: () => Promise.resolve(''),
  } as Response)
}

describe('fetchAvailability', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // ─── API surface ─────────────────────────────────────────────────────────

  it('sends a POST to the freeBusy endpoint with the auth header', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    mockFreeBusy()
    const start = localMidnight(2024, 3, 21)
    const end   = localMidnight(2024, 3, 21)
    await fetchAvailability('my-token', start, end, '08:00', '17:00')
    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      }),
    )
  })

  it('throws on a non-ok API response', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response)
    await expect(
      fetchAvailability('bad', localMidnight(2024, 3, 21), localMidnight(2024, 3, 21), '08:00', '17:00'),
    ).rejects.toThrow('Google Calendar API error 401')
  })

  // ─── Slot inclusion / exclusion ──────────────────────────────────────────

  it('includes a fully free day in the output', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    expect(result).toContain('Thursday, March 21st')
    expect(result).not.toBe('No availability found for the selected dates.')
  })

  it('returns "No availability found" when the entire window is busy', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    // Build a busy slot that exactly covers the 08:00–17:00 window (with buffer
    // that collapses the window to nothing).  Use local-time ISO strings so the
    // comparison inside the service uses the same timezone.
    const dayStr = '2024-03-21'
    // Busy 06:00–19:00 local → after 10-min buffer eats 07:50–19:10, covers 08:00–17:00 entirely
    const busyStart = new Date(2024, 2, 21, 6, 0, 0).toISOString()
    const busyEnd   = new Date(2024, 2, 21, 19, 0, 0).toISOString()
    mockFreeBusy([{ start: busyStart, end: busyEnd }])
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    expect(result).toBe('No availability found for the selected dates.')
    void dayStr
  })

  it('excludes free gaps shorter than 20 minutes', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    // Two busy blocks with a 10-minute gap — after 10-min buffer they overlap
    const b1start = new Date(2024, 2, 21, 8,  0, 0).toISOString()
    const b1end   = new Date(2024, 2, 21, 12, 0, 0).toISOString()
    const b2start = new Date(2024, 2, 21, 12, 10, 0).toISOString() // 10-min gap → <20 min after buffer
    const b2end   = new Date(2024, 2, 21, 17, 0, 0).toISOString()
    mockFreeBusy([
      { start: b1start, end: b1end },
      { start: b2start, end: b2end },
    ])
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    expect(result).toBe('No availability found for the selected dates.')
  })

  it('includes free gaps of 20 minutes or more', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    // Busy 08:00–15:00 leaves 2 hours free before 17:00
    const busyStart = new Date(2024, 2, 21, 8,  0, 0).toISOString()
    const busyEnd   = new Date(2024, 2, 21, 15, 0, 0).toISOString()
    mockFreeBusy([{ start: busyStart, end: busyEnd }])
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    expect(result).toContain('Thursday, March 21st')
  })

  // ─── Multi-day ranges ────────────────────────────────────────────────────

  it('outputs a line for each day that has free slots', async () => {
    vi.setSystemTime(localMidnight(2024, 3, 20))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 22),
      '08:00', '17:00',
    )
    expect(result).toContain('March 21st')
    expect(result).toContain('March 22nd')
  })

  // ─── First-day-selected regression (the i===0 bug) ───────────────────────

  it('includes the first selected day when it is in the future', async () => {
    // "now" is 2 PM on the 20th; range starts on the 21st — must not be skipped
    vi.setSystemTime(new Date(2024, 2, 20, 14, 0, 0))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 23),
      '08:00', '17:00',
    )
    // The 21st (Thursday) MUST appear, not just the 22nd
    expect(result).toContain('Thursday, March 21st')
  })

  it('does not show past times when the first selected day is today', async () => {
    // now = 11:00 AM on March 21 — only afternoon slots should appear
    vi.setSystemTime(new Date(2024, 2, 21, 11, 0, 0))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    // Result must not include anything starting before 11 AM
    // (roundUpTo15 of 11:00 = 11:00, so the slot starts at 11:00 AM)
    expect(result).not.toMatch(/8:00 AM/)
    expect(result).not.toMatch(/9:00 AM/)
    expect(result).not.toMatch(/10:00 AM/)
    expect(result).toContain('Thursday, March 21st')
  })

  it('skips today entirely when business hours have already ended', async () => {
    // now = 8 PM — past 17:00 end — today should produce no slots
    vi.setSystemTime(new Date(2024, 2, 21, 20, 0, 0))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 21),
      '08:00', '17:00',
    )
    expect(result).toBe('No availability found for the selected dates.')
  })

  it('clips today in the middle of a range but not future days', async () => {
    // now = 2 PM on March 21; range spans March 21–22
    vi.setSystemTime(new Date(2024, 2, 21, 14, 0, 0))
    mockFreeBusy()
    const result = await fetchAvailability(
      'token',
      localMidnight(2024, 3, 21),
      localMidnight(2024, 3, 22),
      '08:00', '17:00',
    )
    // Both days must be in the output
    expect(result).toContain('Thursday, March 21st')
    expect(result).toContain('Friday, March 22nd')
    // Today's (March 21) line must NOT start at 8 AM — it was clipped to ~2 PM
    const todayLine = result.split('\n').find(l => l.includes('March 21st'))!
    expect(todayLine).not.toMatch(/8:00 AM/)
    // Tomorrow's (March 22) line MUST start at 8 AM (not clipped)
    const tomorrowLine = result.split('\n').find(l => l.includes('March 22nd'))!
    expect(tomorrowLine).toContain('8:00 AM')
  })
})
