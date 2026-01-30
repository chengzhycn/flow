import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/theme/themeStore'
import type { ThemeMode } from '@/theme/themeStore'
import { useUser } from '@/auth/useUser'
import { signOut } from '@/api/auth'
import { fetchPomodoroSessions } from '@/api/pomodoro'
import { getName, getVersion } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'

export function SettingsPage() {
  const navigate = useNavigate()
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const { user } = useUser()
  const userId = user?.id ?? ''

  const [appInfo, setAppInfo] = useState({ name: '', version: '' })

  useEffect(() => {
    async function loadAppInfo() {
      try {
        const [name, version] = await Promise.all([getName(), getVersion()])
        setAppInfo({ name, version })
      } catch (error) {
        console.error('Failed to load app info:', error)
      }
    }
    loadAppInfo()
  }, [])

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const weekStartStr = weekStart.toISOString()

  const { data: sessionsThisWeek = [] } = useQuery({
    queryKey: ['pomodoro-sessions', userId, weekStartStr, todayEnd],
    queryFn: () => fetchPomodoroSessions(userId, weekStartStr, todayEnd),
    enabled: !!userId,
  })

  const completedWorkToday = sessionsThisWeek.filter(
    (s) => s.completed && s.type === 'work' && s.started_at >= todayStart
  ).length
  const completedWorkWeek = sessionsThisWeek.filter((s) => s.completed && s.type === 'work').length

  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '跟随系统' },
  ]

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">设置</h1>

      {/* 帐号信息 */}
      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">帐号</h2>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)] mb-1">当前登录帐号</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{user?.email || '未登录'}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">外观</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          选择浅色、深色或跟随系统设置。
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === opt.value
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:border-[var(--color-text-muted)]'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">番茄钟</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          默认设置：25分钟工作，5分钟短休息，15分钟长休息。自定义时长功能将在后续更新中添加。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">历史记录</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          已完成的工作时段（完整25分钟）。
        </p>
        <div className="flex gap-6 text-sm">
          <span className="text-[var(--color-text)]">
            今日：<strong>{completedWorkToday}</strong>
          </span>
          <span className="text-[var(--color-text)]">
            最近7天：<strong>{completedWorkWeek}</strong>
          </span>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">关于</h2>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4 text-sm text-[var(--color-text-muted)]">
          <p>
            <span className="font-medium text-[var(--color-text)]">{appInfo.name}</span>
            <span className="mx-2">v{appInfo.version}</span>
          </p>
        </div>
      </section>
    </div>
  )
}

