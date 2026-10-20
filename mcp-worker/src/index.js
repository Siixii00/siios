// MCP Worker - 由神秘門生成
// 包含 6 個工具：天氣查詢、食譜搜尋、動漫搜尋、遊戲價格查詢、翻譯、維基查詢

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
        const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
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
        {
            name: 'get_weather',
            description: '查詢指定城市的天氣資訊，讓角色可以根據天氣給出貼心建議',
            parameters: {
                      "type": "object",
                      "properties": {
                                "city": {
                                          "type": "string",
                                          "description": "城市名稱（中文或英文）"
                                },
                                "unit": {
                                          "type": "string",
                                          "enum": [
                                                    "celsius",
                                                    "fahrenheit"
                                          ],
                                          "default": "celsius"
                                }
                      },
                      "required": [
                                "city"
                      ]
            }
        },
        {
            name: 'search_recipe',
            description: '搜尋料理食譜，角色可以根據使用者喜好推薦',
            parameters: {
                      "type": "object",
                      "properties": {
                                "query": {
                                          "type": "string",
                                          "description": "搜尋關鍵字"
                                },
                                "cuisine": {
                                          "type": "string",
                                          "description": "料理類型（如：chinese, japanese）"
                                },
                                "limit": {
                                          "type": "number",
                                          "default": 5
                                }
                      },
                      "required": [
                                "query"
                      ]
            }
        },
        {
            name: 'search_anime',
            description: '搜尋動漫資訊與新番推薦',
            parameters: {
                      "type": "object",
                      "properties": {
                                "query": {
                                          "type": "string",
                                          "description": "動漫名稱"
                                },
                                "season": {
                                          "type": "string",
                                          "description": "季度（如：2024-spring）"
                                },
                                "status": {
                                          "type": "string",
                                          "enum": [
                                                    "airing",
                                                    "finished",
                                                    "upcoming"
                                          ]
                                }
                      },
                      "required": []
            }
        },
        {
            name: 'check_game_price',
            description: '查詢 Steam、Switch 等平台的遊戲價格',
            parameters: {
                      "type": "object",
                      "properties": {
                                "game": {
                                          "type": "string",
                                          "description": "遊戲名稱"
                                },
                                "platform": {
                                          "type": "string",
                                          "enum": [
                                                    "steam",
                                                    "switch",
                                                    "ps",
                                                    "xbox"
                                          ]
                                }
                      },
                      "required": [
                                "game"
                      ]
            }
        },
        {
            name: 'translate',
            description: '翻譯文字到指定語言',
            parameters: {
                      "type": "object",
                      "properties": {
                                "text": {
                                          "type": "string",
                                          "description": "要翻譯的文字"
                                },
                                "targetLang": {
                                          "type": "string",
                                          "description": "目標語言（如：ja, en, zh-TW）"
                                }
                      },
                      "required": [
                                "text",
                                "targetLang"
                      ]
            }
        },
        {
            name: 'search_wiki',
            description: '搜尋維基百科資訊',
            parameters: {
                      "type": "object",
                      "properties": {
                                "query": {
                                          "type": "string",
                                          "description": "搜尋關鍵字"
                                },
                                "lang": {
                                          "type": "string",
                                          "default": "zh",
                                          "description": "語言代碼"
                                }
                      },
                      "required": [
                                "query"
                      ]
            }
        }
    ];
}

async function executeTool(name, args, env) {
    switch (name) {
        case 'get_weather':
            // 有設定 OPENWEATHER_API_KEY 時使用 OpenWeatherMap；沒有時使用免費、免金鑰的 Open-Meteo
const unit = args.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
const city = String(args.city || '').trim();
if (!city) return { success: false, error: '請提供城市名稱' };
try {
    if (env.OPENWEATHER_API_KEY) {
        const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${env.OPENWEATHER_API_KEY}&units=${unit === 'fahrenheit' ? 'imperial' : 'metric'}`
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
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`);
        const geo = await geoRes.json();
        place = geo.results && geo.results[0];
        if (place) break;
    }
    if (!place) return { success: false, error: `找不到城市：${city}` };
    const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&temperature_unit=${unit}&timezone=auto`);
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
}
        case 'search_recipe':
            // 有設定 SPOONACULAR_API_KEY 時使用 Spoonacular；沒有時使用免費的 TheMealDB（只支援英文料理名稱）
const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 10);
try {
    if (env.SPOONACULAR_API_KEY) {
        const recipeRes = await fetch(
            `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(args.query)}&number=${limit}&apiKey=${env.SPOONACULAR_API_KEY}`
        );
        const recipeData = await recipeRes.json();
        if (!recipeRes.ok) return { success: false, error: recipeData.message || '食譜查詢失敗' };
        return {
            success: true,
            source: 'Spoonacular',
            results: (recipeData.results || []).map(r => ({ id: r.id, title: r.title, image: r.image }))
        };
    }
    const mealRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(args.query)}`);
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
}
        case 'search_anime':
            // 先用 AniList（GraphQL）；AniList 會封鎖部分雲端 IP，失敗時依序改用 Jikan（MyAnimeList 非官方 API）與 Kitsu。皆免費、免金鑰
