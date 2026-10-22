import { test } from 'node:test';
import assert from 'node:assert/strict';

const worker = (await import(new URL('../../scripts/discord-bot-worker.js', import.meta.url).href)).default;

const snow = (ms, n = 1) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));

// 頻道（由新到舊）：[{ who: 'bot'|'user', content, saved }]，saved 表示這則機器人回覆有存進資料庫
async function run(channel, count = 1) {
    const now = Date.now();
    const messages = channel.map((m, i) => ({ id: snow(now - (i + 1) * 60000), content: m.content, author: { id: m.who === 'bot' ? 'BOT' : 'USER' }, saved: m.saved }));
    // saved 是字串時，同一個字串的訊息是同一筆紀錄（切成多段的長回覆）
    const groups = new Map();
    messages.filter(m => m.author.id === 'BOT' && m.saved).forEach(m => { const k = typeof m.saved === 'string' ? m.saved : m.id; groups.set(k, [...(groups.get(k) || []), m]); });
    const rows = [...groups.values()].map((ms, i) => ({ id: 'row' + i, content: ms.map(m => m.content).reverse().join(''), metadata: JSON.stringify({ chunk_ids: ms.map(m => m.id) }) }));
    const deleted = [], dbDeleted = [];
    const env = {
        DISCORD_BOT_TOKEN: 'x', ACCESS_KEY: 'k',
        DB: {
            prepare(sql) {
                const q = sql.replace(/\s+/g, ' ');
                return {
                    bind: (...args) => ({
                        run: async () => { if (q.startsWith('DELETE FROM messages WHERE id')) dbDeleted.push(args[0]); return {}; },
                        first: async () => (q.includes("'bot_user_id'") ? { cursor: 'BOT' } : q.includes('channel_bindings') ? { character_id: 'char1' } : null),
                        all: async () => ({ results: q.includes("role = 'assistant'") ? rows : [] })
                    }),
                    run: async () => ({}), first: async () => (q.includes("'bot_user_id'") ? { cursor: 'BOT' } : null), all: async () => ({ results: [] })
                };
            }
        }
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url), method = init.method || 'GET';
        if (method === 'GET' && u.includes('/messages?limit=100')) return Response.json(messages.map(({ saved, ...m }) => m));
        if (method === 'DELETE') deleted.push(u.split('/').pop());
        if (u.endsWith('/bulk-delete')) deleted.push(...JSON.parse(init.body).messages);
        return new Response(null, { status: 204 });
    };
    try {
        const res = await worker.fetch(new Request('https://w.test/discord/clear', { method: 'POST', headers: { Authorization: 'Bearer k' }, body: JSON.stringify({ channel_id: 'c1', mode: 'last', count }) }), env, { waitUntil() {} });
        return { body: await res.json(), deleted, dbDeleted, messages };
    } finally { globalThis.fetch = realFetch; }
}

test('刪最後一則：最後一則是沒存進資料庫的英文警告，刪掉的必須是它，不是前面那則正常回覆', async () => {
    const { body, deleted, dbDeleted, messages } = await run([
        { who: 'bot', content: "I'm sorry, but I can't continue with this request.", saved: false },
        { who: 'user', content: '繼續' },
        { who: 'bot', content: '好的，我們繼續吧', saved: true },
        { who: 'user', content: '嗨' }
    ]);
    assert.ok(body.success, JSON.stringify(body));
    assert.deepEqual(deleted, [messages[0].id]);
    assert.deepEqual(dbDeleted, []); // 警告本來就沒存，前面那則不能被誤刪
});

test('刪最後一則：有存進資料庫的正常回覆，Discord 與資料庫都刪', async () => {
    const { deleted, dbDeleted, messages } = await run([
        { who: 'bot', content: '你好呀', saved: true },
        { who: 'user', content: '嗨' }
    ]);
    assert.deepEqual(deleted, [messages[0].id]);
    assert.deepEqual(dbDeleted, ['row0']);
});

test('刪最後一則：有存進資料庫、切成多段的長回覆算同一則（每一段一起刪），前面的不動', async () => {
    const { deleted, dbDeleted, messages } = await run([
        { who: 'bot', content: '第三段', saved: 'long' },
        { who: 'bot', content: '第二段', saved: 'long' },
        { who: 'bot', content: '第一段', saved: 'long' },
        { who: 'user', content: '說個故事' },
        { who: 'bot', content: '更早的回覆', saved: true }
    ]);
    assert.deepEqual(deleted.sort(), [messages[0].id, messages[1].id, messages[2].id].sort());
    assert.equal(dbDeleted.length, 1);
});

test('刪最後一則：沒有資料庫紀錄的連續機器人訊息各自算一則（只刪最新那一則）', async () => {
    const { deleted, messages } = await run([
        { who: 'bot', content: 'Warning B', saved: false },
        { who: 'bot', content: 'Warning A', saved: false },
        { who: 'user', content: 'hi' }
    ]);
    assert.deepEqual(deleted, [messages[0].id]);
});

test('刪最近 2 則：往前數兩則回覆（以使用者訊息分隔）', async () => {
    const { deleted, messages } = await run([
        { who: 'bot', content: 'B2', saved: true },
        { who: 'user', content: 'u2' },
        { who: 'bot', content: 'B1', saved: true },
        { who: 'user', content: 'u1' },
        { who: 'bot', content: 'B0', saved: true }
    ], 2);
    assert.deepEqual(deleted.sort(), [messages[0].id, messages[2].id].sort());
});
