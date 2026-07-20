import Router from '../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../components.js';
import { SettingsDB } from '../db.js';

async function render() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: '設定',
        largeTitle: true
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');
    
    const profileSection = createElement('div', 'ios-grouped-list mx-4');
    const profileCard = createElement('div', 'flex items-center p-4 bg-white rounded-xl shadow-sm');
    
    const avatar = createElement('div', 'w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center');
    avatar.appendChild(createIcon('account_circle', 'text-white text-3xl'));
    profileCard.appendChild(avatar);
    
    const profileInfo = createElement('div', 'flex-1 ml-4');
    profileInfo.appendChild(createElement('h2', 'font-semibold', { textContent: '使用者' }));
    profileInfo.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '管理您的設定與同步' }));
    profileCard.appendChild(profileInfo);
    
    profileCard.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    profileSection.appendChild(profileCard);
    
    main.appendChild(profileSection);
    
    const accountSection = createElement('div', 'mt-8 ml-8');
    accountSection.appendChild(createElement('p', 'ios-section-header', { textContent: '帳號與同步' }));
    
    const accountGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const syncCell = createListCell('cloud_sync', 'Lore Cloud Sync', '開啟', 'ios-blue', true);
    accountGroup.appendChild(syncCell);
    
    const backupCell = createListCell('backup', '匯出備份', null, 'gray-500');
    backupCell.onclick = async () => {
        await exportBackup();
    };
    accountGroup.appendChild(backupCell);
    
    main.appendChild(accountSection);
    main.appendChild(accountGroup);
    
    const appSection = createElement('div', 'mt-8 ml-8');
    appSection.appendChild(createElement('p', 'ios-section-header', { textContent: '應用程式設定' }));
    
    const appGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const appearanceCell = createListCell('palette', '外觀', '淺色', 'indigo-500', true);
    appGroup.appendChild(appearanceCell);
    
    const notificationsCell = createListCell('notifications', '通知', null, 'red-500', true);
    appGroup.appendChild(notificationsCell);
    
    const languageCell = createListCell('language', '語言', '繁體中文', 'green-500', true);
    appGroup.appendChild(languageCell);
    
    main.appendChild(appSection);
    main.appendChild(appGroup);
    
    const aiSection = createElement('div', 'mt-8 ml-8');
    aiSection.appendChild(createElement('p', 'ios-section-header', { textContent: '智慧功能' }));
    
    const aiGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const apiCell = createListCell('smart_toy', 'API 設定', null, 'kakao-brown', true);
    apiCell.onclick = () => Router.navigate('/api-config');
    aiGroup.appendChild(apiCell);
    
    main.appendChild(aiSection);
    main.appendChild(aiGroup);
    
    const aboutSection = createElement('div', 'mt-8 ml-8');
    aboutSection.appendChild(createElement('p', 'ios-section-header', { textContent: '關於' }));
    
    const aboutGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const versionCell = createListCell(null, '版本', '1.0.0');
    aboutGroup.appendChild(versionCell);
    
    const termsCell = createListCell(null, '使用條款', null, null, true);
    aboutGroup.appendChild(termsCell);
    
    const githubCell = createListCell(null, 'GitHub 儲存庫', null, null, true);
    githubCell.querySelector('.flex-1').appendChild(createIcon('open_in_new', 'text-ios-blue ml-2'));
    aboutGroup.appendChild(githubCell);
    
    main.appendChild(aboutSection);
    main.appendChild(aboutGroup);
    
    const footer = createElement('div', 'text-center py-6 text-sm text-ios-muted');
    footer.appendChild(createElement('p', '', { textContent: '© 2024 iOS Classic AI' }));
    footer.appendChild(createElement('p', '', { textContent: 'Designed for mobile experience' }));
    main.appendChild(footer);
    
    container.appendChild(main);
    
    const nav = createElement('div', 'ios-bottom-nav safe-area-bottom');
    
    const chatsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/chats',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/chats');
        }
    });
    chatsTab.appendChild(createIcon('chat_bubble'));
    chatsTab.appendChild(createElement('span', 'label', { textContent: 'Chats' }));
    nav.appendChild(chatsTab);
    
    const worldInfoTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/world-info',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/world-info');
        }
    });
    worldInfoTab.appendChild(createIcon('menu_book'));
    worldInfoTab.appendChild(createElement('span', 'label', { textContent: 'World Info' }));
    nav.appendChild(worldInfoTab);
    
    const settingsTab = createElement('a', 'ios-bottom-nav-item active');
    settingsTab.appendChild(createIcon('settings', '', true));
    settingsTab.appendChild(createElement('span', 'label', { textContent: 'Settings' }));
    nav.appendChild(settingsTab);
    
    container.appendChild(nav);
    
    return { element: container, cleanup: null };
}

function createListCell(icon, label, value, iconBg, chevron) {
    const cell = createElement('div', 'ios-list-cell');
    
    if (icon) {
        const badge = createElement('div', `ios-icon-badge bg-${iconBg}`);
        badge.appendChild(createIcon(icon, 'text-white text-sm'));
        cell.appendChild(badge);
    }
    
    cell.appendChild(createElement('span', 'flex-1', { textContent: label }));
    
    if (value) {
        cell.appendChild(createElement('span', 'text-ios-muted', { textContent: value }));
    }
    
    if (chevron) {
        cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    }
    
    return cell;
}

async function exportBackup() {
    try {
        const { ChatsDB, MessagesDB, WorldInfoDB, CharactersDB, SettingsDB } = await import('../db.js');
        
        const backup = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {
                chats: await ChatsDB.getAll(),
                worldInfo: await WorldInfoDB.getAll(),
                characters: await CharactersDB.getAll(),
                settings: await SettingsDB.getAll()
            }
        };
        
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ios-classic-ai-backup-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        createToast('備份已匯出', 'success');
    } catch (error) {
        createToast('匯出失敗: ' + error.message, 'error');
    }
}

export { render };