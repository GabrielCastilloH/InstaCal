import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isAllDayEvent, parseEvent, type ParsedEvent } from '../../services/parseEvent'

const allDay: ParsedEvent = {
  title: 'All Day',
  start: '2024-03-15T00:00:00',
  end: '2024-03-15T23:59:59',
  location: null,
  description: null,
  recurrence: null,
  isTask: false,
}

const timed: ParsedEvent = {
  ...allDay,
  start: '2024-03-15T09:00:00',
  end: '2024-03-15T10:00:00',
}

describe('isAllDayEvent', () => {
  it('returns true for all-day event (00:00:00 → 23:59:59 same date)', () => {
    expect(isAllDayEvent(allDay)).toBe(true)
  })

  it('returns false for timed event', () => {
    expect(isAllDayEvent(timed)).toBe(false)
  })

  it('returns false when dates differ', () => {
    const multiDay = { ...allDay, end: '2024-03-16T23:59:59' }
    expect(isAllDayEvent(multiDay)).toBe(false)
  })

  it('returns false when end time is not 23:59:59', () => {
    expect(isAllDayEvent({ ...allDay, end: '2024-03-15T23:00:00' })).toBe(false)
  })
})

describe('parseEvent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed event on success', async () => {
    const mockResult: ParsedEvent = {
      title: 'Lunch',
      start: '2024-03-15T12:00:00',
      end: '2024-03-15T13:00:00',
      location: null,
      description: null,
      recurrence: null,
      isTask: false,
    }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(mockResult),
    } as Response)

    const result = await parseEvent('Lunch tomorrow', 'token-123')
    expect(result).toEqual(mockResult)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/parse'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    )
  })

  it('throws with server error message on 4xx response with JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'Invalid input' }),
      text: () => Promise.resolve(''),
    } as Response)

    await expect(parseEvent('bad input', 'token')).rejects.toThrow('Invalid input')
  })

  it('throws generic server error on 4xx with no body error field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response)

    await expect(parseEvent('text', 'token')).rejects.toThrow('Server error: 500')
  })

  it('propagates network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'))
    await expect(parseEvent('text', 'token')).rejects.toThrow('Network failure')
  })
})
