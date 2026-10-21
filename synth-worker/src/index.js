// 合成服務 Worker：語音合成(tts)、圖片(image)、影片(video)、音樂(music)、語音辨識(stt)
// 無狀態：所有付費服務的 URL／金鑰由 PWA 逐次請求帶入，Worker 本身只需要 SYNTH_TOKEN。

const MAX_BODY_BYTES = 15 * 1024 * 1024;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 100000;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Provider-Url, X-Provider-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Synth-Provider, X-Synth-Model'
};

// 各服務支援的類型與預設模型。null 表示沒有可靠的預設，必須由使用者指定。
export const PROVIDERS = {
    cloudflare: {
        tts: '@cf/myshell-ai/melotts',
        image: '@cf/black-forest-labs/flux-1-schnell',
        stt: '@cf/openai/whisper'
    },
    huggingface: {
        image: 'black-forest-labs/FLUX.1-schnell',
        music: 'facebook/musicgen-small',
        tts: null,
        video: null
    },
    openai: {
        tts: 'tts-1',
        image: 'gpt-image-1',
        stt: 'whisper-1'
    },
    replicate: {
        image: null,
        video: null,
        music: null,
        tts: null
    }
};

export class SynthError extends Error {
    constructor(status, message, code = 'error') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function json(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

function timingSafeEqual(a, b) {
    const enc = new TextEncoder();
    const x = enc.encode(a);
    const y = enc.encode(b);
    let diff = x.length ^ y.length;
    for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
    return diff === 0;
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(bin);
}

function dataUrlToBytes(dataUrl) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
    if (!m) throw new SynthError(400, 'audio 必須是 data URL', 'bad_request');
    return { mime: m[1] || 'application/octet-stream', bytes: base64ToBytes(m[3]) };
}

function safeBaseUrl(raw) {
    let u;
    try { u = new URL(raw); } catch { throw new SynthError(400, 'X-Provider-Url 不是有效網址', 'bad_provider_url'); }
    if (u.protocol !== 'https:') throw new SynthError(400, '服務網址必須是 https', 'bad_provider_url');
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(\d+\.){3}\d+$/.test(host) || host.startsWith('[')) {
        throw new SynthError(400, '不允許使用內網或 IP 位址作為服務網址', 'bad_provider_url');
    }
    return u.origin + u.pathname.replace(/\/+$/, '');
}

// Workers AI 的回傳型別不一：base64 欄位、串流、ArrayBuffer、Response 都處理
async function normalizeAiResult(result, fields, defaultMime) {
    if (result instanceof Response) {
        return { bytes: new Uint8Array(await result.arrayBuffer()), mime: result.headers.get('content-type') || defaultMime };
    }
    if (result instanceof ArrayBuffer) return { bytes: new Uint8Array(result), mime: defaultMime };
    if (ArrayBuffer.isView(result)) return { bytes: new Uint8Array(result.buffer, result.byteOffset, result.byteLength), mime: defaultMime };
    if (result && typeof result.getReader === 'function') {
        return { bytes: new Uint8Array(await new Response(result).arrayBuffer()), mime: defaultMime };
    }
    if (result && typeof result === 'object') {
        for (const f of fields) {
            if (typeof result[f] === 'string' && result[f]) return { bytes: base64ToBytes(result[f]), mime: defaultMime };
        }
    }
    throw new SynthError(502, '模型沒有回傳可用的內容', 'bad_upstream');
}

async function fetchWithTimeout(url, init, ms = POLL_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
        if (e.name === 'AbortError') throw new SynthError(504, '服務逾時，請稍後再試', 'timeout');
        throw new SynthError(502, '無法連線到服務：' + (e.message || e), 'upstream_unreachable');
    } finally {
        clearTimeout(t);
    }
}

async function upstreamError(res, who) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* 忽略 */ }
    if (res.status === 401 || res.status === 403) return new SynthError(401, who + ' 拒絕了金鑰（' + res.status + '）：請確認金鑰正確', 'upstream_auth');
    if (res.status === 402 || res.status === 429) return new SynthError(429, who + ' 額度用完或請求太頻繁（' + res.status + '）。免費額度用完後要等下次重置，或改用付費服務', 'quota');
    if (res.status === 503) return new SynthError(503, who + ' 模型正在載入或暫時不可用，請稍後重試', 'upstream_busy');
    if (res.status === 404) return new SynthError(404, who + ' 找不到這個模型（可能已下架或無免費推論）。請到設定改用其他模型', 'model_not_found');
    return new SynthError(502, who + ' 回傳錯誤 ' + res.status + (detail ? '：' + detail : ''), 'upstream_error');
}

