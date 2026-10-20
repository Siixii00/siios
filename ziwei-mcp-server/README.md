# 紫微斗數 MCP Server

部署到 Cloudflare Workers 的紫微斗數分析服務。

## 快速開始

### 安裝依賴
```bash
npm install
```

### 本地開發
```bash
npm run dev
```

### 部署
```bash
npm run deploy
```

## API 端點

### GET /tools
列出所有可用工具

**回應範例：**
```json
{
  "tools": [
    {
      "name": "ziwei_analyze_birth",
      "description": "根據出生年月日時間進行紫微斗數排盤分析",
      "inputSchema": {...}
    }
  ]
}
```

### POST /tools/call
調用指定工具

**請求範例：**
```json
{
  "name": "ziwei_analyze_birth",
  "arguments": {
    "birth_date": "1990-05-15",
    "birth_time": "14:30",
    "birth_location": "台北市",
    "calendar_type": "solar",
    "gender": "male"
  }
}
```

**回應範例：**
```json
{
  "success": true,
  "result": {
    "chart": {...},
    "runtime": {...},
    "fortune_summary": "..."
  }
}
```

## 環境變數

在 `wrangler.toml` 中設定：

```toml
[vars]
ENVIRONMENT = "production"
```

## 注意事項

目前使用模擬數據，需要整合實際的紫微斗數排盤庫：
- `fortel-ziweidoushu` - MIT 授權
- `lunar-javascript` - 農曆轉換

## License

MIT
## 排盤算法與驗證（2.0）

2.0 之前的版本是**假資料**（星曜用生日字串雜湊挑選、四化與五行局寫死）。現在是真正的排盤：
農曆生日 → 命宮／身宮 → 十二宮與天干（五虎遁）→ 五行局（納音）→ 紫微與天府兩個星系 → 輔星（左輔右弼、文昌文曲、祿存羊陀、魁鉞、火鈴、空劫）→ 本命四化 → 大限 → 流年／流月／流日命宮與流年四化。

- 農曆轉換用 `lunar-javascript`；年以農曆年為準，閏月 15 日之後算下個月。
- 23:00～23:59（晚子時）依多數排盤軟體的做法，從 23 點起算隔天的日期，時辰仍是子時。
- 回傳的 `fortune_summary`（`base`／`yearly`／`monthly`／`daily`）只陳述命盤事實與各宮位代表的面向，不做吉凶預言；`events` 一律為空。
- 驗證：以 `iztro` 為對照，隨機 3000 組生日（命宮、五行局、每宮主星／輔星／天干／大限、四化）只有 7 組不一致，且全是晚子時遇到閏月或月底的邊界案例；另用 1500 組「生日 × 今天」比對流年／流月／流日命宮與流年四化，0 組不一致。
- `npm test`：用 iztro 產生的 40 組黃金資料做回歸測試（`test/golden.json`），測試時不需要 iztro。
