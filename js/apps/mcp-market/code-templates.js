import { TOOLS_CATALOG } from './tools-catalog.js';

export function generateWorkerCode(selectedTools) {
    const tools = selectedTools.map(id => TOOLS_CATALOG.find(t => t.id === id)).filter(Boolean);

    const toolDefinitions = tools.map(t => generateToolDefinition(t)).join(',\n');
    const executeCases = tools.map(t => generateExecuteCase(t)).join('\n');

    return `// MCP Worker - 由神秘門生成
// 包含 ${tools.length} 個工具：${tools.map(t => t.displayName).join('、')}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

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

function getTools() {
    return [
${toolDefinitions}
    ];
}

async function executeTool(name, args, env) {
    switch (name) {
${executeCases}
        default:
            throw new Error(\`Unknown tool: \${name}\`);
    }
}
`;
}

function generateToolDefinition(tool) {
    return `        {
            name: '${tool.name}',
            description: '${tool.description}',
            parameters: ${JSON.stringify(tool.parameters, null, 12).split('\n').join('\n            ')}
        }`;
}

function generateExecuteCase(tool) {
    const caseBody = generateCaseBody(tool);
    return `        case '${tool.name}':
            ${caseBody}`;
}

function generateCaseBody(tool) {
    switch (tool.id) {
        case 'daily_weather':
            return `// 需要設定 OPENWEATHER_API_KEY
            const weatherRes = await fetch(
                \`https://api.openweathermap.org/data/2.5/weather?q=\${encodeURIComponent(args.city)}&appid=\${env.OPENWEATHER_API_KEY}&units=metric\`
            );
            const weatherData = await weatherRes.json();
            return {
                city: weatherData.name,
                temp: weatherData.main.temp,
                feels_like: weatherData.main.feels_like,
                humidity: weatherData.main.humidity,
                description: weatherData.weather[0].description,
                icon: weatherData.weather[0].icon
            };`;

        case 'daily_reminder':
            return `// 需要實作推播服務
            // 這裡可以串接 FCM、APNs 或其他推播服務
            return {
                scheduled: true,
                message: args.message,
                time: args.time,
                repeat: args.repeat || false
            };`;

        case 'daily_recipe':
            return `// 需要設定 SPOONACULAR_API_KEY
            const recipeRes = await fetch(
                \`https://api.spoonacular.com/recipes/complexSearch?query=\${encodeURIComponent(args.query)}&number=\${args.limit || 5}&apiKey=\${env.SPOONACULAR_API_KEY}\`
            );
            const recipeData = await recipeRes.json();
            return recipeData.results.map(r => ({
                id: r.id,
                title: r.title,
                image: r.image
            }));`;

        case 'shop_sanitary_pads':
            return `// 這裡串接實際購物 API
            // 例如 momo、pchome 或自建訂單系統
            return {
                orderId: 'ORD-' + Date.now(),
                product: \`\${args.brand || '好自在'} \${args.type || '日用'}\`,
                quantity: args.quantity || 1,
                status: '已下單',
                estimatedDelivery: '3-5 個工作天'
            };`;

        case 'health_period_log':
        case 'health_mood_track':
        case 'health_medication':
            return `// 整合 Siios HealthDB
            // 儲存到 IndexedDB
            return {
                logged: true,
                timestamp: new Date().toISOString(),
                data: args
            };`;

        case 'smart_light':
            return `// 需要串接 Philips Hue、Google Home 等
            return {
                room: args.room,
                action: args.action,
                brightness: args.brightness || 100,
                executed: true
            };`;

        case 'smart_ac':
            return `// 需要串接智慧家居平台
            return {
                room: args.room,
                temperature: args.temperature || 24,
                mode: args.mode || 'cool',
                executed: true
            };`;

        case 'smart_music':
        case 'entertainment_music_search':
            return `// 需要設定 SPOTIFY_API_KEY
            const musicRes = await fetch(
                \`https://api.spotify.com/v1/search?q=\${encodeURIComponent(args.query)}&type=track&limit=\${args.limit || 10}\`,
                { headers: { 'Authorization': \`Bearer \${env.SPOTIFY_ACCESS_TOKEN}\` } }
            );
            const musicData = await musicRes.json();
            return musicData.tracks.items.map(t => ({
                name: t.name,
                artist: t.artists[0].name,
                album: t.album.name,
                preview_url: t.preview_url
            }));`;

        case 'entertainment_anime':
            return `// AniList GraphQL API（免費）
            const query = \`
                query ($search: String, $season: String) {
                    Page {
                        media(search: $search, season: $season, type: ANIME) {
                            title { romaji native english }
                            episodes
                            status
                            averageScore
                            genres
                        }
                    }
                }
            \`;
            const animeRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { search: args.query, season: args.season } })
            });
            const animeData = await animeRes.json();
            return animeData.data.Page.media;`;

        case 'entertainment_game_price':
            return `// CheapShark API（免費）
            const gameRes = await fetch(
                \`https://www.cheapshark.com/api/1.0/games?title=\${encodeURIComponent(args.game)}\`
            );
            const gameData = await gameRes.json();
            return gameData.slice(0, 5).map(g => ({
                title: g.external,
                cheapestPrice: g.cheapest / 100,
                cheapestStore: g.cheapestDealID
            }));`;

        case 'work_translate':
            return `// 需要設定 GOOGLE_TRANSLATE_API_KEY 或 DEEPL_API_KEY
            const transRes = await fetch(
                \`https://translation.googleapis.com/language/translate/v2?key=\${env.GOOGLE_TRANSLATE_API_KEY}\`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: args.text, target: args.targetLang })
                }
            );
            const transData = await transRes.json();
            return {
                original: args.text,
                translated: transData.data.translations[0].translatedText,
                targetLang: args.targetLang
            };`;

        case 'work_wiki':
            return `// MediaWiki API（免費）
            const wikiRes = await fetch(
                \`https://\${args.lang || 'zh'}.wikipedia.org/w/api.php?action=query&list=search&srsearch=\${encodeURIComponent(args.query)}&format=json&origin=*\`
            );
            const wikiData = await wikiRes.json();
            return wikiData.query.search.slice(0, 5).map(r => ({
                title: r.title,
                snippet: r.snippet.replace(/<[^>]+>/g, ''),
                link: \`https://\${args.lang || 'zh'}.wikipedia.org/wiki/\${encodeURIComponent(r.title)}\`
            }));`;

        case 'work_notion':
            return `// 需要設定 NOTION_API_KEY 和 NOTION_DATABASE_ID
            const notionRes = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: {
                    'Authorization': \`Bearer \${env.NOTION_API_KEY}\`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    parent: { database_id: env.NOTION_DATABASE_ID },
                    properties: {
                        Title: { title: [{ text: { content: args.title } }] },
                        Tags: { multi_select: (args.tags || []).map(t => ({ name: t })) }
                    }
                })
            });
            const notionData = await notionRes.json();
            return { pageId: notionData.id, url: notionData.url };`;

        case 'finance_stock':
            return `// 需要 ALPHA_VANTAGE_API_KEY 或 Yahoo Finance
            const stockRes = await fetch(
                \`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=\${args.symbol}&apikey=\${env.ALPHA_VANTAGE_API_KEY}\`
            );
            const stockData = await stockRes.json();
            return {
                symbol: args.symbol,
                price: parseFloat(stockData['Global Quote']['05. price']),
                change: stockData['Global Quote']['09. change'],
                changePercent: stockData['Global Quote']['10. change percent']
            };`;

        case 'finance_crypto':
            return `// CoinGecko API（免費）
            const cryptoRes = await fetch(
                \`https://api.coingecko.com/api/v3/simple/price?ids=\${args.coin}&vs_currencies=\${args.currency || 'twd'}\`
            );
            const cryptoData = await cryptoRes.json();
            return {
                coin: args.coin,
                price: cryptoData[args.coin][args.currency || 'twd'],
                currency: args.currency || 'twd'
            };`;

        case 'finance_expense':
            return `// 本地記帳或串接記帳服務
            return {
                logged: true,
                amount: args.amount,
                category: args.category,
                note: args.note || '',
                timestamp: new Date().toISOString()
            };`;

        case 'memory_save':
        case 'memory_retrieve':
            return `// 整合 Siios MemoryDB
            // 透過 Worker API 儲存/檢索記憶
            return {
                success: true,
                content: args.content,
                category: args.category,
                timestamp: new Date().toISOString()
            };`;

        default:
            return `// TODO: 實作 ${tool.name}
            return { success: true, args };`;
    }
}

