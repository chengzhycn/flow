import type { TodoInsert, TodoUpdate, Quadrant } from '../api/todos'
import { getDatabase, generateId, nowISO } from './local'

// 本地 Todo 类型，包含同步字段
export type LocalTodo = {
    id: string
    user_id: string
    title: string
    description: string | null
    completed: boolean
    due_date: string | null
    start_date: string | null
    quadrant: Quadrant
    inbox: boolean
    sort_order: number
    parent_id: string | null
    project_id: string | null
    milestone_id: string | null
    deleted_at: string | null
    created_at: string
    updated_at: string
    sync_status: 'synced' | 'pending' | 'conflict'
    local_updated_at: string
    remote_updated_at: string | null
}

/**
 * 从本地数据库获取所有 Todos
 */
export async function fetchLocalTodos(
    userId: string,
    includeDeleted: boolean = false
): Promise<LocalTodo[]> {
    const db = await getDatabase()

    let sql = `
    SELECT * FROM todos 
    WHERE user_id = $1
  `
    if (!includeDeleted) {
        sql += ` AND deleted_at IS NULL`
    }
    sql += ` ORDER BY sort_order ASC, created_at ASC`

    const result = await db.select<LocalTodo[]>(sql, [userId])

    // SQLite 存储 boolean 为 0/1，需要转换
    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
        inbox: Boolean(row.inbox),
    }))
}

/**
 * 创建本地 Todo
 */
