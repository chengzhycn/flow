-- 工作总结表
CREATE TABLE IF NOT EXISTS work_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- 同步字段
  sync_status TEXT NOT NULL DEFAULT 'pending',
  local_updated_at TEXT NOT NULL,
  remote_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_work_summaries_user_id ON work_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_work_summaries_type ON work_summaries(type);
CREATE INDEX IF NOT EXISTS idx_work_summaries_period_start ON work_summaries(period_start);
CREATE INDEX IF NOT EXISTS idx_work_summaries_sync_status ON work_summaries(sync_status);
