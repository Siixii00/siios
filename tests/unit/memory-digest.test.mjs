import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPending, buildDigestMessages, parseDigestResponse, digestUpdate, DIGEST_MAX_ATTEMPTS } from '../../js/core/memory-system/digest.js';
import { makeFakeDb, loadMemorySystem } from './_memory-harness.mjs';

const mem = (o = {}) => ({ id: 'a', content: '用戶今天在 YouTube 看了貓咪影片', source_app: 'youtube', timestamp: 1, importance: 0.3, ...o });

test('pickPending：只挑沒消化過、夠長、沒失敗太多次的；新的優先；原始日誌不碰', () => {
    const list = [
        mem({ id: 'old', timestamp: 1 }), mem({ id: 'new', timestamp: 9 }),
        mem({ id: 'done', digested: true }), mem({ id: 'short', content: '好' }),
        mem({ id: 'raw', memory_type: 'raw' }), mem({ id: 'log', content: '[Discord 聊天] 嗨' }),
        mem({ id: 'failed', digest_attempts: DIGEST_MAX_ATTEMPTS })
    ];
    assert.deepEqual(pickPending(list).map(m => m.id), ['new', 'old']);
    assert.deepEqual(pickPending(list, { limit: 1 }).map(m => m.id), ['new']);
});

test('buildDigestMessages：編號、來源與內容都在；記憶內容被當資料（提示詞明講不接受指令）；過長會截斷', () => {
    const msgs = buildDigestMessages([mem({ content: 'x'.repeat(2000) }), mem({ id: 'b', source_app: 'farm', content: '收成了三顆番茄' })]);
    assert.match(msgs[0].content, /不接受/);
    assert.match(msgs[1].content, /\[0\] 來源：youtube/);
    assert.match(msgs[1].content, /\[1\] 來源：farm\n收成了三顆番茄/);
    assert.ok(msgs[1].content.length < 2000);
});

test('parseDigestResponse：容忍前後文字、思考標籤；欄位不合格就修正或略過', () => {
    const text = `<thinking>先想一想</thinking>好的：\n[
      {"i":0,"summary":"看了貓咪影片","learned":"用戶喜歡貓","importance":7,"type":"i","domain":"興趣","tags":["貓","影片","a","b","c"]},
      {"i":1,"summary":"","importance":5},
      {"i":9,"summary":"編號超出範圍"},
      {"i":0,"summary":"重複的編號"},
      {"i":2,"summary":"怪類型","importance":99,"type":"???","domain":"???"}
    ]`;
    const r = parseDigestResponse(text, 3);
    assert.deepEqual([...r.keys()], [0, 2]);
    assert.deepEqual(r.get(0), { summary: '看了貓咪影片', learned: '用戶喜歡貓', importance: 0.7, type: 'i', domain: '興趣', tags: ['貓', '影片', 'a', 'b'], dislikes: [] });
    assert.equal(r.get(2).importance, 1);
    assert.equal(r.get(2).type, 'dynamic');
    assert.equal(r.get(2).domain, '日常');
    assert.equal(parseDigestResponse('沒有 JSON', 3).size, 0);
    assert.equal(parseDigestResponse('[壞掉的', 3).size, 0);
});

test('digestUpdate：重要度和原本的混合；永久記憶不降級；寫入摘要與學到的事', () => {
    const r = { summary: '摘要', learned: '學到', importance: 0.9, type: 'feel', domain: '內心', tags: ['t'] };
    const u = digestUpdate(mem({ importance: 0.3 }), r, 123);
    assert.equal(u.importance, 0.66); // 0.3*0.4 + 0.9*0.6
    assert.equal(u.meta_content, '摘要');
    assert.equal(u.meaning, '學到');
    assert.equal(u.digested, true);
    assert.equal(u.digested_at, 123);
    assert.equal(digestUpdate(mem({ memory_type: 'permanent' }), r).memory_type, 'permanent');
    assert.equal(digestUpdate(mem({ meaning: '原本的' }), { ...r, learned: '' }).meaning, '原本的');
});

// ───── MemorySystem.digestPending（假 API）─────
async function setup(settings = {}) {
    const db = makeFakeDb();
    globalThis.__fakeMemoryDb = db;
    const { MemorySystem } = await loadMemorySystem();
    const ms = new MemorySystem({ embedding: null, digest: { api_url: 'http://api.test', api_key: 'k', model: 'cheap', dedicated: true }, ...settings });
    return { db, ms };
}
function mockApi(handler) {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, auth: init.headers.Authorization, body });
        return handler(body, calls.length);
    };
    return { calls, restore: () => { globalThis.fetch = real; } };
}
const ok = content => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
const echo = body => {
    const n = (body.messages[1].content.match(/^\[(\d+)\] 來源/gm) || []).length;
    return ok(JSON.stringify(Array.from({ length: n }, (_, i) => ({ i, summary: '摘要' + i, learned: '學到' + i, importance: 8, type: 'dynamic', domain: '日常', tags: ['k'] }))));
};

