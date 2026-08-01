import Router from '../../router.js';
import { createElement, createIcon, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB } from '../../db.js';

async function renderDiscordSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/settings')
    });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = 'Discord 整合設定';
    header.appendChild(title);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';
    
    // 說明卡片
    const introCard = createElement('div', 'mx-4 mb-4 p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white');
    introCard.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined">discord</span>
            <h2 class="text-lg font-bold">Discord 即時通訊整合</h2>
        </div>
        <p class="text-sm opacity-90 mb-3">讓 AI 角色在 Discord 上與你和朋友即時對話，所有對話自動同步到 PWA</p>
        <div class="text-xs opacity-80">
            <div class="mb-1">✓ 公開頻道對話</div>
            <div class="mb-1">✓ 對話歷史記錄</div>
            <div>✓ Slash Commands</div>
        </div>
    `;
    main.appendChild(introCard);
    
    // Bot Token 設定
    const tokenSection = createElement('div', 'mx-4 mb-4');
    const tokenCard = createElement('div', 'bg-white rounded-xl p-4');
    
    const tokenLabel = createElement('label', 'block text-sm font-medium text-gray-700 mb-2');
    tokenLabel.textContent = 'Discord Bot Token';
    tokenCard.appendChild(tokenLabel);
    
    const tokenInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    tokenInput.type = 'password';
    tokenInput.placeholder = '輸入你的 Discord Bot Token';
    tokenInput.id = 'discord-bot-token';
    
    // 載入已保存的 Token
    const savedToken = await SettingsDB.get('discord_bot_token');
    if (savedToken) {
        tokenInput.value = savedToken;
    }
    
    tokenCard.appendChild(tokenInput);
    
    const tokenHint = createElement('p', 'text-xs text-gray-500 mt-2');
    tokenHint.innerHTML = '在 <a href="https://discord.com/developers/applications" target="_blank" class="text-blue-500 underline">Discord Developer Portal</a> 創建 Bot 並獲取 Token';
    tokenCard.appendChild(tokenHint);
    
    tokenSection.appendChild(tokenCard);
    main.appendChild(tokenSection);
    
    // Worker URL 設定
    const workerSection = createElement('div', 'mx-4 mb-4');
    const workerCard = createElement('div', 'bg-white rounded-xl p-4');
    
    const workerLabel = createElement('label', 'block text-sm font-medium text-gray-700 mb-2');
    workerLabel.textContent = 'Worker URL';
    workerCard.appendChild(workerLabel);
    
    const workerInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    workerInput.type = 'url';
    workerInput.placeholder = 'https://your-worker.workers.dev';
    workerInput.id = 'discord-worker-url';
    
    const savedWorker = await SettingsDB.get('discord_worker_url');
    if (savedWorker) {
        workerInput.value = savedWorker;
    }
    
    workerCard.appendChild(workerInput);
    
    const workerHint = createElement('p', 'text-xs text-gray-500 mt-2');
    workerHint.textContent = '部署 Discord Bot Worker 後獲得的 URL';
    workerCard.appendChild(workerHint);
    
    workerSection.appendChild(workerCard);
    main.appendChild(workerSection);
    
    // 頻道映射設定
    const channelSection = createElement('div', 'mx-4 mb-4');
    const channelCard = createElement('div', 'bg-white rounded-xl p-4');
    
    const channelTitle = createElement('h3', 'text-sm font-medium text-gray-700 mb-3');
    channelTitle.textContent = '頻道映射（選填）';
    channelCard.appendChild(channelTitle);
    
    const channelHint = createElement('p', 'text-xs text-gray-500 mb-3');
    channelHint.textContent = '設定特定頻道對應的角色';
    channelCard.appendChild(channelHint);
    
    const channelList = createElement('div', 'space-y-2');
    channelList.id = 'channel-mappings';
    
    // 載入已保存的映射
    const savedMappings = await SettingsDB.get('discord_channel_mappings') || [];
    savedMappings.forEach(mapping => {
        const mappingRow = createChannelMappingRow(mapping);
        channelList.appendChild(mappingRow);
    });
    
    channelCard.appendChild(channelList);
    
    const addMappingBtn = createElement('button', 'mt-3 text-sm text-blue-500 underline');
    addMappingBtn.textContent = '+ 新增頻道映射';
    addMappingBtn.onclick = () => {
        const newRow = createChannelMappingRow();
        channelList.appendChild(newRow);
    };
    channelCard.appendChild(addMappingBtn);
    
    channelSection.appendChild(channelCard);
    main.appendChild(channelSection);
    
    // 保存按鈕
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4 mx-4');
    saveBtn.style.maxWidth = 'calc(100% - 32px)';
    saveBtn.textContent = '保存設定';
    saveBtn.onclick = async () => {
        try {
            await SettingsDB.set('discord_bot_token', tokenInput.value);
            await SettingsDB.set('discord_worker_url', workerInput.value);
            
            // 收集頻道映射
            const mappings = [];
            channelList.querySelectorAll('.channel-mapping-row').forEach(row => {
                const channelId = row.querySelector('.channel-id-input').value;
                const characterId = row.querySelector('.character-id-input').value;
                if (channelId && characterId) {
                    mappings.push({ channelId, characterId });
                }
            });
            await SettingsDB.set('discord_channel_mappings', mappings);
            
            createToast('設定已保存');
        } catch (error) {
            createToast('保存失敗：' + error.message, 'error');
        }
    };
    main.appendChild(saveBtn);
    
    // 測試連接按鈕
    const testBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    testBtn.style.maxWidth = 'calc(100% - 32px)';
    testBtn.style.background = '#E5E5EA';
    testBtn.style.color = '#111827';
    testBtn.textContent = '測試連接';
    testBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value;
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }
            
            const response = await fetch(`${workerUrl}/discord/history?channel_id=test&limit=1`);
            const data = await response.json();
            
            if (data.success) {
                createToast('連接成功！');
            } else {
                createToast('連接失敗：' + data.error, 'error');
            }
        } catch (error) {
            createToast('連接失敗：' + error.message, 'error');
        }
    };
    main.appendChild(testBtn);
    
    // 使用說明
    const guideSection = createElement('div', 'mx-4 mt-6 mb-8');
    const guideCard = createElement('div', 'bg-gray-50 rounded-xl p-4');
    guideCard.innerHTML = `
        <h3 class="text-sm font-medium text-gray-700 mb-3">📖 使用指南</h3>
        <ol class="text-xs text-gray-600 space-y-2">
            <li>1. 在 Discord Developer Portal 創建 Bot 應用</li>
            <li>2. 獲取 Bot Token 並粘貼到上方</li>
            <li>3. 在神秘門生成 Discord Bot Worker 代碼</li>
            <li>4. 部署 Worker 到 Cloudflare</li>
            <li>5. 將 Worker URL 填入上方</li>
            <li>6. 在 Discord 伺服器中邀請 Bot</li>
            <li>7. 開始在頻道中與 AI 角色對話！</li>
        </ol>
    `;
    guideSection.appendChild(guideCard);
    main.appendChild(guideSection);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

function createChannelMappingRow(mapping = {}) {
    const row = createElement('div', 'channel-mapping-row flex gap-2 items-center');
    
    const channelInput = createElement('input', 'channel-id-input flex-1 p-2 border rounded text-xs');
    channelInput.type = 'text';
    channelInput.placeholder = '頻道 ID';
    if (mapping.channelId) channelInput.value = mapping.channelId;
    row.appendChild(channelInput);
    
    const characterInput = createElement('input', 'character-id-input flex-1 p-2 border rounded text-xs');
    characterInput.type = 'text';
    characterInput.placeholder = '角色 ID';
    if (mapping.characterId) characterInput.value = mapping.characterId;
    row.appendChild(characterInput);
    
    const deleteBtn = createElement('button', 'text-red-500 text-sm');
    deleteBtn.textContent = '✕';
    deleteBtn.onclick = () => row.remove();
    row.appendChild(deleteBtn);
    
    return row;
}

export default {
    id: 'discord-settings',
    name: 'Discord 整合',
    icon: 'discord',
    routes: [
        { path: '/settings/discord', render: renderDiscordSettings }
    ],
    navItem: null
};