import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { MemoryDB, WikiRecordsDB, SettingsDB } from '../../db.js';

let memories = [];
let currentFilter = 0;
let searchTerm = '';

const TYPE_TABS = ['全部', '動態', '永久', '情感', '計畫', '書信', '自我', '備份'];
const TYPE_MAP = { 1: 'dynamic', 2: 'permanent', 3: 'feel', 4: 'plan', 5: 'letter', 6: 'i', 7: 'archive' };
const TYPE_LABELS = { dynamic: '動態', permanent: '永久', feel: '情感', plan: '計畫', letter: '書信', i: '自我', archive: '歸檔' };

const SOURCE_LABELS = {
    'chat': '對話',
    'youtube': 'YouTube',
    'instagram': 'Instagram',
    'chrome': 'Chrome',
    'dating': '約會',
    'bubbles': 'Bubbles',
    'weverse': 'Weverse',
    'bilibili': 'Bilibili',
    'twitch': 'Twitch',
    'twitter': 'Twitter',
    'ao3': 'AO3',
    'lofter': 'Lofter',
    'theater': '劇場'
};

function getSourceLabel(sourceApp) {
    return SOURCE_LABELS[sourceApp] || sourceApp || '未知';
}

function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    const date = new Date(timestamp);
    return (date.getMonth() + 1) + '/' + date.getDate();
}

function getDecayStage(memory) {
    const importance = memory.importance || 0.5;
    const decayFactor = memory.decayFactor || 1.0;
    const effective = importance * decayFactor;
    if (effective >= 0.7) return { label: '鮮明', dotClass: 'decay-dot-fresh', badgeClass: 'decay-badge-fresh' };
    if (effective >= 0.4) return { label: '模糊', dotClass: 'decay-dot-fading', badgeClass: 'decay-badge-fading' };
    if (effective >= 0.1) return { label: '衰退', dotClass: 'decay-dot-decaying', badgeClass: 'decay-badge-decaying' };
    return { label: '微弱', dotClass: 'decay-dot-weak', badgeClass: 'decay-badge-weak' };
}

function getFilteredMemories() {
    let filtered = [...memories];
    const typeFilter = TYPE_MAP[currentFilter];
    if (typeFilter) {
        filtered = filtered.filter(m => m.memory_type === typeFilter);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(m =>
            m.content.toLowerCase().includes(lower) ||
            (m.aiTags || []).some(t => t.toLowerCase().includes(lower)) ||
            (m.domain || '').includes(lower) ||
            (m.meaning || '').toLowerCase().includes(lower)
        );
    }
    return filtered.sort((a, b) => (b.timestamp || b.created_at) - (a.timestamp || a.created_at));
}

