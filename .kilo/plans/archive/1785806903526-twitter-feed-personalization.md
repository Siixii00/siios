# Twitter 推薦內容實作計畫

## 目標
根據使用者選擇的角色/面具，結合聊天記憶、角色設定，透過 AI 生成個人化的推特推薦內容。

## 核心設計決策

### 1. 角色定位：我是誰
- 選擇的角色/面具是「使用者的身份」
- 推文來自其他 NPC，推薦内容是「這個角色會感興趣的内容」
- 不是 AI 代理發推，而是從該角色視角瀏覽 Twitter

### 2. NPC 來源：CharactersDB + UsersDB
- NPC 來自兩個資料庫的角色/面具
- 根據記憶分析推断追蹤關係

### 3. 追蹤關係：AI 分析記憶推断
- 第一階段：AI 分析 MemoryDB 推断適合的追蹤對象
- 備用方案：使用 `assigned_chars` 欄位（如果無記憶）
- 記憶範圍：讀取系統全部記憶，找出與該角色相關的内容

### 4. API 調用策略：兩次調用
- 第一次調用：AI 分析記憶，推断追蹤關係（結果快取）
- 第二次調用：根據追蹤對象生成推文内容
- 原因：快取追蹤關係降低成本，每次刷新都重新生成推文

### 5. 觸發方式：下拉刷新
- 實作 Pull-to-Refresh 手勢
- 下拉觸發載入動畫
- 生成新推文並插入到 Feed 頂部

## 實作步驟

### Step 1：角色 ID 解析工具函式
**檔案**：`js/apps/twitter/index.js`

1. 新增 import：`ChatsDB`, `MemoryDB` from `'../../db.js'`
2. 建立 `getCharacterContext(characterId)`：
   - 解析 `user_{id}` 或 `char_{id}` 前綴
   - 從 UsersDB 或 CharactersDB 取得角色資料
   - 返回統一的角色物件

### Step 2：AI 分析記憶推断追蹤關係
**檔案**：`js/apps/twitter/index.js`

建立 `inferFollowingFromMemory(selectedCharacterId)`：
1. 取得角色脈絡（`getCharacterContext`）
2. 讀取所有聊天記錄（ChatsDB.getAll）
3. 篩選角色相關聊天（by character_name 匹配角色名稱）
4. 讀取這些聊天的記憶（MemoryDB.getByChatId 或篩選 chat_id）
5. 如無記憶，使用 `assigned_chars` 作為備用
6. 建立 AI 分析提示詞，包含記憶片段
7. 調用 API 推断追蹤關係
8. 快取結果（同一角色 5 分鐘有效）
9. 返回追蹤對象列表（NPC 名稱陣列）

### Step 3：生成推薦推文
**檔案**：`js/apps/twitter/index.js`

建立 `generateRecommendedTweets(selectedCharacterId)`：
1. 取得角色脈絡（`getCharacterContext`）
2. 推断追蹤關係（`inferFollowingFromMemory`）
3. 建立推文生成提示詞（包含角色性格、記憶、追蹤對象）
4. 調用 API 生成 5-10 條推文
5. 為每條推文生成互動資料（按讚、回覆、轉發數）
6. 返回推文陣列

### Step 4：下拉刷新 UI 實作
**檔案**：`js/apps/twitter/index.js` 和 `js/apps/twitter/style.css`

1. 在 `renderFeed` 容器加入觸控事件監聽
2. 實作下拉指示器 UI
3. 觸發 `refreshFeed()` 函式
4. 顯示載入動畫
5. 生成完成後更新 Feed

### Step 5：整合到現有流程
**檔案**：`js/apps/twitter/index.js`

1. 修改 `renderFeed` 支援下拉刷新
2. 儲存生成的推文到 `npcTweets`
3. 確保與現有推文合併邏輯兼容
4. 更新書籤、通知等相關功能

## 技術細節