// ---------- Cloudflare Workers AI ----------
async function runCloudflare(kind, model, body, env) {
    if (!env.AI) throw new SynthError(501, 'Worker 尚未綁定 Workers AI（wrangler.toml 的 [ai] 設定）', 'not_configured');
    try {
        if (kind === 'image') {
            const r = await env.AI.run(model, { prompt: body.prompt, ...(body.steps ? { steps: Number(body.steps) } : {}) });
            return normalizeAiResult(r, ['image'], 'image/jpeg');
        }
        if (kind === 'tts') {
            const r = await env.AI.run(model, { prompt: body.text, lang: body.lang || 'zh' });
            return normalizeAiResult(r, ['audio'], 'audio/mpeg');
        }
        if (kind === 'stt') {
            const { bytes } = dataUrlToBytes(body.audio);
            const r = await env.AI.run(model, { audio: [...bytes] });
            const text = r?.text ?? r?.transcription_info?.text;
            if (typeof text !== 'string') throw new SynthError(502, '語音辨識沒有回傳文字', 'bad_upstream');
            return { text };
        }
    } catch (e) {
        if (e instanceof SynthError) throw e;
        const msg = String(e?.message || e);
        if (/quota|limit|neurons|capacity/i.test(msg)) throw new SynthError(429, 'Cloudflare Workers AI 今日免費額度已用完（UTC 午夜重置），或請求太頻繁', 'quota');
        throw new SynthError(502, 'Cloudflare Workers AI 失敗：' + msg, 'upstream_error');
    }
    throw new SynthError(501, 'Cloudflare 沒有提供「' + kind + '」模型', 'unsupported');
}

// ---------- Hugging Face Inference Providers ----------
async function runHuggingFace(kind, model, body, request, env) {
    const key = request.headers.get('X-Provider-Key') || env.HF_TOKEN;
    if (!key) throw new SynthError(401, '使用 Hugging Face 需要 token（設定中填入，或在 Worker 設定 HF_TOKEN）', 'missing_key');
    if (!model) throw new SynthError(400, 'Hugging Face 沒有這個功能的預設模型，請在設定中指定模型 ID', 'model_required');
    const res = await fetchWithTimeout('https://router.huggingface.co/hf-inference/models/' + model, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify({ inputs: kind === 'tts' ? body.text : body.prompt })
    });
    if (!res.ok) throw await upstreamError(res, 'Hugging Face');
    const mime = res.headers.get('content-type') || '';
    if (/json/.test(mime)) throw new SynthError(502, 'Hugging Face 回傳了非媒體內容（模型可能不支援這個功能）', 'bad_upstream');
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}

// ---------- OpenAI 相容 ----------
async function runOpenAI(kind, model, body, request) {
    const base = safeBaseUrl(request.headers.get('X-Provider-Url') || 'https://api.openai.com');
    const key = request.headers.get('X-Provider-Key');
    if (!key) throw new SynthError(401, '請在設定中填入付費服務的 API 金鑰', 'missing_key');
    const auth = { Authorization: 'Bearer ' + key };
    if (kind === 'image') {
        const res = await fetchWithTimeout(base + '/v1/images/generations', {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: body.prompt, size: body.size || '1024x1024', n: 1 })
        });
        if (!res.ok) throw await upstreamError(res, '圖片服務');
        const data = await res.json();
        const item = data?.data?.[0];
        if (item?.b64_json) return { bytes: base64ToBytes(item.b64_json), mime: 'image/png' };
        if (item?.url) {
            const img = await fetchWithTimeout(item.url, {});
            if (!img.ok) throw await upstreamError(img, '圖片下載');
            return { bytes: new Uint8Array(await img.arrayBuffer()), mime: img.headers.get('content-type') || 'image/png' };
        }
        throw new SynthError(502, '圖片服務沒有回傳圖片', 'bad_upstream');
    }
    if (kind === 'tts') {
        const res = await fetchWithTimeout(base + '/v1/audio/speech', {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input: body.text, voice: body.voice || 'alloy', response_format: 'mp3' })
        });
        if (!res.ok) throw await upstreamError(res, '語音服務');
        return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'audio/mpeg' };
    }
    if (kind === 'stt') {
        const { bytes, mime } = dataUrlToBytes(body.audio);
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: mime }), 'audio.' + (mime.includes('mp4') ? 'm4a' : 'webm'));
        form.append('model', model);
        const res = await fetchWithTimeout(base + '/v1/audio/transcriptions', { method: 'POST', headers: auth, body: form });
        if (!res.ok) throw await upstreamError(res, '語音辨識服務');
        const data = await res.json();
        if (typeof data.text !== 'string') throw new SynthError(502, '語音辨識沒有回傳文字', 'bad_upstream');
        return { text: data.text };
    }
    throw new SynthError(501, 'OpenAI 相容服務不支援「' + kind + '」', 'unsupported');
}

