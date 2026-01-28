import type { PomodoroSession, PomodoroSessionInsert, PomodoroSessionType } from '../api/pomodoro'
import { getDatabase, generateId, nowISO } from './local'

// 本地 PomodoroSession 类型，包含同步字段
export type LocalPomodoroSession = PomodoroSession & {
    sync_status: 'synced' | 'pending' | 'conflict'
    local_created_at: string
}

/**
 * 获取 Pomodoro Sessions
 */
export async function fetchLocalPomodoroSessions(
    userId: string,
    fromDate: string,
    toDate: string
): Promise<LocalPomodoroSession[]> {
    const db = await getDatabase()

    const result = await db.select<LocalPomodoroSession[]>(
        `SELECT * FROM pomodoro_sessions 
     WHERE user_id = $1 AND started_at >= $2 AND started_at <= $3
     ORDER BY started_at DESC`,
        [userId, fromDate, toDate]
    )

    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
    }))
}

/**
 * 创建 Pomodoro Session
 */
export async function createLocalPomodoroSession(
    insert: PomodoroSessionInsert
): Promise<LocalPomodoroSession> {
    const db = await getDatabase()
    const now = nowISO()
    const id = generateId()

    const session: LocalPomodoroSession = {
        id,
        user_id: insert.user_id,
        started_at: insert.started_at,
        duration_minutes: insert.duration_minutes,
        type: insert.type as PomodoroSessionType,
        completed: insert.completed,
        todo_id: insert.todo_id ?? null,
        created_at: now,
        sync_status: 'pending',
        local_created_at: now,
    }

    await db.execute(
        `INSERT INTO pomodoro_sessions (
      id, user_id, started_at, duration_minutes, type, completed, todo_id,
      created_at, sync_status, local_created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            session.id,
            session.user_id,
            session.started_at,
            session.duration_minutes,
            session.type,
            session.completed ? 1 : 0,
            session.todo_id,
            session.created_at,
            session.sync_status,
            session.local_created_at,
        ]
    )

    return session
}

/**
 * 更新 Pomodoro Session 完成状态
 */
export async function updateLocalPomodoroSessionCompleted(
    id: string,
    completed: boolean
): Promise<void> {
    const db = await getDatabase()

    await db.execute(
        `UPDATE pomodoro_sessions SET completed = $1, sync_status = 'pending' WHERE id = $2`,
        [completed ? 1 : 0, id]
    )
}

/**
 * 批量插入/更新 PomodoroSessions（用于从远端同步）
 */
export async function upsertLocalPomodoroSessions(
    sessions: LocalPomodoroSession[]
): Promise<void> {
    const db = await getDatabase()

    for (const session of sessions) {
        await db.execute(
            `INSERT OR REPLACE INTO pomodoro_sessions (
        id, user_id, started_at, duration_minutes, type, completed, todo_id,
        created_at, sync_status, local_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                session.id,
                session.user_id,
                session.started_at,
                session.duration_minutes,
                session.type,
                session.completed ? 1 : 0,
                session.todo_id,
                session.created_at,
                session.sync_status,
                session.local_created_at,
            ]
        )
    }
}

/**
 * 获取所有待同步的 PomodoroSessions
 */
export async function getPendingPomodoroSessions(): Promise<LocalPomodoroSession[]> {
    const db = await getDatabase()
    const result = await db.select<LocalPomodoroSession[]>(
        `SELECT * FROM pomodoro_sessions WHERE sync_status = 'pending'`
    )

    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
    }))
}

/**
 * 标记 PomodoroSession 为已同步
 */
export async function markPomodoroSessionSynced(id: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(
        `UPDATE pomodoro_sessions SET sync_status = 'synced' WHERE id = $1`,
        [id]
    )
}
