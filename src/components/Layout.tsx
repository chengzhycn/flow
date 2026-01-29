import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '@/api/auth'

// Solid icon components
function TodosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
    </svg>
  )
}

function QuadrantsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
    </svg>
  )
}

function PomodoroIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
    </svg>
  )
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  )
}

const iconComponents = {
  todos: TodosIcon,
  quadrants: QuadrantsIcon,
  pomodoro: PomodoroIcon,
  calendar: CalendarIcon,
  projects: ProjectsIcon,
  settings: SettingsIcon,
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const navItems = [
    { path: '/', icon: 'todos' as const, label: 'Todos' },
    { path: '/quadrants', icon: 'quadrants' as const, label: 'Quadrants' },
    { path: '/calendar', icon: 'calendar' as const, label: 'Calendar' },
    { path: '/pomodoro', icon: 'pomodoro' as const, label: 'Pomodoro' },
    { path: '/settings', icon: 'settings' as const, label: 'Settings' },
  ]

  return (
    <div className="h-screen flex bg-[var(--color-bg)] overflow-hidden">
      {/* Left sidebar navigation */}
      <aside className="w-16 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col items-center py-4">
        <nav className="flex flex-col gap-2 w-full">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center justify-center w-12 h-12 mx-auto rounded-lg transition-colors ${isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                  }`}
              >
                {(() => {
                  const IconComponent = iconComponents[item.icon]
                  return <IconComponent className="w-6 h-6" />
                })()}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 w-full px-2">
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            退出
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <div className={`w-full h-full ${location.pathname === '/' || location.pathname === '/quadrants' || location.pathname === '/calendar' || location.pathname === '/projects'
              ? 'max-w-full px-0 py-0'
              : 'mx-auto max-w-6xl px-6 py-8'
            }`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
