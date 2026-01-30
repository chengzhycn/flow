import { type Todo, type Quadrant } from '@/api/todos'
import { getMonthCalendarDays, isSameDay } from './CalendarUtils'

interface MonthViewProps {
  currentDate: Date
  todos: Todo[]
  onTodoClick?: (todo: Todo, event: React.MouseEvent) => void
  selectedTodoId?: string | null
  showCompleted: boolean
}

interface TaskBar {
  todo: Todo
  startCol: number
  endCol: number
  row: number
  slot: number // 任务条在垂直方向的槽位（0 = 最上层）
}

export function MonthView({ currentDate, todos, onTodoClick, selectedTodoId }: MonthViewProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const calendarDays = getMonthCalendarDays(year, month)
  const today = new Date()

  const weekDayNames = ['日', '一', '二', '三', '四', '五', '六']

  // Filter todos that have both start_date and due_date within or spanning the visible calendar
  const firstVisibleDate = calendarDays[0].date
  const lastVisibleDate = calendarDays[calendarDays.length - 1].date

  const visibleTodos = todos.filter((todo) => {
    if (todo.deleted_at) return false
    if (!todo.start_date && !todo.due_date) return false

    const startDate = todo.start_date ? new Date(todo.start_date) : null
    const dueDate = todo.due_date ? new Date(todo.due_date) : null

    // Check if the todo is visible in this calendar view
    if (startDate && dueDate) {
      return startDate <= lastVisibleDate && dueDate >= firstVisibleDate
    }

    if (startDate) {
      return startDate >= firstVisibleDate && startDate <= lastVisibleDate
    }

    if (dueDate) {
      return dueDate >= firstVisibleDate && dueDate <= lastVisibleDate
    }

    return false
  })

  // Calculate task bars for each row (week) with slot allocation
  function calculateTaskBars(): TaskBar[][] {
    const rows: TaskBar[][] = [[], [], [], [], [], []]
    // 记录每行每列每个槽位是否被占用
    const slotOccupancy: boolean[][][] = Array.from({ length: 6 }, () =>
      Array.from({ length: 7 }, () => [])
    )

    visibleTodos.forEach((todo) => {
      const startDate = todo.start_date ? new Date(todo.start_date) : (todo.due_date ? new Date(todo.due_date) : null)
      const dueDate = todo.due_date ? new Date(todo.due_date) : (todo.start_date ? new Date(todo.start_date) : null)

      if (!startDate || !dueDate) return

      // Normalize dates for comparison
      const normalizedStart = new Date(startDate)
      normalizedStart.setHours(0, 0, 0, 0)
      const normalizedEnd = new Date(dueDate)
      normalizedEnd.setHours(0, 0, 0, 0)

      // Find which days this todo spans
      calendarDays.forEach((day, index) => {
        const rowIndex = Math.floor(index / 7)
        const colIndex = index % 7
        const dayDate = new Date(day.date)
        dayDate.setHours(0, 0, 0, 0)

        // Check if this is the start of a bar segment in this row
        const isStartOfBar = isSameDay(dayDate, normalizedStart) || (colIndex === 0 && dayDate > normalizedStart && dayDate <= normalizedEnd)

        if (isStartOfBar) {
          // Calculate how many columns this bar spans in this row
          let endColIndex = colIndex
          for (let i = colIndex; i < 7; i++) {
            const checkIndex = rowIndex * 7 + i
            if (checkIndex >= calendarDays.length) break

            const checkDate = new Date(calendarDays[checkIndex].date)
            checkDate.setHours(0, 0, 0, 0)

            if (checkDate <= normalizedEnd) {
              endColIndex = i
            } else {
              break
            }
          }

          // 找到一个在所有覆盖列都空闲的槽位
          let slot = 0
          while (true) {
            let slotAvailable = true
            for (let col = colIndex; col <= endColIndex; col++) {
              if (slotOccupancy[rowIndex][col][slot]) {
                slotAvailable = false
                break
              }
            }
            if (slotAvailable) break
            slot++
          }

          // 标记槽位被占用
          for (let col = colIndex; col <= endColIndex; col++) {
            slotOccupancy[rowIndex][col][slot] = true
          }

          rows[rowIndex].push({
            todo,
            startCol: colIndex,
            endCol: endColIndex,
            row: rowIndex,
            slot,
          })
        }
      })
    })

    return rows
  }

  const taskBarsPerRow = calculateTaskBars()

  // 每个单元格最多显示的任务槽位数（根据格子高度计算，预留空间给日期数字和"+N更多"）
  const MAX_VISIBLE_SLOTS = 3

  // 计算每个单元格中溢出的任务数量（基于槽位）
  function calculateOverflowPerCell(): Map<string, { count: number; todos: Todo[] }> {
    const overflowMap = new Map<string, { count: number; todos: Todo[] }>()

    // 对于每行，统计每个单元格有多少任务超出了可见槽位
    taskBarsPerRow.forEach((bars, rowIndex) => {
      // 创建一个数组，记录每列中超出槽位限制的任务
      const overflowPerCol: Todo[][] = [[], [], [], [], [], [], []]
      const visiblePerCol: number[] = [0, 0, 0, 0, 0, 0, 0]

      bars.forEach((bar) => {
        // 这个任务条覆盖的所有列
        for (let col = bar.startCol; col <= bar.endCol; col++) {
          if (bar.slot >= MAX_VISIBLE_SLOTS) {
            overflowPerCol[col].push(bar.todo)
          } else {
            visiblePerCol[col]++
          }
        }
      })

      // 检查每列是否有溢出
      overflowPerCol.forEach((todos, colIndex) => {
        if (todos.length > 0) {
          const dayIndex = rowIndex * 7 + colIndex
          if (dayIndex < calendarDays.length) {
            const day = calendarDays[dayIndex]
            const key = day.date.toISOString()
            overflowMap.set(key, {
              count: todos.length,
              todos: todos,
            })
          }
        }
      })
    })

    return overflowMap
  }

  const overflowPerCell = calculateOverflowPerCell()

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

  return (
    <div className="h-full flex flex-col p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekDayNames.map((name, index) => (
          <div
            key={name}
            className={`text-center py-2 text-sm font-medium ${index === 0 || index === 6 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'
              }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-rows-6 gap-px bg-[var(--color-border)]">
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-px relative">
            {/* Day cells */}
            {calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7).map((day) => {
              const isToday = isSameDay(day.date, today)

              return (
                <div
                  key={day.date.toISOString()}
                  className={`bg-[var(--color-bg)] p-2 min-h-[100px] relative ${!day.isCurrentMonth ? 'opacity-40' : ''
                    }`}
                >
                  <div
                    className={`text-sm font-medium ${isToday
                        ? 'w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center'
                        : day.isCurrentMonth
                          ? 'text-[var(--color-text)]'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                  >
                    {day.dayOfMonth}
                  </div>
                </div>
              )
            })}

            {/* Task bars overlay for this row */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ top: '40px' }}>
              {taskBarsPerRow[rowIndex]
                .filter((bar) => bar.slot < MAX_VISIBLE_SLOTS)
                .map((bar) => {
                  const leftPercent = (bar.startCol / 7) * 100
                  const widthPercent = ((bar.endCol - bar.startCol + 1) / 7) * 100
                  const topOffset = bar.slot * 22 // 使用槽位确定垂直位置
                  const isSelected = selectedTodoId === bar.todo.id

                  return (
                    <div
                      key={`${bar.todo.id}-${rowIndex}`}
                      className={`absolute h-5 rounded-sm pointer-events-auto cursor-pointer transition-all ${getQuadrantColor(bar.todo.quadrant)} ${bar.todo.completed ? 'opacity-50' : ''
                        } ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--color-accent)]' : 'hover:brightness-110'}`}
                      style={{
                        left: `calc(${leftPercent}% + 4px)`,
                        width: `calc(${widthPercent}% - 8px)`,
                        top: `${topOffset}px`,
                      }}
                      title={`${bar.todo.title}${bar.todo.completed ? ' (已完成)' : ''}`}
                      onClick={(e) => onTodoClick?.(bar.todo, e)}
                    >
                      <span className="px-1.5 text-[10px] text-white truncate block leading-5">
                        {bar.todo.title}
                      </span>
                    </div>
                  )
                })}
            </div>

            {/* Overflow indicators for each cell */}
            {calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7).map((day, colIndex) => {
              const overflow = overflowPerCell.get(day.date.toISOString())
              if (!overflow) return null

              const leftPercent = (colIndex / 7) * 100
              const widthPercent = (1 / 7) * 100
              const topOffset = MAX_VISIBLE_SLOTS * 22 + 40 // Below the visible tasks

              return (
                <div
                  key={`overflow-${day.date.toISOString()}`}
                  className="absolute pointer-events-auto cursor-pointer text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded px-1"
                  style={{
                    left: `calc(${leftPercent}% + 4px)`,
                    width: `calc(${widthPercent}% - 8px)`,
                    top: `${topOffset}px`,
                  }}
                  title={overflow.todos.map(t => t.title).join('\n')}
                >
                  +{overflow.count} 更多
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="shrink-0 mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-6 text-xs text-[var(--color-text-muted)]">
          <span className="font-medium">图例：</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>重要且紧急</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-yellow-500" />
            <span>重要不紧急</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>不重要但紧急 / 默认</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-400" />
            <span>不重要不紧急</span>
          </div>
        </div>
      </div>
    </div>
  )
}
