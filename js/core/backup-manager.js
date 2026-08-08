/**
 * SXIOS 備份管理器
 * 支援：本地 JSON、GitHub、Google Drive 三重備份
 */

import {
    initDB, ChatsDB, MessagesDB, CharactersDB, UsersDB, SettingsDB,
    GlobalSettingsDB, GlobalForbiddenDB, TheaterSettingsDB, KeywordSettingsDB,
    MemoryDB, WikiRecordsDB, HealthDB, MCPConfigDB, ActivityDB
} from '../db.js';

const BACKUP_VERSION = 1;
const GITHUB_REPO_NAME = 'siios-backup';
const BACKUP_FILENAME = 'siios-backup.json';

class BackupManager {
    constructor() {
        this.githubToken = null;
        this.githubUser = null;
        this.googleAccessToken = null;
        this.googleUser = null;
        this.lastBackupTime = null;
    }

    // ==================== 完整資料匯出 ====================

    async exportAllData() {
        const data = {
            version: BACKUP_VERSION,
            timestamp: Date.now(),
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0',
            data: {}
        };

        // 匯出所有資料庫
        data.data.chats = await ChatsDB.getAll();
        data.data.characters = await CharactersDB.getAll();
        data.data.users = await UsersDB.getAll();
        data.data.messages = [];
        data.data.memories = await MemoryDB.getAll();
        data.data.globalSettings = await GlobalSettingsDB.getAll();
        data.data.globalForbidden = await GlobalForbiddenDB.getAll();
        data.data.theaterSettings = await TheaterSettingsDB.getAll();
        data.data.keywordSettings = await KeywordSettingsDB.getAll();
        data.data.wikiRecords = await WikiRecordsDB.getAll();
        data.data.health = await this.getAllHealthRecords();
        data.data.mcpConfigs = await MCPConfigDB.getAll();
        data.data.activities = await ActivityDB.getAll(1000);
        data.data.settings = await this.getAllSettings();

        // 匯出所有聊天訊息
        for (const chat of data.data.chats) {
            const messages = await MessagesDB.getByChatId(chat.id);
            data.data.messages.push(...messages);
        }

        return data;
    }

    async getAllSettings() {
        const all = await SettingsDB.getAll();
        const settings = {};
        for (const [key, value] of Object.entries(all)) {
            settings[key] = value;
        }
        return settings;
    }

    async getAllHealthRecords() {
        const database = await initDB();
        return database.getAll('health');
    }

    // ==================== 完整資料匯入 ====================

    async importAllData(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('無效的備份資料格式');
        }

        const database = await initDB();
        const report = {
            success: true,
            imported: {},
            errors: [],
            timestamp: Date.now()
        };

