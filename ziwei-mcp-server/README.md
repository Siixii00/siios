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