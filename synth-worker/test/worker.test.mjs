import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const TOKEN = 'secret-token';
const b64 = s => Buffer.from(s).toString('base64');

function req(path, { method = 'POST', body, headers = {}, token = TOKEN } = {}) {
    return new Request('https://w.example' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

function envWithAi(impl) {
    const calls = [];
    return { SYNTH_TOKEN: TOKEN, AI: { run: async (model, input) => { calls.push({ model, input }); return impl(model, input); } }, calls };
}

async function withFetch(mock, fn) {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return mock(String(url), init); };
    try { return await fn(calls); } finally { globalThis.fetch = real; }
}

test('沒有設定 SYNTH_TOKEN 時拒絕所有請求（避免變成開放代理）', async () => {
    const res = await worker.fetch(req('/health', { method: 'GET' }), {});
    assert.equal(res.status, 503);
});

test('token 錯誤或缺少 → 401', async () => {
    const env = { SYNTH_TOKEN: TOKEN };
    assert.equal((await worker.fetch(req('/health', { method: 'GET', token: 'wrong' }), env)).status, 401);
    assert.equal((await worker.fetch(req('/health', { method: 'GET', token: null }), env)).status, 401);
});

test('OPTIONS 預檢不需要 token，且帶 CORS 標頭', async () => {
    const res = await worker.fetch(new Request('https://w.example/synth/tts', { method: 'OPTIONS' }), {});
    assert.equal(res.status, 204);
    assert.match(res.headers.get('Access-Control-Allow-Headers'), /X-Provider-Key/);
});

test('/health 回報可用能力', async () => {
    const res = await worker.fetch(req('/health', { method: 'GET' }), envWithAi(() => ({})));
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.deepEqual(data.free, { tts: true, image: true, stt: true, video: false, music: false });
});

test('Cloudflare 圖片：base64 欄位轉成 JPEG 位元組', async () => {
    const env = envWithAi(() => ({ image: b64('FAKEJPEG') }));
    const res = await worker.fetch(req('/synth/image', { body: { prompt: '一隻貓', steps: 4 } }), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'FAKEJPEG');
    assert.deepEqual(env.calls[0], { model: '@cf/black-forest-labs/flux-1-schnell', input: { prompt: '一隻貓', steps: 4 } });
});

test('Cloudflare TTS：支援 {audio:base64}、二進位與串流三種回傳型態', async () => {
    for (const make of [
        () => ({ audio: b64('MP3DATA') }),
        () => new TextEncoder().encode('MP3DATA').buffer,
        () => new Response('MP3DATA').body
    ]) {
        const env = envWithAi(make);
        const res = await worker.fetch(req('/synth/tts', { body: { text: '你好' } }), env);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'audio/mpeg');
        assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'MP3DATA');
        assert.deepEqual(env.calls[0].input, { prompt: '你好', lang: 'zh' });
    }
});

test('Cloudflare 語音辨識：把 data URL 轉成位元組陣列並回傳文字', async () => {
    const env = envWithAi(() => ({ text: '今天天氣很好' }));
    const res = await worker.fetch(req('/synth/stt', { body: { audio: 'data:audio/webm;base64,' + b64('AB') } }), env);
    assert.deepEqual(await res.json(), { text: '今天天氣很好' });
    assert.deepEqual(env.calls[0].input.audio, [65, 66]);
});

test('Cloudflare 沒有影片／音樂 → 501 並說明原因', async () => {
    for (const kind of ['video', 'music']) {
        const res = await worker.fetch(req('/synth/' + kind, { body: { prompt: 'x' } }), envWithAi(() => ({})));
        assert.equal(res.status, 501);
        assert.match((await res.json()).error, /沒有「.+」模型/);
    }
});

test('額度用完的錯誤被翻成 429 與清楚的訊息', async () => {
    const env = envWithAi(() => { throw new Error('daily neurons limit exceeded'); });
    const res = await worker.fetch(req('/synth/image', { body: { prompt: 'x' } }), env);
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /額度/);
});