// ---------- Replicate（影片、音樂等） ----------
async function runReplicate(kind, model, body, request) {
    const key = request.headers.get('X-Provider-Key');
    if (!key) throw new SynthError(401, '請在設定中填入 Replicate API token', 'missing_key');
    if (!model || !/^[\w.-]+\/[\w.-]+$/.test(model)) throw new SynthError(400, 'Replicate 需要模型 ID，格式為 擁有者/名稱', 'model_required');
    const input = { [body.inputKey || (kind === 'tts' ? 'text' : 'prompt')]: kind === 'tts' ? body.text : body.prompt, ...(body.input || {}) };
    let res = await fetchWithTimeout('https://api.replicate.com/v1/models/' + model + '/predictions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'wait=60' },
        body: JSON.stringify({ input })
    });
    if (!res.ok) throw await upstreamError(res, 'Replicate');
    let pred = await res.json();
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (pred.status === 'starting' || pred.status === 'processing') {
        if (Date.now() > deadline) throw new SynthError(504, 'Replicate 生成逾時（影片、音樂可能需要更久），請稍後再試', 'timeout');
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        res = await fetchWithTimeout(pred.urls.get, { headers: { Authorization: 'Bearer ' + key } });
        if (!res.ok) throw await upstreamError(res, 'Replicate');
        pred = await res.json();
    }
    if (pred.status !== 'succeeded') throw new SynthError(502, 'Replicate 生成失敗：' + (pred.error || pred.status), 'upstream_error');
    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (typeof out !== 'string') throw new SynthError(502, 'Replicate 沒有回傳檔案', 'bad_upstream');
    const file = await fetchWithTimeout(out, {});
    if (!file.ok) throw await upstreamError(file, 'Replicate 檔案下載');
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.headers.get('content-type') || 'application/octet-stream' };
}

// OpenAI 相容的 /v1/embeddings：用 Workers AI 的免費嵌入模型（預設 bge-m3，多語言、1024 維，中文效果好）。
// PWA 的「嵌入模型設定」把 Embedding URL 填 Worker 網址、API Key 填 SYNTH_TOKEN 就能用。
const EMBEDDING_MODELS = {
    '@cf/baai/bge-m3': 1024,
    '@cf/baai/bge-large-en-v1.5': 1024,
    '@cf/baai/bge-base-en-v1.5': 768,
    '@cf/baai/bge-small-en-v1.5': 384
};
export async function handleEmbeddings(body, env) {
    if (!env.AI) throw new SynthError(501, 'Worker 尚未綁定 Workers AI（wrangler.toml 的 [ai] 設定）', 'not_configured');
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    if (!inputs.length || inputs.some(t => typeof t !== 'string' || !t.trim())) throw new SynthError(400, 'input 必須是非空字串或字串陣列', 'bad_request');
    if (inputs.length > 100) throw new SynthError(400, '一次最多 100 段文字', 'too_many');
    if (inputs.some(t => t.length > 8000)) throw new SynthError(400, '單段文字太長（上限 8000 字）', 'too_long');
    // 使用者在 PWA 填的模型名稱如果不是 Workers AI 的嵌入模型（例如預設的 text-embedding-3-small），就用預設
    const model = EMBEDDING_MODELS[body.model] ? body.model : '@cf/baai/bge-m3';
    let result;
    try {
        result = await env.AI.run(model, { text: inputs });
    } catch (e) {
        const msg = String(e?.message || e);
        if (/quota|limit|neurons|capacity/i.test(msg)) throw new SynthError(429, 'Cloudflare Workers AI 今日免費額度已用完（UTC 午夜重置），或請求太頻繁', 'quota');
        throw new SynthError(502, 'Cloudflare Workers AI 失敗：' + msg, 'upstream_error');
    }
    const vectors = result?.data;
    if (!Array.isArray(vectors) || vectors.length !== inputs.length) throw new SynthError(502, '嵌入模型沒有回傳預期的向量', 'bad_upstream');
    const tokens = inputs.reduce((n, t) => n + Math.ceil(t.length / 2), 0);
    return {
        object: 'list',
        model,
        data: vectors.map((embedding, index) => ({ object: 'embedding', index, embedding })),
        usage: { prompt_tokens: tokens, total_tokens: tokens }
    };
}

