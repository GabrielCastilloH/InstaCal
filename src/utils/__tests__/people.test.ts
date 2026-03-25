import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { upsertPerson, loadPeople, savePeople, type Person } from '../../utils/people'
import { MAX_PEOPLE, PEOPLE_KEY } from '../../constants'

function makePerson(email: string, lastUsed: number): Person {
  return { id: 'id-' + email, firstName: 'Test', lastName: '', email, lastUsed }
}

describe('upsertPerson', () => {
  it('adds a new person with split first/last name', () => {
    const result = upsertPerson([], 'Alice Smith', 'alice@example.com')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      id: 'test-uuid-1234',
    })
  })

  it('updates lastUsed for existing email (case-insensitive)', () => {
    const existing: Person[] = [makePerson('alice@example.com', 1000)]
    const before = Date.now()
    const result = upsertPerson(existing, 'Alice', 'ALICE@EXAMPLE.COM')
    expect(result).toHaveLength(1)
    expect(result[0].lastUsed).toBeGreaterThanOrEqual(before)
  })

  it('does not duplicate on case-insensitive match', () => {
    const existing: Person[] = [makePerson('alice@example.com', 1000)]
    const result = upsertPerson(existing, 'Alice', 'Alice@Example.Com')
    expect(result).toHaveLength(1)
  })

  it('evicts LRU entry when at MAX_PEOPLE capacity', () => {
    const people: Person[] = Array.from({ length: MAX_PEOPLE }, (_, i) =>
      makePerson(`person${i}@example.com`, i + 1),
    )
    // person0@example.com has lastUsed=1 (lowest → LRU)
    const result = upsertPerson(people, 'New Person', 'new@example.com')
    expect(result).toHaveLength(MAX_PEOPLE)
    expect(result.find(p => p.email === 'person0@example.com')).toBeUndefined()
    expect(result.find(p => p.email === 'new@example.com')).toBeDefined()
  })

  it('handles single-word name', () => {
    const result = upsertPerson([], 'Alice', 'alice@example.com')
    expect(result[0].firstName).toBe('Alice')
    expect(result[0].lastName).toBe('')
  })
})

describe('loadPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when storage has no entry', async () => {
    (chrome.storage.local.get as unknown as Mock).mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      callback({})
    })
    expect(await loadPeople()).toEqual([])
  })

  it('returns stored people array', async () => {
    const stored = [makePerson('alice@example.com', 1000)];
    (chrome.storage.local.get as unknown as Mock).mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      callback({ [PEOPLE_KEY]: stored })
    })
    expect(await loadPeople()).toEqual(stored)
  })
})

describe('savePeople', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls chrome.storage.local.set with people sorted by lastUsed descending', async () => {
    const people: Person[] = [
      makePerson('a@example.com', 100),
      makePerson('b@example.com', 200),
    ];
    (chrome.storage.local.set as unknown as Mock).mockImplementation((_data: Record<string, unknown>, callback: () => void) => callback())

    await savePeople(people)

    expect(chrome.storage.local.set as unknown as Mock).toHaveBeenCalledWith(
      {
        [PEOPLE_KEY]: [
          expect.objectContaining({ email: 'b@example.com' }),
          expect.objectContaining({ email: 'a@example.com' }),
        ],
      },
      expect.any(Function),
    )
  })
})
