# SXIOS Wiki 核心功能实现计划

## 目标

将 SXIOS PWA 的 `personal-wiki` 从通用笔记工具升级为**角色记录 Wiki**，自动串接 PWA 内所有 char 和 user 数据（个性、聊天记录、社交媒体互动），并借鉴 llm-wiki-skill 的结构化知识库方法论（实体页、双向链接、素材摘要、置信度标注）。

## 现状分析

### SXIOS 现有数据源
| 数据源 | 存储位置 | 内容 |
|--------|----------|------|
| Characters | IndexedDB `characters` | name, avatar, personality, scenario, first_message |
| Chats | IndexedDB `chats` + `messages` | 对话记录，含 character_name, role, content, timestamp |
| Memories | IndexedDB `memories` | 感官/情绪/时空标注的记忆，含 embedding |
| World Info | IndexedDB `worldInfo` | 关键词/向量检索的知识条目 |
| Instagram | SettingsDB `instagram_*` | stories, posts, saved, memories |
| Facebook | SettingsDB `share_*` | posts, friends, reactions, comments |
| Twitter | SettingsDB `twitter_*` | tweets, bookmarks, notifications, npc_follows |
| Weverse | SettingsDB `weverse_*` | 粉丝社区互动 |
| LOFTER | SettingsDB `lofter_*` | CP内容、同人 |
| Exchange Diary | SettingsDB | 多人日记 |
| Personal Wiki | SettingsDB `wiki_pages` | Notion 风格块编辑器页面 |

### llm-wiki-skill 核心方法论（需适配到浏览器端）
- **实体页**：围绕人物/概念累积多素材描述
- **素材摘要页**：围绕一份素材整理核心观点
- **双向链接 `[[链接]]`**：页面间互相关联
- **置信度标注**：EXTRACTED / INFERRED / AMBIGUOUS / UNVERIFIED
- **两步式整理**：先分析后生成
- **知识图谱**：从页面关系生成可视化

## 设计决策

### D1: Wiki 数据存储方式
**决定**：新增 IndexedDB object store `wikiRecords`，取代 SettingsDB JSON 存储。

理由：
- 角色记录数据量远超通用笔记（聊天记录 + 社交互动可能数千条）
- SettingsDB 存 JSON 字符串，大数据下读写性能差
- 需要按 character_id 索引查询
- 与现有 ChatsDB/MessagesDB/CharactersDB 同层，便于 JOIN 查询

### D2: 页面类型体系
**决定**：采用 llm-wiki 的实体/素材/主题分层，适配为 SXIOS 语境：

| 页面类型 | 用途 | 自动生成来源 |
|----------|------|-------------|
| `character` | 角色档案（个性、关系、互动摘要） | CharactersDB |
| `chat-log` | 聊天时间线片段（按角色分类，每 N 条消息一段） | ChatsDB + MessagesDB |
| `social-log` | 角色社交互动聚合（跨平台，按角色合并） | Instagram/Facebook/Twitter/Weverse/LOFTER |
| `topic` | 主题页（跨角色话题） | AI 分析 |
| `note` | 手动笔记 | 用户创建 |

### D3: 自动同步 vs 手动触发
**决定**：手动触发 + 增量同步。

- 用户在 Wiki 内点击"同步角色数据"按钮
- 系统扫描自上次同步后的新增数据
- 生成/更新对应 character 页面和 interaction 页面
- 不自动同步，避免后台性能开销

### D4: 聊天记录同步粒度
**决定**：按角色分类，每 10 条消息生成一个 `chat-log` 页面。

- 同一角色的聊天消息按时间排序
- 每 10 条消息切分为一个 chat-log 页面
- 页面标题格式：`💬 {角色名} 聊天紀錄 #{序號}`
- 页面内容：时间线 + 关键对话摘要 + 情感标注
- character 页面通过 `[[chat-log]]` 链接引用所有 chat-log 页面

### D5: 社交互动同步粒度
**决定**：按角色聚合，不分平台。

- 同一角色在所有社交平台的互动合并为一个 `social-log` 页面
- 页面标题格式：`🌐 {角色名} 社交互動`
- 页面内按时间线混合排列，每条标注来源平台（Instagram/Facebook/Twitter 等）
- character 页面通过 `[[social-log]]` 链接引用

### D6: 双向链接实现
**决定**：在块内容中使用 `[[页面标题]]` 语法，渲染时解析为可点击链接。

- 借鉴 llm-wiki 的 `[[双向链接]]` 模式
- 自动生成的页面间自动插入双向链接
- 用户手动编辑时也可输入 `[[` 触发链接选择器

### D7: 置信度标注
**决定**：在自动生成的块上添加 `data-confidence` 属性，UI 上以颜色/标签区分。

