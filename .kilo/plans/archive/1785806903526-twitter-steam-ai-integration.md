# Twitter 真實內容來源 - 擴充版本

## 🎮 新增功能

### 1. Steam 遊戲推薦
- **來源**: Steam 官方新聞 RSS
- **URL**: `https://store.steampowered.com/feeds/news.xml`
- **觸發關鍵字**: 遊戲、玩家、Steam
- **內容**: 遊戲更新、新上架、特價活動

### 2. AI 發展追蹤
- **來源**: Hacker News (AI 相關標籤)
- **篩選關鍵字**: AI, LLM, GPT, Machine Learning, Neural, Chatbot, OpenAI, Claude
- **觸發方式**:
  - 角色性格包含「AI、機器學習、智能」等關鍵字
  - **30% 隨機機率**混入 AI 內容給所有用戶

### 3. GitHub 開源推薦
- **來源**: GitHub Blog RSS
- **URL**: `https://github.blog/feed/`
- **觸發關鍵字**: GitHub、開源、open source
- **內容**: GitHub 功能更新、開源專案推薦

---

## 📊 完整內容來源矩陣

| 類別 | 關鍵字 | 來源 | URL |
|------|--------|------|-----|
| 科技 | 工程師、科技、程式 | Hacker News | `hacker-news.firebaseio.com/v0/topstories.json` |
| 新聞 | 記者、新聞、時事 | BBC World | `feeds.bbci.co.uk/news/world/rss.xml` |
| 藝術 | 藝術、設計、音樂 | Creative Bloq | `creativebloq.com/feed` |
| 科學 | 科學、研究、實驗 | Science Daily | `sciencedaily.com/rss/all.xml` |
| 遊戲 | 遊戲、玩家、Steam | Steam News + Polygon | `store.steampowered.com/feeds/news.xml` |
| AI | AI、機器學習、智能 | Hacker News (AI filtered) | 同科技類別 + 關鍵字篩選 |
| GitHub | GitHub、開源 | GitHub Blog | `github.blog/feed/` |

---

## 🔍 AI 內容篩選邏輯

```javascript
if (category === 'AI') {
    const aiKeywords = ['ai', 'llm', 'gpt', 'machine learning', 'neural', 
                         'chatbot', 'openai', 'claude', 'deep learning'];
    
    const aiStories = stories.filter(s => 
        aiKeywords.some(k => s.title.toLowerCase().includes(k))
    );
    
    return aiStories.length > 0 ? aiStories : stories.slice(0, 5);
}
```

**效果**：
- 從 Hacker News 前 10 名中篩選 AI 相關文章
- 如果無 AI 相關內容，返回前 5 則科技新聞
- 確保用戶能看到最新的 AI 發展

---

## 🎲 隨機 AI 推薦機制

### 實作邏輯

```javascript
const shouldAddAIContent = Math.random() < 0.3;
if (shouldAddAIContent && interestCategory !== 'AI') {
    const aiContent = await fetchRealContentForCategory('AI');
    realContent = [...realContent, ...aiContent.slice(0, 2)];
}
```

### 設計理念

**為什麼要隨機推薦 AI 內容？**

1. **教育意義** - 讓用戶接觸 AI 發展，理解 AI 如何影響世界
2. **產品特性** - 本應用大量使用 AI，讓用戶了解背後技術
3. **平衡體驗** - 不是每個角色都與 AI 相關，但所有用戶都應有機會接觸
4. **自然融入** - 30% 機率避免過度干擾，保持內容多樣性

### 範例場景

**角色**: 藝術家小美（興趣類別：藝術）

**正常情況**：
- 5 則藝術相關新聞

**30% 隨機加入 AI**：
- 5 則藝術相關新聞
- **+ 2 則 AI 相關新聞**（如："OpenAI 發布 DALL-E 3"、"AI 繪圖工具比較"）

**效果**：藝術家角色可能會分享：
- 「看到 AI 繪圖工具越來越厲害，身為藝術家心情有點複雜...」
- 「這個 AI 藝術生成模型真的太美了！」

---

## 🎮 Steam 內容整合

### 抓取邏輯

```javascript
else if (endpoint.includes('steampowered.com')) {
    const response = await fetch(endpoint);
    const text = await response.text();
    
    const matches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
    let count = 0;
    
    for (const match of matches) {
        if (count >= 5) break;
        
        const item = match[1];
        const titleMatch = itemText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = itemText.match(/<link>(.*?)<\/link>/);
        
        if (titleMatch && linkMatch) {
            items.push({
                title: titleMatch[1].trim(),
                url: linkMatch[1].trim(),
                source: 'Steam News'
            });
            count++;
        }
    }
    
    return items;
}
```

