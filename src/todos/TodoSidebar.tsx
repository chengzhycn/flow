import { Link } from 'react-router-dom'

export type TodoFilter = 'inbox' | 'today' | 'week' | 'all' | 'completed' | 'deleted'

type SidebarItem = {
  id: TodoFilter
  label: string
  path: string
}

const items: SidebarItem[] = [
  { id: 'inbox', label: '收集箱', path: '/?filter=inbox' },
  { id: 'today', label: '最近一天', path: '/?filter=today' },
  { id: 'week', label: '最近七天', path: '/?filter=week' },
  { id: 'all', label: '全部', path: '/?filter=all' },
  { id: 'completed', label: '已完成', path: '/?filter=completed' },
  { id: 'deleted', label: '已删除', path: '/?filter=deleted' },
]

export function TodoSidebar({ filter }: { filter: TodoFilter }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = filter === item.id
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
