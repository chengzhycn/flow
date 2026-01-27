import { useQuery } from '@tanstack/react-query'
import { useThemeStore } from '@/theme/themeStore'
import type { ThemeMode } from '@/theme/themeStore'
import { useUser } from '@/auth/useUser'
import { fetchPomodoroSessions } from '@/api/pomodoro'

export function SettingsPage() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const { user } = useUser()
  const userId = user?.id ?? ''

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
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'Follow system' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Settings</h1>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">Appearance</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Choose light, dark, or match your system.
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                mode === opt.value
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
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">Pomodoro</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Default: 25 min work, 5 min short break, 15 min long break. Custom durations can be added in a future update.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">History</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          Completed work sessions (full 25 min).
        </p>
        <div className="flex gap-6 text-sm">
          <span className="text-[var(--color-text)]">
            Today: <strong>{completedWorkToday}</strong>
          </span>
          <span className="text-[var(--color-text)]">
            Last 7 days: <strong>{completedWorkWeek}</strong>
          </span>
        </div>
      </section>
    </div>
  )
}