async function renderMemoryList() {
    const container = createElement('div', 'app-container memory-app bg-ios-bg');

    const header = createIOSNavBar({
        title: '記憶管理',
        largeTitle: false,
        backPath: '/home',
        rightActions: [{ icon: 'add', onClick: () => Router.navigate('/memory/new') }]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-16 pb-8');

    if (currentFilter === 7) {
        return await renderBackupPage(container, main);
    }

    const searchContainer = createElement('div', 'mx-4 mb-4');
    const searchBox = createElement('div', 'flex items-center bg-white rounded-lg px-4 py-3 shadow-sm');
    searchBox.appendChild(createIcon('search', 'text-ios-muted mr-3'));
    const searchInput = createElement('input', 'flex-1 bg-transparent outline-none text-sm', {
        type: 'text',
        placeholder: '搜尋記憶...',
        onInput: (e) => {
            searchTerm = e.target.value;
            renderList();
        }
    });
    searchBox.appendChild(searchInput);
    searchContainer.appendChild(searchBox);
    main.appendChild(searchContainer);

    const categoryGrid = createElement('div', 'grid grid-cols-4 gap-2 mx-4 mb-6');
    TYPE_TABS.forEach((tab, index) => {
        const card = createElement('div', 'flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all ' + 
            (currentFilter === index ? 'bg-claude-primary text-white shadow-md' : 'bg-white hover:shadow-md'), {
            onClick: () => {
                currentFilter = index;
                if (index === 7) {
                    Router.navigate('/memory');
                } else {
                    renderList();
                }
            }
        });
        const iconMap = ['inventory_2', 'auto_awesome', 'bookmark', 'favorite', 'event_note', 'mail', 'person', 'backup'];
        card.appendChild(createIcon(iconMap[index] || 'folder', 'text-2xl mb-1'));
        card.appendChild(createElement('span', 'text-xs font-medium', { textContent: tab }));
        categoryGrid.appendChild(card);
    });
    main.appendChild(categoryGrid);

    const listContainer = createElement('div', 'px-4');
    main.appendChild(listContainer);
    container.appendChild(main);

    async function renderList() {
        listContainer.innerHTML = '';
        memories = await MemoryDB.getAll();
        const filtered = getFilteredMemories();

        if (filtered.length === 0) {
            const emptyState = createElement('div', 'flex flex-col items-center justify-center py-16');
            emptyState.appendChild(createIcon('psychology', 'text-5xl mb-4 opacity-30'));
            emptyState.appendChild(createElement('h3', 'text-lg font-semibold mb-1', { textContent: '沒有記憶' }));
            emptyState.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '記憶將在對話中自動產生' }));
            listContainer.appendChild(emptyState);
            return;
        }

        filtered.forEach(memory => {
            const stage = getDecayStage(memory);
            const card = createElement('div', 'bg-white rounded-lg p-4 mb-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow', {
                onClick: () => Router.navigate('/memory/' + memory.id)
            });

            const headerRow = createElement('div', 'flex items-start justify-between mb-2');
            const content = createElement('p', 'text-sm leading-relaxed flex-1', { textContent: memory.content.slice(0, 120) });
            const badge = createElement('span', 'inline-block w-2 h-2 rounded-full ' + stage.dotClass + ' mt-1 ml-2 flex-shrink-0');
            headerRow.appendChild(content);
            headerRow.appendChild(badge);
            card.appendChild(headerRow);

            const metaRow = createElement('div', 'flex flex-wrap items-center gap-2 text-xs');
            metaRow.appendChild(createElement('span', 'text-ios-muted', { textContent: formatRelativeTime(memory.timestamp || memory.created_at) }));
            metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded ' + stage.badgeClass, { textContent: stage.label }));
            const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
            metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-gray-100', { textContent: typeLabel }));
            
            if (memory.source_app && memory.source_app !== 'chat') {
                metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-blue-50 text-blue-600', { textContent: getSourceLabel(memory.source_app) }));
            }
            if (memory.is_fiction) {
                metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-orange-50 text-orange-600', { textContent: '虛擬' }));
            }
            card.appendChild(metaRow);

            if (memory.aiTags && memory.aiTags.length > 0) {
                const tagsRow = createElement('div', 'flex flex-wrap gap-1 mt-2');
                memory.aiTags.slice(0, 3).forEach(tag => {
                    tagsRow.appendChild(createElement('span', 'text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-500', { textContent: tag }));
                });
                card.appendChild(tagsRow);
            }

            listContainer.appendChild(card);
        });
    }

    await renderList();
    return { element: container, cleanup: null };
}

