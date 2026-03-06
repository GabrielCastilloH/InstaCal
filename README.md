# InstaCal

A Chrome extension that uses AI to create and edit Google Calendar events from natural language.

Type something like **"Lunch with Sarah tomorrow at noon"** and InstaCal parses it and adds it to your Google Calendar — no forms, no clicking through menus.

## Features

### Event Creation
- Natural language event creation from the popup
- AI parses title, date, time, duration, location, description, recurrence, and attendees
- **Auto-add** mode skips the Google Calendar review page and creates the event directly
- **Open in Calendar** mode opens the prefilled Google Calendar event editor for review

### Edit with AI (on Google Calendar)
- An **"Edit with AI"** button appears on event detail pages on calendar.google.com
- Describe a change in plain English (e.g. "move to 3pm and add Zoom link") and the event is patched in place
- Page reloads automatically after a successful update

### Context Menu
- Right-click any selected text in the browser and choose **"Add to Calendar with InstaCal"** to pre-fill the popup with that text

### Availability Export
- Click the calendar icon in the popup to select a date range
- Your free time slots are copied to the clipboard as a plain-text list, ready to paste into an email or message

### People & Contacts
- Save contacts (first name, last name, email) for fast attendee resolution
- When an event mentions someone not in your contacts, a modal prompts you to supply their email and optionally save them
- Contacts sync across devices via Firestore (merged by email, most-recently-used wins)

### Preferences
| Setting | Description |
|---|---|
| Your name | Used to personalize event titles when guests are added |
| Auto-add | Skip review and add events directly to Calendar |
| Tasks as all-day events | Events with deadlines but no time are added as all-day events |
| Notify attendees | Send Google Calendar invite emails to added guests |
| Smart defaults | AI picks time and duration based on event type |
| Default duration | Fallback duration (minutes) when smart defaults are off |
| Default start time | Fallback start time when smart defaults are off |
| Default location | Fallback location when smart defaults are off |
| Availability day start/end | Working-hours window used for availability export |

## Tech Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **Platform**: Chrome Extension (Manifest V3)
- **Backend**: Firebase Cloud Functions (Gemini AI)
- **Auth**: Firebase Authentication (Google Sign-In)
- **Database**: Firebase Firestore (contacts sync)
- **Calendar**: Google Calendar API (Events + FreeBusy)

## Setup

- **Gemini API**: Add your API key to `functions/.env.local` (see `functions/.env.example`)
- **Firebase**: Configure via `firebase.json` and `.firebaserc`
- **Build**: `npm run build` — output goes to `dist/`
- **Load extension**: Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `dist/`

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

MIT
