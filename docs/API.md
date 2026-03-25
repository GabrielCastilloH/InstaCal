# Backend API

Base URL configured via `VITE_CLOUD_FUNCTION_URL` (defaults to `http://localhost:5001/instacal-app/us-central1/api`).

All endpoints require a Firebase ID token:

```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

---

## POST /parse

Parse natural language text into a structured calendar event.

### Request

```json
{
  "text": "Lunch with Sarah tomorrow at noon",
  "now": "2024-03-15T10:00:00.000Z",
  "defaults": {
    "smartDefaults": true,
    "tasksAsAllDayEvents": true,
    "defaultDuration": 60,
    "defaultStartTime": "12:00",
    "defaultLocation": "TBD"
  },
  "people": [
    { "firstName": "Sarah", "lastName": "Jones", "email": "sarah@example.com" }
  ],
  "userName": "Alice"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `text` | yes | Natural language event description |
| `now` | yes | Current ISO timestamp (used as reference for relative dates) |
| `defaults` | no | User preferences that guide parsing |
| `people` | no | Known contacts for attendee resolution |
| `userName` | no | Name of the user creating the event |

### Response `200`

```json
{
  "title": "Lunch with Sarah",
  "start": "2024-03-16T12:00:00",
  "end": "2024-03-16T13:00:00",
  "location": null,
  "description": null,
  "recurrence": null,
  "isTask": false,
  "attendees": [
    { "email": "sarah@example.com", "name": "Sarah Jones" }
  ],
  "unknownAttendees": []
}
```

`unknownAttendees` contains names that were mentioned but couldn't be matched to a known contact. The client shows `UnknownPersonModal` for each.

All-day events use `start: "YYYY-MM-DDT00:00:00"` and `end: "YYYY-MM-DDT23:59:59"`.

### Error responses

```json
{ "error": "human-readable message" }
```

Common status codes: `400` bad input, `401` invalid token, `500` server error.

---

## POST /edit-event

Apply a natural language instruction to an existing event.

### Request

```json
{
  "instruction": "Move it to 2pm and add a video call link",
  "existingEvent": {
    "title": "Lunch with Sarah",
    "start": "2024-03-16T12:00:00",
    "end": "2024-03-16T13:00:00",
    "location": null,
    "description": null
  },
  "now": "2024-03-15T10:00:00.000Z",
  "people": [
    { "firstName": "Sarah", "lastName": "Jones", "email": "sarah@example.com" }
  ],
  "userName": "Alice"
}
```

### Response `200`

Same shape as `/parse` — a full `ParsedEvent` with the instruction applied.

```json
{
  "title": "Lunch with Sarah",
  "start": "2024-03-16T14:00:00",
  "end": "2024-03-16T15:00:00",
  "location": null,
  "description": "Video call: ...",
  "recurrence": null,
  "isTask": false,
  "attendees": [],
  "unknownAttendees": []
}
```

After receiving this response, `background.ts` calls `PATCH /calendar/v3/.../events/:id` to apply the update to Google Calendar.
