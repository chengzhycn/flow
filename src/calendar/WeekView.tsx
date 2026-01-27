import { useState } from 'react'
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
import { type Todo, type Quadrant } from '@/api/todos'
import {
  getWeekDays,
  getWeekRange,
  isSameDay,
  isDateInRange,
  getDayName,
  toLocalISOString,
} from './CalendarUtils'

interface WeekViewProps {
  currentDate: Date
  todos: Todo[]
  onCreateTodo: (title: string, date: Date) => void
  onToggleComplete: (todo: Todo) => void
  onTodoClick?: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId?: string | null
  onUpdateTodoDate?: (todoId: string, newDate: Date) => void
}

interface DayCardProps {
  day: Date
  todos: Todo[]
  isToday: boolean
  inputValue: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  onToggleComplete: (todo: Todo) => void
  onTodoClick?: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId?: string | null
  dayKey: string
}

function getQuadrantColor(quadrant: Quadrant): string {
  if (!quadrant) return 'bg-blue-500'
  const colors: Record<NonNullable<Quadrant>, string> = {
    important_urgent: 'bg-red-500',
    important_not_urgent: 'bg-yellow-500',
    not_important_urgent: 'bg-blue-500',
    not_important_not_urgent: 'bg-gray-400',
  }
  return colors[quadrant]
}

// 检查是否是多日任务（开始日期和截止日期不在同一天）
function isMultiDayTask(todo: Todo): boolean {
  if (!todo.start_date || !todo.due_date) return false
  const startDate = new Date(todo.start_date)
  const dueDate = new Date(todo.due_date)
  return !isSameDay(startDate, dueDate)
}

// 可拖拽的任务项组件
function DraggableTodoItem({
  todo,
  onToggleComplete,
  onTodoClick,
  selectedTodoId,
}: {
  todo: Todo
  onToggleComplete: (todo: Todo) => void
  onTodoClick?: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId?: string | null
}) {
  // 多日任务不允许拖拽
  const isMultiDay = isMultiDayTask(todo)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ 
    id: todo.id,
    disabled: isMultiDay,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isMultiDay ? {} : listeners)}
      onClick={(e) => {
        if (!isDragging) {
          onTodoClick?.(todo, e)
        }
      }}
      className={`flex items-stretch rounded-lg overflow-hidden transition-colors ${
        isMultiDay ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        selectedTodoId === todo.id
          ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]/30'
          : todo.completed 
            ? 'bg-[var(--color-bg)]/50 hover:bg-[var(--color-bg)]/70' 
            : 'bg-[var(--color-bg)] hover:bg-[var(--color-bg)]/80'
      } ${isDragging ? 'shadow-lg ring-2 ring-[var(--color-accent)]/30 z-50' : ''}`}
    >
      {/* 左侧颜色条 */}
      <div className={`w-1 shrink-0 ${todo.quadrant ? getQuadrantColor(todo.quadrant) : 'bg-transparent'}`} />
      <div className="flex items-start gap-2 p-2 flex-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleComplete(todo)
          }}
          className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
            todo.completed 
              ? 'bg-emerald-500 border-emerald-500' 
              : 'border-[var(--color-border)] hover:border-emerald-500'
          }`}
        >
          {todo.completed && (
            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <p className={`flex-1 text-xs leading-tight ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
          {todo.title}
        </p>
      </div>
    </li>
  )
}

// 拖拽预览组件
function DragOverlayTodoItem({ todo }: { todo: Todo }) {
  return (
    <div className="flex items-stretch rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] shadow-xl ring-2 ring-[var(--color-accent)]/50 border border-[var(--color-border)]">
      <div className={`w-1 shrink-0 ${todo.quadrant ? getQuadrantColor(todo.quadrant) : 'bg-transparent'}`} />
      <div className="flex items-start gap-2 p-2 flex-1">
        <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          todo.completed 
            ? 'bg-emerald-500 border-emerald-500' 
            : 'border-[var(--color-border)]'
        }`}>
          {todo.completed && (
            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <p className={`flex-1 text-xs leading-tight ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
          {todo.title}
        </p>
      </div>
    </div>
  )
}

