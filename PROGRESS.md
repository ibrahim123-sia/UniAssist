# UniAssist — Progress Log

> Working notes for picking up where we left off. Update as we go.

## What's done

### FYP Spec §2.4 — Issue Registration & Tracking (with department routing)

End-to-end implementation: students can submit issues to a chosen department, each department's staff sees only their own inbox, status changes and replies sync back to the student via 20-second polling, every change fires both an in-app notification (bell + dropdown) and an email.

#### Decisions baked in
- **Three departments:** SFC (Student Facilitation Center), IT, HOD. Stored as a `Department` collection (admin-managed), not an enum.
- **Roles on User:** `student` | `staff` | `admin`. Plus `department` (ObjectId), `staffTitle` (display label like "SFO" / "IT Staff" / "HOD"), `isBlocked`, `lastLoginAt`, `flags[]`.
- **Real-time = polling every 20s** on issue lists, detail pages, dashboards, and the bell unread count. Polling pauses when the tab is hidden.
- **Notifications = email (Gmail SMTP, reusing existing transporter) + in-app bell** with unread count and dropdown.
- **Attachments = local disk via multer.** PDF or image, max 5MB each, max 3 per issue. Stored under `server/uploads/issues/`, served at `/uploads/...`.
- **Login no longer requires MAJU email format** (so admin/staff with non-student addresses can log in). Student registration still enforces it.

### FYP Spec §3.1 — Staff Portal

- `/staff/dashboard` — open / in-progress / resolved-this-week cards, 7-day new-issue trend (recharts area chart), avg first-response time (computed from time-to-first-staff-reply), this-staff's reply count, and most recent 5 issues. Status pill list includes Rejected.
- `/staff/issues` — department-scoped inbox with status filter chips (Pending / In Progress / Resolved / Closed / **Rejected**) and live counts, 20s polling, refresh button. Each card shows an **assignedTo badge** (`Assigned to you` / `Assigned: <name>` / `Unassigned`).
- `/staff/issues/:id` — full thread, student card, **inline attachment preview** (modal lightbox for images, PDF iframe), **assignee strip** with `Assign to me` + `Reassign…` (dropdown of same-dept staff), **combined composer** (reply textarea + status picker + conditional rejection-reason input → single submit fires one notification), **concurrency-aware**: every write sends `expectedUpdatedAt`; server returns 409 on mismatch with the latest state and the UI shows "Sara just resolved this" instead of silently overwriting. A non-blocking toast fires on every poll where someone *else* updated the issue.
- Sidebar shows Dashboard + Department Inbox. Post-login lands on `/staff/dashboard`.

#### Tier 1 enhancement (multi-staff coordination)

- **`Rejected` status** added to enum with required `rejectionReason`. Stored on the issue and shown to the student in the notification email + UI badge.
- **`Issue.lastEvent`** subdoc: `{type, byUserId, byName, byRole, at, note}`. Updated on every staff write so the UI can render "Sara just …" banners.
- **`Issue.assignedTo`** now populated on all staff endpoints. New `PATCH /api/issue/department/:id/assign` (assign to a same-dept staffer or `null` to unassign). New `GET /api/issue/department/staff` for the reassign picker.
- **Combined reply + status**: `POST /api/issue/department/:id/sfo-reply` now accepts optional `status`, `reason`, `expectedUpdatedAt`. One save, one student notification.
- **Concurrency guard**: every mutating endpoint accepts `expectedUpdatedAt`; mismatch → `409 VERSION_CONFLICT` with the fresh issue in the response body. Slice auto-merges the fresh issue into state.
- **Cross-staff notifications**: when one staffer changes status, the other staffers in the same department get an in-app notification so two people don't both jump on the same item.

### FYP Spec §4 — Administrator Panel (full UI + backend)

