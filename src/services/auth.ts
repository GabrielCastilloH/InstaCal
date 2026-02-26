import { auth } from '../lib/firebase'

const GOOGLE_CALENDAR_TOKEN_KEY = 'instacal_google_calendar_token'

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}

export async function getGoogleCalendarToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([GOOGLE_CALENDAR_TOKEN_KEY], (result) => {
      const token = result[GOOGLE_CALENDAR_TOKEN_KEY]
      resolve(typeof token === 'string' ? token : null)
    })
  })
}

export async function setGoogleCalendarToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [GOOGLE_CALENDAR_TOKEN_KEY]: token }, resolve)
  })
}

export async function clearGoogleCalendarToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(GOOGLE_CALENDAR_TOKEN_KEY, resolve)
  })
}
