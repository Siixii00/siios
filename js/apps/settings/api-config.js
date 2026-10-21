import Router from '../../router.js';
import { createElement, createIcon, createIOSSlider, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { createEmbeddingClient } from '../../core/embedding/index.js';
import { EMBEDDING_PRESETS, findPreset } from '../../core/embedding/presets.js';
import { getSynthConfig } from '../../core/synth-client.js';
import { memorySettingsFrom } from '../../core/memory-system/index.js';

let settings = {};

async function renderApiConfig() {
    settings = await SettingsDB.getAll();
    const defaults = await SettingsDB.getDefaults();
    settings = { ...defaults, ...settings };
    
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-nav-bar');
    header.style.paddingTop = 'env(safe-area-inset-top)';
    
    const inner = createElement('div', 'ios-nav-bar-inner');
    
    const backBtn = createElement('button', 'ios-btn');
    backBtn.appendChild(createIcon('chevron_left'));
    backBtn.appendChild(createElement('span', '', { textContent: '返回' }));
    backBtn.onclick = () => Router.back();
    inner.appendChild(backBtn);
    
    inner.appendChild(createElement('h1', 'ios-inline-title', { textContent: 'API 設定' }));
    inner.appendChild(createElement('div', ''));
    
    header.appendChild(inner);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';
    
    const connectionSection = createElement('div', 'mb-2 ml-8');
    connectionSection.appendChild(createElement('p', 'ios-section-header', { textContent: '連線設定' }));
    
    const connectionGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const urlCell = createElement('div', 'p-4');
    urlCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'API URL' }));
    const urlInput = createElement('input', 'ios-input', {
        type: 'url',
        placeholder: 'https://api.openai.com',
        value: settings.api_url || ''
    });
    urlInput.oninput = (e) => settings.api_url = e.target.value;
    urlCell.appendChild(urlInput);
    connectionGroup.appendChild(urlCell);
    
    const keyCell = createElement('div', 'p-4 mt-2');
    keyCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'API Key' }));
    const keyInput = createElement('input', 'ios-input', {
        type: 'password',
        placeholder: 'sk-...',
        value: settings.api_key || ''
    });
    keyInput.oninput = (e) => settings.api_key = e.target.value;
    keyCell.appendChild(keyInput);
    connectionGroup.appendChild(keyCell);

    // 模型選擇
    const modelCell = createElement('div', 'p-4 mt-2');
    modelCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: '模型' }));
    const modelRow = createElement('div', 'flex gap-2');
    const modelInput = createElement('input', 'ios-input flex-1', {
        type: 'text',
        placeholder: 'gpt-3.5-turbo',
        value: settings.model || ''
    });
    modelInput.oninput = (e) => settings.model = e.target.value;
    modelRow.appendChild(modelInput);
    const fetchBtn = createElement('button', 'ios-btn text-sm px-3', { textContent: '抓取模型' });
    fetchBtn.onclick = async () => {
        const apiUrl = settings.api_url || urlInput.value;
        const apiKey = settings.api_key || keyInput.value;
        if (!apiUrl) { createToast('請先輸入 API URL', 'error'); return; }
        fetchBtn.disabled = true;
        fetchBtn.textContent = '載入中...';
        try {
            const resp = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!resp.ok) {
                if (resp.status === 404) {
                    throw new Error('此 API 不支援列出模型，請手動輸入模型名稱');
                }
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const models = (data.data || []).filter(m => m.id && !m.id.includes('embedding')).map(m => m.id);
            if (models.length === 0) throw new Error('無可用模型，請手動輸入模型名稱');
            showModelPicker(models, modelInput);
        } catch (err) {
            createToast('抓取失敗：' + err.message, 'error');
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.textContent = '抓取模型';
        }
    };
    modelRow.appendChild(fetchBtn);
    modelCell.appendChild(modelRow);
    connectionGroup.appendChild(modelCell);

    // 測試連接（放在模型抓取按鈕下方）
    const testCell = createElement('div', 'p-4 pt-0');
    const testBtn = createElement('button', 'ios-btn w-full py-3', { textContent: '測試連接' });
    testBtn.onclick = async () => {
        const apiUrl = settings.api_url || urlInput.value;
        const apiKey = settings.api_key || keyInput.value;
        const model = settings.model || modelInput.value;
        if (!apiUrl) { createToast('請先輸入 API URL', 'error'); return; }
        if (!model) { createToast('請先輸入或選擇模型', 'error'); return; }
        testBtn.disabled = true;
        testBtn.textContent = '測試中...';
        try {
            const resp = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
            });
            if (resp.ok) {
                createToast('✅ 連線成功！API 正常運作', 'success');
            } else {
                const err = await resp.json().catch(() => ({}));
                createToast('❌ 連線失敗：' + (err.error?.message || `HTTP ${resp.status}`), 'error');
            }
        } catch (err) {
            createToast('❌ 連線失敗：' + (err.message || '無法連線，請檢查網址'), 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '測試連接';
        }
    };
    testCell.appendChild(testBtn);
    connectionGroup.appendChild(testCell);
    
    main.appendChild(connectionSection);
    main.appendChild(connectionGroup);

    const embeddingSection = createElement('div', 'mb-2 ml-8 mt-6');
    embeddingSection.appendChild(createElement('p', 'ios-section-header', { textContent: '嵌入模型設定' }));
    
    const embeddingGroup = createElement('div', 'ios-grouped-list mx-4');

    const embUrlCell = createElement('div', 'p-4');
    embUrlCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'Embedding URL' }));
    const embUrlInput = createElement('input', 'ios-input', {
        type: 'url',
        placeholder: 'https://api.openai.com',
        value: settings.embedding_url || ''
    });
    embUrlInput.oninput = (e) => settings.embedding_url = e.target.value;
    embUrlCell.appendChild(embUrlInput);
    embeddingGroup.appendChild(embUrlCell);

    const embModelCell = createElement('div', 'p-4 mt-2');
    embModelCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'Embedding Model' }));
    const embModelInput = createElement('input', 'ios-input', {
        type: 'text',
        placeholder: 'text-embedding-3-small',
        value: settings.embedding_model || ''
    });
    embModelInput.oninput = (e) => settings.embedding_model = e.target.value;
    embModelCell.appendChild(embModelInput);
    embeddingGroup.appendChild(embModelCell);

    const embDimCell = createElement('div', 'p-4 mt-2');
    embDimCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: '維度' }));
    const embDimInput = createElement('input', 'ios-input', {
        type: 'number',
        placeholder: '1536',
        value: settings.embedding_dimensions || 1536
    });
    embDimInput.oninput = (e) => settings.embedding_dimensions = parseInt(e.target.value) || 1536;
    embDimCell.appendChild(embDimInput);
    embeddingGroup.appendChild(embDimCell);

    const embKeyCell = createElement('div', 'p-4 mt-2');
    embKeyCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'Embedding API Key' }));
    const embKeyInput = createElement('input', 'ios-input', {
        type: 'password',
        placeholder: '留空則使用主 API Key',
        value: settings.embedding_api_key || ''
    });
    embKeyInput.oninput = (e) => settings.embedding_api_key = e.target.value;
    embKeyCell.appendChild(embKeyInput);
    embeddingGroup.appendChild(embKeyCell);

    // 免費服務捷徑：選了就把網址、模型填好（API Key 要自己申請）
    const presetCell = createElement('div', 'p-4');
    presetCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: '免費嵌入服務捷徑' }));
    const presetSelect = createElement('select', 'ios-input');
    presetSelect.appendChild(createElement('option', '', { value: '', textContent: '— 選擇一個服務，自動填入網址與模型 —' }));
    EMBEDDING_PRESETS.forEach(p => presetSelect.appendChild(createElement('option', '', { value: p.id, textContent: p.name })));
    const presetNote = createElement('div', 'text-xs text-ios-muted mt-2');
    presetSelect.onchange = async () => {
        const p = findPreset(presetSelect.value);
        if (!p) { presetNote.textContent = ''; return; }
        let url = p.url;
        let key = null;
        if (p.id === 'siios-worker') {
            const synth = await getSynthConfig();
            url = synth.url;
            key = synth.token;
            if (!url) createToast('先到「合成服務」填入 Worker 網址與 Token，這裡才能自動帶入', 'warning');
        }
        embUrlInput.value = url; settings.embedding_url = url;
        embModelInput.value = p.model; settings.embedding_model = p.model;
        if (p.dimensions) { embDimInput.value = p.dimensions; settings.embedding_dimensions = p.dimensions; }
        if (key) { embKeyInput.value = key; settings.embedding_api_key = key; }
        presetNote.innerHTML = '';
        presetNote.append(p.note + ' ', p.keyHint + '。 ');
        const a = createElement('a', 'text-blue-500 underline', { href: p.link, target: '_blank', textContent: '前往官網' });
        presetNote.appendChild(a);
    };
    presetCell.append(presetSelect, presetNote);
    embeddingGroup.appendChild(presetCell);

    const embTestCell = createElement('div', 'p-4');
    const embTestBtn = createElement('button', 'ios-btn w-full py-2', { textContent: '測試嵌入模型' });
    const embTestResult = createElement('div', 'text-xs mt-2');
    embTestBtn.onclick = async () => {
        // 用畫面上目前填的值測試（還沒按「儲存設定」也可以）
        embTestBtn.disabled = true;
        embTestBtn.textContent = '測試中…';
        const result = await createEmbeddingClient(settings).testConnection();
        embTestResult.textContent = result.message;
        embTestResult.style.color = result.success ? '#15803d' : '#b91c1c';
        embTestBtn.disabled = false;
        embTestBtn.textContent = '測試嵌入模型';
    };
    embTestCell.append(embTestBtn, embTestResult);
    embTestCell.appendChild(createElement('p', 'text-xs text-ios-muted mt-2', { textContent: 'Embedding URL 留空時，會使用上面的聊天 API 網址。網址填到服務根網址即可（例如 https://api.openai.com），不用加 /v1。測試通過後，新的記憶會有語意搜尋；舊記憶維持關鍵字搜尋。' }));
    embeddingGroup.appendChild(embTestCell);

    main.appendChild(embeddingSection);
    main.appendChild(embeddingGroup);

    const memorySection = createElement('div', 'mb-2 ml-8 mt-6');
    memorySection.appendChild(createElement('p', 'ios-section-header', { textContent: '記憶系統' }));
    
    const memoryGroup = createElement('div', 'ios-grouped-list mx-4');

    const memToggleCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    memToggleCell.appendChild(createElement('span', 'flex-1', { textContent: '啟用記憶系統' }));
    const memToggle = createElement('input', '', {
        type: 'checkbox',
        checked: settings.memory_enabled || false
    });
    memToggle.style.cssText = 'width:48px;height:28px;accent-color:var(--ios-blue);';
    memToggle.checked = !!settings.memory_enabled;
    memToggle.oninput = (e) => settings.memory_enabled = e.target.checked;
    memToggleCell.appendChild(memToggle);
    memoryGroup.appendChild(memToggleCell);

    const memDecayCell = createElement('div', 'p-4 mt-2');
    memDecayCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: '衰變率' }));
    const memDecayInput = createElement('input', 'ios-input', {
        type: 'number',
        step: '0.001',
        placeholder: '0.01',
        value: settings.memory_decay_rate || 0.01
    });
    memDecayInput.oninput = (e) => settings.memory_decay_rate = parseFloat(e.target.value) || 0.01;
    memDecayCell.appendChild(memDecayInput);
    memoryGroup.appendChild(memDecayCell);

    const memThreshCell = createElement('div', 'p-4 mt-2');
    memThreshCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: '遺忘閾值' }));
    const memThreshInput = createElement('input', 'ios-input', {
        type: 'number',
        step: '0.01',
        placeholder: '0.01',
        value: settings.memory_threshold || 0.01
    });
    memThreshInput.oninput = (e) => settings.memory_threshold = parseFloat(e.target.value) || 0.01;
    memThreshCell.appendChild(memThreshInput);
    memoryGroup.appendChild(memThreshCell);

    // 記憶消化專用 API：各 App 隨手寫入的記憶，交給它整理成摘要、學到的事、重要度與標籤（可選便宜的模型；留空就用上面的聊天 API）
    const digestCell = createElement('div', 'p-4 mt-2');
    digestCell.appendChild(createElement('label', 'text-sm font-medium block mb-1', { textContent: '記憶消化 API（選填）' }));
    digestCell.appendChild(createElement('p', 'text-xs text-ios-muted mb-2', { textContent: '角色的記憶需要「消化」：把各個 App 留下的片段整理成一句話摘要、記住用戶的喜好與關係變化、判斷重要度。這組 API 專門做這件事，可以用便宜的小模型，不影響聊天。要自動消化，網址與金鑰都要填；留空時只能手動按下面的按鈕，並使用上面的聊天 API。記憶內容會送到這組 API。' }));
    const digestUrl = createElement('input', 'ios-input', { type: 'url', placeholder: 'https://api.openai.com（不要加 /v1）', value: settings.memory_api_url || '' });
    digestUrl.oninput = (e) => settings.memory_api_url = e.target.value.trim();
    const digestKey = createElement('input', 'ios-input mt-2', { type: 'password', placeholder: 'API Key', value: settings.memory_api_key || '' });
    digestKey.oninput = (e) => settings.memory_api_key = e.target.value.trim();
    const digestModel = createElement('input', 'ios-input mt-2', { type: 'text', placeholder: '模型名稱，例如 gpt-4o-mini', value: settings.memory_model || '' });
    digestModel.oninput = (e) => settings.memory_model = e.target.value.trim();
    const digestPrompt = createElement('textarea', 'ios-input mt-2', { placeholder: '消化提示詞（選填）：想讓整理更貼近你的需求時，寫在這裡。例如：「用角色的第一人稱口吻寫摘要」「特別留意用戶的飲食、作息與心情」「工作上的瑣事重要度給低一點」', value: settings.memory_digest_prompt || '' });
    digestPrompt.rows = 4;
    digestPrompt.value = settings.memory_digest_prompt || '';
    digestPrompt.maxLength = 1000;
    digestPrompt.oninput = (e) => settings.memory_digest_prompt = e.target.value;
    const digestPromptHint = createElement('p', 'text-xs text-ios-muted mt-1', { textContent: '內建的整理規則（保留具體資訊、只記能長期使用的事、不編造）一直都在，這裡寫的是額外要求，會接在後面，不能改變輸出格式。最多 1000 字。' });
    const digestStatus = createElement('p', 'text-xs text-ios-muted mt-2', { textContent: '' });
    const digestBtn = createElement('button', 'ios-btn mt-2', { textContent: '立即消化記憶' });
    const refreshDigestStatus = async () => {
        const memory = window.App?.memorySystem;
        if (!memory) return;
        const s = await memory.getDigestStats();
        digestStatus.textContent = `共 ${s.total} 則記憶，已消化 ${s.digested}，待消化 ${s.pending}${s.dedicated ? '（啟動後每 15 分鐘自動消化）' : '（沒有專用 API，不會自動消化）'}`;
    };
    digestBtn.onclick = async () => {
        const memory = window.App?.memorySystem;
        if (!memory) { createToast('記憶系統尚未啟動', 'error'); return; }
        digestBtn.disabled = true; digestBtn.textContent = '消化中…';
        try {
            memory.reconfigure(memorySettingsFrom(settings)); // 用畫面上目前填的設定（還沒按儲存也能試）
            const res = await memory.digestPending({ limit: 48 });
            if (res.skipped === 'no_api') createToast('還沒有可用的 API：請填上面的聊天 API，或這裡的消化 API', 'error');
            else if (res.error) createToast(res.error + '（已消化 ' + res.digested + ' 則）', 'error');
            else createToast('已消化 ' + res.digested + ' 則記憶');
        } catch (e) { createToast('消化失敗：' + (e?.message || e), 'error'); }
        digestBtn.disabled = false; digestBtn.textContent = '立即消化記憶';
        refreshDigestStatus();
    };
    digestCell.append(digestUrl, digestKey, digestModel, digestPrompt, digestPromptHint, digestBtn, digestStatus);
    memoryGroup.appendChild(digestCell);
    refreshDigestStatus();

    main.appendChild(memorySection);
    main.appendChild(memoryGroup);

    const visionSection = createElement('div', 'mb-2 ml-8 mt-6');
    visionSection.appendChild(createElement('p', 'ios-section-header', { textContent: '圖片理解' }));
    const visionGroup = createElement('div', 'ios-grouped-list mx-4');
    const visionCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    visionCell.appendChild(createElement('span', 'flex-1', { textContent: '模型支援圖片輸入（視覺）' }));
    const visionToggle = createElement('input', '', { type: 'checkbox' });
    visionToggle.checked = !!settings.vision_enabled;
    visionToggle.style.cssText = 'width:48px;height:28px;accent-color:var(--ios-blue);';
    visionToggle.oninput = (e) => settings.vision_enabled = e.target.checked;
    visionCell.appendChild(visionToggle);
    visionGroup.appendChild(visionCell);
    visionGroup.appendChild(createElement('p', 'text-xs text-ios-muted p-4', {
        textContent: '開啟後，聊天中傳的圖片（最近 3 張）會真的送給模型看。只有你使用的模型支援圖片時才開啟，否則會出錯。關閉時，角色只會收到「[圖片]」標記。'
    }));
    main.appendChild(visionSection);
    main.appendChild(visionGroup);

    const saveSection = createElement('div', 'mx-4 mt-6 mb-8');
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3', { textContent: '儲存設定' });
    saveBtn.onclick = async () => {
        const keys = [
            'api_url', 'api_key', 'model',
            'embedding_url', 'embedding_model', 'embedding_dimensions', 'embedding_api_key',
            'memory_enabled', 'memory_decay_rate', 'memory_threshold', 'memory_api_url', 'memory_api_key', 'memory_model', 'memory_digest_prompt', 'vision_enabled'
        ];
        for (const key of keys) {
            await SettingsDB.set(key, settings[key]);
        }
        // 立即套用到執行中的記憶系統（原本要重開 App 才會生效）
        const memory = window.App?.memorySystem;
        if (memory) {
            memory.reconfigure(memorySettingsFrom(settings));
            if (settings.memory_enabled) memory.start(); else memory.stop();
        }
        createToast('設定已儲存');
    };
    saveSection.appendChild(saveBtn);
    main.appendChild(saveSection);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

