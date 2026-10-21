import { TOOLS_CATALOG } from './tools-catalog.js';
import { initDB } from '../../db.js';
import { ZIWEI_ENGINE_JS } from './ziwei-engine-template.js';

const CUSTOM_TOOLS_STORE = 'customMCPTools';

async function getCustomTools() {
    try {
        const database = await initDB();
        if (!database.objectStoreNames.contains(CUSTOM_TOOLS_STORE)) {
            return [];
        }
        return await database.getAll(CUSTOM_TOOLS_STORE);
    } catch (e) {
        console.warn('[MCP] 無法讀取自定義工具:', e);
        return [];
    }
}

// 每個工具實際能在哪裡運作：
//   worker  — 呼叫外部服務，放在 Cloudflare Worker（keyless: 不需要任何金鑰）
//   local   — 需要 App 內的資料（行事曆、健康紀錄、記憶），已內建在 App，不需要 Worker
//   unsupported — 目前沒有實作，不會被放進生成的 Worker
const WORKER_TOOLS = {
    daily_weather: { keyless: true },
    daily_recipe: { keyless: true },
    entertainment_anime: { keyless: true },
    entertainment_game_price: { keyless: true },
    work_wiki: { keyless: true },
    work_translate: { keyless: true },
    entertainment_music_search: { keyless: false },
    smart_music: { keyless: false },
    work_notion: { keyless: false },
    // 紫微斗數：排盤引擎隨 Worker 一起產生（src/ziwei-engine.js），需要 npm 套件 lunar-javascript
    fortune_ziwei: { keyless: true, dependencies: { 'lunar-javascript': '^1.7.7' }, files: { 'src/ziwei-engine.js': ZIWEI_ENGINE_JS } }
};
const LOCAL_TOOL_IDS = new Set(['daily_reminder', 'social_calendar', 'health_period_log', 'health_mood_track', 'health_medication']);

export function getToolSupport(id) {
    if (String(id).startsWith('custom-')) return { mode: 'worker', keyless: false, custom: true };
    if (WORKER_TOOLS[id]) return { mode: 'worker', keyless: WORKER_TOOLS[id].keyless };
    if (LOCAL_TOOL_IDS.has(id)) return { mode: 'local' };
    return { mode: 'unsupported' };
}

