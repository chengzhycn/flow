-- 为任务添加完成时间字段
ALTER TABLE todos ADD COLUMN completed_at TEXT;

-- 为已完成的任务设置初始的 completed_at 值（使用 updated_at）
UPDATE todos SET completed_at = updated_at WHERE completed = 1;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);
