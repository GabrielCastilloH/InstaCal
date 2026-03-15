import { chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

const EXTENSION_DIR = path.resolve('dist')

export const PROFILE_DIR = path.resolve('.playwright-profile')

/** Smoke tests: Playwright's bundled Chromium, temp profile, fast startup. */
export async function launchExtensionChromium(): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  })
}

/**
 * Auth tests: real installed Chrome + persistent profile.
 * Google OAuth accepts Chrome; session is saved across runs.
 */
export async function launchExtensionChrome(profileDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  })
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 30_000 })
  }
  return background.url().split('/')[2]
}
