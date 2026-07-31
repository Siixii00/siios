# B 站影片播放適配計劃

## 目標

在 PWA 環境下實現 B 站影片的流暢播放，支援：
1. 外部開啟（跳轉 B 站 App/瀏覽器）
2. 內嵌播放（需要 B 站帳號登入）

---

## 架構設計

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│   PWA 前端      │ <---> │   Node.js 後端   │ <---> │   B 站 API  │
│                 │      │   (Serverless)   │      │             │
│ - 播放選項卡片  │      │ - OAuth 登入代理 │      │ - 用戶認證  │
│ - 登入狀態管理  │      │ - Cookie 加密儲存│      │ - 影片資訊  │
│ - 原生播放器    │      │ - API 轉發       │      │ - 播放地址  │
└─────────────────┘      └──────────────────┘      └─────────────┘
```

---

## 用戶流程

### 首次使用（選擇內嵌播放）

1. 用戶點擊影片 → 顯示播放選項卡片：
   - 「在 B 站觀看」（推薦）
   - 「在 PWA 內播放」
2. 選擇「在 PWA 內播放」→ 檢測登入狀態
3. 未登入 → 顯示「需要登入 B 站」
4. 點擊「登入 B 站」→ 後端生成 OAuth URL
5. 跳轉到 B 站登入頁 → 用戶輸入帳密/掃碼
6. B 站回調到後端 → 後端獲取並加密儲存 cookie
7. 重定向回 PWA → 開始播放

### 已登入用戶

1. 點擊影片 → 顯示播放選項卡片
2. 選擇「在 PWA 內播放」→ 調用後端 API
3. 後端驗證用戶身份 → 獲取影片播放地址
4. 前端接收播放地址 → 原生播放器播放

### 外部開啟（降級方案）

1. 點擊影片 → 顯示播放選項卡片
2. 選擇「在 B 站觀看」→ 嘗試喚起 B 站 App
3. 失敗則跳轉到 B 站網頁版

---

## 技術實現

### 1. 後端 API 設計

**新增檔案：** `server/index.js`

```
POST /api/bilibili/auth/login
  - 生成 OAuth 登入 URL
  - 返回：{ loginUrl, state }

GET /api/bilibili/auth/callback
  - 處理 B 站 OAuth 回調
  - 獲取並儲存 cookie
  - 重定向回 PWA

GET /api/bilibili/auth/status
  - 檢查用戶登入狀態
  - 需要 GitHub token 驗證
  - 返回：{ isLoggedIn, username? }

POST /api/bilibili/auth/logout
  - 清除用戶的 B 站 cookie

GET /api/bilibili/video/info?bvid=xxx
  - 獲取影片資訊
  - 返回：{ title, cover, duration, cid, pages }

GET /api/bilibili/video/playurl?bvid=xxx&cid=xxx
  - 獲取影片播放地址
  - 需要用戶已登入
  - 返回：{ qualities: [{ id, url }] }
```

### 2. 前端修改

**修改檔案：** `js/apps/bilibili/index.js`

#### renderPlayer 修改

```javascript
async function renderPlayer(params) {
    const title = decodeURIComponent(params.title || '影片標題');
    const url = decodeURIComponent(params.url || '');
    
    // 顯示播放選項卡片
    const container = createElement('div', 'bili-app');
    
    // 影片預覽卡片
    const previewCard = createVideoPreviewCard(title, url);
    container.appendChild(previewCard);
    
    // 播放選項
    const options = createPlaybackOptions(title, url);
    container.appendChild(options);
    
    return { element: container, cleanup: null };
}

function createPlaybackOptions(title, url) {
    const section = createElement('div', 'bili-playback-options');
    
    // 選項 1：外部開啟（推薦）
    const externalBtn = createElement('button', 'bili-option-btn primary');
    externalBtn.textContent = '在 B 站觀看（推薦）';
    externalBtn.onclick = () => openInBilibili(url);
    section.appendChild(externalBtn);
    
    // 選項 2：內嵌播放
    const embedBtn = createElement('button', 'bili-option-btn');
    embedBtn.textContent = '在 PWA 內播放';
    embedBtn.onclick = async () => {
        const isLoggedIn = await checkBilibiliLogin();
        if (isLoggedIn) {
            playEmbed(title, url);
        } else {
            showLoginPrompt();
        }
    };
    section.appendChild(embedBtn);
    
    return section;
}
```

#### 新增函數

```javascript
// 檢查 B 站登入狀態
async function checkBilibiliLogin() {
    const response = await fetch('/api/bilibili/auth/status', {
        headers: { 'Authorization': `Bearer ${getGithubToken()}` }
    });
    const data = await response.json();
    return data.isLoggedIn;
}

// 喚起 B 站 App 或跳轉網頁
function openInBilibili(url) {
    const bvid = extractBvid(url);
    // 嘗試喚起 App
    const appUrl = `bilibili://video/${bvid}`;
    const webUrl = `https://www.bilibili.com/video/${bvid}`;
    
    // 檢測是否支援 deep link
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
        iframe.remove();
        // 失敗則跳轉網頁
        window.open(webUrl, '_blank');
    }, 500);
}

