import { getDatabase, generateId, nowISO } from './local'

// 项目类型
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

// 本地项目类型，包含同步字段
export type LocalProject = Project & {
    sync_status: 'synced' | 'pending' | 'conflict'
    local_updated_at: string
    remote_updated_at: string | null
}

// 里程碑类型
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

// 本地里程碑类型，包含同步字段
export type LocalMilestone = Milestone & {
    sync_status: 'synced' | 'pending' | 'conflict'
    local_updated_at: string
    remote_updated_at: string | null
}

export type ProjectInsert = Pick<Project, 'name'> & Partial<Pick<Project, 'description' | 'color'>>
export type ProjectUpdate = Partial<Pick<Project, 'name' | 'description' | 'color'>>

export type MilestoneInsert = Pick<Milestone, 'name'> & Partial<Pick<Milestone, 'due_date' | 'sort_order'>>
export type MilestoneUpdate = Partial<Pick<Milestone, 'name' | 'due_date' | 'completed' | 'sort_order'>>

// ==================== Project CRUD ====================

/**
 * 获取用户所有项目
 */
export async function fetchLocalProjects(
    userId: string,
    includeDeleted: boolean = false
): Promise<LocalProject[]> {
    const db = await getDatabase()

    let sql = `SELECT * FROM projects WHERE user_id = $1`
    if (!includeDeleted) {
        sql += ` AND deleted_at IS NULL`
    }
    sql += ` ORDER BY created_at DESC`

    const result = await db.select<LocalProject[]>(sql, [userId])
    return result
}

/**
 * 根据 ID 获取项目
 */
export async function getLocalProjectById(id: string): Promise<LocalProject | null> {
    const db = await getDatabase()
    const result = await db.select<LocalProject[]>(
        `SELECT * FROM projects WHERE id = $1`,
        [id]
    )
    return result.length > 0 ? result[0] : null
}

/**
 * 创建项目
 */
export async function createLocalProject(
    userId: string,
    project: ProjectInsert
): Promise<LocalProject> {
    const db = await getDatabase()
    const now = nowISO()
    const id = generateId()

    const newProject: LocalProject = {
        id,
        user_id: userId,
        name: project.name,
        description: project.description ?? null,
        color: project.color ?? '#6366f1',
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: 'pending',
        local_updated_at: now,
        remote_updated_at: null,
    }

    await db.execute(
        `INSERT INTO projects (
            id, user_id, name, description, color, created_at, updated_at, deleted_at,
            sync_status, local_updated_at, remote_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
            newProject.id,
            newProject.user_id,
            newProject.name,
            newProject.description,
            newProject.color,
            newProject.created_at,
            newProject.updated_at,
            newProject.deleted_at,
            newProject.sync_status,
            newProject.local_updated_at,
            newProject.remote_updated_at,
        ]
    )

    return newProject
}

/**
 * 更新项目
 */
export async function updateLocalProject(
    id: string,
    patch: ProjectUpdate
): Promise<LocalProject | null> {
    const db = await getDatabase()
    const now = nowISO()

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (patch.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(patch.name)
    }
    if (patch.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(patch.description)
    }
    if (patch.color !== undefined) {
        updates.push(`color = $${paramIndex++}`)
        values.push(patch.color)
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
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
    )

    return getLocalProjectById(id)
}

/**
 * 软删除项目
 */
export async function deleteLocalProject(id: string): Promise<void> {
    const db = await getDatabase()
    const now = nowISO()

    await db.execute(
        `UPDATE projects SET deleted_at = $1, updated_at = $1, local_updated_at = $1, sync_status = 'pending' WHERE id = $2`,
        [now, id]
    )
}

/**
 * 恢复已删除的项目
 */
export async function restoreLocalProject(id: string): Promise<LocalProject | null> {
    const db = await getDatabase()
    const now = nowISO()

    await db.execute(
        `UPDATE projects SET deleted_at = NULL, updated_at = $1, local_updated_at = $1, sync_status = 'pending' WHERE id = $2`,
        [now, id]
    )

    return getLocalProjectById(id)
}

/**
 * 永久删除项目
 */
export async function permanentlyDeleteLocalProject(id: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(`DELETE FROM projects WHERE id = $1`, [id])
}

// ==================== Milestone CRUD ====================

/**
 * 获取项目的所有里程碑
 */
export async function fetchLocalMilestones(projectId: string): Promise<LocalMilestone[]> {
    const db = await getDatabase()

    const result = await db.select<LocalMilestone[]>(
        `SELECT * FROM milestones WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [projectId]
    )

    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
    }))
}

