import { SettingsDB } from '../db.js';

export const SYNTH_KINDS = {
    tts: { label: '語音合成', free: true },
    image: { label: '圖片生成', free: true },
    stt: { label: '語音辨識', free: true },
    video: { label: '影片生成', free: false },
    music: { label: '音樂合成', free: false }
};

export const SYNTH_PROVIDERS = {
    cloudflare: { label: 'Cloudflare Workers AI（免費額度）', kinds: ['tts', 'image', 'stt'] },
    huggingface: { label: 'Hugging Face（免費額度極少，需 token）', kinds: ['image', 'music', 'tts', 'video'] },
    openai: { label: 'OpenAI 相容服務（付費）', kinds: ['image', 'tts', 'stt'] },
    replicate: { label: 'Replicate（付費，影片／音樂）', kinds: ['image', 'video', 'music', 'tts'] }
};

const DEFAULT_KIND_CONFIG = {
    tts: { provider: 'cloudflare' },
    image: { provider: 'cloudflare' },
    stt: { provider: 'cloudflare' },
    music: { provider: 'huggingface' },
    video: { provider: 'replicate' }
};

const TIMEOUTS = { tts: 60000, image: 90000, stt: 60000, music: 130000, video: 130000 };

export class SynthError extends Error {
    constructor(message, code = 'error') {
        super(message);
        this.code = code;
    }
}

export async function getSynthConfig() {
    const saved = (await SettingsDB.get('synth_config')) || {};
    const kinds = {};
    for (const k of Object.keys(DEFAULT_KIND_CONFIG)) kinds[k] = { ...DEFAULT_KIND_CONFIG[k], ...(saved.kinds?.[k] || {}) };
    return { url: (saved.url || '').replace(/\/+$/, ''), token: saved.token || '', kinds };
}

export async function saveSynthConfig(config) {
    await SettingsDB.set('synth_config', config);
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new SynthError('讀取生成結果失敗'));
        reader.readAsDataURL(blob);
    });
}

async function request(path, { method = 'POST', body, kind, signal } = {}) {
    const cfg = await getSynthConfig();
    if (!cfg.url || !cfg.token) {
        throw new SynthError('尚未設定合成服務。請到「設定 → 合成服務」填入 Worker 網址與 Token', 'not_configured');
    }
    const kc = kind ? cfg.kinds[kind] : null;
    const headers = { Authorization: 'Bearer ' + cfg.token };
    if (body) headers['Content-Type'] = 'application/json';
    if (kc?.providerUrl) headers['X-Provider-Url'] = kc.providerUrl;
    if (kc?.key) headers['X-Provider-Key'] = kc.key;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUTS[kind] || 30000);
    signal?.addEventListener('abort', () => ctrl.abort());
    let res;
    try {
        res = await fetch(cfg.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new SynthError(signal?.aborted ? '已取消' : '等待合成服務逾時，請稍後再試', signal?.aborted ? 'cancelled' : 'timeout');
        }
        throw new SynthError('無法連線到合成服務，請檢查網址與網路', 'unreachable');
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        let info = {};
        try { info = await res.json(); } catch { /* 非 JSON */ }
        throw new SynthError(info.error || '合成服務回應錯誤（' + res.status + '）', info.code || 'http_' + res.status);
    }
    return res;
}

// 回傳 { dataUrl, mime }；kind: tts | image | video | music
export async function synthesize(kind, params, { signal } = {}) {
    const cfg = await getSynthConfig();
    const kc = cfg.kinds[kind];
    if (!kc) throw new SynthError('不支援的功能：' + kind);
    const body = { provider: kc.provider, ...(kc.model ? { model: kc.model } : {}), ...(kc.voice && kind === 'tts' ? { voice: kc.voice } : {}), ...params };
    const res = await request('/synth/' + kind, { body, kind, signal });
    const blob = await res.blob();
    if (!blob.size) throw new SynthError('合成服務沒有回傳內容');
    return { dataUrl: await blobToDataURL(blob), mime: blob.type, model: res.headers.get('X-Synth-Model') || '' };
}

export async function transcribe(audioDataUrl, { signal } = {}) {
    const cfg = await getSynthConfig();
    const kc = cfg.kinds.stt;
    const res = await request('/synth/stt', { body: { provider: kc.provider, ...(kc.model ? { model: kc.model } : {}), audio: audioDataUrl }, kind: 'stt', signal });
    const data = await res.json();
    return data.text || '';
}

export async function checkSynthHealth() {
    const res = await request('/health', { method: 'GET' });
    return res.json();
}
