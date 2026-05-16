# UniAssist 🎓
### Centralized AI Student Portal — Muhammad Ali Jinnah University (MAJU)

![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat&logo=react)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat&logo=nodedotjs)
![Python](https://img.shields.io/badge/AI-Python-3776AB?style=flat&logo=python)
![React Native](https://img.shields.io/badge/Mobile-React_Native-61DAFB?style=flat&logo=react)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

UniAssist is a full-stack AI-powered web and mobile platform that consolidates all MAJU student services into one intelligent system. At its core is a smart chatbot that supports voice input and Roman Urdu — making university help accessible to every student.

---

## ✨ Features

### 🎓 Student Portal
| Module | Status | Description |
|--------|--------|-------------|
| **Guest Page** | ✅ | Public landing page showcasing portal features before login |
| **Auth** | ✅ | Register / login with MAJU email, OTP verification, password recovery |
| **AI Chatbot** | ✅ | Answers university queries via RAG over MAJU website; voice input + Roman Urdu support; profanity filter with admin flagging |
| **Issue Tracker** | ✅ | Submit and track support requests with attachments; 20s polling sync with department staff; in-app bell + email notifications |
| **Job Portal** | ⏳ FYP-2 | AI bot helps search jobs & builds your profile from an uploaded CV |
| **Scholarship Portal** | ⏳ FYP-2 | Bot matches you with scholarships based on your academic profile |
| **MAJU Events** | ⏳ FYP-2 | All society and official university events with filters |
| **Profile Page** | ⏳ FYP-2 | Unified view of general info, job profile, and scholarship profile |

### 🏢 Staff Portal (Department-scoped)
| Module | Status | Description |
|--------|--------|-------------|
| **Dashboard** | ✅ | Open / In Progress / Resolved-this-week cards, 7-day trend chart, avg first-response time, recent issues, your own reply count |
| **Department Inbox** | ✅ | Only your department's issues; filter by status with live counts; 20s polling |
| **Issue Detail** | ✅ | Full thread with student info, attachments, all replies |
| **Status Management** | ✅ | Update status (Pending → In Progress → Resolved → Closed); student notified by bell + email |
| **Reply System** | ✅ | Threaded replies to students; notification fires on every reply |

### ⚙️ Admin Panel
| Module | Status | Description |
|--------|--------|-------------|
| **Dashboard** | ✅ | Stat cards (students/staff/admins/departments/issues/chats/flagged) + 7-day issue trend + recent signups |
| **Users** | ✅ | List students with search and filters (blocked / flagged); detail drawer with issues, chats, flags; block/unblock with confirm |
| **Staff** | ✅ | Create staff with auto-generated `firstnamelastname@maju.<deptcode>.edu` + 12-char password (shown once + emailed); filter by department; deactivate |
| **Departments** | ✅ | Create / edit inline / soft-deactivate; reactivate |
| **Query** | ✅ | Cross-department issue analytics — top categories, by-department, avg resolution time, filterable table, read-only detail |
| **Data (Vector DB)** | ✅ | Direct-to-Python CRUD on the chatbot knowledge base; edit/add chunks; upload PDF / DOCX / TXT with auto chunking + embedding |
| **Logs & Activity** | ✅ | Three tabs: admin action audit (with redacted payload), login events (success + failures), chat browser with flagged-student filter |
| **Content Management** | ⏳ FYP-2 | Events, jobs, scholarships — deferred with the student modules they power |

### 📱 Mobile App
⏳ FYP-2 — Cross-platform React Native app for all user roles with push notifications and offline support.

---

## 🛠️ Tech Stack

```
client/    →  React 19 + Redux Toolkit + Tailwind + Vite (Student, Staff & Admin UI)
server/    →  Node.js / Express + MongoDB / Mongoose (Auth, APIs, audit, notifications)
python/    →  FastAPI + ChromaDB + sentence-transformers (RAG, moderation, vector CRUD)
mobile/    →  React Native (iOS & Android) — FYP-2
```

**Key libraries:** `recharts` (admin/staff dashboards), `react-hot-toast`, `lucide-react`, `multer`, `nodemailer` (Gmail SMTP), `pyjwt`, `pypdf`, `python-docx`, `langchain-text-splitters`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+
- MongoDB running locally or a cloud URI
- npm

### Installation

```bash
git clone https://github.com/ibrahim123-sia/UniAssist.git
cd UniAssist

# Install dependencies
cd client && npm install
cd ../server && npm install
cd ../python && pip install -r requirements.txt
```

### Required env vars

`server/.env`
```
MONGO_URI=...
JWT_SECRET=<long-random-string>
EMAIL_USER=<gmail-address>
EMAIL_PASS=<gmail-app-password>
ADMIN_EMAIL=admin@uniassist.local
ADMIN_PASSWORD=changeme123
CLIENT_URL=http://localhost:5173
PYTHON_BACKEND_URL=http://localhost:8000
INTERNAL_SECRET=<long-random-string, must match python/.env>
```

`python/.env`
```
JWT_SECRET=<same value as server/.env>
NODE_INTERNAL_URL=http://localhost:3000
INTERNAL_SECRET=<same value as server/.env>
# Ollama (local Llama 3.2:3b) — start the tray app or `ollama serve` first
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=300
# Whisper (local STT, faster-whisper)
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

`client/.env`
```
VITE_SERVER_URL=http://localhost:3000
VITE_PYTHON_URL=http://localhost:8000
```

### Seed the first admin

```bash
cd server
node scripts/seedAdmin.js   # idempotent — creates or promotes the admin in .env
```

### Running locally

```bash
# Start backend  (from /server)
npm run server          # → http://localhost:3000

# Start AI service  (from /python)
python run.py server    # → http://localhost:8000

# Start frontend  (from /client)
npm run dev             # → http://localhost:5173
```

Log in as the admin you seeded, create departments + staff from the admin panel, then register a student through the UI to exercise the full flow.

---

## 📁 Project Structure

```
UniAssist/
├── client/                       # React frontend
│   └── src/
│       ├── administrator/        # /admin/* pages, components, layout
│       ├── staff/                # /staff/dashboard + /staff/issues
│       ├── student/              # chat, issues, profile (jobs/events stubs)
│       ├── guest/                # public landing
│       ├── auth/                 # login, register, ProtectedRoute
│       ├── components/           # Sidebar, NotificationBell, MainLayout
│       ├── redux/slices/         # auth, chat, issue, notification,
│       │                         # department, admin{Stats,User,Staff,
│       │                         # Query,Data,Log} slices
│       └── utils/                # axios, pythonAxios
├── server/                       # Node.js / Express
│   ├── controllers/              # user, chat, issue, department,
│   │                             # notification, admin*, internal, message
│   ├── middlewares/              # auth, requireRole, upload, audit
│   ├── models/                   # User, Issue, Department, Chat,
│   │                             # Notification, AuditLog, LoginEvent
│   ├── routes/                   # *Routes.js
│   ├── services/notify.js        # email + in-app bell helper
│   └── scripts/seedAdmin.js
├── python/                       # FastAPI RAG + admin vector CRUD
│   ├── api.py                    # /ask + admin /chunks + /documents
│   ├── rag.py                    # RAG pipeline
│   ├── database.py               # ChromaDB ops
│   ├── moderation.py             # English + Roman-Urdu profanity check
│   ├── scraper.py                # web scraper for MAJU pages
│   └── chroma_db/                # persistent vector store (gitignored)
└── mobile/                       # FYP-2 React Native app
```

---

## 👥 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

[MIT](LICENSE) — Muhammad Ali Jinnah University FYP Project
