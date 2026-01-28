import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

/**
 * 获取本地数据库连接
 * 数据库在 Tauri 后端由插件管理，这里只是获取连接
 */
export async function getDatabase(): Promise<Database> {
    if (!db) {
        db = await Database.load('sqlite:flow.db')
    }
    return db
}

/**
 * 检查应用是否在 Tauri 环境中运行
 * Tauri v2 使用 __TAURI_INTERNALS__
 */
export function isTauriEnv(): boolean {
    if (typeof window === 'undefined') return false
    // Tauri v2 uses __TAURI_INTERNALS__
    // Tauri v1 uses __TAURI__
    return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

/**
 * 生成 UUID v4
 */
export function generateId(): string {
    return crypto.randomUUID()
}

/**
 * 获取当前 ISO 时间字符串
 */
export function nowISO(): string {
    return new Date().toISOString()
}