async function renderBackupPage(container, main) {
    const memories = await MemoryDB.getAll();
    const wikiPages = await WikiRecordsDB.getAll();
    const githubUser = await SettingsDB.get('github_user');
    const googleUser = await SettingsDB.get('google_drive_user');
    const notionConfig = await SettingsDB.get('wiki_notion_config');
    
    const statsCard = createElement('div', 'bg-gradient-to-r from-claude-primary to-gray-700 rounded-lg mx-4 mb-4 p-4 text-white');
    statsCard.innerHTML = '<h2 class="font-bold mb-3">記憶統計</h2>' +
        '<div class="grid grid-cols-3 gap-2 text-center">' +
        '<div><div class="text-2xl font-bold">' + memories.length + '</div><div class="text-xs opacity-80">總記憶</div></div>' +
        '<div><div class="text-2xl font-bold">' + memories.filter(m => m.memory_type === 'permanent').length + '</div><div class="text-xs opacity-80">永久記憶</div></div>' +
        '<div><div class="text-2xl font-bold">' + wikiPages.length + '</div><div class="text-xs opacity-80">Wiki 頁面</div></div>' +
        '</div>';
    main.appendChild(statsCard);

    const connectionsSection = createElement('div', 'mx-4 mb-4');
    connectionsSection.appendChild(createElement('h3', 'text-sm font-semibold mb-2 text-ios-muted', { textContent: '連接狀態' }));
    
    const connectionsGrid = createElement('div', 'bg-white rounded-lg shadow-sm p-4');
    const connections = [
        { name: 'GitHub', connected: !!githubUser, user: githubUser?.login, icon: 'code', color: 'bg-gray-800' },
        { name: 'Google Drive', connected: !!googleUser, user: googleUser?.displayName, icon: 'cloud', color: 'bg-blue-500' },
        { name: 'Notion', connected: !!notionConfig?.token, user: notionConfig?.token ? '已連接' : '未連接', icon: 'article', color: 'bg-purple-500' }
    ];
    
    connections.forEach(conn => {
        const row = createElement('div', 'flex items-center justify-between py-2');
        const left = createElement('div', 'flex items-center gap-2');
        const icon = createElement('div', 'w-8 h-8 ' + conn.color + ' rounded-lg flex items-center justify-center');
        icon.appendChild(createIcon(conn.icon, 'text-white text-sm'));
        left.appendChild(icon);
        left.appendChild(createElement('span', 'text-sm font-medium', { textContent: conn.name }));
        row.appendChild(left);
        
        const status = createElement('span', 'text-xs ' + (conn.connected ? 'text-green-600' : 'text-gray-400'));
        status.textContent = conn.connected ? (conn.user || '已連接') : '未連接';
        row.appendChild(status);
        connectionsGrid.appendChild(row);
    });
    
    connectionsSection.appendChild(connectionsGrid);
    main.appendChild(connectionsSection);

    const exportSection = createElement('div', 'mx-4 mb-4');
    exportSection.appendChild(createElement('h3', 'text-sm font-semibold mb-2 text-ios-muted', { textContent: '匯出記憶' }));
    
    const exportCards = [
        { icon: 'download', iconBg: 'bg-blue-500', title: '下載 JSON 備份', desc: '將所有記憶匯出為 JSON 檔案', action: exportToJSON },
        { icon: 'description', iconBg: 'bg-green-500', title: '匯出到 Wiki', desc: '將永久記憶轉換為 Wiki 頁面', action: exportToWiki },
        { icon: 'article', iconBg: 'bg-purple-500', title: '匯出到 Notion', desc: notionConfig?.token ? '同步記憶到 Notion 資料庫' : '請先連接 Notion', action: notionConfig?.token ? exportToNotion : null },
        { icon: 'cloud_upload', iconBg: 'bg-orange-500', title: '上傳到 GitHub', desc: githubUser ? '備份記憶到 GitHub 私人倉庫' : '請先連接 GitHub', action: githubUser ? exportToGitHub : null },
        { icon: 'folder', iconBg: 'bg-red-500', title: '上傳到 Google Drive', desc: googleUser ? '備份記憶到 Google Drive' : '請先連接 Google Drive', action: googleUser ? exportToGoogleDrive : null }
    ];

    const exportGrid = createElement('div', 'bg-white rounded-lg shadow-sm');
    exportCards.forEach((card, index) => {
        const cell = createElement('div', 'ios-list-cell cursor-pointer' + (!card.action ? ' opacity-50' : ''), {
            onClick: card.action || (() => {
                createToast('請先在設定中連接此服務', 'error');
            })
        });
        const iconWrapper = createElement('div', 'w-10 h-10 ' + card.iconBg + ' rounded-lg flex items-center justify-center');
        iconWrapper.appendChild(createIcon(card.icon, 'text-white text-sm'));
        cell.appendChild(iconWrapper);
        const content = createElement('div', 'flex-1 min-w-0');
        content.appendChild(createElement('span', 'text-sm font-medium', { textContent: card.title }));
        content.appendChild(createElement('span', 'block text-xs text-ios-muted truncate', { textContent: card.desc }));
        cell.appendChild(content);
        cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
        exportGrid.appendChild(cell);
    });
    exportSection.appendChild(exportGrid);
    main.appendChild(exportSection);

    const importSection = createElement('div', 'mx-4 mb-4');
    importSection.appendChild(createElement('h3', 'text-sm font-semibold mb-2 text-ios-muted', { textContent: '匯入記憶' }));
    
    const importGrid = createElement('div', 'bg-white rounded-lg shadow-sm');
    
    const importJSONCell = createElement('div', 'ios-list-cell cursor-pointer', { onClick: importFromJSON });
    const importIcon = createElement('div', 'w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center');
    importIcon.appendChild(createIcon('upload', 'text-white text-sm'));
    importJSONCell.appendChild(importIcon);
    const importContent = createElement('div', 'flex-1 min-w-0');
    importContent.appendChild(createElement('span', 'text-sm font-medium', { textContent: '從 JSON 匯入' }));
    importContent.appendChild(createElement('span', 'block text-xs text-ios-muted truncate', { textContent: '從備份檔案還原記憶' }));
    importJSONCell.appendChild(importContent);
    importJSONCell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    importGrid.appendChild(importJSONCell);
    
    if (githubUser) {
        const importGitHubCell = createElement('div', 'ios-list-cell cursor-pointer', { onClick: importFromGitHub });
        const ghIcon = createElement('div', 'w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center');
        ghIcon.appendChild(createIcon('cloud_download', 'text-white text-sm'));
        importGitHubCell.appendChild(ghIcon);
        const ghContent = createElement('div', 'flex-1 min-w-0');
        ghContent.appendChild(createElement('span', 'text-sm font-medium', { textContent: '從 GitHub 還原' }));
        ghContent.appendChild(createElement('span', 'block text-xs text-ios-muted truncate', { textContent: '從 GitHub 倉庫下載備份' }));
        importGitHubCell.appendChild(ghContent);
        importGitHubCell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
        importGrid.appendChild(importGitHubCell);
    }
    
    if (googleUser) {
        const importGoogleCell = createElement('div', 'ios-list-cell cursor-pointer', { onClick: importFromGoogleDrive });
        const gIcon = createElement('div', 'w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center');
        gIcon.appendChild(createIcon('cloud_download', 'text-white text-sm'));
        importGoogleCell.appendChild(gIcon);
        const gContent = createElement('div', 'flex-1 min-w-0');
        gContent.appendChild(createElement('span', 'text-sm font-medium', { textContent: '從 Google Drive 還原' }));
        gContent.appendChild(createElement('span', 'block text-xs text-ios-muted truncate', { textContent: '從 Google Drive 下載備份' }));
        importGoogleCell.appendChild(gContent);
        importGoogleCell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
        importGrid.appendChild(importGoogleCell);
    }
    
    importSection.appendChild(importGrid);
    main.appendChild(importSection);

    const settingsBtn = createElement('button', 'mx-4 w-full bg-gray-100 text-gray-700 rounded-lg py-3 text-sm font-medium', {
        textContent: '管理連接設定',
        onClick: () => Router.navigate('/settings/backup')
    });
    main.appendChild(settingsBtn);

    container.appendChild(main);
    return { element: container, cleanup: null };
}

