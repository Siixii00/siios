// Discord 的記憶怎麼運作：PWA 推上去 → 機器人回覆時怎麼讀 → Discord 上說的話怎麼學 → 兩邊怎麼合併。
// 用 Worker 真正的程式碼，D1 用記憶體 SQLite，Discord 與 AI 用假的 fetch（記下機器人實際送給 AI 的內容）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { extractDislikes, recordDislikes, formatDislikePrompt, mergeDislikeLists, sameThing, findDislikeLeaks } from '../../js/core/dislikes.js';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;
const src = readFileSync(workerUrl, 'utf8');
const W = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ extractDislikes, recordDislikes, formatDislikePrompt, mergeDislikeLists, sameThing, findDislikeLeaks })');

const SCHEMA = `
CREATE TABLE messages (id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, timestamp TEXT, metadata TEXT);
CREATE TABLE characters (id TEXT PRIMARY KEY, name TEXT, personality TEXT, scenario TEXT, nicknames TEXT);
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, mask TEXT, personality TEXT DEFAULT '', speech_style TEXT DEFAULT '', taboos TEXT DEFAULT '[]');
CREATE TABLE worldInfo (id TEXT PRIMARY KEY, name TEXT, content TEXT, keys TEXT, priority TEXT, enabled INTEGER DEFAULT 1, user_id TEXT, character_id TEXT);
CREATE TABLE globalSettings (id TEXT PRIMARY KEY, name TEXT, content TEXT, keys TEXT, priority TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE globalForbidden (id TEXT PRIMARY KEY, name TEXT, content TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE discordUserBindings (discord_user_id TEXT PRIMARY KEY, user_id TEXT, character_id TEXT, user_display_name TEXT, discord_username TEXT);
CREATE TABLE discord_channel_mappings (channel_id TEXT PRIMARY KEY, character_id TEXT);
CREATE TABLE memories (id TEXT PRIMARY KEY, chat_id TEXT, character_id TEXT, content TEXT, memory_type TEXT DEFAULT 'dynamic', importance REAL DEFAULT 0.5, timestamp TEXT, metadata TEXT);
CREATE TABLE channel_bindings (channel_id TEXT PRIMARY KEY, character_id TEXT, guild_id TEXT, updated_at TEXT);
CREATE TABLE botState (key TEXT PRIMARY KEY, cursor TEXT);
CREATE TABLE authorizedUsers (discord_user_id TEXT PRIMARY KEY, authorized_at TEXT);
`;

function makeEnv() {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA);
    db.prepare(`INSERT INTO characters (id, name, personality) VALUES ('char1', '艾爾', '沉穩'), ('char2', '別人', '活潑')`).run();
    db.prepare(`INSERT INTO channel_bindings (channel_id, character_id) VALUES ('chan1', 'char1')`).run();
    for (const [k, v] of [['bot_user_id', 'BOT'], ['commands_registered', '1'], ['last_msg_chan1', '1']]) db.prepare(`INSERT INTO botState (key, cursor) VALUES (?, ?)`).run(k, v);
    db.prepare(`INSERT INTO authorizedUsers (discord_user_id, authorized_at) VALUES ('U1', '2026-01-01')`).run();
    const cfg = { AI_API_URL: 'https://ai.test', AI_API_KEY: 'sk-x', AI_MODEL: 'm', REACTION_PROBABILITY: '0', INTERJECT_PROBABILITY: '0' };
    for (const [k, v] of Object.entries(cfg)) db.prepare(`INSERT INTO globalSettings (id, name, content, keys, priority, enabled) VALUES (?, ?, ?, '', 'middle', 1)`).run('cfg-' + k, 'bot_config_' + k, v);
    const wrap = sql => ({
        bind: (...a) => ({ first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { db.prepare(sql).run(...a); return {}; } }),
        first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => ({})
    });
    return { db, env: { DB: { prepare: wrap }, DISCORD_BOT_TOKEN: 't', DISCORD_APPLICATION_ID: '1', ACCESS_KEY: 'k' } };
}

const ctx = () => { const pending = []; return { waitUntil: p => pending.push(p), done: () => Promise.allSettled(pending) }; };

