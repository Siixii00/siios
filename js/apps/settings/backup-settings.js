import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { backupManager } from '../../core/backup-manager.js';

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

async function renderBackupSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: '資料備份與還原',
        backPath: '/settings'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');

    // 取得備份狀態
    const status = await backupManager.getBackupStatus();
    const githubUser = await SettingsDB.get('github_user');
    const googleUser = await SettingsDB.get('google_drive_user');

    // 狀態總覽
    const summarySection = createElement('div', 'mx-4 mb-4');
    const summaryCard = createElement('div', 'bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white');
    
    summaryCard.innerHTML = `
        <h2 class="font-bold mb-2">備份狀態總覽</h2>
        <div class="grid grid-cols-3 gap-2 text-center">
            <div>
                <div class="text-2xl">📱</div>
                <div class="text-xs mt-1">本地</div>
                <div class="text-xs opacity-80">${status.local.lastBackup ? new Date(status.local.lastBackup).toLocaleDateString() : '未備份'}</div>
            </div>
            <div>
                <div class="text-2xl">${status.github.connected ? '✓' : '○'}</div>
                <div class="text-xs mt-1">GitHub</div>
                <div class="text-xs opacity-80">${status.github.hasBackup ? '已備份' : (status.github.connected ? '未備份' : '未連接')}</div>
            </div>
            <div>
                <div class="text-2xl">${status.googleDrive.connected ? '✓' : '○'}</div>
                <div class="text-xs mt-1">GDrive</div>
                <div class="text-xs opacity-80">${status.googleDrive.hasBackup ? '已備份' : (status.googleDrive.connected ? '未備份' : '未連接')}</div>
            </div>
        </div>
    `;
    summarySection.appendChild(summaryCard);
    main.appendChild(summarySection);

    // 本地備份區
    const localSection = createElement('div', 'ios-grouped-list mx-4 mt-4');
    localSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '本地備份' }));

    const localCard = createElement('div', 'bg-white rounded-xl shadow-sm');

    const localExportBtn = createElement('button', 'ios-list-cell w-full text-left');
    localExportBtn.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-blue-600">download</span>
            </div>
            <div class="flex-1">
                <div class="font-medium">下載備份檔案 (JSON)</div>
                <div class="text-sm text-ios-muted">將所有資料匯出為 JSON 檔案，手動保存</div>
            </div>
        </div>
    `;
    localExportBtn.onclick = async () => {
        createToast('正在匯出資料...', 'info');
        try {
            const result = await backupManager.downloadLocalBackup();
            createToast(`已下載：${result.filename}`, 'success');
        } catch (e) {
            createToast('匯出失敗：' + e.message, 'error');
        }
    };
    localCard.appendChild(localExportBtn);

    const localImportBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
    localImportBtn.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-green-600">upload</span>
            </div>
            <div class="flex-1">
                <div class="font-medium">從檔案還原</div>
                <div class="text-sm text-ios-muted">選擇 JSON 備份檔案匯入還原</div>
            </div>
        </div>
    `;
    localImportBtn.onclick = () => showImportDialog(container);
    localCard.appendChild(localImportBtn);

    localSection.appendChild(localCard);
    main.appendChild(localSection);

    // GitHub 備份區
    const githubSection = createElement('div', 'ios-grouped-list mx-4 mt-6');
    githubSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: 'GitHub 雲端備份' }));

    const githubCard = createElement('div', 'bg-white rounded-xl shadow-sm');

    const githubStatusCell = createElement('div', 'ios-list-cell');
    const githubStatusBadge = createElement('div', `w-10 h-10 rounded-full flex items-center justify-center ${githubUser ? 'bg-gray-800' : 'bg-gray-300'}`);
    githubStatusBadge.appendChild(createIcon(githubUser ? 'check' : 'close', 'text-white'));
    githubStatusCell.appendChild(githubStatusBadge);

    const githubStatusText = createElement('div', 'flex-1');
    githubStatusText.appendChild(createElement('span', 'font-medium', { 
        textContent: githubUser ? `已連接：@${githubUser.login}` : '未連接 GitHub' 
    }));
    if (githubUser) {
        githubStatusText.appendChild(createElement('span', 'block text-sm text-ios-muted', { 
            textContent: status.github.hasBackup ? 
                `上次備份：${status.github.lastModified ? new Date(status.github.lastModified).toLocaleString() : '未知'}` : 
                '尚未備份' 
        }));
    }
    githubStatusCell.appendChild(githubStatusText);
    githubCard.appendChild(githubStatusCell);

    // GitHub 連接按鈕
    const githubConnectBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
    githubConnectBtn.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span class="material-symbols-outlined">link</span>
            </div>
            <div class="flex-1">
                <div class="font-medium">${githubUser ? '重新連接 / 設定' : '連接 GitHub'}</div>
            </div>
        </div>
    `;
    githubConnectBtn.onclick = () => showGitHubDialog(container);
    githubCard.appendChild(githubConnectBtn);

    // GitHub 備份/還原按鈕
    if (githubUser) {
        const githubBackupBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
        githubBackupBtn.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <span class="material-symbols-outlined text-purple-600">cloud_upload</span>
                </div>
                <div class="flex-1">
                    <div class="font-medium">立即備份到 GitHub</div>
                    <div class="text-sm text-ios-muted">上傳備份到私人倉庫</div>
                </div>
            </div>
        `;
        githubBackupBtn.onclick = async () => {
            createToast('正在上傳到 GitHub...', 'info');
            try {
                await backupManager.pushToGitHub();
                createToast('已備份到 GitHub', 'success');
                Router.navigate('/settings/backup');
            } catch (e) {
                createToast('備份失敗：' + e.message, 'error');
            }
        };
        githubCard.appendChild(githubBackupBtn);

        const githubRestoreBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
        githubRestoreBtn.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span class="material-symbols-outlined text-indigo-600">cloud_download</span>
                </div>
                <div class="flex-1">
                    <div class="font-medium">從 GitHub 還原</div>
                    <div class="text-sm text-ios-muted">下載並匯入雲端備份</div>
                </div>
            </div>
        `;
        githubRestoreBtn.onclick = async () => {
            if (!confirm('確定要從 GitHub 還原嗎？現有資料將會合併。')) return;
            createToast('正在從 GitHub 下載...', 'info');
            try {
                const result = await backupManager.pullFromGitHub();
                createToast(`還原完成，匯入了 ${result.report.imported.chats || 0} 個聊天室`, 'success');
                Router.navigate('/chats');
            } catch (e) {
                createToast('還原失敗：' + e.message, 'error');
            }
        };
        githubCard.appendChild(githubRestoreBtn);
    }

    githubSection.appendChild(githubCard);
    main.appendChild(githubSection);

    // Google Drive 備份區
    const googleSection = createElement('div', 'ios-grouped-list mx-4 mt-6');
    googleSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: 'Google Drive 備份' }));

    const googleCard = createElement('div', 'bg-white rounded-xl shadow-sm');

    const googleStatusCell = createElement('div', 'ios-list-cell');
    const googleStatusBadge = createElement('div', `w-10 h-10 rounded-full flex items-center justify-center ${googleUser ? 'bg-green-500' : 'bg-gray-300'}`);
    googleStatusBadge.appendChild(createIcon(googleUser ? 'check' : 'close', 'text-white'));
    googleStatusCell.appendChild(googleStatusBadge);

    const googleStatusText = createElement('div', 'flex-1');
    googleStatusText.appendChild(createElement('span', 'font-medium', { 
        textContent: googleUser ? `已連接：${googleUser.displayName || 'Google 帳戶'}` : '未連接 Google Drive' 
    }));
    googleStatusCell.appendChild(googleStatusText);
    googleCard.appendChild(googleStatusCell);

    // Google Drive 連接按鈕
    const googleConnectBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
    googleConnectBtn.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-red-500">link</span>
            </div>
            <div class="flex-1">
                <div class="font-medium">${googleUser ? '重新連接 Google Drive' : '連接 Google Drive'}</div>
            </div>
        </div>
    `;
    googleConnectBtn.onclick = () => showGoogleDriveDialog(container);
    googleCard.appendChild(googleConnectBtn);

    if (googleUser) {
        const googleBackupBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
        googleBackupBtn.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span class="material-symbols-outlined text-green-600">cloud_upload</span>
                </div>
                <div class="flex-1">
                    <div class="font-medium">立即備份到 Google Drive</div>
                    <div class="text-sm text-ios-muted">保存到應用程式專用資料夾</div>
                </div>
            </div>
        `;
        googleBackupBtn.onclick = async () => {
            createToast('正在上傳到 Google Drive...', 'info');
            try {
                await backupManager.uploadToGoogleDrive();
                createToast('已備份到 Google Drive', 'success');
                Router.navigate('/settings/backup');
            } catch (e) {
                createToast('備份失敗：' + e.message, 'error');
            }
        };
        googleCard.appendChild(googleBackupBtn);

        const googleRestoreBtn = createElement('button', 'ios-list-cell w-full text-left border-t');
        googleRestoreBtn.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <span class="material-symbols-outlined text-teal-600">cloud_download</span>
                </div>
                <div class="flex-1">
                    <div class="font-medium">從 Google Drive 還原</div>
                    <div class="text-sm text-ios-muted">下載並匯入雲端備份</div>
                </div>
            </div>
        `;
        googleRestoreBtn.onclick = async () => {
            if (!confirm('確定要從 Google Drive 還原嗎？現有資料將會合併。')) return;
            createToast('正在從 Google Drive 下載...', 'info');
            try {
                const result = await backupManager.downloadFromGoogleDrive();
                createToast(`還原完成，匯入了 ${result.report.imported.chats || 0} 個聊天室`, 'success');
                Router.navigate('/chats');
            } catch (e) {
                createToast('還原失敗：' + e.message, 'error');
            }
        };
        googleCard.appendChild(googleRestoreBtn);
    }

    googleSection.appendChild(googleCard);
    main.appendChild(googleSection);

    // 自動備份設定
    const autoSection = createElement('div', 'ios-grouped-list mx-4 mt-6');
    autoSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '自動備份設定' }));

    const autoCard = createElement('div', 'bg-white rounded-xl shadow-sm');

    const autoToggle = createElement('div', 'ios-list-cell flex items-center justify-between');
    autoToggle.appendChild(createElement('span', 'font-medium', { textContent: '啟用自動備份' }));
    
    const toggle = createElement('button', `relative w-12 h-7 rounded-full transition-colors ${status.autoBackup.enabled ? 'bg-green-500' : 'bg-gray-300'}`);
    const toggleKnob = createElement('div', 'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform');
    toggleKnob.style.transform = status.autoBackup.enabled ? 'translateX(24px)' : 'translateX(4px)';
    toggle.appendChild(toggleKnob);
    autoToggle.appendChild(toggle);
    autoCard.appendChild(autoToggle);

    toggle.onclick = async () => {
        if (status.autoBackup.enabled) {
            await backupManager.disableAutoBackup();
            createToast('已停用自動備份');
        } else {
            await backupManager.enableAutoBackup(24);
            createToast('已啟用自動備份（每 24 小時）');
        }
        Router.navigate('/settings/backup');
    };

    autoSection.appendChild(autoCard);
    main.appendChild(autoSection);

    // 一鍵完整備份按鈕
    const backupAllSection = createElement('div', 'mx-4 mt-6');
    const backupAllBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-4');
    backupAllBtn.innerHTML = '<span class="material-symbols-outlined mr-2">backup</span> 一鍵完整備份（本地 + GitHub + Google Drive）';
    backupAllBtn.onclick = async () => {
        createToast('正在執行完整備份...', 'info');
        
        const results = { local: false, github: false, google: false };
        
        try {
            await backupManager.downloadLocalBackup();
            results.local = true;
        } catch (e) {}

        if (githubUser) {
            try {
                await backupManager.pushToGitHub();
                results.github = true;
            } catch (e) {}
        }

        if (googleUser) {
            try {
                await backupManager.uploadToGoogleDrive();
                results.google = true;
            } catch (e) {}
        }

        const successCount = Object.values(results).filter(v => v).length;
        createToast(`備份完成：${successCount}/3 個位置成功`, successCount > 0 ? 'success' : 'error');
    };
    backupAllSection.appendChild(backupAllBtn);
    main.appendChild(backupAllSection);

    container.appendChild(main);

    return { element: container, cleanup: null };
}