/**
 * 根据 ID 获取里程碑
 */
export async function getLocalMilestoneById(id: string): Promise<LocalMilestone | null> {
    const db = await getDatabase()
    const result = await db.select<LocalMilestone[]>(
        `SELECT * FROM milestones WHERE id = $1`,
        [id]
    )

    if (result.length === 0) return null

    return {
        ...result[0],
        completed: Boolean(result[0].completed),
    }
}

/**
 * 创建里程碑
 */
export async function createLocalMilestone(
    projectId: string,
    milestone: MilestoneInsert
): Promise<LocalMilestone> {
    const db = await getDatabase()
    const now = nowISO()
    const id = generateId()

    const newMilestone: LocalMilestone = {
        id,
        project_id: projectId,
        name: milestone.name,
        due_date: milestone.due_date ?? null,
        completed: false,
        sort_order: milestone.sort_order ?? 0,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        local_updated_at: now,
        remote_updated_at: null,
    }

    await db.execute(
        `INSERT INTO milestones (
            id, project_id, name, due_date, completed, sort_order, created_at, updated_at,
            sync_status, local_updated_at, remote_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
            newMilestone.id,
            newMilestone.project_id,
            newMilestone.name,
            newMilestone.due_date,
            newMilestone.completed ? 1 : 0,
            newMilestone.sort_order,
            newMilestone.created_at,
            newMilestone.updated_at,
            newMilestone.sync_status,
            newMilestone.local_updated_at,
            newMilestone.remote_updated_at,
        ]
    )

    return newMilestone
}

/**
 * 更新里程碑
 */
export async function updateLocalMilestone(
    id: string,
    patch: MilestoneUpdate
): Promise<LocalMilestone | null> {
    const db = await getDatabase()
    const now = nowISO()

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (patch.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(patch.name)
    }
    if (patch.due_date !== undefined) {
        updates.push(`due_date = $${paramIndex++}`)
        values.push(patch.due_date)
    }
    if (patch.completed !== undefined) {
        updates.push(`completed = $${paramIndex++}`)
        values.push(patch.completed ? 1 : 0)
    }
    if (patch.sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`)
        values.push(patch.sort_order)
    }

    updates.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    updates.push(`local_updated_at = $${paramIndex++}`)
    values.push(now)
    updates.push(`sync_status = $${paramIndex++}`)
    values.push('pending')

    values.push(id)

    await db.execute(
        `UPDATE milestones SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
    )

    return getLocalMilestoneById(id)
}

/**
 * 删除里程碑
 */
export async function deleteLocalMilestone(id: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(`DELETE FROM milestones WHERE id = $1`, [id])
}

// ==================== 辅助查询 ====================

/**
 * 获取项目的任务统计
 */
export async function getProjectTaskStats(projectId: string): Promise<{ total: number; completed: number }> {
    const db = await getDatabase()

    const totalResult = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM todos WHERE project_id = $1 AND deleted_at IS NULL`,
        [projectId]
    )

    const completedResult = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM todos WHERE project_id = $1 AND deleted_at IS NULL AND completed = 1`,
        [projectId]
    )

    return {
        total: totalResult[0]?.count ?? 0,
        completed: completedResult[0]?.count ?? 0,
    }
}

/**
 * 获取项目的任务列表
 */
export async function getProjectTodos(projectId: string): Promise<{
    id: string
    title: string
    completed: boolean
    milestone_id: string | null
    project_id: string
}[]> {
    const db = await getDatabase()

    const result = await db.select<{
        id: string
        title: string
        completed: number
        milestone_id: string | null
        project_id: string
    }[]>(
        `SELECT id, title, completed, milestone_id, project_id FROM todos 
         WHERE project_id = $1 AND deleted_at IS NULL 
         ORDER BY sort_order ASC, created_at ASC`,
        [projectId]
    )

    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
    }))
}

/**
 * 获取待同步的项目
 */
export async function getPendingProjects(): Promise<LocalProject[]> {
    const db = await getDatabase()
    const result = await db.select<LocalProject[]>(
        `SELECT * FROM projects WHERE sync_status = 'pending'`
    )
    return result
}

/**
 * 获取待同步的里程碑
 */
export async function getPendingMilestones(): Promise<LocalMilestone[]> {
    const db = await getDatabase()
    const result = await db.select<LocalMilestone[]>(
        `SELECT * FROM milestones WHERE sync_status = 'pending'`
    )
    return result.map(row => ({
        ...row,
        completed: Boolean(row.completed),
    }))
}

/**
 * 标记项目为已同步
 */
export async function markProjectSynced(id: string, remoteUpdatedAt: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(
        `UPDATE projects SET sync_status = 'synced', remote_updated_at = $1 WHERE id = $2`,
        [remoteUpdatedAt, id]
    )
}


/**
 * 标记里程碑为已同步
 */
export async function markMilestoneSynced(id: string, remoteUpdatedAt: string): Promise<void> {
    const db = await getDatabase()
    await db.execute(
        `UPDATE milestones SET sync_status = 'synced', remote_updated_at = $1 WHERE id = $2`,
        [remoteUpdatedAt, id]
    )
}


/**
 * 批量更新本地项目（用于同步）
 */
export async function upsertLocalProjects(projects: LocalProject[]): Promise<void> {
    const db = await getDatabase()

    for (const project of projects) {
        // 检查是否存在
        const existing = await getLocalProjectById(project.id)

        if (existing) {
            // 更新
            await db.execute(
                `UPDATE projects SET 
                name = $1, description = $2, color = $3, 
                updated_at = $4, deleted_at = $5,
                sync_status = $6, local_updated_at = $7, remote_updated_at = $8
                WHERE id = $9`,
                [
                    project.name, project.description, project.color,
                    project.updated_at, project.deleted_at,
                    project.sync_status, project.local_updated_at, project.remote_updated_at,
                    project.id
                ]
            )
        } else {
            // 插入
            await db.execute(
                `INSERT INTO projects (
                    id, user_id, name, description, color, 
                    created_at, updated_at, deleted_at,
                    sync_status, local_updated_at, remote_updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    project.id, project.user_id, project.name, project.description, project.color,
                    project.created_at, project.updated_at, project.deleted_at,
                    project.sync_status, project.local_updated_at, project.remote_updated_at
                ]
            )
        }
    }
}

