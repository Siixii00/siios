import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddingClient } from '../../js/core/embedding/index.js';
import { EMBEDDING_PRESETS, findPreset } from '../../js/core/embedding/presets.js';

function mockFetch(handler) {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({ url: String(url), body, headers: init.headers }); return handler(String(url), body, calls.length); };
    return { calls, restore: () => { globalThis.fetch = real; } };
}
const ok = vectors => new Response(JSON.stringify({ data: vectors.map((embedding, index) => ({ index, embedding })) }), { status: 200 });

test('網址規則：根網址、結尾斜線、/v1、完整 /embeddings 都能正確組出請求網址', () => {
    const ep = url => new EmbeddingClient({ embedding_url: url })._endpoint();
    assert.equal(ep('https://api.openai.com'), 'https://api.openai.com/v1/embeddings');
    assert.equal(ep('https://api.openai.com/'), 'https://api.openai.com/v1/embeddings');
    assert.equal(ep('https://api.openai.com/v1'), 'https://api.openai.com/v1/embeddings');
    assert.equal(ep('https://api.openai.com/v1/embeddings'), 'https://api.openai.com/v1/embeddings');
    assert.equal(ep('https://generativelanguage.googleapis.com/v1beta/openai/embeddings'), 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings');
    // 沒填嵌入網址時退回聊天 API 網址
    assert.equal(new EmbeddingClient({ api_url: 'https://chat.example.com/' })._endpoint(), 'https://chat.example.com/v1/embeddings');
});

test('所有免費服務捷徑都填了網址（Worker 除外）與模型，且組出的請求網址以 /embeddings 結尾', () => {
    assert.ok(EMBEDDING_PRESETS.length >= 5);
    for (const p of EMBEDDING_PRESETS) {
        assert.ok(p.id && p.name && p.model && p.note && p.link && p.keyHint, p.id);
        if (p.id !== 'siios-worker') assert.match(new EmbeddingClient({ embedding_url: p.url })._endpoint(), /\/embeddings$/, p.id);
    }
    assert.equal(findPreset('siios-worker').model, '@cf/baai/bge-m3');
    assert.equal(findPreset('nope'), null);
});

test('dimensions 只在 text-embedding-3 系列才送；服務回 400 時不帶 dimensions 重送一次，之後都不帶', async () => {
    const m = mockFetch((url, body) => (body.dimensions ? new Response('{"error":{"message":"unknown parameter"}}', { status: 400 }) : ok([[1, 2, 3]])));
    try {
        const other = new EmbeddingClient({ embedding_url: 'https://x.test', embedding_model: 'bge-m3', embedding_dimensions: 1024 });
        assert.deepEqual(await other.getEmbedding('a'), [1, 2, 3]);
        assert.equal('dimensions' in m.calls[0].body, false);

        m.calls.length = 0;
        const oa = new EmbeddingClient({ embedding_url: 'https://x.test', embedding_model: 'text-embedding-3-small', embedding_dimensions: 512 });
        assert.deepEqual(await oa.getEmbedding('a'), [1, 2, 3]);
        assert.equal(m.calls.length, 2); // 第一次帶 dimensions 被拒，第二次不帶
        assert.equal(m.calls[0].body.dimensions, 512);
        assert.equal('dimensions' in m.calls[1].body, false);
        await oa.getEmbedding('b');
        assert.equal(m.calls.length, 3);
        assert.equal('dimensions' in m.calls[2].body, false);
    } finally { m.restore(); }
});

test('Authorization 標頭用嵌入金鑰，沒填就用聊天金鑰', async () => {
    const m = mockFetch(() => ok([[1]]));
    try {
        await new EmbeddingClient({ embedding_url: 'https://x.test', embedding_api_key: 'emb-key', api_key: 'chat-key' }).getEmbedding('a');
        await new EmbeddingClient({ embedding_url: 'https://x.test', api_key: 'chat-key' }).getEmbedding('a');
        assert.equal(m.calls[0].headers.Authorization, 'Bearer emb-key');
        assert.equal(m.calls[1].headers.Authorization, 'Bearer chat-key');
    } finally { m.restore(); }
});

test('批次：一次多段文字依序回傳向量', async () => {
    const m = mockFetch(() => ok([[1, 0], [0, 1]]));
    try {
        const out = await new EmbeddingClient({ embedding_url: 'https://x.test' }).getEmbeddings(['a', 'b']);
        assert.deepEqual(out, [[1, 0], [0, 1]]);
    } finally { m.restore(); }
});

test('失敗時回 null 並記錄原因；連續失敗 3 次暫停，不再打請求；測試連線可以繞過暫停', async () => {
    let status = 500;
    const m = mockFetch(() => (status === 200 ? ok([[1, 2]]) : new Response('{"error":{"message":"boom"}}', { status })));
    try {
        const c = new EmbeddingClient({ embedding_url: 'https://x.test' });
        for (let i = 0; i < 3; i++) assert.equal(await c.getEmbedding('a'), null);
        assert.equal(c.lastError, 'boom');
        assert.equal(m.calls.length, 3);
        assert.equal(await c.getEmbedding('a'), null); // 暫停中
        assert.equal(m.calls.length, 3);
        status = 200;
        const t = await c.testConnection();
        assert.equal(t.success, true);
        assert.equal(t.dimensions, 2);
        assert.match(t.message, /2 維/);
        assert.deepEqual(await c.getEmbedding('a'), [1, 2]); // 測試成功後恢復
    } finally { m.restore(); }
});

test('回應格式不對（沒有 embedding 陣列）時回報清楚的錯誤', async () => {
    const m = mockFetch(() => new Response('{"object":"list","data":[]}', { status: 200 }));
    try {
        const c = new EmbeddingClient({ embedding_url: 'https://x.test' });
        const t = await c.testConnection();
        assert.equal(t.success, false);
        assert.match(t.message, /沒有 embedding/);
    } finally { m.restore(); }
});

test('沒有設定任何網址時，測試連線說明原因', async () => {
    const t = await new EmbeddingClient({}).testConnection();
    assert.equal(t.success, false);
    assert.match(t.message, /沒有設定嵌入模型網址/);
});
