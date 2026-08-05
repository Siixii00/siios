# Cloudflare Workers 部署 - API Token 方式

## 方法 1: 使用 API Token（推薦）

### 步驟 1: 創建 API Token

1. 前往 https://dash.cloudflare.com/profile/api-tokens
2. 點擊「Create Token」
3. 使用「Edit Cloudflare Workers」模板
4. 設定權限：
   - Account - Workers Scripts - Edit
   - Zone - Workers Routes - Edit
5. 點擊「Continue to summary」然後「Create Token」
6. **複製 Token**（只會顯示一次）

### 步驟 2: 配置 Wrangler

在專案目錄執行：
```bash
wrangler config
```

輸入你的 API Token。

或者手動創建配置文件：
```bash
# 創建 .wrangler/config/default.toml
mkdir -p .wrangler/config
```

內容：
```toml
[default]
api_token = "你的_API_TOKEN"
```

## 方法 2: 使用 Global API Key

### 步驟 1: 獲取 API Key

1. 前往 https://dash.cloudflare.com/profile/api-tokens
2. 在「API Keys」區段找到「Global API Key」
3. 點擊「View」並複製

### 步驟 2: 配置

```bash
wrangler config
```

輸入：
- Email: 你的 Cloudflare email
- API Key: Global API Key

## 方法 3: 環境變量

設定環境變量：
```bash
export CLOUDFLARE_API_TOKEN="你的_API_TOKEN"
# 或
export CLOUDFLARE_API_KEY="你的_Global_API_Key"
export CLOUDFLARE_EMAIL="你的_email"
```

## 驗證登入

```bash
wrangler whoami
```

應該顯示你的帳號資訊。