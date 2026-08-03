# 🎯 GitHub Actions 完整部署指南

## ✅ 已完成的工作

1. ✅ 創建 GitHub Actions 工作流配置（`.github/workflows/update-bilibili.yml`）
2. ✅ 創建 Python 更新腳本（`scripts/update_bilibili.py`）
3. ✅ 創建初始數據文件（`data/bilibili_videos.json`）
4. ✅ 提交所有文件到 GitHub
5. ✅ 更新說明文檔

## 📋 下一步：啟用 GitHub Actions

### 方法 1：通過 GitHub 網頁界面（推薦）

1. **打開 GitHub 倉庫**
   ```
   https://github.com/Siixii00/siios
   ```

2. **進入 Actions 頁面**
   - 點擊頂部的「Actions」標籤
   - 會看到提示：「Workflows are not enabled on this repository」

3. **啟用工作流**
   - 點擊綠色按鈕「I understand my workflows, go ahead and enable them」
   - 或者點擊右側的「Enable actions for this repository」

4. **查看工作流**
   - 左側會看到「Update Bilibili Videos」工作流
   - 點擊進入

5. **手動測試運行**
   - 點擊右側的「Run workflow」下拉選單
   - 選擇 `main` 分支
   - 點擊綠色的「Run workflow」按鈕

6. **查看運行結果**
   - 等待 1-2 分鐘
   - 點擊進入剛才的運行記錄
   - 查看每個步驟的輸出
   - 如果全部顯示綠色 ✓，表示成功

7. **檢查生成的文件**
   - 回到倉庫首頁
   - 查看 `data/bilibili_videos.json` 是否已更新
   - 點擊文件可以看到真實的 Bilibili 影片數據

### 方法 2：通過 Git 命令（可選）

如果想修改更新頻率，編輯文件後推送：

```bash
# 編輯工作流文件
nano .github/workflows/update-bilibili.yml

# 提交並推送
git add .github/workflows/update-bilibili.yml
git commit -m "調整 Bilibili 更新頻率"
git push
```

## 🎨 自定義配置

### 1. 修改更新頻率

編輯 `.github/workflows/update-bilibili.yml`：

```yaml
on:
  schedule:
    # 每小時更新
    - cron: '0 * * * *'
    
    # 每 6 小時更新
    - cron: '0 */6 * * *'
    
    # 每天台灣時間 8:00（UTC 0:00）
    - cron: '0 0 * * *'
    
    # 每天台灣時間 20:00（UTC 12:00）
    - cron: '0 12 * * *'
  workflow_dispatch:
```

### 2. 修改獲取的影片數量

編輯 `scripts/update_bilibili.py`：

```python
API_URLS = {
    'popular': 'https://api.bilibili.com/x/web-interface/popular?ps=100',  # 改為 100
    'ranking': 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
}
```

### 3. 添加搜索功能

在 `scripts/update_bilibili.py` 的 `main()` 函數中取消註釋：

```python
# 搜索（可選）
for keyword in SEARCH_KEYWORDS[:3]:  # 搜索前 3 個關鍵詞
    search = fetch_search(keyword)
    all_videos.extend(search)
    time.sleep(2)
```

## 📊 工作流程詳解

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions 運行時間（每天台灣時間 8:00）                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Checkout repository                                │
│  - 克隆倉庫到 GitHub 服務器                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Set up Python                                      │
│  - 安裝 Python 3.11                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Install dependencies                               │
│  - 安裝 requests 庫                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Run update script                                  │
│  - 執行 Python 腳本                                          │
│  - 從 Bilibili API 獲取數據                                  │
│  - 生成 data/bilibili_videos.json                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Commit changes                                     │
│  - 提交更新的 JSON 文件                                       │
│  - 提交信息：「自動更新 Bilibili 熱門影片」                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Push changes                                       │
│  - 推送到 GitHub 倉庫                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages 自動部署                                       │
│  - 用戶訪問 PWA 時獲取最新的影片數據                          │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 驗證清單

- [ ] GitHub Actions 已啟用
- [ ] 手動觸發工作流成功
- [ ] `data/bilibili_videos.json` 已更新
- [ ] JSON 文件包含真實的 Bilibili 影片數據
- [ ] PWA 可以正確讀取並顯示影片
- [ ] 設置了自動定時更新（如需要）

## ❓ 常見問題

### Q1: 為什麼選擇 GitHub Actions？

- ✅ 完全免費（公開倉庫）
- ✅ 無需本地伺服器
- ✅ 自動化程度高
- ✅ 穩定可靠

### Q2: 如何查看運行日誌？

1. 進入 GitHub Actions 頁面
2. 點擊具體的運行記錄
3. 展開每個步驟查看詳細輸出

### Q3: 如果運行失敗怎麼辦？

- 查看錯誤日誌
- 檢查 API 是否可達
- 確認 Python 腳本邏輯正確
- 查看 GitHub Actions 權限設置

### Q4: 如何臨時禁用自動更新？

1. 進入 Actions 頁面
2. 點擊「Update Bilibili Videos」
3. 點擊右上角的「...」選單
4. 選擇「Disable workflow」

## 📞 需要幫助？

如果遇到問題，請檢查：

1. GitHub Actions 日誌
2. Python 腳本輸出
3. JSON 文件格式
4. 前端讀取邏輯

---

**最後更新：2026-08-03**