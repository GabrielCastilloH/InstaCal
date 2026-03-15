import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

let context: BrowserContext
let extensionId: string

test.beforeAll(async () => {
  const pathToExtension = path.resolve('dist')
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  })

  // Wait for service worker registration
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 10_000 })
  }
  extensionId = background.url().split('/')[2]
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
  // Either authenticated main UI or sign-in is rendered — body must have content
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