export async function createLocalTodo(
    userId: string,
    todo: TodoInsert
): Promise<LocalTodo> {
    const db = await getDatabase()
    const now = nowISO()
    const id = generateId()

    const newTodo: LocalTodo = {
        id,
        user_id: userId,
        title: todo.title,
        description: todo.description ?? null,
        completed: todo.completed ?? false,
        due_date: todo.due_date ?? null,
        start_date: todo.start_date ?? null,
        quadrant: (todo.quadrant ?? null) as Quadrant,
        inbox: todo.inbox ?? true,
        sort_order: todo.sort_order ?? 0,
        parent_id: todo.parent_id ?? null,
        project_id: todo.project_id ?? null,
        milestone_id: todo.milestone_id ?? null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        local_updated_at: now,
        remote_updated_at: null,
    }

    await db.execute(
        `INSERT INTO todos (
      id, user_id, title, description, completed, due_date, start_date,
      quadrant, inbox, sort_order, parent_id, project_id, milestone_id, deleted_at, created_at, updated_at,
      sync_status, local_updated_at, remote_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
            newTodo.id,
            newTodo.user_id,
            newTodo.title,
            newTodo.description,
            newTodo.completed ? 1 : 0,
            newTodo.due_date,
            newTodo.start_date,
            newTodo.quadrant,
            newTodo.inbox ? 1 : 0,
            newTodo.sort_order,
            newTodo.parent_id,
            newTodo.project_id,
            newTodo.milestone_id,
            newTodo.deleted_at,
            newTodo.created_at,
            newTodo.updated_at,
            newTodo.sync_status,
            newTodo.local_updated_at,
            newTodo.remote_updated_at,
        ]
    )

    return newTodo
}

/**
 * 更新本地 Todo
 */
export async function updateLocalTodo(
    id: string,
    patch: TodoUpdate
): Promise<LocalTodo | null> {
    const db = await getDatabase()
    const now = nowISO()

    // 构建动态更新 SQL
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (patch.title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(patch.title)
    }
    if (patch.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(patch.description)
    }
    if (patch.completed !== undefined) {
        updates.push(`completed = $${paramIndex++}`)
        values.push(patch.completed ? 1 : 0)
    }
    if (patch.due_date !== undefined) {
        updates.push(`due_date = $${paramIndex++}`)
        values.push(patch.due_date)
    }
    if (patch.start_date !== undefined) {
        updates.push(`start_date = $${paramIndex++}`)
        values.push(patch.start_date)
    }
    if (patch.quadrant !== undefined) {
        updates.push(`quadrant = $${paramIndex++}`)
        values.push(patch.quadrant)
    }
    if (patch.inbox !== undefined) {
        updates.push(`inbox = $${paramIndex++}`)
        values.push(patch.inbox ? 1 : 0)
    }
    if (patch.sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`)
        values.push(patch.sort_order)
    }
    if (patch.parent_id !== undefined) {
        updates.push(`parent_id = $${paramIndex++}`)
        values.push(patch.parent_id)
    }
    if (patch.project_id !== undefined) {
        updates.push(`project_id = $${paramIndex++}`)
        values.push(patch.project_id)
    }
    if (patch.milestone_id !== undefined) {
        updates.push(`milestone_id = $${paramIndex++}`)
        values.push(patch.milestone_id)
    }

    // 总是更新这些字段
    updates.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    updates.push(`local_updated_at = $${paramIndex++}`)
    values.push(now)
    updates.push(`sync_status = $${paramIndex++}`)
    values.push('pending')

    values.push(id)

    await db.execute(
        `UPDATE todos SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
    )

    // 返回更新后的记录
    const result = await db.select<LocalTodo[]>(
        `SELECT * FROM todos WHERE id = $1`,
        [id]
    )

    if (result.length === 0) return null

    return {
        ...result[0],
        completed: Boolean(result[0].completed),
        inbox: Boolean(result[0].inbox),
    }
}

/**
 * 软删除本地 Todo
 */
export async function deleteLocalTodo(id: string): Promise<void> {
    const db = await getDatabase()
    const now = nowISO()

    await db.execute(
        `UPDATE todos SET deleted_at = $1, updated_at = $1, local_updated_at = $1, sync_status = 'pending' WHERE id = $2`,
        [now, id]
    )
}

/**
 * 恢复已删除的 Todo
 */
export async function restoreLocalTodo(id: string): Promise<LocalTodo | null> {
    const db = await getDatabase()
    const now = nowISO()

    await db.execute(
        `UPDATE todos SET deleted_at = NULL, updated_at = $1, local_updated_at = $1, sync_status = 'pending' WHERE id = $2`,
        [now, id]
    )

    const result = await db.select<LocalTodo[]>(
        `SELECT * FROM todos WHERE id = $1`,
        [id]
    )

    if (result.length === 0) return null

    return {
        ...result[0],
        completed: Boolean(result[0].completed),
        inbox: Boolean(result[0].inbox),
    }
}

/**
 * 永久删除本地 Todo
 */
export async function permanentlyDeleteLocalTodo(id: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(`DELETE FROM todos WHERE id = $1`, [id])
}

/**
 * 根据 ID 获取单个 Todo
 */
export async function getLocalTodoById(id: string): Promise<LocalTodo | null> {
    const db = await getDatabase()
    const result = await db.select<LocalTodo[]>(
        `SELECT * FROM todos WHERE id = $1`,
        [id]
    )

    if (result.length === 0) return null

    return {
        ...result[0],
        completed: Boolean(result[0].completed),
        inbox: Boolean(result[0].inbox),
    }
}

/**
 * 批量插入/更新 Todos（用于从远端同步）
 */
export async function upsertLocalTodos(todos: LocalTodo[]): Promise<void> {
    const db = await getDatabase()

    for (const todo of todos) {
        await db.execute(
            `INSERT OR REPLACE INTO todos (
        id, user_id, title, description, completed, due_date, start_date,
        quadrant, inbox, sort_order, parent_id, project_id, milestone_id, deleted_at, created_at, updated_at,
        sync_status, local_updated_at, remote_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
                todo.id,
                todo.user_id,
                todo.title,
                todo.description,
                todo.completed ? 1 : 0,
                todo.due_date,
                todo.start_date,
                todo.quadrant,
                todo.inbox ? 1 : 0,
                todo.sort_order,
                todo.parent_id,
                todo.project_id,
                todo.milestone_id,
                todo.deleted_at,
                todo.created_at,
                todo.updated_at,
                todo.sync_status,
                todo.local_updated_at,
                todo.remote_updated_at,
            ]
        )
    }
}

/**
 * 获取所有待同步的 Todos
 */
export async function getPendingTodos(): Promise<LocalTodo[]> {
    const db = await getDatabase()
    const result = await db.select<LocalTodo[]>(
        `SELECT * FROM todos WHERE sync_status = 'pending'`
    )

    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
        inbox: Boolean(row.inbox),
    }))
}

/**
 * 标记 Todo 为已同步
 */
export async function markTodoSynced(
    id: string,
    remoteUpdatedAt: string
): Promise<void> {
    const db = await getDatabase()
    await db.execute(
        `UPDATE todos SET sync_status = 'synced', remote_updated_at = $1 WHERE id = $2`,
        [remoteUpdatedAt, id]
    )
}
