import { auth } from '../lib/firebase'
import { FIREBASE_TOKEN_EXPIRY_MS } from '../constants'

const FIREBASE_TOKEN_KEY = 'instacal_firebase_id_token'
const FIREBASE_TOKEN_EXPIRY_KEY = 'instacal_firebase_id_token_expiry'
export const FIREBASE_REFRESH_TOKEN_KEY = 'instacal_firebase_refresh_token'

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    const token = await user.getIdToken()
    // Cache for background.js (expires ~55 min, before Firebase's 1-hour TTL)
    chrome.storage.local.set({
      [FIREBASE_TOKEN_KEY]: token,
      [FIREBASE_TOKEN_EXPIRY_KEY]: Date.now() + FIREBASE_TOKEN_EXPIRY_MS,
      [FIREBASE_REFRESH_TOKEN_KEY]: user.refreshToken,
    })
    return token
  } catch {
    return null
  }
}

/**
 * Gets a Google OAuth token via chrome.identity.getAuthToken.
 * Pass interactive=true to trigger consent UI on first use.
 * Chrome manages token refresh invisibly — no expiry tracking needed.
 */
export async function getGoogleCalendarToken(interactive = false): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      if (chrome.runtime.lastError || !result?.token) {
        resolve(null)
      } else {
        resolve(result.token)
      }
    })
  })
}
