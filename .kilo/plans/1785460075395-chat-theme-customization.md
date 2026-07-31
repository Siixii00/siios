# 聊天設定頁面重構計畫

## 目標

1. 移除不需要的功能（API 設定、系統提示詞、記憶設定）
2. 擴充主題自定義功能，讓使用者可以自定義：
   - 聊天室底色
   - 聊天气泡顏色（左側/右側）
   - 文字顏色
   - 輸入區域顏色

---

## 現有架構

### 檔案結構
- `js/apps/chats/chat-settings.js` — 設定頁面渲染
- `css/kakao.css` — 聊天室樣式
- `css/shared.css` — CSS 變數定義

### 現有 CSS 變數（需要可自定義）
```css
--kakao-bg: #FAF9F6;              /* 聊天室底色 */
--kakao-yellow: #FEE500;          /* 右側气泡顏色 */
--kakao-bubble-right-text: #625B71; /* 右側气泡文字 */
--kakao-header-bg: rgba(179, 199, 213, 0.9); /* 標題列背景 */
--kakao-input-bg: #F5F5F5;        /* 輸入區域背景 */
```

### 左側气泡（固定為白色，需要改為變數）
```css
.kakao-bubble-left {
    background-color: #FFFFFF;  /* 需要改為變數 */
    color: #000000;             /* 需要改為變數 */
}
```

---

## 實施步驟

### 1. CSS 變數重構

**修改 `css/shared.css`**
- 新增可自定義變數：
  - `--kakao-bubble-left-bg` — 左側气泡背景色
  - `--kakao-bubble-left-text` — 左側气泡文字色
  - `--kakao-bubble-right-bg` — 右側气泡背景色（別名到 `--kakao-yellow`）
  - `--kakao-bubble-right-text` — 右側气泡文字色
  - `--kakao-chat-bg` — 聊天室底色（別名到 `--kakao-bg`）

**修改 `css/kakao.css`**
- `.kakao-bubble-left` 使用變數而非固定值
- `.kakao-bubble-right::after` 使用變數

### 2. 移除不需要的設定項

**修改 `js/apps/chats/chat-settings.js`**
- 刪除第107-132行「其他」區塊（API 設定、系統提示詞）
- 刪除第134-154行「記憶設定」區塊

### 3. 新增自定義顏色設定

**資料結構**
```javascript
const customTheme = {
    chatBg: '#FAF9F6',           // 聊天室底色
    bubbleLeftBg: '#FFFFFF',     // 左側气泡背景
    bubbleLeftText: '#000000',   // 左側气泡文字
    bubbleRightBg: '#FEE500',    // 右側气泡背景
    bubbleRightText: '#625B71',  // 右側气泡文字
    inputBg: '#F5F5F5'           // 輸入區域背景
};
```

**儲存方式**
- 使用 `SettingsDB.set('chat_custom_theme', customTheme)`
- 格式：JSON 物件

### 4. 設定頁面 UI

**顏色選擇器**
- 使用 HTML `<input type="color">` 原生選擇器
- 每個可自定義項目一行：
  - 標籤 + 顏色預覽 + 選擇按鈕

**預設主題**
- 保留現有 5 個預設主題（淺色、深色、粉色、藍色、綠色）
- 選擇預設主題會覆蓋自定義設定
- 新增「自定義」選項，展開詳細設定

**即時預覽**
- 在設定頁面底部顯示聊天气泡預覽
- 顏色改變時即時更新預覽

### 5. 載入與應用主題

**在 `chat.js` 載入主題**
```javascript
async function applyCustomTheme() {
    const theme = await SettingsDB.get('chat_custom_theme');
    if (theme) {
        document.documentElement.style.setProperty('--kakao-bg', theme.chatBg);
        document.documentElement.style.setProperty('--kakao-bubble-left-bg', theme.bubbleLeftBg);
        // ...
    }
}
```

---

## 檔案修改清單

| 檔案 | 修改內容 |
|------|----------|
| `css/shared.css` | 新增气泡相關 CSS 變數 |
| `css/kakao.css` | 左側气泡改用 CSS 變數 |
| `js/apps/chats/chat-settings.js` | 移除 API/記憶設定，新增顏色自定義 UI |
| `js/apps/chats/chat.js` | 載入並應用自定義主題 |

---

## UI 設計

### 設定頁面結構

```
聊天設定
├── 主題（預設）
│   └── [淺色] [深色] [粉色] [藍色] [綠色] [自定義]
│
├── 自定義顏色（選擇「自定義」後展開）
│   ├── 聊天室底色    [顏色選擇器]
│   ├── 對方气泡背景  [顏色選擇器]
│   ├── 對方气泡文字  [顏色選擇器]
│   ├── 我的气泡背景  [顏色選擇器]
│   ├── 我的气泡文字  [顏色選擇器]
│   └── 輸入區域背景  [顏色選擇器]
│
├── 字體大小
│   └── [小] [中] [大]
│
└── 預覽
    └── 即時顯示气泡效果
```

---

## 驗證清單

- [ ] 選擇預設主題後，聊天室顏色正確更新
- [ ] 自定義顏色後，聊天室顏色正確更新
- [ ] 重新開啟聊天室，主題設定保持
- [ ] API 設定、系統提示詞、記憶設定已移除
- [ ] 預覽區域即時反映顏色變更