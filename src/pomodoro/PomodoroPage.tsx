import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { createPomodoroSession, updatePomodoroSessionCompleted, type PomodoroSessionType } from '@/api/pomodoro'
import { useTodosForPomodoro } from '@/todos/useTodosForPomodoro'

const DEFAULT_WORK_MIN = 25
const DEFAULT_SHORT_BREAK_MIN = 5
const DEFAULT_LONG_BREAK_MIN = 15

type Phase = { type: PomodoroSessionType; label: string; minutes: number }

// 圆环进度组件
function CircularProgress({ 
  progress, 
  size = 280, 
  strokeWidth = 8,
  phaseType 
}: { 
  progress: number
  size?: number
  strokeWidth?: number
  phaseType: PomodoroSessionType
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference
  
  // 根据阶段类型获取颜色
  const getPhaseColor = () => {
    switch (phaseType) {
      case 'work':
        return 'var(--color-accent)'
      case 'short_break':
        return '#10b981' // 绿色
      case 'long_break':
        return '#8b5cf6' // 紫色
      default:
        return 'var(--color-accent)'
    }
  }

  const phaseColor = getPhaseColor()

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* 背景圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
        className="opacity-30"
      />
      {/* 进度圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={phaseColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-300 ease-out"
        style={{
          filter: `drop-shadow(0 0 6px ${phaseColor}40)`,
        }}
      />
    </svg>
  )
}

// 阶段指示器组件
function PhaseIndicator({ 
  phases, 
  currentIndex 
}: { 
  phases: Phase[]
  currentIndex: number 
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {phases.map((phase, index) => {
        const isActive = index === currentIndex
        const isCompleted = index < currentIndex
        
        let bgColor = 'bg-[var(--color-border)]'
        if (isActive) {
          bgColor = phase.type === 'work' 
            ? 'bg-[var(--color-accent)]' 
            : phase.type === 'short_break' 
              ? 'bg-emerald-500' 
              : 'bg-violet-500'
        } else if (isCompleted) {
          bgColor = 'bg-[var(--color-text-muted)]'
        }
        
        return (
          <div
            key={index}
            className={`transition-all duration-300 ${
              phase.type === 'work' 
                ? `w-3 h-3 rounded-full ${bgColor}` 
                : `w-2 h-2 rounded-full ${bgColor}`
            } ${isActive ? 'scale-125' : ''}`}
            title={`${phase.label} (${phase.minutes}分钟)`}
          />
        )
      })}
    </div>
  )
}

export function PomodoroPage() {
  const { user } = useUser()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const [phases] = useState<Phase[]>(() => [
    { type: 'work', label: '专注', minutes: DEFAULT_WORK_MIN },
    { type: 'short_break', label: '短休息', minutes: DEFAULT_SHORT_BREAK_MIN },
    { type: 'work', label: '专注', minutes: DEFAULT_WORK_MIN },
    { type: 'short_break', label: '短休息', minutes: DEFAULT_SHORT_BREAK_MIN },
    { type: 'work', label: '专注', minutes: DEFAULT_WORK_MIN },
    { type: 'long_break', label: '长休息', minutes: DEFAULT_LONG_BREAK_MIN },
  ])
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(phases[0].minutes * 60)
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [linkedTodoId, setLinkedTodoId] = useState<string | null>(null)
  const [showTaskDropdown, setShowTaskDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { data: todos = [] } = useTodosForPomodoro(userId)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTaskDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const createSessionMutation = useMutation({
    mutationFn: createPomodoroSession,
    onSuccess: (data) => {
      setSessionId(data.id)
      setRunning(true)
    },
  })

  const completeSessionMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => updatePomodoroSessionCompleted(id, true),
  })

  const currentPhase = phases[phaseIndex]!
  const totalSeconds = currentPhase.minutes * 60
  const progress = (secondsLeft / totalSeconds) * 100

  const sessionIdRef = useRef(sessionId)
  const completeRef = useRef(completeSessionMutation.mutate)
  useEffect(() => {
    sessionIdRef.current = sessionId
    completeRef.current = completeSessionMutation.mutate
  }, [sessionId, completeSessionMutation.mutate])

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setRunning(false)
        const sid = sessionIdRef.current
        if (sid) {
          completeRef.current({ id: sid })
          setSessionId(null)
        }
        const next = phaseIndex + 1
        if (next >= phases.length) {
          setPhaseIndex(0)
          setSecondsLeft(phases[0]!.minutes * 60)
        } else {
          setPhaseIndex(next)
          setSecondsLeft(phases[next]!.minutes * 60)
        }
        return 0
      }
      return prev - 1
    })
  }, [phaseIndex, phases])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, tick])

  function handleStart() {
    if (running) return
    if (!sessionId) {
      createSessionMutation.mutate({
        user_id: userId,
        started_at: new Date().toISOString(),
        duration_minutes: currentPhase.minutes,
        type: currentPhase.type,
        completed: false,
        todo_id: linkedTodoId || null,
      })
    } else {
      setRunning(true)
    }
  }

  function handlePause() {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function handleReset() {
    handlePause()
    setSessionId(null)
    setPhaseIndex(0)
    setSecondsLeft(phases[0]!.minutes * 60)
    if (userId) queryClient.invalidateQueries({ queryKey: ['todos', userId] })
  }

  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`

  // 获取阶段对应的颜色样式
  const getPhaseTextColor = () => {
    switch (currentPhase.type) {
      case 'work':
        return 'text-[var(--color-accent)]'
      case 'short_break':
        return 'text-emerald-500'
      case 'long_break':
        return 'text-violet-500'
      default:
        return 'text-[var(--color-accent)]'
    }
  }

  const getPhaseButtonColor = () => {
    switch (currentPhase.type) {
      case 'work':
        return 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]'
      case 'short_break':
        return 'bg-emerald-500 hover:bg-emerald-600'
      case 'long_break':
        return 'bg-violet-500 hover:bg-violet-600'
      default:
        return 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]'
    }
  }

  if (!userId) return null

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">番茄钟</h1>

      {/* 阶段指示器 */}
      <PhaseIndicator phases={phases} currentIndex={phaseIndex} />

      {/* 圆环计时器 */}
      <div className="relative">
        <CircularProgress 
          progress={progress} 
          size={280} 
          strokeWidth={8}
          phaseType={currentPhase.type}
        />
        
        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-sm font-medium uppercase tracking-wider mb-2 ${getPhaseTextColor()}`}>
            {currentPhase.label}
          </p>
          <p className="text-5xl font-mono font-light tabular-nums text-[var(--color-text)]">
            {timeStr}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {currentPhase.minutes} 分钟
          </p>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={createSessionMutation.isPending}
            className={`rounded-full ${getPhaseButtonColor()} w-14 h-14 flex items-center justify-center font-medium text-white disabled:opacity-50 shadow-lg transition-all hover:scale-105 active:scale-95`}
            title="开始"
          >
            <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] w-14 h-14 flex items-center justify-center font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] shadow-lg transition-all hover:scale-105 active:scale-95"
            title="暂停"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border-2 border-[var(--color-border)] w-14 h-14 flex items-center justify-center font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] transition-all hover:scale-105 active:scale-95"
          title="重置"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* 关联任务选择 */}
      {todos.length > 0 && (
        <div className="w-full max-w-sm" ref={dropdownRef}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">关联任务</span>
          </div>
          
          <div className="relative">
            {/* 触发按钮 */}
            <button
              type="button"
              onClick={() => setShowTaskDropdown(!showTaskDropdown)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border transition-all ${
                showTaskDropdown 
                  ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20' 
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              } bg-[var(--color-bg-elevated)]`}
            >
              {linkedTodoId ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
                  <span className="text-sm text-[var(--color-text)] truncate max-w-[200px]">
                    {todos.find(t => t.id === linkedTodoId)?.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLinkedTodoId(null)
                    }}
                    className="ml-auto p-0.5 rounded-full hover:bg-[var(--color-text)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
                    title="取消关联"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-[var(--color-text-muted)]">选择任务...</span>
                  <svg 
                    className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${showTaskDropdown ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2} 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>

            {/* 下拉菜单 */}
            {showTaskDropdown && (
              <div className="absolute z-10 w-full mt-2 py-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg max-h-60 overflow-y-auto">
                {linkedTodoId && (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedTodoId(null)
                      setShowTaskDropdown(false)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5 transition-colors flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full border border-[var(--color-border)]" />
                    <span>无</span>
                  </button>
                )}
                {todos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setLinkedTodoId(t.id)
                      setShowTaskDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                      linkedTodoId === t.id 
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                        : 'text-[var(--color-text)] hover:bg-[var(--color-text)]/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      linkedTodoId === t.id ? 'bg-[var(--color-accent)]' : 'border border-[var(--color-border)]'
                    }`} />
                    <span className="truncate">{t.title}</span>
                    {linkedTodoId === t.id && (
                      <svg className="w-4 h-4 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="flex items-center gap-6 text-sm text-[var(--color-text-muted)] mt-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <span>专注 {DEFAULT_WORK_MIN}分钟</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>短休息 {DEFAULT_SHORT_BREAK_MIN}分钟</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span>长休息 {DEFAULT_LONG_BREAK_MIN}分钟</span>
        </div>
      </div>
    </div>
  )
}
