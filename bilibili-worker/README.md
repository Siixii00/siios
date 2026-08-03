# Bilibili 登入完整方案

## 問題分析

Bilibili 有嚴格的反爬蟲機制，會檢查：
- User-Agent（必須是真實瀏覽器）
- Referer（必須來自 bilibili.com）
- Cookie（必須有用戶登入信息）
- 完整的 HTTP headers

Cloudflare Workers 發出的請求會被識別為機器人，返回 412 錯誤。

## 解決方案

### 方案 A：QR Code 掃碼登入（推薦，適合手機用戶）

**流程：**
1. Worker 嘗試生成 QR Code
2. 如果成功 → 用戶掃碼登入 → 自動獲取 Cookie
3. 如果失敗（被 ban）→ 顯示手動輸入提示

**部署步驟：**
1. 複製 `bilibili-worker/src/index-oauth.js` 內容
2. 替換 Cloudflare Worker 代碼
3. 部署
4. 測試

### 方案 B：手動輸入 Cookie（備用，適合電腦用戶）

**獲取步驟：**
1. 在瀏覽器打開 https://www.bilibili.com
2. 登入你的 Bilibili 帳號
3. 按 F12 打開開發者工具
4. 切換到「Console」標籤
5. 輸入：`document.cookie`
6. 複製輸出的完整字串
7. 在 Bilibili App 登入界面貼上

## 使用方式

### 手機用戶（推薦方案 A）
1. 打開 Bilibili App
2. 看到登入彈窗
3. 點擊「掃碼登入」
4. 用 Bilibili App 掃描 QR Code
5. 登入成功後自動獲取真實推薦內容

### 電腦用戶（方案 B）
1. 在瀏覽器獲取 Cookie
2. 在登入界面選擇「手動輸入」
3. 貼上 Cookie
4. 保存並登入

## 功能特色

✅ 支持 QR Code 掃碼登入（自動獲取 Cookie）
✅ 支持手動輸入 Cookie（備用方案）
✅ 登入狀態永久保存
✅ Cookie 管理界面（更新、測試、登出）
✅ 獲取真實的 Bilibili 推薦內容
✅ 顯示真實的封面圖片
✅ 支持下拉刷新

## 故障排除

### QR Code 無法生成
- 原因：Bilibili 限制了 Worker 的請求
- 解決：使用手動輸入 Cookie

### Cookie 無效
- 原因：Cookie 已過期（通常 30 天）
- 解決：重新獲取並更新 Cookie

### 無法獲取推薦內容
- 原因：Cookie 不完整或格式錯誤
- 解決：確保 Cookie 包含 `SESSDATA`

## 技術細節

### Worker API 端點
- `/api/bilibili/auth/login` - 生成 QR Code
- `/api/bilibili/auth/poll` - 輪詢登入狀態
- `/api/bilibili/recommend` - 獲取推薦內容（需要 Cookie）

### 前端存儲
- `bilibili_cookie` - 保存 Cookie
- `bilibili_logged_in` - 登入狀態
- `bilibili_login_prompted` - 是否已提示登入

## 下一步

1. 部署 Worker (`index-oauth.js`)
2. 測試 QR Code 登入
3. 如果被 ban，使用手動輸入
4. 享受真實的 Bilibili 推薦內容！