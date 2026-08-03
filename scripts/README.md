# Bilibili 內容更新方案

## 📋 概述

由於 Bilibili 的 CORS 和反爬蟲限制，我們使用**後端腳本定期更新**的方案：

1. Python 腳本定期從 Bilibili 獲取熱門內容
2. 保存到 JSON 文件
3. 前端讀取 JSON 文件顯示

## 🚀 快速開始

### 1. 安裝 Python 依賴

```bash
pip install requests
```

### 2. 運行更新腳本

**Windows:**
```cmd
雙擊運行：scripts\update_bilibili.bat
```

**或直接運行 Python:**
```bash
cd C:\Users\新崛江商旅\Desktop\家蓁\siios
python scripts\update_bilibili.py
```

### 3. 查看結果

腳本會生成：
```
data/bilibili_videos.json
```

包含：
- 熱門影片（50部）
- 排行榜影片（100部）
- 更新時間戳

### 4. 前端自動讀取

前端會自動從 `/data/bilibili_videos.json` 讀取數據。

## ⏰ 設置定時更新

### Windows 任務計劃程序

1. 打開「任務計劃程序」
2. 創建基本任務
3. 觸發器：每天/每小時
4. 操作：啟動程序
   - 程序：`python.exe`
   - 參數：`scripts\update_bilibili.py`
   - 起始位置：`C:\Users\新崛江商旅\Desktop\家蓁\siios`

### Linux/Mac crontab

```bash
# 每小時更新一次
0 * * * * cd /path/to/siios && python scripts/update_bilibili.py

# 或每天早上 8 點更新
0 8 * * * cd /path/to/siios && python scripts/update_bilibili.py
```

## 📁 文件結構

```
siios/
├── scripts/
│   ├── update_bilibili.py      # Python 更新腳本
│   └── update_bilibili.bat     # Windows 批處理文件
├── data/
│   └── bilibili_videos.json    # 生成的數據文件
└── js/apps/bilibili/
    └── index.js                # 前端讀取邏輯
```

## ✅ 優點

- ✅ **可靠**：不受 CORS 限制
- ✅ **真實數據**：直接從 Bilibili API 獲取
- ✅ **可控制**：可以隨時手動更新
- ✅ **可定時**：自動定期更新
- ✅ **用戶友好**：前端無需等待

## ⚠️ 注意事項

- 需要手動運行腳本或設置定時任務
- 更新頻率建議：每小時或每天
- JSON 文件會隨著 Git 提交更新

## 🔧 自定義

### 修改獲取數量

編輯 `update_bilibili.py`:

```python
API_URLS = {
    'popular': 'https://api.bilibili.com/x/web-interface/popular?ps=100',  # 改為 100
    'ranking': 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
}
```

### 添加搜索關鍵詞

取消註釋並修改：

```python
SEARCH_KEYWORDS = ['遊戲', '動漫', '音樂']  # 自定義關鍵詞

# 在 main() 函數中取消註釋：
for keyword in SEARCH_KEYWORDS:
    search = fetch_search(keyword)
    all_videos.extend(search)
    time.sleep(2)
```

## 🎯 下一步

1. 測試腳本：`python scripts/update_bilibili.py`
2. 檢查生成的 JSON 文件
3. 設置定時任務（可選）
4. 部署到 GitHub Pages（JSON 文件會一起部署）