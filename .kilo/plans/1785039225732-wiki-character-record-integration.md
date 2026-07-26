# Plan: SXIOS Wiki 核心功能 - 角色与互动记录整合

## 背景

用户希望将 SXIOS PWA 中的 Wiki 应用转变为一个**核心记录系统**，用于：
1. 记录 CharactersDB 中所有角色信息（name, avatar, description, personality, scenario）
2. 记录 ChatsDB/MessagesDB 中的聊天互动记录
3. 记录各社交平台（Instagram, Twitter, Facebook, Weverse, Lofter 等）的互动记录
4. 基于 llm-wiki-skill 方法论自动整理和关联这些信息

## 核心理念（来自 llm-wiki-skill）

> "知识被编译一次，持续维护，而不是每次重新推导"

- **实体页**: 每个角色自动生成一个 wiki 页面
- **主题页**: 按话题组织（如"聊天记录"、"Instagram 互动"）
- **素材摘要**: 每次互动/聊天生成摘要
- **双向链接**: `[[角色名]]` 关联实体
- **置信度标注**: EXTRACTED（直接提取）/ INFERRED（推断）

---

## 数据源映射

### 1. CharactersDB → 角色实体页
```
wiki/entities/{角色名}.md
- 自动同步所有角色
- 包含：名称、头像、描述、性格、场景
- 统计：聊天次数、互动次数
```

### 2. ChatsDB/MessagesDB → 聊天记录摘要
```
wiki/sources/chats/{日期}-{角色名}-{主题}.md
- 按会话生成摘要
- 关联角色实体
- 提取关键话题和情感
```

### 3. 社交平台数据 → 互动记录
```
wiki/sources/{平台}/{日期}-{角色名}.md
- Instagram posts/stories/memories
- Twitter tweets/mentions/replies
- Facebook posts/comments
- Weverse posts/comments
- Lofter posts
```

---

## 功能设计

### 1. 自动同步机制

**触发时机**：
- Wiki 应用启动时检查数据变更
- 用户手动点击"同步"按钮
- 新聊天结束后触发

**同步流程**：
```
CharactersDB.getAll() → 生成/更新 wiki/entities/
ChatsDB.getAll() → 生成 wiki/sources/chats/
SettingsDB.get('instagram_*') → 生成 wiki/sources/instagram/
SettingsDB.get('twitter_*') → 生成 wiki/sources/twitter/
... 其他平台
```

### 2. 实体页模板

```markdown
# {角色名}

> 类型：角色 | 创建日期：{date}

## 基本信息
- **描述**: {description}
- **性格**: {personality}
- **场景**: {scenario}

## 统计
- 聊天次数：{N}
- Instagram 互动：{N}
- Twitter 提及：{N}

## 相关页面
- [[聊天记录]] - 与此角色的所有对话
- [[Instagram 互动]] - Instagram 上的互动

## 来源素材
- [[2026-01-15-首次对话]]
- [[2026-01-20-Instagram-回复]]
```

### 3. 聊天摘要页模板

```markdown
# {日期} - 与 {角色名} 的对话

> 来源：ChatsDB | 置信度：EXTRACTED

## 摘要
{AI 生成的对话摘要}

## 关键话题
- 话题1
- 话题2

## 情感分析
- 整体情绪：{positive/neutral/negative}

## 相关实体
- [[{角色名}]]
- [[其他提到的概念]]
```

### 4. 社交互动摘要模板

```markdown
# {日期} - {角色名} 的 {平台} 互动

> 来源：{平台} | 置信度：EXTRACTED

## 内容
{帖子/评论内容}

## 互动类型
- 类型：{post/comment/reply/like}

## 相关角色
- [[{角色名}]]

## 原始素材
{引用或截图}
```

---

## UI 改造

### 1. 侧边栏调整
```
Wiki
├── 🔍 搜尋
├── 全部頁面
│   ├── 👥 角色 (N)
│   ├── 💬 聊天記錄 (N)
│   ├── 📸 Instagram (N)
│   ├── 🐦 Twitter (N)
│   ├── 📘 Facebook (N)
│   ├── 🎤 Weverse (N)
│   └── 📝 Lofter (N)
├── 最近查看
└── + 新增筆記
```

### 2. 新增同步按钮
- 侧边栏底部：**同步資料** 按钮
- 点击后显示同步进度
- 完成后显示新增/更新统计

### 3. 首页仪表盘
```
┌─────────────────────────────────┐
│ 📊 概覽                          │
├─────────────────────────────────┤
│ 👥 角色數：12                     │
│ 💬 聊天記錄：45                   │
│ 📸 社交互動：128                  │
│ 🔗 關聯數：89                     │
├─────────────────────────────────┤
│ 📝 最近活動                       │
│ • 2026-01-26 與 小多 聊天          │
│ • 2026-01-25 Instagram 回覆       │
│ • ...                            │
└─────────────────────────────────┘
```

