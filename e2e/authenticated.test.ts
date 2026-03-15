/**
 * Authenticated E2E tests.
 *
 * These tests require a signed-in session saved in .playwright-profile/.
 * First-time setup:
 *   npm run e2e:auth
 *   → A browser window opens. Sign in with your Google account.
 *     The session is saved and all future runs skip the sign-in step.
 *
 * Subsequent runs:
 *   npm run e2e:auth   (automatically picks up saved session)
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { launchExtension, getExtensionId, PROFILE_DIR } from './helpers'

let context: BrowserContext
let extensionId: string

test.beforeAll(async () => {
  context = await launchExtension(PROFILE_DIR)
  extensionId = await getExtensionId(context)
})

test.afterAll(async () => {
  await context.close()
})

async function openPopup(): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/index.html`)
  return page
}

// ---------------------------------------------------------------------------
// Auth gate — first test in the file. If not signed in, waits up to 2 minutes
// for the user to complete the Google sign-in flow manually, then the session
// persists in .playwright-profile/ for all future runs.
// ---------------------------------------------------------------------------

test('authenticated: popup shows main UI', async () => {
  const page = await openPopup()

  const signInBtn = page.locator('button:has-text("Continue with Google")')
  const isSignedOut = await signInBtn.isVisible({ timeout: 4_000 }).catch(() => false)

  if (isSignedOut) {
    console.log('\n────────────────────────────────────────────────')
    console.log('  Not signed in. Sign in via the browser window.')
    console.log('  Waiting up to 2 minutes…')
    console.log('────────────────────────────────────────────────\n')

    // Click the sign-in button — this opens auth.html which launches the
    // Google OAuth popup via chrome.identity.launchWebAuthFlow
    await signInBtn.click()

    // Wait for the user to complete OAuth (textarea appears = authenticated)
    await expect(page.locator('textarea')).toBeVisible({ timeout: 120_000 })
  }

  await expect(page.locator('textarea')).toBeVisible()
  await page.close()
})

// ---------------------------------------------------------------------------
// Post-auth tests — each test opens a fresh popup page
// ---------------------------------------------------------------------------

test('authenticated: Add Event button is enabled', async () => {
  const page = await openPopup()
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('button:has-text("Add Event")')).toBeEnabled()
  await page.close()
})

test('authenticated: creates a calendar event from natural language', async () => {
  const page = await openPopup()
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 })

  const label = `Playwright test ${Date.now()}`
  await page.locator('textarea').fill(`${label} tomorrow at 3pm`)
  await page.locator('button:has-text("Add Event")').click()

  // Button shows loading state
  await expect(page.locator('button:has-text("Parsing…")')).toBeVisible()

  // Wait for success or error (backend call can take a few seconds)
  await expect(page.locator('.status-msg')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.status-success')).toBeVisible()

  await page.close()
})

test('authenticated: shows Parsing state while request is in flight', async () => {
  const page = await openPopup()
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 })

  await page.locator('textarea').fill('Coffee catch-up with Alex next Monday at 10am')
  await page.locator('button:has-text("Add Event")').click()

  // Loading state appears immediately
  await expect(page.locator('button:has-text("Parsing…")')).toBeVisible({ timeout: 3_000 })

  // Wait for the request to complete before closing
  await expect(page.locator('.status-msg')).toBeVisible({ timeout: 20_000 })
  await page.close()
})

test('authenticated: navigates to settings and back', async () => {
  const page = await openPopup()
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 })

  await page.locator('button[aria-label="Settings"]').click()
  await expect(page.locator('text=Settings')).toBeVisible()

  // Navigate back via the back button (first button on the settings page)
  await page.locator('button').first().click()
  await expect(page.locator('textarea')).toBeVisible()
  await page.close()
})

test('authenticated: export availability button is present', async () => {
  const page = await openPopup()
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('button[aria-label="Export availability"]')).toBeVisible()
  await page.close()
})