// 顯示匯入對話框
function showImportDialog(container) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center');
    const dialog = createElement('div', 'bg-white rounded-xl p-6 mx-4 max-w-md w-full');

    dialog.innerHTML = `
        <h3 class="font-bold text-lg mb-4">從 JSON 檔案還原</h3>
        <p class="text-sm text-ios-muted mb-4">選擇之前下載的備份檔案，資料將會與現有資料合併。</p>
        <input type="file" accept=".json" class="w-full p-3 border rounded-lg mb-4" id="import-file-input">
        <div class="flex gap-2">
            <button class="ios-btn ios-btn-secondary flex-1" id="import-cancel">取消</button>
            <button class="ios-btn ios-btn-primary flex-1" id="import-confirm">還原</button>
        </div>
    `;

    overlay.appendChild(dialog);
    container.appendChild(overlay);

    dialog.querySelector('#import-cancel').onclick = () => overlay.remove();
    dialog.querySelector('#import-confirm').onclick = async () => {
        const input = dialog.querySelector('#import-file-input');
        const file = input.files[0];
        if (!file) {
            createToast('請選擇檔案', 'error');
            return;
        }

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            createToast('正在匯入資料...', 'info');
            
            const report = await backupManager.importAllData(data);
            
            createToast(`還原完成，共匯入 ${Object.values(report.imported).reduce((a, b) => a + b, 0)} 筆資料`, 'success');
            overlay.remove();
            Router.navigate('/chats');
        } catch (e) {
            createToast('匯入失敗：' + e.message, 'error');
        }
    };
}

