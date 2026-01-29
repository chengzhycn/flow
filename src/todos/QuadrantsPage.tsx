import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { fetchTodos, updateTodo, deleteTodo, createTodo, type Todo, type Quadrant } from '@/api/todos'
import { QuadrantsView } from './QuadrantsView'
import { QuadrantSelector } from './QuadrantSelector'
import { DatePicker } from './DatePicker'

export function QuadrantsPage() {
  const { user, loading: userLoading } = useUser()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()

  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [editingQuadrant, setEditingQuadrant] = useState<Quadrant>(null)
  const [editingStartDate, setEditingStartDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [subTodoInput, setSubTodoInput] = useState<Record<string, string>>({})
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos', userId],
    queryFn: () => fetchTodos(userId, false),
    enabled: !!userId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
      setSelectedTodo(null)
    },
  })

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

  function handleCreateSubTodo(parentId: string) {
    const title = subTodoInput[parentId]?.trim()
    if (!title) return
    const today = new Date().toISOString()
    createMutation.mutate({
      title,
      description: null,
      quadrant: 'not_important_not_urgent',
      start_date: today,
      due_date: today,
      parent_id: parentId,
    })
    setSubTodoInput((prev) => ({ ...prev, [parentId]: '' }))
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

  function handleTodoClick(todo: Todo, event: React.MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const popoverWidth = 320
    const popoverHeight = 400

    // 计算最佳位置
    let x = rect.right + 8
    let y = rect.top

    // 如果右侧空间不够，显示在左侧
    if (x + popoverWidth > viewportWidth - 16) {
      x = rect.left - popoverWidth - 8
    }

    // 如果左侧也不够，居中显示
    if (x < 16) {
      x = Math.max(16, (viewportWidth - popoverWidth) / 2)
    }

    // 如果底部空间不够，向上调整
    if (y + popoverHeight > viewportHeight - 16) {
      y = Math.max(16, viewportHeight - popoverHeight - 16)
    }

    setPopoverPosition({ x, y })
    setSelectedTodo(todo)
    setEditingId(null)
  }

  function closePopover() {
    setSelectedTodo(null)
    setPopoverPosition(null)
    setEditingId(null)
  }

  // 点击外部关闭 popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        closePopover()
      }
    }

    if (selectedTodo) {
      // 延迟添加事件监听，避免立即触发关闭
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [selectedTodo])

  if (userLoading) {
    return <div className="p-4">加载中...</div>
  }
  if (!userId) {
    return <div className="p-4">请先登录</div>
  }
  if (isLoading) {
    return <div className="p-4">加载任务中...</div>
  }

  // 获取最新的 selectedTodo 数据
  const currentTodo = selectedTodo ? todos.find(t => t.id === selectedTodo.id) || selectedTodo : null

  return (
    <div className="flex h-full relative">
      <div className="flex-1 flex flex-col min-w-0 px-4 py-2">
        <div className="flex items-center justify-between px-1 py-3 mb-4">
          <div className="flex items-center gap-2 h-8">
            <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">四象限</h2>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <QuadrantsView
            todos={todos}
            onTodoClick={handleTodoClick}
            selectedTodoId={selectedTodo?.id || null}
            userId={userId}
          />
        </div>
      </div>

      {/* 任务详情 Popover */}
      {currentTodo && popoverPosition && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-80 max-h-[70vh] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: popoverPosition.x,
            top: popoverPosition.y,
          }}
        >
          {editingId === currentTodo.id ? (
            /* 编辑模式 */
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--color-text)]">编辑任务</span>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-text)]/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  autoFocus
                  placeholder="任务标题"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="添加描述..."
                  rows={3}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
                />
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">象限</label>
                  <QuadrantSelector value={editingQuadrant} onChange={setEditingQuadrant} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">开始</label>
                    <DatePicker
                      value={editingStartDate}
                      onChange={setEditingStartDate}
                      placeholder="选择日期"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">截止</label>
                    <DatePicker
                      value={editingDueDate}
                      onChange={setEditingDueDate}
                      placeholder="选择日期"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 p-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => saveEdit(currentTodo.id)}
                  className="flex-1 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            /* 查看模式 */
            <div className="flex flex-col h-full">
              {/* 头部操作栏 */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]/50">
                <div className="flex items-center gap-1">
                  {/* 完成按钮 */}
                  <button
                    type="button"
                    onClick={() => toggleComplete(currentTodo)}
                    className={`p-1.5 rounded-lg transition-all ${currentTodo.completed
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5'
                      }`}
                    title={currentTodo.completed ? '标记未完成' : '标记完成'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  {/* 编辑按钮 */}
                  <button
                    type="button"
                    onClick={() => startEdit(currentTodo)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
                    title="编辑"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(currentTodo.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-all"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  {/* 关闭按钮 */}
                  <button
                    type="button"
                    onClick={closePopover}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-text)]/5 transition-all"
                    title="关闭"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto">
                {/* 标题和状态 */}
                <div className="px-4 pt-3 pb-3">
                  <h3 className={`text-base font-semibold leading-snug ${currentTodo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                    {currentTodo.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {currentTodo.quadrant && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${getQuadrantColor(currentTodo.quadrant)}`}>
                        {getQuadrantLabel(currentTodo.quadrant)}
                      </span>
                    )}
                    {currentTodo.completed && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        已完成
                      </span>
                    )}
                  </div>
                </div>

                {/* 描述 */}
                {currentTodo.description && (
                  <div className="px-4 pb-3">
                    <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
                      {currentTodo.description}
                    </p>
                  </div>
                )}

                {/* 时间信息 */}
                {(currentTodo.start_date || currentTodo.due_date) && (
                  <div className="px-4 pb-3 flex items-center gap-3 text-xs">
                    {currentTodo.start_date && (
                      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>开始 {formatDate(currentTodo.start_date)}</span>
                      </div>
                    )}
                    {currentTodo.due_date && (
                      <div className={`flex items-center gap-1.5 ${new Date(currentTodo.due_date) < new Date() ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>截止 {formatDate(currentTodo.due_date)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 子任务 */}
                {(() => {
                  const children = getChildren(currentTodo.id)
                  const hasChildren = children.length > 0
                  const inputValue = subTodoInput[currentTodo.id] || ''
                  const completedCount = children.filter(c => c.completed).length

                  return (
                    <div className="border-t border-[var(--color-border)]/50">
                      <div className="px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          子任务 {hasChildren && `(${completedCount}/${children.length})`}
                        </span>
                      </div>

                      {/* 子任务列表 */}
                      {hasChildren && (
                        <div className="px-2">
                          {children.map((child) => (
                            <div
                              key={child.id}
                              className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-text)]/5 transition-all"
                            >
                              <button
                                type="button"
                                onClick={() => toggleComplete(child)}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${child.completed
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
                              <span className={`flex-1 text-sm ${child.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                                {child.title}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(child.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 添加子任务 */}
                      <div className="px-4 py-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors">
                          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setSubTodoInput((prev) => ({ ...prev, [currentTodo.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && inputValue.trim()) {
                                handleCreateSubTodo(currentTodo.id)
                              }
                            }}
                            placeholder="添加子任务..."
                            className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