- `/admin/dashboard` — stat cards (students, staff, admins, departments, open/resolved issues, chats, flagged students), 7-day issue trend chart, recent signups panel, status breakdown row. 20s polling.
- `/admin/users` — paginated student list with search + blocked + flagged filters. Click a row → detail drawer with profile, submitted issues, recent chats, moderation flag history, block/unblock with confirm modal.
- `/admin/staff` — paginated staff list filterable by department. "Add Staff" form takes only `name + department + staffTitle?`; server **auto-generates** email `firstnamelastname@maju.<deptcode>.edu` (collisions append `1,2,...`) and a 12-char crypto-random password. Credentials shown once in a copyable dialog AND emailed to the new staff via the existing nodemailer transporter. Soft-delete (deactivate).
- `/admin/departments` — list (including inactive), create, inline edit, deactivate with confirm, reactivate.
- `/admin/query` — cross-department issue browser. Top of page: total queries, most-asked category, avg resolution hours, departments handling counts. Two bar charts: top categories, by department. Filterable table (search, dept, status). Click → admin read-only issue detail.
- `/admin/data` — vector DB CRUD calling **Python directly** at `VITE_PYTHON_URL`. List paginated chunks (id, source, preview, length), search content, click row → edit drawer (full text + save/delete), "Add chunk" modal (text + source), "Upload document" modal (PDF/DOCX/TXT — server splits with `RecursiveCharacterTextSplitter` and embeds each chunk).
- `/admin/logs` — three tabs (Audit / Logins / Chats):
  - **Audit:** every admin write (POST/PATCH/DELETE on `/api/admin/*`) is auto-recorded via `auditAdminWrites` middleware. `actor`, `actorEmail`, `method`, `path`, `targetType`, `targetId`, `payload` (with `password`/`otp`/`token` redacted), `statusCode`, `ip`, `createdAt`. Filterable by action text.
  - **Logins:** every login attempt (success or failure) recorded with reason, IP, user-agent. Filter success vs failed.
  - **Chats:** browse student chat threads; "flagged students only" toggle; click → drawer with full conversation and the student's flag count badge.

### Profanity moderation (English + Roman-Urdu)

- `python/moderation.py` ships wordlists for both languages and a `check_message(text)` function returning `{flagged, matches, language}`.
- Python `/ask` runs moderation **before** RAG. If flagged: bot replies with a polite warning (Roman-Urdu warning when the message is Roman-Urdu), and Python POSTs `/api/admin/internal/flag-user` on Node with a shared `INTERNAL_SECRET` header.
- Node persists the flag onto `User.flags[]` and fires a `user_flagged` notification to every admin so the bell increments live.

### Fully local AI stack (no cloud calls)

- **LLM:** local **Llama 3.2:3b** via Ollama. `rag.py` uses the `ollama` Python client against `OLLAMA_HOST` (default `http://localhost:11434`). **Groq removed entirely** from both Python and Node — `groq` Python package gone, `groq-sdk` Node package uninstalled, `GROQ_API_KEY` removed from `server/.env`.
- **Speech-to-text:** local **Whisper** via `faster-whisper` (default `base` model, ~145MB, int8 on CPU). New endpoint `POST /transcribe` accepts multipart audio (webm/wav/mp3/ogg/m4a) and returns `{text, language, duration}`. **AssemblyAI removed entirely** — `assemblyai` Node package uninstalled, `config/assemblyai.js` deleted, `ASSEMBLYAI_API_KEY` removed from `server/.env`. Node's `messageController.js` and `guestChatController.js` now forward audio to Python `/transcribe` via `form-data` multipart POST.
- **Language detection:** new `python/language_detect.py` runs a hybrid classifier — `langdetect` for proper-script languages plus a Roman-Urdu function-word lexicon (pronouns, copulas, postpositions) to catch romanized Urdu that langdetect labels as English. Returns `{language, confidence, scores, tokens, matched_urdu_tokens}`. Homographs that overlap with common English words (e.g. "the", "main", "to") are deliberately excluded from the lexicon.
- `/ask` calls the detector first, then passes a `language` hint into `rag.ask(question, language=...)`. The RAG prompt's system message tells Llama to reply in English / Roman Urdu / mixed accordingly. The profanity warning also localises.
- New endpoints: `POST /language/detect`, `POST /transcribe`.

#### Server (D:\UniAssist\server)

