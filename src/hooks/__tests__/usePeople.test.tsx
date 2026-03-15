import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePeople } from '../../hooks/usePeople'

vi.mock('../../utils/people', () => ({
  loadPeople: vi.fn(),
  savePeople: vi.fn(),
  upsertPerson: vi.fn(),
}))

import { loadPeople, savePeople, upsertPerson } from '../../utils/people'
import type { Person } from '../../utils/people'

const alice: Person = {
  id: 'id-1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  lastUsed: 1000,
}

describe('usePeople', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(savePeople).mockResolvedValue(undefined)
  })

  it('loads people from storage on mount', async () => {
    vi.mocked(loadPeople).mockResolvedValue([alice])

    const { result } = renderHook(() => usePeople())
    expect(result.current.people).toEqual([])

    // wait for useEffect
    await act(async () => {})
    expect(result.current.people).toEqual([alice])
  })

  it('starts with empty list when storage is empty', async () => {
    vi.mocked(loadPeople).mockResolvedValue([])

    const { result } = renderHook(() => usePeople())
    await act(async () => {})
    expect(result.current.people).toEqual([])
  })

  it('addPerson updates state and persists', async () => {
    vi.mocked(loadPeople).mockResolvedValue([])
    const updated = [alice]
    vi.mocked(upsertPerson).mockReturnValue(updated)

    const { result } = renderHook(() => usePeople())
    await act(async () => {})

    await act(async () => {
      await result.current.addPerson('Alice Smith', 'alice@example.com')
    })

    expect(upsertPerson).toHaveBeenCalledWith([], 'Alice Smith', 'alice@example.com')
    expect(result.current.people).toEqual(updated)
    expect(savePeople).toHaveBeenCalledWith(updated)
  })
})
