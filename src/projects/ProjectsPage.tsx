import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import {
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    fetchProjectTaskStats,
    fetchProjectTodos,
    type Project,
    type Milestone,
} from '@/api/projects'
import { createTodo } from '@/api/todos'
import { DatePicker } from '@/todos/DatePicker'

// 预设颜色选项
const PROJECT_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
]

export function ProjectsPage() {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [quickAddName, setQuickAddName] = useState('')
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [newMilestoneName, setNewMilestoneName] = useState('')
    const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('')

    const [isLargeScreen, setIsLargeScreen] = useState(false)
    const [showDetailPanel, setShowDetailPanel] = useState(false)
    const [rightSidebarWidth, setRightSidebarWidth] = useState(420)
    const [isResizingRight, setIsResizingRight] = useState(false)

    const queryClient = useQueryClient()
    const { user, loading: userLoading } = useUser()
    const userId = user?.id ?? ''

    // 检测屏幕宽度
    useEffect(() => {
        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= 1024)
            if (window.innerWidth >= 1024) {
                // Default logic
            }
        }
        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // 拖拽调整右侧栏宽度
    useEffect(() => {
        if (!isResizingRight) return

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = window.innerWidth - e.clientX
            if (newWidth >= 300 && newWidth <= 600) {
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

    // 获取项目列表
    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects', userId],
        queryFn: () => fetchProjects(userId),
        enabled: !!userId,
    })

    // 获取选中项目
    const selectedProject = selectedProjectId
        ? projects.find((p) => p.id === selectedProjectId)
        : null

    // 获取选中项目的里程碑
    const { data: milestones = [] } = useQuery({
        queryKey: ['milestones', selectedProjectId],
        queryFn: () => fetchMilestones(selectedProjectId!),
        enabled: !!selectedProjectId,
    })

    // 获取选中项目的任务统计
    const { data: taskStats = { total: 0, completed: 0 } } = useQuery({
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

    // 创建项目
    const createProjectMutation = useMutation({
        mutationFn: (data: { name: string; description: string | null; color: string }) =>
            createProject(userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', userId] })
            setQuickAddName('')
        },
    })

    // 更新项目
    const updateProjectMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProject>[1] }) =>
            updateProject(id, patch),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', userId] })
            setEditingProject(null)
        },
    })

    // 删除项目
    const deleteProjectMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', userId] })
            if (selectedProjectId) {
                setSelectedProjectId(null)
            }
        },
    })

    // 创建里程碑
    const createMilestoneMutation = useMutation({
        mutationFn: (data: { projectId: string; name: string; due_date: string | null }) =>
            createMilestone(data.projectId, { name: data.name, due_date: data.due_date }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] })
            setNewMilestoneName('')
            setNewMilestoneDueDate('')
        },
    })

    // 更新里程碑
    const updateMilestoneMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateMilestone>[1] }) =>
            updateMilestone(id, patch),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] })
        },
    })

    // 删除里程碑
    const deleteMilestoneMutation = useMutation({
        mutationFn: deleteMilestone,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] })
        },
    })

    // 创建任务（关联到项目）
    const createTaskMutation = useMutation({
        mutationFn: (data: { title: string; project_id: string; milestone_id: string | null; start_date?: string; due_date?: string }) =>
            createTodo(userId, {
                title: data.title,
                inbox: false,
                project_id: data.project_id,
                milestone_id: data.milestone_id,
                start_date: data.start_date || null,
                due_date: data.due_date || null,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projectTodos', selectedProjectId] })
            queryClient.invalidateQueries({ queryKey: ['projectTaskStats', selectedProjectId] })
            queryClient.invalidateQueries({ queryKey: ['todos', userId] })

        },
    })

    function handleCreateProject() {
        if (!quickAddName.trim()) return
        const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
        createProjectMutation.mutate({
            name: quickAddName.trim(),
            description: null,
            color,
        })
    }

    function handleUpdateProject() {
        if (!editingProject || !editingProject.name.trim()) return
        updateProjectMutation.mutate({
            id: editingProject.id,
            patch: {
                name: editingProject.name.trim(),
                description: editingProject.description,
                color: editingProject.color,
            },
        })
    }

    function handleCreateMilestone() {
        if (!selectedProjectId || !newMilestoneName.trim()) return
        createMilestoneMutation.mutate({
            projectId: selectedProjectId,
            name: newMilestoneName.trim(),
            due_date: newMilestoneDueDate || null,
        })
    }

    function handleCreateTask(title: string, milestoneId: string | null) {
        if (!selectedProjectId || !title.trim()) return
        const today = new Date().toISOString()
        createTaskMutation.mutate({
            title: title.trim(),
            project_id: selectedProjectId,
            milestone_id: milestoneId,
            start_date: today,
            due_date: today,
        })
    }



    function getProgressPercentage(completed: number, total: number): number {
        if (total === 0) return 0
        return Math.round((completed / total) * 100)
    }

    if (userLoading) {
        return <div className="p-8 text-center text-[var(--color-text-muted)]">加载中...</div>
    }
    if (!userId) {
        return <div className="p-8 text-center text-[var(--color-text-muted)]">请先登录</div>
    }
    if (isLoading) {
        return <div className="p-8 text-center text-[var(--color-text-muted)]">加载项目中...</div>
    }

    return (
        <div className="flex h-full gap-0 relative">
            {/* 左侧：项目列表 */}
            <div className="flex-1 flex flex-col min-w-0 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">项目管理</h1>
                </div>

                {/* 项目列表 */}
                <div className="flex-1 overflow-y-auto space-y-2">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => {
                                setSelectedProjectId(project.id)
                                if (!isLargeScreen) {
                                    setShowDetailPanel(true)
                                }
                            }}
                            className={`group flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${selectedProjectId === project.id
                                ? 'bg-[var(--color-bg-elevated)] border-[var(--color-accent)] shadow-sm'
                                : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                                }`}
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
                                style={{ backgroundColor: project.color }}
                            >
                                {project.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-[var(--color-text)] truncate">{project.name}</h3>
                                </div>
                                {project.description && (
                                    <p className="text-sm text-[var(--color-text-muted)] truncate">
                                        {project.description}
                                    </p>
                                )}
                            </div>
                            <svg className={`w-5 h-5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ${selectedProjectId === project.id ? 'opacity-100 text-[var(--color-accent)]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    ))}

                    {/* 快速添加输入框 */}
                    <div className="p-4 rounded-xl border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors focus-within:border-[var(--color-accent)] focus-within:bg-[var(--color-bg-elevated)]/50">
                        <input
                            type="text"
                            value={quickAddName}
                            onChange={(e) => setQuickAddName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateProject()
                            }}
                            placeholder="+ 添加新项目 (回车创建)"
                            className="w-full bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* 右侧：项目详情 */}
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
                            : 'fixed right-0 top-0 h-full max-w-[90vw] bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl z-50'
                            } overflow-y-auto`}
                        style={{ width: `${rightSidebarWidth}px` }}
                    >
                        <div className="h-full overflow-y-auto p-4">
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

                            {selectedProject ? (
                                <div className="space-y-6">
                                    {/* 项目头部 */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                                style={{ backgroundColor: selectedProject.color }}
                                            >
                                                {selectedProject.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-[var(--color-text)]">
                                                    {selectedProject.name}
                                                </h2>
                                                {selectedProject.description && (
                                                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                                        {selectedProject.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {!isLargeScreen && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDetailPanel(false)}
                                                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setEditingProject(selectedProject)}
                                                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                                                title="编辑"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm('确定要删除这个项目吗？')) {
                                                        deleteProjectMutation.mutate(selectedProject.id)
                                                    }
                                                }}
                                                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                                                title="删除"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 进度统计 */}
                                    <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-[var(--color-text)]">任务进度</span>
                                            <span className="text-sm text-[var(--color-text-muted)]">
                                                {taskStats.completed}/{taskStats.total}
                                            </span>
                                        </div>
                                        <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${getProgressPercentage(taskStats.completed, taskStats.total)}%`,
                                                    backgroundColor: selectedProject.color,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* 任务分组显示 */}
                                    <div className="space-y-8">
                                        {/* 里程碑分组 */}
                                        {milestones.map((milestone) => (
                                            <MilestoneGroup
                                                key={milestone.id}
                                                milestone={milestone}
                                                todos={projectTodos.filter(t => t.milestone_id === milestone.id)}
                                                onToggleMilestone={() => updateMilestoneMutation.mutate({
                                                    id: milestone.id,
                                                    patch: { completed: !milestone.completed }
                                                })}
                                                onDeleteMilestone={() => {
                                                    if (confirm('确定要删除这个里程碑吗？')) {
                                                        deleteMilestoneMutation.mutate(milestone.id)
                                                    }
                                                }}
                                                onAddTask={(title) => handleCreateTask(title, milestone.id)}
                                            />
                                        ))}

                                        {/* 未归类任务 */}
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2 px-3">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                                未归类任务
                                            </h3>
                                            <div className="space-y-1">
                                                {projectTodos.filter(t => !t.milestone_id).map((todo) => (
                                                    <div
                                                        key={todo.id}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-text)]/5"
                                                    >
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${todo.completed
                                                                ? 'bg-emerald-500 border-emerald-500'
                                                                : 'border-[var(--color-border)]'
                                                                }`}
                                                        >
                                                            {todo.completed && (
                                                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className={`text-sm flex-1 ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                                                            {todo.title}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="px-3">
                                                <TaskInput onAdd={(title) => handleCreateTask(title, null)} placeholder="添加任务..." />
                                            </div>
                                        </div>

                                        {/* 添加里程碑 */}
                                        <div className="pt-6 border-t border-[var(--color-border)]">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[var(--color-accent)] text-lg">+</span>
                                                <input
                                                    type="text"
                                                    value={newMilestoneName}
                                                    onChange={(e) => setNewMilestoneName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && newMilestoneName.trim()) {
                                                            handleCreateMilestone()
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
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-20 h-20 mb-4 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                                        <svg className="w-10 h-10 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                        </svg>
                                    </div>
                                    <p className="text-[var(--color-text-muted)]">选择一个项目查看详情</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}



            {/* 编辑项目 Modal */}
            {editingProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--color-bg)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                        <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">编辑项目</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                    项目名称 *
                                </label>
                                <input
                                    type="text"
                                    value={editingProject.name}
                                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                                    autoFocus
                                    className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                    项目描述
                                </label>
                                <textarea
                                    value={editingProject.description || ''}
                                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value || null })}
                                    placeholder="输入项目描述（可选）"
                                    rows={3}
                                    className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                                    项目颜色
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {PROJECT_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setEditingProject({ ...editingProject, color })}
                                            className={`w-8 h-8 rounded-lg transition-all ${editingProject.color === color ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] ring-offset-[var(--color-bg)]' : ''
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setEditingProject(null)}
                                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateProject}
                                disabled={!editingProject.name.trim()}
                                className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}





// 里程碑分组组件
function MilestoneGroup({
    milestone,
    todos,
    onToggleMilestone,
    onDeleteMilestone,
    onAddTask
}: {
    milestone: Milestone
    todos: { id: string; title: string; completed: boolean }[]
    onToggleMilestone: () => void
    onDeleteMilestone: () => void
    onAddTask: (title: string) => void
}) {
    // 计算统计数据
    const total = todos.length
    const completed = todos.filter(t => t.completed).length

    return (
        <div className="bg-[var(--color-bg-elevated)]/30 rounded-xl p-3 border border-[var(--color-border)]">
            <div className="mb-3">
                <MilestoneItem
                    milestone={milestone}
                    total={total}
                    completed={completed}
                    onToggle={onToggleMilestone}
                    onDelete={onDeleteMilestone}
                />
            </div>

            {/* 任务列表 */}
            <div className="pl-9 space-y-1 mb-3">
                {todos.map((todo) => (
                    <div
                        key={todo.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-text)]/5"
                    >
                        <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${todo.completed
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-[var(--color-border)]'
                                }`}
                        >
                            {todo.completed && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <span className={`text-sm flex-1 ${todo.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                            {todo.title}
                        </span>
                    </div>
                ))}
            </div>

            {/* 添加任务 */}
            <div className="pl-9 pr-3">
                <TaskInput onAdd={onAddTask} placeholder="添加任务到此里程碑..." />
            </div>
        </div>
    )
}

// 任务输入组件
function TaskInput({ onAdd, placeholder }: { onAdd: (title: string) => void, placeholder?: string }) {
    const [title, setTitle] = useState('')

    const handleAdd = () => {
        if (title.trim()) {
            onAdd(title)
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
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                }}
                placeholder={placeholder || "添加任务..."}
                className="flex-1 bg-transparent border-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
            />
        </div>
    )
}

// 里程碑项组件
function MilestoneItem({
    milestone,
    total,
    completed,
    onToggle,
    onDelete,
    onDelete: _onDelete, // Alias to avoid unused variable warning if needed, but not needed here.
}: {
    milestone: Milestone
    total: number
    completed: number
    onToggle: () => void
    onDelete: () => void
}) {
    const progress = total > 0 ? (completed / total) * 100 : 0

    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-text)]/5 group">
            <button
                type="button"
                onClick={onToggle}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${milestone.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-[var(--color-border)] hover:border-emerald-500'
                    }`}
            >
                {milestone.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${milestone.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                        {milestone.name}
                    </p>
                    {total > 0 && (
                        <span className="text-xs text-[var(--color-text-muted)]">
                            {completed}/{total}
                        </span>
                    )}
                </div>

                {/* 进度条 */}
                {total > 0 && (
                    <div className="mt-1 h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {milestone.due_date && (
                    <p className={`text-xs mt-1 ${new Date(milestone.due_date) < new Date() && !milestone.completed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
                        }`}>
                        截止: {new Date(milestone.due_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={onDelete}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100 transition-all"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    )
}

