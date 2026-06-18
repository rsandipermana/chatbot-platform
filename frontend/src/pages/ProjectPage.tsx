import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Bot,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api, type LLMProvider, type Message, type Project, type ProjectFile, type Prompt } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { cn } from '../lib/utils'

type Tab = 'chat' | 'settings' | 'prompts' | 'files'

interface Props {
  projectId: number
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (Responses API)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
]

const MODEL_SUGGESTIONS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'],
  custom: ['glm-5.1', 'glm-5.2', 'gpt-4o-mini', 'llama-3.3-70b-versatile'],
}

type ChatStatus = 'idle' | 'connecting' | 'thinking' | 'streaming'

export function ProjectPage({ projectId }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    system_prompt: '',
    llm_provider: 'openai' as LLMProvider,
    llm_api_key: '',
    llm_base_url: '',
    llm_model: 'gpt-4o-mini',
  })

  // Prompt form
  const [promptName, setPromptName] = useState('')
  const [promptContent, setPromptContent] = useState('')

  const load = async () => {
    const [p, m, pr, f] = await Promise.all([
      api.getProject(projectId),
      api.listMessages(projectId),
      api.listPrompts(projectId),
      api.listFiles(projectId),
    ])
    setProject(p)
    setMessages(m)
    setPrompts(pr)
    setFiles(f)
    setSettingsForm({
      name: p.name,
      description: p.description || '',
      system_prompt: p.system_prompt || '',
      llm_provider: p.llm_provider,
      llm_api_key: p.llm_api_key || '',
      llm_base_url: p.llm_base_url || '',
      llm_model: p.llm_model,
    })
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [projectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, chatStatus])

  const statusLabel: Record<ChatStatus, string> = {
    idle: '',
    connecting: 'Menghubungkan ke AI...',
    thinking: 'AI sedang memproses...',
    streaming: 'AI sedang mengetik...',
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setStreaming('')
    setChatStatus('connecting')
    setError('')

    const tempUser: Message = {
      id: Date.now(),
      project_id: projectId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, tempUser])

    try {
      for await (const event of api.chatStream(projectId, text)) {
        if (event.type === 'status') {
          setChatStatus(event.content as ChatStatus)
        } else if (event.type === 'token') {
          setChatStatus('streaming')
          setStreaming((s) => s + event.content)
        } else if (event.type === 'error') {
          setError(event.content)
        } else if (event.type === 'done') {
          setMessages((m) => [...m, event.message])
          setStreaming('')
          setChatStatus('idle')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed')
      setStreaming('')
      setChatStatus('idle')
    } finally {
      setSending(false)
      setChatStatus('idle')
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateProject(projectId, {
        name: settingsForm.name,
        description: settingsForm.description || null,
        system_prompt: settingsForm.system_prompt || null,
        llm_provider: settingsForm.llm_provider,
        llm_api_key: settingsForm.llm_api_key || null,
        llm_base_url: settingsForm.llm_base_url || null,
        llm_model: settingsForm.llm_model,
      })
      setProject(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = await api.createPrompt(projectId, promptName, promptContent)
    setPrompts((prev) => [p, ...prev])
    setPromptName('')
    setPromptContent('')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await api.uploadFile(projectId, file)
      setFiles((f) => [uploaded, ...f])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    e.target.value = ''
  }

  if (!project) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'settings', label: 'LLM Settings', icon: Settings },
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'files', label: 'Files', icon: Paperclip },
  ]

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <header className="glass border-b border-border-subtle shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-surface-card text-text-muted hover:text-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-text truncate">{project.name}</h1>
            <p className="text-xs text-text-muted">{project.llm_provider} · {project.llm_model}</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 pb-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors border-b-2',
                tab === id
                  ? 'text-accent border-accent bg-accent-muted/30'
                  : 'text-text-muted border-transparent hover:text-text hover:bg-surface-card/50',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 flex flex-col min-h-0">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col flex-1 min-h-0 glass rounded-2xl overflow-hidden">
            {chatStatus !== 'idle' && (
              <div className="relative h-1 bg-surface-card shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-accent/20" />
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 bg-accent transition-all duration-300',
                    chatStatus === 'connecting' && 'w-1/4 animate-pulse',
                    chatStatus === 'thinking' && 'w-1/2 animate-pulse',
                    chatStatus === 'streaming' && 'w-full animate-[shimmer_1.5s_ease-in-out_infinite]',
                  )}
                  style={
                    chatStatus === 'streaming'
                      ? { background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)', backgroundSize: '200% 100%' }
                      : undefined
                  }
                />
              </div>
            )}
            {chatStatus !== 'idle' && (
              <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-2 text-xs text-text-muted shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                {statusLabel[chatStatus]}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && !streaming && (
                <div className="text-center py-16">
                  <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-muted">Start a conversation with your agent</p>
                  {!project.has_api_key && (
                    <p className="text-danger text-sm mt-2">
                      Configure your LLM API key in Settings first
                    </p>
                  )}
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-accent text-white rounded-br-md'
                        : 'bg-surface-card border border-border text-text rounded-bl-md',
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatStatus !== 'idle' && !streaming && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface-card border border-border flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed whitespace-pre-wrap bg-surface-card border border-border text-text">
                    {streaming}
                    <span className="inline-block w-2 h-4 bg-accent ml-1 animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-border-subtle">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-card border border-border text-text placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <Button onClick={handleSend} disabled={!input.trim() || sending} loading={sending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="glass rounded-2xl p-6 space-y-5 max-w-2xl">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent" />
              LLM Service Configuration
            </h2>
            <p className="text-sm text-text-muted -mt-2">
              Customize the AI provider, model, and API credentials for this agent.
            </p>

            <Input
              label="Agent Name"
              value={settingsForm.name}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              required
            />
            <Textarea
              label="Description"
              value={settingsForm.description}
              onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
              rows={2}
            />
            <Textarea
              label="System Prompt"
              value={settingsForm.system_prompt}
              onChange={(e) => setSettingsForm({ ...settingsForm, system_prompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              rows={4}
            />

            <div className="border-t border-border-subtle pt-5 space-y-4">
              <Select
                label="LLM Provider"
                value={settingsForm.llm_provider}
                onChange={(e) => {
                  const provider = e.target.value as LLMProvider
                  setSettingsForm({
                    ...settingsForm,
                    llm_provider: provider,
                    llm_model: MODEL_SUGGESTIONS[provider][0],
                    llm_base_url: provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : provider === 'custom' ? 'https://api.z.ai/api/paas/v4' : '',
                  })
                }}
                options={PROVIDER_OPTIONS}
              />
              <Input
                label="API Key"
                type="password"
                value={settingsForm.llm_api_key}
                onChange={(e) => setSettingsForm({ ...settingsForm, llm_api_key: e.target.value })}
                placeholder="sk-..."
              />
              <Input
                label="Base URL (optional)"
                value={settingsForm.llm_base_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, llm_base_url: e.target.value })}
                placeholder={
                  settingsForm.llm_provider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1'
                    : settingsForm.llm_provider === 'custom'
                      ? 'https://api.z.ai/api/paas/v4'
                      : 'Default OpenAI endpoint'
                }
              />
              <div>
                <Input
                  label="Model"
                  value={settingsForm.llm_model}
                  onChange={(e) => setSettingsForm({ ...settingsForm, llm_model: e.target.value })}
                  placeholder="gpt-4o-mini"
                  list="model-suggestions"
                />
                <datalist id="model-suggestions">
                  {MODEL_SUGGESTIONS[settingsForm.llm_provider].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            <Button type="submit" loading={saving}>
              Save Settings
            </Button>
          </form>
        )}

        {tab === 'prompts' && (
          <div className="space-y-6 max-w-2xl">
            <form onSubmit={handleAddPrompt} className="glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Add Prompt Template</h2>
              <Input
                label="Prompt Name"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="Greeting Style"
                required
              />
              <Textarea
                label="Prompt Content"
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="Always greet users warmly and..."
                required
              />
              <Button type="submit">Add Prompt</Button>
            </form>

            <div className="space-y-3">
              {prompts.map((p) => (
                <div key={p.id} className="glass rounded-xl p-4 flex justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-text">{p.name}</h3>
                    <p className="text-sm text-text-muted mt-1 whitespace-pre-wrap">{p.content}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await api.deletePrompt(projectId, p.id)
                      setPrompts((prev) => prev.filter((x) => x.id !== p.id))
                    }}
                    className="shrink-0 p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {prompts.length === 0 && (
                <p className="text-text-muted text-sm text-center py-8">No prompt templates yet</p>
              )}
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-6 max-w-2xl">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-2">Upload Files</h2>
              <p className="text-sm text-text-muted mb-4">
                Upload files to OpenAI Files API (requires OpenAI provider). Max 20MB.
              </p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/50 hover:bg-accent-muted/10 transition-colors">
                <Upload className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-text-muted">Click to upload</span>
                <input type="file" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="glass rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-4 h-4 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.filename}</p>
                      <p className="text-xs text-text-muted">
                        {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : ''}
                        {f.openai_file_id && ` · ${f.openai_file_id}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await api.deleteFile(projectId, f.id)
                      setFiles((prev) => prev.filter((x) => x.id !== f.id))
                    }}
                    className="p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-text-muted text-sm text-center py-8">No files uploaded</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
