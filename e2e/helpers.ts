import { chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

const EXTENSION_DIR = path.resolve('dist')

export async function launchExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  })
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 10_000 })
  }
  return background.url().split('/')[2]
}
