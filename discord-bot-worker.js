// Discord Bot Worker - 由神秘門生成
// 實現 PWA 與 Discord 的雙向同步

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
    // 驗證 Discord 簽名（安全性）
    // 實際部署時需要實現簽名驗證

    if (event.type === 1) {
        // Discord Ping
        return Response.json({ type: 1 });
    }

    if (event.type === 0) {
        // 確認事件
        return Response.json({ status: 'ok' });
    }

    // 處理訊息創建事件
    if (event.t === 'MESSAGE_CREATE') {
        const message = event.d;
        
        // 忽略 Bot 自己的訊息
        if (message.author.bot) {
            return Response.json({ status: 'ignored' });
        }

        // 存儲到 D1 Database（與 PWA 共享）
        await env.DB.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, metadata)
            VALUES (?, ?, 'user', ?, ?, ?)
        `).bind(
            message.id,
            message.channel_id, // 使用 channel_id 作為 chat_id
            message.content,
            new Date(message.timestamp).toISOString(),
            JSON.stringify({
                source: 'discord',
                author: message.author.username,
                author_id: message.author.id,
                channel_id: message.channel_id
            })
        ).run();

        // 調用 AI API 生成回覆
        const aiResponse = await generateAIResponse(message, env);

        // 發送回覆到 Discord
        await sendDiscordMessage(message.channel_id, aiResponse.content, null, env);

        // 存儲 AI 回覆
        await env.DB.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, metadata)
            VALUES (?, ?, 'assistant', ?, ?, ?)
        `).bind(
            'ai-' + Date.now(),
            message.channel_id,
            aiResponse.content,
            new Date().toISOString(),
            JSON.stringify({
                source: 'discord',
                channel_id: message.channel_id
            })
        ).run();

        return Response.json({ status: 'processed' });
    }

    return Response.json({ status: 'unknown_event' });
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

// 生成 AI 回覆
async function generateAIResponse(message, env) {
    // 獲取對話歷史
    const history = await env.DB.prepare(`
        SELECT * FROM messages 
        WHERE chat_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 10
    `).bind(message.channel_id).all();

    // 構建訊息上下文
    const messages = history.results.reverse().map(m => ({
        role: m.role,
        content: m.content
    }));

    messages.push({
        role: 'user',
        content: message.content
    });

    // 調用 AI API
    const response = await fetch(`${env.AI_API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.AI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: env.AI_MODEL || 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7
        })
    });

    const data = await response.json();
    return {
        content: data.choices[0].message.content
    };
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