test('輸入驗證：缺文字、缺提示、過長、壞 JSON', async () => {
    const env = envWithAi(() => ({}));
    assert.equal((await worker.fetch(req('/synth/tts', { body: { text: '  ' } }), env)).status, 400);
    assert.equal((await worker.fetch(req('/synth/image', { body: {} }), env)).status, 400);
    assert.equal((await worker.fetch(req('/synth/tts', { body: { text: 'a'.repeat(2001) } }), env)).status, 400);
    assert.equal((await worker.fetch(req('/synth/image', { body: { prompt: 'a', provider: 'nope' } }), env)).status, 400);
    const bad = new Request('https://w.example/synth/image', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: '{oops' });
    assert.equal((await worker.fetch(bad, env)).status, 400);
    assert.equal((await worker.fetch(req('/synth/unknown', { body: { prompt: 'a' } }), env)).status, 404);
});

test('Hugging Face：呼叫 router、帶上 token、回傳媒體；沒有預設模型時要求指定', async () => {
    const env = { SYNTH_TOKEN: TOKEN };
    await withFetch(() => new Response('PNGDATA', { status: 200, headers: { 'content-type': 'image/png' } }), async calls => {
        const res = await worker.fetch(req('/synth/image', { body: { provider: 'huggingface', prompt: 'x' }, headers: { 'X-Provider-Key': 'hf_abc' } }), env);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'image/png');
        assert.equal(calls[0].url, 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell');
        assert.equal(calls[0].init.headers.Authorization, 'Bearer hf_abc');
        assert.deepEqual(JSON.parse(calls[0].init.body), { inputs: 'x' });
    });
    const noModel = await worker.fetch(req('/synth/video', { body: { provider: 'huggingface', prompt: 'x' }, headers: { 'X-Provider-Key': 'k' } }), env);
    assert.equal(noModel.status, 400);
    assert.equal((await noModel.json()).code, 'model_required');
    const noKey = await worker.fetch(req('/synth/image', { body: { provider: 'huggingface', prompt: 'x' } }), env);
    assert.equal(noKey.status, 401);
});

test('Hugging Face 錯誤碼對應：404 模型不存在、503 載入中、402 額度', async () => {
    const env = { SYNTH_TOKEN: TOKEN };
    for (const [status, code] of [[404, 'model_not_found'], [503, 'upstream_busy'], [402, 'quota'], [401, 'upstream_auth']]) {
        await withFetch(() => new Response('nope', { status }), async () => {
            const res = await worker.fetch(req('/synth/music', { body: { provider: 'huggingface', prompt: 'x' }, headers: { 'X-Provider-Key': 'k' } }), env);
            assert.equal((await res.json()).code, code, 'status ' + status);
        });
    }
});

