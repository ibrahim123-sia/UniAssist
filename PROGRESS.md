# UniAssist — Progress Log

> Working notes for picking up where we left off. Update as we go.

## What's done

### FYP Spec §2.4 — Issue Registration & Tracking (with department routing)

End-to-end implementation: students can submit issues to a chosen department, each department's staff sees only their own inbox, status changes and replies sync back to the student via 20-second polling, every change fires both an in-app notification (bell + dropdown) and an email.

#### Decisions baked in
- **Three departments:** SFC (Student Facilitation Center), IT, HOD. Stored as a `Department` collection (admin-managed), not an enum.
- **Roles on User:** `student` | `staff` | `admin`. Plus `department` (ObjectId), `staffTitle` (display label like "SFO" / "IT Staff" / "HOD"), `isBlocked`.
- **Real-time = polling every 20s** on issue lists, detail pages, and the bell unread count. Polling pauses when the tab is hidden.
- **Notifications = email (Gmail SMTP, reusing existing transporter) + in-app bell** with unread count and dropdown.
- **Attachments = local disk via multer.** PDF or image, max 5MB each, max 3 per issue. Stored under `server/uploads/issues/`, served at `/uploads/...`.
- **Admin UI is deferred.** First admin is created with a seed script; admin then creates departments + staff via Postman against the admin endpoints.
- **Login no longer requires MAJU email format** (so admin/staff with non-student addresses can log in). Student registration still enforces it.

#### Server (D:\UniAssist\server)

New files:
- `models/Department.js` — `code` (unique, uppercase), `name`, `description`, `isActive`
- `models/Issue.js` — `studentId/Name/Email`, `department` (ref), `title`, `description`, `category`, `status` (Pending|In Progress|Resolved|Closed), `attachments[]`, `replies[]`, `assignedTo`
- `models/Notification.js` — `userId`, `type` (issue_created|issue_replied|issue_status_changed), `issueId`, `message`, `link`, `isRead`
- `middlewares/requireRole.js` — `requireRole('staff', 'admin')` style gate
- `middlewares/upload.js` — multer disk storage at `uploads/issues/`, fileFilter (pdf+image), 5MB / 3-file limits, error handler
- `services/notify.js` — single helper: creates Notification doc + sends email using the same nodemailer config the OTP flow uses
- `controllers/issueController.js` — student endpoints (create, list mine, detail, reply) + staff endpoints (list dept, detail, status update, reply). Notifies counterpart on every change.
- `controllers/departmentController.js` — list (any auth user), create/update/delete (admin)
- `controllers/notificationController.js` — list, unread-count, mark-read, mark-all-read
- `controllers/adminController.js` — list users, update role/department/title, block/unblock, create staff shortcut
- `routes/{issueRoutes,departmentRoutes,notificationRoutes,adminRoutes}.js`
- `scripts/seedAdmin.js` — reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, creates or promotes admin (idempotent)

Modified files:
- `models/User.js` — added `role`, `department`, `staffTitle`, `isBlocked` to schema (previously these were written ad-hoc by the controller)
- `middlewares/auth.js` — `protect` now rejects `isBlocked` users with 403 (response includes `blocked: true`)
- `controllers/userController.js` — `loginUser` no longer enforces MAJU regex (uses generic email regex); `loginUser` and `getUser` now return `role`, `department`, `staffTitle`, `isBlocked` fields
- `server.js` — mounts `/api/issue`, `/api/department`, `/api/notification`, `/api/admin`; serves `/uploads` statically; ensures `uploads/issues/` exists at boot
- `package.json` — added `multer`

Endpoint summary:
- `POST /api/issue` (student, multipart) · `GET /api/issue/my` · `GET /api/issue/:id` · `POST /api/issue/:id/reply`
- `GET /api/issue/department` (staff) · `GET /api/issue/department/:id` · `PATCH /api/issue/department/:id/status` · `POST /api/issue/department/:id/sfo-reply`
- `GET /api/department` (any auth) · `POST/PATCH/DELETE /api/department[/:id]` (admin)
- `GET /api/notification` · `GET /api/notification/unread-count` · `PATCH /api/notification/:id/read` · `PATCH /api/notification/read-all`
- `GET /api/admin/users` · `PATCH /api/admin/users/:id` · `PATCH /api/admin/users/:id/block` · `POST /api/admin/staff`

#### Client (D:\UniAssist\client)

New Redux slices:
- `redux/slices/issueSlice.js` — student + staff thunks; state: `myIssues`, `deptIssues`, `selectedIssue`, `loading`, `submitting`
- `redux/slices/notificationSlice.js` — list, unread count, mark-read, mark-all-read
- `redux/slices/departmentSlice.js` — `fetchDepartments` (called on app load after auth, populates the issue submission dropdown)

New pages:
- `student/pages/Issues.jsx` — dashboard, status filter chips, status badges, polling, empty state
- `student/pages/CreateIssue.jsx` — form with title/description/category/department + multi-file picker (client-side validation matches server limits)
- `student/pages/IssueDetail.jsx` — full issue view with attachments, threaded replies, student reply textarea, polling
- `staff/pages/StaffIssues.jsx` — dept-scoped inbox with status counts in the filter chips
- `staff/pages/StaffIssueDetail.jsx` — issue view with student info card, status pill row (one click changes status), reply textarea