New files (this round):
- `controllers/adminStatsController.js` — dashboard aggregations
- `controllers/adminIssueController.js` — cross-dept issues + analytics
- `controllers/adminLogController.js` — audit / logins / chats / chat detail
- `controllers/internalController.js` — `flag-user` webhook + `verify-admin` for Python
- `middlewares/audit.js` — auto-records admin writes, redacts secrets in payload
- `models/AuditLog.js` — actor, action, method, path, target, payload, status, ip
- `models/LoginEvent.js` — every login attempt with success/reason/ip/UA

Modified files (this round):
- `models/User.js` — added `lastLoginAt`, `flags[]` (type, message, matches, chatId, timestamp)
- `models/Notification.js` — added `user_flagged` to type enum
- `controllers/userController.js` — `loginUser` writes `lastLoginAt` and records a `LoginEvent` on every attempt (success + failures)
- `controllers/adminController.js` — `createStaffUser` rewritten: takes `name + departmentId + staffTitle`, auto-generates email and 12-char password, sends credentials email, returns `credentials` once; added `updateStaffUser`, `deleteStaffUser`, `getUserActivity`; added `listUsers` pagination + `flaggedOnly` filter
- `controllers/issueController.js` — added `getDeptStats` for the staff dashboard
- `controllers/messageController.js` — `getPythonBackendResponse` now forwards `user_id` and `chat_id` to Python so moderation flags can be attributed
- `routes/adminRoutes.js` — mounts the new admin endpoints, internal routes outside the JWT chain, and `auditAdminWrites` after the role gate
- `routes/issueRoutes.js` — `/department/stats` route added (before the param routes)

Endpoint additions:
- `GET /api/admin/stats` · `GET /api/admin/users/:id/activity`
- `GET /api/admin/issues` · `GET /api/admin/issues/analytics` · `GET /api/admin/issues/:id`
- `POST /api/admin/staff` (auto-gen) · `PATCH /api/admin/staff/:id` · `DELETE /api/admin/staff/:id`
- `GET /api/admin/logs/audit` · `/logs/logins` · `/logs/chats` · `/logs/chats/:id`
- `POST /api/admin/internal/flag-user` (INTERNAL_SECRET) · `GET /api/admin/internal/verify-admin` (JWT + INTERNAL_SECRET)
- `GET /api/issue/department/stats` (staff)

#### Python (D:\UniAssist\python)

New / modified:
- `api.py` — CORS for `http://localhost:5173`, `verify_admin` dependency (decodes Node JWT with shared `JWT_SECRET` then calls Node `/verify-admin` to confirm role), `/ask` integrates moderation + flag webhook, full chunk CRUD (`GET /chunks`, `GET /chunks/{id}`, `POST /chunks`, `PATCH /chunks/{id}`, `DELETE /chunks/{id}`), document upload (`POST /documents` for PDF/DOCX/TXT)
- `moderation.py` — English + Roman-Urdu wordlists and `check_message(text)`
- `requirements.txt` — added `pyjwt`, `python-multipart`, `pypdf`, `python-docx`, `langchain-text-splitters`

#### Client (D:\UniAssist\client)

New Redux slices:
- `adminStatsSlice` · `adminUserSlice` · `adminStaffSlice` · `adminQuerySlice` · `adminDataSlice` · `adminLogSlice`
- Extended `departmentSlice` with `updateDepartment`, `deactivateDepartment`
- Extended `issueSlice` with `fetchDeptStats`

New shared admin components (`client/src/administrator/components/`):
- `AdminTable.jsx` + `AdminTableRow` + `AdminTableCell`
- `AdminModal.jsx`, `ConfirmDialog.jsx`, `Pagination.jsx`, `StatCard.jsx`, `EmptyState.jsx`, `LoadingSkeleton.jsx`
- `client/src/administrator/layout/AdminShell.jsx` — admin page header/subtitle wrapper
- `client/src/administrator/utils/palette.js` — shared theme palette
- `client/src/utils/pythonAxios.js` — axios instance with `VITE_PYTHON_URL` baseURL + `withAuth`/`withAuthMultipart` helpers

New pages:
- `administrator/pages/{Dashboard,Users,Staff,Departments,Query,Data,Logs}.jsx`
- `staff/pages/StaffDashboard.jsx`