/**
 * 批量更新本地里程碑（用于同步）
 */
export async function upsertLocalMilestones(milestones: LocalMilestone[]): Promise<void> {
    const db = await getDatabase()

    for (const milestone of milestones) {
        // 检查是否存在
        const existing = await getLocalMilestoneById(milestone.id)

        if (existing) {
            // 更新
            await db.execute(
                `UPDATE milestones SET 
                name = $1, due_date = $2, completed = $3, sort_order = $4,
                updated_at = $5,
                sync_status = $6, local_updated_at = $7, remote_updated_at = $8
                WHERE id = $9`,
                [
                    milestone.name, milestone.due_date, milestone.completed ? 1 : 0, milestone.sort_order,
                    milestone.updated_at,
                    milestone.sync_status, milestone.local_updated_at, milestone.remote_updated_at,
                    milestone.id
                ]
            )
        } else {
            // 插入
            await db.execute(
                `INSERT INTO milestones (
                    id, project_id, name, due_date, completed, sort_order, 
                    created_at, updated_at,
                    sync_status, local_updated_at, remote_updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    milestone.id, milestone.project_id, milestone.name, milestone.due_date, milestone.completed ? 1 : 0, milestone.sort_order,
                    milestone.created_at, milestone.updated_at,
                    milestone.sync_status, milestone.local_updated_at, milestone.remote_updated_at
                ]
            )
        }
    }
}