// PWA 的記憶同步（和 js/core/discord-memory-sync.js 推上去的格式相同）
async function pwaPush(env, memories) {
    const c = ctx();
    const res = await worker.fetch(new Request('https://w.test/sync/memories', { method: 'POST', headers: { Authorization: 'Bearer k', 'Content-Type': 'application/json' }, body: JSON.stringify({ memories }) }), env, c);
    await c.done();
    return res.json();
}
const pwaMem = (id, content, importance = 0.5, character_id = 'char1') => ({ id, chat_id: 'siios-chat', character_id, content, memory_type: 'dynamic', importance, timestamp: Date.now(), metadata: { source: 'siios', platform: 'siios' } });
const pwaDislikes = (items, character_id = 'char1') => ({ id: 'dislikes-' + character_id, chat_id: '', character_id, content: formatDislikePrompt(items), memory_type: 'permanent', importance: 1, timestamp: Date.now(), metadata: { source: 'siios', platform: 'siios', kind: 'dislikes', items } });
const item = (text, count, lastAt = 1000) => ({ id: 'x' + text, text, count, firstAt: lastAt, lastAt, sources: ['chat'] });

// Discord 使用者說話 → 輪詢 → 機器人回覆；回傳機器人實際送給 AI 的內容。scriptedReplies：依序回給機器人的 AI 回覆
let scriptedReplies = null;
let sentToDiscord = [];
async function userSays(env, ...userMessages) {
    const aiCalls = [];
    sentToDiscord = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('/v1/chat/completions')) {
            const body = JSON.parse(init.body);
            if (body.messages.length <= 3) return Response.json({ choices: [{ message: { content: '' } }] });
            aiCalls.push(body);
            return Response.json({ choices: [{ message: { content: scriptedReplies?.length ? scriptedReplies.shift() : '好的，我知道了。' }, finish_reason: 'stop' }] });
        }
        if (u.includes('/channels/chan1/messages?limit=60')) return Response.json([]);
        if (u.includes('/channels/chan1/messages') && (init.method || 'GET') === 'GET') {
            return Response.json(userMessages.map((content, i) => ({ id: String(Date.now() + i), content, channel_id: 'chan1', author: { id: 'U1', username: 'u', bot: false }, timestamp: new Date(Date.now() - 60000 + i * 1000).toISOString(), mentions: [{ id: 'BOT' }] })).reverse());
        }
        if (u.includes('/channels/chan1/messages') && init.method === 'POST') { const content = JSON.parse(init.body).content; sentToDiscord.push(content); return Response.json({ id: 'm1', content }); }
        return Response.json({});
    };
    try {
        const c = ctx();
        await worker.fetch(new Request('https://w.test/poll?key=k'), env, c);
        await c.done();
    } finally { globalThis.fetch = real; }
    return aiCalls;
}

const rowOf = (db, id) => db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
const itemsOf = (db, charId = 'char1') => JSON.parse(rowOf(db, 'dislikes-' + charId)?.metadata || '{}').items || [];

// ───── 1. PWA 推上去的記憶，機器人回覆時怎麼讀 ─────
test('PWA 推上去的一般記憶：機器人會讀到（依重要度）；「討厭的事」不混在一般記憶裡，而是固定放在最後', async () => {
    const { db, env } = makeEnv();
    const normal = Array.from({ length: 80 }, (_, i) => pwaMem('m' + i, `一般記憶第 ${i} 號：今天聊了第${i}件事`, 0.5 + (i % 5) / 20));
    normal.push(pwaMem('important', '用戶的生日是三月七日', 0.95));
    const pushed = await pwaPush(env, [...normal, pwaDislikes([item('香菜', 3), item('被打斷', 1)])]);
    assert.equal(pushed.success, true);

    const [call] = await userSays(env, '今天吃什麼好呢');
    assert.ok(call, '機器人有呼叫 AI');
    const msgs = call.messages;
    const all = msgs.map(m => m.content).join('\n---\n');

    // 一般記憶：高重要度的在、有上限
    assert.ok(all.includes('用戶的生日是三月七日'));
    const memBlock = all.match(/\[Related Memories\]\n([\s\S]*?)(?:\n---|$)/)?.[1] || '';
    assert.ok(memBlock.split('\n').length <= 61, '最多 60 筆');
    assert.ok(!memBlock.includes('香菜'), '討厭的事不混在一般記憶裡（會被壓成一行、被截斷）');

    // 討厭的事：固定在最後一則，保留換行與「反覆強調」
    const last = msgs[msgs.length - 1];
    assert.equal(last.role, 'system');
    assert.match(last.content, /務必在回覆與行動中避開/);
    assert.match(last.content, /- 香菜（特別在意）/);
    assert.match(last.content, /- 被打斷\n/);
    assert.ok(last.content.split('\n').length >= 5, '沒有被壓成一行');
});