// Day card component with droppable area
function DayCard({ day, todos, isToday, inputValue, onInputChange, onSubmit, onToggleComplete, onTodoClick, selectedTodoId, dayKey }: DayCardProps) {
  // 使用 useDroppable 创建可放置区域
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dayKey}`,
    data: {
      type: 'day',
      dayKey: dayKey,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[120px] flex flex-col rounded-xl overflow-hidden shadow-sm transition-all ${
        isToday 
          ? 'bg-amber-50 dark:bg-amber-500/20' 
          : 'bg-[var(--color-bg-elevated)]'
      } ${isOver ? 'ring-2 ring-[var(--color-accent)] scale-[1.02]' : ''}`}
    >
      {/* Day header */}
      <div className={`shrink-0 px-3 py-3 text-center ${
        isToday ? 'bg-amber-100 dark:bg-amber-500/30' : ''
      }`}>
        <div className={`text-xs font-medium ${isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
          {getDayName(day.getDay())}
        </div>
        <div className={`text-lg font-bold mt-1 ${isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
          {day.getMonth() + 1}/{day.getDate()}
        </div>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {todos.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-3">暂无任务</p>
        ) : (
          <ul className="space-y-1.5">
            {todos.map((todo) => (
              <DraggableTodoItem
                key={todo.id}
                todo={todo}
                onToggleComplete={onToggleComplete}
                onTodoClick={onTodoClick}
                selectedTodoId={selectedTodoId}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Quick add input */}
      <div className="shrink-0 px-2 pb-2">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg)]/80 transition-colors">
          <span className="text-[var(--color-accent)] text-sm font-medium">+</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                onSubmit()
              }
            }}
            placeholder="添加任务"
            className="flex-1 bg-transparent border-none text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

