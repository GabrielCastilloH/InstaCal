import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })
config()
import * as admin from 'firebase-admin'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { parseEventWithAI, ParsedEvent } from './gemini'

admin.initializeApp()

const geminiSecret = defineSecret('GEMINI_API_KEY')

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

const DAILY_LIMIT = 5

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY ?? geminiSecret.value()
}

async function verifyAuth(
  req: Request,
  res: Response,
  next: (err?: unknown) => void
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    res.locals.uid = decoded.uid
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}

async function checkRateLimit(uid: string): Promise<void> {
  const db = admin.firestore()
  const ref = db.doc(`usage/${uid}`)
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)

    if (!snap.exists) {
      tx.set(ref, { count: 1, lastResetDate: today })
      return
    }

    const { count, lastResetDate } = snap.data() as { count: number; lastResetDate: string }

    if (lastResetDate !== today) {
      // New day — lazy reset
      tx.set(ref, { count: 1, lastResetDate: today })
      return
    }

    if (count >= DAILY_LIMIT) {
      throw new Error('RATE_LIMIT_EXCEEDED')
    }

    tx.update(ref, { count: count + 1 })
  })
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

interface ParseRequestBody {
  text?: string
  now?: string
}

app.post(
  '/parse',
  verifyAuth,
  async (req: Request<object, ParsedEvent | { error: string }, ParseRequestBody>, res: Response) => {
    const { text, now } = req.body

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'text is required' })
      return
    }

    const uid = res.locals.uid as string

    try {
      await checkRateLimit(uid)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
        res.status(429).json({ error: `Daily limit of ${DAILY_LIMIT} reached. Try again tomorrow.` })
        return
      }
      throw err
    }

    const nowISO = now ?? new Date().toISOString()

    try {
      const apiKey = getGeminiApiKey()
      const event = await parseEventWithAI({ text: text.trim(), nowISO }, apiKey)
      res.json(event)
    } catch (err) {
      console.error('[/parse] error:', err)
      res.status(500).json({ error: 'parse failed' })
    }
  }
)

export const api = onRequest(
  {
    cors: true,
    secrets: [geminiSecret],
  },
  app
)
