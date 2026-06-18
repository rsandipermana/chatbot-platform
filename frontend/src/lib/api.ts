const API_BASE = '/api'

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
  ...(options.headers as Record<string, string>),
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let detail = 'Request failed'
    try {
      const err = await res.json()
      detail = err.detail || detail
      if (Array.isArray(detail)) {
        detail = detail.map((d: { msg?: string }) => d.msg).join(', ')
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, String(detail))
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export interface User {
  id: number
  email: string
  created_at: string
}

export type LLMProvider = 'openai' | 'openrouter' | 'custom'

export interface Project {
  id: number
  name: string
  description: string | null
  system_prompt: string | null
  llm_provider: LLMProvider
  llm_base_url: string | null
  llm_model: string
  has_api_key: boolean
  llm_api_key?: string | null
  created_at: string
  updated_at: string
}

export interface Prompt {
  id: number
  project_id: number
  name: string
  content: string
  created_at: string
}

export interface Message {
  id: number
  project_id: number
  role: string
  content: string
  created_at: string
}

export interface ProjectFile {
  id: number
  project_id: number
  filename: string
  openai_file_id: string | null
  size_bytes: number | null
  created_at: string
}

export const api = {
  register: (email: string, password: string) =>
    request<User>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: async (email: string, password: string) => {
    const data = await request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.access_token)
    return data
  },

  me: () => request<User>('/auth/me'),

  listProjects: () => request<Project[]>('/projects'),

  createProject: (data: Partial<Project> & { name: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  getProject: (id: number) => request<Project>(`/projects/${id}`),

  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  listPrompts: (projectId: number) => request<Prompt[]>(`/projects/${projectId}/prompts`),

  createPrompt: (projectId: number, name: string, content: string) =>
    request<Prompt>(`/projects/${projectId}/prompts`, {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    }),

  deletePrompt: (projectId: number, promptId: number) =>
    request<void>(`/projects/${projectId}/prompts/${promptId}`, { method: 'DELETE' }),

  listMessages: (projectId: number) => request<Message[]>(`/projects/${projectId}/messages`),

  chat: (projectId: number, message: string) =>
    request<{ user_message: Message; assistant_message: Message }>(`/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  chatStream: async function* (projectId: number, message: string) {
    const token = getToken()
    const res = await fetch(`${API_BASE}/projects/${projectId}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    })

    if (!res.ok) {
      let detail = 'Stream failed'
      try {
        const err = await res.json()
        detail = err.detail || detail
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, String(detail))
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield JSON.parse(line.slice(6))
        }
      }
    }
  },

  listFiles: (projectId: number) => request<ProjectFile[]>(`/projects/${projectId}/files`),

  uploadFile: (projectId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ProjectFile>(`/projects/${projectId}/files`, { method: 'POST', body: form })
  },

  deleteFile: (projectId: number, fileId: number) =>
    request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
}

export { ApiError }
