# UniAssist

> A centralized AI student portal for Muhammad Ali Jinnah University (MAJU) — a Retrieval-Augmented Generation chatbot with voice and Roman-Urdu support, an issue tracker, a staff department portal, and an admin panel with a vector-database knowledge-base manager.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-2-764ABC?logo=redux&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![ChromaDB](https://img.shields.io/badge/Vector_DB-ChromaDB-FF6F61)
![Sentence Transformers](https://img.shields.io/badge/Embeddings-all--MiniLM--L6--v2-FFD21E?logo=huggingface&logoColor=black)
![Whisper](https://img.shields.io/badge/STT-faster--whisper-000000)
![Expo](https://img.shields.io/badge/Mobile-Expo_/_React_Native-000020?logo=expo&logoColor=white)

UniAssist unifies every routine student interaction with the university behind one AI-first interface. Students (and guests) chat with **MAJU Assistant**, a RAG assistant grounded in the university's own website content and admin-curated documents — in English, Roman Urdu, or a mix, by text or voice. Beyond the chatbot, students raise support tickets to specific departments, staff triage and resolve them, and admins manage users, departments, audit trails, and the underlying vector knowledge base from a dedicated dashboard.

<p align="center">
  <img src="preview.png" alt="UniAssist preview" width="100%"/>
</p>

## ✨ Features

### 🤖 AI Assistant (RAG)
- **Retrieval-Augmented Generation** grounded in scraped MAJU website content plus admin-uploaded documents — answers are drawn from a vector store, never hallucinated free-form.
- **Hybrid retrieval**: semantic vector search (ChromaDB + `all-MiniLM-L6-v2` embeddings) merged with a TF-IDF keyword fallback so exact terms (fees, emails, course codes) are never missed.
- **Conversation memory**: the last few turns are forwarded to the LLM so follow-ups like *"and its fee?"* resolve correctly; elliptical questions also re-prepend the prior topic to the retrieval query.
- **Multilingual output**: English, Roman Urdu, and mixed replies. A language detector picks the target, and a layered guard forces Latin-script Roman Urdu with Urdu (not Hindi) vocabulary.
- **Voice input**: record a question, transcribe it locally with `faster-whisper` (self-hosted Whisper, no cloud STT), then review or send.
- **Pluggable LLM backend**: local **Ollama** (Llama 3.2) by default, or cloud failover across **Groq** and **Google Gemini** with multi-key rollover on rate limits.
- **Content moderation**: every question is screened; flagged messages are refused and the user is reported to admins via an internal webhook.
- **Guest mode**: unauthenticated visitors can chat via a session-scoped history without an account.

### 🎫 Issue Tracker & Department Portal
- Students create tickets (with file attachments) routed to a department; track status and reply in a threaded conversation.
- **Staff portal** for department members: dashboard stats, assigned/department issue queues, status updates, ticket assignment, and staff replies.
- In-app notifications and email notifications on ticket activity.

### 🛠️ Admin Panel
- Dashboard with charts (recharts) for users, issues, and activity analytics.
- **Vector knowledge-base manager**: browse, search, add, edit, and delete chunks, and upload PDF/DOCX/TXT documents that are auto-split, embedded, and indexed into ChromaDB — all secured behind admin-only JWT auth.
- User management (view/update/block), staff account provisioning, and department CRUD.
- Audit logs, login-event history, and full chat-log inspection.

### 🎓 Student Extras
- **Scholarships** page with a semester-fee calculator, **Events** and **Jobs** feeds (sourced from Apify datasets), and profile management with avatar upload.
- Light/dark theme, OTP email verification, and password reset flows.

### 📱 Mobile App
- An Expo / React Native client (`mobile/`) sharing the same Node and Python backends.

## 🛠️ Tech Stack

| Layer | Technologies |
| --- | --- |
| **Web client** (`client/`) | React 19, Vite 7, Redux Toolkit, React Router 7, Tailwind CSS 4, recharts, axios, react-markdown, lucide-react |
| **API server** (`server/`) | Node.js, Express 5, MongoDB (Mongoose), JWT auth, bcryptjs, multer uploads, nodemailer, express-rate-limit |
| **AI service** (`python/`) | FastAPI, Uvicorn, ChromaDB, sentence-transformers (`all-MiniLM-L6-v2`), faster-whisper, Ollama / Groq / Gemini, BeautifulSoup scraper, langchain-text-splitters |
| **Mobile** (`mobile/`) | Expo, React Native, React Navigation, Redux Toolkit + redux-persist |

### How the pieces fit

```
                 ┌──────────────┐        ┌──────────────┐        ┌────────────────────────┐
  Browser  ────▶ │  client/     │ ─────▶ │  server/     │ ─────▶ │  python/ (FastAPI)     │
  / Mobile       │  React+Vite  │  REST  │  Express+    │  HTTP  │  RAG + Whisper STT     │
                 │  (5173)      │        │  MongoDB     │        │  (8000)                │
                 └──────────────┘        │  (3000)      │        │   │                    │
                                         └──────────────┘        │   ▼                    │
                                                                 │  ChromaDB vector store │
                                                                 │  + Ollama/Groq/Gemini  │
                                                                 └────────────────────────┘
```

- The **client** talks to the Node **server** for auth, chats, issues, notifications, and admin data, and directly to the **Python** service for admin vector-DB operations.
- The **server** proxies chat and voice requests to the Python `/ask` and `/transcribe` endpoints, attaching trimmed conversation history and user context.
- The **Python** service performs retrieval + generation and calls back to Node's internal endpoints to verify admin JWTs and flag abusive users.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ and pip
- MongoDB (local or Atlas connection string)
- (Optional) [Ollama](https://ollama.com) with a model pulled (`ollama pull llama3.2:3b`) for local LLM inference, **or** a Groq / Gemini API key for cloud inference
- (Optional) `ffmpeg` on PATH for non-WAV voice transcription

### Installation

```bash
# 1. Web client
cd client
npm install

# 2. API server
cd ../server
npm install

# 3. Python AI service
cd ../python
pip install -r requirements.txt

# 4. (Optional) Mobile app
cd ../mobile
npm install
```

### Environment variables

Create the `.env` files below. Use your own values — never commit real secrets.

**`server/.env`**

```env
PORT=3000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<random-secret>
INTERNAL_SECRET=<shared-secret-with-python-service>
PYTHON_BACKEND_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
EMAIL_USER=<smtp-email-address>
EMAIL_PASS=<smtp-app-password>
GEMINI_API_KEY=<optional-gemini-key>
UPLOAD_DIR=uploads
```

**`python/.env`**

```env
# Auth bridge to Node (must match server values)
JWT_SECRET=<same-as-server-JWT_SECRET>
INTERNAL_SECRET=<same-as-server-INTERNAL_SECRET>
NODE_INTERNAL_URL=http://localhost:3000
CORS_ALLOW_ORIGINS=http://localhost:5173

# LLM backend: local Ollama (default) or cloud
USE_LOCAL_LLM=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
# Cloud fallback (used when USE_LOCAL_LLM=false)
CLOUD_LLM_ORDER=groq,gemini
GROQ_API_KEY=<optional-groq-key>
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=<optional-gemini-key>
GEMINI_MODEL=gemini-2.5-flash

# Speech-to-text
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

**`client/.env`**

```env
VITE_SERVER_URL=http://localhost:3000
VITE_PYTHON_URL=http://localhost:8000
VITE_APIFY_API_URL=<optional-apify-events-dataset-url>
VITE_APIFY_JOBS_API=<optional-apify-jobs-dataset-url>
```

**`mobile/.env`** (see `mobile/.env.example`)

```env
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
EXPO_PUBLIC_PYTHON_URL=http://localhost:8000
EXPO_PUBLIC_APIFY_API_URL=
EXPO_PUBLIC_APIFY_JOBS_API=
```

### Running locally

Run each service in its own terminal.

```bash
# Python AI service — FastAPI on http://localhost:8000
cd python
python run.py scrape   # (first run) scrape MAJU site into ./data
python run.py build    # (first run) embed chunks into ChromaDB
python run.py server   # start the API

# API server — Express on http://localhost:3000
cd server
npm run server         # dev (nodemon)  |  npm start for production

# Web client — Vite on http://localhost:5173
cd client
npm run dev

# Mobile app (optional)
cd mobile
npm start              # Expo dev server
```

Then open **http://localhost:5173**.

## 📁 Project Structure

```
UniAssist/
├── client/                 # React 19 + Vite web app (port 5173)
│   └── src/
│       ├── auth/           # Login, Register, ProtectedRoute
│       ├── guest/          # Public guest chat
│       ├── student/        # Chat, Issues, Jobs, Events, Scholarships
│       ├── staff/          # Department portal (dashboard, issue triage)
│       ├── administrator/  # Admin dashboard, users, data (KB), logs
│       ├── profile/        # Profile management
│       └── redux/          # Redux Toolkit store & slices
├── server/                 # Node/Express + MongoDB API (port 3000)
│   ├── controllers/        # chat, guest, message, user, admin, issue, ...
│   ├── models/             # User, Chat, Issue, Department, AuditLog, ...
│   ├── routes/             # REST route definitions
│   ├── middlewares/        # auth, requireRole, upload, audit
│   └── services/           # email/notification helpers
├── python/                 # FastAPI RAG + STT service (port 8000)
│   ├── api.py              # FastAPI app: /ask, /transcribe, admin CRUD
│   ├── rag.py              # Retrieval → prompt → LLM pipeline
│   ├── database.py         # ChromaDB build + hybrid search
│   ├── scraper.py          # MAJU website scraper & chunker
│   ├── transcribe.py       # faster-whisper speech-to-text
│   ├── moderation.py       # profanity/abuse detection
│   ├── language_detect.py  # English / Roman-Urdu classifier
│   ├── config.py           # central configuration
│   └── run.py              # CLI: scrape | build | server | ask | test
└── mobile/                 # Expo / React Native app
```

---

<p align="center">Built by <b>Syed Ibrahim Ali</b> — Full-Stack &amp; AI Engineer</p>
