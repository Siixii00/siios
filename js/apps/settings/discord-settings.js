import Router from '../../router.js';
import { createElement, createIcon, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB, MemoryDB, WorldInfoDB, GlobalSettingsDB, GlobalForbiddenDB, MessagesDB, ChatsDB, DiscordUserBindingDB, initDB, parseWorkerTimestamp } from '../../db.js';

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
            <i class="fab fa-discord text-2xl"></i>
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
    
    // Backup Key 設定（用於從 Worker 拉取完整備份）
    const backupSection = createElement('div', 'mx-4 mb-4');
    const backupCard = createElement('div', 'bg-white rounded-xl p-4');

    const backupLabel = createElement('label', 'block text-sm font-medium text-gray-700 mb-2');
    backupLabel.textContent = 'Backup Key（備份金鑰）';
    backupCard.appendChild(backupLabel);

    const backupInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    backupInput.type = 'password';
    backupInput.placeholder = '輸入 Worker 的 BACKUP_KEY';
    backupInput.id = 'discord-backup-key';

    const savedBackupKey = await SettingsDB.get('discord_backup_key');
    if (savedBackupKey) {
        backupInput.value = savedBackupKey;
    }

    backupCard.appendChild(backupInput);

    const backupHint = createElement('p', 'text-xs text-gray-500 mt-2');
    backupHint.innerHTML = '與 Worker 的 <code>BACKUP_KEY</code> 環境變數相同。可在 Cloudflare 用 <code>wrangler secret put BACKUP_KEY</code> 設定';
    backupCard.appendChild(backupHint);

    backupSection.appendChild(backupCard);
    main.appendChild(backupSection);
    
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
            await SettingsDB.set('discord_backup_key', backupInput.value);
            
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
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }
            
            const response = await fetch(`${workerUrl}/discord/ping`);
            const data = await response.json();
            
            if (data.success) {
                createToast('連接成功！');
            } else {
                createToast('連接失敗：' + (data.error || '未知錯誤'), 'error');
            }
        } catch (error) {
            createToast('連接失敗：' + error.message, 'error');
        }
    };
    main.appendChild(testBtn);

    // 同步角色資料到 Worker
    const syncBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    syncBtn.style.maxWidth = 'calc(100% - 32px)';
    syncBtn.style.background = '#5865F2';
    syncBtn.style.color = '#fff';
    syncBtn.textContent = '🔄 同步角色資料到 Worker';
    syncBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }

            const characters = await CharactersDB.getAll();
            if (characters.length === 0) {
                createToast('沒有角色資料可同步', 'warning');
                return;
            }

            syncBtn.disabled = true;
            syncBtn.textContent = '同步中...';

            const response = await fetch(`${workerUrl}/sync/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characters })
            });

            const data = await response.json();
            if (data.success) {
                createToast(`已同步 ${data.count} 個角色到 Worker`, 'success');
            } else {
                createToast('同步失敗：' + data.error, 'error');
            }
        } catch (error) {
            createToast('同步失敗：' + error.message, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 同步角色資料到 Worker';
        }
    };
    main.appendChild(syncBtn);

    // 同步用戶面具（含禁忌詞）到 Worker
    const userSyncBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    userSyncBtn.style.maxWidth = 'calc(100% - 32px)';
    userSyncBtn.style.background = '#8E44AD';
    userSyncBtn.style.color = '#fff';
    userSyncBtn.textContent = '👤 同步用戶面具（含禁忌詞）到 Worker';
    userSyncBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }

            const users = await UsersDB.getAll();
            if (users.length === 0) {
                createToast('沒有用戶資料可同步', 'warning');
                return;
            }

            userSyncBtn.disabled = true;
            userSyncBtn.textContent = '同步中...';

            const response = await fetch(`${workerUrl}/sync/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users })
            });

            const data = await response.json();
            if (data.success) {
                createToast(`已同步 ${data.count} 個用戶面具到 Worker`, 'success');
            } else {
                createToast('同步失敗：' + data.error, 'error');
            }
        } catch (error) {
            createToast('同步失敗：' + error.message, 'error');
        } finally {
            userSyncBtn.disabled = false;
            userSyncBtn.textContent = '👤 同步用戶面具（含禁忌詞）到 Worker';
        }
    };
    main.appendChild(userSyncBtn);

    // 同步記憶到 Worker
    const memSyncBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    memSyncBtn.style.maxWidth = 'calc(100% - 32px)';
    memSyncBtn.style.background = '#10B981';
    memSyncBtn.style.color = '#fff';
    memSyncBtn.textContent = '🧠 同步記憶到 Worker';
    memSyncBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }

            const memories = await MemoryDB.getAll();
            if (memories.length === 0) {
                createToast('沒有記憶資料可同步', 'warning');
                return;
            }

            memSyncBtn.disabled = true;
            memSyncBtn.textContent = '同步中...';

            const response = await fetch(`${workerUrl}/sync/memories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memories })
            });

            const data = await response.json();
            if (data.success) {
                createToast(`已同步 ${data.count} 條記憶到 Worker`, 'success');
            } else {
                createToast('同步失敗：' + data.error, 'error');
            }
        } catch (error) {
            createToast('同步失敗：' + error.message, 'error');
        } finally {
            memSyncBtn.disabled = false;
            memSyncBtn.textContent = '🧠 同步記憶到 Worker';
        }
    };
    main.appendChild(memSyncBtn);

    // 同步世界書到 Worker
    const wiSyncBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    wiSyncBtn.style.maxWidth = 'calc(100% - 32px)';
    wiSyncBtn.style.background = '#8B5CF6';
    wiSyncBtn.style.color = '#fff';
    wiSyncBtn.textContent = '📖 同步世界書到 Worker';
    wiSyncBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }

            const [globalSettings, globalForbidden, worldInfo] = await Promise.all([
                GlobalSettingsDB.getAll(),
                GlobalForbiddenDB.getAll(),
                WorldInfoDB.getAll()
            ]);

            if (globalSettings.length === 0 && globalForbidden.length === 0 && worldInfo.length === 0) {
                createToast('沒有世界書資料可同步', 'warning');
                return;
            }

            wiSyncBtn.disabled = true;
            wiSyncBtn.textContent = '同步中...';

            const response = await fetch(`${workerUrl}/sync/world-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ globalSettings, globalForbidden, worldInfo })
            });

            const data = await response.json();
            if (data.success) {
                const parts = [];
                if (data.globalSettings) parts.push(`設定 ${data.globalSettings} 條`);
                if (data.globalForbidden) parts.push(`禁用詞 ${data.globalForbidden} 條`);
                if (data.worldInfo) parts.push(`世界書 ${data.worldInfo} 條`);
                createToast(`已同步：${parts.join('、')}`, 'success');
            } else {
                createToast('同步失敗：' + data.error, 'error');
            }
        } catch (error) {
            createToast('同步失敗：' + error.message, 'error');
        } finally {
            wiSyncBtn.disabled = false;
            wiSyncBtn.textContent = '📖 同步世界書到 Worker';
        }
    };
