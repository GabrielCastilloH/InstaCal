import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'

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

interface ParsedEvent {
  title: string
  start: string
  end: string
  location: string | null
  description: string | null
}

app.post('/parse', (req: Request<object, ParsedEvent, ParseRequestBody>, res: Response) => {
  const { text } = req.body

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  // Stub — OpenAI integration goes here
  const stub: ParsedEvent = {
    title: 'Stub Event',
    start: '2026-02-25T18:00:00',
    end: '2026-02-25T19:00:00',
    location: null,
    description: null,
  }

  res.json(stub)
})

app.listen(PORT, () => {
  console.log(`InstaCal server running on http://localhost:${PORT}`)
})
