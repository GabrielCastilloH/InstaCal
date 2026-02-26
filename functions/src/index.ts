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
    await admin.auth().verifyIdToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
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
