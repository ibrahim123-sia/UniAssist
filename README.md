# UniAssist 🎓
### Centralized AI Student Portal — Muhammad Ali Jinnah University (MAJU)

![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat&logo=react)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat&logo=nodedotjs)
![Python](https://img.shields.io/badge/AI-Python-3776AB?style=flat&logo=python)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

UniAssist is a full-stack AI-powered web and mobile platform that consolidates all MAJU student services into one intelligent system. At its core is a smart chatbot that supports voice input and Roman Urdu — making university help accessible to every student.

---

## ✨ Features

### 🎓 Student Portal
| Module | Description |
|--------|-------------|
| **Guest Page** | Public landing page showcasing portal features before login |
| **Auth** | Register / login with MAJU email, secure sessions, password recovery |
| **AI Chatbot** | Answers university queries with voice input & Roman Urdu support |
| **Issue Tracker** | Submit and track support requests; real-time status sync with SFO |
| **Job Portal** | AI bot helps search jobs & builds your profile from an uploaded CV |
| **Scholarship Portal** | Bot matches you with scholarships based on your academic profile |
| **MAJU Events** | All society and official university events with filters |
| **Profile Page** | Unified view of general info, job profile, and scholarship profile |

### 🏢 SFO Portal
| Module | Description |
|--------|-------------|
| **Issue Dashboard** | View and manage all student-submitted issues in one place |
| **Status Management** | Update issue status (Pending → In Progress → Resolved → Closed) |
| **Reply System** | Add written replies/descriptions to issues visible to students |

### ⚙️ Admin Panel
| Module | Description |
|--------|-------------|
| **User Management** | Manage all students, SFO staff, and admin accounts |
| **Content Control** | Manage events, job listings, scholarships, and chatbot knowledge base |
| **Logs & Analytics** | Full activity logs, chatbot conversation logs, issue analytics |

### 📱 Mobile App
Cross-platform mobile application for all user roles with push notifications.

---

## 🛠️ Tech Stack

```
Frontend      →  React.js
User & API    →  Node.js / Express
AI & Chatbot  →  Python (NLP, CV parsing, voice, Roman Urdu)
Mobile        →  React Native
Database      →  MongoDB / PostgreSQL
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/uniassist.git
cd uniassist

# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install

# Install AI service dependencies
cd ../ai && pip install -r requirements.txt
```

### Running Locally

```bash
# Start backend (from /server)
npm run dev

# Start AI service (from /ai)
python app.py

# Start frontend (from /client)
npm run dev
```

---

## 📁 Project Structure

```
uniassist/
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Student, SFO, Admin pages
│   │   └── components/
├── server/          # Node.js backend
│   ├── routes/
│   ├── controllers/
│   └── models/
├── ai/              # Python AI service
│   ├── chatbot/     # NLP & chatbot engine
│   ├── cv_parser/   # CV extraction
│   └── voice/       # Voice & Roman Urdu
└── mobile/          # React Native app
```

---

## 👥 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

[MIT](LICENSE) — Muhammad Ali Jinnah University FYP Project
