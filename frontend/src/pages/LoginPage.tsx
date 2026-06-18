import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-muted border border-accent/30 mb-4">
            <Bot className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Welcome back</h1>
          <p className="text-text-muted">Sign in to your chatbot platform</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <Sparkles className="w-4 h-4" />
            Sign in
          </Button>
          <p className="text-center text-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-hover font-medium">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