New component:
- `components/NotificationBell.jsx` — bell + red unread badge in sidebar header. Dropdown shows last 50 notifications with time-ago. Click marks read + navigates. "Mark all read" button. Polls unread count every 20s.

Modified files:
- `redux/store.js` — registered new slices
- `auth/ProtectedRoute.jsx` — wired up the previously-unused `roles` prop, redirects mismatched roles to their landing page; force-logs-out on `isBlocked`
- `components/Sidebar.jsx` — conditional nav by role (student gets Chat/Issues/Jobs/Events, staff gets Department Inbox, admin gets Chat for now); added `<NotificationBell />` next to the avatar; staff/admin skip the chat list
- `App.jsx` — new routes for `/issues`, `/issues/new`, `/issues/:id`, `/staff/issues`, `/staff/issues/:id`. Wraps `/chat`, `/jobs`, `/events`, `/issues/*`, `/staff/issues/*` in `ProtectedRoute roles={...}`. Calls `fetchDepartments` once after login.
- `auth/Login.jsx` — post-login redirect is role-aware: staff → `/staff/issues`, everyone else → `/chat`
- `redux/slices/authSlice.js` — `loginUser` no longer enforces MAJU email format (matches server change)

## How to run it from a fresh checkout

```powershell
# 1. .env additions in server/.env
#    ADMIN_EMAIL=admin@uniassist.local
#    ADMIN_PASSWORD=changeme123
#    CLIENT_URL=http://localhost:5173    # used in notification email links

# 2. Install + seed
cd server
npm install
node scripts/seedAdmin.js   # creates admin user, idempotent

# 3. Boot all three services
cd server && npm run server         # http://localhost:3000
cd client && npm run dev            # http://localhost:5173
cd python && python run.py server   # http://localhost:8000

# 4. One-time setup as admin (Postman or curl)
#    POST /api/user/login           { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
#    POST /api/department  × 3      { code: "SFC" | "IT" | "HOD", name, description }
#    POST /api/admin/staff × 3      { name, email, password, departmentId, staffTitle }

# 5. Now register a student via the UI, submit an issue, log in as the matching staff to test
```

## Verification checklist (run through this when picking work back up)

- [ ] Server boots, no missing-module errors, "Gmail SMTP Connected" prints
- [ ] `node scripts/seedAdmin.js` creates admin (or says "already exists" on second run)
- [ ] Admin can `POST /api/department` for SFC/IT/HOD
- [ ] Admin can `POST /api/admin/staff` to create one staff per department
- [ ] Student registers + verifies → sees `/issues` empty state
- [ ] Student creates an issue with a PDF + image attachment → appears in dashboard as Pending
- [ ] Matching staff logs in → lands on `/staff/issues` → sees the new issue in their inbox
- [ ] Bell on staff side shows unread count → dropdown navigates to issue
- [ ] Staff changes status to "In Progress" → student dashboard reflects change within 20s, student gets email + bell increments
- [ ] Staff replies → student gets notified, sees reply in conversation thread
- [ ] Other-department staff cannot access this issue (`GET /api/issue/department/:id` → 403)
- [ ] Blocked user (admin sets `isBlocked=true`) gets force-logged-out on next request

## Open follow-ups

Items the spec lists or that we deferred for later:

- **Admin UI** — currently Postman only. FYP §4 covers the full panel: user management screens, department CRUD, role assignment, block/unblock, content management, vector DB browsing/editing.
- **SFO Portal §3.1 dashboard** — overview stats (open issues, resolved today, avg resolution time). Backend has the data; no UI yet.
- **Real-time via websockets** — replace 20s polling with socket.io when scale matters.
- **Cloud attachment storage** — `server/uploads/` is ephemeral on Vercel. Move to S3/Cloudinary before prod.
- **Notification preferences** — per-user opt-out for email vs in-app.
- **Issue priority field** — not in the spec but staff would likely want it.
- **Forgot/reset password flow** still enforces MAJU regex on both server and client. Fine for students; admin/staff would need a separate recovery path.
- **Python backend tasks** (per `doc/python backend task.txt`):
  - APIs for vector DB CRUD (admin will use these for the chatbot training data section)
  - Migrate Groq cloud LLM → local Llama 3B
  - Language detection API (English vs Roman Urdu)
  - Admin data management endpoints

## Notes / gotchas to remember

- **Auth header is the raw JWT, no `Bearer` prefix.** All client thunks use `Authorization: token` directly.
- **MAJU email regex is for student registration only now.** Login + admin-created accounts use generic email.
- **Guest sessions are still in-memory** on the server (lost on restart). Not related to issue tracking but worth knowing.
- **No tests anywhere.** Verify by exercising the UI; type-check passes don't mean features work.
- **`server/.env` has real credentials committed.** Don't rotate or expose without asking.
- **Polling pauses on hidden tabs** via `document.visibilityState === "visible"` check inside the interval callback.
- **Department soft-delete** — `DELETE /api/department/:id` flips `isActive=false` rather than removing the doc, so historical issues keep a valid `department` ref.
