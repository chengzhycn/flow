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
  onDeleteProject: (projectId: string) => void
  counts?: {
    today?: number
    week?: number
    inbox?: number
  }
}

// 图标组件
const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const InboxIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)


const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)

// 顶部过滤器项
const filterItems = [
  { id: 'today' as const, label: '今天', path: '/?filter=today', icon: CalendarIcon },
  { id: 'week' as const, label: '最近7天', path: '/?filter=week', icon: CalendarIcon },
  { id: 'inbox' as const, label: '收集箱', path: '/?filter=inbox', icon: InboxIcon },
]

// 底部归档项
const archiveItems = [
  { id: 'completed' as const, label: '已完成', path: '/?filter=completed', icon: CheckCircleIcon },
  { id: 'deleted' as const, label: '垃圾桶', path: '/?filter=deleted', icon: TrashIcon },
]

export function TodoSidebar({
  filter,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  counts = {},
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

  // 获取对应过滤器的数量
  const getCount = (id: string) => {
    return counts[id as keyof typeof counts]
  }

  return (
    <div className="flex flex-col h-full text-[13px]">
      {/* 顶部：过滤器 */}
      <nav className="space-y-0.5 pb-4">
        {filterItems.map((item) => {
          const isActive = filter === item.id && !selectedProjectId
          const count = getCount(item.id)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={handleFilterClick}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 transition-all ${isActive
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className={isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                  <Icon />
                </span>
                <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
              </div>
              {count !== undefined && count > 0 && (
                <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 分隔区域 */}
      <div className="border-t border-[var(--color-border)] my-2" />

      {/* 清单区：项目列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1.5">
          <span className="text-xs text-[var(--color-text-muted)]">项目</span>
        </div>
        <nav className="space-y-0.5">
          {projects.map((project) => {
            const isActive = selectedProjectId === project.id
            return (
              <div
                key={project.id}
                className={`group w-full flex items-center justify-between rounded-md px-2 py-1.5 transition-all cursor-pointer ${isActive
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]'
                  }`}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className={`truncate ${isActive ? 'font-medium' : ''}`}>{project.name}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteProject(project.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
                  title="删除项目"
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })}
        </nav>

        {/* 添加项目输入框 */}
        <div className="mt-1 px-1">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateProject()
            }}
            placeholder="+ 新建项目..."
            className="w-full bg-transparent border-none text-[13px] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none px-2 py-1.5 rounded hover:bg-[var(--color-bg-elevated)] focus:bg-[var(--color-bg-elevated)]"
          />
        </div>


      </div>

      {/* 底部：归档 */}
      <nav className="space-y-0.5 pt-3 border-t border-[var(--color-border)]">
        {archiveItems.map((item) => {
          const isActive = filter === item.id && !selectedProjectId
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={handleFilterClick}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all ${isActive
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]'
                }`}
            >
              <span className={isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                <Icon />
              </span>
              <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
