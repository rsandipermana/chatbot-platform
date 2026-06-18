# Architecture & Design

## Overview

Chatbot Platform is a full-stack web application that enables multiple users to create AI chatbot agents with customizable LLM configurations. The system follows a classic three-tier architecture:

```
┌─────────────┐     HTTPS/REST     ┌─────────────┐     API Calls     ┌──────────────┐
│   React     │ ◄────────────────► │   FastAPI   │ ◄───────────────► │  LLM Service │
│  Frontend   │    JWT Auth + SSE  │   Backend   │  OpenAI/OpenRouter│  (External)  │
└─────────────┘                    └──────┬──────┘                   └──────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │   SQLite /   │
                                   │  PostgreSQL  │
                                   └─────────────┘
```

## Design Principles

### Scalability

- **Stateless API**: JWT tokens carry authentication; no server-side sessions. Horizontal scaling is straightforward.
- **Per-project LLM config**: Each agent has isolated LLM settings, allowing different providers/models per use case.
- **Streaming responses**: Server-Sent Events (SSE) reduce perceived latency for chat.
- **Database abstraction**: SQLAlchemy ORM supports swapping SQLite (dev) for PostgreSQL (production).

### Security

- **Password hashing**: bcrypt via passlib; passwords never stored in plaintext.
- **JWT authentication**: Short-lived tokens with HS256 signing; all protected routes require valid Bearer token.
- **Authorization**: Users can only access their own projects, prompts, messages, and files (enforced at route level).
- **API keys**: Stored per-project in the database; only returned to the owning user via authenticated endpoints.

### Extensibility

The modular structure supports future additions:

| Module | Extension Point |
|--------|----------------|
| `services/llm.py` | Add new LLM providers by implementing adapter functions |
| `routes/` | New route modules for analytics, webhooks, integrations |
| `models.py` | New entities (teams, API usage logs, webhooks) |
| Frontend tabs | Plugin-style UI panels per feature |

### Performance

- Async FastAPI handlers for I/O-bound LLM calls
- Streaming chat avoids waiting for full response before displaying tokens
- Database indexes on `user_id`, `project_id` foreign keys
- Frontend proxy in dev; CDN-ready static build for production

### Reliability

- Structured HTTP error responses with meaningful messages
- LLM errors caught and returned as 502 with detail
- Graceful handling of missing API keys before making external calls
- File upload size limit (20MB)

## Data Model

```
User
 ├── Project (1:N)
 │    ├── Prompt (1:N)      — named prompt templates
 │    ├── Message (1:N)     — chat history
 │    └── ProjectFile (1:N) — uploaded files
```

### Key Entities

- **User**: Email + hashed password. Owns all projects.
- **Project**: An AI agent with LLM configuration (provider, API key, model, base URL) and optional system prompt.
- **Prompt**: Named content blocks merged into the LLM instructions at chat time.
- **Message**: User/assistant messages forming conversation history.
- **ProjectFile**: Metadata for files uploaded to OpenAI Files API.

## Authentication Flow

```
1. POST /auth/register  →  Create user, hash password
2. POST /auth/login     →  Verify credentials, return JWT
3. Client stores token  →  localStorage
4. All API calls        →  Authorization: Bearer <token>
5. Backend middleware   →  Decode JWT, load user, enforce ownership
```

## Chat Flow

```
1. User sends message via POST /chat/stream
2. Backend saves user message to DB
3. Load project config + prompts + history
4. Build instructions (system prompt + prompt templates)
5. Call LLM provider (streaming):
   - OpenAI: Responses API with stream=true
   - OpenRouter: Chat Completions with stream=true
6. Stream tokens to client via SSE
7. Save complete assistant message to DB
```

## LLM Integration

The `services/llm.py` module abstracts provider differences:

| Provider | API | Streaming |
|----------|-----|-----------|
| OpenAI | Responses API (`client.responses.create`) | Native SSE from SDK |
| OpenRouter | Chat Completions (`/chat/completions`) | Manual SSE parsing |
| Custom | OpenAI-compatible endpoint | Via OpenAI SDK or OpenRouter path |

Instructions are built by concatenating the project's system prompt with all associated prompt templates.

## Frontend Architecture

- **React 19 + TypeScript + Vite** for fast development
- **React Router** for client-side navigation with protected routes
- **Auth Context** for global auth state
- **Tailwind CSS v4** with custom dark theme and glass-morphism UI
- **API client** (`lib/api.ts`) centralizes all backend communication including SSE streaming

## Deployment Topology (Recommended)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel /   │    │   Railway /  │    │  PostgreSQL  │
│   Netlify    │───►│   Render     │───►│   (managed)  │
│  (Frontend)  │    │  (Backend)   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

## Future Enhancements

- Team/organization support with role-based access
- Usage analytics and token counting
- Webhook integrations (Slack, Discord)
- RAG with vector store for uploaded documents
- Rate limiting per user/project
- OAuth2 social login (Google, GitHub)