async function exportToJSON() {
    try {
        createToast('正在匯出記憶...', 'info');
        const memories = await MemoryDB.getAll();
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            source: 'siios-memory-export',
            memories: memories
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = createElement('a', '', { href: url, download: 'siios-memories-' + Date.now() + '.json' });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        createToast('已匯出 ' + memories.length + ' 則記憶', 'success');
    } catch (e) {
        createToast('匯出失敗：' + e.message, 'error');
    }
}

async function exportToWiki() {
    try {
        createToast('正在轉換記憶為 Wiki 頁面...', 'info');
        const memories = await MemoryDB.getAll();
        const permanentMemories = memories.filter(m => m.memory_type === 'permanent' || m.importance >= 0.7);
        
        let created = 0;
        for (const memory of permanentMemories) {
            const existingPages = await WikiRecordsDB.getByTitle(memory.content.slice(0, 50));
            if (existingPages.length > 0) continue;
            
            await WikiRecordsDB.create({
                title: memory.content.slice(0, 50),
                content: memory.content,
                page_type: memory.memory_type || 'memory',
                character_id: memory.character_id,
                keywords: memory.aiTags || [],
                importance: memory.importance || 0.5,
                metadata: {
                    source: 'memory_export',
                    memory_id: memory.id,
                    created_from_memory: true
                }
            });
            created++;
        }
        createToast('已建立 ' + created + ' 個 Wiki 頁面', 'success');
        Router.navigate('/wiki');
    } catch (e) {
        createToast('匯出失敗：' + e.message, 'error');
    }
}