export async function generateWorkerCode(selectedTools) {
    const customTools = await getCustomTools();
    const picked = selectedTools.map(id => {
        if (id.startsWith('custom-')) {
            return customTools.find(t => t.id === id);
        }
        return TOOLS_CATALOG.find(t => t.id === id);
    }).filter(Boolean);
    // 只放進真的能在 Worker 上運作的工具，避免 AI 呼叫到只會回傳「尚未實作」的工具
    const tools = picked.filter(t => getToolSupport(t.id).mode === 'worker');

    const toolDefinitions = tools.map(t => generateToolDefinition(t)).join(',\n');
    const executeCases = tools.map(t => generateExecuteCase(t)).join('\n');

    const imports = tools.some(t => t.id === 'fortune_ziwei') ? "import { analyzeBirth } from './ziwei-engine.js';\n\n" : '';

    return `// MCP Worker - 由神秘門生成
// 包含 ${tools.length} 個工具：${tools.map(t => t.displayName).join('、')}
${imports}
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

        // 驗證：所有端點都需要 Authorization: Bearer <MCP_API_KEY>（在 App 的 MCP 設定中填入同一組金鑰）
        if (!env.MCP_API_KEY) {
            return Response.json(
                { error: 'Worker 尚未設定 MCP_API_KEY（請執行 wrangler secret put MCP_API_KEY）' },
                { status: 503, headers: corsHeaders }
            );
        }
        const given = (request.headers.get('Authorization') || '').replace(/^Bearer\\s+/i, '');
        if (!safeEqual(given, env.MCP_API_KEY)) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        if (url.pathname === '/health' && request.method === 'GET') {
            return Response.json({ ok: true, tools: getTools().length }, { headers: corsHeaders });
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

function safeEqual(a, b) {
    const enc = new TextEncoder();
    const x = enc.encode(a);
    const y = enc.encode(b);
    let diff = x.length ^ y.length;
    for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
    return diff === 0;
}

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
    if (tool.id.startsWith('custom-')) {
        return tool.code || `// 自定義工具
            return { success: true, args };`;
    }
    
    switch (tool.id) {
        case 'daily_weather':
            return `// 有設定 OPENWEATHER_API_KEY 時使用 OpenWeatherMap；沒有時使用免費、免金鑰的 Open-Meteo
const unit = args.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
const city = String(args.city || '').trim();
if (!city) return { success: false, error: '請提供城市名稱' };
try {
    if (env.OPENWEATHER_API_KEY) {
        const weatherRes = await fetch(
            \`https://api.openweathermap.org/data/2.5/weather?q=\${encodeURIComponent(city)}&appid=\${env.OPENWEATHER_API_KEY}&units=\${unit === 'fahrenheit' ? 'imperial' : 'metric'}\`
        );
        const weatherData = await weatherRes.json();
        if (!weatherRes.ok || (weatherData.cod && Number(weatherData.cod) !== 200)) {
            return { success: false, error: weatherData.message || '無法取得天氣資料' };
        }
        return {
            success: true,
            city: weatherData.name,
            temp: weatherData.main.temp,
            feels_like: weatherData.main.feels_like,
            humidity: weatherData.main.humidity,
            description: weatherData.weather?.[0]?.description || '',
            unit
        };
    }
    const WEATHER_CODES = { 0: '晴朗', 1: '大致晴朗', 2: '局部多雲', 3: '陰天', 45: '霧', 48: '霧凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪', 80: '陣雨', 81: '陣雨', 82: '強陣雨', 95: '雷雨', 96: '雷雨夾冰雹', 99: '強雷雨夾冰雹' };
    let place = null;
    for (const name of [city, city + '市', city + '縣']) {
        const geoRes = await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(name)}&count=1&language=zh\`);
        const geo = await geoRes.json();
        place = geo.results && geo.results[0];
        if (place) break;
    }
    if (!place) return { success: false, error: \`找不到城市：\${city}\` };
    const wxRes = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${place.latitude}&longitude=\${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&temperature_unit=\${unit}&timezone=auto\`);
    const wx = await wxRes.json();
    if (!wxRes.ok || !wx.current) return { success: false, error: '無法取得天氣資料' };
    return {
        success: true,
        city: place.name,
        country: place.country || '',
        temp: wx.current.temperature_2m,
        feels_like: wx.current.apparent_temperature,
        humidity: wx.current.relative_humidity_2m,
        description: WEATHER_CODES[wx.current.weather_code] || '未知',
        unit
    };
} catch (error) {
    return { success: false, error: error.message || '天氣服務暫時無法使用' };
}`;

        case 'daily_recipe':
            return `// 有設定 SPOONACULAR_API_KEY 時使用 Spoonacular；沒有時使用免費的 TheMealDB（只支援英文料理名稱）
const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 10);
try {
    if (env.SPOONACULAR_API_KEY) {
        const recipeRes = await fetch(
            \`https://api.spoonacular.com/recipes/complexSearch?query=\${encodeURIComponent(args.query)}&number=\${limit}&apiKey=\${env.SPOONACULAR_API_KEY}\`
        );
        const recipeData = await recipeRes.json();
        if (!recipeRes.ok) return { success: false, error: recipeData.message || '食譜查詢失敗' };
        return {
            success: true,
            source: 'Spoonacular',
            results: (recipeData.results || []).map(r => ({ id: r.id, title: r.title, image: r.image }))
        };
    }
    const mealRes = await fetch(\`https://www.themealdb.com/api/json/v1/1/search.php?s=\${encodeURIComponent(args.query)}\`);
    const mealData = await mealRes.json();
    const meals = (mealData.meals || []).slice(0, limit);
    return {
        success: true,
        source: 'TheMealDB',
        ...(meals.length === 0 ? { note: '沒有找到結果。免費來源只支援英文料理名稱，例如 chicken、pasta' } : {}),
        results: meals.map(m => ({
            id: m.idMeal,
            title: m.strMeal,
            category: m.strCategory,
            area: m.strArea,
            image: m.strMealThumb,
            instructions: (m.strInstructions || '').slice(0, 600)
        }))
    };
} catch (error) {
    return { success: false, error: error.message || '食譜服務暫時無法使用' };
}`;

        case 'shop_sanitary_pads':
            return `return {
                success: false,
                error: '購物功能尚未實作，需要串接電商 API',
                orderId: null,
                product: \`\${args.brand || '好自在'} \${args.type || '日用'}\`,
                quantity: args.quantity || 1,
                status: '未實作'
            };`;

        case 'health_period_log':
        case 'health_mood_track':
        case 'health_medication':
        case 'finance_expense':
        case 'memory_save':
        case 'memory_retrieve':
        case 'daily_reminder':
        case 'social_calendar':
            return `return {
                success: false,
                error: '這個工具需要存取 App 內的資料，已改為在 App 內直接執行。請到 App 的「設定 → MCP 工具整合 → App 內建工具」啟用，不需要部署 Worker。',
                tool: '${tool.name}'
            };`;

        case 'smart_light':
            return `return {
                success: false,
                error: '智慧燈光控制尚未實作，需要串接智慧家居平台',
                room: args.room,
                action: args.action,
                brightness: args.brightness || 100,
                executed: false
            };`;

        case 'smart_ac':
            return `return {
                success: false,
                error: '智慧空調控制尚未實作，需要串接智慧家居平台',
                room: args.room,
                temperature: args.temperature || 24,
                mode: args.mode || 'cool',
                executed: false
            };`;

        case 'smart_music':
        case 'entertainment_music_search':
            return `// 需要設定 SPOTIFY_API_KEY 或 SPOTIFY_ACCESS_TOKEN
            if (!env.SPOTIFY_API_KEY && !env.SPOTIFY_ACCESS_TOKEN) {
                return { success: false, error: '尚未設定 Spotify API 憑證' };
            }
            try {
                const musicRes = await fetch(
                    \`https://api.spotify.com/v1/search?q=\${encodeURIComponent(args.query)}&type=track&limit=\${args.limit || 10}\`,
                    { headers: { 'Authorization': \`Bearer \${env.SPOTIFY_ACCESS_TOKEN || ''}\` } }
                );
                const musicData = await musicRes.json();
                if (!musicRes.ok) {
                    return { success: false, error: musicData.error?.message || '音樂搜尋失敗' };
                }
                return {
                    success: true,
                    results: (musicData.tracks?.items || []).map(t => ({
                        name: t.name,
                        artist: t.artists?.[0]?.name || '',
                        album: t.album?.name || '',
                        preview_url: t.preview_url
                    }))
                };
            } catch (error) {
                return { success: false, error: error.message || '音樂服務暫時無法使用' };
            }`;

        case 'entertainment_anime':
            return `// 先用 AniList（GraphQL）；AniList 會封鎖部分雲端 IP，失敗時依序改用 Jikan（MyAnimeList 非官方 API）與 Kitsu。皆免費、免金鑰
const STATUS = { airing: 'RELEASING', finished: 'FINISHED', upcoming: 'NOT_YET_RELEASED' };
const JIKAN_STATUS = { airing: 'airing', finished: 'complete', upcoming: 'upcoming' };
const seasonMatch = /^(\\d{4})-(winter|spring|summer|fall)$/i.exec(String(args.season || ''));
let anilistError = '';
try {
    // 沒有值的條件要整個省略（送 null 會被 AniList 當成「欄位必須是空的」）
    const variables = {};
    if (args.query) variables.search = args.query;
    if (seasonMatch) { variables.season = seasonMatch[2].toUpperCase(); variables.seasonYear = parseInt(seasonMatch[1], 10); }
    if (STATUS[args.status]) variables.status = STATUS[args.status];
    const query = \`
        query ($search: String, $season: MediaSeason, $seasonYear: Int, $status: MediaStatus) {
            Page(perPage: 5) {
                media(search: $search, season: $season, seasonYear: $seasonYear, status: $status, type: ANIME, sort: POPULARITY_DESC) {
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
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' },
        body: JSON.stringify({ query, variables })
    });
    const animeData = await animeRes.json();
    if (animeRes.ok && !animeData.errors) {
        return {
            success: true,
            source: 'AniList',
            results: (animeData.data?.Page?.media || []).map(m => ({
                title: m.title?.native || m.title?.romaji || m.title?.english || '',
                romaji: m.title?.romaji || '',
                episodes: m.episodes,
                status: m.status,
                averageScore: m.averageScore,
                genres: m.genres || []
            }))
        };
    }
    anilistError = (animeData.errors || []).map(err => err.message).join(',') || \`HTTP \${animeRes.status}\`;
} catch (error) {
    anilistError = error.message || 'AniList 無法連線';
}
let jikanError = '';
try {
    const jikanUrl = seasonMatch
        ? \`https://api.jikan.moe/v4/seasons/\${seasonMatch[1]}/\${seasonMatch[2].toLowerCase()}?limit=5\`
        : \`https://api.jikan.moe/v4/anime?q=\${encodeURIComponent(args.query || '')}&limit=5&order_by=popularity\${JIKAN_STATUS[args.status] ? '&status=' + JIKAN_STATUS[args.status] : ''}\`;
    const jikanRes = await fetch(jikanUrl, { headers: { 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' } });
    const jikanData = await jikanRes.json();
    if (jikanRes.ok && Array.isArray(jikanData.data)) {
        return {
            success: true,
            source: 'Jikan',
            results: jikanData.data.slice(0, 5).map(m => ({
                title: m.title_japanese || m.title || '',
                romaji: m.title || '',
                episodes: m.episodes,
                status: m.status,
                averageScore: m.score,
                genres: (m.genres || []).map(g => g.name)
            }))
        };
    }
    jikanError = jikanData.message || ('HTTP ' + jikanRes.status);
} catch (error) {
    jikanError = error.message || 'Jikan 無法連線';
}
// 最後備援：Kitsu（免費、免金鑰）
try {
    const KITSU_STATUS = { airing: 'current', finished: 'finished', upcoming: 'upcoming' };
    const kitsuParams = new URLSearchParams({ 'page[limit]': '5', sort: '-userCount' });
    if (args.query) kitsuParams.set('filter[text]', args.query);
    if (seasonMatch) { kitsuParams.set('filter[season]', seasonMatch[2].toLowerCase()); kitsuParams.set('filter[seasonYear]', seasonMatch[1]); }
    if (KITSU_STATUS[args.status]) kitsuParams.set('filter[status]', KITSU_STATUS[args.status]);
    const kitsuRes = await fetch('https://kitsu.io/api/edge/anime?' + kitsuParams, { headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' } });
    const kitsuData = await kitsuRes.json();
    if (!kitsuRes.ok || !Array.isArray(kitsuData.data)) {
        return { success: false, error: \`動漫查詢失敗（AniList：\${anilistError}；Jikan：\${jikanError}；Kitsu：HTTP \${kitsuRes.status}）\` };
    }
    return {
        success: true,
        source: 'Kitsu',
        results: kitsuData.data.map(({ attributes: m }) => ({
            title: m.titles?.ja_jp || m.canonicalTitle || '',
            romaji: m.titles?.en_jp || m.canonicalTitle || '',
            episodes: m.episodeCount,
            status: m.status,
            averageScore: m.averageRating ? Math.round(parseFloat(m.averageRating)) : null,
            genres: []
        }))
    };
} catch (error) {
    return { success: false, error: \`動漫查詢失敗（AniList：\${anilistError}；Jikan：\${jikanError}；Kitsu：\${error.message}）\` };
}`;

        case 'entertainment_game_price':
            return `// CheapShark API（免費、免金鑰，涵蓋 PC 商店；價格為美元）
try {
    const gameRes = await fetch(\`https://www.cheapshark.com/api/1.0/games?title=\${encodeURIComponent(args.game)}&limit=5\`, {
        headers: { 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' }
    });
    const gameData = await gameRes.json();
    if (!gameRes.ok || !Array.isArray(gameData)) {
        return { success: false, error: '遊戲價格服務回傳了非預期的內容' };
    }
    return {
        success: true,
        currency: 'USD',
        ...(args.platform && args.platform !== 'steam' ? { note: '這個免費來源只涵蓋 PC 商店，不支援 ' + args.platform } : {}),
        results: gameData.slice(0, 5).map(g => ({
            title: g.external,
            cheapestPrice: Number(g.cheapest),
            dealLink: \`https://www.cheapshark.com/redirect?dealID=\${g.cheapestDealID}\`
        }))
    };
} catch (error) {
    return { success: false, error: error.message || '遊戲價格查詢暫時無法使用' };
}`;

        case 'work_translate':
            return `// 優先使用 Cloudflare Workers AI（免費額度、不依賴外部服務）；沒有綁定 AI 或失敗時改用 MyMemory（免費但有共用的每日額度）
const text = String(args.text || '');
const target = String(args.targetLang || '').trim();
if (!text.trim() || !target) return { success: false, error: '請提供要翻譯的文字與目標語言' };
if (text.length > 450) return { success: false, error: '文字太長，請分段翻譯（每段 450 字元以內）' };
const LANG_NAMES = { en: 'english', zh: 'chinese', 'zh-tw': 'chinese', 'zh-cn': 'chinese', ja: 'japanese', ko: 'korean', fr: 'french', de: 'german', es: 'spanish', it: 'italian', pt: 'portuguese', ru: 'russian', th: 'thai', vi: 'vietnamese', id: 'indonesian', ar: 'arabic' };
const targetName = LANG_NAMES[target.toLowerCase()];
let aiError = '';
if (env.AI && targetName) {
    try {
        const sourceName = /[぀-ヿ]/.test(text) ? 'japanese' : /[가-힯]/.test(text) ? 'korean' : /[一-鿿]/.test(text) ? 'chinese' : 'english';
        if (sourceName === targetName) return { success: true, original: text, translated: text, targetLang: target, source: '（來源與目標語言相同）' };
        const aiRes = await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: sourceName, target_lang: targetName });
        const translated = aiRes && (aiRes.translated_text || aiRes.translation || aiRes.text);
        if (translated) return { success: true, original: text, translated, targetLang: target, source: 'Cloudflare Workers AI' };
        aiError = '模型沒有回傳翻譯';
    } catch (error) {
        aiError = error.message || 'Workers AI 失敗';
    }
}
try {
    const trRes = await fetch(\`https://api.mymemory.translated.net/get?q=\${encodeURIComponent(text)}&langpair=\${encodeURIComponent('Autodetect|' + target)}\`);
    const trData = await trRes.json();
    if (!trRes.ok || (trData.responseStatus && Number(trData.responseStatus) !== 200)) {
        return { success: false, error: \`\${trData.responseDetails || '翻譯失敗'}\${aiError ? '（Workers AI：' + aiError + '）' : ''}\` };
    }
    return { success: true, original: text, translated: trData.responseData?.translatedText || '', targetLang: target, source: 'MyMemory' };
} catch (error) {
    return { success: false, error: error.message || '翻譯服務暫時無法使用' };
}`;

        case 'work_wiki':
            return `// MediaWiki API（免費）
            try {
                const wikiRes = await fetch(
                    \`https://\${args.lang || 'zh'}.wikipedia.org/w/api.php?action=query&list=search&srsearch=\${encodeURIComponent(args.query)}&format=json&origin=*\`,
                    { headers: { 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' } }
                );
                const wikiData = await wikiRes.json();
                const results = Array.isArray(wikiData.query?.search) ? wikiData.query.search : [];
                return {
                    success: true,
                    results: results.slice(0, 5).map(r => ({
                        title: r.title,
                        snippet: r.snippet.replace(/<[^>]+>/g, ''),
                        link: \`https://\${args.lang || 'zh'}.wikipedia.org/wiki/\${encodeURIComponent(r.title)}\`
                    }))
                };
            } catch (error) {
                return { success: false, error: error.message || '維基百科查詢暫時無法使用' };
            }`;

        case 'work_notion':
            return `// 需要設定 NOTION_API_KEY 和 NOTION_DATABASE_ID
            if (!env.NOTION_API_KEY || !env.NOTION_DATABASE_ID) {
                return { success: false, error: '尚未設定 NOTION_API_KEY 或 NOTION_DATABASE_ID' };
            }
            try {
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
                            Title: { title: [{ text: { content: args.title || '' } }] },
                            Tags: { multi_select: (args.tags || []).map(t => ({ name: t })) }
                        }
                    })
                });
                const notionData = await notionRes.json();
                if (!notionRes.ok) {
                    return { success: false, error: notionData.message || 'Notion 寫入失敗' };
                }
                return { success: true, pageId: notionData.id, url: notionData.url };
            } catch (error) {
                return { success: false, error: error.message || 'Notion 服務暫時無法使用' };
            }`;

        case 'fortune_ziwei':
            return `// 排盤引擎在 src/ziwei-engine.js（以 iztro 交叉驗證過的真實計算，沒有任何假資料）
                return await analyzeBirth({
                    birth_date: args.birth_date,
                    birth_time: args.birth_time,
                    birth_location: args.birth_location,
                    calendar_type: args.calendar_type || 'solar',
                    gender: args.gender
                });`;

        default:
            return `// 尚未支援於 Worker 環境: ${tool.name}
            return {
                success: false,
                error: '此工具尚未實作於 Worker 環境',
                tool: '${tool.name}'
            };`;
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

    // 翻譯工具優先使用 Cloudflare Workers AI（免費額度），需要綁定 AI
    if (selectedTools.includes('work_translate')) {
        config += `
[ai]
binding = "AI"
`;
    }

    config += `
# 必填：存取金鑰（App 的 MCP 設定要填同一組）。沒設定時 Worker 會拒絕所有請求
#   wrangler secret put MCP_API_KEY
`;
    if (needsApiKey) {
        config += `
# 需要金鑰的工具，使用 Secrets 管理：
# wrangler secret put SPOTIFY_ACCESS_TOKEN
# wrangler secret put NOTION_API_KEY
# ...等
`;
    }

    return config;
}

export function generatePackageJson(selectedTools = []) {
    const dependencies = {};
    for (const id of selectedTools) Object.assign(dependencies, WORKER_TOOLS[id]?.dependencies || {});
    const pkg = {
        name: 'siios-mcp-worker',
        version: '1.0.0',
        private: true,
        scripts: { deploy: 'wrangler deploy', dev: 'wrangler dev', tail: 'wrangler tail' },
        ...(Object.keys(dependencies).length ? { dependencies } : {}),
        devDependencies: { wrangler: '^3.0.0' }
    };
    return JSON.stringify(pkg, null, 2);
}

export function generateReadme(selectedTools) {
    const tools = selectedTools.map(id => TOOLS_CATALOG.find(t => t.id === id)).filter(t => t && getToolSupport(t.id).mode === 'worker');

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

### 3. 設定 Secrets

**必填：** \`MCP_API_KEY\` — 自己產生一組長亂數。沒有設定時 Worker 會拒絕所有請求，避免任何人知道網址就能呼叫你的工具。

\`\`\`bash
wrangler secret put MCP_API_KEY
\`\`\`

${tools.filter(t => !getToolSupport(t.id).keyless && t.requires?.length > 0).map(t => `- ${t.displayName} 需要：${t.requires.join(', ')}`).join('\n') || '其餘工具都使用免費、免金鑰的服務，不需要其他設定。'}

### 4. 部署

\`\`\`bash
npm run deploy
\`\`\`

### 5. 在 Siios PWA 設定

1. 開啟「設定」→「MCP 工具整合」
2. 新增 MCP 伺服器
3. 輸入 Worker URL，以及上一步設定的 \`MCP_API_KEY\`（填在 API Key 欄位）

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
│   ├── index.js      # Worker 主程式
│   └── ziwei-engine.js  # （有選紫微斗數才有）排盤引擎
├── wrangler.toml     # Cloudflare 設定
└── package.json
\`\`\`
`;
}

export async function generateZipContent(selectedTools) {
    return {
        'src/index.js': await generateWorkerCode(selectedTools),
        'wrangler.toml': generateWranglerConfig(selectedTools),
        'package.json': generatePackageJson(selectedTools),
        'README.md': generateReadme(selectedTools),
        // 工具附帶的程式檔（例如紫微斗數的排盤引擎）
        ...Object.fromEntries(selectedTools.flatMap(id => Object.entries(WORKER_TOOLS[id]?.files || {})))
    };
}