import { auth } from '../lib/firebase'

const GOOGLE_CALENDAR_TOKEN_KEY = 'instacal_google_calendar_token'
const GOOGLE_CALENDAR_TOKEN_EXPIRY_KEY = 'instacal_google_calendar_token_expiry'

const OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
]

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}

/**
 * Runs the Google OAuth implicit flow.
 * Pass interactive=true for the sign-in button, false for silent background refresh.
 */
export async function requestGoogleToken(
  interactive: boolean,
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string
  if (!clientId) throw new Error('Google OAuth Client ID is not configured.')

  const redirectUrl = chrome.identity.getRedirectURL()
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUrl)
  authUrl.searchParams.set('scope', OAUTH_SCOPES.join(' '))
  if (!interactive) {
    authUrl.searchParams.set('prompt', 'none')
  }

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive },
      (redirectResponse) => {
        if (chrome.runtime.lastError || !redirectResponse) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Auth cancelled'))
        } else {
          resolve(redirectResponse)
        }
      },
    )
  })

  const hashParams = new URLSearchParams(new URL(responseUrl).hash.slice(1))
  const accessToken = hashParams.get('access_token')
  const expiresIn = parseInt(hashParams.get('expires_in') ?? '3600', 10)
  if (!accessToken) throw new Error('No access token in response.')

  return { accessToken, expiresIn }
}

export async function getGoogleCalendarToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [GOOGLE_CALENDAR_TOKEN_KEY, GOOGLE_CALENDAR_TOKEN_EXPIRY_KEY],
      async (result) => {
        const token = result[GOOGLE_CALENDAR_TOKEN_KEY]
        const expiry = result[GOOGLE_CALENDAR_TOKEN_EXPIRY_KEY] as number | undefined

        if (typeof token !== 'string') {
          resolve(null)
          return
        }

        // Return the token if it's still valid with a 5-minute buffer
        if (expiry && Date.now() < expiry - 5 * 60 * 1000) {
          resolve(token)
          return
        }

        // Token expired (or no expiry stored) — attempt silent refresh
        try {
          const { accessToken, expiresIn } = await requestGoogleToken(false)
          await setGoogleCalendarToken(accessToken, expiresIn)
          resolve(accessToken)
        } catch {
          // Silent refresh failed — caller should re-authenticate interactively
          resolve(null)
        }
      },
    )
  })
}

export async function setGoogleCalendarToken(token: string, expiresIn = 3600): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [GOOGLE_CALENDAR_TOKEN_KEY]: token,
        [GOOGLE_CALENDAR_TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
      },
      resolve,
    )
  })
}

export async function clearGoogleCalendarToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [GOOGLE_CALENDAR_TOKEN_KEY, GOOGLE_CALENDAR_TOKEN_EXPIRY_KEY],
      resolve,
    )
  })
}