test('一般記憶很多、很長時，「討厭的事」也不會被擠掉（它不佔一般記憶的字數額度）', async () => {
    const { env } = makeEnv();
    const big = Array.from({ length: 70 }, (_, i) => pwaMem('b' + i, '很長的記憶：' + '字'.repeat(300) + i, 0.9));
    await pwaPush(env, [...big, pwaDislikes([item('香菜', 2)])]);
    const [call] = await userSays(env, '你好');
    assert.match(call.messages.at(-1).content, /香菜/);
});

test('別的角色的「討厭的事」不會讀到', async () => {
    const { env } = makeEnv();
    await pwaPush(env, [pwaDislikes([item('香菜', 2)], 'char1'), pwaDislikes([item('蟑螂', 5)], 'char2')]);
    const [call] = await userSays(env, '你好');
    const all = call.messages.map(m => m.content).join('\n');
    assert.ok(all.includes('香菜') && !all.includes('蟑螂'));
});

// ───── 2. 在 Discord 上說的話 ─────
test('使用者在 Discord 說「我最討厭香菜」：當場記下，而且這一次的回覆就已經帶著', async () => {
    const { db, env } = makeEnv();
    const [call] = await userSays(env, '我最討厭香菜了');
    assert.deepEqual(itemsOf(db).map(x => [x.text, x.count]), [['香菜', 1]]);
    assert.match(call.messages.at(-1).content, /香菜/);
    const row = rowOf(db, 'dislikes-char1');
    assert.equal(row.memory_type, 'permanent');
    assert.equal(row.importance, 1);
    assert.ok(!row.content.startsWith('[Siios'), '不加平台標籤');
});

test('反覆強調：同一件事再說一次次數增加；「說過很多次」算 2；否定與問句不記', async () => {
    const { db, env } = makeEnv();
    await userSays(env, '我討厭香菜', '你不要走', '我不討厭你', '你討厭香菜嗎？');
    assert.deepEqual(itemsOf(db).map(x => [x.text, x.count]), [['香菜', 1]]);
    const [call] = await userSays(env, '我說過很多次了，我受不了香菜');
    assert.equal(itemsOf(db)[0].count, 3);
    assert.match(call.messages.at(-1).content, /- 香菜（特別在意）/);
});

test('沒通過驗證的人說的話不會被學進去', async () => {
    const { db, env } = makeEnv();
    db.prepare(`DELETE FROM authorizedUsers`).run();
    await userSays(env, '我最討厭香菜了');
    assert.equal(rowOf(db, 'dislikes-char1'), undefined);
});

// ───── 3. 兩邊合併 ─────
test('PWA 推上來的清單和 Discord 學到的合併，不會互相覆蓋；重複同步不會把次數灌水', async () => {
    const { db, env } = makeEnv();
    await userSays(env, '我討厭香菜', '我真的受不了香菜'); // Discord：香菜 2 次
    await pwaPush(env, [pwaDislikes([item('被打斷', 2), item('不吃香菜', 1)])]);
    const merged = itemsOf(db).map(x => [x.text, x.count]).sort();
    assert.equal(merged.length, 2, JSON.stringify(merged));
    assert.ok(merged.some(([t, c]) => /香菜/.test(t) && c === 2));
    assert.ok(merged.some(([t, c]) => t === '被打斷' && c === 2));
    await pwaPush(env, [pwaDislikes([item('被打斷', 2)])]);
    await pwaPush(env, [pwaDislikes([item('被打斷', 2)])]);
    assert.equal(itemsOf(db).find(x => x.text === '被打斷').count, 2, '重複推同樣的內容，次數不會增加');
});

test('PWA 拉取（/sync/chat?memories_only=1）看得到 Discord 學到的清單，PWA 端合併後不丟任何一邊', async () => {
    const { env } = makeEnv();
    await userSays(env, '我討厭香菜');
    const c = ctx();
    const res = await worker.fetch(new Request('https://w.test/sync/chat?character_id=char1&memories_only=1', { headers: { Authorization: 'Bearer k' } }), env, c);
    const data = await res.json();
    const remote = data.memories.find(m => String(m.id).startsWith('dislikes-'));
    assert.ok(remote, '拉得到');
    const remoteItems = JSON.parse(remote.metadata).items;
    const local = [item('被打斷', 4, 5000)];
    const merged = mergeDislikeLists(local, remoteItems);
    assert.deepEqual(merged.map(x => x.text).sort(), ['被打斷', '香菜']);
    assert.deepEqual(mergeDislikeLists(merged, remoteItems).map(x => [x.text, x.count]), merged.map(x => [x.text, x.count]), '合併是冪等的');
});

