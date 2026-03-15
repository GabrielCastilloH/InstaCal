import { test, expect, type BrowserContext } from '@playwright/test'
import { launchExtensionChromium, getExtensionId } from './helpers'

let context: BrowserContext
let extensionId: string

test.beforeAll(async () => {
  // Temp profile (empty string) — no auth needed for these smoke tests
  context = await launchExtensionChromium()
  extensionId = await getExtensionId(context)
})

test.afterAll(async () => {
  await context.close()
})

test('service worker registers without errors', async () => {
  const [background] = context.serviceWorkers()
  expect(background.url()).toContain('chrome-extension://')
})

test('popup renders the main UI or sign-in page', async () => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/index.html`)
  await expect(page.locator('body')).not.toBeEmpty()
  await page.close()
})

test('popup contains a text input or sign-in button', async () => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/index.html`)
  const hasInput = await page.locator('input, textarea, button').count()
  expect(hasInput).toBeGreaterThan(0)
  await page.close()
})

test('auth page loads without errors', async () => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/auth.html`)
  await expect(page.locator('body')).not.toBeEmpty()
  await page.close()
})