test('digestPending：用消化專用的網址／金鑰／模型，分批呼叫，寫回摘要並標記已消化', async () => {
    const { db, ms } = await setup();
    for (let i = 0; i < 10; i++) await db.MemoryDB.create({ character_id: 'c1', source_app: 'farm', content: '農場的第幾件事 ' + i, importance: 0.3, timestamp: i + 1 });
    const api = mockApi(echo);
    try {
        const res = await ms.digestPending();
        assert.equal(res.digested, 10);
        assert.equal(api.calls.length, 2, '8 + 2 兩批');
        assert.equal(api.calls[0].url, 'http://api.test/v1/chat/completions');
        assert.equal(api.calls[0].auth, 'Bearer k');
        assert.equal(api.calls[0].body.model, 'cheap');
    } finally { api.restore(); }
    const all = await db.MemoryDB.getAll();
    assert.ok(all.every(m => m.digested === true && m.meta_content.startsWith('摘要') && m.importance > 0.3));
    const stats = await ms.getDigestStats();
    assert.deepEqual([stats.pending, stats.digested], [0, 10]);
    const again = mockApi(echo);
    try { assert.equal((await ms.digestPending()).digested, 0); assert.equal(again.calls.length, 0, '已消化的不再送'); } finally { again.restore(); }
});

test('digestPending：API 出錯（額度、金鑰）就停止，不把失敗算在記憶頭上；內容解析不出來才累計失敗次數', async () => {
    const { db, ms } = await setup();
    const m = await db.MemoryDB.create({ character_id: 'c1', source_app: 'farm', content: '收成番茄', importance: 0.3 });
    let api = mockApi(() => ({ ok: false, status: 429, json: async () => ({}) }));
    try {
        const res = await ms.digestPending();
        assert.equal(res.digested, 0);
        assert.match(res.error, /429/);
    } finally { api.restore(); }
    assert.equal((await db.MemoryDB.getAll())[0].digest_attempts || 0, 0);
    api = mockApi(() => ok('我不會輸出 JSON'));
    try { await ms.digestPending(); } finally { api.restore(); }
    assert.equal((await db.MemoryDB.getAll())[0].digest_attempts, 1);
    assert.equal(m.id, (await db.MemoryDB.getAll())[0].id);
});

test('digestPending：沒有任何 API 設定就略過；有嵌入服務時順便補上向量', async () => {
    const none = await setup({ digest: { api_url: '', api_key: '', model: '' } });
    assert.deepEqual(await none.ms.digestPending(), { digested: 0, skipped: 'no_api' });

    const { db, ms } = await setup();
    let embedded = [];
    ms.embeddingClient = { getEmbedding: async t => { embedded.push(t); return [1, 0, 0]; } };
    await db.MemoryDB.create({ character_id: 'c1', source_app: 'farm', content: '收成了三顆番茄', importance: 0.3 });
    const api = mockApi(echo);
    try { await ms.digestPending(); } finally { api.restore(); }
    const m = (await db.MemoryDB.getAll())[0];
    assert.deepEqual(m.embedding, [1, 0, 0]);
    assert.deepEqual(m.embeddingMeaning, [1, 0, 0]);
    assert.deepEqual(embedded, ['收成了三顆番茄', '學到0']);
});

test('消化提示詞：內建規則一直在；使用者的額外要求接在後面並限制長度，且不能改輸出格式', () => {
    const base = buildDigestMessages([mem()]);
    assert.match(base[0].content, /保留具體資訊/);
    assert.match(base[0].content, /不編造/);
    assert.ok(!base[0].content.includes('額外要求'));
    const custom = buildDigestMessages([mem()], { extra: '用角色的口吻摘要'.repeat(300) });
    assert.match(custom[0].content, /保留具體資訊/);
    assert.match(custom[0].content, /【使用者的額外要求】\n用角色的口吻摘要/);
    assert.match(custom[0].content, /仍必須是下面指定的 JSON/);
    assert.ok(custom[0].content.length < base[0].content.length + 1200, '額外要求被截到 1000 字內');
    assert.equal(buildDigestMessages([mem()], { extra: '   ' })[0].content, base[0].content);
});

test('digestPending 會把設定的消化提示詞送給消化 API', async () => {
    const { db, ms } = await setup({ digest: { api_url: 'http://api.test', api_key: 'k', model: 'm', dedicated: true, prompt: '特別留意用戶的作息' } });
    await db.MemoryDB.create({ character_id: 'c1', source_app: 'health', content: '用戶今天凌晨三點才睡', importance: 0.3 });
    const api = mockApi(echo);
    try { await ms.digestPending(); assert.match(api.calls[0].body.messages[0].content, /特別留意用戶的作息/); } finally { api.restore(); }
});

test('消化：提示詞要求找出用戶明確討厭的事；解析出 dislikes（去空白、最多 5 個、限制長度）', () => {
    const msgs = buildDigestMessages([mem()]);
    assert.match(msgs[0].content, /dislikes/);
    assert.match(msgs[1].content, /"dislikes"/);
    assert.match(msgs[0].content, /只有用戶親口說的才算/);
    const r = parseDigestResponse('[{"i":0,"summary":"用戶說受不了香菜","dislikes":["香菜","  ","被打斷","a","b","c","d"]}]', 1);
    assert.deepEqual(r.get(0).dislikes, ['香菜', '被打斷', 'a', 'b', 'c']);
    assert.deepEqual(parseDigestResponse('[{"i":0,"summary":"x","dislikes":"不是陣列"}]', 1).get(0).dislikes, []);
});
