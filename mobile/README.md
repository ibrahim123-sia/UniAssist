# UniAssist Mobile (Expo) — for students

Student app for UniAssist at MAJU (Muhammad Ali Jinnah University). Expo SDK 51 /
React Native 0.74, TypeScript, React Navigation, Redux Toolkit + redux-persist.

- **Students only.** Staff and administrators use the UniAssist web portal. Signing
  in with a staff/admin account is refused before any token is stored ("UniAssist
  mobile is for students. Staff and administrators, please use the web portal."),
  and a stored non-student session is cleared on start-up.
- **Same backend as the web.** The app talks only to the Node server (`server/`)
  and calls exactly the endpoints the web client's student pages call, with the
  same methods, paths and fields. It never calls the Python service or any
  third-party feed, and there are no mobile-only endpoints.

## Setup

1. Start the backend first (see the root README): the Node server on port 3000
   (and the Python AI service it uses).
2. Configure and run the app:

   ```bash
   cd mobile
   cp .env.example .env   # set EXPO_PUBLIC_SERVER_URL
   npm install
   npx expo start -c      # -c so changed EXPO_PUBLIC_* values are re-inlined
   ```

3. Open it in Expo Go (scan the QR code) or an Android emulator (`a`).

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SERVER_URL` | yes | Node API base URL. On a physical device use your computer's LAN IP, e.g. `http://192.168.1.20:3000` (not `localhost`). Without it the app shows a "Server not configured" screen. |

### Plain-http servers and release builds

Android release builds block plain `http://` traffic by default, which would break
a LAN/dev server URL like the one above. `app.json` sets
`android.usesCleartextTraffic: true` through the `expo-build-properties` plugin so
`http://` server URLs keep working in `eas build` / `expo prebuild` builds. For a
production deployment, serve the API over `https://` and remove that setting.
(Expo Go and debug builds allow http already.)

## What students can do

The bottom tabs are Chats · Issues · Jobs · Scholarships · Events · Profile. Every
tab header has a notification bell (unread count polled every 30 s while the app
is in the foreground).

- **Account**: sign in, register with the MAJU student email (OTP verification,
  resend with cooldown), forgot/reset password. If the university email isn't
  configured yet the server's message ("Email service is not configured yet…") is
  shown. Unverified sign-ins get a fresh code and go to the OTP step.
- **Session**: the JWT is kept in `expo-secure-store` only. A 401 or a `blocked`
  403 on any protected call signs the student out. Results of requests that were
  still running when the student signed out are ignored. Signing out clears all
  cached data except the theme and the student's own unsent offline issues.
- **Chat** (`/api/chat`, `/api/message`): chat list with rename/delete (delete
  asks first), Ask or Draft-email mode, server-assigned chat names. While a reply
  is awaited the chat shows a typing indicator and, after a couple of seconds, the
  stage ("Searching the knowledge base…", "Writing the answer…", then "Still
  working — the AI service is busy…") with elapsed seconds. Several chats can
  wait for replies at the same time. Voice is transcribe-only like the web:
  record 2–30 s, "Transcribing your voice… N s" is shown, and the text is added
  to whatever is already typed. When the bot couldn't answer and the question was
  forwarded, the reply says so (also after reloading the chat). Every assistant
  reply has "Ask an admin" (`POST /api/question`) and "Register a complaint" (a
  sheet with the department pre-selected from
  `GET /api/issue/department-suggestion`, `POST /api/issue/from-chat`; it can't
  be closed while the complaint is being registered).
- **My Questions** (Profile, or a `question_answered` notification):
  `GET /api/question/my` with status and the admin's answer.
- **Issues**: create with department, category and up to 3 attachments
  (PDF/JPG/PNG/GIF/WebP, 5 MB each), follow-up replies, attachment links, 1–5 star
  feedback once Resolved/Closed. Text-only issues created offline are queued and
  sent when the device reconnects; if the session ended first they stay queued
  (for that student only) and are sent after they sign in again.
- **Jobs / Scholarships**: published listings (`GET /api/listings?kind=job|scholarship`)
  with search, "Closes in N days" / "Closed" badge, an Open / "Show closed" toggle
  (`includeExpired=true`, same as the web) and a detail view with an Apply button.
- **Events**: published events (`GET /api/listings?kind=event`), Upcoming by default
  or Past (`past=true`), with poster, date, time, venue, organizer and Register.
- **Profile**: display name, avatar (JPG/PNG/GIF/WebP, max 2 MB; upload shows its
  progress), password change, light/dark theme (same MAJU palette as the web).

There are no push notifications: the server doesn't send them.

## Layout

```
src/
├── api/          axios client (auth header, session-end interceptor) + per-resource calls
├── components/   Card, Button, Input, IssueCard, IssueParts, ComplaintSheet, TypingIndicator, …
├── hooks/        useTheme, useConnectivity (offline outbox), useNotificationPolling,
│                 useFocusPolling, useCountdown, useElapsed
├── navigation/   RootNavigator (auth stack / student stack) + StudentTabs
├── redux/        store (persists theme, cached user, outbox) + slices
├── screens/      auth/, student/, common/
├── theme/        light/dark palette (MAJU brand tokens)
└── utils/        validation (MAJU student email rule), toast
```

No icon/splash images are checked in, so `app.json` uses Expo's defaults; add
`icon`, `splash.image` and `android.adaptiveIcon.foregroundImage` before building
a store binary.
