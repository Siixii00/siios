// Discord Bot Worker - 由神秘門生成
// 實現 PWA 與 Discord 的雙向同步
// 支持世界書、角色設定、記憶系統

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

        // Discord Webhook 端點（接收 Discord 事件）
        if (url.pathname === '/discord/webhook' && request.method === 'POST') {
            try {
                const event = await request.json();
                return await handleDiscordEvent(event, env);
            } catch (error) {
                return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
            }
        }

        // 發送訊息到 Discord
        if (url.pathname === '/discord/send' && request.method === 'POST') {
            try {
                const { channel_id, content, character_id } = await request.json();
                const result = await sendDiscordMessage(channel_id, content, character_id, env);
                return Response.json({ success: true, result }, { headers: corsHeaders });
            } catch (error) {
                return Response.json({ success: false, error: error.message }, { status: 400, headers: corsHeaders });
            }
        }

        // 獲取 Discord 對話歷史
        if (url.pathname === '/discord/history' && request.method === 'GET') {
            try {
                const channel_id = url.searchParams.get('channel_id');
                const limit = parseInt(url.searchParams.get('limit') || '50');
                const messages = await getDiscordHistory(channel_id, limit, env);
                return Response.json({ success: true, messages }, { headers: corsHeaders });
            } catch (error) {
                return Response.json({ success: false, error: error.message }, { status: 400, headers: corsHeaders });
            }
        }

        // 同步到 PWA（存儲到 D1 Database）
        if (url.pathname === '/sync/pwa' && request.method === 'POST') {
            try {
                const { chat_id, message, role, discord_user_id } = await request.json();
                await syncToPWA(chat_id, message, role, discord_user_id, env);
                return Response.json({ success: true }, { headers: corsHeaders });
            } catch (error) {
                return Response.json({ success: false, error: error.message }, { status: 400, headers: corsHeaders });
            }
        }

        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
};

// 處理 Discord 事件
async function handleDiscordEvent(event, env) {
    if (event.type === 1) {
        return Response.json({ type: 1 });
    }

    if (event.type === 0) {
        return Response.json({ status: 'ok' });
    }

    if (event.t === 'MESSAGE_CREATE') {
        const message = event.d;
        
        if (message.author.bot) {
            return Response.json({ status: 'ignored' });
        }

        // 🎯 核心功能：識別 Discord 用戶對應的 PWA 用戶
        const userBinding = await env.DB.prepare(`
            SELECT * FROM discordUserBindings
            WHERE discord_user_id = ?
        `).bind(message.author.id).first();

        let userId = null;
        let characterId = null;
        let userDisplayName = message.author.username;

        if (userBinding) {
            // 用戶已綁定，使用綁定的用戶 ID 和角色 ID
            userId = userBinding.user_id;
            characterId = userBinding.character_id;
            userDisplayName = userBinding.user_display_name || message.author.username;
            
            console.log(`[Discord] 已識別用戶: Discord ${message.author.username} -> PWA User ${userId}, Character ${characterId}`);
        } else {
            // 用戶未綁定，檢查頻道映射
            const mapping = await env.DB.prepare(`
                SELECT character_id FROM discord_channel_mappings
                WHERE channel_id = ?
            `).bind(message.channel_id).first();
            
            characterId = mapping?.character_id;
            console.log(`[Discord] 未綁定用戶: Discord ${message.author.username}, 使用頻道映射角色 ${characterId}`);
        }

        // 存儲用戶訊息（包含用戶身份信息）
        await env.DB.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, metadata)
            VALUES (?, ?, 'user', ?, ?, ?)
        `).bind(
            message.id,
            characterId || message.channel_id,
            message.content,
            new Date(message.timestamp).toISOString(),
            JSON.stringify({
                source: 'discord',
                author: message.author.username,
                author_id: message.author.id,
                channel_id: message.channel_id,
                bound_user_id: userId,
                user_display_name: userDisplayName
            })
        ).run();

        // 使用完整的上下文構建邏輯生成回覆（包含用戶身份信息）
        const aiResponse = await generateAIResponseWithContext(message, characterId, userId, userDisplayName, env);

        // 發送回覆到 Discord
        await sendDiscordMessage(message.channel_id, aiResponse.content, characterId, env);

        // 存儲 AI 回覆
        await env.DB.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, metadata)
            VALUES (?, ?, 'assistant', ?, ?, ?)
        `).bind(
            'ai-' + Date.now(),
            characterId || message.channel_id,
            aiResponse.content,
            new Date().toISOString(),
            JSON.stringify({
                source: 'discord',
                channel_id: message.channel_id,
                character_id: characterId,
                responding_to_user: userId,
                responding_to_discord_user: message.author.id
            })
        ).run();

        return Response.json({ status: 'processed' });
    }

    return Response.json({ status: 'unknown_event' });
}

