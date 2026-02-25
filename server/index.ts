import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { parseEventWithAI, ParsedEvent } from './openai'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors())
app.use(express.json())

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

interface ParseRequestBody {
  text?: string
  now?: string
}

app.post('/parse', async (req: Request<object, ParsedEvent | { error: string }, ParseRequestBody>, res: Response) => {
  const { text, now } = req.body

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const nowISO = now ?? new Date().toISOString()

  try {
    const event = await parseEventWithAI({ text: text.trim(), nowISO })
    res.json(event)
  } catch (err) {
    console.error('[/parse] error:', err)
    res.status(500).json({ error: 'parse failed' })
  }
})

app.listen(PORT, () => {
  console.log(`InstaCal server running on http://localhost:${PORT}`)
})
