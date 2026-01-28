import { getDatabase, nowISO } from '../db/local'

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export type SyncQueueItem = {
    id: number
    table_name: string
    record_id: string
    operation: SyncOperation
    payload: string | null
    created_at: string
    retries: number
}

const MAX_RETRIES = 5

/**
 * 添加到同步队列
 */
export async function addToSyncQueue(
    tableName: string,
    recordId: string,
    operation: SyncOperation,
    payload?: unknown
): Promise<void> {
    const db = await getDatabase()
    const now = nowISO()

    // 检查是否已有相同记录的待同步项
    const existing = await db.select<SyncQueueItem[]>(
        `SELECT * FROM sync_queue WHERE table_name = $1 AND record_id = $2`,
        [tableName, recordId]
    )

    if (existing.length > 0) {
        // 更新现有项
        await db.execute(
            `UPDATE sync_queue SET operation = $1, payload = $2, created_at = $3 WHERE table_name = $4 AND record_id = $5`,
            [operation, payload ? JSON.stringify(payload) : null, now, tableName, recordId]
        )
    } else {
        // 插入新项
        await db.execute(
            `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at, retries) VALUES ($1, $2, $3, $4, $5, 0)`,
            [tableName, recordId, operation, payload ? JSON.stringify(payload) : null, now]
        )
    }
}

/**
 * 获取待同步项（按创建时间排序）
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await getDatabase()
    const result = await db.select<SyncQueueItem[]>(
        `SELECT * FROM sync_queue WHERE retries < $1 ORDER BY created_at ASC`,
        [MAX_RETRIES]
    )
    return result
}

/**
 * 移除已同步的项
 */
export async function removeSyncQueueItem(id: number): Promise<void> {
    const db = await getDatabase()
    await db.execute(`DELETE FROM sync_queue WHERE id = $1`, [id])
}

/**
 * 增加重试次数
 */
export async function incrementRetry(id: number): Promise<void> {
    const db = await getDatabase()
    await db.execute(
        `UPDATE sync_queue SET retries = retries + 1 WHERE id = $1`,
        [id]
    )
}

/**
 * 清空所有已达最大重试次数的项（可选用于手动清理）
 */
export async function clearFailedItems(): Promise<void> {
    const db = await getDatabase()
    await db.execute(`DELETE FROM sync_queue WHERE retries >= $1`, [MAX_RETRIES])
}

/**
 * 获取同步队列的状态统计
 */
export async function getSyncQueueStats(): Promise<{
    pending: number
    failed: number
}> {
    const db = await getDatabase()

    const pending = await db.select<[{ count: number }]>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE retries < $1`,
        [MAX_RETRIES]
    )

    const failed = await db.select<[{ count: number }]>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE retries >= $1`,
        [MAX_RETRIES]
    )

    return {
        pending: pending[0]?.count ?? 0,
        failed: failed[0]?.count ?? 0,
    }
}
