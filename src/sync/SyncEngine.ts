import { supabase } from '../api/supabase'
import { getDatabase } from '../db/local'
import {
    getPendingTodos,
    markTodoSynced,
    upsertLocalTodos,
    getLocalTodoById,
    type LocalTodo,
} from '../db/localTodos'
import {
    getPendingPomodoroSessions,
    markPomodoroSessionSynced,
    upsertLocalPomodoroSessions,
    type LocalPomodoroSession,
} from '../db/localPomodoro'
import {
    getSyncQueue,
    removeSyncQueueItem,
    incrementRetry,
    type SyncQueueItem,
} from './SyncQueue'
import { mergeTodoFromRemote, mergePomodoroFromRemote, mergeProjectFromRemote, mergeMilestoneFromRemote, mergeSummaryFromRemote } from './ConflictResolver'
import {
    getPendingProjects,
    markProjectSynced,
    upsertLocalProjects,
    getLocalProjectById,
    getPendingMilestones,
    markMilestoneSynced,
    upsertLocalMilestones,
    getLocalMilestoneById,
    type LocalProject,
    type LocalMilestone,
} from '../db/localProjects'
import {
    getPendingSummaries,
    markSummarySynced,
    upsertLocalSummaries,
    getLocalSummaryById,
    type LocalWorkSummary,
} from '../db/localSummaries'

// 同步状态
type SyncStatus = 'idle' | 'syncing' | 'error'

let syncStatus: SyncStatus = 'idle'
let syncInterval: ReturnType<typeof setInterval> | null = null
let lastSyncTime: string | null = null

const SYNC_INTERVAL_MS = 30000 // 30 秒

/**
 * 获取当前同步状态
 */
export function getSyncStatus(): { status: SyncStatus; lastSyncTime: string | null } {
    return { status: syncStatus, lastSyncTime }
}

/**
 * 初始化同步引擎 - 在应用启动时调用
 * 注意：即使同步失败也不会抛出错误，以支持离线模式
 */
export async function initSyncEngine(userId: string): Promise<void> {
    console.log('[SyncEngine] Initializing...')

    // 尝试执行首次同步（失败不影响应用使用）
    try {
        await fullSync(userId)
    } catch (error) {
        console.warn('[SyncEngine] Initial sync failed (offline mode):', error)
        syncStatus = 'idle' // 重置状态以允许后续同步
    }

    // 启动定时同步
    startAutoSync(userId)
}

/**
 * 停止同步引擎
 */
export function stopSyncEngine(): void {
    if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
    }
    console.log('[SyncEngine] Stopped')
}

/**
 * 启动自动同步
 */
function startAutoSync(userId: string): void {
    if (syncInterval) {
        clearInterval(syncInterval)
    }

    syncInterval = setInterval(async () => {
        if (syncStatus === 'syncing') {
            console.log('[SyncEngine] Sync already in progress, skipping...')
            return
        }

        try {
            await incrementalSync(userId)
        } catch (error) {
            console.error('[SyncEngine] Auto sync error:', error)
        }
    }, SYNC_INTERVAL_MS)

    console.log(`[SyncEngine] Auto sync started (every ${SYNC_INTERVAL_MS / 1000}s)`)
}

/**
 * 立即触发同步（用于写操作后）
 * 注意：同步失败不会抛出错误，数据会在下次同步时重试
 */
export async function triggerSync(userId: string): Promise<void> {
    if (syncStatus === 'syncing') {
        console.log('[SyncEngine] Sync in progress, will sync on next interval')
        return
    }

    try {
        await incrementalSync(userId)
    } catch (error) {
        console.warn('[SyncEngine] Trigger sync failed (will retry later):', error)
    }
}

/**
 * 完整同步 - 首次启动时使用
 */
async function fullSync(userId: string): Promise<void> {
    console.log('[SyncEngine] Starting full sync...')
    syncStatus = 'syncing'

    try {
        // 1. 尝试从远端拉取所有数据
        await pullFromRemote(userId, true)

        // 2. 推送本地待同步的数据
        await pushToRemote(userId)

        lastSyncTime = new Date().toISOString()
        syncStatus = 'idle'
        console.log('[SyncEngine] Full sync completed')
    } catch (error) {
        // 同步失败时设置为 idle 而不是 error，允许本地操作继续
        syncStatus = 'idle'
        console.error('[SyncEngine] Full sync failed:', error)
        throw error
    }
}

/**
 * 增量同步 - 定时同步时使用
 */
async function incrementalSync(userId: string): Promise<void> {
    console.log('[SyncEngine] Starting incremental sync...')
    syncStatus = 'syncing'

    try {
        // 1. 推送本地变更
        await pushToRemote(userId)

        // 2. 拉取远端更新
        await pullFromRemote(userId, false)

        lastSyncTime = new Date().toISOString()
        syncStatus = 'idle'
        console.log('[SyncEngine] Incremental sync completed')
    } catch (error) {
        syncStatus = 'error'
        console.error('[SyncEngine] Incremental sync failed:', error)
        // 不抛出错误，让定时任务继续运行
    }
}