function showModelPicker(models, modelInput) {
    const overlay = createElement('div', 'fixed inset-0 z-50 bg-black/40 flex items-end justify-center');
    const sheet = createElement('div', 'w-full max-w-lg bg-white rounded-t-2xl p-4 max-h-[60vh] flex flex-col');
    sheet.style.margin = '0 auto';

    const handle = createElement('div', 'w-9 h-1 bg-gray-300 rounded-full mx-auto mb-4');
    sheet.appendChild(handle);

    const title = createElement('div', 'text-base font-semibold text-center mb-3', { textContent: '選擇模型' });
    sheet.appendChild(title);

    const searchInput = createElement('input', 'w-full p-2 border rounded-lg text-sm mb-3', {
        type: 'text',
        placeholder: '搜尋模型...'
    });
    sheet.appendChild(searchInput);

    const list = createElement('div', 'flex-1 overflow-y-auto');
    function renderList(filter) {
        list.innerHTML = '';
        const filtered = filter ? models.filter(m => m.toLowerCase().includes(filter.toLowerCase())) : models;
        filtered.forEach(m => {
            const item = createElement('div', 'p-3 rounded-lg cursor-pointer hover:bg-gray-100 text-sm flex items-center justify-between');
            item.innerHTML = `<span class="font-mono">${m}</span>`;
            if (m === modelInput.value) {
                item.innerHTML += '<span class="text-green-500 text-xs">✓ 已選</span>';
            }
            item.onclick = () => {
                modelInput.value = m;
                settings.model = m;
                overlay.remove();
            };
            list.appendChild(item);
        });
        if (filtered.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">無符合的模型</div>';
        }
    }
    renderList('');

    searchInput.oninput = (e) => renderList(e.target.value);

    sheet.appendChild(list);
    overlay.appendChild(sheet);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

export default {
    id: 'api-config',
    name: 'API Config',
    icon: 'smart_toy',
    routes: [
        { path: '/api-config', render: renderApiConfig }
    ],
    navItem: null
};
