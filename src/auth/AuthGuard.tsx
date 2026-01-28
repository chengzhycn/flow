import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession } from '@/api/auth'
import { isTauriEnv } from '@/db/local'
import { initSyncEngine, stopSyncEngine } from '@/sync/SyncEngine'

type AuthGuardProps = {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let userId: string | null = null
    let isMounted = true

    getSession()
      .then((session) => {
        if (!isMounted) return

        if (!session) {
          setAuthenticated(false)
          navigate('/login', { replace: true, state: { from: location } })
        } else {
          userId = session.user.id
          setAuthenticated(true)

          // 在 Tauri 环境中初始化同步引擎（不阻塞 UI）
          if (isTauriEnv()) {
            initSyncEngine(userId).catch(() => {
              // 同步引擎初始化失败（离线模式），静默处理
            })
          }
        }
      })
      .catch(() => {
        if (!isMounted) return
        setAuthenticated(false)
        navigate('/login', { replace: true, state: { from: location } })
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    // 清理
    return () => {
      isMounted = false
      if (isTauriEnv() && userId) {
        stopSyncEngine()
      }
    }
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
