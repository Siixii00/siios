# Twitter 真實內容來源方案

## 設計理念

根據角色性格自動匹配對應的真實內容來源，確保：
- ✅ 合法：使用公開 API 和 RSS
- ✅ 免費：無需付費 API key
- ✅ 真實：來自真實新聞、文章、討論
- ✅ 相關：符合角色興趣和性格

---

## 內容來源矩陣

### 科技/工程類角色
**關鍵字**：工程師、科技、程式、電腦、技術、開發者、hacker、programmer

**來源**：
1. **Hacker News API** (https://hacker-news.firebaseio.com/v0/)
   - 端點：`/topstories.json` → `/item/{id}.json`
   - 內容：科技新聞、創業故事、技術討論
   - 特色：完全免費、無需認證、JSON API
   
2. **Tech RSS Feeds**
   - TechCrunch: https://techcrunch.com/feed/
   - The Verge: https://www.theverge.com/rss/index.xml
   - Ars Technica: https://feeds.arstechnica.com/arstechnica/index

---

### 新聞/時事類角色
**關鍵字**：記者、新聞、時事、政治、社會、國際、記者

**來源**：
1. **Google News RSS**
   - 端點：https://news.google.com/rss/search?q={topic}
   - 例：科技新聞、國際局勢、財經動態
   - 特色：即時更新、多語言支援

2. **BBC World RSS**
   - https://feeds.bbci.co.uk/news/world/rss.xml

3. **Reuters RSS**
   - https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best

---

### 藝術/設計類角色
**關鍵字**：藝術、設計、畫家、音樂、創作、artist、designer、音樂家

**來源**：
1. **Design RSS**
   - Creative Bloq: https://www.creativebloq.com/feed
   - Design Milk: https://design-milk.com/feed/
   - It's Nice That: https://www.itsnicethat.com/rss

2. **Music News RSS**
   - NME: https://www.nme.com/feed
   - Pitchfork: https://pitchfork.com/feed/rss/al

---

### 科學/研究類角色
**關鍵字**：科學、研究、學者、實驗、物理、化學、生物、scientist、researcher

**來源**：
1. **Science RSS**
   - Science Daily: https://www.sciencedaily.com/rss/all.xml
   - Nature: https://www.nature.com/news.rss
   - Phys.org: https://phys.org/rss-feed/

---

### 遊戲/娛樂類角色
**關鍵字**：遊戲、玩家、動漫、電影、電視、gamer、anime

**來源**：
1. **Gaming RSS**
   - Polygon: https://www.polygon.com/rss/index.xml
   - IGN: https://www.ign.com/rss
   - Kotaku: https://kotaku.com/rss

2. **Entertainment RSS**
   - Entertainment Weekly: https://ew.com/feed/
   - Variety: https://variety.com/feed/

---

### 財經/商業類角色
**關鍵字**：商人、財經、投資、創業、老闆、business、investor、entrepreneur

**來源**：
1. **Business RSS**
   - Bloomberg: https://www.bloomberg.com/feed/podcast/bloomberg-technology.xml
   - Business Insider: https://www.businessinsider.com/rss
   - Forbes: https://www.forbes.com/real-time/feed2/

---

### 文學/閱讀類角色
**關鍵字**：作家、文學、書、閱讀、詩人、writer、author、poet

**來源**：
1. **Books RSS**
   - Book Riot: https://bookriot.com/feed/
   - Goodreads Blog: https://www.goodreads.com/blog/rss

---

### 生活/美食類角色
**關鍵字**：美食、廚師、料理、生活、chef、foodie

**來源**：
1. **Food RSS**
   - Food52: https://food52.com/rss
   - Bon Appétit: https://www.bonappetit.com/feed/rss

---

### 運動/健身類角色
**關鍵字**：運動、健身、體育、運動員、athlete、fitness

**來源**：
1. **Sports RSS**
   - ESPN: https://www.espn.com/espn/rss
   - Bleacher Report: https://bleacherreport.com/rss

---

### 通用/一般角色
**預設來源**（如果無明顯性格特徵）：
- Hacker News（科技導向）
- Google News（綜合新聞）
- Reddit（討論話題）- *用戶不喜歡，可改用其他*

---

## 實作架構

### 1. 角色性格分析器
```javascript
function analyzeCharacterInterests(personality) {
    const keywords = {
        '科技': ['工程師', '科技', '程式', '電腦', '技術', 'hacker', 'programmer'],
        '新聞': ['記者', '新聞', '時事', '政治', '社會', '國際'],
        '藝術': ['藝術', '設計', '畫家', '音樂', '創作', 'artist', 'designer'],
        '科學': ['科學', '研究', '學者', '實驗', 'scientist', 'researcher'],
        '遊戲': ['遊戲', '玩家', '動漫', '電影', 'gamer', 'anime'],
        '財經': ['商人', '財經', '投資', '創業', 'business', 'investor'],
        '文學': ['作家', '文學', '書', '閱讀', 'writer', 'author'],
        '美食': ['美食', '廚師', '料理', 'chef', 'foodie'],
        '運動': ['運動', '健身', '體育', 'athlete', 'fitness']
    };
    
    const personality_lower = personality.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
        if (words.some(word => personality_lower.includes(word))) {
            return category;
        }
    }
    
    return '綜合';
}
```

### 2. 內容抓取器
```javascript
async function fetchRealContent(interestCategory) {
    const sources = {
        '科技': [
            { type: 'hackernews', url: 'https://hacker-news.firebaseio.com/v0/topstories.json' },
            { type: 'rss', url: 'https://techcrunch.com/feed/' }
        ],
        '新聞': [
            { type: 'rss', url: 'https://news.google.com/rss' },
            { type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
        ],
        // ... 其他類別
    };
    
    const selectedSources = sources[interestCategory] || sources['綜合'];
    
    // 嘗試每個來源，失敗則換下一個
    for (const source of selectedSources) {
        try {
            if (source.type === 'hackernews') {
                return await fetchHackerNews(source.url);
            } else if (source.type === 'rss') {
                return await fetchRSS(source.url);
            }
        } catch (error) {
            console.warn(`[Twitter] Source ${source.url} failed:`, error);
            continue;
        }
    }
    
    return [];
}
```

### 3. Hacker News 抓取邏輯
```javascript
async function fetchHackerNews(url) {
    const storyIds = await (await fetch(url)).json();
    const topStoryIds = storyIds.slice(0, 10); // 取前 10 篇
    
    const stories = await Promise.all(
        topStoryIds.map(id => 
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
                .then(res => res.json())
        )
    );
    
    return stories.map(story => ({
        title: story.title,
        url: story.url,
        author: story.by,
        score: story.score,
        source: 'Hacker News'
    }));
}
```

### 4. RSS 抓取邏輯
```javascript
async function fetchRSS(url) {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const items = xml.querySelectorAll('item');
    const entries = [];
    
    items.forEach(item => {
        entries.push({
            title: item.querySelector('title')?.textContent,
            url: item.querySelector('link')?.textContent,
            author: item.querySelector('author')?.textContent || 'Unknown',
            source: url
        });
    });
    
    return entries.slice(0, 10);
}
```

---

## GitHub Actions 排程

### 每小時抓取流程
```yaml
name: Fetch Real Twitter Content

on:
  schedule:
    - cron: '0 * * * *'  # 每小時執行
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Fetch content
        run: node scripts/fetch-twitter-content.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git commit -m "chore: update Twitter content cache" || echo "No changes"
          git push
```

---

## 內容轉換為推文

### AI 風格轉換
```javascript
async function convertToTweetStyle(content, character) {
    const prompt = `你是角色「${character.name}」，性格：${character.personality}

請將以下真實新聞/文章轉換為一條推特推文（140字以內），保持你的角色性格：

標題：${content.title}
來源：${content.source}

要求：
1. 用你的口吻和語氣表達
2. 可以加入你的看法或情感
3. 符合你的性格特點
4. 自然、真實、有趣

直接輸出推文內容：`;

    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.api_key}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.8
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}
```

---

## 實作步驟

### Phase 1：基礎架構（1-2 天）
1. 建立 `fetch-twitter-content.js` 腳本
2. 實作 Hacker News API 抓取
3. 實作 RSS feed 解析
4. 加入錯誤處理與 fallback

### Phase 2：角色匹配（1 天）
1. 建立 `analyzeCharacterInterests()` 函式
2. 建立內容來源矩陣
3. 實作智能匹配邏輯

### Phase 3：GitHub Actions（半天）
1. 建立 `.github/workflows/twitter-content.yml`
2. 設定定時排程
3. 測試自動提交

### Phase 4：整合（1 天）
1. 修改 `generateRecommendedTweets()` 使用真實內容
2. AI 風格轉換
3. 測試完整流程

---

## 優勢分析

### 對比純 AI 生成

| 項目 | 純 AI 生成 | 真實內容 + AI 轉換 |
|------|-----------|-------------------|
| 真實性 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 時效性 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 角色一致性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 內容多樣性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 合法性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 成本 | $$ | $ |

### 成本估算
- 純 AI：每次刷新 2 次 API call → $0.02-0.05
- 真實內容：每條推文 1 次 AI call（風格轉換）→ $0.01-0.02
- **節省約 50%**

---

## 法律合規性

### ✅ 完全合法
- Hacker News API：官方提供，完全公開
- RSS feeds：標準協議，網站主動提供
- 新聞標題：合理使用（fair use）
- AI 轉換：創作衍生內容

### ⚠️ 注意事項
- 不抓取完整文章內容（只抓標題）
- 不複製版權圖片
- 標註原始來源
- 不用於商業用途

---

## 未來擴展

1. **更多來源**：加入 RSS 聯播網
2. **智慧過濾**：根據角色年齡過濾不當內容
3. **本地快取**：避免重複抓取
4. **使用者自訂**：允許用戶加入自己的 RSS 來源
5. **多語言支援**：根據角色語言抓取對應來源