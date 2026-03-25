import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { loadPrefs, savePrefs, DEFAULT_PREFS } from '../../services/prefs'
import { PREF_KEY } from '../../constants'

describe('loadPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns defaults when storage is empty', async () => {
    (chrome.storage.local.get as unknown as Mock).mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      callback({})
    })
    const prefs = await loadPrefs()
    expect(prefs).toEqual(DEFAULT_PREFS)
  })

  it('merges stored values over defaults', async () => {
    const stored = { userName: 'Alice', defaultDuration: 30 };
    (chrome.storage.local.get as unknown as Mock).mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      callback({ [PREF_KEY]: stored })
    })
    const prefs = await loadPrefs()
    expect(prefs.userName).toBe('Alice')
    expect(prefs.defaultDuration).toBe(30)
    // un-overridden defaults stay
    expect(prefs.autoReview).toBe(DEFAULT_PREFS.autoReview)
    expect(prefs.defaultStartTime).toBe(DEFAULT_PREFS.defaultStartTime)
  })

  it('spreads stored partial object over defaults', async () => {
    const stored = { userName: 'Bob' };
    (chrome.storage.local.get as unknown as Mock).mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      callback({ [PREF_KEY]: stored })
    })
    const prefs = await loadPrefs()
    expect(prefs.userName).toBe('Bob')
    // All default keys still present
    expect(Object.keys(prefs)).toEqual(expect.arrayContaining(Object.keys(DEFAULT_PREFS)))
  })
})

describe('savePrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls chrome.storage.local.set with correct key and prefs', async () => {
    (chrome.storage.local.set as unknown as Mock).mockImplementation((_data: Record<string, unknown>, callback: () => void) => callback())
    await savePrefs(DEFAULT_PREFS)
    expect(chrome.storage.local.set as unknown as Mock).toHaveBeenCalledWith(
      { [PREF_KEY]: DEFAULT_PREFS },
      expect.any(Function),
    )
  })
})
