/**
 * 同步 API
 * 提供手动同步操作的接口
 */

import { isTauriEnv } from '../db/local'
import {
    getSyncStatus as getEngineStatus,
    initSyncEngine,
    stopSyncEngine,
    triggerSync,
    forcePullSync,
    forcePushSync,
} from '../sync/SyncEngine'
import { getSyncQueueStats } from '../sync/SyncQueue'

export type SyncStatusInfo = {
    status: 'idle' | 'syncing' | 'error'
    lastSyncTime: string | null
    pendingChanges: number
    failedChanges: number
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(): Promise<SyncStatusInfo> {
    if (!isTauriEnv()) {
        return {
            status: 'idle',
            lastSyncTime: null,
            pendingChanges: 0,
            failedChanges: 0,
        }
    }

    const engineStatus = getEngineStatus()
    const queueStats = await getSyncQueueStats()

    return {
        status: engineStatus.status,
        lastSyncTime: engineStatus.lastSyncTime,
        pendingChanges: queueStats.pending,
        failedChanges: queueStats.failed,
    }
}

/**
 * 初始化同步
 */
export async function initSync(userId: string): Promise<void> {
    if (!isTauriEnv()) return
    await initSyncEngine(userId)
}

/**
 * 停止同步
 */
export function stopSync(): void {
    if (!isTauriEnv()) return
    stopSyncEngine()
}

/**
 * 手动触发同步
 */
export async function manualSync(userId: string): Promise<void> {
    if (!isTauriEnv()) return
    await triggerSync(userId)
}

/**
 * 强制从远端拉取
 */
export async function pullFromRemote(userId: string): Promise<void> {
    if (!isTauriEnv()) return
    await forcePullSync(userId)
}

/**
 * 强制推送到远端
 */
export async function pushToRemote(userId: string): Promise<void> {
    if (!isTauriEnv()) return
    await forcePushSync(userId)
}