/**
 * 推送本地变更到远端
 */
async function pushToRemote(_userId: string): Promise<void> {
    // 1. 先推送 Projects
    const pendingProjects = await getPendingProjects()
    console.log(`[SyncEngine] Pushing ${pendingProjects.length} projects...`)

    for (const project of pendingProjects) {
        try {
            await pushProjectToRemote(project)
            await markProjectSynced(project.id, new Date().toISOString())
        } catch (error) {
            console.error(`[SyncEngine] Failed to push project ${project.id}:`, error)
        }
    }

    // 2. 推送 Milestones
    const pendingMilestones = await getPendingMilestones()
    console.log(`[SyncEngine] Pushing ${pendingMilestones.length} milestones...`)

    for (const milestone of pendingMilestones) {
        try {
            await pushMilestoneToRemote(milestone)
            await markMilestoneSynced(milestone.id, new Date().toISOString())
        } catch (error) {
            console.error(`[SyncEngine] Failed to push milestone ${milestone.id}:`, error)
        }
    }

    // 3. 推送 Todos
    const pendingTodos = await getPendingTodos()
    console.log(`[SyncEngine] Pushing ${pendingTodos.length} todos...`)

    for (const todo of pendingTodos) {
        try {
            await pushTodoToRemote(todo)
            await markTodoSynced(todo.id, new Date().toISOString())
        } catch (error) {
            console.error(`[SyncEngine] Failed to push todo ${todo.id}:`, error)
        }
    }

    // 获取待同步的 Pomodoro Sessions
    const pendingSessions = await getPendingPomodoroSessions()
    console.log(`[SyncEngine] Pushing ${pendingSessions.length} pomodoro sessions...`)

    for (const session of pendingSessions) {
        try {
            await pushPomodoroToRemote(session)
            await markPomodoroSessionSynced(session.id)
        } catch (error) {
            console.error(`[SyncEngine] Failed to push pomodoro ${session.id}:`, error)
        }
    }

    // 5. 推送 Work Summaries
    const pendingSummaries = await getPendingSummaries()
    console.log(`[SyncEngine] Pushing ${pendingSummaries.length} work summaries...`)

    for (const summary of pendingSummaries) {
        try {
            await pushSummaryToRemote(summary)
            await markSummarySynced(summary.id, new Date().toISOString())
        } catch (error) {
            console.error(`[SyncEngine] Failed to push summary ${summary.id}:`, error)
        }
    }

    // 处理同步队列（用于删除操作等）
    const queue = await getSyncQueue()
    for (const item of queue) {
        try {
            await processSyncQueueItem(item)
            await removeSyncQueueItem(item.id)
        } catch (error) {
            console.error(`[SyncEngine] Failed to process queue item ${item.id}:`, error)
            await incrementRetry(item.id)
        }
    }
}

/**
 * 推送单个 Todo 到远端
 */
async function pushTodoToRemote(todo: LocalTodo): Promise<void> {
    const remoteData = {
        id: todo.id,
        user_id: todo.user_id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        completed_at: todo.completed_at,
        due_date: todo.due_date,
        start_date: todo.start_date,
        quadrant: todo.quadrant,
        inbox: todo.inbox,
        sort_order: todo.sort_order,
        parent_id: todo.parent_id,
        project_id: todo.project_id,
        milestone_id: todo.milestone_id,
        deleted_at: todo.deleted_at,
        created_at: todo.created_at,
        updated_at: todo.updated_at,
    }

    const { error } = await supabase
        .from('todos')
        .upsert(remoteData, { onConflict: 'id' })

    if (error) throw error
}

/**
 * 推送单个 Pomodoro Session 到远端
 */
async function pushPomodoroToRemote(session: LocalPomodoroSession): Promise<void> {
    const remoteData = {
        id: session.id,
        user_id: session.user_id,
        started_at: session.started_at,
        duration_minutes: session.duration_minutes,
        type: session.type,
        completed: session.completed,
        todo_id: session.todo_id,
        created_at: session.created_at,
    }

    const { error } = await supabase
        .from('pomodoro_sessions')
        .upsert(remoteData, { onConflict: 'id' })

    if (error) throw error
}

/**
 * 推送单个 Project 到远端
 */
async function pushProjectToRemote(project: LocalProject): Promise<void> {
    const remoteData = {
        id: project.id,
        user_id: project.user_id,
        name: project.name,
        description: project.description,
        color: project.color,
        created_at: project.created_at,
        updated_at: project.updated_at,
        deleted_at: project.deleted_at,
    }

    const { error } = await supabase
        .from('projects')
        .upsert(remoteData, { onConflict: 'id' })

    if (error) throw error
}