export function WeekView({ currentDate, todos, onCreateTodo, onToggleComplete, onTodoClick, selectedTodoId, onUpdateTodoDate }: WeekViewProps) {
  const [quickAddInputs, setQuickAddInputs] = useState<Record<string, string>>({})
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null)
  
  const weekDays = getWeekDays(currentDate)
  const { start, end } = getWeekRange(currentDate)
  const today = new Date()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Split days: Sunday-Tuesday (top row), Wednesday-Saturday (bottom row)
  const topRowDays = weekDays.slice(0, 3) // Sunday, Monday, Tuesday
  const bottomRowDays = weekDays.slice(3, 7) // Wednesday, Thursday, Friday, Saturday

  // Filter todos for this week (those with start_date or due_date in this week)
  const weekTodos = todos.filter((todo) => {
    if (todo.deleted_at) return false
    
    const startDate = todo.start_date ? new Date(todo.start_date) : null
    const dueDate = todo.due_date ? new Date(todo.due_date) : null
    
    // Check if start_date or due_date falls within this week
    if (startDate && isDateInRange(startDate, start, end)) return true
    if (dueDate && isDateInRange(dueDate, start, end)) return true
    
    // Check if the todo spans across this week
    if (startDate && dueDate && startDate <= end && dueDate >= start) return true
    
    return false
  })

  // Main tasks: tasks with quadrant (important tasks)
  const mainTasks = weekTodos.filter(
    (todo) => todo.quadrant && (todo.quadrant.includes('important_urgent') || todo.quadrant.includes('important_not_urgent'))
  )

  // Get todos for a specific day
  function getTodosForDay(day: Date): Todo[] {
    return weekTodos.filter((todo) => {
      const startDate = todo.start_date ? new Date(todo.start_date) : null
      const dueDate = todo.due_date ? new Date(todo.due_date) : null
      
      // If has both dates, show on all days between
      if (startDate && dueDate) {
        return isDateInRange(day, startDate, dueDate)
      }
      
      // If only start_date, show on that day
      if (startDate && isSameDay(startDate, day)) return true
      
      // If only due_date, show on that day
      if (dueDate && isSameDay(dueDate, day)) return true
      
      return false
    })
  }

  function handleInputChange(dayKey: string, value: string) {
    setQuickAddInputs((prev) => ({ ...prev, [dayKey]: value }))
  }

  function handleQuickAdd(day: Date) {
    const key = toLocalISOString(day)
    const title = quickAddInputs[key]?.trim()
    if (!title) return
    
    onCreateTodo(title, day)
    setQuickAddInputs((prev) => ({ ...prev, [key]: '' }))
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const todo = weekTodos.find(t => t.id === active.id)
    if (todo) {
      setActiveTodo(todo)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTodo(null)

    if (!over || !onUpdateTodoDate) return

    const activeTodoItem = weekTodos.find(t => t.id === active.id)
    if (!activeTodoItem) return

    // 检查是否放到了日期列
    const overId = over.id as string
    if (overId.startsWith('day-')) {
      const targetDayKey = overId.replace('day-', '')
      const newDate = new Date(targetDayKey)
      const currentDate = activeTodoItem.start_date 
        ? new Date(activeTodoItem.start_date) 
        : activeTodoItem.due_date 
          ? new Date(activeTodoItem.due_date) 
          : null

      // 只有日期发生变化时才更新
      if (!currentDate || !isSameDay(currentDate, newDate)) {
        onUpdateTodoDate(activeTodoItem.id, newDate)
      }
    }
  }

  function renderDayCard(day: Date) {
    const dayKey = toLocalISOString(day)
    const dayTodos = getTodosForDay(day)
    const isToday = isSameDay(day, today)
    const inputValue = quickAddInputs[dayKey] || ''

    return (
      <DayCard
        key={dayKey}
        day={day}
        todos={dayTodos}
        isToday={isToday}
        inputValue={inputValue}
        onInputChange={(value) => handleInputChange(dayKey, value)}
        onSubmit={() => handleQuickAdd(day)}
        onToggleComplete={onToggleComplete}
        onTodoClick={onTodoClick}
        selectedTodoId={selectedTodoId}
        dayKey={dayKey}
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full p-4 gap-4 bg-[var(--color-bg)]">
        {/* Top row: Main tasks + Sunday-Tuesday */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Main tasks card (top-left) - same width as day cards */}
          <div className="flex-1 min-w-[120px] flex flex-col rounded-xl overflow-hidden bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/5 ring-1 ring-[var(--color-accent)]/20 shadow-sm">
            <div className="shrink-0 px-3 py-3 text-center bg-[var(--color-accent)]/10">
              <h3 className="text-xs font-medium text-[var(--color-accent)]">本周重点</h3>
              <p className="text-lg font-bold mt-1 text-[var(--color-accent)]">{mainTasks.length} 项</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {mainTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-[var(--color-text-muted)]">
                  <svg className="w-8 h-8 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-xs">暂无重要任务</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {mainTasks.map((todo) => (
                    <li
                      key={todo.id}
                      onClick={(e) => onTodoClick?.(todo, e)}
                      className={`flex items-stretch rounded-lg overflow-hidden transition-all cursor-pointer ${
                        selectedTodoId === todo.id
                          ? 'bg-[var(--color-bg)] ring-1 ring-[var(--color-accent)]/50'
                          : todo.completed 
                            ? 'bg-[var(--color-bg)]/50 hover:bg-[var(--color-bg)]/70' 
                            : 'bg-[var(--color-bg)]/80 hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {/* 左侧颜色条 */}
                      <div className={`w-1 shrink-0 ${todo.quadrant ? getQuadrantColor(todo.quadrant) : 'bg-transparent'}`} />
                      <div className="flex items-start gap-2 p-2 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleComplete(todo)
                          }}
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            todo.completed 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-[var(--color-border)] hover:border-emerald-500'
                          }`}
                        >
                          {todo.completed && (
                            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <p className={`flex-1 text-xs leading-tight ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                          {todo.title}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sunday-Tuesday cards */}
          {topRowDays.map(renderDayCard)}
        </div>

        {/* Bottom row: Wednesday-Saturday */}
        <div className="flex-1 flex gap-3 min-h-0">
          {bottomRowDays.map(renderDayCard)}
        </div>
      </div>

      {/* 拖拽预览 */}
      <DragOverlay>
        {activeTodo ? <DragOverlayTodoItem todo={activeTodo} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
