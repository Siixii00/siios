import Router from '../router.js';
import { createElement, createIcon, createIOSSlider, createToast } from '../components.js';
import { SettingsDB } from '../db.js';
import APIClient from '../api.js';

let settings = {};

async function render() {
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
    backBtn.onclick = () => Router.navigate('/settings');
    inner.appendChild(backBtn);
    
    inner.appendChild(createElement('h1', 'ios-inline-title', { textContent: 'API 設定' }));
    inner.appendChild(createElement('div', ''));
    
    header.appendChild(inner);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-6 pb-24');
    
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
    
    const testCell = createElement('div', 'p-4 flex items-center justify-between');
    const statusIndicator = createElement('div', 'flex items-center gap-2');
    statusIndicator.appendChild(createElement('div', 'w-3 h-3 rounded-full bg-gray-400'));
    statusIndicator.appendChild(createElement('span', 'text-sm', { textContent: '連線狀態' }));
    testCell.appendChild(statusIndicator);
    
    const testBtn = createElement('button', 'ios-btn ios-btn-primary', { textContent: '測試連線' });
    testBtn.onclick = async () => {
        testBtn.disabled = true;
        testBtn.textContent = '測試中...';
        
        await SettingsDB.set('api_url', settings.api_url);
        await SettingsDB.set('api_key', settings.api_key);
        
        const result = await APIClient.testConnection();
        
        const indicator = statusIndicator.querySelector('.w-3');
        const statusText = statusIndicator.querySelector('.text-sm');
        
        if (result.success) {
            indicator.className = 'w-3 h-3 rounded-full bg-green-500';
            statusText.textContent = '連線成功';
            createToast('連線成功', 'success');
        } else {
            indicator.className = 'w-3 h-3 rounded-full bg-red-500';
            statusText.textContent = '連線失敗';
            createToast(result.message, 'error');
        }
        
        testBtn.disabled = false;
        testBtn.textContent = '測試連線';
    };
    testCell.appendChild(testBtn);
    connectionGroup.appendChild(testCell);
    
    main.appendChild(connectionSection);
    main.appendChild(connectionGroup);
    
    const contextSection = createElement('div', 'mt-8 ml-8');
    contextSection.appendChild(createElement('p', 'ios-section-header', { textContent: '上下文設定' }));
    
    const contextGroup = createElement('div', 'ios-grouped-list mx-4 p-4');
    
    contextGroup.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'Context Size (上下文大小)' }));
    const contextInput = createElement('input', 'ios-input', {
        type: 'number',
        value: settings.context_size || 4096
    });
    contextInput.oninput = (e) => {
        settings.context_size = parseInt(e.target.value) || 4096;
        saveSettings();
    };
    contextGroup.appendChild(contextInput);
    
    main.appendChild(contextSection);
    main.appendChild(contextGroup);
    
    const genSection = createElement('div', 'mt-8 ml-8');
    genSection.appendChild(createElement('p', 'ios-section-header', { textContent: '生成參數' }));
    
    const genGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const tempCell = createElement('div', 'p-4');
    tempCell.appendChild(createElement('label', 'block mb-3', { textContent: 'Temperature (溫度)' }));
    const tempSlider = createIOSSlider(0, 2, 0.1, settings.temperature || 0.7, (val) => {
        settings.temperature = val;
        saveSettings();
    });
    tempCell.appendChild(tempSlider.container);
    tempCell.appendChild(createElement('p', 'text-sm text-ios-muted mt-2', { 
        textContent: '較高的數值使輸出更具隨機性，較低的數值使模型更保守。'
    }));
    genGroup.appendChild(tempCell);
    
    const topPCell = createElement('div', 'p-4');
    topPCell.appendChild(createElement('label', 'block mb-3', { textContent: 'Top P (核採樣)' }));
    const topPSlider = createIOSSlider(0, 1, 0.05, settings.top_p || 1.0, (val) => {
        settings.top_p = val;
        saveSettings();
    });
    topPCell.appendChild(topPSlider.container);
    topPCell.appendChild(createElement('p', 'text-sm text-ios-muted mt-2', { 
        textContent: '考慮機率累積達 P 的標記，0.1 表示只考慮前 10%。'
    }));
    genGroup.appendChild(topPCell);
    
    const freqCell = createElement('div', 'p-4');
    freqCell.appendChild(createElement('label', 'block mb-3', { textContent: 'Frequency Penalty (頻率懲罰)' }));
    const freqSlider = createIOSSlider(-2, 2, 0.1, settings.frequency_penalty || 0, (val) => {
        settings.frequency_penalty = val;
        saveSettings();
    });
    freqCell.appendChild(freqSlider.container);
    genGroup.appendChild(freqCell);
    
    const presCell = createElement('div', 'p-4');
    presCell.appendChild(createElement('label', 'block mb-3', { textContent: 'Presence Penalty (存在懲罰)' }));
    const presSlider = createIOSSlider(-2, 2, 0.1, settings.presence_penalty || 0, (val) => {
        settings.presence_penalty = val;
        saveSettings();
    });
    presCell.appendChild(presSlider.container);
    genGroup.appendChild(presCell);
    
    main.appendChild(genSection);
    main.appendChild(genGroup);
    
    const alertBox = createElement('div', 'mx-4 mt-6 p-4 bg-surface rounded-xl border border-ios-border flex gap-3');
    alertBox.appendChild(createIcon('info', 'text-ios-blue'));
    alertBox.appendChild(createElement('p', 'text-sm text-ios-muted', { 
        textContent: '建議不要同時大幅調整 Temperature 與 Top P。如需更有創意的回覆，優先調整 Temperature。'
    }));
    main.appendChild(alertBox);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

async function saveSettings() {
    try {
        await SettingsDB.set('temperature', settings.temperature);
        await SettingsDB.set('top_p', settings.top_p);
        await SettingsDB.set('frequency_penalty', settings.frequency_penalty);
        await SettingsDB.set('presence_penalty', settings.presence_penalty);
        await SettingsDB.set('context_size', settings.context_size);
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

export { render };