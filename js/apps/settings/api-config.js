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
    
    main.appendChild(connectionSection);
    main.appendChild(connectionGroup);
    
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