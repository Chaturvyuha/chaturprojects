-- schema.sql: SQLite schema for tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,            -- ISO date string, optional
  priority INTEGER DEFAULT 2, -- 1=High,2=Medium,3=Low
  completed INTEGER DEFAULT 0, -- 0=false,1=true
  created_at TEXT DEFAULT (datetime('now'))
);