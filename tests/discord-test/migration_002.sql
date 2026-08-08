-- 記憶同步表
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    character_id TEXT,
    content TEXT,
    memory_type TEXT DEFAULT 'dynamic',
    importance REAL DEFAULT 0.5,
    timestamp TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_memories_character_id ON memories(character_id);

-- 頻道直綁角色表
CREATE TABLE IF NOT EXISTS channel_bindings (
    channel_id TEXT PRIMARY KEY,
    character_id TEXT,
    guild_id TEXT,
    updated_at TEXT
);