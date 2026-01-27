import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@/auth/useUser'
import { fetchTodos, createTodo, updateTodo, deleteTodo, restoreTodo, permanentlyDeleteTodo, type Todo, type Quadrant } from '@/api/todos'
import { TodoSidebar, type TodoFilter } from './TodoSidebar'
import { QuadrantSelector } from './QuadrantSelector'

export function TodosPage() {
  const [searchParams] = useSearchParams()
  const filter = (searchParams.get('filter') || 'inbox') as TodoFilter
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [editingQuadrant, setEditingQuadrant] = useState<Quadrant>(null)
  const [editingStartDate, setEditingStartDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [subTodoInput, setSubTodoInput] = useState<Record<string, string>>({})
  const [quickCreateTitle, setQuickCreateTitle] = useState('')
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(192)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(384)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const queryClient = useQueryClient()
  const { user, loading: userLoading } = useUser()
  const userId = user?.id ?? ''

  // 检测屏幕宽度
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
      if (window.innerWidth >= 1024) {
        setShowDetailPanel(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // 当选中任务且在小屏幕上时，自动显示详情栏
  useEffect(() => {
    if (selectedTodoId && !isLargeScreen) {
      setShowDetailPanel(true)
    }
  }, [selectedTodoId, isLargeScreen])

  // 拖拽调整左侧栏宽度
  useEffect(() => {
    if (!isResizingLeft) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX
      if (newWidth >= 120 && newWidth <= 400) {
        setLeftSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingLeft])

  // 拖拽调整右侧栏宽度
  useEffect(() => {
    if (!isResizingRight) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 200 && newWidth <= 600) {
        setRightSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingRight(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingRight])

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos', userId, filter],
    queryFn: () => fetchTodos(userId, filter === 'deleted'),
    enabled: !!userId,
  })

  // 根据过滤器筛选任务
  const filteredTodos = todos.filter((todo) => {
    if (filter === 'deleted') {
      return todo.deleted_at !== null && !todo.parent_id
    }
    if (filter === 'completed') {
      return todo.completed && !todo.deleted_at && !todo.parent_id
    }
    if (filter !== 'all' && (todo.deleted_at || todo.completed)) {
      return false
    }
    if (filter === 'inbox') return todo.inbox && !todo.parent_id
    if (filter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const created = new Date(todo.created_at)
      return created >= today && created < tomorrow && !todo.parent_id
    }
    if (filter === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const created = new Date(todo.created_at)
      return created >= weekAgo && !todo.parent_id
    }
    if (filter === 'all') {
      return !todo.parent_id
    }
    return !todo.parent_id
  })

  // 选中的任务
  const selectedTodo = selectedTodoId ? todos.find((t) => t.id === selectedTodoId) : null

  // Organize todos into parent-child structure
  const todosByParent = todos.reduce((acc, todo) => {
    const parentId = todo.parent_id || 'root'
    if (!acc[parentId]) acc[parentId] = []
    acc[parentId].push(todo)
    return acc
  }, {} as Record<string, Todo[]>)

  function getChildren(parentId: string): Todo[] {
    return todosByParent[parentId] || []
  }

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string
      description: string | null
      quadrant: Quadrant
      start_date: string | null
      due_date: string | null
      parent_id: string | null
    }) => createTodo(userId, { ...data, inbox: !data.parent_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTodo>[1] }) =>
      updateTodo(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
  })

  const restoreMutation = useMutation({
    mutationFn: restoreTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
  })

  const permanentlyDeleteMutation = useMutation({
    mutationFn: permanentlyDeleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
  })

  function handleCreateSubTodo(parentId: string) {
    const title = subTodoInput[parentId]?.trim()
    if (!title) return
    createMutation.mutate({
      title,
      description: null,
      quadrant: null,
      start_date: null,
      due_date: null,
      parent_id: parentId,
    })
    setSubTodoInput((prev) => ({ ...prev, [parentId]: '' }))
  }

  function handleQuickCreate() {
    const title = quickCreateTitle.trim()
    if (!title) return
    createMutation.mutate({
      title,
      description: null,
      quadrant: null,
      start_date: null,
      due_date: null,
      parent_id: null,
    })
    setQuickCreateTitle('')
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditingTitle(todo.title)
    setEditingDescription(todo.description || '')
    setEditingQuadrant(todo.quadrant)
    setEditingStartDate(todo.start_date ? new Date(todo.start_date).toISOString().split('T')[0] : '')
    setEditingDueDate(todo.due_date ? new Date(todo.due_date).toISOString().split('T')[0] : '')
  }

  function saveEdit(id: string) {
    const t = editingTitle.trim()
    if (t) {
      updateMutation.mutate({
        id,
        patch: {
          title: t,
          description: editingDescription.trim() || null,
          quadrant: editingQuadrant,
          start_date: editingStartDate ? new Date(editingStartDate).toISOString() : null,
          due_date: editingDueDate ? new Date(editingDueDate).toISOString() : null,
        },
      })
    } else {
      setEditingId(null)
    }
  }

  function toggleComplete(todo: Todo) {
    updateMutation.mutate({ id: todo.id, patch: { completed: !todo.completed, inbox: false } })
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  function getQuadrantLabel(quadrant: Quadrant): string {
    if (!quadrant) return ''
    const labels: Record<NonNullable<Quadrant>, string> = {
      important_urgent: '重要且紧急',
      important_not_urgent: '重要不紧急',
      not_important_urgent: '不重要但紧急',
      not_important_not_urgent: '不重要不紧急',
    }
    return labels[quadrant]
  }

  function getQuadrantColor(quadrant: Quadrant): string {
    if (!quadrant) return ''
    const colors: Record<NonNullable<Quadrant>, string> = {
      important_urgent: 'bg-red-500',
      important_not_urgent: 'bg-yellow-500',
      not_important_urgent: 'bg-blue-500',
      not_important_not_urgent: 'bg-gray-400',
    }
    return colors[quadrant]
  }

  // 获取象限对应的颜色条颜色
  function getQuadrantBarColor(quadrant: Quadrant): string {
    if (!quadrant) return 'bg-transparent'
    return getQuadrantColor(quadrant)
  }

  if (userLoading) {
    return <div className="p-4">加载中...</div>
  }
  if (!userId) {
    return <div className="p-4">请先登录</div>
  }
  if (isLoading) {
    return <div className="p-4">加载任务中...</div>
  }

  return (
    <div className="flex h-full gap-0 relative">
      {/* 左侧栏：过滤器 */}
      <div className="shrink-0 border-r border-[var(--color-border)] relative flex flex-col px-2" style={{ width: `${leftSidebarWidth}px` }}>
        <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">任务视图</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TodoSidebar filter={filter} />
        </div>
        {/* 拖拽手柄 */}
        <div
          className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-[var(--color-accent)] transition-colors group"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizingLeft(true)
          }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] rounded-full" />
        </div>
      </div>

      {/* 中间栏：任务清单 */}
      <div className="flex-1 flex flex-col min-w-0 px-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">任务清单</h2>
          {!isLargeScreen && selectedTodoId && (
            <button
              type="button"
              onClick={() => setShowDetailPanel((v) => !v)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
            >
              {showDetailPanel ? '隐藏详情' : '显示详情'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <ul className="space-y-1">
            {filteredTodos.map((todo) => {
              const children = getChildren(todo.id)
              const hasChildren = children.length > 0
              
              return (
                <li
                  key={todo.id}
                  onClick={() => setSelectedTodoId(todo.id)}
                  className={`flex items-stretch rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedTodoId === todo.id 
                      ? 'bg-[var(--color-accent)]/10' 
                      : 'hover:bg-[var(--color-text)]/5'
                  } ${todo.deleted_at ? 'opacity-60' : ''}`}
                >
                  {/* 左侧颜色条 */}
                  <div className={`w-1 shrink-0 ${getQuadrantBarColor(todo.quadrant)}`} />
                  
                  <div className="flex-1 flex items-start gap-3 px-3 py-2.5">
                    {!todo.deleted_at && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleComplete(todo)
                        }}
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          todo.completed 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-[var(--color-border)] hover:border-emerald-500'
                        }`}
                      >
                        {todo.completed && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )}
                    {todo.deleted_at && (
                      <span className="mt-0.5 text-xs text-[var(--color-danger)]">🗑️</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasChildren && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            ({children.length})
                          </span>
                        )}
                        <span
                          className={`${todo.completed || todo.deleted_at ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'} font-medium text-sm`}
                        >
                          {todo.title}
                        </span>
                        {todo.deleted_at && (
                          <span className="text-xs text-[var(--color-danger)]">已删除</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                        {todo.start_date && <span>启动: {formatDate(todo.start_date)}</span>}
                        {todo.due_date && (
                          <span className={new Date(todo.due_date) < new Date() ? 'text-[var(--color-danger)]' : ''}>
                            截止: {formatDate(todo.due_date)}
                          </span>
                        )}
                        {todo.deleted_at && (
                          <span>删除时间: {formatDate(todo.deleted_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {filteredTodos.length === 0 && (
            <p className="text-center text-[var(--color-text-muted)] py-8">暂无任务</p>
          )}

          {/* 快速创建任务输入框 */}
          {filter !== 'deleted' && filter !== 'completed' && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-accent)] text-lg">+</span>
                <input
                  type="text"
                  value={quickCreateTitle}
                  onChange={(e) => setQuickCreateTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickCreateTitle.trim()) {
                      handleQuickCreate()
                    }
                  }}
                  placeholder="输入任务标题，按 Enter 快速创建..."
                  className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧栏：任务详情 */}
      {(isLargeScreen || showDetailPanel) && (
        <>
          {/* 小屏幕遮罩层 */}
          {!isLargeScreen && showDetailPanel && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowDetailPanel(false)}
            />
          )}
          <div
            className={`${
              isLargeScreen
                ? 'shrink-0 border-l border-[var(--color-border)] relative'
                : 'fixed right-0 top-0 h-full max-w-[85vw] bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl z-50'
            } overflow-y-auto`}
            style={isLargeScreen ? { width: `${rightSidebarWidth}px` } : { width: `${rightSidebarWidth}px` }}
          >
            <div className="h-full overflow-y-auto pl-2 pr-2">
              {/* 拖拽手柄 */}
              {isLargeScreen && (
                <div
                  className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-[var(--color-accent)] transition-colors group z-10"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsResizingRight(true)
                  }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] rounded-full" />
                </div>
              )}
              {selectedTodo ? (
                <div className="space-y-6">
                  <div className="sticky top-0 bg-[var(--color-bg)] pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-[var(--color-text)]">任务详情</h2>
                      {!isLargeScreen && (
                        <button
                          type="button"
                          onClick={() => setShowDetailPanel(false)}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1"
                          aria-label="关闭详情"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {editingId === selectedTodo.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          任务标题 *
                        </label>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          autoFocus
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          任务描述
                        </label>
                        <textarea
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          placeholder="任务描述..."
                          rows={6}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          优先级象限
                        </label>
                        <QuadrantSelector value={editingQuadrant} onChange={setEditingQuadrant} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">启动时间</label>
                          <input
                            type="date"
                            value={editingStartDate}
                            onChange={(e) => setEditingStartDate(e.target.value)}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">截止时间</label>
                          <input
                            type="date"
                            value={editingDueDate}
                            onChange={(e) => setEditingDueDate(e.target.value)}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(selectedTodo.id)}
                          className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            startEdit(selectedTodo)
                          }}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-base font-semibold text-[var(--color-text)]">{selectedTodo.title}</h3>
                          <div className="flex gap-1">
                            {!selectedTodo.deleted_at && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(selectedTodo)}
                                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                                  title="编辑"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMutation.mutate(selectedTodo.id)}
                                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                                  title="删除"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          {!selectedTodo.deleted_at && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleComplete(selectedTodo)}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                  selectedTodo.completed 
                                    ? 'bg-emerald-500 border-emerald-500' 
                                    : 'border-[var(--color-border)] hover:border-emerald-500'
                                }`}
                              >
                                {selectedTodo.completed && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <span className="text-sm text-[var(--color-text-muted)]">
                                {selectedTodo.completed ? '已完成' : '未完成'}
                              </span>
                            </>
                          )}
                          {selectedTodo.deleted_at && (
                            <span className="text-sm text-[var(--color-danger)]">已删除</span>
                          )}
                          {selectedTodo.quadrant && (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${getQuadrantColor(selectedTodo.quadrant)} shadow-sm`}>
                              {getQuadrantLabel(selectedTodo.quadrant)}
                            </span>
                          )}
                        </div>
                        
                        {/* 已删除任务的恢复和永久删除按钮 */}
                        {selectedTodo.deleted_at && (
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => restoreMutation.mutate(selectedTodo.id)}
                              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('确定要永久删除这个任务吗？此操作无法撤销。')) {
                                  permanentlyDeleteMutation.mutate(selectedTodo.id)
                                }
                              }}
                              className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                            >
                              永久删除
                            </button>
                          </div>
                        )}
                      </div>

                      {selectedTodo.description && (
                        <div>
                          <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">描述</h4>
                          <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap bg-[var(--color-bg-elevated)] rounded-lg p-3">
                            {selectedTodo.description}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">时间信息</h4>
                        <div className="space-y-2 text-sm">
                          {selectedTodo.start_date && (
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">启动时间：</span>
                              <span className="text-[var(--color-text)]">{formatDate(selectedTodo.start_date)}</span>
                            </div>
                          )}
                          {selectedTodo.due_date && (
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">截止时间：</span>
                              <span className={`${new Date(selectedTodo.due_date) < new Date() ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                                {formatDate(selectedTodo.due_date)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">创建时间：</span>
                            <span className="text-[var(--color-text)]">{formatDate(selectedTodo.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 子任务 */}
                      {(() => {
                        const children = getChildren(selectedTodo.id)
                        const hasChildren = children.length > 0
                        const inputValue = subTodoInput[selectedTodo.id] || ''
                        
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-[var(--color-text)]">
                                子任务 {hasChildren && `(${children.length})`}
                              </h4>
                            </div>
                            
                            {/* 子任务列表 */}
                            {hasChildren && (
                              <ul className="space-y-2 mb-3">
                                {children.map((child) => (
                                  <li
                                    key={child.id}
                                    className="rounded-lg px-3 py-2 hover:bg-[var(--color-text)]/5 transition-all"
                                  >
                                    <div className="flex items-start gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleComplete(child)}
                                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                          child.completed 
                                            ? 'bg-emerald-500 border-emerald-500' 
                                            : 'border-[var(--color-border)] hover:border-emerald-500'
                                        }`}
                                      >
                                        {child.completed && (
                                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${child.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                                          {child.title}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => deleteMutation.mutate(child.id)}
                                        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                                        title="删除"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            
                            {/* 添加子任务输入框 */}
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--color-accent)] text-sm">+</span>
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setSubTodoInput((prev) => ({ ...prev, [selectedTodo.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && inputValue.trim()) {
                                    handleCreateSubTodo(selectedTodo.id)
                                  }
                                }}
                                placeholder="添加子任务..."
                                className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[var(--color-text-muted)]">选择一个任务查看详情</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
