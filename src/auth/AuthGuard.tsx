import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession } from '@/api/auth'

type AuthGuardProps = {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getSession()
      .then((session) => {
        setAuthenticated(!!session)
        if (!session) {
          navigate('/login', { replace: true, state: { from: location } })
        }
      })
      .finally(() => setLoading(false))
  }, [navigate, location])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    )
  }

  if (!authenticated) return null

  return <>{children}</>
}
