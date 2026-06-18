# Chatbot Platform

A minimal multi-user chatbot platform with JWT authentication, project/agent management, customizable LLM providers, streaming chat, and file uploads.

![Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## Features

- **Authentication** — JWT-based user registration and login
- **Projects/Agents** — Create and manage AI agents per user
- **Customizable LLM** — Configure provider (OpenAI, OpenRouter, custom), API key, base URL, and model per project
- **Prompts** — Store and associate prompt templates with each agent
- **Streaming Chat** — Real-time chat via OpenAI Responses API or OpenRouter
- **File Upload** — Upload files to OpenAI Files API (OpenAI provider)

## Quick Start

### Prerequisites

- Python 3.11+ (3.14 supported; use `PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1` when creating venv on 3.14)
- Node.js 18+
- An API key from [OpenAI](https://platform.openai.com/) or [OpenRouter](https://openrouter.ai/)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Edit SECRET_KEY if deploying
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Usage

1. **Register** a new account
2. **Create an agent** from the dashboard
3. Open **LLM Settings** tab and configure:
   - Provider (OpenAI / OpenRouter / Custom)
   - API Key
   - Model (e.g. `gpt-4o-mini` or `openai/gpt-4o-mini`)
4. Optionally add **Prompt templates** and **upload files**
5. Start **chatting** in the Chat tab

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/projects` | List/create projects |
| PATCH | `/api/projects/{id}` | Update project & LLM settings |
| GET/POST | `/api/projects/{id}/prompts` | Manage prompts |
| GET | `/api/projects/{id}/messages` | Chat history |
| POST | `/api/projects/{id}/chat` | Send message (non-streaming) |
| POST | `/api/projects/{id}/chat/stream` | Send message (SSE streaming) |
| GET/POST | `/api/projects/{id}/files` | List/upload files |

All endpoints except auth require `Authorization: Bearer <token>`.

## LLM Provider Configuration

| Provider | Base URL | Notes |
|----------|----------|-------|
| **OpenAI** | (default) | Uses [Responses API](https://platform.openai.com/docs/api-reference/responses) |
| **OpenRouter** | `https://openrouter.ai/api/v1` | Uses chat completions endpoint |
| **Custom** | Your endpoint | Any OpenAI-compatible API (e.g. Ollama, LM Studio) |

## Project Structure

```
chatbot-platform/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── auth.py          # JWT & password hashing
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── routes/          # API routes
│   │   └── services/llm.py   # LLM integration
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/           # Login, Dashboard, Project
│       ├── components/      # UI components
│       └── lib/api.ts       # API client
└── docs/
    └── ARCHITECTURE.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (required in prod) | JWT signing key |
| `DATABASE_URL` | `sqlite:///./chatbot.db` | Database connection |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |

## Production Deployment

For production, consider:

- Use PostgreSQL instead of SQLite (`DATABASE_URL=postgresql://...`)
- Set a strong `SECRET_KEY`
- Deploy backend (e.g. Railway, Render, Fly.io) and frontend (e.g. Vercel, Netlify)
- Enable HTTPS

## License

MIT
