import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { getSynthConfig, saveSynthConfig, checkSynthHealth, SYNTH_KINDS, SYNTH_PROVIDERS } from '../../core/synth-client.js';

const KIND_ORDER = ['tts', 'image', 'stt', 'music', 'video'];

const KIND_NOTES = {
    tts: '把角色的回應轉成語音。免費路徑：Cloudflare（支援中文）。',
    image: '依文字描述生成圖片。免費路徑：Cloudflare（FLUX）。',
    stt: '把你的語音訊息轉成文字讓角色看懂。免費路徑：Cloudflare（Whisper）；錄音時瀏覽器也會嘗試即時辨識。',
    music: '依描述合成音樂。沒有穩定的免費路徑：可嘗試 Hugging Face（需 token，額度極少），或使用 Replicate 付費。',
    video: '依描述生成短影片。沒有免費路徑：需使用 Replicate 等付費服務，並填入模型 ID。'
};

function field(label, input, hint) {
    const wrap = createElement('div', 'p-4');
    wrap.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: label }));
    wrap.appendChild(input);
    if (hint) wrap.appendChild(createElement('p', 'text-xs text-ios-muted mt-1', { textContent: hint }));
    return wrap;
}

async function renderSynthSettings() {
    const cfg = await getSynthConfig();

    const container = createElement('div', 'app-container bg-ios-bg');
    const header = createElement('header', 'ios-nav-bar');
    header.style.paddingTop = 'env(safe-area-inset-top)';
    const inner = createElement('div', 'ios-nav-bar-inner');
    const backBtn = createElement('button', 'ios-btn');
    backBtn.appendChild(createIcon('chevron_left'));
    backBtn.appendChild(createElement('span', '', { textContent: '返回' }));
    backBtn.onclick = () => Router.navigate('/settings');
    inner.appendChild(backBtn);
    inner.appendChild(createElement('h1', 'ios-inline-title', { textContent: '合成服務' }));
    inner.appendChild(createElement('div', ''));
    header.appendChild(inner);
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    const intro = createElement('div', 'mx-4 mb-4 text-sm text-ios-muted');
    intro.innerHTML = '聊天室的語音、圖片、影片、音樂合成透過你自己部署的 Worker（<code>synth-worker/</code>）。' +
        '<b>免費優先</b>：語音、圖片、語音辨識可用 Cloudflare 免費額度（每天有上限，品質普通）；' +
        '影片與音樂<b>沒有穩定的免費服務</b>，要使用請在下方改用付費服務。';
    main.appendChild(intro);

    // 連線
    const connSec = createElement('div', 'mb-2 ml-8');
    connSec.appendChild(createElement('p', 'ios-section-header', { textContent: 'Worker 連線' }));
    main.appendChild(connSec);
    const connGroup = createElement('div', 'ios-grouped-list mx-4');
    const urlInput = createElement('input', 'ios-input', { type: 'url', placeholder: 'https://siios-synth-worker.<你的帳號>.workers.dev', value: cfg.url });
    const tokenInput = createElement('input', 'ios-input', { type: 'password', placeholder: 'SYNTH_TOKEN', value: cfg.token });
    connGroup.appendChild(field('Worker 網址', urlInput));
    connGroup.appendChild(field('Token（SYNTH_TOKEN）', tokenInput, '部署時用 wrangler secret put SYNTH_TOKEN 設定的同一組'));
    const testRow = createElement('div', 'p-4');
    const testBtn = createElement('button', 'ios-btn w-full py-3', { textContent: '測試連線' });
    const testResult = createElement('p', 'text-sm mt-2');
    testBtn.onclick = async () => {
        await saveSynthConfig(collect());
        testResult.textContent = '測試中…';
        try {
            const h = await checkSynthHealth();
            const names = Object.entries(h.free).map(([k, v]) => SYNTH_KINDS[k].label + (v ? ' ✓' : ' ✗（免費不可用）')).join('、');
            testResult.textContent = '連線成功。Workers AI：' + (h.workersAi ? '已綁定' : '未綁定') + '。' + names;
        } catch (e) {
            testResult.textContent = '連線失敗：' + e.message;
        }
    };
    testRow.append(testBtn, testResult);
    connGroup.appendChild(testRow);
    main.appendChild(connGroup);

    // 各功能
    const controls = {};
    KIND_ORDER.forEach(kind => {
        const kc = cfg.kinds[kind];
        const sec = createElement('div', 'mb-2 ml-8 mt-6');
        sec.appendChild(createElement('p', 'ios-section-header', { textContent: SYNTH_KINDS[kind].label + (SYNTH_KINDS[kind].free ? '' : '（需付費服務）') }));
        main.appendChild(sec);
        const group = createElement('div', 'ios-grouped-list mx-4');
        group.appendChild(createElement('p', 'text-xs text-ios-muted p-4', { textContent: KIND_NOTES[kind] }));

        const select = createElement('select', 'ios-input');
        Object.entries(SYNTH_PROVIDERS).filter(([, p]) => p.kinds.includes(kind)).forEach(([id, p]) => {
            const opt = createElement('option', '', { value: id, textContent: p.label });
            if (id === kc.provider) opt.selected = true;
            select.appendChild(opt);
        });
        const model = createElement('input', 'ios-input', { placeholder: '留空使用預設模型', value: kc.model || '' });
        const providerUrl = createElement('input', 'ios-input', { type: 'url', placeholder: 'https://api.openai.com', value: kc.providerUrl || '' });
        const key = createElement('input', 'ios-input', { type: 'password', placeholder: 'API 金鑰／token', value: kc.key || '' });
        const voice = createElement('input', 'ios-input', { placeholder: 'alloy', value: kc.voice || '' });

        const cells = {
            provider: field('服務', select),
            model: field('模型 ID', model, '付費服務 Replicate 格式：擁有者/名稱；Hugging Face 影片／語音需自行指定'),
            providerUrl: field('服務網址（OpenAI 相容）', providerUrl, '必須是 https，不可使用內網或 IP'),
            key: field('金鑰', key, '只存在這台裝置，會隨每次請求送到你的 Worker 轉交給該服務'),
            voice: field('聲音（TTS）', voice)
        };
        Object.values(cells).forEach(c => group.appendChild(c));
        const refresh = () => {
            const p = select.value;
            cells.providerUrl.style.display = p === 'openai' ? '' : 'none';
            cells.key.style.display = p === 'cloudflare' ? 'none' : '';
            cells.voice.style.display = kind === 'tts' && p === 'openai' ? '' : 'none';
        };
        select.onchange = refresh;
        refresh();
        controls[kind] = { select, model, providerUrl, key, voice };
        main.appendChild(group);
    });

    // 推薦
    const recSec = createElement('div', 'mb-2 ml-8 mt-6');
    recSec.appendChild(createElement('p', 'ios-section-header', { textContent: '想要更好品質？' }));
    main.appendChild(recSec);
    const rec = createElement('div', 'ios-grouped-list mx-4 p-4 text-sm');
    rec.innerHTML = '<p class="mb-2">免費額度的品質和穩定度有限。在意品質時可以改用付費服務（費用由各服務直接收取，價格會變動，請先到官網確認）：</p>' +
        '<ul style="padding-left:18px;list-style:disc;line-height:1.7">' +
        '<li><b>圖片、語音</b>：OpenAI 官方 API（服務網址 <code>https://api.openai.com</code>），或任何 OpenAI 相容服務。</li>' +
        '<li><b>影片、音樂</b>：<a href="https://replicate.com/explore" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">Replicate</a>。到網站搜尋「text-to-video」「music」，複製模型的「擁有者/名稱」貼到上方模型欄位，再填入 Replicate API token。</li>' +
        '</ul>' +
        '<p class="mt-2 text-ios-muted">影片與音樂生成通常需要數十秒到數分鐘；App 的等待上限約 2 分鐘，超過會提示逾時。</p>';
    main.appendChild(rec);

    function collect() {
        const out = { url: urlInput.value.trim().replace(/\/+$/, ''), token: tokenInput.value.trim(), kinds: {} };
        KIND_ORDER.forEach(kind => {
            const c = controls[kind];
            out.kinds[kind] = {
                provider: c.select.value,
                model: c.model.value.trim(),
                providerUrl: c.providerUrl.value.trim(),
                key: c.key.value.trim(),
                voice: c.voice.value.trim()
            };
        });
        return out;
    }

    const saveSection = createElement('div', 'mx-4 mt-6 mb-8');
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3', { textContent: '儲存設定' });
    saveBtn.onclick = async () => {
        const out = collect();
        if (out.url && !/^https?:\/\//i.test(out.url)) {
            createToast('Worker 網址必須以 http:// 或 https:// 開頭', 'error');
            return;
        }
        await saveSynthConfig(out);
        createToast('設定已儲存');
    };
    saveSection.appendChild(saveBtn);
    main.appendChild(saveSection);

    container.appendChild(main);
    return { element: container, cleanup: null };
}

export default {
    id: 'synth-settings',
    name: '合成服務',
    icon: 'graphic_eq',
    routes: [
        { path: '/settings/synth', render: renderSynthSettings }
    ]
};
