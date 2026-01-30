import { getDatabase } from './local'
import type { ThemeMode } from '@/theme/themeStore'

const THEME_KEY = 'app_theme'
const DEFAULT_THEME: ThemeMode = 'system'

/**
 * 从本地数据库获取主题设置
 */
export async function getThemeSetting(): Promise<ThemeMode> {
    try {
        const db = await getDatabase()
        const result = await db.select<{ value: string }[]>(
            `SELECT value FROM sync_meta WHERE key = $1`,
            [THEME_KEY]
        )
        
        if (result.length > 0) {
            const value = result[0].value as ThemeMode
            if (['light', 'dark', 'system'].includes(value)) {
                return value
            }
        }
        return DEFAULT_THEME
    } catch (error) {
        console.error('Failed to get theme setting:', error)
        return DEFAULT_THEME
    }
}

/**
 * 保存主题设置到本地数据库
 */
export async function setThemeSetting(mode: ThemeMode): Promise<void> {
    try {
        const db = await getDatabase()
        await db.execute(
            `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ($1, $2)`,
            [THEME_KEY, mode]
        )
    } catch (error) {
        console.error('Failed to save theme setting:', error)
    }
}
