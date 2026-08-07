-- 訊息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    role TEXT,
    content TEXT,
    timestamp TEXT,
    metadata TEXT
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT,
    personality TEXT,
    scenario TEXT
);

-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    mask TEXT
);

-- 世界書表
CREATE TABLE IF NOT EXISTS worldInfo (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    keys TEXT,
    priority TEXT,
    enabled INTEGER DEFAULT 1,
    user_id TEXT,
    character_id TEXT
);

-- 全局設定表
CREATE TABLE IF NOT EXISTS globalSettings (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    keys TEXT,
    priority TEXT,
    enabled INTEGER DEFAULT 1
);

-- 全局禁用詞表
CREATE TABLE IF NOT EXISTS globalForbidden (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    enabled INTEGER DEFAULT 1
);

-- Discord 用戶綁定表
CREATE TABLE IF NOT EXISTS discordUserBindings (
    discord_user_id TEXT PRIMARY KEY,
    user_id TEXT,
    character_id TEXT,
    user_display_name TEXT
);

-- Discord 頻道映射表
CREATE TABLE IF NOT EXISTS discord_channel_mappings (
    channel_id TEXT PRIMARY KEY,
    character_id TEXT
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_worldinfo_user ON worldInfo(user_id);
CREATE INDEX IF NOT EXISTS idx_worldinfo_character ON worldInfo(character_id);