const STATUS = { airing: 'RELEASING', finished: 'FINISHED', upcoming: 'NOT_YET_RELEASED' };
const JIKAN_STATUS = { airing: 'airing', finished: 'complete', upcoming: 'upcoming' };
const seasonMatch = /^(\d{4})-(winter|spring|summer|fall)$/i.exec(String(args.season || ''));
let anilistError = '';
try {
    // 沒有值的條件要整個省略（送 null 會被 AniList 當成「欄位必須是空的」）
    const variables = {};
    if (args.query) variables.search = args.query;
    if (seasonMatch) { variables.season = seasonMatch[2].toUpperCase(); variables.seasonYear = parseInt(seasonMatch[1], 10); }
    if (STATUS[args.status]) variables.status = STATUS[args.status];
    const query = `
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
    `;
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
    anilistError = (animeData.errors || []).map(err => err.message).join(',') || `HTTP ${animeRes.status}`;
} catch (error) {
    anilistError = error.message || 'AniList 無法連線';
}
let jikanError = '';
try {
    const jikanUrl = seasonMatch
        ? `https://api.jikan.moe/v4/seasons/${seasonMatch[1]}/${seasonMatch[2].toLowerCase()}?limit=5`
        : `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(args.query || '')}&limit=5&order_by=popularity${JIKAN_STATUS[args.status] ? '&status=' + JIKAN_STATUS[args.status] : ''}`;
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
        return { success: false, error: `動漫查詢失敗（AniList：${anilistError}；Jikan：${jikanError}；Kitsu：HTTP ${kitsuRes.status}）` };
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
    return { success: false, error: `動漫查詢失敗（AniList：${anilistError}；Jikan：${jikanError}；Kitsu：${error.message}）` };
}
        case 'check_game_price':
            // CheapShark API（免費、免金鑰，涵蓋 PC 商店；價格為美元）
try {
    const gameRes = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(args.game)}&limit=5`, {
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
            dealLink: `https://www.cheapshark.com/redirect?dealID=${g.cheapestDealID}`
        }))
    };
} catch (error) {
    return { success: false, error: error.message || '遊戲價格查詢暫時無法使用' };
}
        case 'translate':
            // 優先使用 Cloudflare Workers AI（免費額度、不依賴外部服務）；沒有綁定 AI 或失敗時改用 MyMemory（免費但有共用的每日額度）
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
    const trRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent('Autodetect|' + target)}`);
    const trData = await trRes.json();
    if (!trRes.ok || (trData.responseStatus && Number(trData.responseStatus) !== 200)) {
        return { success: false, error: `${trData.responseDetails || '翻譯失敗'}${aiError ? '（Workers AI：' + aiError + '）' : ''}` };
    }
    return { success: true, original: text, translated: trData.responseData?.translatedText || '', targetLang: target, source: 'MyMemory' };
} catch (error) {
    return { success: false, error: error.message || '翻譯服務暫時無法使用' };
}
        case 'search_wiki':
            // MediaWiki API（免費）
            try {
                const wikiRes = await fetch(
                    `https://${args.lang || 'zh'}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(args.query)}&format=json&origin=*`,
                    { headers: { 'User-Agent': 'siios-mcp-worker/1.0 (https://github.com/Siixii00/siios)' } }
                );
                const wikiData = await wikiRes.json();
                const results = Array.isArray(wikiData.query?.search) ? wikiData.query.search : [];
                return {
                    success: true,
                    results: results.slice(0, 5).map(r => ({
                        title: r.title,
                        snippet: r.snippet.replace(/<[^>]+>/g, ''),
                        link: `https://${args.lang || 'zh'}.wikipedia.org/wiki/${encodeURIComponent(r.title)}`
                    }))
                };
            } catch (error) {
                return { success: false, error: error.message || '維基百科查詢暫時無法使用' };
            }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