        try {
            // 清空現有資料（可選，根據使用者選擇）
            // 預設不清空，採用合併策略

            // 匯入設定
            if (backupData.data.settings) {
                for (const [key, value] of Object.entries(backupData.data.settings)) {
                    try {
                        await SettingsDB.set(key, value);
                        report.imported.settings = (report.imported.settings || 0) + 1;
                    } catch (e) {
                        report.errors.push(`設定 ${key} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入角色
            if (backupData.data.characters) {
                for (const char of backupData.data.characters) {
                    try {
                        const existing = await CharactersDB.getById(char.id);
                        if (!existing) {
                            await database.put('characters', char);
                        } else {
                            // 合併更新
                            const merged = { ...existing, ...char, updated_at: Date.now() };
                            await database.put('characters', merged);
                        }
                        report.imported.characters = (report.imported.characters || 0) + 1;
                    } catch (e) {
                        report.errors.push(`角色 ${char.name || char.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入用戶
            if (backupData.data.users) {
                for (const user of backupData.data.users) {
                    try {
                        const existing = await UsersDB.getById(user.id);
                        if (!existing) {
                            await database.put('users', user);
                        } else {
                            const merged = { ...existing, ...user };
                            await database.put('users', merged);
                        }
                        report.imported.users = (report.imported.users || 0) + 1;
                    } catch (e) {
                        report.errors.push(`用戶 ${user.name || user.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入聊天室
            if (backupData.data.chats) {
                for (const chat of backupData.data.chats) {
                    try {
                        const existing = await ChatsDB.getById(chat.id);
                        if (!existing) {
                            await database.put('chats', chat);
                        } else {
                            const merged = { ...existing, ...chat, last_updated: Date.now() };
                            await database.put('chats', merged);
                        }
                        report.imported.chats = (report.imported.chats || 0) + 1;
                    } catch (e) {
                        report.errors.push(`聊天室 ${chat.character_name || chat.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入訊息
            if (backupData.data.messages) {
                const tx = database.transaction('messages', 'readwrite');
                for (const msg of backupData.data.messages) {
                    try {
                        await tx.store.put(msg);
                        report.imported.messages = (report.imported.messages || 0) + 1;
                    } catch (e) {
                        report.errors.push(`訊息 ${msg.id} 匯入失敗: ${e.message}`);
                    }
                }
                await tx.done;
            }

            // 匯入記憶
            if (backupData.data.memories) {
                for (const memory of backupData.data.memories) {
                    try {
                        await database.put('memories', memory);
                        report.imported.memories = (report.imported.memories || 0) + 1;
                    } catch (e) {
                        report.errors.push(`記憶 ${memory.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入全域設定
            if (backupData.data.globalSettings) {
                for (const setting of backupData.data.globalSettings) {
                    try {
                        await database.put('globalSettings', setting);
                        report.imported.globalSettings = (report.imported.globalSettings || 0) + 1;
                    } catch (e) {
                        report.errors.push(`全域設定 ${setting.name || setting.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入禁忌詞
            if (backupData.data.globalForbidden) {
                for (const forbidden of backupData.data.globalForbidden) {
                    try {
                        await database.put('globalForbidden', forbidden);
                        report.imported.globalForbidden = (report.imported.globalForbidden || 0) + 1;
                    } catch (e) {
                        report.errors.push(`禁忌詞 ${forbidden.name || forbidden.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入劇場設定
            if (backupData.data.theaterSettings) {
                for (const theater of backupData.data.theaterSettings) {
                    try {
                        await database.put('theaterSettings', theater);
                        report.imported.theaterSettings = (report.imported.theaterSettings || 0) + 1;
                    } catch (e) {
                        report.errors.push(`劇場設定 ${theater.name || theater.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入關鍵字設定
            if (backupData.data.keywordSettings) {
                for (const keyword of backupData.data.keywordSettings) {
                    try {
                        await database.put('keywordSettings', keyword);
                        report.imported.keywordSettings = (report.imported.keywordSettings || 0) + 1;
                    } catch (e) {
                        report.errors.push(`關鍵字設定 ${keyword.name || keyword.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入健康記錄
            if (backupData.data.health) {
                for (const health of backupData.data.health) {
                    try {
                        await database.put('health', health);
                        report.imported.health = (report.imported.health || 0) + 1;
                    } catch (e) {
                        report.errors.push(`健康記錄 ${health.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入 MCP 設定
            if (backupData.data.mcpConfigs) {
                for (const mcp of backupData.data.mcpConfigs) {
                    try {
                        await database.put('mcpConfigs', mcp);
                        report.imported.mcpConfigs = (report.imported.mcpConfigs || 0) + 1;
                    } catch (e) {
                        report.errors.push(`MCP 設定 ${mcp.name || mcp.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入活動記錄
            if (backupData.data.activities) {
                for (const activity of backupData.data.activities) {
                    try {
                        await database.put('activities', activity);
                        report.imported.activities = (report.imported.activities || 0) + 1;
                    } catch (e) {
                        report.errors.push(`活動記錄 ${activity.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

            // 匯入 Wiki 記錄
            if (backupData.data.wikiRecords) {
                for (const wiki of backupData.data.wikiRecords) {
                    try {
                        await database.put('wikiRecords', wiki);
                        report.imported.wikiRecords = (report.imported.wikiRecords || 0) + 1;
                    } catch (e) {
                        report.errors.push(`Wiki 記錄 ${wiki.title || wiki.id} 匯入失敗: ${e.message}`);
                    }
                }
            }

        } catch (e) {
            report.success = false;
            report.errors.push(`匯入過程發生錯誤: ${e.message}`);
        }

        // 記錄最後還原時間
        await SettingsDB.set('last_restore_time', Date.now());
        await SettingsDB.set('last_restore_report', report);

        return report;
    }

    // ==================== 本地 JSON 下載 ====================

    async downloadLocalBackup() {
        const data = await this.exportAllData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `siios-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        await SettingsDB.set('last_local_backup_time', Date.now());
        return { success: true, filename: a.download };
    }

    // ==================== GitHub 備份 ====================

    async connectGitHub(token) {
        try {
            // 驗證 Token
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });

            if (!userRes.ok) {
                throw new Error('Token 無效或已過期');
            }

            const userData = await userRes.json();

            // 儲存 Token
            this.githubToken = token;
            this.githubUser = {
                login: userData.login,
                name: userData.name || userData.login,
                avatar_url: userData.avatar_url
            };

            await SettingsDB.set('github_token', token);
            await SettingsDB.set('github_user', this.githubUser);

            // 確保備份倉庫存在
            await this.ensureGitHubRepo();

            return { success: true, user: this.githubUser };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async ensureGitHubRepo() {
        if (!this.githubToken) {
            throw new Error('請先連接 GitHub');
        }

        // 檢查倉庫是否存在
        const checkRes = await fetch(`https://api.github.com/repos/${this.githubUser.login}/${GITHUB_REPO_NAME}`, {
            headers: { 'Authorization': `token ${this.githubToken}` }
        });

        if (checkRes.ok) {
            return { exists: true };
        }

        // 建立倉庫
        const createRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: GITHUB_REPO_NAME,
                private: true,
                description: 'SXIOS 資料備份倉庫 - 請勿手動修改',
                auto_init: true
            })
        });

        if (createRes.ok) {
            return { created: true };
        } else if (createRes.status === 422) {
            return { exists: true };
        } else {
            const error = await createRes.json();
            throw new Error(error.message || '建立倉庫失敗');
        }
    }

    async pushToGitHub() {
        if (!this.githubToken || !this.githubUser) {
            // 嘗試從設定載入
            this.githubToken = await SettingsDB.get('github_token');
            this.githubUser = await SettingsDB.get('github_user');
        }

        if (!this.githubToken) {
            throw new Error('請先連接 GitHub');
        }

        const data = await this.exportAllData();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

        // 取得現有檔案的 SHA（如果存在）
        let sha = null;
        const getFileRes = await fetch(
            `https://api.github.com/repos/${this.githubUser.login}/${GITHUB_REPO_NAME}/contents/${BACKUP_FILENAME}`,
            { headers: { 'Authorization': `token ${this.githubToken}` } }
        );

        if (getFileRes.ok) {
            const fileData = await getFileRes.json();
            sha = fileData.sha;
        }

        // 上傳檔案
        const uploadRes = await fetch(
            `https://api.github.com/repos/${this.githubUser.login}/${GITHUB_REPO_NAME}/contents/${BACKUP_FILENAME}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `備份更新 - ${new Date().toLocaleString('zh-TW')}`,
                    content: content,
                    sha: sha
                })
            }
        );

        if (!uploadRes.ok) {
            const error = await uploadRes.json();
            throw new Error(error.message || '上傳失敗');
        }

        await SettingsDB.set('last_github_backup_time', Date.now());
        this.lastBackupTime = Date.now();

        return {
            success: true,
            commit: await uploadRes.json(),
            timestamp: Date.now()
        };
    }

    async pullFromGitHub() {
        if (!this.githubToken || !this.githubUser) {
            this.githubToken = await SettingsDB.get('github_token');
            this.githubUser = await SettingsDB.get('github_user');
        }

        if (!this.githubToken) {
            throw new Error('請先連接 GitHub');
        }

        const fileRes = await fetch(
            `https://api.github.com/repos/${this.githubUser.login}/${GITHUB_REPO_NAME}/contents/${BACKUP_FILENAME}`,
            { headers: { 'Authorization': `token ${this.githubToken}` } }
        );

        if (!fileRes.ok) {
            throw new Error('找不到備份檔案');
        }

        const fileData = await fileRes.json();
        const content = decodeURIComponent(escape(atob(fileData.content)));
        const backupData = JSON.parse(content);

        // 匯入資料
        const report = await this.importAllData(backupData);

        return {
            success: report.success,
            report,
            backupDate: backupData.exportDate
        };
    }

    async getGitHubBackupInfo() {
        if (!this.githubToken || !this.githubUser) {
            this.githubToken = await SettingsDB.get('github_token');
            this.githubUser = await SettingsDB.get('github_user');
        }

        if (!this.githubToken) {
            return { connected: false };
        }

        try {
            const fileRes = await fetch(
                `https://api.github.com/repos/${this.githubUser.login}/${GITHUB_REPO_NAME}/contents/${BACKUP_FILENAME}`,
                { headers: { 'Authorization': `token ${this.githubToken}` } }
            );

            if (!fileRes.ok) {
                return { connected: true, hasBackup: false };
            }

            const fileData = await fileRes.json();
            return {
                connected: true,
                hasBackup: true,
                sha: fileData.sha,
                size: fileData.size,
                lastModified: fileData.content ? 
                    JSON.parse(decodeURIComponent(escape(atob(fileData.content)))).exportDate : 
                    null
            };
        } catch (e) {
            return { connected: true, error: e.message };
        }
    }

    // ==================== Google Drive 備份 ====================

    async connectGoogleDrive(accessToken) {
        try {
            // 驗證 Token
            const userRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!userRes.ok) {
                throw new Error('Google Drive Token 無效');
            }

            const userData = await userRes.json();

            this.googleAccessToken = accessToken;
            this.googleUser = userData.user;

            await SettingsDB.set('google_drive_token', accessToken);
            await SettingsDB.set('google_drive_user', this.googleUser);

            return { success: true, user: this.googleUser };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async uploadToGoogleDrive() {
        if (!this.googleAccessToken) {
            this.googleAccessToken = await SettingsDB.get('google_drive_token');
        }

        if (!this.googleAccessToken) {
            throw new Error('請先連接 Google Drive');
        }

        const data = await this.exportAllData();
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });

        // 檢查是否已存在備份檔案
        const listRes = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=' + 
            encodeURIComponent("name='siios-backup.json' and trashed=false"),
            {
                headers: { 'Authorization': `Bearer ${this.googleAccessToken}` }
            }
        );

        let fileId = null;
        if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.files && listData.files.length > 0) {
                fileId = listData.files[0].id;
            }
        }

        // 上傳檔案
        const formData = new FormData();
        const metadata = {
            name: 'siios-backup.json',
            mimeType: 'application/json',
            parents: ['appDataFolder'] // 使用應用程式專用資料夾
        };

        if (fileId) {
            // 更新現有檔案
            const updateRes = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.googleAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: content
                }
            );

            if (!updateRes.ok) {
                throw new Error('更新 Google Drive 檔案失敗');
            }

            await SettingsDB.set('last_google_drive_backup_time', Date.now());
            return { success: true, fileId, updated: true };
        } else {
            // 建立新檔案
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', blob);

            const createRes = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.googleAccessToken}` },
                    body: formData
                }
            );

            if (!createRes.ok) {
                throw new Error('上傳到 Google Drive 失敗');
            }

            const result = await createRes.json();
            await SettingsDB.set('last_google_drive_backup_time', Date.now());
            return { success: true, fileId: result.id, created: true };
        }
    }

    async downloadFromGoogleDrive() {
        if (!this.googleAccessToken) {
            this.googleAccessToken = await SettingsDB.get('google_drive_token');
        }

        if (!this.googleAccessToken) {
            throw new Error('請先連接 Google Drive');
        }

        // 取得檔案列表
        const listRes = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=' + 
            encodeURIComponent("name='siios-backup.json' and trashed=false"),
            {
                headers: { 'Authorization': `Bearer ${this.googleAccessToken}` }
            }
        );

        if (!listRes.ok) {
            throw new Error('無法取得 Google Drive 檔案列表');
        }

        const listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) {
            throw new Error('找不到備份檔案');
        }

        const fileId = listData.files[0].id;

        // 下載檔案內容
        const fileRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: { 'Authorization': `Bearer ${this.googleAccessToken}` }
            }
        );

        if (!fileRes.ok) {
            throw new Error('下載備份檔案失敗');
        }

        const content = await fileRes.text();
        const backupData = JSON.parse(content);

        // 匯入資料
        const report = await this.importAllData(backupData);

        return {
            success: report.success,
            report,
            backupDate: backupData.exportDate
        };
    }

    async getGoogleDriveBackupInfo() {
        if (!this.googleAccessToken) {
            this.googleAccessToken = await SettingsDB.get('google_drive_token');
        }

        if (!this.googleAccessToken) {
            return { connected: false };
        }

        try {
            const listRes = await fetch(
'https://www.googleapis.com/drive/v3/files?q=' + 
            encodeURIComponent("name='siios-backup.json' and trashed=false") + 
            '&fields=files(id,name,size,modifiedTime)',
                {
                    headers: { 'Authorization': `Bearer ${this.googleAccessToken}` }
                }
            );

            if (!listRes.ok) {
                return { connected: true, hasBackup: false };
            }

            const listData = await listRes.json();
            if (!listData.files || listData.files.length === 0) {
                return { connected: true, hasBackup: false };
            }

            const file = listData.files[0];
            return {
                connected: true,
                hasBackup: true,
                fileId: file.id,
                size: file.size,
                lastModified: file.modifiedTime
            };
        } catch (e) {
            return { connected: true, error: e.message };
        }
    }

    // ==================== 自動備份 ====================

    async enableAutoBackup(intervalHours = 24) {
        await SettingsDB.set('auto_backup_enabled', true);
        await SettingsDB.set('auto_backup_interval', intervalHours);

        // 使用 Service Worker 或定時器實現自動備份
        if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.periodicSync.register('auto-backup', {
                    minInterval: intervalHours * 60 * 60 * 1000
                });
            } catch (e) {
                console.warn('Periodic Sync 不支援，使用 localStorage 作為備用');
            }
        }

        return { success: true, interval: intervalHours };
    }

    async disableAutoBackup() {
        await SettingsDB.set('auto_backup_enabled', false);

        if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.periodicSync.unregister('auto-backup');
            } catch (e) {}
        }

        return { success: true };
    }

    async checkAndAutoBackup() {
        const enabled = await SettingsDB.get('auto_backup_enabled');
        if (!enabled) return { skipped: true };

        const lastBackup = await SettingsDB.get('last_backup_time') || 0;
        const interval = await SettingsDB.get('auto_backup_interval') || 24;
        const now = Date.now();

        if (now - lastBackup > interval * 60 * 60 * 1000) {
            // 執行備份
            try {
                // 優先順序：本地 > GitHub > Google Drive
                await this.downloadLocalBackup();

                const githubConnected = await SettingsDB.get('github_token');
                if (githubConnected) {
                    await this.pushToGitHub();
                }

                const googleConnected = await SettingsDB.get('google_drive_token');
                if (googleConnected) {
                    await this.uploadToGoogleDrive();
                }

                await SettingsDB.set('last_backup_time', now);
                return { success: true, timestamp: now };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        return { skipped: true, reason: 'Not yet time' };
    }

    // ==================== 工具方法 ====================

    async getBackupStatus() {
        const status = {
            local: {
                lastBackup: await SettingsDB.get('last_local_backup_time')
            },
            github: await this.getGitHubBackupInfo(),
            googleDrive: await this.getGoogleDriveBackupInfo(),
            autoBackup: {
                enabled: await SettingsDB.get('auto_backup_enabled') || false,
                interval: await SettingsDB.get('auto_backup_interval') || 24,
                lastBackup: await SettingsDB.get('last_backup_time')
            }
        };

        return status;
    }

    async disconnectGitHub() {
        await SettingsDB.set('github_token', null);
        await SettingsDB.set('github_user', null);
        this.githubToken = null;
        this.githubUser = null;
        return { success: true };
    }

    async disconnectGoogleDrive() {
        await SettingsDB.set('google_drive_token', null);
        await SettingsDB.set('google_drive_user', null);
        this.googleAccessToken = null;
        this.googleUser = null;
        return { success: true };
    }
}

const backupManager = new BackupManager();

export { BackupManager, backupManager };