export async function handleSynth(kind, body, request, env) {
    const provider = body.provider || 'cloudflare';
    const table = PROVIDERS[provider];
    if (!table) throw new SynthError(400, '不支援的服務：' + provider, 'bad_provider');
    if (!['tts', 'image', 'video', 'music', 'stt'].includes(kind)) throw new SynthError(404, '不支援的功能：' + kind, 'bad_kind');
    if (kind === 'tts' && !String(body.text || '').trim()) throw new SynthError(400, '缺少要朗讀的文字', 'bad_request');
    if ((kind === 'image' || kind === 'video' || kind === 'music') && !String(body.prompt || '').trim()) throw new SynthError(400, '缺少提示文字', 'bad_request');
    if (kind === 'stt' && !body.audio) throw new SynthError(400, '缺少音訊', 'bad_request');
    if (kind === 'tts' && body.text.length > 2000) throw new SynthError(400, '朗讀文字太長（上限 2000 字）', 'too_long');
    if (kind !== 'tts' && kind !== 'stt' && body.prompt.length > 2000) throw new SynthError(400, '提示文字太長（上限 2000 字）', 'too_long');

    const model = body.model || table[kind] || null;
    if (provider === 'cloudflare') {
        if (!(kind in table)) throw new SynthError(501, 'Cloudflare 免費額度沒有「' + { video: '影片', music: '音樂' }[kind] + '」模型，請在設定中改用其他服務', 'unsupported');
        return { ...(await runCloudflare(kind, model, body, env)), model };
    }
    if (provider === 'huggingface') {
        if (kind === 'stt') throw new SynthError(501, 'Hugging Face 路徑不提供語音辨識，請改用 Cloudflare 或 OpenAI 相容服務', 'unsupported');
        return { ...(await runHuggingFace(kind, model, body, request, env)), model };
    }
    if (provider === 'openai') return { ...(await runOpenAI(kind, model, body, request)), model };
    return { ...(await runReplicate(kind, model, body, request)), model };
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        const url = new URL(request.url);
        try {
            if (!env.SYNTH_TOKEN) throw new SynthError(503, 'Worker 尚未設定 SYNTH_TOKEN（wrangler secret put SYNTH_TOKEN）', 'not_configured');
            const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
            if (!timingSafeEqual(given, env.SYNTH_TOKEN)) throw new SynthError(401, 'Token 不正確', 'unauthorized');

            if (request.method === 'GET' && url.pathname === '/health') {
                return json(200, {
                    ok: true,
                    workersAi: !!env.AI,
                    huggingFaceToken: !!env.HF_TOKEN,
                    free: { tts: !!env.AI, image: !!env.AI, stt: !!env.AI, embeddings: !!env.AI, video: false, music: false }
                });
            }
            if (request.method === 'POST' && url.pathname === '/v1/embeddings') {
                let body;
                try { body = await request.json(); } catch { throw new SynthError(400, '請求內容不是有效的 JSON', 'bad_request'); }
                return json(200, await handleEmbeddings(body, env));
            }
            const m = /^\/synth\/(\w+)$/.exec(url.pathname);
            if (request.method === 'POST' && m) {
                const len = Number(request.headers.get('Content-Length') || 0);
                if (len > MAX_BODY_BYTES) throw new SynthError(413, '請求太大（上限 15MB）', 'too_large');
                let body;
                try { body = await request.json(); } catch { throw new SynthError(400, '請求內容不是有效的 JSON', 'bad_request'); }
                const result = await handleSynth(m[1], body, request, env);
                if (typeof result.text === 'string') return json(200, { text: result.text });
                return new Response(result.bytes, {
                    status: 200,
                    headers: { ...CORS, 'Content-Type': result.mime || 'application/octet-stream', 'X-Synth-Provider': body.provider || 'cloudflare', 'X-Synth-Model': result.model || '' }
                });
            }
            throw new SynthError(404, '找不到這個路徑', 'not_found');
        } catch (e) {
            if (e instanceof SynthError) return json(e.status, { error: e.message, code: e.code });
            return json(500, { error: '內部錯誤：' + (e?.message || e), code: 'internal' });
        }
    }
};

export { bytesToBase64 };