### 角色ID解析
```javascript
async function getCharacterContext(characterId) {
    if (!characterId) return null;
    
    if (characterId.startsWith('user_')) {
        const userId = characterId.replace('user_', '');
        return await UsersDB.getById(userId);
    }
    
    if (characterId.startsWith('char_')) {
        const charId = characterId.replace('char_', '');
        return await CharactersDB.getById(charId);
    }
    
    return null;
}
```

### AI 分析記憶推断追蹤關係
```javascript
const followingCache = new Map(); // 快取追蹤關係

async function inferFollowingFromMemory(selectedCharacterId) {
    // 檢查快取
    const cached = followingCache.get(selectedCharacterId);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.following;
    }
    
    const character = await getCharacterContext(selectedCharacterId);
    if (!character) return [];
    
    // 透過聊天記錄找相關記憶
    const allChats = await ChatsDB.getAll();
    const relevantChats = allChats.filter(chat => 
        chat.character_name === character.name
    );
    
    const allMemories = await MemoryDB.getAll();
    const relevantMemories = allMemories.filter(m => 
        relevantChats.some(chat => chat.id === m.chat_id)
    ).slice(0, 20); // 限制記憶數量
    
    if (relevantMemories.length === 0) {
        // 備用方案：使用 assigned_chars
        const fallback = character?.assigned_chars || [];
        followingCache.set(selectedCharacterId, { 
            following: fallback, 
            timestamp: Date.now() 
        });
        return fallback;
    }
    
    const memoryText = relevantMemories.map(m => 
        `${m.content?.slice(0, 200)}`
    ).join('\n');
    
    const prompt = `分析以下記憶片段，推断這個使用者會追蹤哪些人：

使用者：${character.name || '匿名'}
性格：${character.personality || ''}

記憶片段：
${memoryText}

請输出 3-5 個最適合的追蹤對象名稱，以 JSON 陣列格式：
["角色名稱1", "角色名稱2", ...]`;

    const settings = await SettingsDB.getAll();
    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.api_key}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.7
        })
    });
    
    const data = await response.json();
    const following = JSON.parse(data.choices[0].message.content);
    
    // 快取結果
    followingCache.set(selectedCharacterId, { 
        following, 
        timestamp: Date.now() 
    });
    
    return following;
}
```

### 推薦推文生成 API 調用
```javascript
async function generateRecommendedTweets(selectedCharacterId) {
    const character = await getCharacterContext(selectedCharacterId);
    const following = await inferFollowingFromMemory(selectedCharacterId);
    
    if (following.length === 0) {
        createToast('無追蹤對象，請先設定 assigned_chars');
        return [];
    }
    
    // 取得追蹤對象的性格資料
    const allChars = await CharactersDB.getAll();
    const allUsers = await UsersDB.getAll();
    
    const npcProfiles = following.map(name => {
        const match = allChars.find(c => c.name === name) || 
                      allUsers.find(u => u.name === name);
        return {
            name: name,
            personality: match?.personality || '神秘的角色'
        };
    });
    
    const npcDesc = npcProfiles.map(n => 
        `${n.name}（性格：${n.personality}）`
    ).join('\n');
    
    const prompt = `你是推薦演算法，根據以下資訊生成推文：

使用者角色：${character?.name || '匿名'}
性格：${character?.personality || ''}

追蹤對象：
${npcDesc}

請為每個追蹤對象生成 1-2 條推文，内容需符合發文者的性格。

輸出 JSON 陣列格式：
[
  {
    "author": "發文者名稱",
    "content": "推文内容（140字以內）",
    "stats": { "reply": 數字, "retweet": 數字, "like": 數字 }
  }
]`;

    const settings = await SettingsDB.getAll();
    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.api_key}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.9
        })
    });
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}
```