test('OpenAI 相容：圖片 b64、TTS 位元組、STT 文字；必須有金鑰；拒絕內網網址', async () => {
    const env = { SYNTH_TOKEN: TOKEN };
    const hdr = { 'X-Provider-Url': 'https://api.example.com/', 'X-Provider-Key': 'sk-1' };
    await withFetch(() => new Response(JSON.stringify({ data: [{ b64_json: b64('PNG') }] }), { status: 200 }), async calls => {
        const res = await worker.fetch(req('/synth/image', { body: { provider: 'openai', prompt: 'x' }, headers: hdr }), env);
        assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'PNG');
        assert.equal(calls[0].url, 'https://api.example.com/v1/images/generations');
        assert.equal(JSON.parse(calls[0].init.body).model, 'gpt-image-1');
    });
    await withFetch(() => new Response('MP3', { status: 200, headers: { 'content-type': 'audio/mpeg' } }), async calls => {
        const res = await worker.fetch(req('/synth/tts', { body: { provider: 'openai', text: '嗨', voice: 'nova' }, headers: hdr }), env);
        assert.equal(res.headers.get('Content-Type'), 'audio/mpeg');
        assert.equal(JSON.parse(calls[0].init.body).voice, 'nova');
    });
    await withFetch(() => new Response(JSON.stringify({ text: 'hello' }), { status: 200 }), async calls => {
        const res = await worker.fetch(req('/synth/stt', { body: { provider: 'openai', audio: 'data:audio/webm;base64,' + b64('AB') }, headers: hdr }), env);
        assert.deepEqual(await res.json(), { text: 'hello' });
        assert.ok(calls[0].init.body instanceof FormData);
    });
    assert.equal((await worker.fetch(req('/synth/image', { body: { provider: 'openai', prompt: 'x' }, headers: { 'X-Provider-Url': 'https://api.example.com' } }), env)).status, 401);
    for (const bad of ['http://api.example.com', 'https://localhost', 'https://10.0.0.1', 'https://127.0.0.1', 'not a url']) {
        const res = await worker.fetch(req('/synth/image', { body: { provider: 'openai', prompt: 'x' }, headers: { 'X-Provider-Url': bad, 'X-Provider-Key': 'k' } }), env);
        assert.equal(res.status, 400, bad);
    }
    assert.equal((await worker.fetch(req('/synth/video', { body: { provider: 'openai', prompt: 'x' }, headers: hdr }), env)).status, 501);
});

test('Replicate：建立預測、輪詢到完成、下載輸出；失敗與缺模型的處理', async () => {
    const env = { SYNTH_TOKEN: TOKEN };
    const hdr = { 'X-Provider-Key': 'r8_x' };
    let polls = 0;
    const mock = (url) => {
        if (url.includes('/predictions') && !url.includes('/get/')) {
            return new Response(JSON.stringify({ status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/get/1' } }), { status: 201 });
        }
        if (url.includes('/get/1')) {
            polls++;
            return new Response(JSON.stringify(polls < 2 ? { status: 'processing', urls: { get: url } } : { status: 'succeeded', output: ['https://files.example/out.mp4'] }), { status: 200 });
        }
        return new Response('VIDEO', { status: 200, headers: { 'content-type': 'video/mp4' } });
    };
    await withFetch(mock, async calls => {
        const res = await worker.fetch(req('/synth/video', { body: { provider: 'replicate', model: 'owner/model', prompt: '海浪' }, headers: hdr }), env);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'video/mp4');
        assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'VIDEO');
        assert.equal(calls[0].url, 'https://api.replicate.com/v1/models/owner/model/predictions');
        assert.deepEqual(JSON.parse(calls[0].init.body), { input: { prompt: '海浪' } });
    });
    await withFetch(() => new Response(JSON.stringify({ status: 'failed', error: 'NSFW', urls: { get: 'x' } }), { status: 201 }), async () => {
        const res = await worker.fetch(req('/synth/music', { body: { provider: 'replicate', model: 'a/b', prompt: 'x' }, headers: hdr }), env);
        assert.equal(res.status, 502);
        assert.match((await res.json()).error, /NSFW/);
    });
    assert.equal((await worker.fetch(req('/synth/video', { body: { provider: 'replicate', prompt: 'x' }, headers: hdr }), env)).status, 400);
    assert.equal((await worker.fetch(req('/synth/video', { body: { provider: 'replicate', model: 'a/b', prompt: 'x' } }), env)).status, 401);
});

test('網路無法連線 → 502，不會讓 Worker 崩潰', async () => {
    await withFetch(() => { throw new Error('boom'); }, async () => {
        const res = await worker.fetch(req('/synth/image', { body: { provider: 'huggingface', prompt: 'x' }, headers: { 'X-Provider-Key': 'k' } }), { SYNTH_TOKEN: TOKEN });
        assert.equal(res.status, 502);
        assert.equal((await res.json()).code, 'upstream_unreachable');
    });
});