---

## 技术实现

### 1. 数据同步模块 (js/apps/personal-wiki/sync.js)

```javascript
async function syncAll() {
  const stats = { characters: 0, chats: 0, instagram: 0, twitter: 0, ... };
  
  // 同步角色
  const characters = await CharactersDB.getAll();
  for (const char of characters) {
    await syncCharacter(char);
    stats.characters++;
  }
  
  // 同步聊天
  const chats = await ChatsDB.getAll();
  for (const chat of chats) {
    const messages = await MessagesDB.getByChatId(chat.id);
    await syncChat(chat, messages);
    stats.chats++;
  }
  
  // 同步社交平台
  await syncInstagram();
  await syncTwitter();
  await syncFacebook();
  await syncWeverse();
  await syncLofter();
  
  return stats;
}
```

### 2. 实体页生成器

```javascript
function generateCharacterPage(character, stats) {
  return {
    id: `char-${character.id}`,
    title: character.name,
    blocks: [
      { type: 'heading1', content: character.name },
      { type: 'text', content: character.description },
      { type: 'heading2', content: '基本資料' },
      { type: 'text', content: `**性格**: ${character.personality}` },
      { type: 'text', content: `**場景**: ${character.scenario}` },
      { type: 'heading2', content: '統計' },
      { type: 'text', content: `- 聊天次數：${stats.chatCount}` },
      { type: 'text', content: `- 社交互動：${stats.socialCount}` },
    ],
    icon: '👤',
    syncSource: 'characters',
    sourceId: character.id
  };
}
```

### 3. 聊天摘要生成器（可选用 LLM）

```javascript
async function generateChatSummary(chat, messages) {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  // 简单摘要：取前几条消息
  const summary = messages.slice(0, 5)
    .map(m => m.content.substring(0, 100))
    .join('...');
  
  return {
    id: `chat-${chat.id}`,
    title: `${formatDate(chat.created_at)} - 與 ${chat.character_name} 的對話`,
    blocks: [
      { type: 'text', content: summary },
      ...messages.slice(0, 10).map(m => ({
        type: 'text',
        content: `**${m.role}**: ${m.content.substring(0, 200)}`
      }))
    ],
    linkedEntities: [chat.character_name],
    sourceType: 'chat',
    sourceId: chat.id
  };
}
```

### 4. 增量同步

```javascript
// 存储上次同步时间戳
let lastSync = await SettingsDB.get('wiki_last_sync');

async function incrementalSync() {
  const characters = await CharactersDB.getAll();
  for (const char of characters) {
    const existingPage = pages.find(p => 
      p.syncSource === 'characters' && p.sourceId === char.id
    );
    if (!existingPage) {
      await syncCharacter(char);
    }
  }
  // ... 其他数据源
}
```

---

## 设定页面更新

新增同步配置：
- **自动同步**: 开/关
- **同步频率**: 每次/每日/手动
- **LLM 摘要**: 使用 AI 生成摘要（需要 API）

---

## 数据存储扩展

新增 IndexedDB 键：
- `wiki_sync_state`: 同步状态（{lastSync, stats}）
- `wiki_entity_index`: 实体索引（快速查找）
- `wiki_relation_graph`: 关系图缓存

---

## 实现步骤

1. **创建 sync.js 模块**
   - syncAll(), syncCharacter(), syncChat(), syncInstagram() 等
   - 增量同步逻辑

2. **更新 Wiki 设定模态框**
   - 添加同步按钮
   - 显示同步状态

3. **改造 renderSidebar()**
   - 添加分类筛选（角色/聊天/社交）
   - 显示统计数字

4. **创建仪表盘首页**
   - 当没有选择页面时显示概览
   - 最近活动列表

5. **实现自动同步**
   - 应用启动时检查
   - 跨应用事件监听

6. **优化实体页生成**
   - 图片引用
   - 统计实时更新

---

## 风险与限制

1. **数据量**: 大量聊天记录可能导致 IndexedDB 增长
   - 解决：限制摘要长度，原始消息不存储在 wiki

2. **社交平台数据格式不一致**
   - 解决：统一转换层

3. **LLM 摘要成本**
   - 解决：可选功能，默认用简单截取

4. **同步冲突**
   - 解决：最后修改时间戳判断

---

## 验证计划

1. 创建角色 → 检查 wiki/entities/ 是否生成
2. 进行聊天 → 检查 wiki/sources/chats/ 是否生成
3. Instagram 发帖 → 检查 wiki/sources/instagram/ 是否生成
4. 点击角色页 → 检查统计和链接是否正确
5. 搜索功能 → 检查能否搜到所有内容