- 从角色数据直接提取 → EXTRACTED（绿色）
- 从聊天内容推断 → INFERRED（蓝色）
- AI 生成/不确定 → AMBIGUOUS（黄色）
- 无来源 → UNVERIFIED（灰色）

## 实现步骤

### Step 1: 扩展 IndexedDB Schema
**文件**: `js/db.js`

- DB_VERSION 升至 3
- 新增 `wikiRecords` object store，keyPath: `id`
- 索引：`character_id`, `page_type`, `title`, `updated_at`
- 新增 `WikiRecordsDB` CRUD 接口

```javascript
// wikiRecords 数据模型
{
  id: 'wiki_xxx',
  page_type: 'character' | 'chat-log' | 'social-log' | 'topic' | 'note',
  title: '角色名',
  character_id: 'id-xxx' | null,  // 关联角色
  source_type: 'auto' | 'manual',  // 自动生成 or 手动创建
  source_ids: [],                   // 来源数据 ID 列表
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS' | 'UNVERIFIED',
  blocks: [...],                    // 复用现有 block 编辑器
  links: [],                        // [[双向链接]] 目标页面 ID 列表
  tags: [],
  cover_image: null,
  icon: '📄',
  parent_id: null,
  chat_log_index: 0,                // chat-log 专用：序号
  message_range: { start: 0, end: 0 }, // chat-log 专用：消息范围
  synced_at: null,                  // 上次同步时间戳
  created_at: Date.now(),
  updated_at: Date.now()
}
```

**验证**: 打开 PWA，确认 DB 升级无报错，`WikiRecordsDB.getAll()` 返回空数组。

### Step 2: 重构 personal-wiki 为 character-wiki
**文件**: `js/apps/personal-wiki/index.js`（重写）

核心改动：
1. 数据层从 `SettingsDB wiki_pages` 迁移到 `WikiRecordsDB`
2. 侧边栏增加"角色档案"分区，按 character 分组显示
3. 新增"同步数据"按钮，触发增量同步
4. 块编辑器增加 `[[` 触发的双向链接选择器
5. 块渲染支持 `[[页面标题]]` 解析为可点击链接
6. 自动生成的块显示置信度标签
7. 保留现有 Notion 风格编辑器全部功能

**侧边栏结构**:
```
Wiki
├── 🔍 搜尋
├── 📋 角色檔案
│   ├── 🧑 角色A
│   │   ├── 💬 聊天紀錄 #1
│   │   ├── 💬 聊天紀錄 #2
│   │   └── 🌐 社交互動
│   ├── 🧑 角色B
│   │   └── 💬 聊天紀錄 #1
│   └── 🧑 角色C
├── 📌 主題
│   └── ...
├── 📝 筆記
│   └── ...
└── ⚙️ 設定
```

**验证**: 手动创建 note 页面，编辑块内容，确认 CRUD 正常。

### Step 3: 实现数据同步引擎
**文件**: `js/apps/personal-wiki/sync-engine.js`（新建）

功能：
1. `syncCharacters()`: 扫描 CharactersDB，为每个角色创建/更新 character 页面
   - 提取 personality, scenario, description 写入块
   - 标注 confidence: EXTRACTED
   - 自动插入 `[[角色名]]` 链接

2. `syncChatLogs()`: 扫描 ChatsDB + MessagesDB，按角色分类
   - 同一角色的所有聊天消息按时间排序
   - 每 10 条消息切分为一个 chat-log 页面
   - 页面标题：`💬 {角色名} 聊天紀錄 #{序号}`
   - 内容：时间线格式列出消息 + 关键对话摘要
   - 标注 confidence: EXTRACTED（原文）/ INFERRED（摘要）
   - character 页面通过 `[[chat-log]]` 链接引用

3. `syncSocialLogs()`: 扫描所有社交 app 数据，按角色聚合
   - 同一角色在 Instagram/Facebook/Twitter/Weverse/LOFTER 的互动合并
   - 生成一个 social-log 页面：`🌐 {角色名} 社交互動`
   - 页面内按时间线排列，每条标注来源平台图标
   - character 页面通过 `[[social-log]]` 链接引用

4. `syncMemories()`: 扫描 MemoryDB
   - 将高 importance 记忆关联到角色页面
   - 提取情绪/感官标签作为页面标签

5. `incrementalSync(lastSyncTime)`: 只处理 lastSyncTime 之后的新数据
   - 新消息追加到现有 chat-log 或创建新 chat-log
   - 新社交互动追加到现有 social-log

**验证**: 创建测试角色和聊天记录，点击同步，确认按角色分类生成 chat-log 页面，每 10 条一段。

### Step 4: 双向链接系统
**文件**: `js/apps/personal-wiki/link-system.js`（新建）