main.appendChild(wiSyncBtn);

    // 備份資料並下載（直接從 PWA 觸發，不需 GitHub Actions）
    const backupBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    backupBtn.style.maxWidth = 'calc(100% - 32px)';
    backupBtn.style.background = '#F59E0B';
    backupBtn.style.color = '#fff';
    backupBtn.textContent = '💾 備份資料並下載';
    backupBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            const backupKey = backupInput.value;
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }
            if (!backupKey) {
                createToast('請先輸入 Backup Key', 'error');
                return;
            }

            backupBtn.disabled = true;
            backupBtn.textContent = '備份中...';

            const response = await fetch(`${workerUrl}/backup?key=${encodeURIComponent(backupKey)}`);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `discord-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            createToast(`備份完成！共 ${data.messages?.length || 0} 條訊息、${data.memories?.length || 0} 條記憶`, 'success');
        } catch (error) {
            createToast('備份失敗：' + error.message, 'error');
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = '💾 備份資料並下載';
        }
    };
    main.appendChild(backupBtn);

    // 同步 Discord 對話到 PWA（跨裝置：電腦 DC → 手機 PWA）
    const pullBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    pullBtn.style.maxWidth = 'calc(100% - 32px)';
    pullBtn.style.background = '#3B82F6';
    pullBtn.style.color = '#fff';
    pullBtn.textContent = '🔄 同步 Discord 對話到 PWA';
    pullBtn.onclick = async () => {
        try {
            const workerUrl = workerInput.value.replace(/\/+$/, '');
            if (!workerUrl) {
                createToast('請先輸入 Worker URL', 'error');
                return;
            }
            const characters = await CharactersDB.getAll();
            const bound = characters.filter(c => c.discord_enabled && c.discord_channel_id);
            if (bound.length === 0) {
                createToast('沒有設定 Discord 頻道綁定的角色\n請在角色設定中啟用 Discord 並填寫頻道 ID', 'warning');
                return;
            }

            pullBtn.disabled = true;
            pullBtn.textContent = '同步中...';
            let totalMsg = 0, totalMem = 0;
            const syncedNames = [];

            for (const char of bound) {
                const response = await fetch(`${workerUrl}/sync/chat?character_id=${encodeURIComponent(char.id)}`);
                if (!response.ok) continue;
                const data = await response.json();
                if (!data.success || (data.messages.length === 0 && data.memories.length === 0)) continue;

                // 確保聊天室存在
                await ChatsDB.ensureExists(char.id, {
                    character_name: char.name || 'AI',
                    character_avatar: char.avatar || '',
                    last_message: data.messages.length > 0 ? data.messages[data.messages.length - 1].content : ''
                });

                // 匯入訊息與記憶
                await MessagesDB.importMany(data.messages);
                await MemoryDB.importMany(data.memories);

                syncedNames.push(char.name || char.id);
                totalMsg += data.messages.length;
                totalMem += data.memories.length;
            }

            if (syncedNames.length === 0) {
                createToast('這些角色在 Worker 上還沒有對話記錄', 'info');
            } else {
                createToast(`已同步 ${syncedNames.join('、')}\n共 ${totalMsg} 條訊息、${totalMem} 條記憶`, 'success');
            }
        } catch (error) {
            createToast('同步失敗：' + error.message, 'error');
        } finally {
            pullBtn.disabled = false;
            pullBtn.textContent = '🔄 同步 Discord 對話到 PWA';
        }
    };
    main.appendChild(pullBtn);

    // 從備份檔還原
    const restoreBtn = createElement('button', 'ios-btn w-full mt-2 mx-4');
    restoreBtn.style.maxWidth = 'calc(100% - 32px)';
    restoreBtn.style.background = '#EF4444';
    restoreBtn.style.color = '#fff';
    restoreBtn.textContent = '♻️ 從備份檔還原';
    restoreBtn.onclick = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);

                restoreBtn.disabled = true;
                restoreBtn.textContent = '還原中...';

                // 1. 推送到 Worker
                const workerUrl = workerInput.value.replace(/\/+$/, '');
                let workerResult = null;
                if (workerUrl) {
                    const res = await fetch(`${workerUrl}/sync/restore`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const rd = await res.json();
                    if (!rd.success) throw new Error(rd.error || 'Worker 還原失敗');
                    workerResult = rd;
                }

                // 2. 匯入 PWA IndexedDB
                if (Array.isArray(data.characters)) await CharactersDB.importMany(data.characters);
                if (Array.isArray(data.discordUserBindings)) await DiscordUserBindingDB.importMany(data.discordUserBindings);
                if (Array.isArray(data.memories)) await MemoryDB.importMany(data.memories);
                if (Array.isArray(data.messages)) await importMessagesToPWA(data.messages);

                const parts = [];
                if (workerResult) {
                    parts.push(`✅ Worker：${workerResult.messages || 0} 訊息 / ${workerResult.memories || 0} 記憶 / ${workerResult.characters || 0} 角色 / ${workerResult.discordUserBindings || 0} 綁定`);
                }
                parts.push(`✅ PWA：${data.messages?.length || 0} 訊息 / ${data.memories?.length || 0} 記憶 / ${data.characters?.length || 0} 角色 / ${data.discordUserBindings?.length || 0} 綁定`);
                createToast(parts.join('\n'), 'success');
            } catch (error) {
                createToast('還原失敗：' + error.message, 'error');
            } finally {
                restoreBtn.disabled = false;
                restoreBtn.textContent = '♻️ 從備份檔還原';
            }
        };
        fileInput.click();
    };
    main.appendChild(restoreBtn);

    // 用戶綁定管理
    const bindingSection = createElement('div', 'mx-4 mt-6 mb-4');
    const bindingCard = createElement('div', 'bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200 cursor-pointer', {
        onClick: () => Router.navigate('/settings/discord/bindings')
    });
    
    const bindingHeader = createElement('div', 'flex items-center justify-between');
    const bindingInfo = createElement('div', 'flex items-center gap-3');
    
    const bindingIcon = createElement('div', 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center');
    bindingIcon.innerHTML = '<span class="material-symbols-outlined text-blue-600 text-xl">link</span>';
    bindingInfo.appendChild(bindingIcon);
    
    const bindingText = createElement('div');
    bindingText.appendChild(createElement('div', 'font-semibold text-sm', { textContent: '用戶身份綁定' }));
    bindingText.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: '管理 Discord 與 PWA 的用戶映射' }));
    bindingInfo.appendChild(bindingText);
    
    bindingHeader.appendChild(bindingInfo);
    bindingHeader.appendChild(createIcon('chevron_right', 'text-gray-400'));
    bindingCard.appendChild(bindingHeader);
    
    bindingSection.appendChild(bindingCard);
    main.appendChild(bindingSection);
    
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
            <li>6. 配置用戶身份綁定（可選）</li>
            <li>7. 在 Discord 伺服器中邀請 Bot</li>
            <li>8. 開始在頻道中與 AI 角色對話！</li>
        </ol>
    `;
    guideSection.appendChild(guideCard);
    main.appendChild(guideSection);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

// 從備份檔匯入訊息到 PWA（自動建立聊天室）
async function importMessagesToPWA(messages) {
    const db = await initDB();
    const chatIds = new Set(messages.map(m => m.chat_id).filter(Boolean));
    for (const chatId of chatIds) {
        const existing = await db.get('chats', chatId);
        if (!existing) {
            const chatMsgs = messages.filter(m => m.chat_id === chatId);
            const lastMsg = chatMsgs.sort((a, b) => parseWorkerTimestamp(b.timestamp) - parseWorkerTimestamp(a.timestamp))[0];
            await db.put('chats', {
                id: chatId,
                character_name: chatId,
                character_avatar: '',
                last_message: lastMsg?.content || '',
                last_updated: parseWorkerTimestamp(lastMsg?.timestamp),
                created_at: Date.now(),
                is_group: false,
                member_ids: []
            });
        }
    }
    await MessagesDB.importMany(messages);
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