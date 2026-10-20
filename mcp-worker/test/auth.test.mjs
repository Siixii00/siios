import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

// 不連外網的測試：驗證存取金鑰與工具清單。真實 API 請用 `npm run smoke`（需要網路）。
const KEY = 'test-key';
const req = (path, { method = 'GET', body, key = KEY } = {}) =>
    new Request('https://w.example' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });

test('未設定 MCP_API_KEY 時拒絕所有請求', async () => {
    assert.equal((await worker.fetch(req('/tools'), {}, {})).status, 503);
});

test('沒帶或帶錯金鑰 → 401（含呼叫工具）', async () => {
    const env = { MCP_API_KEY: KEY };
    assert.equal((await worker.fetch(req('/tools', { key: null }), env, {})).status, 401);
    assert.equal((await worker.fetch(req('/tools', { key: 'bad' }), env, {})).status, 401);
    assert.equal((await worker.fetch(req('/tools/call', { method: 'POST', key: 'bad', body: { name: 'get_weather', arguments: { city: 'x' } } }), env, {})).status, 401);
});

test('預檢請求不需要金鑰', async () => {
    const res = await worker.fetch(new Request('https://w.example/tools', { method: 'OPTIONS' }), {}, {});
    assert.equal(res.status, 200);
});

test('工具清單只包含免金鑰、可運作的工具，並且結構正確', async () => {
    const tools = await (await worker.fetch(req('/tools'), { MCP_API_KEY: KEY }, {})).json();
    const names = tools.map(t => t.name).sort();
    assert.deepEqual(names, ['check_game_price', 'get_weather', 'search_anime', 'search_recipe', 'search_wiki', 'translate']);
    assert.ok(tools.every(t => t.description && t.parameters?.type === 'object'));
});

test('/health 與未知工具、壞 JSON', async () => {
    const env = { MCP_API_KEY: KEY };
    assert.deepEqual(await (await worker.fetch(req('/health'), env, {})).json(), { ok: true, tools: 6 });
    assert.equal((await worker.fetch(req('/tools/call', { method: 'POST', body: { name: 'nope', arguments: {} } }), env, {})).status, 400);
    const bad = new Request('https://w.example/tools/call', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: '{oops' });
    assert.equal((await worker.fetch(bad, env, {})).status, 400);
});