async function exportToNotion() {
    const notionConfig = await SettingsDB.get('wiki_notion_config');
    if (!notionConfig || !notionConfig.token) {
        createToast('請先在 Wiki 設定中連接 Notion', 'error');
        return;
    }
    
    try {
        createToast('正在匯出到 Notion...', 'info');
        const memories = await MemoryDB.getAll();
        const importantMemories = memories.filter(m => m.memory_type === 'permanent' || m.importance >= 0.6);
        
        let exported = 0;
        for (const memory of importantMemories.slice(0, 10)) {
            try {
                const response = await fetch('https://api.notion.com/v1/pages', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + notionConfig.token,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify({
                        parent: { database_id: notionConfig.databaseId },
                        properties: {
                            'Name': {
                                title: [{ text: { content: memory.content.slice(0, 100) } }]
                            },
                            'Type': { select: { name: memory.memory_type || 'memory' } },
                            'Importance': { number: memory.importance || 0.5 }
                        }
                    })
                });
                if (response.ok) exported++;
            } catch (e) {}
        }
        createToast('已匯出 ' + exported + ' 則記憶到 Notion', 'success');
    } catch (e) {
        createToast('匯出失敗：' + e.message, 'error');
    }
}

async function exportToGitHub() {
    const githubToken = await SettingsDB.get('github_token');
    const githubUser = await SettingsDB.get('github_user');
    
    if (!githubToken || !githubUser) {
        createToast('請先在設定中連接 GitHub', 'error');
        Router.navigate('/settings/github');
        return;
    }
    
    try {
        createToast('正在上傳到 GitHub...', 'info');
        const memories = await MemoryDB.getAll();
        const content = JSON.stringify({ 
            version: '1.0',
            exportedAt: new Date().toISOString(),
            source: 'siios-memory-backup',
            memories 
        }, null, 2);
        const encoded = btoa(unescape(encodeURIComponent(content)));
        
        const repo = 'siios-backup';
        const path = 'memories/memories-' + Date.now() + '.json';
        
        const response = await fetch('https://api.github.com/repos/' + githubUser.login + '/' + repo + '/contents/' + path, {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + githubToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Backup memories at ' + new Date().toISOString(),
                content: encoded
            })
        });
        
        if (response.ok) {
            createToast('已上傳 ' + memories.length + ' 則記憶到 GitHub', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API 錯誤');
        }
    } catch (e) {
        createToast('上傳失敗：' + e.message, 'error');
    }
}

