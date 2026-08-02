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
            'api_url', 'api_key',
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

export default {
    id: 'api-config',
    name: 'API Config',
    icon: 'smart_toy',
    routes: [
        { path: '/api-config', render: renderApiConfig }
    ],
    navItem: null
};