/**
 * 推送单个 Milestone 到远端
 */
async function pushMilestoneToRemote(milestone: LocalMilestone): Promise<void> {
    const remoteData = {
        id: milestone.id,
        project_id: milestone.project_id,
        name: milestone.name,
        due_date: milestone.due_date,
        completed: milestone.completed,
        sort_order: milestone.sort_order,
        created_at: milestone.created_at,
        updated_at: milestone.updated_at,
    }

    const { error } = await supabase
        .from('milestones')
        .upsert(remoteData, { onConflict: 'id' })

    if (error) throw error
}

/**
 * 推送单个 Work Summary 到远端
 */
async function pushSummaryToRemote(summary: LocalWorkSummary): Promise<void> {
    const remoteData = {
        id: summary.id,
        user_id: summary.user_id,
        type: summary.type,
        period_start: summary.period_start,
        period_end: summary.period_end,
        content: summary.content,
        created_at: summary.created_at,
    }

    // 使用复合唯一键来处理冲突，避免相同时间段的重复记录
    const { error } = await supabase
        .from('work_summaries')
        .upsert(remoteData, { onConflict: 'user_id,type,period_start' })

    if (error) throw error
}

/**
 * 处理同步队列项
 */
async function processSyncQueueItem(item: SyncQueueItem): Promise<void> {
    // 目前主要用于处理特殊操作
    // 大多数操作已通过 pending todos/sessions 处理
    console.log(`[SyncEngine] Processing queue item: ${item.table_name} ${item.operation} ${item.record_id}`)
}

/**
 * 从远端拉取数据
 */
async function pullFromRemote(userId: string, _isFullSync: boolean): Promise<void> {
    const db = await getDatabase()

    // 获取上次同步时间
    let lastPull: string | null = null
    if (lastPull) {
        const result = await db.select<[{ value: string }] | []>(
            `SELECT value FROM sync_meta WHERE key = 'last_pull_time'`
        )
        lastPull = result[0]?.value ?? null
    }

    // 1. 拉取 Projects
    let projectsQuery = supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)

    if (lastPull) {
        projectsQuery = projectsQuery.gt('updated_at', lastPull)
    }

    const { data: remoteProjects, error: projectsError } = await projectsQuery
    if (projectsError) throw projectsError

    console.log(`[SyncEngine] Pulled ${remoteProjects?.length ?? 0} projects from remote`)

    if (remoteProjects && remoteProjects.length > 0) {
        const mergedProjects: LocalProject[] = []
        for (const remote of remoteProjects) {
            const local = await getLocalProjectById(remote.id)
            const merged = mergeProjectFromRemote(local, remote)
            mergedProjects.push(merged)
        }
        await upsertLocalProjects(mergedProjects)
    }

    // 2. 拉取 Milestones (通过 project_id 关联，或者拉取该用户所有相关的里程碑? 
    // 目前 schema 里 milestone 没有 user_id，这是个问题。通常 milestone 属于 project，project 属于 user。
    // 我们需要 join 或者二次查询。简单起见，如果 sync 逻辑是全量或者基于 project 权限...
    // 假设 milestones 表有 RLS 策略让用户能拉取到自己 project 下的 milestone。即 select * from milestones where project_id in (user_projects)
    // Supabase client 应该能处理 RLS。这里我们尝试直接 select。
    // 如果 milestones 表确实没有 user_id，直接 select * 可能会被 RLS 拦住或者拉取太多。
    // 检查 migration 002: milestones 确实没有 user_id。
    // 我们可以先拿到所有 projectIds，然后 where in。或者依赖 supabase 级联查询。
    // 为简单起见和保持 sync 逻辑一致，我们假设 RLS 允许读取。
    // 但是这里 query 怎么写？ .in('project_id', userProjectIds) ?

    // **修正**: 为了效率，我们先获取用户所有 project IDs
    // 但是这里是增量同步... 
    // 让我们尝试使用 inner join 语法或者假设 RLS 自动过滤。
    // supabase-js 支持关联查询： .select('*, projects!inner(*)') .eq('projects.user_id', userId)

    let milestonesQuery = supabase
        .from('milestones')
        .select('*, projects!inner(user_id)')
        .eq('projects.user_id', userId)

    if (lastPull) {
        milestonesQuery = milestonesQuery.gt('updated_at', lastPull)
    }

    const { data: remoteMilestones, error: milestonesError } = await milestonesQuery
    if (milestonesError) throw milestonesError

    // 清理一下 data (去除 projects 字段)
    const cleanMilestones = remoteMilestones?.map(m => {
        const { projects, ...rest } = m
        return rest
    })

    console.log(`[SyncEngine] Pulled ${cleanMilestones?.length ?? 0} milestones from remote`)

    if (cleanMilestones && cleanMilestones.length > 0) {
        const mergedMilestones: LocalMilestone[] = []
        for (const remote of cleanMilestones) {
            const local = await getLocalMilestoneById(remote.id)
            // @ts-ignore
            const merged = mergeMilestoneFromRemote(local, remote)
            mergedMilestones.push(merged)
        }
        await upsertLocalMilestones(mergedMilestones)
    }

    // 3. 拉取 Todos
    let todosQuery = supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)

    if (lastPull) {
        todosQuery = todosQuery.gt('updated_at', lastPull)
    }

    const { data: remoteTodos, error: todosError } = await todosQuery
    if (todosError) throw todosError

    console.log(`[SyncEngine] Pulled ${remoteTodos?.length ?? 0} todos from remote`)

    // 合并 Todos
    if (remoteTodos && remoteTodos.length > 0) {
        const mergedTodos: LocalTodo[] = []

        for (const remote of remoteTodos) {
            const local = await getLocalTodoById(remote.id)
            const merged = mergeTodoFromRemote(local, remote)
            mergedTodos.push(merged)
        }

        await upsertLocalTodos(mergedTodos)
    }

    // 拉取 Pomodoro Sessions
    let sessionsQuery = supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', userId)

    if (lastPull) {
        sessionsQuery = sessionsQuery.gt('created_at', lastPull)
    }

    const { data: remoteSessions, error: sessionsError } = await sessionsQuery
    if (sessionsError) throw sessionsError

    console.log(`[SyncEngine] Pulled ${remoteSessions?.length ?? 0} pomodoro sessions from remote`)

    // 合并 Pomodoro Sessions
    if (remoteSessions && remoteSessions.length > 0) {
        const mergedSessions: LocalPomodoroSession[] = remoteSessions.map(remote =>
            mergePomodoroFromRemote(null, remote)
        )
        await upsertLocalPomodoroSessions(mergedSessions)
    }

    // 5. 拉取 Work Summaries
    let summariesQuery = supabase
        .from('work_summaries')
        .select('*')
        .eq('user_id', userId)

    if (lastPull) {
        summariesQuery = summariesQuery.gt('created_at', lastPull)
    }

    const { data: remoteSummaries, error: summariesError } = await summariesQuery
    if (summariesError) throw summariesError

    console.log(`[SyncEngine] Pulled ${remoteSummaries?.length ?? 0} work summaries from remote`)

    // 合并 Work Summaries
    if (remoteSummaries && remoteSummaries.length > 0) {
        const mergedSummaries: LocalWorkSummary[] = []
        for (const remote of remoteSummaries) {
            const local = await getLocalSummaryById(remote.id)
            const merged = mergeSummaryFromRemote(local, remote)
            mergedSummaries.push(merged)
        }
        await upsertLocalSummaries(mergedSummaries)
    }

    // 更新最后拉取时间
    const now = new Date().toISOString()
    await db.execute(
        `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_pull_time', $1)`,
        [now]
    )
}

