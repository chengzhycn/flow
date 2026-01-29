import { Link } from 'react-router-dom'
import { useState } from 'react'

export type TodoFilter = 'inbox' | 'today' | 'week' | 'all' | 'completed' | 'deleted'

export type Project = {
  id: string
  name: string
  color: string
  description?: string | null
}

type SidebarProps = {
  filter: TodoFilter
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onCreateProject: (name: string) => void
}

// 顶部过滤器项
const filterItems = [
  { id: 'inbox' as const, label: '收集箱', path: '/?filter=inbox' },
  { id: 'today' as const, label: '最近一天', path: '/?filter=today' },
  { id: 'week' as const, label: '最近七天', path: '/?filter=week' },
]

// 底部归档项
const archiveItems = [
  { id: 'all' as const, label: '全部', path: '/?filter=all' },
  { id: 'completed' as const, label: '已完成', path: '/?filter=completed' },
  { id: 'deleted' as const, label: '已删除', path: '/?filter=deleted' },
]

export function TodoSidebar({
  filter,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
}: SidebarProps) {
  const [newProjectName, setNewProjectName] = useState('')

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim())
      setNewProjectName('')
    }
  }

  const handleFilterClick = () => {
    // 点击过滤器时取消项目选中
    onSelectProject(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部：过滤器 */}
      <nav className="space-y-1 pb-4 border-b border-[var(--color-border)]">
        {filterItems.map((item) => {
          const isActive = filter === item.id && !selectedProjectId
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={handleFilterClick}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActive
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 中间：项目列表 */}
      <div className="flex-1 py-4 border-b border-[var(--color-border)] overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            项目
          </span>
        </div>
        <nav className="space-y-1">
          {projects.map((project) => {
            const isActive = selectedProjectId === project.id
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all text-left ${isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                  }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            )
          })}
        </nav>

        {/* 添加项目输入框 */}
        <div className="mt-2 px-1">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateProject()
            }}
            placeholder="+ 新建项目..."
            className="w-full bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none px-2 py-1.5 rounded hover:bg-[var(--color-bg-elevated)] focus:bg-[var(--color-bg-elevated)]"
          />
        </div>
      </div>

      {/* 底部：归档 */}
      <nav className="space-y-1 pt-4">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            归档
          </span>
        </div>
        {archiveItems.map((item) => {
          const isActive = filter === item.id && !selectedProjectId
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={handleFilterClick}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActive
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