// 顯示 GitHub 連接對話框
function showGitHubDialog(container) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center');
    const dialog = createElement('div', 'bg-white rounded-xl p-6 mx-4 max-w-md w-full');

    dialog.innerHTML = `
        <h3 class="font-bold text-lg mb-4">連接 GitHub</h3>
        <p class="text-sm text-ios-muted mb-4">需要 GitHub Personal Access Token，需有 repo 權限。</p>
        <input type="password" placeholder="ghp_xxxxxxxxxxxx" class="w-full p-3 border rounded-lg mb-4" id="github-token-input">
        <div class="flex gap-2">
            <button class="ios-btn ios-btn-secondary flex-1" id="github-cancel">取消</button>
            <button class="ios-btn ios-btn-primary flex-1" id="github-connect">連接</button>
        </div>
    `;

    overlay.appendChild(dialog);
    container.appendChild(overlay);

    dialog.querySelector('#github-cancel').onclick = () => overlay.remove();
    dialog.querySelector('#github-connect').onclick = async () => {
        const token = dialog.querySelector('#github-token-input').value.trim();
        if (!token) {
            createToast('請輸入 Token', 'error');
            return;
        }

        createToast('正在連接...', 'info');
        const result = await backupManager.connectGitHub(token);
        
        if (result.success) {
            createToast(`已連接：@${result.user.login}`, 'success');
            overlay.remove();
            Router.navigate('/settings/backup');
        } else {
            createToast('連接失敗：' + result.error, 'error');
        }
    };
}

