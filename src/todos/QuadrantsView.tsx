import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { updateTodo, deleteTodo, createTodo, type Todo, type Quadrant } from '@/api/todos'

type QuadrantViewProps = {
  todos: Todo[]
  onTodoClick: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId: string | null
  userId: string
  showCompleted: boolean
}

type QuadrantConfig = {
  id: Quadrant
  label: string
  subtitle: string
  icon: React.ReactNode
  accentColor: string
  bgGradient: string
  iconBg: string
  cardBg: string
  taskIndicator: string
}

const quadrantConfigs: Record<NonNullable<Quadrant>, QuadrantConfig> = {
  important_urgent: {
    id: 'important_urgent',
    label: '重要且紧急',
    subtitle: '立即处理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    accentColor: 'text-rose-500',
    bgGradient: 'from-rose-500/5 to-rose-500/10',
    iconBg: 'bg-rose-500/10 text-rose-500',
    cardBg: 'hover:bg-rose-500/5',
    taskIndicator: 'bg-rose-500',
  },
  important_not_urgent: {
    id: 'important_not_urgent',
    label: '重要不紧急',
    subtitle: '计划安排',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    accentColor: 'text-amber-500',
    bgGradient: 'from-amber-500/5 to-amber-500/10',
    iconBg: 'bg-amber-500/10 text-amber-500',
    cardBg: 'hover:bg-amber-500/5',
    taskIndicator: 'bg-amber-500',
  },
  not_important_urgent: {
    id: 'not_important_urgent',
    label: '不重要但紧急',
    subtitle: '委托他人',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accentColor: 'text-sky-500',
    bgGradient: 'from-sky-500/5 to-sky-500/10',
    iconBg: 'bg-sky-500/10 text-sky-500',
    cardBg: 'hover:bg-sky-500/5',
    taskIndicator: 'bg-sky-500',
  },
  not_important_not_urgent: {
    id: 'not_important_not_urgent',
    label: '不重要不紧急',
    subtitle: '考虑删除',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    accentColor: 'text-slate-400',
    bgGradient: 'from-slate-500/5 to-slate-500/10',
    iconBg: 'bg-slate-500/10 text-slate-400',
    cardBg: 'hover:bg-slate-500/5',
    taskIndicator: 'bg-slate-400',
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 可拖拽的任务项组件
function DraggableTodoItem({
  todo,
  config,
  onTodoClick,
  selectedTodoId,
  onToggleComplete,
  onDelete,
}: {
  todo: Todo
  config: QuadrantConfig
  onTodoClick: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId: string | null
  onToggleComplete: (todo: Todo) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: todo.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          onTodoClick(todo, e)
        }
      }}
      className={`group rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all ${selectedTodoId === todo.id
        ? 'bg-[var(--color-accent)]/10'
        : `${config.cardBg}`
        } ${isDragging ? 'shadow-lg ring-2 ring-[var(--color-accent)]/30 z-50 bg-[var(--color-bg-elevated)]' : ''}`}
    >
      <div className="flex items-center gap-2">
        {/* 自定义复选框 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleComplete(todo)
          }}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${todo.completed
            ? `${config.taskIndicator} border-transparent`
            : `border-[var(--color-border)] hover:border-current ${config.accentColor}`
            }`}
        >
          {todo.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <span className={`text-[13px] leading-tight truncate ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
            {todo.title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {(todo.start_date || todo.due_date) && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {todo.due_date && (
                  <span className={`flex items-center gap-1 ${new Date(todo.due_date) < new Date() ? 'text-[var(--color-danger)]' : ''}`}>
                    {formatDate(todo.due_date)}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(todo.id)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all cursor-pointer"
              title="删除"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 拖拽预览组件
function DragOverlayItem({ todo, config }: { todo: Todo; config: QuadrantConfig }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 bg-[var(--color-bg-elevated)] shadow-xl ring-2 ring-[var(--color-accent)]/50 border border-[var(--color-border)]`}>
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${todo.completed
          ? `${config.taskIndicator} border-transparent`
          : `border-[var(--color-border)] ${config.accentColor}`
          }`}>
          {todo.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`text-[13px] leading-tight truncate ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
          {todo.title}
        </span>
      </div>
    </div>
  )
}

function QuadrantCard({
  config,
  todos,
  onTodoClick,
  selectedTodoId,
  userId,
  onToggleComplete,
  onDelete,
  showCompleted,
}: {
  config: QuadrantConfig
  todos: Todo[]
  onTodoClick: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId: string | null
  userId: string
  onToggleComplete: (todo: Todo) => void
  onDelete: (id: string) => void
  showCompleted: boolean
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const queryClient = useQueryClient()

  // 使用 useDroppable 创建可放置区域
  const { isOver, setNodeRef } = useDroppable({
    id: `quadrant-${config.id}`,
    data: {
      type: 'quadrant',
      quadrant: config.id,
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string
      description: string | null
      quadrant: Quadrant
      start_date: string | null
      due_date: string | null
    }) => createTodo(userId, { ...data, inbox: true, parent_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
      setNewTitle('')
      setShowCreateForm(false)
    },
  })

  function handleQuickCreate() {
    const t = newTitle.trim()
    if (!t) return
    const today = new Date().toISOString()
    createMutation.mutate({
      title: t,
      description: null,
      quadrant: config.id,
      start_date: today,
      due_date: today,
    })
  }

  const quadrantTodos = todos.filter(t => t.quadrant === config.id && !t.deleted_at && (showCompleted || !t.completed) && !t.parent_id)

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col rounded-2xl bg-gradient-to-br ${config.bgGradient} border border-[var(--color-border)]/50 p-4 min-h-0 relative overflow-hidden backdrop-blur-sm transition-all ${isOver ? 'ring-2 ring-[var(--color-accent)] border-[var(--color-accent)]/50 scale-[1.02]' : ''
        }`}
    >
      {/* 头部 */}
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${config.iconBg}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${config.accentColor}`}>{config.label}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-medium ${config.iconBg}`}>
            {quadrantTodos.length}
          </span>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
        {quadrantTodos.length === 0 && !showCreateForm ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-3 opacity-50`}>
              {config.icon}
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">暂无任务</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              点击添加
            </button>
          </div>
        ) : (
          quadrantTodos.map((todo) => (
            <DraggableTodoItem
              key={todo.id}
              todo={todo}
              config={config}
              onTodoClick={onTodoClick}
              selectedTodoId={selectedTodoId}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* 快速添加任务 */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]/30">
        {showCreateForm ? (
          <div className="flex items-center gap-2">
            <span className={`text-lg ${config.accentColor}`}>+</span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  handleQuickCreate()
                }
                if (e.key === 'Escape') {
                  setShowCreateForm(false)
                  setNewTitle('')
                }
              }}
              onBlur={() => {
                if (!newTitle.trim()) {
                  setShowCreateForm(false)
                }
              }}
              placeholder="输入任务标题，按回车保存..."
              autoFocus
              className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-text)]/5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加任务
          </button>
        )}
      </div>
    </div>
  )
}

export function QuadrantsView({ todos, onTodoClick, selectedTodoId, userId, showCompleted }: QuadrantViewProps) {
  const queryClient = useQueryClient()
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTodo>[1] }) =>
      updateTodo(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
  })

  function toggleComplete(todo: Todo) {
    updateMutation.mutate({ id: todo.id, patch: { completed: !todo.completed, inbox: false } })
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id)
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const todo = todos.find(t => t.id === active.id)
    if (todo) {
      setActiveTodo(todo)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTodo(null)

    if (!over) return

    const activeTodoItem = todos.find(t => t.id === active.id)
    if (!activeTodoItem) return

    // 检查是否放到了象限区域
    const overId = over.id as string
    if (overId.startsWith('quadrant-')) {
      const targetQuadrant = overId.replace('quadrant-', '') as NonNullable<Quadrant>

      // 如果象限发生了变化，更新任务
      if (targetQuadrant !== activeTodoItem.quadrant) {
        updateMutation.mutate({
          id: activeTodoItem.id,
          patch: { quadrant: targetQuadrant, inbox: false },
        })
      }
    }
  }

  // 获取当前拖拽任务的配置
  const getActiveTodoConfig = () => {
    if (!activeTodo?.quadrant) return quadrantConfigs.important_urgent
    return quadrantConfigs[activeTodo.quadrant]
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col gap-4">


        {/* 四象限网格 */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* 左上：重要且紧急 */}
          <QuadrantCard
            config={quadrantConfigs.important_urgent}
            todos={todos}
            onTodoClick={onTodoClick}
            selectedTodoId={selectedTodoId}
            userId={userId}
            onToggleComplete={toggleComplete}
            onDelete={handleDelete}
            showCompleted={showCompleted}
          />
          {/* 右上：重要不紧急 */}
          <QuadrantCard
            config={quadrantConfigs.important_not_urgent}
            todos={todos}
            onTodoClick={onTodoClick}
            selectedTodoId={selectedTodoId}
            userId={userId}
            onToggleComplete={toggleComplete}
            onDelete={handleDelete}
            showCompleted={showCompleted}
          />

          {/* 左下：不重要但紧急 */}
          <QuadrantCard
            config={quadrantConfigs.not_important_urgent}
            todos={todos}
            onTodoClick={onTodoClick}
            selectedTodoId={selectedTodoId}
            userId={userId}
            onToggleComplete={toggleComplete}
            onDelete={handleDelete}
            showCompleted={showCompleted}
          />
          {/* 右下：不重要不紧急 */}
          <QuadrantCard
            config={quadrantConfigs.not_important_not_urgent}
            todos={todos}
            onTodoClick={onTodoClick}
            selectedTodoId={selectedTodoId}
            userId={userId}
            onToggleComplete={toggleComplete}
            onDelete={handleDelete}
            showCompleted={showCompleted}
          />
        </div>
      </div>

      {/* 拖拽预览 */}
      <DragOverlay>
        {activeTodo ? (
          <DragOverlayItem todo={activeTodo} config={getActiveTodoConfig()} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
