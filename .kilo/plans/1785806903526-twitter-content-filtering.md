# Twitter 內容過濾與 AI 關鍵字擴充

## 🛡️ 內容過濾機制

### 禁止話題清單

#### 1. 人身攻擊與仇恨言論
```javascript
const BLOCKED_KEYWORDS = [
    'racist', 'racism', 'sexist', 'sexism', 
    'nazi', 'hitler', 'holocaust',
    'terrorist', 'terrorism', 'isis',
    'pedophile', 'pedophilia',
    'suicide', 'kill yourself',
    'hate speech', 'discrimination',
    'kkk', 'white supremacy',
    'genocide', 'ethnic cleansing',
    '人身攻擊', '仇恨言論', '種族歧視',
    '性別歧視', '暴力', '恐怖主義',
    '納粹', '種族滅絕'
];
```

**過濾內容**：
- ❌ 種族歧視言論
- ❌ 性別歧視內容
- ❌ 恐怖主義相關
- ❌ 暴力與仇恨言論
- ❌ 歷史敏感話題（納粹、大屠殺）

#### 2. 敏感政治議題
```javascript
const SENSITIVE_POLITICS = [
    'election fraud', 'rigged election',
    'conspiracy theory', 'deep state',
    'qanon', 'pizzagate',
    'antifa', 'blm riots',
    'capitol riot', 'insurrection',
    'impeach', 'impeachment',
    'trump 2024', 'biden crime family',
    'fake news', 'mainstream media lies',
    '選舉舞弊', '陰謀論', '政治鬥爭',
    '政變', '煽動', '暴動'
];
```

**過濾內容**：
- ❌ 選舉舞弊指控
- ❌ 陰謀論（QAnon、Pizzagate 等）
- ❌ 政治極端言論
- ❌ 煽動性政治內容
- ❌ 假新聞相關話題

---

## 🔍 過濾邏輯

### 函式實作

```javascript
function isContentBlocked(title) {
    const titleLower = title.toLowerCase();
    
    // 檢查仇恨言論
    for (const keyword of BLOCKED_KEYWORDS) {
        if (titleLower.includes(keyword.toLowerCase())) {
            console.warn(`[Twitter] 阻擋敏感內容: "${title}" (關鍵字: ${keyword})`);
            return true;
        }
    }
    
    // 檢查政治敏感
    for (const keyword of SENSITIVE_POLITICS) {
        if (titleLower.includes(keyword.toLowerCase())) {
            console.warn(`[Twitter] 阻擋政治敏感內容: "${title}" (關鍵字: ${keyword})`);
            return true;
        }
    }
    
    return false;
}
```

### 應用時機

1. **Hacker News 抓取**
   ```javascript
   const validStories = stories.filter(s => !isContentBlocked(s.title));
   ```

2. **RSS 解析**
   ```javascript
   if (!isContentBlocked(title)) {
       items.push({ title, url, source });
   }
   ```

3. **Steam 新聞**
   ```javascript
   if (!isContentBlocked(title)) {
       items.push({ title, url, source: 'Steam News' });
   }
   ```

---

## 🤖 擴充 AI 關鍵字

### 新增關鍵字類別

#### 1. 語音與音訊 AI
```javascript
'text to speech', 'tts', 'speech synthesis', 'voice cloning',
'voice recognition', 'speech to text', 'stt',
'whisper', 'musicgen', 'audio generation', 'audiocraft'
```

**涵蓋領域**：
- 🎤 語音合成（TTS）
- 🎵 音訊生成（MusicGen, AudioCraft）
- 🗣️ 語音識別（Whisper）
- 🔊 聲音克隆技術

#### 2. 影像與影片生成
```javascript
'stable diffusion', 'midjourney', 'dall-e', 'image generation',
'sora', 'runway', 'pika', 'video generation',
'diffusion model'
```

**涵蓋領域**：
- 🎨 圖像生成（Stable Diffusion, Midjourney, DALL-E）
- 🎬 影片生成（Sora, Runway, Pika）
- 🌈 擴散模型技術

#### 3. 模型架構與技術
```javascript
'embedding', 'transformer', 'bert', 
'reinforcement learning', 'gan', 'autoencoder',
'fine-tuning', 'multimodal', 'rag',
'vision language model', 'vlm'
```

**涵蓋領域**：
- 🧠 模型架構（Transformer, BERT, GAN）
- 🎯 訓練技術（Fine-tuning, RAG）
- 🖼️ 多模態模型（VLM）

#### 4. AI 公司與產品
```javascript
'langchain', 'hugging face', 'anthropic', 'mistral',
'gemini', 'copilot', 'codex'
```

**涵蓋領域**：
- 🏢 AI 公司（Anthropic, Mistral, Hugging Face）
- 💼 AI 產品（Gemini, Copilot, Codex）

#### 5. AI 應用領域
```javascript
'nlp', 'computer vision', 'prompt engineering',
'retro', 'retro'
```

