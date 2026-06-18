import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function RegisterPage() {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await register(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
          <h1 className="text-3xl font-bold gradient-text mb-2">Create account</h1>
          <p className="text-text-muted">Start building your AI agents</p>
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
            placeholder="Min. 8 characters"
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <UserPlus className="w-4 h-4" />
            Create account
          </Button>
          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
