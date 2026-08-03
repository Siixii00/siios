# Bilibili Web API 分析

根據 GitHub 文檔和現代 Bilibili 網站分析

## 可用的 API（不需要 App Key）

### 1. 熱門視頻（不需要登入）
```
GET https://api.bilibili.com/x/web-interface/popular
參數：ps (數量), pn (頁碼)
```

### 2. 排行榜（不需要登入）
```
GET https://api.bilibili.com/x/web-interface/ranking/v2
參數：type=all (全部排行)
```

### 3. 分區視頻（不需要登入）
```
GET https://api.bilibili.com/x/web-interface/dynamic/region
參數：rid (分區ID), ps (數量)
```

### 4. 搜尋（需要 Cookie，否則會被限制）
```
GET https://api.bilibili.com/x/web-interface/search/type
參數：keyword, page, page_size, search_type=video
```

### 5. 推薦（需要登入 Cookie）
```
GET https://api.bilibili.com/x/web-interface/index/top/rcmd
參數：ps (數量)
```

## CORS 限制

所有 API 都有 CORS 限制：
- 只允許從 `*.bilibili.com` 域名訪問
- 從其他網站訪問會被阻止

## 解決方案

1. **使用 Cloudflare Worker 作為代理**
   - Worker 被識別為服務器，不受 CORS 限制
   - 但會被 Bilibili 反爬蟲機制阻止（412 錯誤）

2. **使用用戶提供的 Cookie**
   - 用戶在瀏覽器登入後提供 Cookie
   - 前端直接使用 Cookie 調用 API（但會被 CORS 阻止）

3. **混合方案（推薦）**
   - Worker 嘗試調用公開 API（不需要登入）
   - 用戶可以手動輸入搜索關鍵詞
   - Worker 執行搜索並返回結果

## 實際測試結果

測試於 2026-08-03：
- ❌ Worker 直接調用 → 412 Error（被 ban）
- ❌ 前端直接調用 → CORS Error
- ✅ 瀏覽器控制台調用 → 成功（同源）
- ⚠️ 使用用戶 Cookie → CORS Error

## 最佳實踐

由於 CORS 和反爬蟲限制，我們採用：

1. **預設熱門視頻列表**（手動更新 BV 號）
2. **搜索功能**（用戶輸入關鍵詞，嘗試調用 API）
3. **手動輸入 Cookie**（作為備用方案）