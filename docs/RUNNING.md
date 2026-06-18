# How to Run the App

Step-by-step guide to run Chatbot Platform locally and in production.

---

## What you need

| Requirement | Notes |
|-------------|-------|
| **Python 3.11+** | 3.14 works; see [Python 3.14 note](#python-314) below |
| **Node.js 18+** | Comes with npm 9+ |
| **LLM API key** | From [OpenAI](https://platform.openai.com/), [OpenRouter](https://openrouter.ai/), [Z.AI](https://z.ai/), [Groq](https://console.groq.com/), or any OpenAI-compatible provider |

The app runs two processes:

| Service | URL | Port |
|---------|-----|------|
| Backend (FastAPI) | http://localhost:8000 | 8000 |
| Frontend (Vite) | http://localhost:5173 | 5173 |

---

## Option A — One command (recommended)

From the project root:

```bash
chmod +x scripts/dev.sh   # first time only
./scripts/dev.sh
```

On first run, the script:

1. Creates `backend/.venv` and installs Python dependencies
2. Starts the API on port **8000**
3. Starts the UI on port **5173**

Open **http://localhost:5173** in your browser.

Press `Ctrl+C` in the terminal to stop both servers.

> **Note:** Run `npm install` in `frontend/` once before using `dev.sh` if you have not installed frontend dependencies yet.

---

## Option B — Manual setup

Use two terminals if you prefer to run backend and frontend separately.

### Terminal 1 — Backend

```bash
cd backend

# 1. Virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Dependencies
pip install -r requirements.txt
# On Python 3.14 if pip build fails:
# PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt

# 3. Environment file
cp .env.example .env

# 4. Start API
uvicorn app.main:app --reload --port 8000
```

Verify the backend:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Swagger docs: **http://localhost:8000/docs**

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

The Vite dev server proxies `/api` to `http://localhost:8000`, so the frontend talks to the backend without extra CORS setup.

---

## Environment variables

Copy the example file and edit if needed:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | `change-me-to-a-random-secret-key` | JWT signing — **change before production** |
| `DATABASE_URL` | `sqlite:///./chatbot.db` | Database (SQLite file created in `backend/`) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed frontend origins |

Local development works with the defaults. No LLM keys go in `.env` — you configure those per agent in the UI.

---

## First-time usage

1. Go to **http://localhost:5173/register** and create an account
2. Log in at **/login**
3. On the dashboard, click **New Agent**
4. Open the agent → **LLM Settings** tab and configure your provider (see examples below)
5. Click **Save**
6. Switch to the **Chat** tab and send a message

Optional:

- **Prompts** tab — add named instruction templates
- **Files** tab — upload files (OpenAI provider only)
- Clear chat history from the Chat tab

---

## LLM provider setup (in the UI)

Configure these in each agent’s **LLM Settings** tab after the app is running.

### OpenAI

| Field | Value |
|-------|-------|
| Provider | OpenAI |
| API Key | `sk-...` |
| Model | `gpt-4o-mini` |

### OpenRouter

| Field | Value |
|-------|-------|
| Provider | OpenRouter |
| Base URL | `https://openrouter.ai/api/v1` |
| API Key | your OpenRouter key |
| Model | `openai/gpt-4o-mini` |

### Z.AI (GLM)

| Field | Value |
|-------|-------|
| Provider | Custom |
| Base URL | `https://api.z.ai/api/paas/v4` |
| API Key | your Z.AI key |
| Model | `glm-5.1` or `glm-5.2` |

### Groq

| Field | Value |
|-------|-------|
| Provider | Custom |
| Base URL | `https://api.groq.com/openai/v1` |
| API Key | your Groq key |
| Model | `llama-3.3-70b-versatile` |

### Local (Ollama)

| Field | Value |
|-------|-------|
| Provider | Custom |
| Base URL | `http://localhost:11434/v1` |
| API Key | any placeholder (e.g. `ollama`) |
| Model | your pulled model name |

---

## Production

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Use PostgreSQL instead of SQLite:

```env
DATABASE_URL=postgresql://user:password@host:5432/chatbot
SECRET_KEY=<long-random-secret>
CORS_ORIGINS=https://your-frontend-domain.com
```

### Frontend

```bash
cd frontend
npm run build
```

Deploy the `frontend/dist` folder to Vercel, Netlify, or similar. Point `/api` at your backend (reverse proxy or env-based API URL).

Preview the production build locally:

```bash
npm run preview
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pip install` fails on Python 3.14 | `PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt` |
| Frontend shows network errors | Confirm backend is on port **8000** and frontend on **5173** |
| `npm run dev` fails | Run `npm install` in `frontend/` first |
| Chat says API key not configured | Set key in **LLM Settings** and click **Save** |
| `401 Unauthorized` | Log in again — JWT may have expired (default: 7 days) |
| Stale or corrupt data | Stop backend, delete `backend/chatbot.db`, restart (tables recreate on startup) |
| Port already in use | Stop the other process or change ports in `uvicorn` / `vite.config.ts` |

### Python 3.14

Some native dependencies may need:

```bash
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
pip install -r requirements.txt
```

The `dev.sh` script sets this automatically on first install.

---

## Quick reference

```bash
# Start everything
./scripts/dev.sh

# Backend only
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend only
cd frontend && npm run dev

# Health check
curl http://localhost:8000/api/health

# Reset database
rm backend/chatbot.db   # with backend stopped
```

---

## See also

- [Main README](../README.md) — project overview and API reference
- [Architecture & design](ARCHITECTURE.md) — how the system is built
