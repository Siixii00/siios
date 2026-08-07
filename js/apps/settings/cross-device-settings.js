import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { CrossDeviceSync } from '../../core/cross-device/sync-manager.js';
import { GitHubSync } from '../../core/cross-device/github-sync.js';

let syncManager = null;

async function renderCrossDeviceSettings() {
    if (!syncManager) {
        syncManager = new CrossDeviceSync();
        await syncManager.initialize();
    }

    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/settings')
    });
    backBtn.innerHTML = '`<i class=`'`fas fa-chevron-left`'`></i> 返回`';
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
            <div class='flex items-center gap-2 mb-2'>
                <i class='fas fa-sync text-xl'></i>
                <h2 class='text-lg font-bold'>跨裝置同步</h2>
            </div>
            <p class='text-sm opacity-90 mb-3'>讓您的活動記錄在電腦和手機間自動同步</p>
            <div class='text-xs opacity-80 space-y-1'>
                <div>? 端對端加密保護</div>
                <div>? GitHub Gist 雲端儲存</div>
                <div>? 自動衝突解決</div>
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
            <p class='mb-2'>需要建立具有 <strong>gist</strong> 權限的 Token：</p>
            <ol class='list-decimal list-inside space-y-1'>
                <li>前往 <a href='https://github.com/settings/tokens/new' target='_blank' class='text-blue-500 underline'>GitHub Token 設定</a></li>
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
                
                const keyDisplay = createElement('div', 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg');
                keyDisplay.innerHTML = `
                    <p class='font-semibold text-sm mb-2'>?? 重要：請備份加密金鑰</p>
                    <p class='text-xs text-gray-600 mb-2'>此金鑰用於解密您的活動記錄，遺失將無法復原！</p>
                    <div class='bg-white p-2 rounded border text-xs font-mono break-all'>${result.encryptionKey}</div>
                    <button class='mt-2 text-xs text-blue-500 underline' onclick='navigator.clipboard.writeText('${result.encryptionKey}').then(() => alert('已複製'))'>複製金鑰</button>
                `;
                tokenCard.appendChild(keyDisplay);
                
                setTimeout(() => Router.navigate('/settings/cross-device'), 2000);
            } catch (error) {
                createToast(`設定失敗：${error.message}`, 'error');
            }
            
            setupBtn.disabled = false;
            setupBtn.textContent = '啟用跨裝置同步';
        };
        tokenCard.appendChild(setupBtn);
        
        setupSection.appendChild(tokenCard);
        main.appendChild(setupSection);
    } else {
        const statusSection = createElement('div', 'mx-4 mb-4');
        
        const statusCard = createElement('div', `p-4 rounded-xl ${status.connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`);
        statusCard.innerHTML = `
            <div class='flex items-center gap-3'>
                <i class='fas ${status.connected ? 'fa-check-circle text-green-600' : 'fa-exclamation-circle text-red-600'} text-2xl'></i>
                <div class='flex-1'>
                    <h3 class='font-semibold text-sm'>${status.connected ? '已連線' : '連線失敗'}</h3>
                    <p class='text-xs text-gray-600'>${status.connected ? `GitHub 用戶：${status.user?.login}` : '請檢查 Token 是否有效'}</p>
                </div>
            </div>
        `;
        statusSection.appendChild(statusCard);
        
        const deviceCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm mt-4');
        deviceCard.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '裝置資訊' }));
        
        const deviceInfo = createElement('div', 'text-sm space-y-2');
        deviceInfo.innerHTML = `
            <div class='flex justify-between'>
                <span class='text-gray-600'>裝置 ID</span>
                <span class='font-mono text-xs'>${syncManager.deviceId}</span>
            </div>
            <div class='flex justify-between'>
                <span class='text-gray-600'>裝置名稱</span>
                <span>${syncManager.getDeviceName()}</span>
            </div>
            <div class='flex justify-between'>
                <span class='text-gray-600'>裝置類型</span>
                <span>${syncManager.getDeviceType() === 'mobile' ? '手機' : '電腦'}</span>
            </div>
        `;
        deviceCard.appendChild(deviceInfo);
        statusSection.appendChild(deviceCard);
        
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
        
        const dangerSection = createElement('div', 'mx-4 mb-8');
        dangerSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '危險操作' }));
        
        const dangerCard = createElement('div', 'bg-red-50 rounded-xl p-4 border border-red-200');
        
        const disconnectBtn = createElement('button', 'w-full text-red-600 font-semibold text-sm mb-2');
        disconnectBtn.textContent = '停用跨裝置同步';
        disconnectBtn.onclick = async () => {
            if (confirm('確定要停用跨裝置同步？這將刪除所有雲端資料。')) {
                await syncManager.disconnect();
                createToast('已停用跨裝置同步', 'success');
                Router.navigate('/settings/cross-device');
            }
        };
        dangerCard.appendChild(disconnectBtn);
        
        const warning = createElement('p', 'text-xs text-red-600');
        warning.textContent = '停用後將刪除 GitHub Gist 上的所有同步資料';
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