// 使用完整上下文生成 AI 回覆（與 PWA 一致）
async function generateAIResponseWithContext(message, characterId, userId, userDisplayName, env) {
    const chatId = characterId || message.channel_id;
    
    // 1. 獲取角色設定
    let characterData = null;
    if (characterId) {
        characterData = await env.DB.prepare(`
            SELECT * FROM characters WHERE id = ?
        `).bind(characterId).first();
    }

    // 2. 獲取用戶設定（如果已綁定）
    let userData = null;
    if (userId) {
        userData = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(userId).first();
    }

    // 3. 獲取世界書設定（包含用戶特定的世界書）
    const worldInfoEntries = await loadWorldInfoContext(chatId, message.content, characterId, userId, env);

    // 4. 獲取對話歷史
    const history = await env.DB.prepare(`
        SELECT * FROM messages 
        WHERE chat_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 10
    `).bind(chatId).all();

    // 5. 構建系統訊息（與 PWA 的 buildMessages 邏輯一致）
    const systemMessages = [];

    // 5.1 添加用戶身份信息（如果有綁定）
    if (userId && userDisplayName) {
        systemMessages.push({
            role: 'system',
            content: `[User Identity]\nThis user is identified as "${userDisplayName}" (User ID: ${userId}) from Discord.\nTreat them consistently across all platforms.`
        });
    }

    // 5.2 添加世界書前置內容
    const frontEntries = worldInfoEntries.filter(e => e.priority === 'front');
    const middleEntries = worldInfoEntries.filter(e => e.priority === 'middle');
    const backEntries = worldInfoEntries.filter(e => e.priority === 'back');

    for (const entry of frontEntries) {
        if (entry.isForbidden) {
            systemMessages.push({
                role: 'system',
                content: `[FORBIDDEN]\n${entry.content}\n[/FORBIDDEN]`
            });
        } else {
            systemMessages.push({
                role: 'system',
                content: `[${entry.name}]\n${entry.content}`
            });
        }
    }

    // 5.3 添加角色人格設定
    let promptContent = '';
    if (characterData) {
        if (characterData.personality) {
            promptContent += characterData.personality;
        }
        if (characterData.scenario) {
            promptContent += '\n\n場景設定:\n' + characterData.scenario;
        }
    }

    if (promptContent) {
        systemMessages.push({
            role: 'system',
            content: promptContent
        });
    }

    // 5.4 添加用戶特定設定（如果有綁定）
    if (userData && userData.mask) {
        systemMessages.push({
            role: 'system',
            content: `[User Mask]\n${userData.mask}`
        });
    }

    // 5.5 添加世界書中置內容
    for (const entry of middleEntries) {
        systemMessages.push({
            role: 'system',
            content: `[${entry.name}]\n${entry.content}`
        });
    }

    // 5.6 添加對話歷史
    const conversationMessages = history.results.reverse().map(m => ({
        role: m.role,
        content: m.content
    }));

    // 5.7 添加用戶訊息
    conversationMessages.push({
        role: 'user',
        content: message.content
    });

    // 5.8 添加世界書後置內容
    for (const entry of backEntries) {
        systemMessages.push({
            role: 'system',
            content: `[${entry.name}]\n${entry.content}`
        });
    }

    // 6. 合併所有訊息
    const allMessages = [...systemMessages, ...conversationMessages];

    // 7. 調用 AI API
    const response = await fetch(`${env.AI_API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.AI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: env.AI_MODEL || 'gpt-3.5-turbo',
            messages: allMessages,
            temperature: 0.7,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0].message.content
    };
}

// 載入世界書內容（與 PWA 的 loadWorldInfoContext 邏輯一致）
async function loadWorldInfoContext(chatId, userMessage, characterId, userId, env) {
    const entries = [];

    try {
        // 1. 全局設定
        const globalSettings = await env.DB.prepare(`
            SELECT * FROM globalSettings
            WHERE enabled = 1
            ORDER BY priority DESC
        `).all();

        globalSettings.results.forEach(entry => {
            // 檢查關鍵詞匹配
            if (!entry.keys || entry.keys.split(',').some(key => 
                userMessage.toLowerCase().includes(key.trim().toLowerCase())
            )) {
                entries.push({
                    name: entry.name,
                    content: entry.content,
                    priority: entry.priority || 'middle',
                    isForbidden: false
                });
            }
        });

        // 2. 全局禁用詞
        const globalForbidden = await env.DB.prepare(`
            SELECT * FROM globalForbidden
            WHERE enabled = 1
        `).all();

        globalForbidden.results.forEach(entry => {
            entries.push({
                name: entry.name,
                content: entry.content,
                priority: 'front',
                isForbidden: true
            });
        });

        // 3. 用戶特定的世界書（如果有綁定用戶）
        if (userId) {
            const userWorldInfo = await env.DB.prepare(`
                SELECT * FROM worldInfo
                WHERE user_id = ? AND enabled = 1
                ORDER BY priority DESC
            `).bind(userId).all();

            userWorldInfo.results.forEach(entry => {
                if (!entry.keys || entry.keys.split(',').some(key => 
                    userMessage.toLowerCase().includes(key.trim().toLowerCase())
                )) {
                    entries.push({
                        name: entry.name,
                        content: entry.content,
                        priority: entry.priority || 'middle',
                        isForbidden: false
                    });
                }
            });
        }

        // 4. 角色特定的世界書（如果有）
        if (characterId) {
            const characterEntries = await env.DB.prepare(`
                SELECT * FROM worldInfo
                WHERE character_id = ? AND enabled = 1
                ORDER BY priority DESC
            `).bind(characterId).all();

            characterEntries.results.forEach(entry => {
                if (!entry.keys || entry.keys.split(',').some(key => 
                    userMessage.toLowerCase().includes(key.trim().toLowerCase())
                )) {
                    entries.push({
                        name: entry.name,
                        content: entry.content,
                        priority: entry.priority || 'middle',
                        isForbidden: false
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading world info:', error);
        // 即使出錯也繼續，使用基本的對話歷史
    }

    return entries;
}

// 發送 Discord 訊息
async function sendDiscordMessage(channel_id, content, character_id, env) {
    const response = await fetch(
        `https://discord.com/api/v10/channels/${channel_id}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        }
    );

    if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        messageId: data.id,
        channelId: data.channel_id
    };
}

// 獲取 Discord 對話歷史
async function getDiscordHistory(channel_id, limit, env) {
    const response = await fetch(
        `https://discord.com/api/v10/channels/${channel_id}/messages?limit=${limit}`,
        {
            headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
    }

    const messages = await response.json();
    return messages.map(m => ({
        id: m.id,
        author: m.author.username,
        author_id: m.author.id,
        content: m.content,
        timestamp: m.timestamp,
        role: m.author.bot ? 'assistant' : 'user'
    }));
}

// 同步到 PWA
async function syncToPWA(chat_id, message, role, discord_user_id, env) {
    await env.DB.prepare(`
        INSERT INTO messages (id, chat_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        'sync-' + Date.now(),
        chat_id,
        role,
        message,
        new Date().toISOString(),
        JSON.stringify({
            source: 'pwa',
            discord_user_id: discord_user_id
        })
    ).run();
}