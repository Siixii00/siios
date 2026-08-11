import Router from '../../router.js';
import { createElement, createIcon, createIOSSlider, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import APIClient from '../../api.js';

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
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const models = (data.data || []).filter(m => m.id && !m.id.includes('embedding')).map(m => m.id);
            if (models.length === 0) throw new Error('無可用模型');
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

    main.appendChild(memorySection);
    main.appendChild(memoryGroup);

    const saveSection = createElement('div', 'mx-4 mt-6 mb-8');
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3', { textContent: '儲存設定' });
    saveBtn.onclick = async () => {
        const keys = [
            'api_url', 'api_key', 'model',
            'embedding_url', 'embedding_model', 'embedding_dimensions', 'embedding_api_key',
            'memory_enabled', 'memory_decay_rate', 'memory_threshold'
        ];
        for (const key of keys) {
            await SettingsDB.set(key, settings[key]);
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
