# MCP Worker 範本指南

這份文件說明如何建立自己的 MCP Worker，讓 Siios PWA 中的 AI 角色可以調用你自訂的工具。

---

## 快速開始

### 1. 建立專案結構

```bash
mkdir mcp-worker
cd mcp-worker
npm init -y
npm install wrangler --save-dev
```

### 2. 建立 Worker 程式碼

建立 `src/index.js`：

```javascript
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS 處理
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // 工具列表端點
        if (url.pathname === '/tools' && request.method === 'GET') {
            return Response.json(getTools(), { headers: corsHeaders });
        }

        // 執行工具端點
        if (url.pathname === '/tools/call' && request.method === 'POST') {
            try {
                const { name, arguments: args } = await request.json();
                const result = await executeTool(name, args, env);
                return Response.json({ success: true, result }, { headers: corsHeaders });
            } catch (error) {
                return Response.json({ success: false, error: error.message }, {
                    status: 400,
                    headers: corsHeaders
                });
            }
        }

        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
};

// 定義你的工具
function getTools() {
    return [
        {
            name: 'echo',
            description: '測試用工具，返回輸入的內容',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: '要返回的訊息'
                    }
                },
                required: ['message']
            }
        },
        {
            name: 'purchase_sanitary_pads',
            description: '購買衛生棉。AI 角色可以以自己的身分幫使用者下單。',
            parameters: {
                type: 'object',
                properties: {
                    brand: {
                        type: 'string',
                        description: '品牌偏好（如：好自在、靠得住、蘇菲）',
                        enum: ['好自在', '靠得住', '蘇菲', '其他']
                    },
                    type: {
                        type: 'string',
                        description: '類型',
                        enum: ['日用', '夜用', '護墊', '量多型']
                    },
                    quantity: {
                        type: 'number',
                        description: '數量（包）',
                        default: 1
                    }
                },
                required: []
            }
        }
    ];
}

// 執行工具
async function executeTool(name, args, env) {
    switch (name) {
        case 'echo':
            return { echoed: args.message, timestamp: new Date().toISOString() };

        case 'purchase_sanitary_pads':
            // 這裡調用實際的購物 API
            // const order = await fetch('https://api.shop.com/orders', { ... });
            return {
                orderId: 'ORD-' + Date.now(),
                product: `${args.brand || '好自在'} ${args.type || '日用'}`,
                quantity: args.quantity || 1,
                status: '已下單',
                estimatedDelivery: '3-5 個工作天'
            };

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
```

### 3. 建立 wrangler.toml

```toml
name = "siios-mcp-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

# 如果需要 API Key 驗證
# [vars]
# API_KEY = "your-secret-key"

# 或者使用 Secrets（更安全）
# wrangler secret put API_KEY
```

### 4. 部署

```bash
# 登入 Cloudflare
wrangler login

# 部署
wrangler deploy
```

部署完成後，你會得到一個 URL，例如：
```
https://siios-mcp-worker.your-account.workers.dev
```

### 5. 在 Siios PWA 中設定

1. 開啟「設定」→「MCP 工具整合」
2. 點擊「新增 MCP 伺服器」
3. 填入：
   - 名稱：例如「購物工具」
   - Worker URL：`https://siios-mcp-worker.your-account.workers.dev`
   - API Key：如果有的話

---

## 進階設定

### 加入 API Key 驗證

修改 Worker 程式碼：

```javascript
export default {
    async fetch(request, env, ctx) {
        // 驗證 API Key
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (env.API_KEY && token !== env.API_KEY) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ... 其他程式碼
    }
};
```

設定 Secret：
```bash
wrangler secret put API_KEY
```

---

## 工具定義規範

工具定義遵循 JSON Schema 格式：

```javascript
{
    name: 'tool_name',           // 工具名稱（唯一）
    description: '工具描述',      // AI 會看到這個描述
    parameters: {
        type: 'object',
        properties: {
            param1: {
                type: 'string',   // 類型：string, number, boolean, array, object
                description: '參數描述',
                enum: ['選項1', '選項2']  // 選填：限制可選值
            },
            param2: {
                type: 'number',
                default: 1        // 選填：預設值
            }
        },
        required: ['param1']      // 必填參數清單
    }
}
```

---

## 範例：天氣查詢工具

```javascript
{
    name: 'get_weather',
    description: '查詢指定城市的天氣資訊',
    parameters: {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description: '城市名稱（中文或英文）'
            }
        },
        required: ['city']
    }
}

// 執行
async function executeTool(name, args, env) {
    if (name === 'get_weather') {
        const response = await fetch(
            `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${args.city}`
        );
        const data = await response.json();
        return {
            city: data.location.name,
            temp: data.current.temp_c,
            condition: data.current.condition.text
        };
    }
}
```

---

## 範例：智慧家居控制

```javascript
{
    name: 'control_light',
    description: '控制智慧燈具',
    parameters: {
        type: 'object',
        properties: {
            room: {
                type: 'string',
                enum: ['客廳', '臥室', '廚房', '浴室']
            },
            action: {
                type: 'string',
                enum: ['on', 'off', 'dim']
            },
            brightness: {
                type: 'number',
                description: '亮度（1-100）',
                minimum: 1,
                maximum: 100
            }
        },
        required: ['room', 'action']
    }
}
```

---

## 除錯技巧

### 本地測試

```bash
wrangler dev
```

會在 `http://localhost:8787` 啟動本地伺服器。

### 查看日誌

```bash
wrangler tail
```

### 測試端點

```bash
# 取得工具列表
curl https://your-worker.workers.dev/tools

# 執行工具
curl -X POST https://your-worker.workers.dev/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"echo","arguments":{"message":"hello"}}'
```

---

## 常見問題

### Q: Worker 有 CORS 問題怎麼辦？

確保所有回應都包含 CORS headers：

```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

### Q: 如何限制只有特定網域可以調用？

```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://your-pwa-domain.com',
    // ...
};
```

### Q: Worker 有執行時間限制嗎？

Cloudflare Workers 免費版有 10ms CPU 時間限制（總執行時間可達 50ms）。如果需要更長時間，可以：

1. 使用 Workers Paid 方案
2. 將耗時操作改用 Queue 或 Durable Objects

### Q: 如何儲存資料？

使用 Cloudflare KV：

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-namespace-id"
```

```javascript
// 在 Worker 中
await env.MY_KV.put('key', 'value');
const value = await env.MY_KV.get('key');
```

---

## 相關資源

- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文件](https://developers.cloudflare.com/workers/wrangler/)
- [JSON Schema 規範](https://json-schema.org/)