export function generateWranglerConfig(selectedTools, hasSecrets = false) {
    const needsApiKey = selectedTools.some(id => {
        const tool = TOOLS_CATALOG.find(t => t.id === id);
        return tool?.requires?.some(r => r.includes('API Key') || r.includes('Token'));
    });

    let config = `name = "siios-mcp-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

# 啟用日誌
[observability.logs]
enabled = true
`;

    if (needsApiKey) {
        config += `
# 如果需要 API Key，使用 Secrets 管理：
# wrangler secret put OPENWEATHER_API_KEY
# wrangler secret put SPOTIFY_API_KEY
# ...等
`;
    }

    return config;
}

export function generatePackageJson() {
    return `{
  "name": "siios-mcp-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}`;
}

export function generateReadme(selectedTools) {
    const tools = selectedTools.map(id => TOOLS_CATALOG.find(t => t.id === id)).filter(Boolean);

    return `# Siios MCP Worker

這個 Worker 提供 ${tools.length} 個工具給 Siios PWA 使用。

## 包含的工具

${tools.map(t => `- **${t.displayName}** (${t.name}): ${t.description}`).join('\n')}

## 部署步驟

### 1. 安裝依賴

\`\`\`bash
npm install
\`\`\`

### 2. 登入 Cloudflare

\`\`\`bash
wrangler login
\`\`\`

### 3. 設定 Secrets（如果需要）

${tools.filter(t => t.requires?.length > 0).map(t => `# ${t.displayName} 需要：${t.requires.join(', ')}`).join('\n') || '無需設定 Secrets'}

\`\`\`bash
# 例如：
wrangler secret put OPENWEATHER_API_KEY
\`\`\`

### 4. 部署

\`\`\`bash
npm run deploy
\`\`\`

### 5. 在 Siios PWA 設定

1. 開啟「設定」→「MCP 工具整合」
2. 新增 MCP 伺服器
3. 輸入 Worker URL

## 本地測試

\`\`\`bash
npm run dev
\`\`\`

會在 http://localhost:8787 啟動。

## 查看日誌

\`\`\`bash
npm run tail
\`\`\`

## 檔案結構

\`\`\`
├── src/
│   └── index.js      # Worker 主程式
├── wrangler.toml     # Cloudflare 設定
└── package.json
\`\`\`
`;
}

export function generateZipContent(selectedTools) {
    return {
        'src/index.js': generateWorkerCode(selectedTools),
        'wrangler.toml': generateWranglerConfig(selectedTools),
        'package.json': generatePackageJson(),
        'README.md': generateReadme(selectedTools)
    };
}