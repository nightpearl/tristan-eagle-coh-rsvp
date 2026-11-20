CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  guests INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 20), -- 1 on declines; headcount counts attending = 1 only
  relationship TEXT,
  message TEXT,
  n_scout INTEGER NOT NULL DEFAULT 0,   -- Scout / Leader
  n_parent INTEGER NOT NULL DEFAULT 0,  -- Scout Parent
  n_family INTEGER NOT NULL DEFAULT 0,
  n_friend INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  attending INTEGER NOT NULL DEFAULT 1  -- 1 = coming, 0 = can't make it (added by ALTER TABLE)
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_key TEXT NOT NULL UNIQUE,
  name TEXT,
  caption TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  relationship TEXT,
  memory TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
