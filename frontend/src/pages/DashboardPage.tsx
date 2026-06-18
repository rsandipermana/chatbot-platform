import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, type Project } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.listProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const project = await api.createProject({ name, description: description || null })
      navigate(`/projects/${project.id}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await api.deleteProject(id)
    setProjects((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="glass border-b border-border-subtle sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-semibold text-text">Chatbot Platform</h1>
              <p className="text-xs text-text-muted">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-text">Your Agents</h2>
            <p className="text-text-muted mt-1">Create and manage AI chatbot projects</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Agent
          </Button>
        </div>

        {showCreate && (
          <Card className="mb-8 border-accent/20">
            <form onSubmit={handleCreate} className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Create New Agent
              </h3>
              <Input
                label="Agent Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Support Bot"
                required
              />
              <Textarea
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={2}
              />
              <div className="flex gap-3">
                <Button type="submit" loading={creating}>
                  Create Agent
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-surface-card animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-16">
            <Bot className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents yet</h3>
            <p className="text-text-muted mb-6">Create your first AI agent to get started</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Create Agent
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card hover className="h-full relative group">
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-text-muted hover:text-danger transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text truncate">{project.name}</h3>
                      <p className="text-sm text-text-muted mt-1 line-clamp-2">
                        {project.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-muted text-accent border border-accent/20">
                          {project.llm_provider}
                        </span>
                        <span className="text-xs text-text-muted">{project.llm_model}</span>
                        {!project.has_api_key && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                            No API key
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