/**
 * 强制从远端完全重新同步（清除本地数据）
 */
export async function forcePullSync(userId: string): Promise<void> {
    console.log('[SyncEngine] Force pulling from remote...')
    syncStatus = 'syncing'

    try {
        const db = await getDatabase()

        // 清除本地同步元数据
        await db.execute(`DELETE FROM sync_meta WHERE key = 'last_pull_time'`)

        // 执行完整同步
        await pullFromRemote(userId, true)

        lastSyncTime = new Date().toISOString()
        syncStatus = 'idle'
        console.log('[SyncEngine] Force pull completed')
    } catch (error) {
        syncStatus = 'error'
        throw error
    }
}

/**
 * 强制推送所有本地数据到远端
 */
export async function forcePushSync(userId: string): Promise<void> {
    console.log('[SyncEngine] Force pushing to remote...')
    syncStatus = 'syncing'

    try {
        // 将所有本地数据标记为待同步
        const db = await getDatabase()
        await db.execute(`UPDATE projects SET sync_status = 'pending' WHERE user_id = $1`, [userId])
        await db.execute(`UPDATE milestones SET sync_status = 'pending' WHERE id IN (SELECT id FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1))`, [userId])
        await db.execute(`UPDATE todos SET sync_status = 'pending' WHERE user_id = $1`, [userId])
        await db.execute(`UPDATE pomodoro_sessions SET sync_status = 'pending' WHERE user_id = $1`, [userId])
        await db.execute(`UPDATE work_summaries SET sync_status = 'pending' WHERE user_id = $1`, [userId])

        // 推送到远端
        await pushToRemote(userId)

        lastSyncTime = new Date().toISOString()
        syncStatus = 'idle'
        console.log('[SyncEngine] Force push completed')
    } catch (error) {
        syncStatus = 'error'
        throw error
    }
}
