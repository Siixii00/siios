# 紫微斗數 MCP Server 部署指南

## 1. 安裝依賴

```bash
cd ziwei-mcp-server
npm install
```

## 2. Cloudflare Workers 設定

### 2.1 登入 Cloudflare
```bash
npm run login
```

### 2.2 設定 Workers 域名
編輯 `wrangler.toml`，將 `your-domain.com` 改為你的實際域名：

```toml
[[routes]]
pattern = "ziwei-mcp.your-domain.com/*"
zone_name = "your-domain.com"
```

或使用 Cloudflare 提供的預設域名：
```toml
# 移除 [[routes]] 區塊，使用預設域名
# 部署後會得到 https://ziwei-mcp-server.<your-subdomain>.workers.dev
```

### 2.3 部署
```bash
npm run deploy
```

部署成功後會得到類似以下的 URL：
```
https://ziwei-mcp-server.<your-subdomain>.workers.dev
```

## 3. 更新前端配置

部署完成後，更新 `js/core/ziwei-mcp-client.js` 的 endpoint：

```javascript
this.endpoint = 'https://ziwei-mcp-server.<your-subdomain>.workers.dev';
```

## 4. 測試

### 4.1 測試端點
```bash
curl https://ziwei-mcp-server.<your-subdomain>.workers.dev/tools
```

### 4.2 測試工具調用
```bash
curl -X POST https://ziwei-mcp-server.<your-subdomain>.workers.dev/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ziwei_analyze_birth",
    "arguments": {
      "birth_date": "1990-05-15",
      "birth_time": "14:30",
      "birth_location": "台北市",
      "calendar_type": "solar",
      "gender": "male"
    }
  }'
```

## 5. 整合真實排盤庫（選用）

目前使用模擬數據，要整合真實排盤：

### 5.1 安裝套件
```bash
npm install fortel-ziweidoushu lunar-javascript
```

### 5.2 更新 `src/lib/ziwei-engine.ts`
參考 `.kilo/plans/1785847716490-ziwei-mcp-integration-plan.md` 的實作範例。

## 疑難排解

### 部署失敗
- 檢查 `wrangler.toml` 配置
- 確認 Cloudflare 帳號餘額
- 查看錯誤訊息：`wrangler tail`

### 無法連線
- 檢查 CORS 設定（已在 `src/index.ts` 配置允許所有來源）
- 確認 Workers 正在運行：Cloudflare Dashboard > Workers

### 功能異常
- 查看 Workers 日誌：`wrangler tail`
- 檢查請求格式是否符合 API 規格