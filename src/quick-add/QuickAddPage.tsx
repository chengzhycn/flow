import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { fetchTodos, createTodo, updateTodo, type Todo, type Quadrant } from '@/api/todos'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getThemeSetting } from '@/db/localSettings'
import { applyTheme } from '@/theme/themeStore'

// 象限配置 - 与主程序保持一致
type QuadrantStyle = {
    accentColor: string
    cardBg: string
    taskIndicator: string
}

const quadrantStyles: Record<NonNullable<Quadrant>, QuadrantStyle> = {
    important_urgent: {
        accentColor: 'text-rose-500',
        cardBg: 'hover:bg-rose-500/5',
        taskIndicator: 'bg-rose-500',
    },
    important_not_urgent: {
        accentColor: 'text-amber-500',
        cardBg: 'hover:bg-amber-500/5',
        taskIndicator: 'bg-amber-500',
    },
    not_important_urgent: {
        accentColor: 'text-sky-500',
        cardBg: 'hover:bg-sky-500/5',
        taskIndicator: 'bg-sky-500',
    },
    not_important_not_urgent: {
        accentColor: 'text-slate-400',
        cardBg: 'hover:bg-slate-500/5',
        taskIndicator: 'bg-slate-400',
    },
}

function getQuadrantStyle(quadrant: Quadrant | null): QuadrantStyle {
    return quadrantStyles[quadrant || 'not_important_not_urgent']
}

export function QuickAddPage() {
    const [quickCreateTitle, setQuickCreateTitle] = useState('')
    const queryClient = useQueryClient()
    const { user } = useUser()
    const userId = user?.id ?? ''

    const { data: todos = [] } = useQuery({
        queryKey: ['todos', userId, 'inbox'],
        queryFn: () => fetchTodos(userId, false),
        enabled: !!userId,
    })

    // Filter for inbox only - show uncompleted tasks
    const inboxTodos = useMemo(() =>
        todos.filter((todo) => todo.inbox && !todo.parent_id && !todo.deleted_at && !todo.completed),
        [todos]
    )

    const createMutation = useMutation({
        mutationFn: (title: string) => {
            const today = new Date().toISOString()
            return createTodo(userId, {
                title,
                description: null,
                quadrant: 'not_important_not_urgent',
                start_date: today,
                due_date: null,
                inbox: true,
                parent_id: null,
                project_id: null,
                milestone_id: null,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todos', userId] })
            setQuickCreateTitle('')
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTodo>[1] }) =>
            updateTodo(id, patch),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todos', userId] })
        },
    })

    function handleQuickCreate() {
        const title = quickCreateTitle.trim()
        if (!title) return
        createMutation.mutate(title)
    }

    function toggleComplete(todo: Todo) {
        updateMutation.mutate({ id: todo.id, patch: { completed: !todo.completed } })
    }

    // 格式化日期 - 与主程序保持一致
    function formatDate(dateStr: string | null): string {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }

    // 按 Escape 键隐藏窗口
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                getCurrentWindow().hide()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // 主题同步 - 从数据库读取主题设置
    const [currentMode, setCurrentMode] = useState<'light' | 'dark' | 'system'>('system')
    
    // 加载主题并定时刷新（检测主窗口的主题变化）
    useEffect(() => {
        const loadTheme = async () => {
            const mode = await getThemeSetting()
            setCurrentMode(mode)
            applyTheme(mode)
        }
        
        // 初始加载
        loadTheme()
        
        // 定时检查主题变化（每秒检查一次）
        const interval = setInterval(loadTheme, 1000)
        
        return () => clearInterval(interval)
    }, [])

    // 监听系统主题变化（当 mode 为 system 时）
    useEffect(() => {
        if (currentMode !== 'system') return
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => applyTheme('system')
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [currentMode])

    // 窗口显示时自动聚焦输入框并同步主题
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                // 同步主题
                const mode = await getThemeSetting()
                setCurrentMode(mode)
                applyTheme(mode)
                // 聚焦输入框
                setTimeout(() => {
                    const input = document.querySelector<HTMLInputElement>('[data-quick-add-input]')
                    input?.focus()
                }, 100)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        // 初始聚焦
        setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('[data-quick-add-input]')
            input?.focus()
        }, 100)

        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    return (
        <div className="h-screen w-screen bg-[var(--color-bg-elevated)] select-none flex flex-col">
            {/* Header - Draggable area */}
            <div
                className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0"
                data-tauri-drag-region
            >
                <h1 className="text-base font-semibold text-[var(--color-text)]">收集箱</h1>
            </div>

            {/* Input */}
            <div className="px-4 pb-3 shrink-0">
                <div className="flex items-center bg-[var(--color-bg)] rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-[var(--color-text-muted)] mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <input
                        data-quick-add-input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-[var(--color-text)] placeholder-[var(--color-text-muted)] text-sm"
                        placeholder="添加任务"
                        value={quickCreateTitle}
                        onChange={(e) => setQuickCreateTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickCreate()
                            if (e.key === 'Escape') setQuickCreateTitle('')
                        }}
                    />
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
                {inboxTodos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24 text-[var(--color-text-muted)]">
                        <span className="text-sm opacity-60">收集箱为空</span>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {inboxTodos.map((todo) => {
                            const style = getQuadrantStyle(todo.quadrant)

                            return (
                                <div
                                    key={todo.id}
                                    className={`group flex items-stretch rounded-lg overflow-hidden transition-all ${style.cardBg}`}
                                >
                                    {/* 左侧四象限颜色条 */}
                                    <div className={`w-1 shrink-0 ${style.taskIndicator}`} />
                                    
                                    <div className="flex-1 flex items-center gap-2 px-2 py-1.5">
                                        {/* Checkbox - 与主程序一致 */}
                                        <button
                                            onClick={() => toggleComplete(todo)}
                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                                todo.completed
                                                    ? `${style.taskIndicator} border-transparent`
                                                    : `border-[var(--color-border)] hover:border-current ${style.accentColor}`
                                            }`}
                                        >
                                            {todo.completed && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                            <span className={`text-[13px] leading-tight truncate ${
                                                todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'
                                            }`}>
                                                {todo.title}
                                            </span>
                                            
                                            {/* Date */}
                                            {todo.due_date && (
                                                <span className={`text-xs shrink-0 ${
                                                    new Date(todo.due_date) < new Date() 
                                                        ? 'text-[var(--color-danger)]' 
                                                        : 'text-[var(--color-text-muted)]'
                                                }`}>
                                                    {formatDate(todo.due_date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
