-- todos 表
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  start_date TEXT,
  quadrant TEXT CHECK (quadrant IN ('important_urgent', 'important_not_urgent', 'not_important_urgent', 'not_important_not_urgent')),
  inbox INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- 同步字段
  sync_status TEXT NOT NULL DEFAULT 'synced', -- 'synced' | 'pending' | 'conflict'
  local_updated_at TEXT NOT NULL,
  remote_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON todos(sync_status);

-- pomodoro_sessions 表
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('work', 'short_break', 'long_break')),
  completed INTEGER NOT NULL DEFAULT 0,
  todo_id TEXT,
  created_at TEXT NOT NULL,
  -- 同步字段
  sync_status TEXT NOT NULL DEFAULT 'synced',
  local_created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_sync_status ON pomodoro_sessions(sync_status);

-- 同步队列：记录需要推送到远端的变更
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT, -- JSON 格式
  created_at TEXT NOT NULL,
  retries INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);

-- 同步元数据
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
