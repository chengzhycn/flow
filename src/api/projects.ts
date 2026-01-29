import { isTauriEnv } from '../db/local'
import {
    fetchLocalProjects,
    createLocalProject,
    updateLocalProject,
    deleteLocalProject,
    restoreLocalProject,
    permanentlyDeleteLocalProject,
    fetchLocalMilestones,
    createLocalMilestone,
    updateLocalMilestone,
    deleteLocalMilestone,
    getProjectTaskStats,
    getProjectTodos,
    type LocalProject,
    type LocalMilestone,
    type ProjectInsert,
    type ProjectUpdate,
    type MilestoneInsert,
    type MilestoneUpdate,
} from '../db/localProjects'
import { triggerSync } from '../sync/SyncEngine'
import { supabase } from './supabase'

// 导出类型
export type {
    ProjectInsert,
    ProjectUpdate,
    MilestoneInsert,
    MilestoneUpdate,
}

export type Project = {
    id: string
    user_id: string
    name: string
    description: string | null
    color: string
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export type Milestone = {
    id: string
    project_id: string
    name: string
    due_date: string | null
    completed: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

// 当前用户 ID 缓存（用于触发同步）
let currentUserId: string | null = null

export function setCurrentUserId(userId: string): void {
    currentUserId = userId
}

// ==================== Project API ====================

/**
 * 获取用户所有项目 - 本地优先
 */
export async function fetchProjects(userId: string, includeDeleted: boolean = false): Promise<Project[]> {
    currentUserId = userId

    if (isTauriEnv()) {
        try {
            const localProjects = await fetchLocalProjects(userId, includeDeleted)
            return localProjects.map(localToProject)
        } catch (error) {
            console.error('[projects] Failed to fetch local projects:', error)
            return []
        }
    }

    // 回退到 Supabase（Web 版本）
    try {
        let query = supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)

        if (!includeDeleted) {
            query = query.is('deleted_at', null)
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        return data ?? []
    } catch (error) {
        console.error('[projects] Supabase fetch failed:', error)
        return []
    }
}

/**
 * 创建项目 - 本地优先
 */
export async function createProject(userId: string, project: ProjectInsert): Promise<Project> {
    currentUserId = userId

    if (isTauriEnv()) {
        const localProject = await createLocalProject(userId, project)
        triggerSyncIfPossible()
        return localToProject(localProject)
    }

    // 回退到 Supabase
    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: userId,
            name: project.name,
            description: project.description ?? null,
            color: project.color ?? '#6366f1',
        })
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 更新项目 - 本地优先
 */
export async function updateProject(id: string, patch: ProjectUpdate): Promise<Project> {
    if (isTauriEnv()) {
        const localProject = await updateLocalProject(id, patch)
        if (!localProject) throw new Error(`Project ${id} not found`)
        triggerSyncIfPossible()
        return localToProject(localProject)
    }

    // 回退到 Supabase
    const { data, error } = await supabase
        .from('projects')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 删除项目（软删除）- 本地优先
 */
export async function deleteProject(id: string): Promise<void> {
    if (isTauriEnv()) {
        await deleteLocalProject(id)
        triggerSyncIfPossible()
        return
    }

    // 回退到 Supabase
    const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw error
}

/**
 * 恢复已删除的项目 - 本地优先
 */
export async function restoreProject(id: string): Promise<Project> {
    if (isTauriEnv()) {
        const localProject = await restoreLocalProject(id)
        if (!localProject) throw new Error(`Project ${id} not found`)
        triggerSyncIfPossible()
        return localToProject(localProject)
    }

    // 回退到 Supabase
    const { data, error } = await supabase
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 永久删除项目 - 本地优先
 */
export async function permanentlyDeleteProject(id: string): Promise<void> {
    if (isTauriEnv()) {
        await permanentlyDeleteLocalProject(id)
        triggerSyncIfPossible()
        return
    }

    // 回退到 Supabase
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
}

// ==================== Milestone API ====================

/**
 * 获取项目里程碑 - 本地优先
 */
export async function fetchMilestones(projectId: string): Promise<Milestone[]> {
    if (isTauriEnv()) {
        try {
            const localMilestones = await fetchLocalMilestones(projectId)
            return localMilestones.map(localToMilestone)
        } catch (error) {
            console.error('[milestones] Failed to fetch local milestones:', error)
            return []
        }
    }

    // 回退到 Supabase
    try {
        const { data, error } = await supabase
            .from('milestones')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
        if (error) throw error
        return data ?? []
    } catch (error) {
        console.error('[milestones] Supabase fetch failed:', error)
        return []
    }
}

/**
 * 创建里程碑 - 本地优先
 */
export async function createMilestone(projectId: string, milestone: MilestoneInsert): Promise<Milestone> {
    if (isTauriEnv()) {
        const localMilestone = await createLocalMilestone(projectId, milestone)
        triggerSyncIfPossible()
        return localToMilestone(localMilestone)
    }

    // 回退到 Supabase
    const { data, error } = await supabase
        .from('milestones')
        .insert({
            project_id: projectId,
            name: milestone.name,
            due_date: milestone.due_date ?? null,
            sort_order: milestone.sort_order ?? 0,
        })
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 更新里程碑 - 本地优先
 */
export async function updateMilestone(id: string, patch: MilestoneUpdate): Promise<Milestone> {
    if (isTauriEnv()) {
        const localMilestone = await updateLocalMilestone(id, patch)
        if (!localMilestone) throw new Error(`Milestone ${id} not found`)
        triggerSyncIfPossible()
        return localToMilestone(localMilestone)
    }

    // 回退到 Supabase
    const { data, error } = await supabase
        .from('milestones')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 删除里程碑 - 本地优先
 */
export async function deleteMilestone(id: string): Promise<void> {
    if (isTauriEnv()) {
        await deleteLocalMilestone(id)
        triggerSyncIfPossible()
        return
    }

    // 回退到 Supabase
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) throw error
}

// ==================== 辅助查询 API ====================

/**
 * 获取项目任务统计
 */
export async function fetchProjectTaskStats(projectId: string): Promise<{ total: number; completed: number }> {
    if (isTauriEnv()) {
        return getProjectTaskStats(projectId)
    }

    // 回退到 Supabase
    try {
        const { data: todos, error } = await supabase
            .from('todos')
            .select('completed')
            .eq('project_id', projectId)
            .is('deleted_at', null)

        if (error) throw error

        const total = todos?.length ?? 0
        const completed = todos?.filter(t => t.completed).length ?? 0
        return { total, completed }
    } catch (error) {
        console.error('[projects] Failed to fetch task stats:', error)
        return { total: 0, completed: 0 }
    }
}

/**
 * 获取项目任务列表
 */
export async function fetchProjectTodos(projectId: string): Promise<{
    id: string
    title: string
    completed: boolean
    milestone_id: string | null
}[]> {
    if (isTauriEnv()) {
        return getProjectTodos(projectId)
    }

    // 回退到 Supabase
    try {
        const { data, error } = await supabase
            .from('todos')
            .select('id, title, completed, milestone_id')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })

        if (error) throw error
        return data ?? []
    } catch (error) {
        console.error('[projects] Failed to fetch project todos:', error)
        return []
    }
}

// ==================== 辅助函数 ====================

function localToProject(local: LocalProject): Project {
    return {
        id: local.id,
        user_id: local.user_id,
        name: local.name,
        description: local.description,
        color: local.color,
        created_at: local.created_at,
        updated_at: local.updated_at,
        deleted_at: local.deleted_at,
    }
}

function localToMilestone(local: LocalMilestone): Milestone {
    return {
        id: local.id,
        project_id: local.project_id,
        name: local.name,
        due_date: local.due_date,
        completed: local.completed,
        sort_order: local.sort_order,
        created_at: local.created_at,
        updated_at: local.updated_at,
    }
}

function triggerSyncIfPossible(): void {
    if (currentUserId) {
        triggerSync(currentUserId).catch(err => {
            console.error('[projects] Failed to trigger sync:', err)
        })
    }
}