Modified files:
- `components/Sidebar.jsx` — admin block with 7 nav links; staff split into Dashboard + Department Inbox; logo link routes to role-appropriate landing
- `auth/Login.jsx` — staff post-login → `/staff/dashboard`, admin → `/admin/dashboard`
- `auth/ProtectedRoute.jsx` — same role fallbacks
- `App.jsx` — `/admin/*` route block wrapped in `AdminShell`, new `/staff/dashboard` route
- `redux/store.js` — registered the 6 new admin slices + 1 staff slice extension

Housekeeping:
- Deleted broken `client/src/administrator/pages/main.jsx` stub
- Deleted broken `client/src/staff/pages/main.jsx` stub
- Removed empty `client/src/staff/components/filter` + `client/src/staff/components/` folders
- Untracked `.claude/settings.local.json`
- `.gitignore` deduped and now covers `.claude/`, `CLAUDE.md`, `doc/`, `python/chroma_db/`, `*.pt`/`*.pth`, etc.

## How to run it from a fresh checkout

```powershell
# 1. .env additions

# server/.env  — add:
#   INTERNAL_SECRET=<long-random>
#   (existing: MONGO_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASS,
#    ADMIN_EMAIL, ADMIN_PASSWORD, CLIENT_URL, PYTHON_BACKEND_URL)
#   ⚠ GROQ_API_KEY and ASSEMBLYAI_API_KEY are no longer used — remove them
#     and rotate them externally if you suspect they leaked.

# python/.env  — add:
#   JWT_SECRET=<same as server>
#   NODE_INTERNAL_URL=http://localhost:3000
#   INTERNAL_SECRET=<same as server>
#   OLLAMA_HOST=http://localhost:11434   # default; override if Ollama runs elsewhere
#   OLLAMA_MODEL=llama3.2:3b             # default; pull with `ollama pull llama3.2:3b`
#   OLLAMA_TIMEOUT=300                   # seconds; 3B on CPU is slow (cold start ~30-60s + generation)
#   WHISPER_MODEL=base                   # tiny|base|small|medium — base is the default
#   WHISPER_DEVICE=cpu                   # cpu | cuda
#   WHISPER_COMPUTE_TYPE=int8            # int8 = fastest on CPU

# client/.env  — add:
#   VITE_PYTHON_URL=http://localhost:8000
#   (existing: VITE_SERVER_URL)

# 2. Install + seed
cd server
npm install
node scripts/seedAdmin.js   # creates admin user, idempotent
cd ../python
pip install -r requirements.txt
cd ../client
npm install

# 3. Boot all three services
cd ../server && npm run server      # http://localhost:3000
cd ../python && python run.py server # http://localhost:8000
cd ../client && npm run dev         # http://localhost:5173

# 4. Log in as the seeded admin → /admin/dashboard
#    Create departments from /admin/departments
#    Create staff from /admin/staff (credentials shown once + emailed)
#    Register a student via the UI and exercise the full flow
```

## Verification checklist

**Existing (issue tracking)**
- [ ] Server boots, "Gmail SMTP Connected" prints
- [ ] `node scripts/seedAdmin.js` creates admin (or "already exists" on re-run)
- [ ] Student creates an issue with a PDF + image → appears in dashboard as Pending
- [ ] Matching staff sees the new issue, changes status → student notified within 20s + email
- [ ] Staff replies → student gets notification + reply visible
- [ ] Cross-dept staff cannot access another dept's issue (403)
- [ ] Blocked user force-logged-out on next request

**Admin Panel**
- [ ] Admin login → lands on `/admin/dashboard`; sidebar shows 7 admin links; non-admins can't reach `/admin/*`
- [ ] Dashboard stats refresh ~20s after creating a new student/issue in another tab
- [ ] Users → search by name/email works; filter by blocked/flagged narrows the list; row click → drawer shows issues + chats + flags
- [ ] Block a student → student force-logged-out within 20s
- [ ] Staff → "Add Staff" with department SFC shows `firstnamelastname@maju.sfc.edu`; staff receives credentials email; they can log in
- [ ] Departments → create / edit / deactivate → deactivated dept gone from student dropdown but still on historical issues
- [ ] Query → top-categories chart matches data; filter by dept/status narrows list
- [ ] Data → loads chunks directly from Python (network tab → port 8000); edit a chunk re-embeds; PDF upload increments chunk count
- [ ] Non-admin calling Python `/chunks` directly → 403
- [ ] Logs → creating staff appears in **Audit** within 1s; failed login appears in **Logins**