async function exportToGoogleDrive() {
    const googleToken = await SettingsDB.get('google_drive_token');
    
    if (!googleToken) {
        createToast('請先在設定中連接 Google Drive', 'error');
        Router.navigate('/settings/backup');
        return;
    }
    
    try {
        createToast('正在上傳到 Google Drive...', 'info');
        const memories = await MemoryDB.getAll();
        const content = JSON.stringify({ 
            version: '1.0',
            exportedAt: new Date().toISOString(),
            source: 'siios-memory-backup',
            memories 
        }, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify({
            name: 'siios-memories-' + Date.now() + '.json',
            mimeType: 'application/json',
            parents: ['appDataFolder']
        })], { type: 'application/json' }));
        formData.append('file', blob);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + googleToken },
            body: formData
        });
        
        if (response.ok) {
            createToast('已上傳 ' + memories.length + ' 則記憶到 Google Drive', 'success');
        } else {
            throw new Error('Google Drive API 錯誤');
        }
    } catch (e) {
        createToast('上傳失敗：' + e.message, 'error');
    }
}

async function importFromJSON() {
    const input = createElement('input', '', { type: 'file', accept: '.json' });
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.memories || !Array.isArray(data.memories)) {
                throw new Error('無效的記憶備份格式');
            }
            
            createToast('正在匯入記憶...', 'info');
            let imported = 0;
            
            for (const memory of data.memories) {
                try {
                    await MemoryDB.create(memory);
                    imported++;
                } catch (e) {}
            }
            
            createToast('已匯入 ' + imported + ' 則記憶', 'success');
            Router.navigate('/memory');
        } catch (e) {
            createToast('匯入失敗：' + e.message, 'error');
        }
    };
    input.click();
}

async function importFromGitHub() {
    const githubToken = await SettingsDB.get('github_token');
    const githubUser = await SettingsDB.get('github_user');
    
    if (!githubToken || !githubUser) {
        createToast('請先連接 GitHub', 'error');
        return;
    }
    
    try {
        createToast('正在從 GitHub 下載...', 'info');
        
        const response = await fetch(
            'https://api.github.com/repos/' + githubUser.login + '/siios-backup/contents/memories',
            { headers: { 'Authorization': 'token ' + githubToken } }
        );
        
        if (!response.ok) throw new Error('無法取得檔案列表');
        
        const files = await response.json();
        if (!files || files.length === 0) throw new Error('沒有找到備份檔案');
        
        const latestFile = files.sort((a, b) => b.name.localeCompare(a.name))[0];
        const fileRes = await fetch(latestFile.url, { headers: { 'Authorization': 'token ' + githubToken } });
        const fileData = await fileRes.json();
        
        const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
        
        if (!content.memories) throw new Error('無效的備份格式');
        
        let imported = 0;
        for (const memory of content.memories) {
            try {
                await MemoryDB.create(memory);
                imported++;
            } catch (e) {}
        }
        
        createToast('已從 GitHub 匯入 ' + imported + ' 則記憶', 'success');
        Router.navigate('/memory');
    } catch (e) {
        createToast('匯入失敗：' + e.message, 'error');
    }
}

async function importFromGoogleDrive() {
    const googleToken = await SettingsDB.get('google_drive_token');
    
    if (!googleToken) {
        createToast('請先連接 Google Drive', 'error');
        return;
    }
    
    try {
        createToast('正在從 Google Drive 下載...', 'info');
        
        const listRes = await fetch(
            "https://www.googleapis.com/drive/v3/files?q=name contains 'siios-memories' and trashed=false&orderBy=createdTime desc&pageSize=1",
            { headers: { 'Authorization': 'Bearer ' + googleToken } }
        );
        
        if (!listRes.ok) throw new Error('無法取得檔案列表');
        
        const listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) throw new Error('沒有找到備份檔案');
        
        const fileId = listData.files[0].id;
        const fileRes = await fetch(
            'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
            { headers: { 'Authorization': 'Bearer ' + googleToken } }
        );
        
        const content = await fileRes.json();
        
        if (!content.memories) throw new Error('無效的備份格式');
        
        let imported = 0;
        for (const memory of content.memories) {
            try {
                await MemoryDB.create(memory);
                imported++;
            } catch (e) {}
        }
        
        createToast('已從 Google Drive 匯入 ' + imported + ' 則記憶', 'success');
        Router.navigate('/memory');
    } catch (e) {
        createToast('匯入失敗：' + e.message, 'error');
    }
}