### 下拉刷新 UI
```javascript
// CSS - 下拉指示器
.pull-indicator {
    position: fixed;
    top: calc(44px + env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%) translateY(-60px);
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    z-index: 100;
    background: var(--twitter-bg);
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.pull-indicator.active {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

// JavaScript - 整個頁面的下拉刷新
let startY = 0;
let pulling = false;
const THRESHOLD = 80;
const twitterApp = container.querySelector('.twitter-app') || container;

function handleTouchStart(e) {
    const scrollTop = twitterApp.scrollTop || document.documentElement.scrollTop;
    if (scrollTop === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
    }
}

function handleTouchMove(e) {
    if (!pulling) return;
    const deltaY = e.touches[0].pageY - startY;
    if (deltaY > 0) {
        e.preventDefault();
        pullIndicator.classList.toggle('active', deltaY > 20);
    }
}

async function handleTouchEnd(e) {
    if (!pulling) return;
    const deltaY = e.changedTouches[0].pageY - startY;
    pulling = false;
    pullIndicator.classList.remove('active');
    
    if (deltaY > THRESHOLD) {
        if (!selectedCharacterId) {
            await openCharacterMenu();
            return;
        }
        await refreshFeed();
    }
}

twitterApp.addEventListener('touchstart', handleTouchStart, { passive: true });
twitterApp.addEventListener('touchmove', handleTouchMove, { passive: false });
twitterApp.addEventListener('touchend', handleTouchEnd);

async function refreshFeed() {
    pullIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 載入中...';
    pullIndicator.classList.add('active');
    
    try {
        const tweets = await generateRecommendedTweets(selectedCharacterId);
        tweets.forEach(tweet => {
            npcTweets.unshift({
                id: Date.now().toString() + Math.random(),
                author: tweet.author,
                handle: `@${tweet.author.toLowerCase().replace(/\s+/g, '_')}`,
                content: tweet.content,
                stats: tweet.stats,
                timestamp: Date.now()
            });
        });
        await saveNpcTweets();
        
        const feed = document.querySelector('.feed');
        if (feed) {
            feed.innerHTML = '';
            await renderFeed(feed);
        }
        
        createToast('推薦内容已更新');
    } catch (error) {
        console.error('[Twitter] 刷新失敗:', error);
        createToast('更新失敗，請稍後再試');
    } finally {
        pullIndicator.innerHTML = '<i class="fas fa-arrow-down"></i> 下拉刷新';
        pullIndicator.classList.remove('active');
    }
}
```

## 驗證計畫

### 功能測試
1. 選擇 user 面具 → 下拉刷新 → 確認推文來自相關 NPC
2. 選擇 char 角色 → 下拉刷新 → 確認推文來自相關 NPC
3. 切換角色 → 下拉刷新 → 確認推文内容改變
4. 無記憶的角色 → 確認使用 assigned_chars 作為備用

### 邊界情況
1. 未選擇角色 → 下拉時彈出角色選擇選單，選擇後才刷新
2. 無 API 設定 → 顯示錯誤提示
3. 網路錯誤 → 顯示錯誤提示，不影響現有推文
4. 空記憶 + 空 assigned_chars → 顯示空狀態

### 效能測試
1. 下拉刷新響應時間 < 15 秒（兩次 API 調用）
2. 不阻塞 UI 交互（使用 async/await）
3. 記憶查詢效能：MemoryDB.getAll() 在大量記憶下的效能

## 風險與限制

### API 成本與延遲
- 首次下拉刷新：2 次 API 調用（分析記憶 + 生成推文）
- 後續刷新（5 分鐘內）：1 次 API 調用（只生成推文，追蹤關係已快取）
- 預估延遲：首次 5-15 秒，後續 3-8 秒

### Token 限制
- 記憶片段最多 20 條，每條最多 200 字元
- 總提示詞長度控制在 2000 token 以内
- 建議：監控 token 使用量，必要時進一步縮减

### 記憶隱私
- 讀取系統全部記憶可能包含敏感資訊
- 建議：實作記憶篩選機制，只讀取相關記憶

### NPC 一致性
- 生成的 NPC 推文可能與實際聊天中的 NPC 性格不一致
- 建議：在提示詞中加入 NPC 的性格描述

## 未來擴展

1. **快取機制**：生成的推文暫存 5 分鐘，避免重複調用 API
2. **真實 Twitter 整合**：當取得 API key 後，混合真實推文
3. **手動調整追蹤**：在漢堡選單中提供編輯追蹤關係的功能
4. **互動生成**：除了推文，也生成 NPC 對推文的回覆、轉發