**Moderation**
- [ ] Student sends a profane message (English or Roman-Urdu) → bot replies with warning, admin bell increments (`user_flagged`), student row gets red flag badge, the chat appears in Logs → Chats with flagged-only filter

**Staff Portal**
- [ ] Staff login → lands on `/staff/dashboard` with their dept's stats; chart renders; recent issues clickable
- [ ] Sidebar shows Dashboard + Department Inbox

## Open follow-ups

Items the spec lists or that we deferred:

- **SFO §3.1 priority field** — not in spec but staff would likely want it.
- **Real-time via websockets** — replace 20s polling with socket.io at scale.
- **Cloud attachment storage** — `server/uploads/` is ephemeral on Vercel; move to S3 / Cloudinary before prod.
- **Notification preferences** — per-user opt-out for email vs in-app.
- **Forgot/reset password flow** still enforces MAJU regex on both server and client. Fine for students; admin/staff need a separate recovery path.
- **Code splitting** — `vite build` warns the main bundle is over 500 KB; lazy-load admin/staff routes with `React.lazy` when needed.
- **Python backend tasks** (per `doc/python backend task.txt`):
  - ✅ Vector DB CRUD (done — admin Data tab calls Python directly)
  - ✅ Local Llama 3B via Ollama (done — `llama3.2:3b` served by Ollama daemon at `OLLAMA_HOST`, Groq removed)
  - ✅ Language detection classifier (done — `language_detect.py` hybrid: langdetect + Roman-Urdu function-word lexicon; `/language/detect` endpoint; `/ask` threads the language into the LLM prompt so replies match the user's language)
- **FYP-2 modules** — scholarships, jobs, university events, mobile app.
- **Audit log retention** — no TTL; will grow unbounded. Consider a 90-day index.
- **Profanity wordlist tuning** — start small, iterate based on false positives.

## Notes / gotchas to remember

- **Auth header is the raw JWT, no `Bearer` prefix.** All Node-bound thunks use `Authorization: token` directly. The Python axios instance accepts both formats (`Bearer ` is stripped server-side).
- **`/admin/internal/flag-user` uses `INTERNAL_SECRET`, not JWT** — Python has no user context to issue a token. Keep `INTERNAL_SECRET` out of client envs.
- **`/admin/internal/verify-admin` uses both** — Python forwards the user's JWT (so Node knows who they are) AND sends `INTERNAL_SECRET` (so a random outsider can't hit it).
- **MAJU email regex is for student registration only.** Login + admin-created accounts use generic email.
- **Staff email convention** — `firstnamelastname@maju.<deptcode>.edu`, all lowercase, non-alphanum stripped, collisions append a digit.
- **Audit middleware redacts** `password`, `newPassword`, `otp`, `token` in stored payload.
- **Polling pauses on hidden tabs** via `document.visibilityState === "visible"` inside every interval callback.
- **Department soft-delete** — `DELETE /api/department/:id` flips `isActive=false` so historical issues keep a valid ref.
- **`server/.env` has real credentials committed.** Don't rotate or expose without asking.
- **No tests anywhere.** Verify by exercising the UI; type-check passes don't mean features work.
- **Guest sessions are still in-memory** on the server (lost on restart).
- **Ollama must be running** before `python run.py server` — start the tray app on Windows or `ollama serve`. The model is warmed on RAG init, so the first `/ask` after boot pays a ~30-60s cold-start cost; subsequent requests are faster. `OLLAMA_TIMEOUT` defaults to 300s.
- **Whisper is fully local.** First `/transcribe` call after boot downloads `~145MB` model into `~/.cache/huggingface` and loads it into RAM. Subsequent calls are fast. Voice chat in Node forwards audio to Python via multipart `form-data`; no cloud round-trip.
- **All cloud-AI integrations are removed.** Node deps: dropped `assemblyai` and `groq-sdk`. Python deps: dropped `groq`. Env vars `GROQ_API_KEY`/`ASSEMBLYAI_API_KEY` are gone from `.env` — rotate them upstream if you suspect leakage (they were committed earlier).
