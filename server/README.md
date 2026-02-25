# InstaCal Server

Express + TypeScript backend that parses natural-language event descriptions into structured JSON using OpenAI.

## Setup

```bash
cd server
npm install
cp .env.example .env   # then fill in your OPENAI_API_KEY
```

## Run (dev)

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

## Routes

### `GET /health`
Returns `{ "ok": true }`.

### `POST /parse`

Parses a natural-language event description.

**Request**
```bash
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "Lunch with Sarah tomorrow at noon"}'
```

**Response**
```json
{
  "title": "Lunch with Sarah",
  "start": "2026-02-24T12:00:00",
  "end": "2026-02-24T13:00:00",
  "location": null,
  "description": null
}
```

Optional field: `now` (ISO-8601 string) — overrides the current timestamp used to resolve relative dates. Useful for testing.
