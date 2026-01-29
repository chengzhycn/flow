import type { LocalTodo } from '../db/localTodos'
import type { LocalPomodoroSession } from '../db/localPomodoro'

/**
 * 冲突检测：检查本地和远端是否存在冲突
 * 冲突定义：本地有未同步的修改，且远端也有更新
 */
export function hasConflict<T extends { sync_status: string; remote_updated_at?: string | null }>(
    local: T,
    remoteUpdatedAt: string
): boolean {
    // 如果本地已同步，不会有冲突
    if (local.sync_status !== 'pending') {
        return false
    }

    // 如果没有远端时间戳记录，说明是新创建的，不会有冲突
    if (!local.remote_updated_at) {
        return false
    }

    // 如果远端更新时间比我们记录的远端时间更新，说明远端有新修改
    return new Date(remoteUpdatedAt) > new Date(local.remote_updated_at)
}

/**
 * 冲突解决策略：Last Write Wins
 * 比较本地和远端的更新时间，返回应该使用的数据
 */
export function resolveConflict<T extends { local_updated_at: string }>(
    local: T,
    remote: T & { updated_at: string }
): { winner: 'local' | 'remote'; data: T } {
    const localTime = new Date(local.local_updated_at).getTime()
    const remoteTime = new Date(remote.updated_at).getTime()

    if (localTime >= remoteTime) {
        // 本地胜出 - 继续推送到远端
        return { winner: 'local', data: local }
    } else {
        // 远端胜出 - 覆盖本地
        return { winner: 'remote', data: remote }
    }
}

/**
 * 合并 Todo 数据（从远端同步到本地时使用）
 */
export function mergeTodoFromRemote(
    local: LocalTodo | null,
    remote: {
        id: string
        user_id: string
        title: string
        description: string | null
        completed: boolean
        due_date: string | null
        start_date: string | null
        quadrant: string | null
        inbox: boolean
        sort_order: number
        parent_id: string | null
        project_id: string | null
        milestone_id: string | null
        deleted_at: string | null
        created_at: string
        updated_at: string
    }
): LocalTodo {
    // 如果本地不存在，直接使用远端数据
    if (!local) {
        return {
            ...remote,
            quadrant: remote.quadrant as LocalTodo['quadrant'],
            sync_status: 'synced',
            local_updated_at: remote.updated_at,
            remote_updated_at: remote.updated_at,
        }
    }

    // 如果本地已同步，直接使用远端数据
    if (local.sync_status === 'synced') {
        return {
            ...remote,
            quadrant: remote.quadrant as LocalTodo['quadrant'],
            sync_status: 'synced',
            local_updated_at: remote.updated_at,
            remote_updated_at: remote.updated_at,
        }
    }

    // 检查是否有冲突
    if (hasConflict(local, remote.updated_at)) {
        const resolution = resolveConflict(local, {
            ...remote,
            local_updated_at: local.local_updated_at,
        } as LocalTodo & { updated_at: string })

        if (resolution.winner === 'remote') {
            return {
                ...remote,
                quadrant: remote.quadrant as LocalTodo['quadrant'],
                sync_status: 'synced',
                local_updated_at: remote.updated_at,
                remote_updated_at: remote.updated_at,
            }
        } else {
            // 本地胜出，保留本地数据但更新远端时间戳
            return {
                ...local,
                remote_updated_at: remote.updated_at,
            }
        }
    }

    // 无冲突，使用远端数据
    return {
        ...remote,
        quadrant: remote.quadrant as LocalTodo['quadrant'],
        sync_status: 'synced',
        local_updated_at: remote.updated_at,
        remote_updated_at: remote.updated_at,
    }
}

/**
 * 合并 PomodoroSession 数据
 */
export function mergePomodoroFromRemote(
    local: LocalPomodoroSession | null,
    remote: {
        id: string
        user_id: string
        started_at: string
        duration_minutes: number
        type: string
        completed: boolean
        todo_id: string | null
        created_at: string
    }
): LocalPomodoroSession {
    if (!local) {
        return {
            ...remote,
            type: remote.type as LocalPomodoroSession['type'],
            sync_status: 'synced',
            local_created_at: remote.created_at,
        }
    }

    // Pomodoro sessions 通常不会修改，所以简单地使用已存在的本地数据
    return local
}
