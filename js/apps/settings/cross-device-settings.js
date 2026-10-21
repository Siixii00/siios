import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { getSyncManager } from '../../core/cross-device/sync-manager.js';
import { GitHubSync } from '../../core/cross-device/github-sync.js';
import { askConfirm } from '../../core/dialogs.js';

let syncManager = null;

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        createToast(label + '已複製', 'success');
    } catch {
        createToast('無法自動複製，請手動選取', 'error');
    }
}

// 要在另一台裝置或瀏覽器擴充功能填的三樣東西：GitHub Token（自己的）、Gist ID、加密金鑰
function connectionInfoCard(info, { highlight = false } = {}) {
    const card = createElement('div', 'mt-4 p-4 rounded-lg border ' + (highlight ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'));
    card.appendChild(createElement('p', 'font-semibold text-sm mb-2', { textContent: '🔐 在另一台裝置或瀏覽器擴充功能加入同步' }));
    card.appendChild(createElement('p', 'text-xs text-gray-600 mb-3', { textContent: '在另一台裝置選「加入既有的同步」，填入你的 GitHub Token、下面的 Gist ID 與加密金鑰。加密金鑰遺失就無法解開活動記錄，請備份，也不要分享給別人。' }));
    for (const [label, value] of [['Gist ID', info.gistId], ['加密金鑰', info.encryptionKey]]) {
        const row = createElement('div', 'mb-2');
        row.appendChild(createElement('div', 'text-xs text-gray-500 mb-1', { textContent: label }));
        const line = createElement('div', 'flex gap-2 items-center');
        line.appendChild(createElement('div', 'flex-1 bg-white p-2 rounded border text-xs font-mono break-all', { textContent: value || '（找不到，可能是在別的瀏覽器設定的）' }));
        if (value) line.appendChild(createElement('button', 'text-xs text-blue-500 underline', { textContent: '複製', onClick: () => copyToClipboard(value, label) }));
        row.appendChild(line);
        card.appendChild(row);
    }
    return card;
}

async function renderCrossDeviceSettings() {
    // 和背景同步共用同一個管理器（不然會有兩組計時器各同步一次）
    if (!syncManager) syncManager = await getSyncManager();

    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/settings')
    });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = '跨裝置同步';
    header.appendChild(title);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';
    
    const status = await syncManager.getStatus();
    
    if (!status.enabled) {
        const setupSection = createElement('div', 'mx-4 mb-4');
        setupSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '設定同步' }));
        
        const introCard = createElement('div', 'p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white mb-4');
        introCard.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <i class="fas fa-sync text-xl"></i>
                <h2 class="text-lg font-bold">跨裝置同步</h2>
            </div>
            <p class="text-sm opacity-90 mb-3">讓您的活動記錄在電腦和手機間自動同步</p>
            <div class="text-xs opacity-80 space-y-1">
                <div>✓ 端對端加密保護</div>
                <div>✓ GitHub Gist 雲端儲存</div>
                <div>✓ 自動衝突解決</div>
            </div>
        `;
        setupSection.appendChild(introCard);
        
        const tokenCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
        
        tokenCard.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-2', {
            textContent: 'GitHub Personal Access Token'
        }));
        
        const tokenInput = createElement('input', 'w-full p-3 border rounded-lg text-sm mb-3', {
            type: 'password',
            placeholder: 'ghp_xxxxxxxxxxxx'
        });
        tokenCard.appendChild(tokenInput);
        
        const tokenHint = createElement('div', 'text-xs text-gray-500 mb-3');
        tokenHint.innerHTML = `
            <p class="mb-2">需要建立具有 <strong>gist</strong> 權限的 Token：</p>
            <ol class="list-decimal list-inside space-y-1">
                <li>前往 <a href="https://github.com/settings/tokens/new" target="_blank" class="text-blue-500 underline">GitHub Token 設定</a></li>
                <li>選擇 Generate new token (classic)</li>
                <li>勾選 <strong>gist</strong> 權限</li>
                <li>複製產生的 Token</li>
            </ol>
        `;
        tokenCard.appendChild(tokenHint);
        
        const testBtn = createElement('button', 'w-full ios-btn mb-2');
        testBtn.style.background = '#E5E5EA';
        testBtn.style.color = '#111827';
        testBtn.textContent = '測試連線';
        testBtn.onclick = async () => {
            if (!tokenInput.value.trim()) {
                createToast('請輸入 Token', 'error');
                return;
            }
            
            testBtn.disabled = true;
            testBtn.textContent = '測試中...';
            
            const result = await GitHubSync.validateToken(tokenInput.value.trim());
            
            if (result.success) {
                createToast(`連線成功！用戶：${result.user.login}`, 'success');
            } else {
                createToast(`連線失敗：${result.error}`, 'error');
            }
            
            testBtn.disabled = false;
            testBtn.textContent = '測試連線';
        };
        tokenCard.appendChild(testBtn);
        
        const setupBtn = createElement('button', 'w-full ios-btn ios-btn-primary');
        setupBtn.textContent = '啟用跨裝置同步';
        setupBtn.onclick = async () => {
            if (!tokenInput.value.trim()) {
                createToast('請輸入 Token', 'error');
                return;
            }
            
            setupBtn.disabled = true;
            setupBtn.textContent = '設定中...';
            
            try {
                const result = await syncManager.setupGitHubSync(tokenInput.value.trim());
                
                createToast('跨裝置同步已啟用', 'success');
                
                tokenCard.appendChild(connectionInfoCard({ gistId: result.gistId, encryptionKey: result.encryptionKey }, { highlight: true }));
                createToast('跨裝置同步已啟用，請先備份下面的加密金鑰', 'success');
                const doneBtn = createElement('button', 'w-full ios-btn ios-btn-primary mt-3', { textContent: '我已備份，完成', onClick: () => Router.navigate('/settings/cross-device') });
                tokenCard.appendChild(doneBtn);
                
            } catch (error) {
                createToast(`設定失敗：${error.message}`, 'error');
            }
            
            setupBtn.disabled = false;
            setupBtn.textContent = '啟用跨裝置同步';
        };
        tokenCard.appendChild(setupBtn);
        
        setupSection.appendChild(tokenCard);

        const joinCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm mt-4');
        joinCard.appendChild(createElement('p', 'font-semibold text-sm mb-1', { textContent: '已經在另一台裝置啟用過了？加入既有的同步' }));
        joinCard.appendChild(createElement('p', 'text-xs text-gray-500 mb-3', { textContent: '在第一台裝置的「跨裝置同步」頁面可以複製 Gist ID 與加密金鑰；Token 用同一個 GitHub 帳號建立即可。' }));
        const joinToken = createElement('input', 'w-full p-3 border rounded-lg text-sm mb-2', { type: 'password', placeholder: 'GitHub Token（ghp_…）' });
        const joinGist = createElement('input', 'w-full p-3 border rounded-lg text-sm mb-2', { type: 'text', placeholder: 'Gist ID（或整個 gist 網址）' });
        const joinKey = createElement('input', 'w-full p-3 border rounded-lg text-sm mb-3', { type: 'password', placeholder: '加密金鑰' });
        const joinBtn = createElement('button', 'w-full ios-btn ios-btn-primary', { textContent: '加入並同步' });
        joinBtn.onclick = async () => {
            joinBtn.disabled = true;
            joinBtn.textContent = '驗證中...';
            try {
                await syncManager.joinExisting({ token: joinToken.value, gistId: joinGist.value, encryptionKey: joinKey.value });
                const r = await syncManager.sync();
                createToast(`已加入同步：下載 ${r.downloaded} 筆、合併後 ${r.merged} 筆活動`, 'success');
                Router.navigate('/settings/cross-device');
            } catch (error) {
                createToast(error.message, 'error');
                joinBtn.disabled = false;
                joinBtn.textContent = '加入並同步';
            }
        };
        joinCard.append(joinToken, joinGist, joinKey, joinBtn);

        main.appendChild(setupSection);
        setupSection.appendChild(joinCard);
    } else {
        const statusSection = createElement('div', 'mx-4 mb-4');
        
        const statusCard = createElement('div', `p-4 rounded-xl ${status.connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`);
        statusCard.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas ${status.connected ? 'fa-check-circle text-green-600' : 'fa-exclamation-circle text-red-600'} text-2xl"></i>
                <div class="flex-1">
                    <h3 class="font-semibold text-sm">${status.connected ? '已連線' : '連線失敗'}</h3>
                    <p class="text-xs text-gray-600">${status.connected ? `GitHub 用戶：${status.user?.login}` : '請檢查 Token 是否有效'}</p>
                </div>
            </div>
        `;
        statusSection.appendChild(statusCard);
        
        const deviceCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm mt-4');
        deviceCard.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '裝置資訊' }));
        
        const deviceInfo = createElement('div', 'text-sm space-y-2');
        deviceInfo.innerHTML = `
            <div class="flex justify-between">
                <span class="text-gray-600">裝置 ID</span>
                <span class="font-mono text-xs">${syncManager.deviceId}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">裝置名稱</span>
                <span>${syncManager.getDeviceName()}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">裝置類型</span>
                <span>${syncManager.getDeviceType() === 'mobile' ? '手機' : '電腦'}</span>
            </div>
        `;
        deviceCard.appendChild(deviceInfo);
        statusSection.appendChild(deviceCard);
        const connInfo = await syncManager.getConnectionInfo();
        if (connInfo) statusSection.appendChild(connectionInfoCard(connInfo));
        
        main.appendChild(statusSection);
        
        const syncSection = createElement('div', 'mx-4 mb-4');
        syncSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '同步操作' }));
        
        const syncCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
        
        const syncBtn = createElement('button', 'w-full ios-btn ios-btn-primary mb-2');
        syncBtn.textContent = '立即同步';
        syncBtn.onclick = async () => {
            syncBtn.disabled = true;
            syncBtn.textContent = '同步中...';
            
            try {
                const result = await syncManager.sync();
                createToast(`同步完成：上傳 ${result.uploaded} 筆，下載 ${result.downloaded} 筆`, 'success');
            } catch (error) {
                createToast(`同步失敗：${error.message}`, 'error');
            }
            
            syncBtn.disabled = false;
            syncBtn.textContent = '立即同步';
        };
        syncCard.appendChild(syncBtn);
        
        const downloadBtn = createElement('button', 'w-full ios-btn mb-2');
        downloadBtn.style.background = '#E5E5EA';
        downloadBtn.style.color = '#111827';
        downloadBtn.textContent = '僅下載遠端資料';
        downloadBtn.onclick = async () => {
            downloadBtn.disabled = true;
            downloadBtn.textContent = '下載中...';
            
            try {
                const result = await syncManager.downloadActivities();
                createToast(`下載完成：${result.activities.length} 筆活動`, 'success');
            } catch (error) {
                createToast(`下載失敗：${error.message}`, 'error');
            }
            
            downloadBtn.disabled = false;
            downloadBtn.textContent = '僅下載遠端資料';
        };
        syncCard.appendChild(downloadBtn);
        
        syncSection.appendChild(syncCard);
        main.appendChild(syncSection);
        
        const autoSyncSection = createElement('div', 'mx-4 mb-4');
        autoSyncSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '自動同步' }));
        
        const autoSyncCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
        
        const autoSyncStatus = await syncManager.isAutoSyncEnabled();
        
        const toggleRow = createElement('div', 'flex items-center justify-between mb-3');
        
        const toggleLabel = createElement('span', 'text-sm font-medium text-gray-700');
        toggleLabel.textContent = '啟用自動同步';
        
        const toggleSwitch = createElement('button', 'relative inline-flex h-6 w-10 items-center rounded-full transition-colors', {
            onClick: async () => {
                if (autoSyncStatus.enabled) {
                    await syncManager.stopAutoSync();
                    createToast('自動同步已關閉', 'success');
                } else {
                    const interval = parseInt(intervalInput.value, 10) || 30;
                    await syncManager.startAutoSync(interval);
                    createToast(`自動同步已啟用（每${interval}分鐘）`, 'success');
                }
                Router.navigate('/settings/cross-device');
            }
        });
        toggleSwitch.style.background = autoSyncStatus.enabled ? '#4CAF50' : '#ccc';
        toggleSwitch.innerHTML = `<span class="absolute top-1 ${autoSyncStatus.enabled ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full"></span>`;
        toggleRow.appendChild(toggleLabel);
        toggleRow.appendChild(toggleSwitch);
        autoSyncCard.appendChild(toggleRow);
        
        const intervalLabel = createElement('label', 'block text-sm font-medium text-gray-700 mb-2');
        intervalLabel.textContent = '同步間隔 (分鐘)';
        
        const intervalInput = createElement('input', 'w-full p-3 border rounded-lg text-sm mb-2', {
            type: 'number',
            min: '5',
            max: '1440',
            value: String(autoSyncStatus.interval)
        });
        
        autoSyncCard.appendChild(intervalLabel);
        autoSyncCard.appendChild(intervalInput);
        
        autoSyncSection.appendChild(autoSyncCard);
        main.appendChild(autoSyncSection);
        
        const dangerSection = createElement('div', 'mx-4 mb-8');
        dangerSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '危險操作' }));
        
        const dangerCard = createElement('div', 'bg-red-50 rounded-xl p-4 border border-red-200');
        
        const disconnectBtn = createElement('button', 'w-full text-red-600 font-semibold text-sm mb-2');
        disconnectBtn.textContent = '停用跨裝置同步';
        disconnectBtn.onclick = async () => {
            const joined = !!(await syncManager.getConnectionInfo())?.joined;
            if (await askConfirm(joined ? '確定要停用這台裝置的跨裝置同步？雲端資料會保留給其他裝置繼續使用。' : '確定要停用跨裝置同步？這將刪除所有雲端資料（其他已加入的裝置也會失去同步）。')) {
                await syncManager.disconnect();
                createToast('已停用跨裝置同步', 'success');
                Router.navigate('/settings/cross-device');
            }
        };
        dangerCard.appendChild(disconnectBtn);
        
        const warning = createElement('p', 'text-xs text-red-600');
        warning.textContent = '如果這台是第一台（建立同步的裝置），停用後會刪除 GitHub Gist 上的同步資料；加入既有同步的裝置停用時只會解除自己的連線';
        dangerCard.appendChild(warning);
        
        dangerSection.appendChild(dangerCard);
        main.appendChild(dangerSection);
    }
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'cross-device-settings',
    name: '跨裝置同步',
    routes: [
        { path: '/settings/cross-device', render: renderCrossDeviceSettings }
    ]
};