// 內嵌播放
async function playEmbed(title, url) {
    const bvid = extractBvid(url);
    
    // 1. 獲取影片資訊
    const infoRes = await fetch(`/api/bilibili/video/info?bvid=${bvid}`);
    const info = await infoRes.json();
    
    // 2. 獲取播放地址
    const playRes = await fetch(`/api/bilibili/video/playurl?bvid=${bvid}&cid=${info.cid}`, {
        headers: { 'Authorization': `Bearer ${getGithubToken()}` }
    });
    const playData = await playRes.json();
    
    // 3. 選擇最高畫質
    const videoUrl = playData.qualities[0].url;
    
    // 4. 創建原生播放器
    const player = createNativePlayer(videoUrl, info);
    // 顯示播放器...
}
```

### 3. B 站 API 調用細節

#### 獲取影片資訊

```
GET https://api.bilibili.com/x/web-interface/view?bvid=BVxxx
Headers:
  Cookie: SESSDATA=xxx; bili_jct=xxx

Response:
{
  "data": {
    "title": "影片標題",
    "pic": "封面URL",
    "duration": 1234,
    "cid": 123456,
    "pages": [...]
  }
}
```

#### 獲取播放地址

```
GET https://api.bilibili.com/x/player/playurl?bvid=BVxxx&cid=123456&qn=64&fnver=0&fnval=16&fourk=1
Headers:
  Cookie: SESSDATA=xxx; bili_jct=xxx
  Referer: https://www.bilibili.com

Response:
{
  "data": {
    "quality": 64,
    "dash": {
      "video": [{ "base_url": "xxx" }],
      "audio": [{ "base_url": "xxx" }]
    }
  }
}
```

---

## 資料結構

### 後端儲存（用戶 B 站認證）

```javascript
{
  github_id: "12345",
  bilibili_cookies: {
    SESSDATA: "encrypted_xxx",
    bili_jct: "encrypted_xxx",
    DedeUserID: "xxx"
  },
  bilibili_user: {
    mid: 12345,
    name: "B站用戶名",
    face: "頭像URL"
  },
  created_at: "2026-07-31T00:00:00Z",
  updated_at: "2026-07-31T00:00:00Z"
}
```

---

## 部署方案

### Serverless 選項

1. **Vercel**（推薦）
   - 支援 Node.js API Routes
   - 免費額度充足
   - 部署簡單（git push 自動部署）

2. **Netlify Functions**
   - 類似 Vercel

3. **Cloudflare Workers**
   - 邊緣運算，速度最快
   - 但有些 Node.js API 不支援

### 環境變數

```
JWT_SECRET=xxx          # 用於 GitHub token 驗證
ENCRYPTION_KEY=xxx      # 用於加密 B 站 cookie
BILIBILI_APP_KEY=xxx    # B 站 API key（如有）
BILIBILI_APP_SECRET=xxx # B 站 API secret（如有）
```

---

## 實施步驟

### Phase 1：後端基礎設施（必須先完成）

1. 建立 Node.js 專案結構
   - `server/index.js` — 主入口
   - `server/routes/bilibili.js` — B 站相關路由
   - `server/lib/bilibili-api.js` — B 站 API 封裝
   - `server/lib/cookie-store.js` — Cookie 加密儲存

2. 實現 GitHub 用戶驗證中間件
   - 驗證前端傳來的 GitHub token
   - 獲取 GitHub 用戶 ID 作為用戶標識

3. 實現 B 站登入流程
   - 登入 URL 生成
   - OAuth 回調處理
   - Cookie 提取與加密儲存

4. 實現 API 轉發
   - 獲取影片資訊
   - 獲取播放地址

### Phase 2：前端修改

5. 修改 `js/apps/bilibili/index.js`
   - 新增播放選項卡片
   - 實現外部開啟功能
   - 實現登入狀態檢查

6. 實現內嵌播放器
   - 根據情況選擇原生 `<video>` 或第三方播放器
   - 支援多畫質切換

7. 修改樣式 `js/apps/bilibili/style.css`
   - 播放選項卡片樣式
   - 播放器樣式

### Phase 3：整合測試

8. 端到端測試
   - 登入流程測試
   - 播放流程測試
   - 降級方案測試

9. 部署到 Serverless

---

## 風險與降級

### 風險 1：B 站 API 變更

**降級方案：** 只提供外部開啟功能

### 風險 2：Cookie 過期

**處理方式：**
- 檢測 API 返回 401/403
- 提示用戶重新登入

### 風險 3：影片加密保護

**降級方案：** 顯示「此影片需要在 B 站觀看」

### 風險 4：Serverless 冷啟動

**緩解方式：**
- 使用 Vercel 預熱功能
- 或使用 Cloudflare Workers（無冷啟動）

---

## 驗證清單

- [ ] 後端 API 正常運行
- [ ] GitHub 用戶驗證正常
- [ ] B 站登入流程完整
- [ ] Cookie 加密儲存正常
- [ ] 影片資訊獲取正常
- [ ] 播放地址獲取正常
- [ ] 前端播放選項卡片顯示正確
- [ ] 外部開啟功能正常
- [ ] 內嵌播放功能正常
- [ ] 登入狀態檢查正常
- [ ] Cookie 過期處理正常
- [ ] 降級方案正常

---

## 開放問題

1. **B 站 OAuth 是否需要申請？**（需要在實現前調查）
   - 需要研究 B 站是否有正式開放 OAuth
   - 若無，可能需要使用模擬登入方式
   - **行動：** 在開始 Phase 1 之前，先調查 B 站 API 文檔和社群方案

2. **Serverless 平台選擇？**
   - Vercel / Netlify / Cloudflare Workers
   - 建議先試 Vercel

3. **播放器選擇？**
   - 原生 `<video>` 最簡單
   - DASH 格式可能需要 dash.js 或 DPlayer
   - 建議實現時根據影片格式決定