**涵蓋領域**：
- 📝 自然語言處理（NLP）
- 👁️ 電腦視覺（Computer Vision）
- ✨ 提示工程（Prompt Engineering）

---

## 📊 完整 AI 關鍵字清單

### 分類總覽

| 類別 | 關鍵字數量 | 範例 |
|------|-----------|------|
| 核心技術 | 10+ | AI, LLM, GPT, Neural |
| 語音與音訊 | 10+ | TTS, Speech Synthesis, Whisper |
| 影像與影片 | 10+ | Stable Diffusion, Midjourney, Sora |
| 模型架構 | 10+ | Transformer, BERT, GAN, Diffusion |
| AI 公司 | 8+ | OpenAI, Anthropic, Mistral, Hugging Face |
| 應用領域 | 8+ | NLP, Computer Vision, Prompt Engineering |

### 總計：50+ AI 相關關鍵字

---

## ✅ 過濾測試結果

### 測試案例

```javascript
Test 1: "How AI is changing the world" 
→ ✅ 通過（無敏感內容）

Test 2: "Racist policies in tech"
→ ❌ 阻擋（包含 'racist'）

Test 3: "Election fraud claims spread online"
→ ❌ 阻擋（包含 'election fraud'）

Test 4: "New AI model released by OpenAI"
→ ✅ 通過（正常的 AI 新聞）
```

---

## 🔧 實作細節

### 抓取流程更新

**Before**:
```javascript
const topIds = storyIds.slice(0, 10);
```

**After**:
```javascript
const topIds = storyIds.slice(0, 15);  // 增加抓取數量

const validStories = stories.filter(s => !isContentBlocked(s.title));
// 過濾後返回前 5 則
```

**原因**：
- 預留過濾空間
- 確保有足夠的有效內容
- 提升內容品質

### Console 警告

當阻擋內容時，會輸出詳細日誌：
```
[Twitter] 阻擋敏感內容: "Racist policies..." (關鍵字: racist)
[Twitter] 阻擋政治敏感內容: "Election fraud..." (關鍵字: election fraud)
```

---

## 🎯 設計理念

### 為什麼需要內容過濾？

1. **用戶安全** - 避免接觸仇恨言論
2. **產品責任** - 防止傳播有害內容
3. **法律合規** - 符合內容審查規範
4. **用戶體驗** - 提供正向的內容環境

### 平衡點

**過濾原則**：
- ✅ 過濾明確的有害內容
- ✅ 避免極端政治言論
- ❌ 不過度審查
- ❌ 不影響正常新聞

**保留內容**：
- ✅ 科技新聞
- ✅ AI 發展動態
- ✅ 遊戲資訊
- ✅ 科學研究

---

## 📈 效益分析

### 對用戶的好處

| 項目 | 效益 |
|------|------|
| 安全性 | 避免仇恨言論傷害 |
| 體驗 | 內容環境更正向 |
| 教育 | AI 關鍵字更全面 |

### 對產品的好處

| 項目 | 效益 |
|------|------|
| 合規性 | 符合內容審查標準 |
| 品質 | 提升內容品質 |
| 品牌形象 | 展現社會責任 |

---

## 🚀 未來擴充建議

### Phase 2 建議

1. **用戶自訂過濾**
   - 允許用戶添加個人不想看的關鍵字
   - 個性化內容過濾

2. **AI 內容分級**
   - 標記敏感內容等級
   - 提供家長控制選項

3. **多語言支援**
   - 擴充日文、韓文等敏感詞庫
   - 全球化內容過濾

4. **動態更新**
   - 定期更新過濾關鍵字
   - 根據時事調整敏感詞

---

## 📝 維護指南

### 新增過濾關鍵字

```javascript
// 在 BLOCKED_KEYWORDS 或 SENSITIVE_POLITICS 陣列中新增
const BLOCKED_KEYWORDS = [
    // ... 現有關鍵字
    '新增關鍵字1',
    '新增關鍵字2'
];
```

### 新增 AI 關鍵字

```javascript
// 在 aiKeywords 陣列中新增
const aiKeywords = [
    // ... 現有關鍵字
    '新 AI 技術',
    '新 AI 公司'
];
```

### 測試過濾效果

```javascript
// 使用 Node.js 測試
node -e "const { isContentBlocked } = require('./path/to/file'); console.log(isContentBlocked('測試標題'));"
```

---

## ✅ 完成狀態

- ✅ 人身攻擊與仇恨言論過濾
- ✅ 敏感政治議題過濾
- ✅ AI 關鍵字擴充（50+ 關鍵字）
- ✅ 語音合成相關關鍵字
- ✅ 影像生成相關關鍵字
- ✅ 過濾邏輯測試通過
- ✅ Console 警告機制

**下一步**: 持續監控過濾效果，根據實際情況調整關鍵字清單。