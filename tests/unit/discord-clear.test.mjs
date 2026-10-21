import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;

// 以 /discord/clear 端點驅動 clearChannelHistory，用假的 D1 與假的 Discord API 觀察執行順序與內容
async function runClear(mode, { recentIds = [], oldIds = [] } = {}) {
    const events = [];
    const env = {
        DISCORD_BOT_TOKEN: 'x', ACCESS_KEY: 'test-key',
        DB: {
            prepare(sql) {
                return {
                    bind: (...args) => ({
                        run: async () => { events.push({ type: 'sql', sql: sql.replace(/\s+/g, ' '), args }); return {}; },
                        first: async () => {
                            if (sql.includes("'bot_user_id'")) return { cursor: 'BOT' };
                            if (sql.includes('channel_bindings')) return { character_id: 'char1' };
                            return null;
                        },
                        all: async () => ({ results: [] })
                    }),
                    run: async () => ({}),
                    first: async () => (sql.includes("'bot_user_id'") ? { cursor: 'BOT' } : null),
                    all: async () => ({ results: [] })
                };
            }
        }
    };
    const now = Date.now();
    const snow = ms => String((BigInt(ms - 1420070400000) << 22n) + 1n);
    const mk = (ms, bot = true) => ({ id: snow(ms), author: { id: bot ? 'BOT' : 'USER' } });
    const messages = [
        ...recentIds.map(h => mk(now - h * 3600 * 1000)),
        ...oldIds.map(d => mk(now - d * 24 * 3600 * 1000)),
        mk(now - 1000, false)
    ].sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
    const realFetch = globalThis.fetch;
    let served = false;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        events.push({ type: 'http', method: init.method || 'GET', url: u, body: init.body });
        if ((init.method || 'GET') === 'GET' && u.includes('/messages?limit=100')) {
            const body = served ? [] : messages; served = true;
            return Response.json(body);
        }
        return new Response(null, { status: 204 });
    };
    try {
        const res = await worker.fetch(new Request('https://w.test/discord/clear', { method: 'POST', headers: { Authorization: 'Bearer test-key' }, body: JSON.stringify({ channel_id: 'chan1', mode }) }), env, { waitUntil() {} });
        return { body: await res.json(), events };
    } finally { globalThis.fetch = realFetch; }
}

const firstIndex = (events, pred) => events.findIndex(pred);

test('清除（chat）：只清對話與對話日誌，不動事實記憶，且資料庫先於 Discord 訊息刪除', async () => {
    const { body, events } = await runClear('chat', { recentIds: [1, 2, 3] });
    assert.ok(body.success, JSON.stringify(body));
    const sqls = events.filter(e => e.type === 'sql').map(e => e.sql);
    assert.ok(sqls.some(s => s.startsWith('DELETE FROM messages')));
    assert.ok(sqls.some(s => s.includes("[Discord 聊天]%") && s.includes("memory_type = 'raw'")));
    assert.ok(!sqls.some(s => s === 'DELETE FROM memories WHERE chat_id = ? OR character_id = ?'), '不該清掉全部記憶');
    const lastSql = events.map((e, i) => e.type === 'sql' ? i : -1).reduce((a, b) => Math.max(a, b));
    const firstDelete = firstIndex(events, e => e.type === 'http' && /bulk-delete|\/messages\/\d+$/.test(e.url));
    assert.ok(firstDelete > lastSql, '資料庫清除必須排在 Discord 刪訊息之前');
});

test('全部清除（all）：連同所有記憶（含 character_id 對得上的）與摘要進度一起清', async () => {
    const { body, events } = await runClear('all', { recentIds: [1] });
    assert.ok(body.success);
    const sqls = events.filter(e => e.type === 'sql');
    const memDeletes = sqls.filter(e => e.sql === 'DELETE FROM memories WHERE chat_id = ? OR character_id = ?');
    assert.deepEqual(memDeletes.map(e => e.args[0]).sort(), ['chan1', 'char1']);
    assert.deepEqual(memDeletes.map(e => e.args[1]).sort(), ['chan1', 'char1']);
    assert.deepEqual(sqls.filter(e => e.sql.startsWith('DELETE FROM botState')).map(e => e.args[0]).sort(), ['last_summary_chan1', 'last_summary_char1']);
});

test('刪除 Discord 訊息：14 天內批次刪除，更舊的逐則刪，不刪別人的訊息', async () => {
    const { events } = await runClear('chat', { recentIds: [1, 2, 3, 4], oldIds: [20] });
    const http = events.filter(e => e.type === 'http');
    const bulk = http.filter(e => e.url.endsWith('/bulk-delete'));
    assert.equal(bulk.length, 1);
    assert.equal(JSON.parse(bulk[0].body).messages.length, 4);
    const single = http.filter(e => e.method === 'DELETE');
    assert.equal(single.length, 1, '只有 20 天前那則要逐則刪');
});

// ───── 思考過程與截斷 ─────
const src = readFileSync(workerUrl, 'utf8');
const H = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ stripReasoning, trimToLastSentence })');

test('stripReasoning：去掉 <think> 區塊，保留實際回覆', () => {
    assert.equal(H.stripReasoning('<think>他在問我心情，我該撒嬌</think>\n*歪頭* 你回來啦？'), '*歪頭* 你回來啦？');
    assert.equal(H.stripReasoning('前面<thinking>a</thinking>中間<THINK>b</THINK>後面'), '前面中間後面');
    assert.equal(H.stripReasoning('<think>\n多行\n思考\n</think>\n\n哈囉'), '哈囉');
});

test('stripReasoning：只有結尾標籤，或思考到一半被截斷', () => {
    assert.equal(H.stripReasoning('先想一下他的意思……\n</think>\n好喔！'), '好喔！');
    assert.equal(H.stripReasoning('你好呀<think>讓我想想接下來要說什麼'), '你好呀');
    assert.equal(H.stripReasoning('<think>全是思考還沒結束'), '');
});

test('stripReasoning：沒有思考標籤的正常回覆原樣保留（包含小於符號與動作斜體）', () => {
    const t = '*笑* 3 < 5 對不對？ <3';
    assert.equal(H.stripReasoning(t), t);
    assert.equal(H.stripReasoning(null), '');
});

test('trimToLastSentence：被截斷時收在最後一個完整句子，不留半句', () => {
    assert.equal(H.trimToLastSentence('今天天氣很好。我們去公園走走吧！然後再去買一杯飲'), '今天天氣很好。我們去公園走走吧！');
    assert.equal(H.trimToLastSentence('完整的一句話。'), '完整的一句話。');
    // 找不到合理的收尾點（前半段都沒有標點）就保持原樣，避免砍掉大半內容
    assert.equal(H.trimToLastSentence('沒有任何標點的一長串字一直延續到被截斷。後'), '沒有任何標點的一長串字一直延續到被截斷。');
});