// 顯示 Google Drive 連接對話框
function showGoogleDriveDialog(container) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center');
    const dialog = createElement('div', 'bg-white rounded-xl p-6 mx-4 max-w-md w-full');

    dialog.innerHTML = `
        <h3 class="font-bold text-lg mb-4">連接 Google Drive</h3>
        <p class="text-sm text-ios-muted mb-4">
            請先在 
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-500 underline">Google Cloud Console</a> 
            建立 OAuth 2.0 用戶端 ID，並輸入存取權杖。
        </p>
        <input type="password" placeholder="輸入 Google Access Token" class="w-full p-3 border rounded-lg mb-4" id="google-token-input">
        <div class="text-xs text-ios-muted mb-4">
            或點擊下方按鈕直接取得 Token
        </div>
        <button class="ios-btn ios-btn-secondary w-full mb-4" id="google-oauth-btn">
            使用 Google 帳戶登入
        </button>
        <div class="flex gap-2">
            <button class="ios-btn ios-btn-secondary flex-1" id="google-cancel">取消</button>
            <button class="ios-btn ios-btn-primary flex-1" id="google-connect">連接</button>
        </div>
    `;

    overlay.appendChild(dialog);
    container.appendChild(overlay);

    dialog.querySelector('#google-cancel').onclick = () => overlay.remove();
    
    dialog.querySelector('#google-oauth-btn').onclick = () => {
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.appdata');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
        window.location.href = authUrl;
    };

    dialog.querySelector('#google-connect').onclick = async () => {
        const token = dialog.querySelector('#google-token-input').value.trim();
        if (!token) {
            createToast('請輸入 Access Token', 'error');
            return;
        }

        createToast('正在連接...', 'info');
        const result = await backupManager.connectGoogleDrive(token);
        
        if (result.success) {
            createToast('已連接 Google Drive', 'success');
            overlay.remove();
            Router.navigate('/settings/backup');
        } else {
            createToast('連接失敗：' + result.error, 'error');
        }
    };
}

// 處理 Google OAuth 回調
async function handleGoogleOAuthCallback() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        
        if (accessToken) {
            const result = await backupManager.connectGoogleDrive(accessToken);
            if (result.success) {
                createToast('已連接 Google Drive', 'success');
            } else {
                createToast('連接失敗：' + result.error, 'error');
            }
        }
        
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

// 在頁面載入時檢查 OAuth 回調
if (typeof window !== 'undefined') {
    handleGoogleOAuthCallback();
}

export default {
    id: 'backup-settings',
    name: '資料備份與還原',
    routes: [
        { path: '/settings/backup', render: renderBackupSettings }
    ],
    stylesPath: 'js/apps/settings/style.css'
};