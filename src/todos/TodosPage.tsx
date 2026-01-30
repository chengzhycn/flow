import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@/auth/useUser'
import { fetchTodos, createTodo, updateTodo, deleteTodo, restoreTodo, permanentlyDeleteTodo, type Todo, type Quadrant } from '@/api/todos'
import {
  fetchProjects,
  createProject,
  deleteProject,
  fetchMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  fetchProjectTaskStats,
  fetchProjectTodos,
  type Milestone,
} from '@/api/projects'
import { TodoSidebar, type TodoFilter } from './TodoSidebar'
import { Dropdown } from './Dropdown'
import { DatePicker } from './DatePicker'

export function TodosPage() {
  const [searchParams] = useSearchParams()
  const filter = (searchParams.get('filter') || 'inbox') as TodoFilter
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [editingQuadrant, setEditingQuadrant] = useState<Quadrant>(null)
  const [editingStartDate, setEditingStartDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [subTodoInput, setSubTodoInput] = useState<Record<string, string>>({})
  const [quickCreateTitle, setQuickCreateTitle] = useState('')
  // 项目相关状态
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('')
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(220)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(600)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showMilestoneDropdown, setShowMilestoneDropdown] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const milestoneDropdownRef = useRef<HTMLDivElement>(null)
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

  // 当选中任务或里程碑且在小屏幕上时，自动显示详情栏
  useEffect(() => {
    if ((selectedTodoId || selectedMilestoneId) && !isLargeScreen) {
      setShowDetailPanel(true)
    }
  }, [selectedTodoId, selectedMilestoneId, isLargeScreen])

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

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false)
      }
      if (milestoneDropdownRef.current && !milestoneDropdownRef.current.contains(event.target as Node)) {
        setShowMilestoneDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos', userId, filter],
    queryFn: () => fetchTodos(userId, filter === 'deleted'),
    enabled: !!userId,
  })

  // 获取用户的所有项目
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => fetchProjects(userId),
    enabled: !!userId,
  })

  // 获取当前编辑项目的里程碑 (用于任务详情编辑)
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', editingProjectId],
    queryFn: () => fetchMilestones(editingProjectId!),
    enabled: !!editingProjectId,
  })

  // 获取选中项目的里程碑 (用于项目详情视图)
  const { data: selectedProjectMilestones = [] } = useQuery({
    queryKey: ['milestones', selectedProjectId],
    queryFn: () => fetchMilestones(selectedProjectId!),
    enabled: !!selectedProjectId,
  })

  // 获取选中项目的任务统计
  const { data: projectTaskStats = { total: 0, completed: 0 } } = useQuery({
    queryKey: ['projectTaskStats', selectedProjectId],
    queryFn: () => fetchProjectTaskStats(selectedProjectId!),
    enabled: !!selectedProjectId,
  })

  // 获取选中项目的任务列表
  const { data: projectTodos = [] } = useQuery({
    queryKey: ['projectTodos', selectedProjectId],
    queryFn: () => fetchProjectTodos(selectedProjectId!),
    enabled: !!selectedProjectId,
  })

  // 选中的项目
  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null

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

  // 选中的里程碑
  const selectedMilestone = selectedMilestoneId
    ? selectedProjectMilestones.find((m) => m.id === selectedMilestoneId)
    : null

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
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['projectTodos', selectedProjectId] })
        queryClient.invalidateQueries({ queryKey: ['projectTaskStats', selectedProjectId] })
      }
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

  // 项目相关 Mutations
  const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createProject(userId, {
      name,
      description: null,
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', userId] }),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, deletedId) => {
      console.log('[deleteProject] Success, deleted:', deletedId)
      queryClient.invalidateQueries({ queryKey: ['projects', userId] })
      if (selectedProjectId === deletedId) setSelectedProjectId(null)
    },
    onError: (error) => {
      console.error('[deleteProject] Error:', error)
    },
  })

  const createMilestoneMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; due_date: string | null }) =>
      createMilestone(data.projectId, { name: data.name, due_date: data.due_date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] })
      setNewMilestoneName('')
      setNewMilestoneDueDate('')
    },
  })

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateMilestone>[1] }) =>
      updateMilestone(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] }),
  })

  const deleteMilestoneMutation = useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] }),
  })

  const createProjectTaskMutation = useMutation({
    mutationFn: (data: { title: string; project_id: string; milestone_id: string | null; start_date?: string; due_date?: string }) =>
      createTodo(userId, {
        title: data.title,
        inbox: false,
        project_id: data.project_id,
        milestone_id: data.milestone_id,
        quadrant: 'not_important_not_urgent',
        start_date: data.start_date || null,
        due_date: data.due_date || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTodos', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['projectTaskStats', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['todos', userId] })
    },
  })

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

  function handleQuickCreate() {
    const title = quickCreateTitle.trim()
    if (!title) return
    const today = new Date().toISOString()
    createMutation.mutate({
      title,
      description: null,
      quadrant: 'not_important_not_urgent',
      start_date: today,
      due_date: today,
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
    setEditingProjectId(todo.project_id)
    setEditingMilestoneId(todo.milestone_id)
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
          project_id: editingProjectId,
          milestone_id: editingMilestoneId,
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
      {/* 左侧栏：过滤器 + 项目 + 归档 */}
      <div className="shrink-0 border-r border-[var(--color-border)] relative flex flex-col px-2 py-2" style={{ width: `${leftSidebarWidth}px` }}>
        <div className="flex-1 overflow-y-auto">
          <TodoSidebar
            filter={filter}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onCreateProject={(name) => createProjectMutation.mutate(name)}
            onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
          />
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

      {/* 中间栏：任务清单 或 项目详情 */}
      <div className="flex-1 flex flex-col min-w-0 px-4">
        {selectedProject ? (
          /* 项目详情视图 */
          <div className="h-full flex flex-col">
            {/* Compact Project Header with Integrated Progress */}
            <div className="flex flex-col mb-4">
              <div className="flex items-center justify-between px-1 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedProject.color }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">{selectedProject.name}</h2>
                    {selectedProject.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedProject.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-[var(--color-text-muted)] font-medium bg-[var(--color-bg-elevated)] px-2 py-1 rounded">
                    任务: {projectTaskStats.completed}/{projectTaskStats.total}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] font-medium bg-[var(--color-bg-elevated)] px-2 py-1 rounded">
                    里程碑: {selectedProjectMilestones.filter((m: Milestone) => m.completed).length}/{selectedProjectMilestones.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteProjectMutation.mutate(selectedProject.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded transition-colors"
                    title="删除项目"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {/* 里程碑分组 */}
              {/* 里程碑分组 */}
              {/* 里程碑分组 */}
              {(() => {
                // Find current milestone: Not completed, sorted by due date (nulls last)
                const currentMilestoneId = selectedProjectMilestones
                  .filter((m: Milestone) => !m.completed)
                  .sort((a: Milestone, b: Milestone) => {
                    if (!a.due_date) return 1
                    if (!b.due_date) return -1
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                  })[0]?.id

                return selectedProjectMilestones.map((milestone: Milestone) => {
                  const milestoneTodos = projectTodos.filter((t: { milestone_id: string | null }) => t.milestone_id === milestone.id)
                  const total = milestoneTodos.length
                  const completed = milestoneTodos.filter((t: { completed: boolean }) => t.completed).length
                  const progress = total > 0 ? (completed / total) * 100 : 0

                  return (
                    <div
                      key={milestone.id}
                      onClick={() => {
                        setSelectedMilestoneId(milestone.id)
                        setSelectedTodoId(null)
                      }}
                      className={`mb-6 rounded-xl p-4 transition-all cursor-pointer ${milestone.id === selectedMilestoneId
                        ? 'bg-[var(--color-accent)]/20'
                        : milestone.id === currentMilestoneId
                          ? 'bg-[var(--color-accent)]/10'
                          : 'bg-[var(--color-bg-elevated)]'
                        }`}
                    >
                      {/* Compact Milestone Header */}
                      <div className="flex items-center gap-2 px-1 mb-2 group">
                        <button
                          type="button"
                          onClick={() => updateMilestoneMutation.mutate({ id: milestone.id, patch: { completed: !milestone.completed } })}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${milestone.completed ? 'bg-[var(--color-text-muted)] border-[var(--color-text-muted)]' : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]'}`}
                        >
                          {milestone.completed && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className={`text-sm font-bold ${milestone.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{milestone.name}</span>
                          {milestone.due_date && (
                            <span className={`text-xs shrink-0 ${new Date(milestone.due_date) < new Date() && !milestone.completed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                              {new Date(milestone.due_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* 进度条 */}
                      {total > 0 && (
                        <div className="px-1 mb-3">
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
                            <span>进度</span>
                            <span>{completed}/{total}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--color-bg)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 里程碑下的任务 */}
                      <div className="space-y-0.5">
                        {projectTodos.filter((t: { milestone_id: string | null }) => t.milestone_id === milestone.id).map((todo: { id: string; title: string; completed: boolean; deleted_at?: string | null }) => (
                          <div
                            key={todo.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTodoId(todo.id)
                              setSelectedMilestoneId(null)
                            }}
                            className={`group flex items-stretch rounded-lg overflow-hidden cursor-pointer transition-all ${selectedTodoId === todo.id ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-accent)]/5'} ${todo.deleted_at ? 'opacity-60' : ''}`}
                          >
                            <div className={`w-1 shrink-0 ${getQuadrantBarColor(todos.find(t => t.id === todo.id)?.quadrant || null)}`} />
                            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const fullTodo = todos.find(t => t.id === todo.id)
                                  if (fullTodo) toggleComplete(fullTodo)
                                }}
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${todo.completed ? 'bg-[var(--color-text-muted)] border-[var(--color-text-muted)]' : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]'}`}
                              >
                                {todo.completed && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                <span className={`text-[13px] truncate ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{todo.title}</span>
                                {todos.find(t => t.id === todo.id)?.due_date && (
                                  <span className={`text-xs ${new Date(todos.find(t => t.id === todo.id)?.due_date!).getTime() < Date.now() && !todo.completed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {formatDate(todos.find(t => t.id === todo.id)?.due_date!)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="pl-3">
                          <MilestoneTaskInput onAdd={(title) => {
                            const today = new Date().toISOString()
                            createProjectTaskMutation.mutate({ title, project_id: selectedProjectId!, milestone_id: milestone.id, start_date: today, due_date: today })
                          }} />
                        </div>
                      </div>
                    </div>
                  )
                }
                )
              })()}

              {/* 添加里程碑 */}
              <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <input
                    type="text"
                    value={newMilestoneName}
                    onChange={(e) => setNewMilestoneName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMilestoneName.trim()) {
                        createMilestoneMutation.mutate({ projectId: selectedProjectId!, name: newMilestoneName.trim(), due_date: newMilestoneDueDate || null })
                      }
                    }}
                    placeholder="添加新的里程碑..."
                    className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                  />
                  <DatePicker
                    value={newMilestoneDueDate}
                    onChange={setNewMilestoneDueDate}
                    placeholder="截止日期"
                    className="w-36"
                  />
                </div>
              </div>

              {/* 未归类任务 */}
              {/* 未归类任务 */}
              <div className="mb-6 bg-[var(--color-bg-elevated)] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2 px-1 mb-2">
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  未归类任务
                </h3>
                <div className="space-y-0.5">
                  {projectTodos.filter((t: { milestone_id: string | null }) => !t.milestone_id).map((todo: { id: string; title: string; completed: boolean; deleted_at?: string | null }) => (
                    <div
                      key={todo.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTodoId(todo.id)
                        setSelectedMilestoneId(null)
                      }}
                      className={`group flex items-stretch rounded-lg overflow-hidden cursor-pointer transition-all ${selectedTodoId === todo.id ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-accent)]/5'} ${todo.deleted_at ? 'opacity-60' : ''}`}
                    >
                      <div className={`w-1 shrink-0 ${getQuadrantBarColor(todos.find(t => t.id === todo.id)?.quadrant || null)}`} />
                      <div className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const fullTodo = todos.find(t => t.id === todo.id)
                            if (fullTodo) toggleComplete(fullTodo)
                          }}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${todo.completed ? 'bg-[var(--color-text-muted)] border-[var(--color-text-muted)]' : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]'}`}
                        >
                          {todo.completed && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                          <span className={`text-[13px] truncate ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{todo.title}</span>
                          {todos.find(t => t.id === todo.id)?.due_date && (
                            <span className={`text-xs ${new Date(todos.find(t => t.id === todo.id)?.due_date!).getTime() < Date.now() && !todo.completed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                              {formatDate(todos.find(t => t.id === todo.id)?.due_date!)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="px-3">
                    <MilestoneTaskInput onAdd={(title) => {
                      const today = new Date().toISOString()
                      createProjectTaskMutation.mutate({ title, project_id: selectedProjectId!, milestone_id: null, start_date: today, due_date: today })
                    }} placeholder="添加任务..." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 任务清单视图 */
          <>
            <div className="flex items-center justify-between mb-4 py-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center text-[var(--color-text)]">
                  {filter === 'today' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
                  {filter === 'week' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
                  {filter === 'inbox' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5" /></svg>}
                  {filter === 'completed' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  {filter === 'deleted' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>}
                  {filter === 'all' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>}
                </div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  {filter === 'today' && '今天'}
                  {filter === 'week' && '最近7天'}
                  {filter === 'inbox' && '收集箱'}
                  {filter === 'completed' && '已完成'}
                  {filter === 'deleted' && '垃圾桶'}
                  {filter === 'all' && '全部任务'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                </button>
                <button className="p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                </button>
              </div>
            </div>

            {/* Quick Add at Top */}
            {filter !== 'deleted' && filter !== 'completed' && (
              <div className="mb-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-elevated)]/50 hover:bg-[var(--color-bg-elevated)] rounded-lg transition-colors group cursor-text" onClick={() => (document.getElementById('quick-add-input') as HTMLInputElement)?.focus()}>
                  <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors text-lg pt-0.5">+</span>
                  <input
                    id="quick-add-input"
                    type="text"
                    value={quickCreateTitle}
                    onChange={(e) => setQuickCreateTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && quickCreateTitle.trim()) handleQuickCreate() }}
                    placeholder={`添加任务至"${filter === 'today' ? '今天' :
                      filter === 'week' ? '最近7天' :
                        filter === 'inbox' ? '收集箱' :
                          filter === 'all' ? '全部任务' : ''
                      }"`}
                    className="flex-1 bg-transparent border-none text-[13px] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4">
                <ul className="space-y-1">
                  {filteredTodos.map((todo) => {
                    return (
                      <li
                        key={todo.id}
                        onClick={() => {
                          setSelectedTodoId(todo.id)
                          setSelectedMilestoneId(null)
                        }}
                        className={`group flex items-stretch rounded-lg overflow-hidden cursor-pointer transition-all ${selectedTodoId === todo.id ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-accent)]/5'} ${todo.deleted_at ? 'opacity-60' : ''}`}
                      >
                        <div className={`w-1 shrink-0 ${getQuadrantBarColor(todo.quadrant)}`} />
                        <div className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleComplete(todo) }}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${todo.completed ? 'bg-[var(--color-text-muted)] border-[var(--color-text-muted)]' : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]'}`}
                          >
                            {todo.completed && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                            <span className={`text-[13px] truncate ${todo.completed || todo.deleted_at ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{todo.title}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs shrink-0">
                            {todo.project_id && (
                              <span className="text-[var(--color-text-muted)] flex items-center gap-1">
                                {/* Find project name */}
                                {projects.find(p => p.id === todo.project_id) && (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: projects.find(p => p.id === todo.project_id)?.color }} />
                                    <span className="hidden sm:inline-block max-w-[60px] truncate">{projects.find(p => p.id === todo.project_id)?.name}</span>
                                  </>
                                )}
                              </span>
                            )}
                            {todo.due_date && (
                              <span className={`${new Date(todo.due_date) < new Date() && !todo.completed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                                {formatDate(todo.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {filteredTodos.length === 0 && <p className="text-center text-[var(--color-text-muted)] py-8">暂无任务</p>}
              </div>


            </div>
          </>
        )}
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
            className={`${isLargeScreen
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
                <div className="space-y-4">
                  <div className="sticky top-0 bg-[var(--color-bg)] pt-3 pb-4">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">任务详情</h2>
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
                    <div className="bg-[var(--color-bg-elevated)] rounded-xl p-6 space-y-4">
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
                          重要程度
                        </label>
                        <Dropdown
                          value={editingQuadrant}
                          onChange={(value) => setEditingQuadrant(value as typeof editingQuadrant || null)}
                          options={[
                            { value: 'important_urgent', label: '重要且紧急', color: '#ef4444' }, // red-500
                            { value: 'important_not_urgent', label: '重要不紧急', color: '#eab308' }, // yellow-500
                            { value: 'not_important_urgent', label: '不重要但紧急', color: '#3b82f6' }, // blue-500
                            { value: 'not_important_not_urgent', label: '不重要不紧急', color: '#9ca3af' }, // gray-400
                          ]}
                          placeholder="未设置"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">启动时间</label>
                          <DatePicker
                            value={editingStartDate}
                            onChange={setEditingStartDate}
                            placeholder="选择日期"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">截止时间</label>
                          <DatePicker
                            value={editingDueDate}
                            onChange={setEditingDueDate}
                            placeholder="选择日期"
                          />
                        </div>
                      </div>
                      {/* 项目/里程碑关联 */}
                      <div ref={projectDropdownRef}>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          关联项目
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${showProjectDropdown
                              ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                              : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                              } bg-[var(--color-bg-elevated)]`}
                          >
                            {editingProjectId ? (
                              <>
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: projects.find(p => p.id === editingProjectId)?.color || 'var(--color-accent)' }}
                                />
                                <span className="text-sm text-[var(--color-text)] truncate flex-1 text-left">
                                  {projects.find(p => p.id === editingProjectId)?.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingProjectId(null)
                                    setEditingMilestoneId(null)
                                  }}
                                  className="p-0.5 rounded-full hover:bg-[var(--color-text)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
                                  title="清除"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-[var(--color-text-muted)] flex-1 text-left">选择项目...</span>
                                <svg
                                  className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`}
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

                          {showProjectDropdown && (
                            <div className="absolute z-10 w-full mt-2 py-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg max-h-60 overflow-y-auto">
                              {editingProjectId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProjectId(null)
                                    setEditingMilestoneId(null)
                                    setShowProjectDropdown(false)
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5 transition-colors flex items-center gap-2"
                                >
                                  <span className="w-3 h-3 rounded-full border border-[var(--color-border)]" />
                                  <span>无项目</span>
                                </button>
                              )}
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingProjectId(project.id)
                                    setEditingMilestoneId(null)
                                    setShowProjectDropdown(false)
                                  }}
                                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${editingProjectId === project.id
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                    : 'text-[var(--color-text)] hover:bg-[var(--color-text)]/5'
                                    }`}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: project.color }}
                                  />
                                  <span className="truncate flex-1">{project.name}</span>
                                  {editingProjectId === project.id && (
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {editingProjectId && milestones.length > 0 && (
                        <div ref={milestoneDropdownRef}>
                          <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                            关联里程碑
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowMilestoneDropdown(!showMilestoneDropdown)}
                              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${showMilestoneDropdown
                                ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                                } bg-[var(--color-bg-elevated)]`}
                            >
                              {editingMilestoneId ? (
                                <>
                                  <svg className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                  </svg>
                                  <span className="text-sm text-[var(--color-text)] truncate flex-1 text-left">
                                    {milestones.find(m => m.id === editingMilestoneId)?.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingMilestoneId(null)
                                    }}
                                    className="p-0.5 rounded-full hover:bg-[var(--color-text)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
                                    title="清除"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm text-[var(--color-text-muted)] flex-1 text-left">选择里程碑...</span>
                                  <svg
                                    className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${showMilestoneDropdown ? 'rotate-180' : ''}`}
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

                            {showMilestoneDropdown && (
                              <div className="absolute z-10 w-full mt-2 py-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg max-h-60 overflow-y-auto">
                                {editingMilestoneId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMilestoneId(null)
                                      setShowMilestoneDropdown(false)
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5 transition-colors flex items-center gap-2"
                                  >
                                    <span className="w-3 h-3 rounded-full border border-[var(--color-border)]" />
                                    <span>无里程碑</span>
                                  </button>
                                )}
                                {milestones.map((milestone) => (
                                  <button
                                    key={milestone.id}
                                    type="button"
                                    onClick={() => {
                                      setEditingMilestoneId(milestone.id)
                                      setShowMilestoneDropdown(false)
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${editingMilestoneId === milestone.id
                                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                      : 'text-[var(--color-text)] hover:bg-[var(--color-text)]/5'
                                      }`}
                                  >
                                    <svg className={`w-4 h-4 shrink-0 ${editingMilestoneId === milestone.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                    </svg>
                                    <span className="truncate flex-1">{milestone.name}</span>
                                    {editingMilestoneId === milestone.id && (
                                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                    <div className="bg-[var(--color-bg-elevated)] rounded-xl p-6 space-y-6">
                      {/* 标题 - 点击直接编辑 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          {editingId === `title-${selectedTodo.id}` ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => {
                                if (editingTitle.trim() && editingTitle !== selectedTodo.title) {
                                  updateMutation.mutate({ id: selectedTodo.id, patch: { title: editingTitle.trim() } })
                                }
                                setEditingId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingTitle.trim() && editingTitle !== selectedTodo.title) {
                                    updateMutation.mutate({ id: selectedTodo.id, patch: { title: editingTitle.trim() } })
                                  }
                                  setEditingId(null)
                                } else if (e.key === 'Escape') {
                                  setEditingId(null)
                                }
                              }}
                              autoFocus
                              className="flex-1 text-base font-semibold text-[var(--color-text)] bg-transparent border-b-2 border-[var(--color-accent)] focus:outline-none"
                            />
                          ) : (
                            <h3
                              className="text-base font-semibold text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)] transition-colors"
                              onClick={() => {
                                if (!selectedTodo.deleted_at) {
                                  setEditingTitle(selectedTodo.title)
                                  setEditingId(`title-${selectedTodo.id}`)
                                }
                              }}
                              title="点击编辑"
                            >
                              {selectedTodo.title}
                            </h3>
                          )}
                          <div className="flex gap-1 ml-2">
                            {!selectedTodo.deleted_at && (
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
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          {!selectedTodo.deleted_at && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleComplete(selectedTodo)}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedTodo.completed
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
                          {/* 重要程度 - 下拉框选择 */}
                          {!selectedTodo.deleted_at && (
                            <div className="w-32">
                              <Dropdown
                                value={selectedTodo.quadrant || 'not_important_not_urgent'}
                                onChange={(value) => {
                                  updateMutation.mutate({ id: selectedTodo.id, patch: { quadrant: value as typeof selectedTodo.quadrant } })
                                }}
                                options={[
                                  { value: 'important_urgent', label: '重要且紧急', color: '#ef4444' },
                                  { value: 'important_not_urgent', label: '重要不紧急', color: '#eab308' },
                                  { value: 'not_important_urgent', label: '不重要但紧急', color: '#3b82f6' },
                                  { value: 'not_important_not_urgent', label: '不重要不紧急', color: '#9ca3af' },
                                ]}
                              />
                            </div>
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

                      {/* 描述 - 点击直接编辑 */}
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">描述</h4>
                        {editingId === `desc-${selectedTodo.id}` ? (
                          <textarea
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            onBlur={() => {
                              const newDesc = editingDescription.trim() || null
                              if (newDesc !== (selectedTodo.description || '')) {
                                updateMutation.mutate({ id: selectedTodo.id, patch: { description: newDesc } })
                              }
                              setEditingId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingId(null)
                              }
                            }}
                            autoFocus
                            rows={4}
                            placeholder="添加描述..."
                            className="w-full text-sm text-[var(--color-text)] bg-[var(--color-bg)] rounded-lg p-3 border-2 border-[var(--color-accent)] focus:outline-none resize-none"
                          />
                        ) : (
                          <div
                            className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap bg-[var(--color-bg)] rounded-lg p-3 cursor-pointer hover:bg-[var(--color-bg)]/80 transition-colors min-h-[60px]"
                            onClick={() => {
                              if (!selectedTodo.deleted_at) {
                                setEditingDescription(selectedTodo.description || '')
                                setEditingId(`desc-${selectedTodo.id}`)
                              }
                            }}
                            title="点击编辑"
                          >
                            {selectedTodo.description || <span className="text-[var(--color-text-muted)]/50 italic">点击添加描述...</span>}
                          </div>
                        )}
                      </div>

                      {/* 时间信息 - 点击直接编辑 */}
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">时间信息</h4>
                        <div className="space-y-2 text-sm">
                          {/* 启动时间 */}
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--color-text-muted)]">启动时间：</span>
                            {!selectedTodo.deleted_at ? (
                              <DatePicker
                                value={selectedTodo.start_date ? new Date(selectedTodo.start_date).toISOString().split('T')[0] : ''}
                                onChange={(value) => {
                                  const newDate = value ? new Date(value).toISOString() : null
                                  updateMutation.mutate({ id: selectedTodo.id, patch: { start_date: newDate } })
                                }}
                                placeholder="未设置"
                                className="w-36"
                              />
                            ) : (
                              <span className="text-[var(--color-text)]">
                                {selectedTodo.start_date ? formatDate(selectedTodo.start_date) : <span className="text-[var(--color-text-muted)]/50 italic">未设置</span>}
                              </span>
                            )}
                          </div>
                          {/* 截止时间 */}
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--color-text-muted)]">截止时间：</span>
                            {!selectedTodo.deleted_at ? (
                              <DatePicker
                                value={selectedTodo.due_date ? new Date(selectedTodo.due_date).toISOString().split('T')[0] : ''}
                                onChange={(value) => {
                                  const newDate = value ? new Date(value).toISOString() : null
                                  updateMutation.mutate({ id: selectedTodo.id, patch: { due_date: newDate } })
                                }}
                                placeholder="未设置"
                                className="w-36"
                              />
                            ) : (
                              <span className={`${selectedTodo.due_date && new Date(selectedTodo.due_date) < new Date() ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                                {selectedTodo.due_date ? formatDate(selectedTodo.due_date) : <span className="text-[var(--color-text-muted)]/50 italic">未设置</span>}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">创建时间：</span>
                            <span className="text-[var(--color-text)]">{formatDate(selectedTodo.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 项目关联信息 - 点击直接编辑 */}
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">项目关联</h4>
                        <div className="space-y-2 text-sm">
                          {editingId === `project-${selectedTodo.id}` ? (
                            <div className="space-y-3">
                              {/* 项目下拉 */}
                              <div ref={projectDropdownRef} className="relative">
                                <button
                                  type="button"
                                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                                  className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${showProjectDropdown
                                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                                    : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                                    } bg-[var(--color-bg)]`}
                                >
                                  {editingProjectId ? (
                                    <>
                                      <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: projects.find(p => p.id === editingProjectId)?.color || 'var(--color-accent)' }}
                                      />
                                      <span className="text-sm text-[var(--color-text)] truncate flex-1 text-left">
                                        {projects.find(p => p.id === editingProjectId)?.name}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm text-[var(--color-text-muted)] flex-1 text-left">选择项目...</span>
                                      <svg
                                        className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`}
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

                                {showProjectDropdown && (
                                  <div className="absolute z-10 w-full mt-2 py-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg max-h-60 overflow-y-auto">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProjectId(null)
                                        setEditingMilestoneId(null)
                                        setShowProjectDropdown(false)
                                        updateMutation.mutate({ id: selectedTodo.id, patch: { project_id: null, milestone_id: null } })
                                        setEditingId(null)
                                      }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5 transition-colors flex items-center gap-2"
                                    >
                                      <span className="w-3 h-3 rounded-full border border-[var(--color-border)]" />
                                      <span>无项目</span>
                                    </button>
                                    {projects.map((project) => (
                                      <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => {
                                          setEditingProjectId(project.id)
                                          setEditingMilestoneId(null)
                                          setShowProjectDropdown(false)
                                          // 如果没有里程碑则直接保存
                                          updateMutation.mutate({ id: selectedTodo.id, patch: { project_id: project.id, milestone_id: null } })
                                          setEditingId(null)
                                        }}
                                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${editingProjectId === project.id
                                          ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                          : 'text-[var(--color-text)] hover:bg-[var(--color-text)]/5'
                                          }`}
                                      >
                                        <div
                                          className="w-3 h-3 rounded-full shrink-0"
                                          style={{ backgroundColor: project.color }}
                                        />
                                        <span className="truncate flex-1">{project.name}</span>
                                        {editingProjectId === project.id && (
                                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 里程碑下拉 */}
                              {editingProjectId && milestones.length > 0 && (
                                <div ref={milestoneDropdownRef} className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setShowMilestoneDropdown(!showMilestoneDropdown)}
                                    className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${showMilestoneDropdown
                                      ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                                      : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                                      } bg-[var(--color-bg-elevated)]`}
                                  >
                                    {editingMilestoneId ? (
                                      <>
                                        <svg className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                        </svg>
                                        <span className="text-sm text-[var(--color-text)] truncate flex-1 text-left">
                                          {milestones.find(m => m.id === editingMilestoneId)?.name}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm text-[var(--color-text-muted)] flex-1 text-left">选择里程碑...</span>
                                        <svg
                                          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${showMilestoneDropdown ? 'rotate-180' : ''}`}
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

                                  {showMilestoneDropdown && (
                                    <div className="absolute z-10 w-full mt-2 py-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg max-h-60 overflow-y-auto">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMilestoneId(null)
                                          setShowMilestoneDropdown(false)
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-text)]/5 transition-colors flex items-center gap-2"
                                      >
                                        <span className="w-3 h-3 rounded-full border border-[var(--color-border)]" />
                                        <span>无里程碑</span>
                                      </button>
                                      {milestones.map((milestone) => (
                                        <button
                                          key={milestone.id}
                                          type="button"
                                          onClick={() => {
                                            setEditingMilestoneId(milestone.id)
                                            setShowMilestoneDropdown(false)
                                            updateMutation.mutate({ id: selectedTodo.id, patch: { project_id: editingProjectId, milestone_id: milestone.id } })
                                            setEditingId(null)
                                          }}
                                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${editingMilestoneId === milestone.id
                                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                            : 'text-[var(--color-text)] hover:bg-[var(--color-text)]/5'
                                            }`}
                                        >
                                          <svg className={`w-4 h-4 shrink-0 ${editingMilestoneId === milestone.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                          </svg>
                                          <span className="truncate flex-1">{milestone.name}</span>
                                          {editingMilestoneId === milestone.id && (
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : selectedTodo.project_id ? (
                            <div
                              className="cursor-pointer hover:bg-[var(--color-bg-elevated)] rounded-lg p-2 -m-2 transition-colors"
                              onClick={() => {
                                if (!selectedTodo.deleted_at) {
                                  setEditingProjectId(selectedTodo.project_id)
                                  setEditingMilestoneId(selectedTodo.milestone_id)
                                  setEditingId(`project-${selectedTodo.id}`)
                                }
                              }}
                              title="点击编辑"
                            >
                              {(() => {
                                const project = projects.find(p => p.id === selectedTodo.project_id)
                                return project ? (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span className="text-[var(--color-text)]">{project.name}</span>
                                  </div>
                                ) : null
                              })()}
                              {selectedTodo.milestone_id && (
                                <div className="flex items-center gap-2 mt-1">
                                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                  </svg>
                                  <span className="text-[var(--color-text-muted)]">
                                    {milestones.find(m => m.id === selectedTodo.milestone_id)?.name || '已关联'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : !selectedTodo.deleted_at && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProjectId(null)
                                setEditingMilestoneId(null)
                                setEditingId(`project-${selectedTodo.id}`)
                              }}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                            >
                              + 关联项目
                            </button>
                          )}
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
                                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${child.completed
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
              ) : selectedMilestone ? (
                (() => {
                  const milestoneTodos = projectTodos.filter((t: { milestone_id: string | null }) => t.milestone_id === selectedMilestone.id)
                  const total = milestoneTodos.length
                  const completed = milestoneTodos.filter((t: { completed: boolean }) => t.completed).length
                  const progress = total > 0 ? (completed / total) * 100 : 0

                  return (
                    <div className="space-y-4">
                      <div className="sticky top-0 bg-[var(--color-bg)] pt-3 pb-4">
                        <div className="flex items-center justify-between px-1">
                          <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">里程碑详情</h2>
                          {!isLargeScreen && (
                            <button
                              type="button"
                              onClick={() => setShowDetailPanel(false)}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-6 space-y-6">
                        {/* 进度情况 */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-[var(--color-text)]">完成进度</h4>
                            <span className="text-sm text-[var(--color-text-muted)]">{completed}/{total}</span>
                          </div>
                          <div className="h-2 w-full bg-[var(--color-bg)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                              里程碑名称
                            </label>
                            <input
                              type="text"
                              defaultValue={selectedMilestone.name}
                              key={`name-${selectedMilestone.id}`}
                              onBlur={(e) => {
                                if (e.target.value !== selectedMilestone.name && e.target.value.trim()) {
                                  updateMilestoneMutation.mutate({ id: selectedMilestone.id, patch: { name: e.target.value.trim() } })
                                }
                              }}
                              className="w-full rounded-lg border-none bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                              截止日期
                            </label>
                            <DatePicker
                              value={selectedMilestone.due_date ? selectedMilestone.due_date.split('T')[0] : ''}
                              onChange={(value) => {
                                updateMilestoneMutation.mutate({ id: selectedMilestone.id, patch: { due_date: value || null } })
                              }}
                              placeholder="选择日期"
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('确定要删除这个里程碑吗？')) {
                                deleteMilestoneMutation.mutate(selectedMilestone.id)
                                setSelectedMilestoneId(null)
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-danger)] bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            删除里程碑
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()
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

// 任务输入组件 (用于项目视图)
function MilestoneTaskInput({ onAdd, placeholder = "添加任务..." }: { onAdd: (title: string) => void; placeholder?: string }) {
  const [title, setTitle] = useState('')

  const handleAdd = () => {
    if (title.trim()) {
      onAdd(title.trim())
      setTitle('')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-accent)] text-lg">+</span>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
      />
    </div>
  )
}
