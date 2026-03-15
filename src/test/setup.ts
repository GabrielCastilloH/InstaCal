import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Stub crypto.randomUUID (used in upsertPerson)
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: vi.fn(() => 'test-uuid-1234'),
  configurable: true,
})

// Minimal Chrome API stub
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    lastError: undefined,
  },
}

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  configurable: true,
  writable: true,
})
