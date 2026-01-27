import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signIn, signUp, getSession } from '@/api/auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  useEffect(() => {
    getSession().then((session) => {
      if (session) navigate(from, { replace: true })
    })
  }, [navigate, from])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password)
        if (err) throw err
        setMessage('Check your email to confirm your account.')
      } else {
        const { error: err } = await signIn(email, password)
        if (err) throw err
        navigate(from, { replace: true })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-6 text-center">
          {isSignUp ? 'Create account' : 'Sign in'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}
          {message && (
            <p className="text-sm text-[var(--color-success)]">{message}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-accent)] py-2.5 font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setIsSignUp((v) => !v); setError(null); setMessage(null); }}
          className="mt-4 w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  )
}