async function renderMemoryDetail(params) {
    const { id } = params;
    const memory = await MemoryDB.access(id);
    if (!memory) {
        createToast('記憶不存在');
        Router.navigate('/memory');
        return { element: createElement('div'), cleanup: null };
    }

    const container = createElement('div', 'app-container memory-app bg-ios-bg');
    const header = createIOSNavBar({ title: '記憶詳情', backPath: '/memory' });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-16 pb-8');

    const contentCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
    contentCard.appendChild(createElement('p', 'text-base leading-relaxed', { textContent: memory.content }));
    main.appendChild(contentCard);

    const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
    const stage = getDecayStage(memory);
    
    const categoryCards = [
        { icon: 'category', iconBg: 'bg-claude-primary', title: '類型', value: typeLabel },
        { icon: 'place', iconBg: 'bg-blue-500', title: '領域', value: memory.domain || '—' },
        { icon: 'lightbulb', iconBg: 'bg-yellow-500', title: '意義', value: memory.meaning || '—' },
        { icon: 'schedule', iconBg: 'bg-purple-500', title: '衰變', value: stage.label }
    ];

    const categoryGrid = createElement('div', 'grid grid-cols-2 gap-3 mx-4 mb-4');
    categoryCards.forEach(cat => {
        const card = createElement('div', 'bg-white rounded-lg p-3 shadow-sm');
        const iconWrapper = createElement('div', 'w-8 h-8 ' + cat.iconBg + ' rounded-lg flex items-center justify-center mb-2');
        iconWrapper.appendChild(createIcon(cat.icon, 'text-white text-sm'));
        card.appendChild(iconWrapper);
        card.appendChild(createElement('p', 'text-xs text-ios-muted mb-1', { textContent: cat.title }));
        card.appendChild(createElement('p', 'text-sm font-medium', { textContent: cat.value }));
        categoryGrid.appendChild(card);
    });
    main.appendChild(categoryGrid);

    const actionsCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
    const actionsGrid = createElement('div', 'grid grid-cols-2 gap-2');
    
    const reinforceBtn = createElement('button', 'bg-claude-primary text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '強化記憶',
        onClick: async () => {
            await MemoryDB.reinforce(id);
            createToast('記憶已強化');
            Router.navigate('/memory/' + id);
        }
    });
    actionsGrid.appendChild(reinforceBtn);
    
    const permanentBtn = createElement('button', 'bg-claude-success text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '標為永久',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'permanent', decayFactor: 5.0 });
            createToast('已標為永久記憶');
            Router.navigate('/memory/' + id);
        }
    });
    actionsGrid.appendChild(permanentBtn);
    actionsCard.appendChild(actionsGrid);

    const actionsGrid2 = createElement('div', 'grid grid-cols-2 gap-2 mt-2');
    
    const archiveBtn = createElement('button', 'bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium', {
        textContent: '歸檔',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'archive' });
            createToast('記憶已歸檔');
            Router.navigate('/memory');
        }
    });
    actionsGrid2.appendChild(archiveBtn);
    
    const deleteBtn = createElement('button', 'bg-claude-danger text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '刪除',
        onClick: () => {
            if (confirm('確定要刪除此記憶？此操作無法復原。')) {
                MemoryDB.delete(id);
                createToast('記憶已刪除');
                Router.navigate('/memory');
            }
        }
    });
    actionsGrid2.appendChild(deleteBtn);
    actionsCard.appendChild(actionsGrid2);
    main.appendChild(actionsCard);

    container.appendChild(main);
    return { element: container, cleanup: null };
}

export default {
    id: 'memory',
    name: '記憶管理',
    icon: 'psychology',
    routes: [
        { path: '/memory', render: renderMemoryList },
        { path: '/memory/:id', render: renderMemoryDetail }
    ],
    navItem: {
        label: 'Memory',
        icon: 'psychology',
        path: '/memory',
        showInNav: true,
        order: 4
    },
    stylesPath: 'js/apps/memory/style.css'
};