### 內容類型

- 🎮 遊戲更新公告
- 🔥 熱門遊戲推薦
- 💰 特價活動通知
- 🆕 新遊戲上架

---

## 📈 效益分析

### 對用戶的好處

| 項目 | 效益 |
|------|------|
| **遊戲玩家** | 即時獲得 Steam 遊戲資訊 |
| **AI 研究者** | 追蹤最新 AI 發展動態 |
| **開發者** | 了解 GitHub 開源生態 |
| **一般用戶** | 30% 機率接觸 AI 新知 |

### 對產品的好處

1. **提升教育價值** - 讓用戶理解 AI 技術
2. **增加內容多樣性** - 不侷限於單一領域
3. **強化產品特色** - 突顯 AI 應用特性
4. **培養用戶認知** - 建立對 AI 的正確認知

---

## 🔧 技術實作細節

### Steam RSS 解析

**挑戰**: Steam RSS 使用 `<![CDATA[]]>` 包裹標題

**解決方案**:
```javascript
const titleMatch = itemText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
```

### AI 關鍵字篩選

**挑戰**: Hacker News 沒有分類 API

**解決方案**:
- 抓取 top 10 stories
- 用關鍵字篩選 title
- 失敗時 fallback 到前 5 則

### 隨機混入機制

**挑戰**: 如何自然地加入 AI 內容

**解決方案**:
- 30% 隨機機率
- 只在非 AI 類別時觸發
- 混入 2 則 AI 新聞（不影響主要內容）

---

## 🎯 未來擴展建議

### Phase 1（已完成）
- ✅ Steam 遊戲新聞
- ✅ Hacker News AI 篩選
- ✅ GitHub Blog RSS
- ✅ 30% 隨機 AI 推薦

### Phase 2（建議）
- 🔄 加入 r/MachineLearning RSS
- 🔄 加入 AI 研究論文推薦
- 🔄 Steam 特價遊戲專區（API）
- 🔄 GitHub Trending 抓取

### Phase 3（進階）
- 📚 AI 學習資源推薦（課程、書籍）
- 🛠️ AI 工具推薦（根據用戶類型）
- 📊 AI 發展時間軸（重要里程碑）
- 🌟 開源專案推薦（根據興趣）

---

## 📝 使用範例

### 範例 1：遊戲玩家

**角色**: 小明（遊戲玩家）

**抓取內容**:
```
1. Steam 新遊戲上架：Baldur's Gate 3
2. Steam 週末特價：30% off
3. Polygon: 2026 年度最佳遊戲
4. [隨機] OpenAI 發布 GPT-5
5. [隨機] AI 在遊戲 NPC 中的應用
```

**生成推文**:
- "Baldur's Gate 3 終於上了！立馬加入願望清單 🔥"
- "看到 AI NPC 的應用，未來的 RPG 遊戲會更有趣吧..."

### 範例 2：AI 研究者

**角色**: 小華（AI 工程師）

**抓取內容**:
```
1. "LLMs reward expertise"
2. "OpenAI announces GPT-5"
3. "DeepMind's new reinforcement learning approach"
4. "Ten advances in mathematics and theoretical computer science"
5. "Claude 3.5 Sonnet performance benchmarks"
```

**生成推文**:
- "剛看完 LLMs reward expertise 這篇，對於 prompt engineering 很有啟發！"
- "GPT-5 出了！趕快來測試看看..."

### 範例 3：藝術家（隨機 AI）

**角色**: 小美（藝術家）

**正常內容**:
```
1. "Pepsi shades Coca-Cola in parody rebrand"
2. "Those biceps on The Odyssey poster aren't Matt Damon's"
```

**30% 隨機加入**:
```
3. "AI art generator creates controversy in art community"
4. "DALL-E 3 can now generate photorealistic images"
```

**生成推文**:
- "看到 AI 藝術生成器的討論，身為藝術家覺得科技發展真的很快..."
- "DALL-E 3 的效果越來越驚人，但也讓我思考藝術的價值在哪裡..."

---

## ✅ 完成狀態

- ✅ Steam RSS 整合
- ✅ Hacker News AI 篩選
- ✅ GitHub Blog RSS
- ✅ 30% 隨機 AI 推薦
- ✅ 角色性格匹配邏輯更新
- ✅ 測試驗證通過

**下一步**: 部署到生產環境，觀察用戶反應並調整 AI 推薦比例。