功能：
1. `parseLinks(blockContent)`: 从块内容中提取 `[[标题]]` 链接
2. `resolveLink(title)`: 按标题查找目标页面，返回页面 ID
3. `getBacklinks(pageId)`: 查找所有链接到当前页面的页面
4. `renderLink(text, pageId)`: 将 `[[标题]]` 渲染为可点击元素
5. `showLinkPicker(triggerEl, onSelect)`: 输入 `[[` 时弹出页面选择器
6. `updateLinks(pageId, newLinks)`: 更新页面的 links 数组

**验证**: 在页面中输入 `[[角色A]]`，确认解析为链接，点击可跳转；在角色A页面查看反向链接。

### Step 5: 置信度标注 UI
**文件**: `js/apps/personal-wiki/style.css`（扩展）

- 自动生成的块右侧显示置信度标签
- 颜色编码：EXTRACTED=绿, INFERRED=蓝, AMBIGUOUS=黄, UNVERIFIED=灰
- 点击标签显示来源信息（source_ids 对应的数据）
- 手动创建的块不显示标签

**验证**: 同步角色数据后，查看自动生成的块是否显示正确的置信度标签。

### Step 6: 页面模板
**文件**: `js/apps/personal-wiki/templates.js`（新建）

自动生成的 character 页面结构：
```
📄 角色名
├── H1: 角色名
├── H2: 基本資料 [EXTRACTED]
│   ├── 描述: ...
│   ├── 個性: ...
│   └── 場景: ...
├── H2: 聊天紀錄
│   ├── → [[💬 角色名 聊天紀錄 #1]]
│   ├── → [[💬 角色名 聊天紀錄 #2]]
│   └── ...
├── H2: 社交互動
│   └── → [[🌐 角色名 社交互動]]
├── H2: 記憶摘要 [INFERRED]
│   └── 從聊天記錄推斷的關係特徵...
└── H2: 相關頁面
    └── → [[主題: ...]]
```

自动生成的 chat-log 页面结构：
```
💬 角色名 聊天紀錄 #1
├── H1: 角色名 聊天紀錄 #1
├── H2: 時間線 [EXTRACTED]
│   ├── 2026-07-25 14:30 用戶: ...
│   ├── 2026-07-25 14:31 角色名: ...
│   └── ...（10 條消息）
├── H2: 摘要 [INFERRED]
│   └── 這段對話主要討論了...
└── H2: 相關頁面
    ├── → [[角色名]]
    └── → [[💬 角色名 聊天紀錄 #2]]
```

自动生成的 social-log 页面结构：
```
🌐 角色名 社交互動
├── H1: 角色名 社交互動
├── H2: 互動時間線 [EXTRACTED]
│   ├── [IG] 2026-07-25 角色名發布了新貼文...
│   ├── [FB] 2026-07-24 角色名分享了動態...
│   ├── [TW] 2026-07-23 角色名發了推文...
│   └── ...
├── H2: 互動摘要 [INFERRED]
│   └── 角色名在社交平台上主要...
└── H2: 相關頁面
    └── → [[角色名]]
```

**验证**: 同步后检查自动生成的页面结构是否符合模板。

### Step 7: 数据迁移
**文件**: `js/apps/personal-wiki/migration.js`（新建）

- 读取 SettingsDB 中的 `wiki_pages` 数据
- 转换为 `wikiRecords` 格式（page_type: 'note', source_type: 'manual'）
- 写入 WikiRecordsDB
- 保留原 SettingsDB 数据作为备份
- 首次打开新 Wiki 时自动执行迁移

**验证**: 已有 wiki 页面的用户升级后，旧页面出现在"筆記"分区。

### Step 8: 注册表与路由更新
**文件**: `js/apps/registry.js`

- personal-wiki 模块保持同一入口
- 新增 `/wiki/sync` 路由用于同步操作
- navItem label 改为 '角色 Wiki'，icon 保持 'import_contacts'

**验证**: 从主屏幕点击 Wiki 图标，确认进入新界面。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| IndexedDB 版本升级可能丢失数据 | upgrade handler 保留所有现有 store，只新增 wikiRecords |
| 大量聊天记录同步可能卡 UI | 同步操作分批处理，每批 50 条，用 requestIdleCallback |
| 双向链接解析性能 | 延迟解析，只在渲染可见块时解析链接 |
| 社交 app 数据格式不统一 | sync-engine 内为每个 app 写独立适配器 |
| chat-log 每 10 条切分可能打断对话上下文 | 切分点优先选择自然对话停顿（角色回复后），不足 10 条时合并到上一段 |

## 不在范围内

- 知识图谱可视化（llm-wiki 的 graph 功能）— 后续迭代
- AI 自动分析/两步式整理 — 需要服务端，后续迭代
- Notion 同步 — 保留现有功能不变
- World Info 合并 — 保持独立，通过双向链接关联