// ───── 4. Worker 與 PWA 的規則一致 ─────
test('Worker 裡的抽取、記錄、提示詞，和 PWA 的 js/core/dislikes.js 對同樣的輸入結果一致', () => {
    const texts = ['我最討厭香菜了', '我不喜歡被人忽略。', '我真的受不了你一直道歉', '我不吃香菜', '別再提我的前任了', '我超怕蟲子，千萬不要在我面前提', '我不討厭你', '你討厭香菜嗎？', '你不要走', '我說過很多次了，我討厭香菜', '', '今天天氣很好'];
    const j = x => JSON.parse(JSON.stringify(x)); // vm 裡的陣列和這裡不是同一個 realm，先轉成一般物件再比
    for (const t of texts) assert.deepEqual(j(W.extractDislikes(t)), extractDislikes(t), t);
    const now = 1700000000000;
    let a = [], b = [];
    for (const t of texts) {
        const e = extractDislikes(t);
        a = recordDislikes(a, e.phrases, { weight: e.weight, source: 'discord', now });
        b = W.recordDislikes(b, e.phrases, { weight: e.weight, source: 'discord', now });
    }
    const strip = l => l.map(({ id, ...rest }) => rest);
    assert.deepEqual(strip(j(b)), strip(a));
    assert.equal(W.formatDislikePrompt(b), formatDislikePrompt(a));
    assert.ok(W.sameThing('被忽略', '被人忽略') && sameThing('被忽略', '被人忽略'));
    assert.equal(W.mergeDislikeLists([item('a1', 1)], [item('a1', 3)])[0].count, 3);
});

// ───── 5. 不要一直提到討厭的事 ─────
test('模型沒人問卻說「我幫你挑掉了香菜」：機器人會要求重寫一次，用戶看到的是重寫後的回覆', async () => {
    const { env } = makeEnv();
    await pwaPush(env, [pwaDislikes([item('香菜', 3)])]);
    scriptedReplies = ['好喔，我特地幫你挑掉了香菜，放心吃吧。', '嗯，那就吃碗熱湯麵吧，天氣有點涼。'];
    try {
        const calls = await userSays(env, '今天吃什麼好呢');
        assert.equal(calls.length, 2, '重寫了一次');
        const note = calls[1].messages.at(-1);
        assert.equal(note.role, 'system');
        assert.match(note.content, /不自然地提到了用戶不喜歡的「香菜」/);
        assert.match(note.content, /完全不要提到它們，也不要說明你避開了什麼/);
        assert.deepEqual(sentToDiscord.filter(t => !/^⚠/.test(t)), ['嗯，那就吃碗熱湯麵吧，天氣有點涼。']);
    } finally { scriptedReplies = null; }
});

test('用戶自己提到香菜時，機器人正常回應，不會被當成不自然的提及而重寫', async () => {
    const { env } = makeEnv();
    await pwaPush(env, [pwaDislikes([item('香菜', 3)])]);
    scriptedReplies = ['香菜喔……我也不太敢吃，你不喜歡就不要勉強。'];
    try {
        const calls = await userSays(env, '你覺得香菜好吃嗎');
        assert.equal(calls.length, 1);
        assert.ok(sentToDiscord.some(t => t.includes('香菜喔')));
    } finally { scriptedReplies = null; }
});

test('連續兩次都不自然地提到：第三次就直接用，不會無限重試', async () => {
    const { env } = makeEnv();
    await pwaPush(env, [pwaDislikes([item('香菜', 3)])]);
    scriptedReplies = ['我幫你挑掉香菜了。', '香菜我都拿掉了喔。', '香菜真的沒放，放心。'];
    try {
        const calls = await userSays(env, '今天吃什麼好呢');
        assert.equal(calls.length, 3);
        assert.ok(sentToDiscord.some(t => t.includes('香菜真的沒放')));
    } finally { scriptedReplies = null; }
});

test('用戶禁忌（設定裡寫的不喜歡）也帶著「避開即可、不要說明」的提醒', async () => {
    const { db, env } = makeEnv();
    db.prepare(`INSERT INTO users (id, name, taboos) VALUES ('u1', '阿明', ?)`).run(JSON.stringify(['香菜']));
    db.prepare(`INSERT INTO discordUserBindings (discord_user_id, user_id, character_id, user_display_name) VALUES ('U1', 'u1', 'char1', '阿明')`).run();
    const [call] = await userSays(env, '你好');
    const all = call.messages.map(m => m.content).join('\n');
    assert.match(all, /用戶禁忌（避開即可，不要提到它們，也不要說明你避開了什麼）: 香菜/);
});
